import React from "react";
import { X } from "lucide-react";

const fmt = (n, curr = "₪") =>
  n == null || n === 0 ? "—" : `${curr}${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  return ((new Date(end) - new Date(start)) / 3600000).toFixed(1);
};

export function ShiftsModal({ isOpen, onClose, shifts, roleName, curr, householdName }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="sticky top-0 bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{roleName} - {householdName}</h2>
          <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {shifts.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No shifts</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Date</th>
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Job</th>
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Start</th>
                  <th className="border border-gray-300 px-2 py-1 text-left font-semibold">End</th>
                  <th className="border border-gray-300 px-2 py-1 text-right font-semibold">Hours</th>
                  <th className="border border-gray-300 px-2 py-1 text-right font-semibold">Type</th>
                  <th className="border border-gray-300 px-2 py-1 text-right font-semibold">Charge</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => {
                  const isDaily = s.payment_type === "daily" || s.payment_type === "contract";
                  const hours = isDaily ? 0 : calcHours(s.start_date_time, s.done_date_time);
                  const rate = isDaily ? (s.charge_per_day || 0) : (s.charge_per_hour || 0);
                  const charge = isDaily ? rate : hours * rate;

                  return (
                    <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-200 px-2 py-1">
                        {s.start_date_time ? new Date(s.start_date_time).toLocaleDateString() : "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1">{s.job || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-xs">
                        {s.start_date_time ? new Date(s.start_date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-xs">
                        {s.done_date_time ? new Date(s.done_date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-right">{isDaily ? "—" : hours}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right text-xs">{s.payment_type || "hourly"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-semibold">{fmt(charge, curr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrdersModal({ isOpen, onClose, orders, householdName, vendors = [] }) {
  if (!isOpen) return null;

  const vendorMap = {};
  const vendorById = {};
  vendors.forEach(v => { vendorMap[v.id] = v.name; vendorById[v.id] = v; });

  // Mirror lib/orderTotals: if vendor.has_vat === false, prices are net — add VAT on top.
  const withVat = (o, amount) => {
    const vendor = vendorById[o.vendor_id];
    const vendorHasVat = vendor ? vendor.has_vat !== false : true;
    if (vendorHasVat) return amount;
    const rate = (o.vat_rate != null) ? o.vat_rate : 0.18;
    return amount * (1 + rate);
  };
  const orderTotal = (o) => withVat(o, Number(o.total_amount || 0));
  const orderReturned = (o) => withVat(o, Number(o.total_returned_amount || 0));

  const total = orders.reduce((s, o) => s + orderTotal(o) - orderReturned(o), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-auto">
        <div className="sticky top-0 bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Orders - {householdName}</h2>
          <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {orders.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No orders</p>
          ) : (
            <>
              <table className="w-full text-xs border-collapse mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Order #</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Date</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Vendor</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-semibold">Items</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-semibold">Amount</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.flatMap((o, i) => {
                    const baseRow = (
                      <tr key={o.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-gray-200 px-2 py-1 font-mono">{o.order_number || "—"}</td>
                        <td className="border border-gray-200 px-2 py-1">
                          {o.created_date ? new Date(o.created_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="border border-gray-200 px-2 py-1">{vendorMap[o.vendor_id] || o.vendor_id || "—"}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right">{o.items?.length || 0}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right font-semibold">${Number(orderTotal(o)).toLocaleString()}</td>
                        <td className="border border-gray-200 px-2 py-1 text-xs">
                          <span className={`px-2 py-0.5 rounded ${o.status === "delivered" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {o.status || "pending"}
                          </span>
                        </td>
                      </tr>
                    );
                    const returned = orderReturned(o);
                    if (returned <= 0) return [baseRow];
                    const returnedItemCount = (o.items || []).filter(it => (Number(it.amount_returned) || 0) > 0 || it.is_returned).length;
                    const returnRow = (
                      <tr key={`${o.id}-return`} className="bg-red-50 text-red-700">
                        <td className="border border-gray-200 px-2 py-1 font-mono">{(o.order_number || "—") + "-R"}</td>
                        <td className="border border-gray-200 px-2 py-1">
                          {o.created_date ? new Date(o.created_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="border border-gray-200 px-2 py-1">Returns</td>
                        <td className="border border-gray-200 px-2 py-1 text-right">{returnedItemCount}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right font-semibold">− ${Number(returned).toLocaleString()}</td>
                        <td className="border border-gray-200 px-2 py-1 text-xs">
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">returned</span>
                        </td>
                      </tr>
                    );
                    return [baseRow, returnRow];
                  })}
                </tbody>
              </table>
              <div className="text-right border-t pt-4">
                <p className="text-sm font-semibold">Total: ${Number(total).toLocaleString()}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ARModal({ isOpen, onClose, arRecords, householdName }) {
  if (!isOpen) return null;

  const total = arRecords.reduce((s, ar) => s + (ar.amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="bg-gray-800 text-white px-6 py-4 sticky top-0">
          <h3 className="text-lg font-semibold">Payments Received — {householdName}</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Date</th>
              <th className="px-4 py-2 text-left font-semibold">Amount</th>
              <th className="px-4 py-2 text-left font-semibold">Method</th>
              <th className="px-4 py-2 text-left font-semibold">Ref #</th>
              <th className="px-4 py-2 text-left font-semibold">Notes</th>
              <th className="px-4 py-2 text-center font-semibold">Approved</th>
            </tr>
          </thead>
          <tbody>
            {arRecords.map((ar, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{ar.date || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-blue-700">{ar.currency || "ILS"} {(ar.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">{ar.payment_method || "—"}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{ar.reference_number || "—"}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{ar.description || "—"}</td>
                <td className="px-4 py-2 text-center">{ar.is_approved ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-orange-500">✗</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-blue-50 border-t-2 border-blue-200 font-bold">
            <tr>
              <td colSpan="5" className="px-4 py-3 text-right">Total Received:</td>
              <td className="px-4 py-3 text-right text-blue-700">{total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function ExpensesModal({ isOpen, onClose, expenses, title, householdName }) {
  if (!isOpen) return null;

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="sticky top-0 bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title} - {householdName}</h2>
          <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {expenses.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No expenses</p>
          ) : (
            <>
              <table className="w-full text-xs border-collapse mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Date</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Category</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Description</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Paid By</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-200 px-2 py-1">
                        {e.date ? new Date(e.date).toLocaleDateString() : "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1">{e.category || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-xs">{e.description || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-xs">{e.paid_by || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-semibold">${Number(e.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right border-t pt-4">
                <p className="text-sm font-semibold">Total: ${Number(total).toLocaleString()}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}