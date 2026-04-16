import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, DollarSign, Download, Upload, Plus, X, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import ExcelTable from "./ExcelTable";

const USA_VALUES_TL = ["america", "usa"];
const isUSA_TL = (c) => USA_VALUES_TL.includes((c || "").toLowerCase().trim());

export default function PayrollTimeLog({ users, households }) {
  const isAmerican = (households || []).length > 0 && (households || []).every(h => isUSA_TL(h.country));
  const curr = isAmerican ? "$" : "₪";
  const [shifts, setShifts] = useState([]);
  const [allHouseholds, setAllHouseholds] = useState([]);
  const [currentSeason, setCurrentSeason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ user_id: "", household_id: "", job: "other", payment_type: "hourly", price_per_hour: "", price_per_day: "", start_date: "", start_time: "", end_date: "", end_time: "", comment: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [endTimePrompt, setEndTimePrompt] = useState(null); // { row, endDate, endTime }
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shiftsData, householdsData, settingsData] = await Promise.all([
        base44.entities.Shift.list(),
        base44.entities.Household.list(),
        base44.entities.AppSettings.list(),
      ]);
      setShifts(shiftsData);
      setAllHouseholds(householdsData);
      setCurrentSeason(settingsData?.[0]?.activeSeason || "");
    }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const loadShifts = loadData;

  const calcHours = (start, end) => {
    if (!end) return 0;
    return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
  };

  const calcPay = (s) => {
    if (s.payment_type === 'daily') {
      return s.price_per_day || 0;
    }
    const hours = calcHours(s.start_date_time, s.done_date_time);
    return hours * (s.price_per_hour || 0);
  };

  const handleToggleApproved = async (shiftId, current) => {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, is_approved: !current } : s));
    await base44.entities.Shift.update(shiftId, { is_approved: !current });
  };

  const handleEditCell = async (row, key, value) => {
    const fieldMap = {
      employee: "user_id",
      household: "household_id",
      job: "job",
      payment_type: "payment_type",
      start: "start_date_time",
      end: "done_date_time",
      hours: null,
      rate: row._is_daily ? "price_per_day" : "price_per_hour",
      pay: null,
      approved: null,
      comment: "comment",
    };
    const field = fieldMap[key];
    if (!field) return;
    // Optimistic update
    setShifts(prev => prev.map(s => s.id === row._id ? { ...s, [field]: value } : s));
    await base44.entities.Shift.update(row._id, { [field]: value });
  };

  const handleTogglePaymentType = async (row) => {
    if (row._is_daily) {
      // Switching daily → hourly: need an end time
      if (!row._end_raw) {
        setEndTimePrompt({ row, endDate: "", endTime: "" });
        return;
      }
    }
    const newType = row._is_daily ? "hourly" : "daily";
    setShifts(prev => prev.map(s => s.id === row._id ? { ...s, payment_type: newType } : s));
    await base44.entities.Shift.update(row._id, { payment_type: newType });
  };

  const handleConfirmEndTime = async () => {
    const { row, endDate, endTime } = endTimePrompt;
    if (!endDate || !endTime) return;
    const endISO = new Date(`${endDate}T${endTime}`).toISOString();
    setShifts(prev => prev.map(s => s.id === row._id ? { ...s, payment_type: "hourly", done_date_time: endISO } : s));
    await base44.entities.Shift.update(row._id, { payment_type: "hourly", done_date_time: endISO });
    setEndTimePrompt(null);
  };

  const handleAddEntry = async () => {
    if (!newEntry.user_id || !newEntry.start_date || !newEntry.start_time) {
      alert("Employee, Start Date and Start Time are required.");
      return;
    }
    setIsSaving(true);
    const startDateTime = new Date(`${newEntry.start_date}T${newEntry.start_time}`).toISOString();
    const endDateTime = newEntry.end_date && newEntry.end_time
      ? new Date(`${newEntry.end_date}T${newEntry.end_time}`).toISOString()
      : null;
    const isDaily = newEntry.payment_type === 'daily';
    const maxId = shifts.reduce((m, s) => Math.max(m, s.running_id || 0), 0);
    await base44.entities.Shift.create({
      running_id: maxId + 1,
      user_id: newEntry.user_id,
      household_id: newEntry.household_id || undefined,
      job: newEntry.job || "other",
      payment_type: newEntry.payment_type,
      price_per_hour: !isDaily ? (parseFloat(newEntry.price_per_hour) || 0) : 0,
      price_per_day: isDaily ? (parseFloat(newEntry.price_per_day) || 0) : 0,
      start_date_time: startDateTime,
      ...(endDateTime && { done_date_time: endDateTime }),
      ...(newEntry.comment && { comment: newEntry.comment }),
      is_approved: false,
    });
    setNewEntry({ user_id: "", household_id: "", job: "other", payment_type: "hourly", price_per_hour: "", price_per_day: "", start_date: "", start_time: "", end_date: "", end_time: "", comment: "" });
    setShowAddForm(false);
    await loadData();
    setIsSaving(false);
  };

  // households prop = country-filtered list from PayrollManagement
  const filteredHouseholdIds = useMemo(() => new Set(households.map(h => h.id)), [households]);

  const handleCancelShift = async (shiftId) => {
    setShifts(prev => prev.filter(s => s.id !== shiftId));
    await base44.entities.Shift.update(shiftId, { is_active: false });
  };

  const handleRestoreShift = async (shiftId) => {
    await base44.entities.Shift.update(shiftId, { is_active: true });
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, is_active: true } : s));
  };

  const rows = useMemo(() => shifts
    .filter(s => s.is_active !== false && filteredHouseholdIds.has(s.household_id) && (s.done_date_time || s.payment_type === 'daily' || !s.done_date_time))
    .map((s, idx) => {
      const user = users.find(u => u.id === s.user_id);
      const hh = allHouseholds.find(h => h.id === s.household_id);
      const isDaily = s.payment_type === 'daily';
      const missingEnd = !isDaily && !s.done_date_time;
      const hours = isDaily ? null : (s.done_date_time ? calcHours(s.start_date_time, s.done_date_time) : null);
      const pay = missingEnd ? 0 : calcPay(s);
      return {
        _id: s.id,
        _is_approved: s.is_approved,
        _missing_end: missingEnd,
        _user_id: s.user_id,
        _household_id: s.household_id,
        running_id: s.running_id ?? (idx + 1),
        employee: user?.full_name || "Unknown",
        household: hh ? `${hh.name}${hh.season ? ` (${hh.season})` : ""}` : "Unknown",
        job: s.job || "",
        payment_type: isDaily ? "Daily" : "Hourly",
        start: s.start_date_time ? format(new Date(s.start_date_time), "MMM dd yyyy HH:mm") : "",
        end: s.done_date_time ? format(new Date(s.done_date_time), "MMM dd yyyy HH:mm") : (isDaily ? "—" : ""),
        hours: hours,
        rate: isDaily ? (s.price_per_day || 0) : (s.price_per_hour || 0),
        pay,
        approved: s.is_approved ? "Yes" : "No",
        comment: s.comment || "",
        _start_raw: s.start_date_time,
        _end_raw: s.done_date_time || null,
        _is_daily: isDaily,
      };
    }), [shifts, users, allHouseholds]);

  const employeeOptions = useMemo(() => 
    users.map(u => ({ value: u.id, label: u.full_name || u.email })),
    [users]
  );

  const householdOptions = useMemo(() => 
    allHouseholds.map(h => ({ value: h.id, label: `${h.name}${h.name_hebrew ? ` / ${h.name_hebrew}` : ""}${h.season ? ` (${h.season})` : ""}` })),
    [allHouseholds]
  );

  const columns = [
    { key: "running_id", label: "#", width: 50, rawValue: r => r.running_id, render: r => <span className="text-gray-400 text-xs font-mono">{r.running_id}</span> },
    { key: "employee", label: "Employee", width: 130, rawValue: r => r.employee, dropdownOptions: employeeOptions, editable: true },
    { key: "household", label: "Household", width: 130, rawValue: r => r.household, dropdownOptions: householdOptions, editable: true },
    { key: "job", label: "Job", width: 90, dropdownOptions: [
      { value: "chef", label: "Chef" },
      { value: "sous chef", label: "Sous Chef" },
      { value: "cook", label: "Cook" },
      { value: "householdManager", label: "Household Manager" },
      { value: "waiter", label: "Waiter" },
      { value: "housekeeping", label: "Housekeeping" },
      { value: "cleaner", label: "Cleaner" },
      { value: "house manager", label: "House Manager" },
      { value: "other", label: "Other" },
    ], editable: true },
    { key: "payment_type", label: "Pay Type", width: 90, render: r => (
      <button
        onClick={() => handleTogglePaymentType(r)}
        className={`px-1.5 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer ${r._is_daily ? "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200" : "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200"}`}
        title="Click to toggle"
      >
        {r.payment_type}
      </button>
    )},
    { key: "start", label: "Shift Start", width: 150, datetime: true, rawValue: r => r._start_raw },
    { key: "end", label: "Shift End", width: 150, datetime: true, rawValue: r => r._end_raw, render: r => r._missing_end ? <span className="text-orange-500 text-xs font-medium">⚠ Missing end</span> : r._is_daily ? <span className="text-gray-400 text-xs">—</span> : r.end },
    { key: "hours", label: "Hours", width: 70, numeric: true, rawValue: r => r.hours ?? 0, render: r => r._is_daily ? <span className="text-gray-400 text-xs">Daily</span> : r._missing_end ? <span className="text-orange-400 text-xs">—</span> : (r.hours ?? 0).toFixed(2) },
    { key: "rate", label: `Rate (${curr})`, width: 80, numeric: true, rawValue: r => r.rate },
    { key: "pay", label: `Pay (${curr})`, width: 90, numeric: true, rawValue: r => r.pay, render: r => <span className="font-semibold text-green-700">{curr}{r.pay.toFixed(2)}</span> },
    { key: "approved", label: "Approved", width: 90, render: r => (
      <button
        onClick={() => handleToggleApproved(r._id, r._is_approved)}
        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer ${r._is_approved ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200" : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"}`}
      >
        {r._is_approved ? "✓ Approved" : "Pending"}
      </button>
    )},
    { key: "comment", label: "Comment", width: 160 },
    { key: "cancel", label: "", width: 40, render: r => (
      <button
        onClick={() => { if (window.confirm("Cancel this shift entry?")) handleCancelShift(r._id); }}
        className="text-gray-300 hover:text-red-500 transition-colors"
        title="Cancel entry"
      >
        <X className="w-4 h-4" />
      </button>
    )},
  ];

  const totalHours = rows.reduce((s, r) => s + (r.hours ?? 0), 0);
  const totalPay = rows.reduce((s, r) => s + r.pay, 0);
  const uniqueEmployees = new Set(rows.map(r => r.employee)).size;

  const getFooterRow = (filteredRows) => {
    const fHours = filteredRows.reduce((s, r) => s + (r.hours ?? 0), 0);
    const fPay = filteredRows.reduce((s, r) => s + r.pay, 0);
    const fEmployees = new Set(filteredRows.map(r => r.employee)).size;
    return {
      running_id: "",
      employee: `${fEmployees} employees`,
      household: "",
      job: "",
      payment_type: "",
      start: "",
      end: "",
      hours: fHours.toFixed(2),
      rate: "",
      pay: `${curr}${fPay.toFixed(2)}`,
      approved: "",
      comment: "",
    };
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  shift_start: { type: "string" },
                  shift_end: { type: "string" },
                  position: { type: "string" },
                  client: { type: "string" },
                  comment: { type: "string" },
                  hours: { type: "number" },
                  bill_too: { type: "boolean" },
                  bill_or_ccc: { type: "boolean" },
                  added_to_payroll: { type: "boolean" }
                }
              }
            }
          }
        }
      });
      if (result.status === "success" && result.output?.rows?.length) {
        const validRows = result.output.rows.filter(r => r.name && r.shift_start);
        for (const row of validRows) {
          const matchedUser = users.find(u => u.full_name?.toLowerCase().includes(row.name?.toLowerCase()));
          const matchedHousehold = households.find(h =>
            h.name?.toLowerCase().includes(row.client?.toLowerCase()) ||
            h.name_hebrew?.toLowerCase().includes(row.client?.toLowerCase())
          );
          await base44.entities.Shift.create({
            user_id: matchedUser?.id || "",
            household_id: matchedHousehold?.id || "",
            job: row.position?.toLowerCase() || "other",
            price_per_hour: 0,
            start_date_time: new Date(row.shift_start).toISOString(),
            done_date_time: row.shift_end ? new Date(row.shift_end).toISOString() : null,
            comment: row.comment || ""
          });
        }
        await loadShifts();
        alert(`Imported ${validRows.length} shifts.`);
      }
    } catch (err) {
      console.error(err);
      alert("Import failed.");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const exportCSV = () => {
    let csv = "Employee,Household,Job,Start,End,Hours,Rate,Pay,Approved,Comment\n";
    rows.forEach(r => {
      csv += `"${r.employee}","${r.household}","${r.job}","${r.start}","${r.end}",${r.hours.toFixed(2)},${r.rate},${r.pay.toFixed(2)},"${r.approved}","${r.comment}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timelog_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Employees</p><p className="text-xl font-bold">{uniqueEmployees}</p></div>
          <Users className="w-7 h-7 text-blue-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total Hours</p><p className="text-xl font-bold">{totalHours.toFixed(1)}</p></div>
          <Clock className="w-7 h-7 text-purple-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total Pay</p><p className="text-xl font-bold text-green-600">{curr}{totalPay.toFixed(2)}</p></div>
          <DollarSign className="w-7 h-7 text-green-500" />
        </CardContent></Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={() => setShowAddForm(v => !v)} variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50">
          {showAddForm ? <><X className="w-4 h-4 mr-1" />Cancel</> : <><Plus className="w-4 h-4 mr-1" />Add Entry</>}
        </Button>
        <label className="cursor-pointer">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={isImporting} />
          <Button variant="outline" size="sm" asChild>
            <span>{isImporting ? "Importing..." : <><Upload className="w-4 h-4 mr-1" />Import Excel</>}</span>
          </Button>
        </label>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />Export CSV
        </Button>
        <Button
          onClick={() => setShowCancelled(v => !v)}
          variant="outline"
          size="sm"
          className={showCancelled ? "text-red-600 border-red-300 bg-red-50" : "text-gray-400 border-gray-200"}
        >
          🗑 {showCancelled ? "Hide Cancelled" : `Bin (${shifts.filter(s => s.is_active === false && filteredHouseholdIds.has(s.household_id)).length})`}
        </Button>
      </div>

      {showCancelled && (
        <div className="border border-red-100 rounded-lg bg-red-50/40 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-500 mb-2">Cancelled Shifts</p>
          {shifts.filter(s => s.is_active === false && filteredHouseholdIds.has(s.household_id)).length === 0
            ? <p className="text-xs text-gray-400">No cancelled shifts.</p>
            : shifts.filter(s => s.is_active === false && filteredHouseholdIds.has(s.household_id)).map(s => {
              const user = users.find(u => u.id === s.user_id);
              const hh = allHouseholds.find(h => h.id === s.household_id);
              return (
                <div key={s.id} className="flex items-center justify-between bg-white border border-red-100 rounded px-3 py-1.5 text-xs text-gray-500">
                  <span>{user?.full_name || "Unknown"} — {hh?.name || "Unknown"} — {s.start_date_time ? format(new Date(s.start_date_time), "MMM dd yyyy HH:mm") : "?"}</span>
                  <button onClick={() => handleRestoreShift(s.id)} className="ml-4 text-green-600 hover:text-green-800 font-medium whitespace-nowrap">↩ Restore</button>
                </div>
              );
            })
          }
        </div>
      )}

      {showAddForm && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-green-800">New Shift Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Employee *</label>
              <Select value={newEntry.user_id} onValueChange={v => setNewEntry(p => ({ ...p, user_id: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select employee..." /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 flex items-center gap-2">
                <span>Household</span>
                <button
                  onClick={() => setShowAllSeasons(v => !v)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${showAllSeasons ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"}`}
                  title="Toggle to show all seasons"
                >
                  {showAllSeasons ? "All Seasons" : "Current Season"}
                </button>
              </label>
              <Select value={newEntry.household_id} onValueChange={v => setNewEntry(p => ({ ...p, household_id: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select household..." /></SelectTrigger>
                <SelectContent>
                  {allHouseholds
                    .filter(h => showAllSeasons || !currentSeason || h.season === currentSeason)
                    .map(h => <SelectItem key={h.id} value={h.id}>{h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}{h.season ? ` (${h.season})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Job</label>
              <Select value={newEntry.job} onValueChange={v => setNewEntry(p => ({ ...p, job: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["chef","cook","waiter","housekeeping","householdManager","cleaner","house manager","other"].map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Pay Type</label>
              <Select value={newEntry.payment_type} onValueChange={v => setNewEntry(p => ({ ...p, payment_type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newEntry.payment_type === "hourly" ? (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Rate (₪/hr)</label>
                <input type="number" step="0.01" className="h-8 w-full border rounded px-2 text-xs" placeholder="0.00" value={newEntry.price_per_hour} onChange={e => setNewEntry(p => ({ ...p, price_per_hour: e.target.value }))} />
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Rate (₪/day)</label>
                <input type="number" step="0.01" className="h-8 w-full border rounded px-2 text-xs" placeholder="0.00" value={newEntry.price_per_day} onChange={e => setNewEntry(p => ({ ...p, price_per_day: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Start Date *</label>
              <input type="date" className="h-8 w-full border rounded px-2 text-xs" value={newEntry.start_date} onChange={e => setNewEntry(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Start Time *</label>
              <input type="time" className="h-8 w-full border rounded px-2 text-xs" value={newEntry.start_time} onChange={e => setNewEntry(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            {newEntry.payment_type !== "daily" && (
              <>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">End Date</label>
                  <input type="date" className="h-8 w-full border rounded px-2 text-xs" value={newEntry.end_date} onChange={e => setNewEntry(p => ({ ...p, end_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">End Time</label>
                  <input type="time" className="h-8 w-full border rounded px-2 text-xs" value={newEntry.end_time} onChange={e => setNewEntry(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Comment</label>
              <input type="text" className="h-8 w-full border rounded px-2 text-xs" placeholder="Optional" value={newEntry.comment} onChange={e => setNewEntry(p => ({ ...p, comment: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={handleAddEntry} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </div>
      )}

      <ExcelTable
        columns={columns}
        data={rows}
        getRowKey={r => r._id}
        getFooterRow={getFooterRow}
        onEditCell={handleEditCell}
      />

      {/* End time prompt modal */}
      {endTimePrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-gray-900">End Time Required</h3>
            </div>
            <p className="text-sm text-gray-600">
              To switch this shift to <strong>Hourly</strong>, please provide the shift end time.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">End Date *</label>
                <input
                  type="date"
                  className="h-8 w-full border rounded px-2 text-xs"
                  value={endTimePrompt.endDate}
                  onChange={e => setEndTimePrompt(p => ({ ...p, endDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">End Time *</label>
                <input
                  type="time"
                  className="h-8 w-full border rounded px-2 text-xs"
                  value={endTimePrompt.endTime}
                  onChange={e => setEndTimePrompt(p => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEndTimePrompt(null)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!endTimePrompt.endDate || !endTimePrompt.endTime}
                onClick={handleConfirmEndTime}
              >
                Confirm & Switch to Hourly
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}