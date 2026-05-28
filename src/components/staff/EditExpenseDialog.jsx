import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Expense } from "@/entities/all";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle, Loader2 } from "lucide-react";

/**
 * Edit dialog for an unapproved expense.
 * Props:
 *   expense: the expense object to edit
 *   onClose: () => void
 *   onSaved: (updatedExpense) => void
 *   paidByOptions: string[]
 *   billToOptions: { value: string, label: string }[]  // value = "type:id"
 *   language: 'English' | 'Hebrew'
 */
export default function EditExpenseDialog({ expense, onClose, onSaved, paidByOptions, billToOptions, language }) {
  const isHebrew = language === 'Hebrew';
  const [form, setForm] = useState({
    amount: expense.amount ?? "",
    description: expense.description ?? "",
    date: expense.date ?? "",
    paid_by: expense.paid_by ?? "",
    receipt_url: expense.receipt_url ?? "",
    bill_to_key: `${expense.charge_entity_type || 'household'}:${expense.charge_entity_id || expense.household_id || ''}`,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const t = (en, he) => isHebrew ? he : en;

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((p) => ({ ...p, receipt_url: file_url }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.amount || !form.description || !form.paid_by) {
      alert(t("Please fill in all required fields.", "אנא מלא את כל השדות הנדרשים."));
      return;
    }
    setIsSaving(true);
    try {
      const [type, id] = form.bill_to_key.split(':');
      const patch = {
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date,
        paid_by: form.paid_by,
        receipt_url: form.receipt_url || "",
        charge_entity_type: type || 'household',
        charge_entity_id: id || "",
      };
      const updated = await Expense.update(expense.id, patch);
      onSaved({ ...expense, ...patch, ...updated });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Edit Expense", "ערוך הוצאה")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
              {t("Bill To", "חיוב ל")} <span className="text-red-400">*</span>
            </Label>
            <Select value={form.bill_to_key} onValueChange={(v) => setForm((p) => ({ ...p, bill_to_key: v }))}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {billToOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                {t("Amount", "סכום")} <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="h-10"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                {t("Date", "תאריך")}
              </Label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="h-10 w-full border border-input rounded-md px-3 text-sm bg-transparent"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
              {t("Description", "תיאור")} <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
              {t("Paid By", "מי שילם")} <span className="text-red-400">*</span>
            </Label>
            <Select value={form.paid_by} onValueChange={(v) => setForm((p) => ({ ...p, paid_by: v }))}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {paidByOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
              {t("Receipt", "קבלה")}
            </Label>
            <label className={`flex items-center justify-center gap-3 w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${form.receipt_url ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-300 hover:bg-gray-50"}`}>
              {form.receipt_url ? (
                <div className="text-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-0.5" />
                  <p className="text-xs text-green-700 font-medium">{t("Receipt uploaded", "קבלה הועלתה")}</p>
                  <a
                    href={form.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("View", "צפה")}
                  </a>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-4 h-4 text-gray-400 mx-auto mb-0.5" />
                  <p className="text-xs text-gray-500">
                    {isUploading ? t("Uploading...", "מעלה...") : t("Tap to upload receipt", "לחץ להעלות קבלה")}
                  </p>
                </div>
              )}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={isUploading} />
            </label>
            {form.receipt_url && (
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, receipt_url: "" }))}
                className="text-xs text-red-500 hover:underline mt-1"
              >
                {t("Remove receipt", "הסר קבלה")}
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1">
              {t("Cancel", "ביטול")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isUploading} className="flex-1 bg-green-600 hover:bg-green-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Save", "שמור")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}