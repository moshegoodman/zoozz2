import React, { useState, useEffect } from "react";
import { AppSettings } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Save, Loader2 } from "lucide-react";

const JOB_ROLES = ["chef", "cook", "waiter", "housekeeping", "householdManager", "cleaner", "house manager", "other"];

const ROLE_LABELS = {
  chef: "Chef",
  cook: "Cook",
  waiter: "Waiter",
  housekeeping: "Housekeeping",
  householdManager: "Household Manager",
  cleaner: "Cleaner",
  "house manager": "House Manager",
  other: "Other"
};

export default function RoleRatesSettings() {
  const [settings, setSettings] = useState(null);
  const [rates, setRates] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const list = await AppSettings.list();
      const s = list?.[0] || null;
      setSettings(s);
      // Build a map from existing role_rates array
      const rateMap = {};
      (s?.role_rates || []).forEach(r => {
        rateMap[r.job_role] = {
          pay_per_hour: r.pay_per_hour ?? "",
          pay_per_day: r.pay_per_day ?? "",
          charge_per_hour: r.charge_per_hour ?? "",
          charge_per_day: r.charge_per_day ?? ""
        };
      });
      // Initialize missing roles with empty values
      JOB_ROLES.forEach(role => {
        if (!rateMap[role]) {
          rateMap[role] = { pay_per_hour: "", pay_per_day: "", charge_per_hour: "", charge_per_day: "" };
        }
      });
      setRates(rateMap);
      setIsLoading(false);
    };
    load();
  }, []);

  const handleChange = (role, field, value) => {
    setRates(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: value }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const role_rates = JOB_ROLES.map(role => ({
      job_role: role,
      pay_per_hour: parseFloat(rates[role]?.pay_per_hour) || 0,
      pay_per_day: parseFloat(rates[role]?.pay_per_day) || 0,
      charge_per_hour: parseFloat(rates[role]?.charge_per_hour) || 0,
      charge_per_day: parseFloat(rates[role]?.charge_per_day) || 0
    }));

    if (settings?.id) {
      await AppSettings.update(settings.id, { role_rates });
    } else {
      await AppSettings.create({ role_rates });
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
          Default Role Pay & Charge Rates
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Set default pay rates (what staff earns) and charge rates (what the household is billed). These are applied automatically when a shift is logged.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold text-gray-700 w-36">Role</th>
                <th className="text-center py-2 px-2 font-semibold text-blue-700">Pay/Hour ₪</th>
                <th className="text-center py-2 px-2 font-semibold text-blue-700">Pay/Day ₪</th>
                <th className="text-center py-2 px-2 font-semibold text-green-700">Charge/Hour ₪</th>
                <th className="text-center py-2 px-2 font-semibold text-green-700">Charge/Day ₪</th>
              </tr>
            </thead>
            <tbody>
              {JOB_ROLES.map(role => (
                <tr key={role} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium text-gray-800">{ROLE_LABELS[role]}</td>
                  {["pay_per_hour", "pay_per_day", "charge_per_hour", "charge_per_day"].map(field => (
                    <td key={field} className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rates[role]?.[field] ?? ""}
                        onChange={e => handleChange(role, field, e.target.value)}
                        className="h-8 w-24 text-center mx-auto"
                        placeholder="0"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="mt-4 bg-green-600 hover:bg-green-700">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? "Saving..." : "Save Rates"}
        </Button>
      </CardContent>
    </Card>
  );
}