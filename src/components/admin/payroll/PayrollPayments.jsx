import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Plus } from "lucide-react";
import ExcelTable from "./ExcelTable";

const PAYMENT_METHODS = ["bank_transfer", "cash", "check", "other"];
const EMPTY_FORM = {
  employee_name: "", employee_user_id: "", amount: "", currency: "ILS",
  payment_date: new Date().toISOString().split("T")[0],
  payment_method: "bank_transfer", notes: "", is_confirmed: false
};

export default function PayrollPayments({ users }) {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => { loadPayments(); }, []);

  const loadPayments = async () => {
    setIsLoading(true);
    try { setPayments(await base44.entities.KCSPayment.list("-payment_date")); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleUserSelect = (e) => {
    const user = users.find(u => u.id === e.target.value);
    setForm(f => ({ ...f, employee_user_id: e.target.value, employee_name: user?.full_name || "" }));
  };

  const handleSave = async () => {
    if (!form.employee_user_id && !form.employee_name) return alert("Please select an employee.");
    if (!form.amount || !form.payment_date) return alert("Amount and date are required.");
    const maxId = payments.reduce((m, p) => Math.max(m, p.running_id || 0), 0);
    await base44.entities.KCSPayment.create({ ...form, amount: parseFloat(form.amount), running_id: maxId + 1 });
    setShowForm(false);
    setForm(EMPTY_FORM);
    await loadPayments();
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Cancel this payment?")) return;
    setPayments(prev => prev.filter(p => p.id !== row._id));
    await base44.entities.KCSPayment.update(row._id, { is_active: false });
  };

  const handleRestore = async (paymentId) => {
    await base44.entities.KCSPayment.update(paymentId, { is_active: true });
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, is_active: true } : p));
  };

  const handleEditCell = async (row, key, value) => {
    const fieldMap = {
      employee: "employee_name",
      amount_display: "amount",
      currency: "currency",
      payment_date: "payment_date",
      method: null, // rendered with custom
      notes: "notes",
      confirmed: null,
    };
    const field = fieldMap[key];
    if (!field) return;
    await base44.entities.KCSPayment.update(row._id, { [field]: value });
    await loadPayments();
  };

  const rows = useMemo(() => payments.filter(p => p.is_active !== false).map((p, idx) => ({
    _id: p.id,
    running_id: p.running_id ?? (idx + 1),
    employee: p.employee_name || "—",
    amount: p.amount || 0,
    currency: p.currency || "ILS",
    amount_display: p.amount,
    _currency: p.currency,
    payment_date: p.payment_date || "",
    method: (p.payment_method || "").replace(/_/g, " "),
    notes: p.notes || "—",
    confirmed: p.is_confirmed ? "Yes" : "No",
  })), [payments]);

  const columns = [
    { key: "running_id", label: "#", width: 50, rawValue: r => r.running_id, render: r => <span className="text-gray-400 text-xs font-mono">{r.running_id}</span> },
    { key: "employee", label: "Employee", width: 150, rawValue: r => r.employee },
    { key: "amount_display", label: "Amount", width: 100, numeric: true, rawValue: r => r.amount, render: r => (
      <span className="font-semibold text-green-700">{r._currency === "USD" ? "$" : "₪"}{r.amount?.toFixed(2)}</span>
    )},
    { key: "currency", label: "Currency", width: 70 },
    { key: "payment_date", label: "Date", width: 100 },
    { key: "method", label: "Method", width: 110 },
    { key: "notes", label: "Notes", width: 200 },
    { key: "confirmed", label: "Confirmed", width: 80, render: r => (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.confirmed === "Yes" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {r.confirmed}
      </span>
    )},
  ];

  const totalILS = rows.filter(r => r.currency === "ILS").reduce((s, r) => s + r.amount, 0);
  const totalUSD = rows.filter(r => r.currency === "USD").reduce((s, r) => s + r.amount, 0);

  const footerRow = {
    running_id: "",
    employee: `${rows.length} payments`,
    amount_display: `₪${totalILS.toFixed(2)} / $${totalUSD.toFixed(2)}`,
    currency: "",
    payment_date: "",
    method: "",
    notes: "",
    confirmed: "",
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total Payments</p><p className="text-xl font-bold">{rows.length}</p></div>
          <DollarSign className="w-7 h-7 text-blue-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total ILS</p><p className="text-xl font-bold text-green-600">₪{totalILS.toFixed(2)}</p></div>
          <DollarSign className="w-7 h-7 text-green-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total USD</p><p className="text-xl font-bold text-blue-600">${totalUSD.toFixed(2)}</p></div>
          <DollarSign className="w-7 h-7 text-blue-500" />
        </CardContent></Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" />Add Payment
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelled(v => !v)}
          className={showCancelled ? "text-red-600 border-red-300 bg-red-50" : "text-gray-400 border-gray-200"}
        >
          🗑 {showCancelled ? "Hide Cancelled" : `Bin (${payments.filter(p => p.is_active === false).length})`}
        </Button>
      </div>

      {showCancelled && (
        <div className="border border-red-100 rounded-lg bg-red-50/40 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-500 mb-2">Cancelled Payments</p>
          {payments.filter(p => p.is_active === false).length === 0
            ? <p className="text-xs text-gray-400">No cancelled payments.</p>
            : payments.filter(p => p.is_active === false).map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white border border-red-100 rounded px-3 py-1.5 text-xs text-gray-500">
                <span>{p.employee_name || "Unknown"} — {p.currency === "USD" ? "$" : "₪"}{(p.amount || 0).toFixed(2)} ({p.payment_date || "?"})</span>
                <button onClick={() => handleRestore(p.id)} className="ml-4 text-green-600 hover:text-green-800 font-medium whitespace-nowrap">↩ Restore</button>
              </div>
            ))
          }
        </div>
      )}

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <h3 className="font-semibold text-sm">New Payment</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Employee</label>
              <select value={form.employee_user_id} onChange={handleUserSelect} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Select employee</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Amount</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="text-sm h-8" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="ILS">ILS (₪)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Payment Date</label>
              <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className="text-sm h-8" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Notes</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="text-sm h-8" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <ExcelTable
        columns={columns}
        data={rows}
        getRowKey={r => r._id}
        footerRow={footerRow}
        onDeleteRow={handleDelete}
        onEditCell={handleEditCell}
      />
    </div>
  );
}