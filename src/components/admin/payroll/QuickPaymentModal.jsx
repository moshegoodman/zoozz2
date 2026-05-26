import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAYMENT_METHODS = ["bank_transfer", "cash", "check", "other"];

export default function QuickPaymentModal({ open, onClose, employee, suggestedAmount = 0, defaultCurrency = "ILS", season = "", onSaved }) {
  const [form, setForm] = useState({
    amount: "",
    currency: defaultCurrency,
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    notes: "",
    is_confirmed: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(f => ({
        ...f,
        amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
        currency: defaultCurrency,
        payment_date: new Date().toISOString().split("T")[0],
      }));
    }
  }, [open, suggestedAmount, defaultCurrency]);

  if (!employee) return null;

  const handleSave = async () => {
    if (!form.amount || !form.payment_date) return alert("Amount and date are required.");
    setSaving(true);
    try {
      const existing = await base44.entities.KCSPayment.list("-running_id", 1);
      const maxId = existing?.[0]?.running_id || 0;
      await base44.entities.KCSPayment.create({
        employee_user_id: employee.id,
        employee_name: employee.full_name || employee.email,
        amount: parseFloat(form.amount),
        currency: form.currency,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        notes: form.notes,
        is_confirmed: form.is_confirmed,
        season,
        running_id: maxId + 1,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment — {employee.full_name || employee.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Amount</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="text-sm h-9" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full border rounded px-2 py-2 text-sm h-9">
                <option value="ILS">ILS (₪)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Payment Date</label>
              <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className="text-sm h-9" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="w-full border rounded px-2 py-2 text-sm h-9">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            {season && (
              <div className="col-span-2">
                <label className="text-xs font-medium block mb-1">Season</label>
                <Input value={season} disabled className="text-sm h-9 bg-gray-50" />
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1">Notes</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="text-sm h-9" />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_confirmed} onChange={e => setForm(f => ({ ...f, is_confirmed: e.target.checked }))} />
              Mark as confirmed
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}