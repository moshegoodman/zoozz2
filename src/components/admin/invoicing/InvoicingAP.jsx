import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Receipt, AlertCircle, Plus, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CLIENT_CC_VALUES = ["Client CC", "clientCC"];
const STAFF_PAID = ["Staff member CC", "Staff member Cash"];

function isClientCC(paid_by) {
  return CLIENT_CC_VALUES.some(v => (paid_by || "").toLowerCase().includes(v.toLowerCase().replace(" ", ""))) ||
    (paid_by || "").toLowerCase().includes("client");
}

const USA_VALS = ["america", "usa"];
const isUSA = (c) => USA_VALS.includes((c || "").toLowerCase().trim());

const PAID_BY_OPTIONS = [
  "KCS Cash", "KCS CC 1234", "Meir CC 2222", "Meir CC 1111",
  "Avi CC 3140", "Avi CC 5023", "Avi CC 7923",
  "Chaim CC 4602", "Chaim CC 7030", "Simcha CC 8277",
  "KCS Bank Transfer", "Client CC", "Staff member CC", "Staff member Cash"
];

export default function InvoicingAP({ household, users }) {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const curr = isUSA(household?.country) ? "$" : "₪";

  const [showAddForm, setShowAddForm] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [newEntry, setNewEntry] = useState({ user_id: "", description: "", amount: "", date: "", paid_by: "" });
  const [saving, setSaving] = useState(false);
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [editingAmountValue, setEditingAmountValue] = useState("");

  const handleSaveAmount = async (id) => {
    const parsed = parseFloat(editingAmountValue);
    if (!isNaN(parsed) && parsed >= 0) {
      await base44.entities.Expense.update(id, { amount: parsed });
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, amount: parsed } : e));
    }
    setEditingAmountId(null);
  };

  const handleCancel = async (expId) => {
    if (!window.confirm("Cancel this expense?")) return;
    setExpenses(prev => prev.filter(e => e.id !== expId));
    await base44.entities.Expense.update(expId, { is_active: false });
  };

  const handleRestore = async (expId) => {
    await base44.entities.Expense.update(expId, { is_active: true });
    setExpenses(prev => prev.map(e => e.id === expId ? { ...e, is_active: true } : e));
  };

  const handleAddEntry = async () => {
    if (!newEntry.description || !newEntry.amount || !newEntry.date || !newEntry.paid_by) return;
    setSaving(true);
    const created = await base44.entities.Expense.create({
      ...newEntry,
      amount: parseFloat(newEntry.amount),
      household_id: household.id,
      is_approved: false,
    });
    setExpenses(prev => [...prev, created]);
    setNewEntry({ user_id: "", description: "", amount: "", date: "", paid_by: "" });
    setShowAddForm(false);
    setSaving(false);
  };

  useEffect(() => {
    if (!household?.id) return;
    setIsLoading(true);
    base44.entities.Expense.filter({ household_id: household.id })
      .then(setExpenses)
      .finally(() => setIsLoading(false));
  }, [household?.id]);

  const rows = useMemo(() => expenses.filter(exp => exp.is_active !== false).map(exp => {
    const user = users.find(u => u.id === exp.user_id);
    const clientCC = isClientCC(exp.paid_by);
    const staffPaid = STAFF_PAID.includes(exp.paid_by);
    // Logic: if paid by client CC → show but don't charge; otherwise charge
    const chargeToClient = !clientCC && exp.is_approved;
    return {
      id: exp.id,
      employee: user?.full_name || "—",
      description: exp.description || "—",
      amount: exp.amount || 0,
      date: exp.date || "—",
      paid_by: exp.paid_by || "—",
      is_approved: exp.is_approved,
      clientCC,
      staffPaid,
      chargeToClient,
      receipt_url: exp.receipt_url || "",
    };
  }), [expenses, users]);

  const billableTotal = rows.filter(r => r.chargeToClient).reduce((s, r) => s + r.amount, 0);
  const clientCCTotal = rows.filter(r => r.clientCC).reduce((s, r) => s + r.amount, 0);

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Total Entries</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Billable to Client</p>
          <p className="text-2xl font-bold text-blue-700">{curr}{billableTotal.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Client CC (not charged)</p>
          <p className="text-2xl font-bold text-gray-500">{curr}{clientCCTotal.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Entries paid with the <strong>Client CC</strong> are shown for reference but are <strong>not added to the billable total</strong>. Only approved entries paid by KCS/Staff are charged to the client.</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-700">Expense Entries</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(v => !v)}>
              {showAddForm ? <><X className="w-4 h-4 mr-1" />Cancel</> : <><Plus className="w-4 h-4 mr-1" />Add Entry</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCancelled(v => !v)} className={showCancelled ? "text-red-600 border-red-300 bg-red-50" : "text-gray-400 border-gray-200"}>
              🗑 {showCancelled ? "Hide" : `Bin (${expenses.filter(e => e.is_active === false).length})`}
            </Button>
          </div>
        </div>

        {showAddForm && (
          <div className="p-4 bg-blue-50 border-b grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Employee</label>
              <Select value={newEntry.user_id} onValueChange={v => setNewEntry(e => ({ ...e, user_id: v }))}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select employee (optional)" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description *</label>
              <Input className="bg-white" value={newEntry.description} onChange={e => setNewEntry(v => ({ ...v, description: e.target.value }))} placeholder="e.g. Groceries" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount *</label>
              <Input type="number" className="bg-white" value={newEntry.amount} onChange={e => setNewEntry(v => ({ ...v, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date *</label>
              <Input type="date" className="bg-white" value={newEntry.date} onChange={e => setNewEntry(v => ({ ...v, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Paid By *</label>
              <Select value={newEntry.paid_by} onValueChange={v => setNewEntry(e => ({ ...e, paid_by: v }))}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  {PAID_BY_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddEntry} disabled={saving || !newEntry.description || !newEntry.amount || !newEntry.date || !newEntry.paid_by}>
                {saving ? "Saving..." : "Save Expense"}
              </Button>
            </div>
          </div>
        )}

        {showCancelled && (
          <div className="border-b border-red-100 bg-red-50/40 px-4 py-2 space-y-1">
            <p className="text-xs font-semibold text-red-500 mb-1">Cancelled Expenses</p>
            {expenses.filter(e => e.is_active === false).length === 0
              ? <p className="text-xs text-gray-400">No cancelled expenses.</p>
              : expenses.filter(e => e.is_active === false).map(exp => {
                const user = users.find(u => u.id === exp.user_id);
                return (
                  <div key={exp.id} className="flex items-center justify-between bg-white border border-red-100 rounded px-3 py-1.5 text-xs text-gray-500">
                    <span>{user?.full_name || "—"} — {exp.description || "—"} — {curr}{(exp.amount || 0).toFixed(2)} ({exp.date || "?"})</span>
                    <button onClick={() => handleRestore(exp.id)} className="ml-4 text-green-600 hover:text-green-800 font-medium whitespace-nowrap">↩ Restore</button>
                  </div>
                );
              })
            }
          </div>
        )}

        <table className="text-sm w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Employee</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Paid By</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">Approved</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">Charge to Client</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">Receipt</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No expenses found for this household.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className={`border-b hover:bg-gray-50 ${row.clientCC ? "bg-gray-50 opacity-70" : ""}`}>
                <td className="px-3 py-2">{row.employee}</td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="px-3 py-2 text-gray-500">{row.date}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    row.clientCC ? "bg-blue-100 text-blue-700" :
                    row.staffPaid ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {row.paid_by}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {editingAmountId === row.id ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      autoFocus
                      value={editingAmountValue}
                      onChange={e => setEditingAmountValue(e.target.value)}
                      onBlur={() => handleSaveAmount(row.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveAmount(row.id); if (e.key === 'Escape') setEditingAmountId(null); }}
                      className="w-24 border border-blue-400 rounded px-1.5 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  ) : (
                    <span
                      className={`cursor-pointer hover:underline ${row.clientCC ? "text-gray-400 line-through" : "text-gray-800"}`}
                      onClick={() => { setEditingAmountId(row.id); setEditingAmountValue(String(row.amount)); }}
                      title="Click to edit"
                    >
                      {curr}{row.amount.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge className={row.is_approved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                    {row.is_approved ? "✓" : "Pending"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  {row.chargeToClient ? (
                    <span className="text-blue-600 font-semibold text-xs">✓ {curr}{row.amount.toFixed(2)}</span>
                  ) : row.clientCC ? (
                    <span className="text-gray-400 text-xs">Client CC</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.receipt_url
                    ? <a href={row.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View</a>
                    : <span className="text-gray-300 text-xs">—</span>
                  }
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => handleCancel(row.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Cancel expense">
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
              <td className="px-3 py-2 text-blue-800" colSpan={4}>Billable Total (approved, non-client-CC)</td>
              <td className="px-3 py-2 text-right text-blue-800">{curr}{billableTotal.toFixed(2)}</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}