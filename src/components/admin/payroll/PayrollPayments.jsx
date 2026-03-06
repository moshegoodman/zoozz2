import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const PAYMENT_METHODS = ["bank_transfer", "cash", "check", "other"];

export default function PayrollPayments({ users }) {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterUser, setFilterUser] = useState("all");
  const [form, setForm] = useState({
    employee_name: "",
    employee_user_id: "",
    amount: "",
    currency: "ILS",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    period_start: "",
    period_end: "",
    notes: "",
    is_confirmed: false
  });

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.KCSPayment.list("-payment_date");
      setPayments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (e) => {
    const user = users.find(u => u.id === e.target.value);
    setForm(f => ({
      ...f,
      employee_user_id: e.target.value,
      employee_name: user?.full_name || ""
    }));
  };

  const handleSave = async () => {
    if (!form.employee_name || !form.amount || !form.payment_date) return alert("Name, amount and date are required.");
    await base44.entities.KCSPayment.create({ ...form, amount: parseFloat(form.amount) });
    setShowForm(false);
    setForm({ employee_name: "", employee_user_id: "", amount: "", currency: "ILS", payment_date: new Date().toISOString().split("T")[0], payment_method: "bank_transfer", period_start: "", period_end: "", notes: "", is_confirmed: false });
    await loadPayments();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this payment?")) return;
    await base44.entities.KCSPayment.delete(id);
    await loadPayments();
  };

  const filtered = payments.filter(p => filterUser === "all" || p.employee_user_id === filterUser);
  const totalILS = filtered.filter(p => p.currency === "ILS").reduce((s, p) => s + (p.amount || 0), 0);
  const totalUSD = filtered.filter(p => p.currency === "USD").reduce((s, p) => s + (p.amount || 0), 0);

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Total Payments</p><p className="text-2xl font-bold">{filtered.length}</p></div>
          <DollarSign className="w-8 h-8 text-blue-600" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Total (ILS)</p><p className="text-2xl font-bold text-green-600">₪{totalILS.toFixed(2)}</p></div>
          <DollarSign className="w-8 h-8 text-green-600" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Total (USD)</p><p className="text-2xl font-bold text-blue-600">${totalUSD.toFixed(2)}</p></div>
          <DollarSign className="w-8 h-8 text-blue-600" />
        </CardContent></Card>
      </div>

      {/* Filter + Add */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Payments</span>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-1" />Add Payment
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Filter by Employee</label>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-full md:w-64 border rounded-lg px-3 py-2 text-sm">
              <option value="all">All Employees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          {showForm && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
              <h3 className="font-semibold text-sm">New Payment</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Employee</label>
                  <select value={form.employee_user_id} onChange={handleUserSelect} className="w-full border rounded px-2 py-1.5 text-sm">
                    <option value="">Select or type below</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Name (if not in list)</label>
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
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
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

          {/* Payments list */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2 pr-4">Employee</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4">Period</th>
                  <th className="pb-2 pr-4">Notes</th>
                  <th className="pb-2">Confirmed</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{p.employee_name}</td>
                    <td className="py-2 pr-4 font-semibold text-green-600">
                      {p.currency === "USD" ? "$" : "₪"}{p.amount?.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{p.payment_date}</td>
                    <td className="py-2 pr-4 capitalize">{p.payment_method?.replace("_", " ")}</td>
                    <td className="py-2 pr-4 text-gray-500 text-xs">
                      {p.period_start && p.period_end ? `${p.period_start} → ${p.period_end}` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{p.notes || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.is_confirmed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.is_confirmed ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-2">
                      <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-500">No payments recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}