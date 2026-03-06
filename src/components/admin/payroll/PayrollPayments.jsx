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
    await base44.entities.KCSPayment.create({ ...form, amount: parseFloat(form.amount) });
    setShowForm(false);
    setForm(EMPTY_FORM);
    await loadPayments();
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Delete this payment?")) return;
    await base44.entities.KCSPayment.delete(row._id);
    await loadPayments();
  };

  const rows = useMemo(() => payments.map(p => ({
    _id: p.id,
    employee: p.employee_name || "—",
    amount: p.amount || 0,
    currency: p.currency || "ILS",
    amount_display: p.amount,
    _currency: p.currency,
    payment_date: p.payment_date || "",
    method: (p.payment_method || "").replace(/_/g, " "),
    period: p.period_start && p.period_end ? `${p.period_start} → ${p.period_end}` : "—",
    notes: p.notes || "—",
    confirmed: p.is_confirmed ? "Yes" : "No",
  })), [payments]);

  const columns = [
    { key: "employee", label: "Employee", width: 150, rawValue: r => r.employee },
    { key: "amount_display", label: "Amount", width: 100, numeric: true, rawValue: r => r.amount, render: r => (
      <span className="font-semibold text-green-700">{r._currency === "USD" ? "$" : "₪"}{r.amount?.toFixed(2)}</span>
    )},
    { key: "currency", label: "Currency", width: 70 },
    { key: "payment_date", label: "Date", width: 100 },
    { key: "method", label: "Method", width: 110 },
    { key: "period", label: "Period", width: 160 },
    { key: "notes", label: "Notes", width: 160 },
    { key: "confirmed", label: "Confirmed", width: 80, render: r => (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.confirmed === "Yes" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {r.confirmed}
      </span>
    )},
  ];

  const totalILS = rows.filter(r => r.currency === "ILS").reduce((s, r) => s + r.amount, 0);
  const totalUSD = rows.filter(r => r.currency === "USD").reduce((s, r) => s + r.amount, 0);

  const footerRow = {
    employee: `${rows.length} payments`,
    amount_display: `₪${totalILS.toFixed(2)} / $${totalUSD.toFixed(2)}`,
    currency: "",
    payment_date: "",
    method: "",
    period: "",
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

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" />Add Payment
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <h3 className="font-semibold text-sm">New Payment</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Employee</label>
              <select value={form.employee_user_id} onChange={handleUserSelect} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Select employee</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Name (if not listed)</label>
              <Input value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))} placeholder="Full name" className="text-sm h-8" />
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
              <label className="text-xs font-medium block mb-1">Period Start</label>
              <Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} className="text-sm h-8" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Period End</label>
              <Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} className="text-sm h-8" />
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
      />
    </div>
  );
}