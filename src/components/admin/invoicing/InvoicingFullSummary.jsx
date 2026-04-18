import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const USA_VALS = ["america", "usa"];
const isUSA = (c) => USA_VALS.includes((c || "").toLowerCase().trim());

const CLIENT_CC_LIKE = ["client cc", "clientcc", "client"];
const STAFF_PAID = ["Staff member CC", "Staff member Cash"];

function isClientCC(paid_by) {
  const lower = (paid_by || "").toLowerCase();
  return CLIENT_CC_LIKE.some(v => lower.includes(v));
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
}

export default function InvoicingFullSummary({ household, orders, appSettings }) {
  const [expenses, setExpenses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const summaryRef = useRef(null);
  const isAmerican = isUSA(household?.country);
  const curr = isAmerican ? "$" : "₪";
  const roleRates = appSettings?.role_rates || [];
  const defaultVat = household?.vat_rate != null ? household.vat_rate : 0.18;
  const [vatInput, setVatInput] = useState(String(defaultVat * 100));
  const vatRate = (parseFloat(vatInput) || 0) / 100;
  // Local-only overrides for hours/rate/total columns (not saved)
  const [hoursOverrides, setHoursOverrides] = useState({});
  const [rateOverrides, setRateOverrides] = useState({});
  const [totalOverrides, setTotalOverrides] = useState({});

  useEffect(() => {
    if (!household?.id) return;
    setIsLoading(true);
    Promise.all([
      base44.entities.Expense.filter({ household_id: household.id }),
      base44.entities.Shift.filter({ household_id: household.id }),
      base44.entities.HouseholdStaff.filter({ household_id: household.id }),
    ]).then(async ([e, s, hs]) => {
      setExpenses(e);
      setShifts(s);
      setHouseholdStaff(hs);
      if (hs.length > 0) {
        const userIds = [...new Set(hs.map(a => a.staff_user_id))];
        const users = await base44.entities.User.filter({ id: { $in: userIds } });
        setStaffUsers(users);
      }
    }).finally(() => setIsLoading(false));
  }, [household?.id]);

  const getRoleChargeRate = (job, paymentType) => {
    const match = roleRates.find(r => r.job_role?.toLowerCase() === (job || "").toLowerCase());
    if (!match) return 0;
    if (paymentType === "daily") return isAmerican ? (match.charge_per_day_usd || 0) : (match.charge_per_day || 0);
    return isAmerican ? (match.charge_per_hour_usd || 0) : (match.charge_per_hour || 0);
  };

  // Labor: group by role
  const laborByRole = useMemo(() => {
    const approvedShifts = shifts.filter(s => s.is_approved && (s.done_date_time || s.payment_type === "daily"));
    const map = {};
    approvedShifts.forEach(s => {
      const job = s.job || "other";
      if (!map[job]) map[job] = { job, hours: 0, days: 0, charged: 0 };
      const isDaily = s.payment_type === "daily";
      const isContract = s.payment_type === "contract";
      const chargeRate = (isDaily || isContract) ? (s.charge_per_day || 0) : (s.charge_per_hour || 0);
      const hours = (isDaily || isContract) ? 0 : calcHours(s.start_date_time, s.done_date_time);
      const charged = (isDaily || isContract) ? chargeRate : hours * chargeRate;
      if (!isDaily && !isContract) map[job].hours += hours;
      if (isDaily || isContract) map[job].days += 1;
      map[job].charged += charged;
    });
    return Object.values(map);
  }, [shifts, roleRates, isAmerican]);

  const laborTotal = laborByRole.reduce((s, r) => {
    if (totalOverrides[r.job] !== undefined) return s + (parseFloat(totalOverrides[r.job]) || 0);
    const sample = shifts.find(sh => (sh.job || "other") === r.job && sh.is_approved);
    const isDaily = sample?.payment_type === "daily";
    const isContract = sample?.payment_type === "contract";
    const rawRate = (isDaily || isContract) ? (sample?.charge_per_day || 0) : (sample?.charge_per_hour || 0);
    const hoursVal = hoursOverrides[r.job] !== undefined ? parseFloat(hoursOverrides[r.job]) || 0 : ((isDaily || isContract) ? r.days : r.hours);
    const rateVal = rateOverrides[r.job] !== undefined ? parseFloat(rateOverrides[r.job]) || 0 : rawRate;
    return s + hoursVal * rateVal;
  }, 0);

  const unapprovedShifts = useMemo(() =>
    shifts.filter(s => s.is_active !== false && !s.is_approved && (s.done_date_time || s.payment_type === "daily")),
    [shifts]
  );
  const unapprovedExpenses = useMemo(() =>
    expenses.filter(e => e.is_active !== false && !e.is_approved),
    [expenses]
  );

  // Purchasing & AP: only approved, non-client-CC
  const apTotal = useMemo(() => expenses
    .filter(e => e.is_approved && !isClientCC(e.paid_by))
    .reduce((s, e) => s + (e.amount || 0), 0),
    [expenses]
  );

  // Orders total for this household — only non-client-CC are billable
  const householdOrders = useMemo(
    () => (orders || []).filter(o => o.household_id === household?.id),
    [orders, household?.id]
  );
  const billableOrdersTotal = householdOrders
    .filter(o => o.for_billing === true)
    .reduce((s, o) => s + (o.total_amount || 0), 0);
  const clientCCOrdersTotal = householdOrders
    .filter(o => o.for_billing === false)
    .reduce((s, o) => s + (o.total_amount || 0), 0);

  const vat = laborTotal * vatRate;
  const subtotal = laborTotal + apTotal + billableOrdersTotal;
  const grandTotal = subtotal + vat;

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const householdDisplayName = household?.name || "Valued Client";
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
          body { font-family: Georgia, 'Times New Roman', serif; padding: 48px 56px; color: #1a1a1a; background: #fff; }
          .letterhead { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #c9a84c; padding-bottom: 20px; margin-bottom: 28px; }
          .letterhead-left { display: flex; align-items: center; gap: 18px; }
          .logo { width: 80px; height: 80px; object-fit: contain; }
          .company-name { font-size: 22px; font-weight: bold; color: #1a1a1a; letter-spacing: 1px; }
          .company-tagline { font-size: 11px; color: #7a6020; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
          .letterhead-right { text-align: right; font-size: 12px; color: #555; line-height: 1.7; }
          .invoice-title { font-size: 28px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: #1a1a1a; margin-bottom: 2px; }
          .invoice-subtitle { font-size: 11px; color: #c9a84c; letter-spacing: 2px; text-transform: uppercase; }
          .gold-line { border: none; border-top: 1px solid #c9a84c; margin: 20px 0; }
          .salutation { font-size: 14px; color: #1a1a1a; margin-bottom: 10px; line-height: 1.8; }
          .salutation-name { font-weight: bold; }
          .intro-text { font-size: 13px; color: #444; margin-bottom: 24px; line-height: 1.7; font-style: italic; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; }
          thead tr { background: #1a1a1a; color: #fff; }
          th { padding: 10px 14px; text-align: left; font-weight: 600; font-family: Arial, sans-serif; font-size: 12px; letter-spacing: 0.5px; }
          td { padding: 9px 14px; border-bottom: 1px solid #e8e0cc; font-family: Arial, sans-serif; }
          tbody tr:nth-child(even) { background: #fdfaf3; }
          tfoot td { background: #f5f0e8; font-weight: 700; border-top: 2px solid #c9a84c; font-family: Arial, sans-serif; }
          .summary-box { border: 1px solid #c9a84c; border-radius: 4px; overflow: hidden; margin-top: 8px; }
          .summary-title { background: #1a1a1a; color: #c9a84c; padding: 10px 18px; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-family: Arial, sans-serif; }
          .summary-row { display: flex; justify-content: space-between; padding: 7px 18px; font-size: 13px; font-family: Arial, sans-serif; border-bottom: 1px solid #f0ebe0; }
          .summary-row.grand { background: #fdfaf3; border-top: 2px solid #c9a84c; padding: 14px 18px; font-size: 16px; font-weight: bold; color: #7a6020; border-bottom: none; }
          .label-gray { color: #666; }
          .text-right { text-align: right; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8e0cc; text-align: center; font-size: 11px; color: #999; font-family: Arial, sans-serif; letter-spacing: 0.5px; }
        </style></head><body>
        <div class="letterhead">
          <div class="letterhead-left">
            <img class="logo" src="https://media.base44.com/images/public/68741e1ee947984fac63c8cf/9c73cd871_Picture1.png" alt="KCS Logo" crossorigin="anonymous" />
            <div>
              <div class="company-name">Kosher Chef Services</div>
              <div class="company-tagline">Premium Household Management</div>
            </div>
          </div>
          <div class="letterhead-right">
            <div class="invoice-title">Invoice</div>
            <div class="invoice-subtitle">Official Statement</div>
            <div style="margin-top:8px;">Date: <strong>${format(new Date(), "MMMM d, yyyy")}</strong></div>
            ${household?.household_code ? `<div>Ref: <strong>${household.household_code.split("-")[0]}</strong></div>` : ""}
          </div>
        </div>

        <div class="salutation">
          Dear ${householdDisplayName},
        </div>
        <hr class="gold-line" />

        <table>
          <thead><tr><th>Position</th><th class="text-right">${isAmerican ? "Days/Shifts" : "Hours"}</th><th class="text-right">Rate (${curr})</th><th class="text-right">Total (${curr})</th></tr></thead>
          <tbody>
            ${laborByRole.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:20px;">No approved shifts.</td></tr>` :
              laborByRole.map(role => {
                const sample = shifts.find(s => (s.job || "other") === role.job && s.is_approved);
                const isDaily = sample?.payment_type === "daily";
                const rawRate = isDaily ? (sample?.charge_per_day || 0) : (sample?.charge_per_hour || 0);
                const hoursVal = hoursOverrides[role.job] !== undefined ? hoursOverrides[role.job] : (isDaily ? role.days : role.hours.toFixed(1));
                const rateVal = rateOverrides[role.job] !== undefined ? rateOverrides[role.job] : String(rawRate);
                const computedRowTotal = (parseFloat(hoursVal) || 0) * (parseFloat(rateVal) || 0);
                const rowTotal = totalOverrides[role.job] !== undefined ? (parseFloat(totalOverrides[role.job]) || 0) : computedRowTotal;
                return `<tr>
                  <td style="text-transform:capitalize;font-weight:500">${role.job}</td>
                  <td class="text-right">${hoursVal}</td>
                  <td class="text-right" style="color:#888">${rateVal}</td>
                  <td class="text-right" style="font-weight:700">${curr}${rowTotal.toFixed(2)}</td>
                </tr>`;
              }).join("")}
          </tbody>
          <tfoot><tr><td colspan="3">Labor Subtotal</td><td class="text-right">${curr}${laborTotal.toFixed(2)}</td></tr></tfoot>
        </table>

        <div class="summary-box">
          <div class="summary-title">Invoice Summary</div>
          <div class="summary-row"><span class="label-gray">Labor Total</span><span>${curr}${laborTotal.toFixed(2)}</span></div>
          <div class="summary-row"><span class="label-gray">Purchasing (A/P)</span><span>${curr}${apTotal.toFixed(2)}</span></div>
          <div class="summary-row"><span class="label-gray">Orders (billable)</span><span>${curr}${billableOrdersTotal.toFixed(2)}</span></div>
          <div class="summary-row" style="font-weight:600;border-top:1px solid #c9a84c;"><span>Subtotal</span><span>${curr}${subtotal.toFixed(2)}</span></div>
          <div class="summary-row"><span class="label-gray">VAT (${(vatRate * 100).toFixed(0)}%) on Labor</span><span>${curr}${vat.toFixed(2)}</span></div>
          <div class="summary-row grand"><span>GRAND TOTAL</span><span>${curr}${grandTotal.toFixed(2)}</span></div>
        </div>

        <div class="footer">
          Kosher Chef Services &nbsp;|&nbsp; info@koshercs.com
        </div>
      </body></html>`;

      const res = await base44.functions.invoke("my_html2pdf", {
        htmlContent,
        filename: `Invoice-${household?.name || "Household"}-${format(new Date(), "yyyy-MM-dd")}.pdf`,
        options: { format: "A4", margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" }, printBackground: true }
      });

      let data = res?.data;
      while (typeof data === "string") { try { data = JSON.parse(data); } catch { break; } }
      const b64 = (data?.pdfBase64 || data || "").replace(/\s/g, "");
      const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${household?.name || "Household"}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF export failed", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-5">
      {/* Export button */}
      <div className="flex justify-end">
        <Button onClick={handleExportPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? "Generating PDF..." : "Export PDF"}
        </Button>
      </div>

      {/* Invoice header */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
            <p className="text-gray-500 text-sm mt-1">Kosher Chef Services</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Date: <strong>{format(new Date(), "MM/dd/yyyy")}</strong></p>
            <p>Household: <strong>{household?.name || "—"}</strong></p>
            {household?.household_code && <p>Code: <strong>{household.household_code.split("-")[0]}</strong></p>}
          </div>
        </div>
      </div>

      {/* Unapproved warnings */}
      {unapprovedShifts.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            <strong>{unapprovedShifts.length} shift{unapprovedShifts.length > 1 ? "s" : ""}</strong> pending approval — not included in the labor total.
          </span>
        </div>
      )}
      {unapprovedExpenses.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            <strong>{unapprovedExpenses.length} purchase{unapprovedExpenses.length > 1 ? "s" : ""}</strong> pending approval — not included in the A/P total.
          </span>
        </div>
      )}

      {/* Staff self-confirmation warnings */}
      {householdStaff.filter(a => !a.approved_shifts_complete || !a.approved_ap_complete).map(a => {
        const u = staffUsers.find(u => u.id === a.staff_user_id);
        const name = u?.full_name || u?.email || "Unknown staff";
        const missing = [];
        if (!a.approved_shifts_complete) missing.push("shifts");
        if (!a.approved_ap_complete) missing.push("expenses/purchases");
        return (
          <div key={a.id} className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-red-800 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>
              <strong>{name}</strong> has not confirmed their {missing.join(" or ")} are complete.
            </span>
          </div>
        );
      })}

      {/* Labor section */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b font-semibold text-gray-700">Labor / Staff Hours</div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-5 py-2 text-left text-gray-600">Position</th>
              <th className="px-5 py-2 text-right text-gray-600">{isAmerican ? "Days/Shifts" : "Hours"}</th>
              <th className="px-5 py-2 text-right text-gray-600">Rate ({curr})</th>
              <th className="px-5 py-2 text-right text-gray-600 font-bold">Total ({curr})</th>
            </tr>
          </thead>
          <tbody>
            {laborByRole.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-4 text-gray-400 text-center">No approved shifts.</td></tr>
            )}
            {laborByRole.map(role => {
              const sample = shifts.find(s => (s.job || "other") === role.job && s.is_approved);
              const isDaily = sample?.payment_type === "daily";
              const rawRate = isDaily ? (sample?.charge_per_day || 0) : (sample?.charge_per_hour || 0);
              const defaultHours = isDaily ? role.days : role.hours;
              const hoursDisplay = hoursOverrides[role.job] !== undefined ? hoursOverrides[role.job] : defaultHours.toFixed(isDaily ? 0 : 1);
              const rateDisplay = rateOverrides[role.job] !== undefined ? rateOverrides[role.job] : String(rawRate);
              const hoursNum = parseFloat(hoursDisplay) || 0;
              const rateNum = parseFloat(rateDisplay) || 0;
              const computedTotal = hoursNum * rateNum;
              const totalDisplay = totalOverrides[role.job] !== undefined ? totalOverrides[role.job] : computedTotal.toFixed(2);
              return (
                <tr key={role.job} className="border-b">
                  <td className="px-5 py-2 capitalize">{role.job}</td>
                  <td className="px-5 py-2 text-right">
                    <input
                      value={hoursDisplay}
                      onChange={e => { setHoursOverrides(prev => ({ ...prev, [role.job]: e.target.value })); setTotalOverrides(prev => { const n = { ...prev }; delete n[role.job]; return n; }); }}
                      className="w-20 text-right border border-gray-200 rounded px-1 py-0.5 text-sm bg-yellow-50 focus:outline-none focus:border-blue-400"
                      title="Preview only — not saved"
                    />
                  </td>
                  <td className="px-5 py-2 text-right text-gray-500">
                    <input
                      value={rateDisplay}
                      onChange={e => { setRateOverrides(prev => ({ ...prev, [role.job]: e.target.value })); setTotalOverrides(prev => { const n = { ...prev }; delete n[role.job]; return n; }); }}
                      className="w-24 text-right border border-gray-200 rounded px-1 py-0.5 text-sm bg-yellow-50 focus:outline-none focus:border-blue-400"
                      title="Preview only — not saved"
                    />
                  </td>
                  <td className="px-5 py-2 text-right font-semibold">
                    <span className="mr-0.5 text-gray-400 text-xs">{curr}</span>
                    <input
                      value={totalDisplay}
                      onChange={e => setTotalOverrides(prev => ({ ...prev, [role.job]: e.target.value }))}
                      className="w-24 text-right border border-gray-200 rounded px-1 py-0.5 text-sm bg-yellow-50 font-semibold focus:outline-none focus:border-blue-400"
                      title="Preview only — not saved"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t font-semibold">
              <td className="px-5 py-2 text-gray-700" colSpan={3}>Labor Subtotal</td>
              <td className="px-5 py-2 text-right">{curr}{laborTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Grand total */}
      <div className="bg-white rounded-xl border-2 border-blue-300 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-blue-50 border-b font-semibold text-blue-800">Invoice Summary</div>
        <div className="px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Labor Total</span>
            <span className="font-medium">{curr}{laborTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Purchasing (A/P)</span>
            <span className="font-medium">{curr}{apTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Orders (billable)</span>
            <span className="font-medium">{curr}{billableOrdersTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-gray-700 font-semibold">Subtotal</span>
            <span className="font-semibold">{curr}{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-sm text-gray-500 items-center">
              <span className="flex items-center gap-1">
                VAT (
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={vatInput}
                  onChange={e => setVatInput(e.target.value)}
                  className="w-12 border border-gray-300 rounded px-1 text-center text-gray-700 text-xs"
                />
                %) on Labor
              </span>
              <span>{curr}{vat.toFixed(2)}</span>
            </div>
            <p className="text-xs text-amber-500 italic">⚠ This VAT adjustment is for preview only and is not saved.</p>
          </div>
          <div className="flex justify-between text-lg font-bold border-t-2 border-blue-300 pt-3 text-blue-800">
            <span>GRAND TOTAL</span>
            <span>{curr}{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}