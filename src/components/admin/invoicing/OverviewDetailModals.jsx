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

export function OrdersModal({ isOpen, onClose, orders, householdName }) {
  if (!isOpen) return null;

  const total = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

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
                  {orders.map((o, i) => (
                    <tr key={o.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-200 px-2 py-1 font-mono">{o.order_number || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1">
                        {o.created_date ? new Date(o.created_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1">{o.vendor_id ? "Vendor" : "—"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right">{o.items?.length || 0}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-semibold">${Number(o.total_amount || 0).toLocaleString()}</td>
                      <td className="border border-gray-200 px-2 py-1 text-xs">
                        <span className={`px-2 py-0.5 rounded ${o.status === "delivered" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                          {o.status || "pending"}
                        </span>
                      </td>
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