import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, DollarSign, CheckCircle, XCircle, Plus, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const USA_VALS = ["america", "usa"];
const isUSA = (c) => USA_VALS.includes((c || "").toLowerCase().trim());

function calcHours(start, end) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
}

function RateCell({ shift, chargeRate, curr, settingsRate, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(chargeRate));
  const unit = shift.payment_type === "daily" ? "day" : "hr";

  const commit = () => {
    setEditing(false);
    onUpdate(shift, val);
  };

  const isDifferentFromSettings = settingsRate !== null && parseFloat(val) !== settingsRate;

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-xs">{curr}</span>
          <input
            type="number"
            min="0"
            step="0.5"
            autoFocus
            className="w-20 border rounded px-1.5 py-0.5 text-sm text-right focus:outline-none focus:border-blue-400"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          />
          <span className="text-gray-400 text-xs">/{unit}</span>
        </div>
        {settingsRate !== null && (
          <span className="text-xs text-gray-400">Default: {curr}{settingsRate}/{unit}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={() => { setVal(String(chargeRate)); setEditing(true); }}
        className="text-gray-600 hover:text-blue-600 hover:underline text-sm tabular-nums"
        title="Click to edit rate"
      >
        {curr}{chargeRate}/{unit}
      </button>
      {settingsRate !== null && (
        <span className={`text-xs ${isDifferentFromSettings ? "text-amber-500 font-medium" : "text-gray-400"}`}>
          {isDifferentFromSettings ? `⚠ Default: ${curr}${settingsRate}` : `Default: ${curr}${settingsRate}`}
        </span>
      )}
    </div>
  );
}

export default function InvoicingTimeLog({ household, appSettings }) {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAmerican = isUSA(household?.country);
  const curr = isAmerican ? "$" : "₪";

  useEffect(() => {
    if (!household?.id) return;
    setIsLoading(true);
    Promise.all([
      base44.entities.Shift.filter({ household_id: household.id }),
      base44.entities.User.filter({ user_type: "kcs staff" }),
    ]).then(([s, u]) => {
      setShifts(s);
      setUsers(u);
    }).finally(() => setIsLoading(false));
  }, [household?.id]);

  // Get the default charge rate from AppSettings for a given job/paymentType
  const getSettingsRate = (job, paymentType) => {
    const roleRates = appSettings?.role_rates || [];
    const match = roleRates.find(r => r.job_role?.toLowerCase() === (job || "").toLowerCase());
    if (!match) return null;
    if (paymentType === "daily") return isAmerican ? (match.charge_per_day_usd || 0) : (match.charge_per_day || 0);
    return isAmerican ? (match.charge_per_hour_usd || 0) : (match.charge_per_hour || 0);
  };

  const handleUpdateRate = async (shift, newRate) => {
    const parsed = parseFloat(newRate);
    if (isNaN(parsed) || parsed < 0) return;
    const field = shift.payment_type === "daily" ? "charge_per_day" : "charge_per_hour";
    await base44.entities.Shift.update(shift.id, { [field]: parsed });
    setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, [field]: parsed } : s));
  };

  const JOB_ROLES = ["chef", "cook", "cleaner", "house manager", "waiter", "other"];

  const [showAddForm, setShowAddForm] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [newEntry, setNewEntry] = useState({ user_id: "", job: "", payment_type: "hourly", start_date_time: "", done_date_time: "", comment: "" });
  const [saving, setSaving] = useState(false);

  const handleAddEntry = async () => {
    if (!newEntry.user_id || !newEntry.job || !newEntry.start_date_time) return;
    setSaving(true);

    // Look up charge rate from AppSettings role_rates for the selected job
    const rateConfig = (appSettings?.role_rates || []).find(
      r => r.job_role?.toLowerCase() === (newEntry.job || "").toLowerCase()
    );
    const isDaily = newEntry.payment_type === "daily";
    const chargePerHour = isAmerican ? (rateConfig?.charge_per_hour_usd || 0) : (rateConfig?.charge_per_hour || 0);
    const chargePerDay = isAmerican ? (rateConfig?.charge_per_day_usd || 0) : (rateConfig?.charge_per_day || 0);

    const created = await base44.entities.Shift.create({
      ...newEntry,
      household_id: household.id,
      is_approved: false,
      charge_per_hour: !isDaily ? chargePerHour : 0,
      charge_per_day: isDaily ? chargePerDay : 0,
    });
    setShifts(prev => [...prev, created]);
    setNewEntry({ user_id: "", job: "", payment_type: "hourly", start_date_time: "", done_date_time: "", comment: "" });
    setShowAddForm(false);
    setSaving(false);
  };

  const toggleApprove = async (shift) => {
    const updated = await base44.entities.Shift.update(shift.id, { is_approved: !shift.is_approved });
    setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, is_approved: updated.is_approved } : s));
  };

  const handleCancel = async (shift) => {
    if (!window.confirm("Cancel this shift?")) return;
    setShifts(prev => prev.filter(s => s.id !== shift.id));
    await base44.entities.Shift.update(shift.id, { is_active: false });
  };

  const handleRestore = async (shift) => {
    await base44.entities.Shift.update(shift.id, { is_active: true });
    setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, is_active: true } : s));
  };

  const rows = useMemo(() => shifts
    .filter(s => s.is_active !== false && (s.done_date_time || s.payment_type === "daily"))
    .map(s => {
      const user = users.find(u => u.id === s.user_id);
      const isDaily = s.payment_type === "daily";
      const hours = isDaily ? null : calcHours(s.start_date_time, s.done_date_time);
      const chargeRate = isDaily ? (s.charge_per_day || 0) : (s.charge_per_hour || 0);
      const charged = isDaily ? chargeRate : (hours || 0) * chargeRate;
      return {
        id: s.id,
        _shift: s,
        is_approved: s.is_approved,
        employee: user?.full_name || "Unknown",
        job: s.job || "—",
        payType: isDaily ? "Daily" : "Hourly",
        isDaily,
        start: s.start_date_time ? format(new Date(s.start_date_time), "MMM d, HH:mm") : "—",
        end: s.done_date_time ? format(new Date(s.done_date_time), "MMM d, HH:mm") : (isDaily ? "—" : "In progress"),
        hours,
        chargeRate,
        charged,
        comment: s.comment || "",
      };
    }), [shifts, users]);

  const approvedRows = useMemo(() => rows.filter(r => r.is_approved), [rows]);

  // Group by job role — only approved for summary
  const byRole = useMemo(() => {
    const map = {};
    approvedRows.forEach(r => {
      if (!map[r.job]) map[r.job] = { job: r.job, hours: 0, charged: 0, rows: [] };
      if (!r.isDaily && r.hours != null) map[r.job].hours += r.hours;
      map[r.job].charged += r.charged;
      map[r.job].rows.push(r);
    });
    return Object.values(map);
  }, [approvedRows]);
  const totalCharged = approvedRows.reduce((s, r) => s + r.charged, 0);
  const totalHours = approvedRows.filter(r => !r.isDaily).reduce((s, r) => s + (r.hours || 0), 0);
  const uniqueEmployees = new Set(rows.map(r => r.employee)).size;

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="w-7 h-7 text-blue-400" />
          <div><p className="text-xs text-gray-500">Employees</p><p className="text-2xl font-bold">{uniqueEmployees}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Clock className="w-7 h-7 text-purple-400" />
          <div><p className="text-xs text-gray-500">Total Hours</p><p className="text-2xl font-bold">{totalHours.toFixed(1)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-blue-500" />
          <div><p className="text-xs text-gray-500">Charged to Client</p><p className="text-2xl font-bold text-blue-700">{curr}{totalCharged.toFixed(2)}</p></div>
        </CardContent></Card>
      </div>

      {/* Role summary (like invoice) */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm text-gray-700">Summary by Role</div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-2 text-left text-gray-600">Position</th>
              <th className="px-4 py-2 text-right text-gray-600">Hours</th>
              <th className="px-4 py-2 text-right text-gray-600">Rate ({curr})</th>
              <th className="px-4 py-2 text-right text-gray-600 font-bold">Total ({curr})</th>
            </tr>
          </thead>
          <tbody>
            {byRole.map(role => {
              const sampleRow = role.rows[0];
              const rateLabel = sampleRow?.isDaily
                ? `${curr}${sampleRow.chargeRate}/day`
                : `${curr}${sampleRow?.chargeRate}/hr`;
              return (
                <tr key={role.job} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 capitalize font-medium">{role.job}</td>
                  <td className="px-4 py-2 text-right">{role.hours > 0 ? role.hours.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{rateLabel}</td>
                  <td className="px-4 py-2 text-right font-bold text-blue-700">{curr}{role.charged.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-4 py-2 font-bold text-blue-800" colSpan={3}>Total Labor Charge</td>
              <td className="px-4 py-2 text-right font-bold text-blue-800 text-base">{curr}{totalCharged.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detailed shifts */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-700">Detailed Shift Log</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(v => !v)}>
              {showAddForm ? <><X className="w-4 h-4 mr-1" />Cancel</> : <><Plus className="w-4 h-4 mr-1" />Add Entry</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCancelled(v => !v)} className={showCancelled ? "text-red-600 border-red-300 bg-red-50" : "text-gray-400 border-gray-200"}>
              🗑 {showCancelled ? "Hide" : `Bin (${shifts.filter(s => s.is_active === false).length})`}
            </Button>
          </div>
        </div>

        {showAddForm && (
          <div className="p-4 bg-blue-50 border-b grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Employee *</label>
              <Select value={newEntry.user_id} onValueChange={v => setNewEntry(e => ({ ...e, user_id: v }))}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Job *</label>
              <Select value={newEntry.job} onValueChange={v => setNewEntry(e => ({ ...e, job: v }))}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select job" /></SelectTrigger>
                <SelectContent>
                  {JOB_ROLES.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Payment Type</label>
              <Select value={newEntry.payment_type} onValueChange={v => setNewEntry(e => ({ ...e, payment_type: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start *</label>
              <Input type="datetime-local" className="bg-white" value={newEntry.start_date_time} onChange={e => setNewEntry(v => ({ ...v, start_date_time: e.target.value }))} />
            </div>
            {newEntry.payment_type === "hourly" && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End</label>
                <Input type="datetime-local" className="bg-white" value={newEntry.done_date_time} onChange={e => setNewEntry(v => ({ ...v, done_date_time: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Comment</label>
              <Input className="bg-white" value={newEntry.comment} onChange={e => setNewEntry(v => ({ ...v, comment: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="col-span-2 md:col-span-3 flex justify-end">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddEntry} disabled={saving || !newEntry.user_id || !newEntry.job || !newEntry.start_date_time}>
                {saving ? "Saving..." : "Save Shift"}
              </Button>
            </div>
          </div>
        )}
        {showCancelled && (
          <div className="border-b border-red-100 bg-red-50/40 px-4 py-2 space-y-1">
            <p className="text-xs font-semibold text-red-500 mb-1">Cancelled Shifts</p>
            {shifts.filter(s => s.is_active === false).length === 0
              ? <p className="text-xs text-gray-400">No cancelled shifts.</p>
              : shifts.filter(s => s.is_active === false).map(s => {
                const user = users.find(u => u.id === s.user_id);
                return (
                  <div key={s.id} className="flex items-center justify-between bg-white border border-red-100 rounded px-3 py-1.5 text-xs text-gray-500">
                    <span>{user?.full_name || "Unknown"} — {s.job || "?"} — {s.start_date_time ? format(new Date(s.start_date_time), "MMM d, HH:mm") : "?"}</span>
                    <button onClick={() => handleRestore(s)} className="ml-4 text-green-600 hover:text-green-800 font-medium whitespace-nowrap">↩ Restore</button>
                  </div>
                );
              })
            }
          </div>
        )}

        <table className="text-sm w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Employee</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Job</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Start</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">End</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Hours</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Charged</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">Status</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">No shifts found for this household.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className={`border-b hover:bg-gray-50 ${!row.is_approved ? "bg-amber-50/40" : ""}`}>
                <td className="px-3 py-2">{row.employee}</td>
                <td className="px-3 py-2 capitalize">{row.job}</td>
                <td className="px-3 py-2">
                  <Badge className={row.isDaily ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}>
                    {row.payType}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-gray-600">{row.start}</td>
                <td className="px-3 py-2 text-gray-600">{row.end}</td>
                <td className="px-3 py-2 text-right">{row.isDaily ? "—" : (row.hours?.toFixed(2) || "—")}</td>
                <td className="px-3 py-2 text-right">
                  <RateCell
                    shift={row._shift}
                    chargeRate={row.chargeRate}
                    curr={curr}
                    settingsRate={getSettingsRate(row._shift.job, row._shift.payment_type)}
                    onUpdate={handleUpdateRate}
                  />
                </td>
                <td className="px-3 py-2 text-right font-semibold text-blue-700">{curr}{row.charged.toFixed(2)}</td>
                <td className="px-3 py-2 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={row.is_approved ? "text-green-600 hover:text-red-500" : "text-amber-500 hover:text-green-600"}
                    onClick={() => toggleApprove(row._shift)}
                  >
                    {row.is_approved ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="ml-1 text-xs">{row.is_approved ? "Approved" : "Pending"}</span>
                  </Button>
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => handleCancel(row._shift)} className="text-gray-300 hover:text-red-500 transition-colors" title="Cancel shift">
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
              <td className="px-3 py-2 text-blue-800" colSpan={7}>Total (approved only)</td>
              <td className="px-3 py-2 text-right text-blue-800">{curr}{totalCharged.toFixed(2)}</td>
              <td /><td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}