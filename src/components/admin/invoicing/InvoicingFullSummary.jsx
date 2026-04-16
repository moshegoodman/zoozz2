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
      const chargeRate = isDaily ? (s.charge_per_day || 0) : (s.charge_per_hour || 0);
      const hours = isDaily ? 0 : calcHours(s.start_date_time, s.done_date_time);
      const charged = isDaily ? chargeRate : hours * chargeRate;
      if (!isDaily) map[job].hours += hours;
      if (isDaily) map[job].days += 1;
      map[job].charged += charged;
    });
    return Object.values(map);
  }, [shifts, roleRates, isAmerican]);

  const laborTotal = laborByRole.reduce((s, r) => s + r.charged, 0);

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
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
          h2 { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
          p { margin: 0; color: #6b7280; font-size: 13px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
          .header-right { text-align: right; font-size: 13px; color: #374151; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
          th { background: #f3f4f6; padding: 8px 12px; text-align: left; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
          td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
          tfoot td { background: #f9fafb; font-weight: 600; }
          .summary-box { border: 2px solid #93c5fd; border-radius: 8px; overflow: hidden; }
          .summary-title { background: #eff6ff; padding: 10px 16px; font-weight: 600; color: #1e40af; font-size: 14px; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 16px; font-size: 13px; }
          .summary-row.border-top { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 2px; }
          .summary-row.grand { border-top: 2px solid #93c5fd; padding-top: 12px; font-size: 17px; font-weight: bold; color: #1e40af; }
          .label-gray { color: #6b7280; }
          .text-right { text-align: right; }
        </style></head><body>
        <div class="header">
          <div><h2>INVOICE</h2><p>Kosher Chef Services</p></div>
          <div class="header-right">
            <div>Date: <strong>${format(new Date(), "MM/dd/yyyy")}</strong></div>
            <div>Household: <strong>${household?.name || "—"}</strong></div>
            ${household?.household_code ? `<div>Code: <strong>${household.household_code.split("-")[0]}</strong></div>` : ""}
          </div>
        </div>
        <table>
          <thead><tr><th>Position</th><th class="text-right">${isAmerican ? "Days/Shifts" : "Hours"}</th><th class="text-right">Rate (${curr})</th><th class="text-right">Total (${curr})</th></tr></thead>
          <tbody>
            ${laborByRole.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#9ca3af;">No approved shifts.</td></tr>` :
              laborByRole.map(role => {
                const sample = shifts.find(s => (s.job || "other") === role.job && s.is_approved);
                const isDaily = sample?.payment_type === "daily";
                const chargeRate = isDaily ? (sample?.charge_per_day || 0) : (sample?.charge_per_hour || 0);
                return `<tr>
                  <td style="text-transform:capitalize">${role.job}</td>
                  <td class="text-right">${isAmerican ? (isDaily ? role.days : role.hours.toFixed(1)) : (isDaily ? "—" : role.hours.toFixed(1))}</td>
                  <td class="text-right" style="color:#6b7280">${curr}${chargeRate}/${isDaily ? "day" : "hr"}</td>
                  <td class="text-right" style="font-weight:600">${curr}${role.charged.toFixed(2)}</td>
                </tr>`;
              }).join("")}
          </tbody>
          <tfoot><tr><td colspan="3">Labor Subtotal</td><td class="text-right">${curr}${laborTotal.toFixed(2)}</td></tr></tfoot>
        </table>
        <div class="summary-box">
          <div class="summary-title">Invoice Summary</div>
          <div style="padding: 12px 0 8px;">
            <div class="summary-row"><span class="label-gray">Labor Total</span><span>${curr}${laborTotal.toFixed(2)}</span></div>
            <div class="summary-row"><span class="label-gray">Purchasing (A/P)</span><span>${curr}${apTotal.toFixed(2)}</span></div>
            <div class="summary-row"><span class="label-gray">Orders (billable)</span><span>${curr}${billableOrdersTotal.toFixed(2)}</span></div>
            <div class="summary-row border-top"><span style="font-weight:600">Subtotal</span><span style="font-weight:600">${curr}${subtotal.toFixed(2)}</span></div>
            <div class="summary-row"><span class="label-gray">VAT (${(vatRate * 100).toFixed(0)}%) on Labor</span><span>${curr}${vat.toFixed(2)}</span></div>
            <div class="summary-row grand"><span>GRAND TOTAL</span><span>${curr}${grandTotal.toFixed(2)}</span></div>
          </div>
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
              const chargeRate = isDaily ? (sample?.charge_per_day || 0) : (sample?.charge_per_hour || 0);
              return (
                <tr key={role.job} className="border-b">
                  <td className="px-5 py-2 capitalize">{role.job}</td>
                  <td className="px-5 py-2 text-right">{isAmerican ? (isDaily ? role.days : role.hours.toFixed(1)) : (isDaily ? "—" : role.hours.toFixed(1))}</td>
                  <td className="px-5 py-2 text-right text-gray-500">{curr}{chargeRate}/{isDaily ? "day" : "hr"}</td>
                  <td className="px-5 py-2 text-right font-semibold">{curr}{role.charged.toFixed(2)}</td>
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