import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";

export default function UnitOptionsSettings() {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.UnitOption.list("sort_order", 1000);
        setOptions(list || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const updateOption = (idx, patch) => {
    setOptions(prev => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const removeOption = async (idx) => {
    const optionId = options[idx]?.id;
    if (optionId) {
      if (!window.confirm("Delete this unit option? Products already using it will keep their stored values, but the option won't be selectable going forward.")) return;
      try {
        await base44.entities.UnitOption.delete(optionId);
        setOptions(prev => prev.filter((_, i) => i !== idx));
      } catch (e) {
        console.error(e);
        alert("Failed to delete option.");
      }
    } else {
      setOptions(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const addOption = () => {
    setOptions(prev => [...prev, { label_english: "", label_hebrew: "", sort_order: (prev.length + 1) * 10, is_active: true }]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (!opt.label_english?.trim()) continue;
        const payload = {
          label_english: opt.label_english.trim(),
          label_hebrew: (opt.label_hebrew || "").trim(),
          sort_order: opt.sort_order ?? (i + 1) * 10,
          is_active: opt.is_active !== false,
        };
        if (opt.id) {
          await base44.entities.UnitOption.update(opt.id, payload);
        } else {
          await base44.entities.UnitOption.create(payload);
        }
      }
      const list = await base44.entities.UnitOption.list("sort_order", 1000);
      setOptions(list);
      alert("Saved.");
    } catch (e) {
      console.error(e);
      alert("Failed to save unit options.");
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
        Purchase-unit options offered to vendors (e.g. KG / ק"ג, Piece / יחידה, Bunch / אגודה, Apex / קודקוד).
        Vendors pick which of these to allow, and each product can optionally offer a secondary purchase unit from the vendor's allowed list.
      </p>

      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={opt.id || `new-${idx}`} className="flex items-center gap-2 border border-gray-200 rounded-md p-2 bg-white">
            <GripVertical className="w-4 h-4 text-gray-300" />
            <Input
              className="h-8 text-sm flex-1"
              placeholder="English label (e.g. KG)"
              value={opt.label_english || ""}
              onChange={e => updateOption(idx, { label_english: e.target.value })}
            />
            <Input
              className="h-8 text-sm flex-1"
              placeholder='תווית עברית (למשל ק"ג)'
              value={opt.label_hebrew || ""}
              onChange={e => updateOption(idx, { label_hebrew: e.target.value })}
              dir="rtl"
            />
            <Input
              className="h-8 text-sm w-20"
              type="number"
              placeholder="Order"
              value={opt.sort_order ?? ""}
              onChange={e => updateOption(idx, { sort_order: e.target.value === "" ? null : parseInt(e.target.value) })}
            />
            <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={opt.is_active !== false}
                onChange={e => updateOption(idx, { is_active: e.target.checked })}
              />
              Active
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
          <Plus className="w-4 h-4 mr-1" /> Add unit option
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
          {isSaving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saving...</> : "Save"}
        </Button>
      </div>
    </div>
  );
}