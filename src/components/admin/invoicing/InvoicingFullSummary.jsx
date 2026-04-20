import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertTriangle, Plus, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";

const USA_VALS = ["america", "usa"];
const isUSA = (c) => USA_VALS.includes((c || "").toLowerCase().trim());

const CLIENT_CC_LIKE = ["client cc", "clientcc", "client"];

function isClientCC(paid_by) {
  const lower = (paid_by || "").toLowerCase();
  return CLIENT_CC_LIKE.some(v => lower.includes(v));
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
}

// A single editable cell input
function EditCell({ value, onChange, className = "", placeholder = "" }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border border-gray-200 rounded px-1 py-0.5 text-sm bg-yellow-50 focus:outline-none focus:border-blue-400 ${className}`}
      title="Preview only — not saved"
    />
  );
}

export default function InvoicingFullSummary({ household, orders, appSettings }) {
  const [expenses, setExpenses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDetailed, setIsExportingDetailed] = useState(false);
  const isAmerican = isUSA(household?.country);
  const curr = isAmerican ? "$" : "₪";
  const roleRates = appSettings?.role_rates || [];
  const defaultVat = household?.vat_rate != null ? household.vat_rate : 0.18;
  const [vatInput, setVatInput] = useState(String(defaultVat * 100));
  const vatRate = (parseFloat(vatInput) || 0) / 100;

  // Editable salutation & tagline
  const [salutation, setSalutation] = useState("");
  const [tagline, setTagline] = useState("Premium Staffing Management");

  // All table rows as editable state: { id, label, qty, rate, amount }
  // qty/rate are display-only; amount is the final billable value
  const [tableRows, setTableRows] = useState(null); // null = not yet initialized
  const rowsInitialized = useRef(false);

  useEffect(() => {
    if (!household?.id) return;
    setIsLoading(true);
    setSalutation(household?.name || "Valued Client");
    rowsInitialized.current = false;
    setTableRows(null);
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
    const ROLE_ORDER = ["chef", "sous chef", "cook", "waiter", "cleaner", "housekeeping", "householdManager", "house manager", "other"];
    return Object.values(map).sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.job);
      const bi = ROLE_ORDER.indexOf(b.job);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [shifts]);

  const apTotal = useMemo(() => expenses
    .filter(e => e.is_approved && !isClientCC(e.paid_by))
    .reduce((s, e) => s + (e.amount || 0), 0),
    [expenses]
  );

  const householdOrders = useMemo(
    () => (orders || []).filter(o => o.household_id === household?.id),
    [orders, household?.id]
  );
  const billableOrdersTotal = householdOrders
    .filter(o => o.for_billing === true)
    .reduce((s, o) => s + (o.total_amount || 0), 0);

  // Initialize tableRows once data is loaded
  useEffect(() => {
    if (isLoading || rowsInitialized.current) return;
    rowsInitialized.current = true;

    const laborRows = laborByRole.map(role => {
      const sample = shifts.find(s => (s.job || "other") === role.job && s.is_approved);
      const isDaily = sample?.payment_type === "daily";
      const rawRate = isDaily ? (sample?.charge_per_day || 0) : (sample?.charge_per_hour || 0);
      return {
        id: `labor_${role.job}`,
        label: role.job,
        qty: (isDaily ? role.days : role.hours).toFixed(isDaily ? 0 : 1),
        rate: String(rawRate),
        amount: role.charged.toFixed(2),
      };
    });

    const fixedRows = [
      { id: "ap", label: "Purchasing (A/P)", qty: "", rate: "", amount: apTotal.toFixed(2) },
      { id: "orders", label: "Orders (billable)", qty: "", rate: "", amount: billableOrdersTotal.toFixed(2) },
    ];

    setTableRows([...laborRows, ...fixedRows]);
  }, [isLoading, laborByRole, apTotal, billableOrdersTotal]);

  const updateRow = (id, field, value) => {
    setTableRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteRow = (id) => {
    setTableRows(prev => prev.filter(r => r.id !== id));
  };

  const addRow = () => {
    setTableRows(prev => [...prev, {
      id: `custom_${Date.now()}`,
      label: "",
      qty: "",
      rate: "",
      amount: "0.00",
    }]);
  };

  const subtotal = (tableRows || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  // laborTotal = sum of rows that came from labor (for VAT calc — approximate by all rows except last 2 fixed)
  const laborSubtotal = (tableRows || [])
    .filter(r => r.id !== "ap" && r.id !== "orders" && !r.id.startsWith("custom_"))
    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const vat = laborSubtotal * vatRate;
  const grandTotal = subtotal + vat;

  const unapprovedShifts = useMemo(() =>
    shifts.filter(s => s.is_active !== false && !s.is_approved && (s.done_date_time || s.payment_type === "daily")),
    [shifts]
  );
  const unapprovedExpenses = useMemo(() =>
    expenses.filter(e => e.is_active !== false && !e.is_approved),
    [expenses]
  );

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
              <div class="company-tagline">${tagline}</div>
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
          Dear ${salutation},
        </div>
        <hr class="gold-line" />

        <table>
          <thead><tr><th>Description</th><th class="text-right">${isAmerican ? "Days/Shifts" : "Hours"}</th><th class="text-right">Rate (${curr})</th><th class="text-right">Amount (${curr})</th></tr></thead>
          <tbody>
            ${(tableRows || []).map(row => `<tr>
              <td style="font-weight:500">${row.label}</td>
              <td class="text-right">${row.qty || "—"}</td>
              <td class="text-right" style="color:#888">${row.rate || "—"}</td>
              <td class="text-right" style="font-weight:700">${curr}${fmt(parseFloat(row.amount) || 0)}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot>
            <tr><td colspan="3">Subtotal</td><td class="text-right">${curr}${fmt(subtotal)}</td></tr>
            <tr><td colspan="3">VAT (${(vatRate * 100).toFixed(0)}%) on Labor</td><td class="text-right">${curr}${fmt(vat)}</td></tr>
            <tr><td colspan="3" style="font-size:15px;">GRAND TOTAL</td><td class="text-right" style="font-size:15px;">${curr}${fmt(grandTotal)}</td></tr>
          </tfoot>
        </table>

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

  const handleExportDetailedPDF = async () => {
    setIsExportingDetailed(true);
    try {
      const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // --- Page 1: Invoice summary (same as existing export) ---
      const page1 = `
        <div class="letterhead">
          <div class="letterhead-left">
            <img class="logo" src="https://media.base44.com/images/public/68741e1ee947984fac63c8cf/9c73cd871_Picture1.png" alt="KCS Logo" crossorigin="anonymous" />
            <div>
              <div class="company-name">Kosher Chef Services</div>
              <div class="company-tagline">${tagline}</div>
            </div>
          </div>
          <div class="letterhead-right">
            <div class="invoice-title">Invoice</div>
            <div class="invoice-subtitle">Official Statement</div>
            <div style="margin-top:8px;">Date: <strong>${format(new Date(), "MMMM d, yyyy")}</strong></div>
            ${household?.household_code ? `<div>Ref: <strong>${household.household_code.split("-")[0]}</strong></div>` : ""}
          </div>
        </div>
        <div class="salutation">Dear ${salutation},</div>
        <hr class="gold-line" />
        <table>
          <thead><tr><th>Description</th><th class="text-right">${isAmerican ? "Days/Shifts" : "Hours"}</th><th class="text-right">Rate (${curr})</th><th class="text-right">Amount (${curr})</th></tr></thead>
          <tbody>
            ${(tableRows || []).map(row => `<tr>
              <td style="font-weight:500">${row.label}</td>
              <td class="text-right">${row.qty || "—"}</td>
              <td class="text-right" style="color:#888">${row.rate || "—"}</td>
              <td class="text-right" style="font-weight:700">${curr}${fmt(parseFloat(row.amount) || 0)}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot>
            <tr><td colspan="3">Subtotal</td><td class="text-right">${curr}${fmt(subtotal)}</td></tr>
            <tr><td colspan="3">VAT (${(vatRate * 100).toFixed(0)}%) on Labor</td><td class="text-right">${curr}${fmt(vat)}</td></tr>
            <tr><td colspan="3" style="font-size:15px;">GRAND TOTAL</td><td class="text-right" style="font-size:15px;">${curr}${fmt(grandTotal)}</td></tr>
          </tfoot>
        </table>
        <div class="footer">Kosher Chef Services &nbsp;|&nbsp; info@koshercs.com</div>`;

      // --- Page 2: Time Log sorted by role ---
      const approvedShifts = shifts.filter(s => s.is_approved && (s.done_date_time || s.payment_type === "daily" || s.payment_type === "contract"));
      const shiftsByRole = {};
      approvedShifts.forEach(s => {
        const role = s.job || "other";
        if (!shiftsByRole[role]) shiftsByRole[role] = [];
        shiftsByRole[role].push(s);
      });
      const ROLE_ORDER = ["chef", "sous chef", "cook", "waiter", "cleaner", "housekeeping", "householdManager", "house manager", "other"];
      const sortedRoles = Object.keys(shiftsByRole).sort((a, b) => {
        const ai = ROLE_ORDER.indexOf(a);
        const bi = ROLE_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

      const timeLogRows = sortedRoles.map(role => {
        const roleShifts = shiftsByRole[role];
        const roleRows = roleShifts.map(s => {
          const isDaily = s.payment_type === "daily";
          const isContract = s.payment_type === "contract";
          const hours = (!isDaily && !isContract && s.done_date_time) ? calcHours(s.start_date_time, s.done_date_time).toFixed(2) : "—";
          const payRate = isDaily || isContract ? (s.price_per_day || 0) : (s.price_per_hour || 0);
          const chargeRate = isDaily || isContract ? (s.charge_per_day || 0) : (s.charge_per_hour || 0);
          const pay = isDaily || isContract ? payRate : (parseFloat(hours) || 0) * payRate;
          const charge = isDaily || isContract ? chargeRate : (parseFloat(hours) || 0) * chargeRate;
          const startFmt = s.start_date_time ? format(new Date(s.start_date_time), "MMM d, HH:mm") : "—";
          const endFmt = s.done_date_time ? format(new Date(s.done_date_time), "MMM d, HH:mm") : (isDaily || isContract ? "—" : "Missing");
          return `<tr>
            <td>${startFmt}</td>
            <td>${endFmt}</td>
            <td class="text-right">${hours}</td>
            <td class="text-right">${isDaily ? "Daily" : isContract ? "Contract" : "Hourly"}</td>
            <td class="text-right">${curr}${fmt(charge)}</td>
          </tr>`;
        }).join("");
        const roleTotalCharge = roleShifts.reduce((sum, s) => {
          const isDaily = s.payment_type === "daily";
          const isContract = s.payment_type === "contract";
          if (isDaily || isContract) return sum + (s.charge_per_day || 0);
          return sum + calcHours(s.start_date_time, s.done_date_time) * (s.charge_per_hour || 0);
        }, 0);
        const roleTotalPay = roleShifts.reduce((sum, s) => {
          const isDaily = s.payment_type === "daily";
          const isContract = s.payment_type === "contract";
          if (isDaily || isContract) return sum + (s.price_per_day || 0);
          return sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0);
        }, 0);
        return `
          <div class="role-header">${role.charAt(0).toUpperCase() + role.slice(1)}</div>
          <table>
            <thead><tr><th>Start</th><th>End</th><th class="text-right">Hours</th><th class="text-right">Type</th><th class="text-right">Amount (${curr})</th></tr></thead>
            <tbody>${roleRows}</tbody>
            <tfoot><tr><td colspan="4">Role Total</td><td class="text-right">${curr}${fmt(roleTotalCharge)}</td></tr></tfoot>
          </table>`;
      }).join("");

      const timeTotalCharge = approvedShifts.reduce((sum, s) => {
        const isDaily = s.payment_type === "daily";
        const isContract = s.payment_type === "contract";
        if (isDaily || isContract) return sum + (s.charge_per_day || 0);
        return sum + calcHours(s.start_date_time, s.done_date_time) * (s.charge_per_hour || 0);
      }, 0);
      const timeTotalPay = approvedShifts.reduce((sum, s) => {
        const isDaily = s.payment_type === "daily";
        const isContract = s.payment_type === "contract";
        if (isDaily || isContract) return sum + (s.price_per_day || 0);
        return sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0);
      }, 0);

      const page2 = `
        <div class="page-header">
          <div class="company-name" style="font-size:18px;">Kosher Chef Services — Time Log</div>
          <div style="font-size:12px;color:#555;margin-top:4px;">${household?.name || ""} &nbsp;|&nbsp; ${format(new Date(), "MMMM d, yyyy")}</div>
        </div>
        <hr class="gold-line" />
        ${timeLogRows || '<p style="color:#888;font-style:italic;">No approved shifts.</p>'}
        <div class="summary-box" style="margin-top:16px;">
          <div class="summary-title">Grand Total — All Roles</div>
          <div class="summary-row grand"><span>Total Labor Charge</span><span>${curr}${fmt(timeTotalCharge)}</span></div>
        </div>
        <div class="footer">Kosher Chef Services &nbsp;|&nbsp; info@koshercs.com</div>`;

      // --- Page 3: A/P and Orders ---
      const approvedExpenses = expenses.filter(e => e.is_approved);
      const expenseRows = approvedExpenses.map(e => `<tr>
        <td>${e.date ? format(new Date(e.date), "MMM d, yyyy") : "—"}</td>
        <td>${e.description || "—"}</td>
        <td>${e.paid_by || "—"}</td>
        <td class="text-right ${isClientCC(e.paid_by) ? "client-cc" : ""}">${curr}${fmt(e.amount || 0)}</td>
      </tr>`).join("");
      const apClientTotal = approvedExpenses.filter(e => isClientCC(e.paid_by)).reduce((s, e) => s + (e.amount || 0), 0);
      const apKCSTotal = approvedExpenses.filter(e => !isClientCC(e.paid_by)).reduce((s, e) => s + (e.amount || 0), 0);

      const billableOrders = householdOrders.filter(o => o.for_billing === true);
      const orderRows = billableOrders.map(o => `<tr>
        <td>${o.order_number || "—"}</td>
        <td>${o.created_date ? format(new Date(o.created_date), "MMM d, yyyy") : "—"}</td>
        <td>${(o.items || []).length} items</td>
        <td class="text-right" style="font-weight:700">${curr}${fmt(o.total_amount || 0)}</td>
      </tr>`).join("");

      const page3 = `
        <div class="page-header">
          <div class="company-name" style="font-size:18px;">Kosher Chef Services — A/P &amp; Orders</div>
          <div style="font-size:12px;color:#555;margin-top:4px;">${household?.name || ""} &nbsp;|&nbsp; ${format(new Date(), "MMMM d, yyyy")}</div>
        </div>
        <hr class="gold-line" />
        <div class="section-title">Purchasing (A/P) — Approved Expenses</div>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Paid By</th><th class="text-right">Amount (${curr})</th></tr></thead>
          <tbody>${expenseRows || '<tr><td colspan="4" style="color:#888;font-style:italic;">No approved expenses.</td></tr>'}</tbody>
          <tfoot>
            <tr><td colspan="3">KCS Pay Total (billable)</td><td class="text-right">${curr}${fmt(apKCSTotal)}</td></tr>
            <tr><td colspan="3">Client CC Total (pass-through)</td><td class="text-right" style="color:#888;">${curr}${fmt(apClientTotal)}</td></tr>
          </tfoot>
        </table>
        <div class="section-title" style="margin-top:24px;">Orders — Billable</div>
        <table>
          <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th class="text-right">Total (${curr})</th></tr></thead>
          <tbody>${orderRows || '<tr><td colspan="4" style="color:#888;font-style:italic;">No billable orders.</td></tr>'}</tbody>
          <tfoot>
            <tr><td colspan="3">Orders Total</td><td class="text-right">${curr}${fmt(billableOrdersTotal)}</td></tr>
          </tfoot>
        </table>
        <div class="footer">Kosher Chef Services &nbsp;|&nbsp; info@koshercs.com</div>`;

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
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          thead tr { background: #1a1a1a; color: #fff; }
          th { padding: 8px 12px; text-align: left; font-weight: 600; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 0.5px; }
          td { padding: 7px 12px; border-bottom: 1px solid #e8e0cc; font-family: Arial, sans-serif; }
          tbody tr:nth-child(even) { background: #fdfaf3; }
          tfoot td { background: #f5f0e8; font-weight: 700; border-top: 2px solid #c9a84c; font-family: Arial, sans-serif; }
          .summary-box { border: 1px solid #c9a84c; border-radius: 4px; overflow: hidden; margin-top: 8px; }
          .summary-title { background: #1a1a1a; color: #c9a84c; padding: 8px 16px; font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-family: Arial, sans-serif; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 16px; font-size: 12px; font-family: Arial, sans-serif; border-bottom: 1px solid #f0ebe0; }
          .summary-row.grand { background: #fdfaf3; border-top: 2px solid #c9a84c; font-size: 14px; font-weight: bold; color: #7a6020; border-bottom: none; }
          .text-right { text-align: right; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8e0cc; text-align: center; font-size: 11px; color: #999; font-family: Arial, sans-serif; }
          .page-break { page-break-before: always; }
          .page-header { margin-bottom: 16px; }
          .role-header { font-size: 14px; font-weight: bold; color: #1a1a1a; background: #f5f0e8; border-left: 4px solid #c9a84c; padding: 6px 12px; margin-top: 20px; margin-bottom: 4px; font-family: Arial, sans-serif; }
          .section-title { font-size: 15px; font-weight: bold; color: #1a1a1a; border-bottom: 2px solid #c9a84c; padding-bottom: 4px; margin-bottom: 12px; font-family: Arial, sans-serif; }
          .client-cc { color: #888; font-style: italic; }
        </style></head><body>
        ${page1}
        <div class="page-break"></div>
        ${page2}
        <div class="page-break"></div>
        ${page3}
      </body></html>`;

      const res = await base44.functions.invoke("my_html2pdf", {
        htmlContent,
        filename: `Invoice-Detailed-${household?.name || "Household"}-${format(new Date(), "yyyy-MM-dd")}.pdf`,
        options: { format: "A4", margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" }, printBackground: true }
      });

      let data = res?.data;
      while (typeof data === "string") { try { data = JSON.parse(data); } catch { break; } }
      const b64 = (data?.pdfBase64 || data || "").replace(/\s/g, "");
      const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-Detailed-${household?.name || "Household"}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Detailed PDF export failed", e);
      alert("Failed to generate detailed PDF. Please try again.");
    } finally {
      setIsExportingDetailed(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-5">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleExportPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? "Generating PDF..." : "Export PDF"}
        </Button>
        <Button onClick={handleExportDetailedPDF} disabled={isExportingDetailed} variant="outline" className="border-purple-400 text-purple-700 hover:bg-purple-50">
          {isExportingDetailed ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
          {isExportingDetailed ? "Generating..." : "Export Detailed PDF"}
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
        {/* Editable salutation & tagline */}
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium whitespace-nowrap">Dear</span>
          <input
            value={salutation}
            onChange={e => setSalutation(e.target.value)}
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-yellow-50 focus:outline-none focus:border-blue-400"
            placeholder="Recipient name..."
            title="This appears in the PDF salutation"
          />
          <span className="text-gray-400 text-xs italic whitespace-nowrap">PDF salutation</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium whitespace-nowrap">Tagline</span>
          <input
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-yellow-50 focus:outline-none focus:border-blue-400"
            placeholder="e.g. Premium Culinary Management"
            title="This appears under the company name in the PDF"
          />
          <span className="text-gray-400 text-xs italic whitespace-nowrap">PDF tagline</span>
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

      {/* Combined Invoice Table */}
      <div className="bg-white rounded-xl border-2 border-blue-300 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-blue-50 border-b font-semibold text-blue-800">Invoice Summary</div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-2 text-left text-gray-600">Description</th>
              <th className="px-3 py-2 text-right text-gray-600 w-24">{isAmerican ? "Days/Shifts" : "Hours"}</th>
              <th className="px-3 py-2 text-right text-gray-600 w-24">Rate ({curr})</th>
              <th className="px-3 py-2 text-right text-gray-600 font-bold w-32">Amount ({curr})</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {(tableRows || []).map(row => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-1.5">
                  <EditCell
                    value={row.label}
                    onChange={v => updateRow(row.id, "label", v)}
                    className="w-full"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <EditCell
                    value={row.qty}
                    onChange={v => updateRow(row.id, "qty", v)}
                    className="w-20 text-right"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <EditCell
                    value={row.rate}
                    onChange={v => updateRow(row.id, "rate", v)}
                    className="w-20 text-right"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-1.5 text-right font-semibold">
                  <span className="mr-0.5 text-gray-400 text-xs">{curr}</span>
                  <EditCell
                    value={row.amount}
                    onChange={v => updateRow(row.id, "amount", v)}
                    className="w-24 text-right font-semibold"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="px-4 py-2">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Add row
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td className="px-4 py-2 font-semibold text-gray-700" colSpan={3}>Subtotal</td>
              <td className="px-3 py-2 text-right font-semibold">{curr}{subtotal.toFixed(2)}</td>
              <td />
            </tr>
            <tr className="border-t bg-gray-50">
              <td className="px-4 py-2 text-gray-500" colSpan={2}>
                <span className="flex items-center gap-1 text-sm">
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
              </td>
              <td className="px-3 py-2 text-right text-gray-500 text-xs italic">preview only</td>
              <td className="px-3 py-2 text-right text-gray-600 font-medium">{curr}{vat.toFixed(2)}</td>
              <td />
            </tr>
            <tr className="bg-blue-50 border-t-2 border-blue-300">
              <td className="px-4 py-3 font-bold text-blue-800 text-base" colSpan={3}>GRAND TOTAL</td>
              <td className="px-3 py-3 text-right font-bold text-blue-800 text-base">{curr}{grandTotal.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}