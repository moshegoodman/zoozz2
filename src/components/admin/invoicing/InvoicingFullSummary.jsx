import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, DollarSign } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(true);
  const isAmerican = isUSA(household?.country);
  const curr = isAmerican ? "$" : "₪";
  const roleRates = appSettings?.role_rates || [];
  const vatRate = 0.18;

  useEffect(() => {
    if (!household?.id) return;
    setIsLoading(true);
    Promise.all([
      base44.entities.Expense.filter({ household_id: household.id }),
      base44.entities.Shift.filter({ household_id: household.id }),
    ]).then(([e, s]) => {
      setExpenses(e);
      setShifts(s);
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
      if (!map[job]) map[job] = { job, hours: 0, charged: 0 };
      const isDaily = s.payment_type === "daily";
      const chargeRate = getRoleChargeRate(job, s.payment_type);
      const hours = isDaily ? 0 : calcHours(s.start_date_time, s.done_date_time);
      const charged = isDaily ? chargeRate : hours * chargeRate;
      if (!isDaily) map[job].hours += hours;
      map[job].charged += charged;
    });
    return Object.values(map);
  }, [shifts, roleRates, isAmerican]);

  const laborTotal = laborByRole.reduce((s, r) => s + r.charged, 0);

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

  // Orders are VAT-inclusive, so extract pre-VAT and VAT components
  const ordersPreVat = billableOrdersTotal / (1 + vatRate);
  const ordersVat = billableOrdersTotal * vatRate / (1 + vatRate);

  // Labor and purchasing are pre-VAT; VAT is added on top
  const laborAndPurchasingSubtotal = laborTotal + apTotal;
  const laborAndPurchasingVat = laborAndPurchasingSubtotal * vatRate;

  const subtotal = laborAndPurchasingSubtotal + ordersPreVat;
  const vat = laborAndPurchasingVat + ordersVat;
  const grandTotal = subtotal + vat; // equals laborAndPurchasing * 1.18 + billableOrdersTotal

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-5">
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

      {/* Labor section */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b font-semibold text-gray-700">Labor / Staff Hours</div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-5 py-2 text-left text-gray-600">Position</th>
              <th className="px-5 py-2 text-right text-gray-600">Hours</th>
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
              const chargeRate = getRoleChargeRate(role.job, sample?.payment_type || "hourly");
              const isDaily = sample?.payment_type === "daily";
              return (
                <tr key={role.job} className="border-b">
                  <td className="px-5 py-2 capitalize">{role.job}</td>
                  <td className="px-5 py-2 text-right">{isDaily ? "—" : role.hours.toFixed(1)}</td>
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

      {/* Purchasing / AP section */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b font-semibold text-gray-700">Purchasing (A/P)</div>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {expenses.filter(e => e.is_approved && !isClientCC(e.paid_by)).length === 0 && (
              <tr><td className="px-5 py-4 text-gray-400 text-center">No billable purchasing entries.</td></tr>
            )}
            {expenses.filter(e => e.is_approved && !isClientCC(e.paid_by)).map(exp => (
              <tr key={exp.id} className="border-b hover:bg-gray-50">
                <td className="px-5 py-2">{exp.description || "—"}</td>
                <td className="px-5 py-2 text-right font-semibold">{curr}{(exp.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t font-semibold">
              <td className="px-5 py-2 text-gray-700">Purchasing Subtotal</td>
              <td className="px-5 py-2 text-right">{curr}{apTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Orders section */}
      {householdOrders.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b font-semibold text-gray-700">Orders</div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-5 py-2 text-left text-gray-600">Order #</th>
                <th className="px-5 py-2 text-left text-gray-600">Status</th>
                <th className="px-5 py-2 text-left text-gray-600">Bill/CCC</th>
                <th className="px-5 py-2 text-right text-gray-600 font-bold">Amount ({curr})</th>
              </tr>
            </thead>
            <tbody>
              {householdOrders.map(o => {
                  const isBillable = o.status === 'delivery' || o.status === 'delivered';
                  const isCCC = o.for_billing === false;
                  return (
                    <tr key={o.id} className={`border-b ${isBillable && isCCC ? "opacity-50" : ""}`}>
                      <td className="px-5 py-2 font-mono text-gray-700">{o.order_number || o.id?.slice(-6)}</td>
                      <td className="px-5 py-2">
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">
                          {o.status?.charAt(0).toUpperCase() + o.status?.slice(1).replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-2">
                        {isBillable ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${!isCCC ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {!isCCC ? "Bill" : "CCC"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className={`px-5 py-2 text-right font-semibold`}>
                        {isBillable
                          ? <span className={isCCC ? "text-gray-400 line-through" : ""}>{curr}{(o.total_amount || 0).toFixed(2)}</span>
                          : <span className="text-gray-400">N/A</span>
                        }
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t font-semibold">
                <td className="px-5 py-2 text-gray-700" colSpan={3}>Orders Total (billable, incl. VAT)</td>
                <td className="px-5 py-2 text-right">{curr}{billableOrdersTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          {clientCCOrdersTotal > 0 && (
            <div className="px-5 py-2 text-xs text-gray-400 border-t bg-gray-50">
              {curr}{clientCCOrdersTotal.toFixed(2)} paid via Client CC — not included in total.
            </div>
          )}
        </div>
      )}

      {/* Grand total */}
      <div className="bg-white rounded-xl border-2 border-blue-300 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-blue-50 border-b font-semibold text-blue-800">Invoice Summary</div>
        <div className="px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Labor Total</span>
            <span className="font-medium">{curr}{laborTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Purchasing</span>
            <span className="font-medium">{curr}{apTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Orders (billable, pre-VAT)</span>
            <span className="font-medium">{curr}{ordersPreVat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-gray-700 font-semibold">Subtotal (pre-VAT)</span>
            <span className="font-semibold">{curr}{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>VAT (18%)</span>
            <span>{curr}{vat.toFixed(2)}</span>
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