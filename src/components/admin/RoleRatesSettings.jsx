import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Save, Loader2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

const DEFAULT_ROLES = [
  "chef", "sous chef", "cook", "waiter", "cleaner",
  "housekeeping", "householdManager", "chef travel", "cook travel", "other"
];

const ROLE_LABEL = (role) =>
  role.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const EMPTY_RATE = {
  pay_per_hour: "",
  pay_per_day: "",
  charge_per_hour: "",
  charge_per_day: "",
  charge_per_hour_usd: "",
  charge_per_day_usd: "",
};

export default function RoleRatesSettings() {
  const [settings, setSettings] = useState(null);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [rates, setRates] = useState({});
  const [newRoleName, setNewRoleName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const list = await base44.entities.AppSettings.list();
      const s = list?.[0] || null;
      setSettings(s);
      const rateMap = {};
      const loadedRoles = [];
      (s?.role_rates || []).forEach(r => {
        loadedRoles.push(r.job_role);
        rateMap[r.job_role] = {
          pay_per_hour: r.pay_per_hour ?? "",
          pay_per_day: r.pay_per_day ?? "",
          charge_per_hour: r.charge_per_hour ?? "",
          charge_per_day: r.charge_per_day ?? "",
          charge_per_hour_usd: r.charge_per_hour_usd ?? "",
          charge_per_day_usd: r.charge_per_day_usd ?? "",
        };
      });
      // Merge loaded roles with defaults, preserving order
      const merged = [...new Set([...loadedRoles, ...DEFAULT_ROLES])];
      merged.forEach(role => {
        if (!rateMap[role]) rateMap[role] = { ...EMPTY_RATE };
      });
      setRoles(merged);
      setRates(rateMap);
      setIsLoading(false);
    };
    load();
  }, []);

  const handleChange = (role, field, value) => {
    setRates(prev => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
  };

  const handleAddRole = () => {
    const trimmed = newRoleName.trim().toLowerCase();
    if (!trimmed || roles.includes(trimmed)) return;
    setRoles(prev => [...prev, trimmed]);
    setRates(prev => ({ ...prev, [trimmed]: { ...EMPTY_RATE } }));
    setNewRoleName("");
  };

  const moveRole = (idx, dir) => {
    const next = [...roles];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setRoles(next);
  };

  const handleDeleteRole = (role) => {
    if (DEFAULT_ROLES.includes(role)) return; // protect built-in roles
    setRoles(prev => prev.filter(r => r !== role));
    setRates(prev => { const next = { ...prev }; delete next[role]; return next; });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const role_rates = roles.map(role => ({
      job_role: role,
      pay_per_hour: parseFloat(rates[role]?.pay_per_hour) || 0,
      pay_per_day: parseFloat(rates[role]?.pay_per_day) || 0,
      charge_per_hour: parseFloat(rates[role]?.charge_per_hour) || 0,
      charge_per_day: parseFloat(rates[role]?.charge_per_day) || 0,
      charge_per_hour_usd: parseFloat(rates[role]?.charge_per_hour_usd) || 0,
      charge_per_day_usd: parseFloat(rates[role]?.charge_per_day_usd) || 0,
    }));

    if (settings?.id) {
      await base44.entities.AppSettings.update(settings.id, { role_rates });
    } else {
      await base44.entities.AppSettings.create({ role_rates });
    }
    setIsSaving(false);
    alert("Role rates saved successfully.");
  };

  if (isLoading) return <div className="py-4 text-sm text-gray-500">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Default Role Charge Rates
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Set default charge rates (what the household is billed). Pay rates are configured per staff member in HouseholdStaff.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold text-gray-700 w-40">Role</th>
                <th className="text-center py-2 px-2 font-semibold text-blue-700" colSpan={2}>
                  🇮🇱 Israel (₪)
                </th>
                <th className="text-center py-2 px-2 font-semibold text-green-700" colSpan={2}>
                  🇺🇸 America ($)
                </th>
                <th className="w-8" />
              <th className="w-16" />
              </tr>
              <tr className="border-b bg-gray-50">
                <th className="py-1.5 pr-4" />
                <th className="py-1.5 px-2 text-xs font-medium text-blue-600">Charge/Hour ₪</th>
                <th className="py-1.5 px-2 text-xs font-medium text-blue-600">Charge/Day ₪</th>
                <th className="py-1.5 px-2 text-xs font-medium text-green-600">Charge/Hour $</th>
                <th className="py-1.5 px-2 text-xs font-medium text-green-600">Charge/Day $</th>
                <th className="w-8" />
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {roles.map((role, idx) => (
                <tr key={role} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium text-gray-800">{ROLE_LABEL(role)}</td>
                  {["charge_per_hour", "charge_per_day"].map(field => (
                    <td key={field} className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rates[role]?.[field] ?? ""}
                        onChange={e => handleChange(role, field, e.target.value)}
                        className="h-8 w-24 text-center mx-auto border-blue-200 focus:border-blue-400"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  {["charge_per_hour_usd", "charge_per_day_usd"].map(field => (
                    <td key={field} className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rates[role]?.[field] ?? ""}
                        onChange={e => handleChange(role, field, e.target.value)}
                        className="h-8 w-24 text-center mx-auto border-green-200 focus:border-green-400"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  <td className="py-2 pl-2">
                    {!DEFAULT_ROLES.includes(role) && (
                      <button
                        onClick={() => handleDeleteRole(role)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                  <td className="py-2 pl-1">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveRole(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveRole(idx, 1)} disabled={idx === roles.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add custom role */}
        <div className="flex items-center gap-2 mt-4">
          <Input
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddRole()}
            placeholder="New role name (e.g. butler)"
            className="h-8 max-w-xs text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleAddRole} className="gap-1">
            <Plus className="w-4 h-4" /> Add Role
          </Button>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="mt-4 bg-green-600 hover:bg-green-700">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? "Saving..." : "Save Rates"}
        </Button>
      </CardContent>
    </Card>
  );
}