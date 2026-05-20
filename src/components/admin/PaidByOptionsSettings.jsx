import React, { useState, useEffect } from "react";
import { AppSettings } from "@/entities/AppSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";

const DEFAULT_OPTIONS = [
  { label: "KCS Cash", is_staff_paid: false },
  { label: "KCS CC 1234", is_staff_paid: false },
  { label: "Meir CC 2222", is_staff_paid: false },
  { label: "Meir CC 1111", is_staff_paid: false },
  { label: "Avi CC 3140", is_staff_paid: false },
  { label: "Avi CC 5023", is_staff_paid: false },
  { label: "Avi CC 7923", is_staff_paid: false },
  { label: "Chaim CC 4602", is_staff_paid: false },
  { label: "Chaim CC 7030", is_staff_paid: false },
  { label: "Simcha CC 8277", is_staff_paid: false },
  { label: "KCS Bank Transfer", is_staff_paid: false },
  { label: "Client CC", is_staff_paid: false },
  { label: "Staff member CC", is_staff_paid: true },
  { label: "Staff member Cash", is_staff_paid: true },
];

export default function PaidByOptionsSettings() {
  const [settingsId, setSettingsId] = useState(null);
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await AppSettings.list();
        const existing = list?.[0];
        if (existing) {
          setSettingsId(existing.id);
          setOptions(
            Array.isArray(existing.paid_by_options) && existing.paid_by_options.length > 0
              ? existing.paid_by_options
              : DEFAULT_OPTIONS
          );
        } else {
          setOptions(DEFAULT_OPTIONS);
        }
      } catch (e) {
        console.error(e);
        setOptions(DEFAULT_OPTIONS);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const updateOption = (idx, patch) => {
    setOptions(prev => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const removeOption = (idx) => {
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const addOption = () => {
    setOptions(prev => [...prev, { label: "", is_staff_paid: false }]);
  };

  const moveOption = (idx, dir) => {
    setOptions(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    const cleaned = options
      .map(o => ({ label: (o.label || "").trim(), is_staff_paid: !!o.is_staff_paid }))
      .filter(o => o.label);
    setIsSaving(true);
    try {
      if (settingsId) {
        await AppSettings.update(settingsId, { paid_by_options: cleaned });
      } else {
        const created = await AppSettings.create({ paid_by_options: cleaned });
        setSettingsId(created.id);
      }
      setOptions(cleaned);
      alert("Saved.");
    } catch (e) {
      console.error(e);
      alert("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Controls the &quot;Paid By&quot; dropdown choices used in Payroll → AP.
        Tick <strong>Staff-paid</strong> for any option that should mark an expense as
        reimbursable (staff member paid out of pocket).
      </p>

      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2 border border-gray-200 rounded-md p-2 bg-white">
            <div className="flex flex-col">
              <button type="button" onClick={() => moveOption(idx, -1)} className="text-gray-400 hover:text-gray-700 text-xs leading-none" title="Move up">▲</button>
              <button type="button" onClick={() => moveOption(idx, 1)} className="text-gray-400 hover:text-gray-700 text-xs leading-none" title="Move down">▼</button>
            </div>
            <GripVertical className="w-4 h-4 text-gray-300" />
            <Input
              className="h-8 text-sm flex-1"
              placeholder="Option label (e.g. Avi CC 3140)"
              value={opt.label}
              onChange={e => updateOption(idx, { label: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs text-gray-700 whitespace-nowrap">
              <Checkbox
                checked={!!opt.is_staff_paid}
                onCheckedChange={v => updateOption(idx, { is_staff_paid: !!v })}
              />
              Staff-paid (reimbursable)
            </label>
            <button
              type="button"
              onClick={() => removeOption(idx)}
              className="text-gray-300 hover:text-red-500"
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addOption}>
          <Plus className="w-4 h-4 mr-1" /> Add option
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
          {isSaving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saving...</> : "Save"}
        </Button>
      </div>
    </div>
  );
}