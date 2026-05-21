import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { User } from "@/entities/User";
import { Combobox } from "@/components/ui/combobox";

export default function PaidByOptionsSettings() {
  const [options, setOptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [paymentSources, usersList] = await Promise.all([
          base44.entities.APPaymentSource.list("-created_date", 1000),
          User.list("-created_date", 1000)
        ]);
        setOptions(paymentSources || []);
        setUsers(usersList || []);
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
      try {
        await base44.entities.APPaymentSource.delete(optionId);
        setOptions(prev => prev.filter((_, i) => i !== idx));
      } catch (e) {
        console.error(e);
        alert("Failed to delete option.");
      }
    }
  };

  const addOption = () => {
    setOptions(prev => [...prev, { name: "", user_id: "" }]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const opt of options) {
        if (!opt.name?.trim()) continue;
        if (opt.id) {
          await base44.entities.APPaymentSource.update(opt.id, { name: opt.name.trim(), user_id: opt.user_id || null });
        } else {
          await base44.entities.APPaymentSource.create({ name: opt.name.trim(), user_id: opt.user_id || null });
        }
      }
      alert("Saved.");
      const paymentSources = await base44.entities.APPaymentSource.list("-created_date", 1000);
      setOptions(paymentSources);
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
        Payment sources used in Payroll → AP. Optionally assign to a user.
      </p>

      <div className="space-y-2">
        {options.map((opt, idx) => {
          const assignedUser = users.find(u => u.id === opt.user_id);
          const specialLabel = opt.user_id === "__self__" ? "Self" : opt.user_id === "__kcs_cash__" ? "KCS Cash" : null;
          return (
            <div key={idx} className="flex items-center gap-2 border border-gray-200 rounded-md p-2 bg-white">
              <GripVertical className="w-4 h-4 text-gray-300" />
              <div className="flex-1">
                <Input
                  className="h-8 text-sm w-full"
                  placeholder="Payment source name"
                  value={opt.name || ""}
                  onChange={e => updateOption(idx, { name: e.target.value })}
                />
              </div>
              <Combobox
                value={opt.user_id || ""}
                onValueChange={val => updateOption(idx, { user_id: val || "" })}
                options={[
                  { value: "", label: "(no user)", category: "default" },
                  { value: "__self__", label: "Self (staff member)", category: "special" },
                  { value: "__kcs_cash__", label: "KCS Cash", category: "special" },
                  ...users.map(u => ({ value: u.id, label: `${u.full_name} (${u.email})`, category: "users" }))
                ]}
                placeholder="Select user..."
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">{specialLabel || (assignedUser ? assignedUser.full_name : "—")}</span>
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="text-gray-300 hover:text-red-500"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
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