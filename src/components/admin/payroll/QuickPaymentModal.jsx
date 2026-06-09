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
    payment_method: "cash",
    notes: "",
    is_confirmed: false,
    season: season,
  });
  const [saving, setSaving] = useState(false);
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    if (open) {
      setForm(f => ({
        ...f,
        amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
        currency: defaultCurrency,
        payment_date: new Date().toISOString().split("T")[0],
        season: season,
      }));
      base44.entities.MenuSeason.list().then(setSeasons).catch(console.error);
    }
  }, [open, suggestedAmount, defaultCurrency, season]);

  if (!employee) return null;

  const handleSave = async () => {
    if (!form.amount || !form.payment_date) return alert("Amount and date are required.");
    // Season is mandatory — every payment must be tagged so it shows in the right Payroll summary.
    if (!form.season) return alert("Please select a season. Every payment must be tagged with a season.");
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
        season: form.season,
        running_id: maxId + 1,
      });

      // Send confirmation email to the employee with all payment details
      try {
        if (employee?.email) {
          const symbol = form.currency === "USD" ? "$" : "₪";
          const amountStr = `${symbol}${parseFloat(form.amount).toFixed(2)}`;
          const methodStr = (form.payment_method || "").replace(/_/g, " ");
          const subject = `Payment confirmation — ${amountStr}`;
          const body = `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
              <h2 style="color: #059669;">Payment Confirmation</h2>
              <p>Hi ${employee.full_name || ""},</p>
              <p>A payment has been logged for you. Here are the details:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Amount</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${amountStr}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Currency</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${form.currency}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Payment Date</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${form.payment_date}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Method</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${methodStr}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Season</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${form.season || "—"}</td></tr>
                ${form.notes ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Notes</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${form.notes}</td></tr>` : ""}
              </table>
              <p style="color: #6b7280; font-size: 13px;">If anything looks incorrect, please reply to this email or contact your manager.</p>
              <p style="color: #6b7280; font-size: 13px;">— Zoozz Payroll</p>
            </div>
          `;
          await base44.functions.invoke("sendGridEmail", {
            to: employee.email,
            subject,
            body,
            context: "payroll_payment_logged",
          });
        }
      } catch (emailErr) {
        console.error("Failed to send payment confirmation email:", emailErr);
      }

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
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1">Season <span className="text-red-500">*</span></label>
              <select
                value={form.season}
                onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                className={`w-full border rounded px-2 py-2 text-sm h-9 ${!form.season ? "border-red-300 bg-red-50" : ""}`}
              >
                <option value="">— Select Season (required) —</option>
                {seasons.map(s => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
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
          <Button onClick={handleSave} disabled={saving || !form.season}>{saving ? "Saving..." : "Save Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}