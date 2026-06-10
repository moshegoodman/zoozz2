import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, DollarSign, Download, Upload, Plus, X, AlertTriangle, ChevronsUpDown, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format } from "date-fns";
import ExcelTable from "./ExcelTable";
import InlineCombobox from "./InlineCombobox";
import { formatShiftTime } from "@/lib/shiftTimezone";

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
  const [newEntry, setNewEntry] = useState({ user_id: "", household_id: "", job: "other", payment_type: "hourly", price_per_hour: "", price_per_day: "", contract_employee_pay: "", contract_client_charge: "", start_date: "", start_time: "", end_date: "", end_time: "", comment: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [endTimePrompt, setEndTimePrompt] = useState(null); // { row, endDate, endTime }
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [roleRates, setRoleRates] = useState([]);

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
      setRoleRates(settingsData?.[0]?.role_rates || []);
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
    if (s.payment_type === 'daily') return s.price_per_day || 0;
    if (s.payment_type === 'contract') return s.price_per_day || 0; // price_per_day stores employee pay for contract
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
      rate: (row._is_daily || row._is_contract) ? "price_per_day" : "price_per_hour",
      client_charge: (row._is_contract || row._is_daily) ? "charge_per_day" : "charge_per_hour",
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
    const isContract = newEntry.payment_type === 'contract';
    const maxId = shifts.reduce((m, s) => Math.max(m, s.running_id || 0), 0);

    // Look up charge rate from AppSettings role_rates for the selected job
    const jobRole = newEntry.job || "other";
    const rateConfig = roleRates.find(r => r.job_role?.toLowerCase() === jobRole.toLowerCase());
    const chargePerHour = isAmerican
      ? (rateConfig?.charge_per_hour_usd || 0)
      : (rateConfig?.charge_per_hour || 0);
    const chargePerDay = isAmerican
      ? (rateConfig?.charge_per_day_usd || 0)
      : (rateConfig?.charge_per_day || 0);

    await base44.entities.Shift.create({
      running_id: maxId + 1,
      user_id: newEntry.user_id,
      household_id: newEntry.household_id || undefined,
      job: jobRole,
      payment_type: newEntry.payment_type,
      price_per_hour: (!isDaily && !isContract) ? (parseFloat(newEntry.price_per_hour) || 0) : 0,
      // For contract: price_per_day = employee pay, charge_per_day = client charge
      price_per_day: (isDaily || isContract) ? (parseFloat(isContract ? newEntry.contract_employee_pay : newEntry.price_per_day) || 0) : 0,
      charge_per_hour: (!isDaily && !isContract) ? chargePerHour : 0,
      charge_per_day: isDaily ? chargePerDay : isContract ? (parseFloat(newEntry.contract_client_charge) || 0) : 0,
      start_date_time: startDateTime,
      ...(endDateTime && { done_date_time: endDateTime }),
      ...(newEntry.comment && { comment: newEntry.comment }),
      is_approved: false,
    });
    setNewEntry({ user_id: "", household_id: "", job: "other", payment_type: "hourly", price_per_hour: "", price_per_day: "", contract_employee_pay: "", contract_client_charge: "", start_date: "", start_time: "", end_date: "", end_time: "", comment: "" });
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
    .filter(s => s.is_active !== false && filteredHouseholdIds.has(s.household_id) && (s.done_date_time || s.payment_type === 'daily' || s.payment_type === 'contract' || !s.done_date_time))
    .map((s, idx) => {
      const user = users.find(u => u.id === s.user_id);
      const hh = allHouseholds.find(h => h.id === s.household_id);
      const isDaily = s.payment_type === 'daily';
      const isContract = s.payment_type === 'contract';
      const missingEnd = !isDaily && !isContract && !s.done_date_time;
      const hours = (isDaily || isContract) ? null : (s.done_date_time ? calcHours(s.start_date_time, s.done_date_time) : null);
      const pay = missingEnd ? 0 : calcPay(s);
      return {
        _id: s.id,
        _is_approved: s.is_approved,
        _missing_end: missingEnd,
        _user_id: s.user_id,
        _household_id: s.household_id,
        _is_daily: isDaily,
        _is_contract: isContract,
        running_id: s.running_id ?? (idx + 1),
        created_by: s.created_by || "—",
        employee: user?.full_name || "Unknown",
        household: hh ? `${hh.name}${hh.season ? ` (${hh.season})` : ""}` : "Unknown",
        season: s.season || hh?.season || "",
        _season_tagged: !!s.season,
        job: s.job || "",
        payment_type: isContract ? "Contract" : isDaily ? "Daily" : "Hourly",
        start: s.start_date_time ? formatShiftTime(s.start_date_time, hh?.country, "MMM dd yyyy HH:mm") : "",
        end: s.done_date_time ? formatShiftTime(s.done_date_time, hh?.country, "MMM dd yyyy HH:mm") : ((isDaily || isContract) ? "—" : ""),
        hours: hours,
        rate: isContract ? (s.price_per_day || 0) : isDaily ? (s.price_per_day || 0) : (s.price_per_hour || 0),
        client_charge: isContract ? (s.charge_per_day || 0) : isDaily ? (s.charge_per_day || 0) : (s.charge_per_hour || 0),
        pay,
        approved: s.is_approved ? "Yes" : "No",
        comment: s.comment || "",
        _start_raw: s.start_date_time,
        _end_raw: s.done_date_time || null,
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
    { key: "created_by", label: "Created By", width: 140, rawValue: r => r.created_by, render: r => <span className="text-gray-500 text-xs truncate">{r.created_by}</span> },
    { key: "running_id", label: "#", width: 50, rawValue: r => r.running_id, render: r => <span className="text-gray-400 text-xs font-mono">{r.running_id}</span> },
    { key: "employee", label: "Employee", width: 150, rawValue: r => r.employee, render: r => (
      <InlineCombobox
        value={r._user_id}
        onChange={(val) => handleEditCell(r, "employee", val)}
        options={employeeOptions}
        placeholder="— select —"
        searchPlaceholder="Search employee..."
      />
    )},
    { key: "household", label: "Household", width: 170, rawValue: r => r.household, render: r => (
      <InlineCombobox
        value={r._household_id}
        onChange={(val) => handleEditCell(r, "household", val)}
        options={householdOptions}
        placeholder="— select —"
        searchPlaceholder="Search household..."
      />
    )},
    { key: "season", label: "Season", width: 80, rawValue: r => r.season, render: r => r.season ? (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${r._season_tagged ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-gray-100 text-gray-500 border-gray-300"}`} title={r._season_tagged ? "Tagged on shift" : "Inherited from household"}>
        {r.season}
      </span>
    ) : <span className="text-gray-300 text-xs">—</span> },
    { key: "job", label: "Job", width: 90, dropdownOptions: [
      { value: "chef", label: "Chef" },
      { value: "sous chef", label: "Sous Chef" },
      { value: "cook", label: "Cook" },
      { value: "householdManager", label: "Household Manager" },
      { value: "waiter", label: "Waiter" },
      { value: "housekeeping", label: "Housekeeping" },
      { value: "cleaner", label: "Cleaner" },
      { value: "house manager", label: "House Manager" },
      { value: "chef travel", label: "Chef Travel" },
      { value: "cook travel", label: "Cook Travel" },
      { value: "other", label: "Other" },
    ], editable: true },
    { key: "payment_type", label: "Pay Type", width: 90, render: r => (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${r._is_contract ? "bg-orange-100 text-orange-700 border-orange-300" : r._is_daily ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-purple-100 text-purple-700 border-purple-300"}`}>
        {r._is_contract ? "קבלנות" : r.payment_type}
      </span>
    )},
    { key: "start", label: "Shift Start", width: 150, datetime: true, timeZone: "Asia/Jerusalem", rawValue: r => r._start_raw },
    { key: "end", label: "Shift End", width: 150, datetime: true, timeZone: "Asia/Jerusalem", rawValue: r => r._end_raw, editable: true, render: (r, onEdit) => (r._is_daily || r._is_contract) ? <span className="text-gray-400 text-xs">—</span> : null },
    { key: "hours", label: "Hours", width: 70, numeric: true, rawValue: r => r.hours ?? 0, render: r => (r._is_daily || r._is_contract) ? <span className="text-gray-400 text-xs">{r._is_contract ? "—" : "Daily"}</span> : r._missing_end ? <span className="text-orange-400 text-xs">—</span> : (r.hours ?? 0).toFixed(2) },
    { key: "rate", label: `Employee Pay (${curr})`, width: 100, numeric: true, rawValue: r => r.rate },
    { key: "client_charge", label: `Client Charge (${curr})`, width: 110, numeric: true, rawValue: r => r.client_charge ?? "", render: r => <span className="font-semibold text-blue-700">{curr}{(r.client_charge || 0).toFixed(2)}</span> },
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
      created_by: "",
      running_id: "",
      employee: `${fEmployees} employees`,
      household: "",
      season: "",
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

  const VALID_JOBS = ["chef", "sous chef", "cook", "waiter", "housekeeping", "householdManager", "cleaner", "house manager", "chef travel", "cook travel", "other"];

  // Import resolution state
  const [importResolution, setImportResolution] = useState(null); // { rows: [...], issues: [...] }

  const parseCSVRow = (line) => {
    const cols = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    cols.push(current.trim());
    return cols;
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const header = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
      const idxOf = (name) => header.indexOf(name);

      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVRow(lines[i]);
        if (cols.every(c => !c)) continue;
        parsed.push({
          employee: cols[idxOf("employee")] || "",
          household: cols[idxOf("household")] || "",
          job: cols[idxOf("job")] || "",
          start: cols[idxOf("start")] || "",
          end: cols[idxOf("end")] || "",
          rate: parseFloat(cols[idxOf("rate")]) || 0,
          approved: (cols[idxOf("approved")] || "").toLowerCase() === "yes",
          comment: cols[idxOf("comment")] || "",
        });
      }

      // Resolve each row
      const resolvedRows = parsed.map(row => {
        // Match user
        const empLower = row.employee.toLowerCase().trim();
        const matchedUser = users.find(u => u.full_name?.toLowerCase().trim() === empLower)
          || users.find(u => u.full_name?.toLowerCase().includes(empLower));
        
        // Match household — CSV format is like "Josephs (P26)", try name match ignoring season suffix
        const hhRaw = row.household.replace(/\s*\([^)]*\)\s*$/, "").toLowerCase().trim();
        const matchedHousehold = allHouseholds.find(h => h.name?.toLowerCase().trim() === hhRaw)
          || allHouseholds.find(h => h.name?.toLowerCase().includes(hhRaw) || hhRaw.includes(h.name?.toLowerCase()));

        // Validate job
        const jobLower = row.job.toLowerCase().trim();
        const validJob = VALID_JOBS.find(j => j === jobLower) || null;

        return {
          ...row,
          resolved_user_id: matchedUser?.id || null,
          resolved_user_name: matchedUser?.full_name || null,
          resolved_household_id: matchedHousehold?.id || null,
          resolved_household_name: matchedHousehold?.name || null,
          resolved_job: validJob,
        };
      });

      const hasIssues = resolvedRows.some(r => !r.resolved_user_id || !r.resolved_household_id || !r.resolved_job);
      if (hasIssues) {
        setImportResolution(resolvedRows);
      } else {
        await commitImport(resolvedRows);
      }
    } catch (err) {
      console.error(err);
      alert("Import failed: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const commitImport = async (resolvedRows) => {
    const maxId = shifts.reduce((m, s) => Math.max(m, s.running_id || 0), 0);
    let created = 0;
    for (let i = 0; i < resolvedRows.length; i++) {
      const row = resolvedRows[i];
      if (!row.resolved_user_id || !row.resolved_household_id || !row.resolved_job) {
        continue; // skip unresolved
      }
      const startISO = new Date(row.start).toISOString();
      const endISO = row.end ? new Date(row.end).toISOString() : null;

      const rateConfig = roleRates.find(r => r.job_role?.toLowerCase() === row.resolved_job.toLowerCase());
      const chargePerHour = isAmerican ? (rateConfig?.charge_per_hour_usd || 0) : (rateConfig?.charge_per_hour || 0);

      await base44.entities.Shift.create({
        running_id: maxId + 1 + created,
        user_id: row.resolved_user_id,
        household_id: row.resolved_household_id,
        job: row.resolved_job,
        payment_type: "hourly",
        price_per_hour: row.rate || 0,
        price_per_day: 0,
        charge_per_hour: chargePerHour,
        charge_per_day: 0,
        start_date_time: startISO,
        ...(endISO && { done_date_time: endISO }),
        comment: row.comment || "",
        is_approved: row.approved,
      });
      created++;
    }
    setImportResolution(null);
    await loadData();
    alert(`Imported ${created} shifts.`);
  };

  const exportCSV = () => {
    let csv = "Employee,Household,Job,Start,End,Hours,Rate,Pay,Approved,Comment\n";
    rows.forEach(r => {
      csv += `"${r.employee}","${r.household}","${r.job}","${r.start}","${r._end_raw ? r.end : ""}",${(r.hours ?? 0).toFixed(2)},${r.rate},${r.pay.toFixed(2)},"${r.approved}","${r.comment}"\n`;
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
          <div><p className="text-xs text-gray-500 dark:text-gray-400">Employees</p><p className="text-xl font-bold text-gray-900 dark:text-white">{uniqueEmployees}</p></div>
          <Users className="w-7 h-7 text-blue-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500 dark:text-gray-400">Total Hours</p><p className="text-xl font-bold text-gray-900 dark:text-white">{totalHours.toFixed(1)}</p></div>
          <Clock className="w-7 h-7 text-purple-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500 dark:text-gray-400">Total Pay</p><p className="text-xl font-bold text-green-600 dark:text-green-400">{curr}{totalPay.toFixed(2)}</p></div>
          <DollarSign className="w-7 h-7 text-green-500" />
        </CardContent></Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={() => setShowAddForm(v => !v)} variant="outline" size="sm" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-950">
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
        <div className="border border-red-100 dark:border-red-900 rounded-lg bg-red-50/40 dark:bg-red-950/20 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-500 dark:text-red-400 mb-2">Cancelled Shifts</p>
          {shifts.filter(s => s.is_active === false && filteredHouseholdIds.has(s.household_id)).length === 0
            ? <p className="text-xs text-gray-400 dark:text-gray-500">No cancelled shifts.</p>
            : shifts.filter(s => s.is_active === false && filteredHouseholdIds.has(s.household_id)).map(s => {
               const user = users.find(u => u.id === s.user_id);
               const hh = allHouseholds.find(h => h.id === s.household_id);
               return (
                 <div key={s.id} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900 rounded px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                   <span>{user?.full_name || "Unknown"} — {hh?.name || "Unknown"} — {s.start_date_time ? formatShiftTime(s.start_date_time, hh?.country, "MMM dd yyyy HH:mm") : "?"}</span>
                   <button onClick={() => handleRestoreShift(s.id)} className="ml-4 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium whitespace-nowrap">↩ Restore</button>
                </div>
              );
            })
          }
        </div>
      )}

      {showAddForm && (
        <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">New Shift Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal">
                    {users.find(u => u.id === newEntry.user_id)?.full_name || users.find(u => u.id === newEntry.user_id)?.email || 'Select employee...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employees..." />
                    <CommandList>
                      <CommandEmpty>No employees found.</CommandEmpty>
                      <CommandGroup>
                        {users.map(u => (
                          <CommandItem key={u.id} value={u.id} onSelect={(val) => setNewEntry(p => ({ ...p, user_id: val }))}>
                            <Check className={`mr-2 h-4 w-4 ${newEntry.user_id === u.id ? 'opacity-100' : 'opacity-0'}`} />
                            {u.full_name || u.email}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                <span>Household</span>
                <button
                  onClick={() => setShowAllSeasons(v => !v)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${showAllSeasons ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                  title="Toggle to show all seasons"
                >
                  {showAllSeasons ? "All Seasons" : "Current Season"}
                </button>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal">
                    {(() => {
                      const h = allHouseholds.find(x => x.id === newEntry.household_id);
                      return h ? `${h.name}${h.season ? ` (${h.season})` : ""}` : 'Select household...';
                    })()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search households..." />
                    <CommandList>
                      <CommandEmpty>No households found.</CommandEmpty>
                      <CommandGroup>
                        {allHouseholds
                          .filter(h => showAllSeasons || !currentSeason || (h.season || '').trim().toUpperCase() === (currentSeason || '').trim().toUpperCase())
                          .map(h => (
                            <CommandItem key={h.id} value={h.id} onSelect={(val) => setNewEntry(p => ({ ...p, household_id: val }))}>
                              <Check className={`mr-2 h-4 w-4 ${newEntry.household_id === h.id ? 'opacity-100' : 'opacity-0'}`} />
                              {h.name}{h.season ? ` (${h.season})` : ""}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Job</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal">
                    {newEntry.job || 'Select job...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search jobs..." />
                    <CommandList>
                      <CommandEmpty>No jobs found.</CommandEmpty>
                      <CommandGroup>
                        {["chef","sous chef","cook","waiter","housekeeping","householdManager","cleaner","house manager","chef travel","cook travel","other"].map(j => (
                          <CommandItem key={j} value={j} onSelect={(val) => setNewEntry(p => ({ ...p, job: val }))}>
                            <Check className={`mr-2 h-4 w-4 ${newEntry.job === j ? 'opacity-100' : 'opacity-0'}`} />
                            {j}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Pay Type</label>
              <Select value={newEntry.payment_type} onValueChange={v => setNewEntry(p => ({ ...p, payment_type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="contract">קבלנות (Contract)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newEntry.payment_type === "hourly" && (
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Rate ({curr}/hr)</label>
                <input type="number" step="0.01" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" placeholder="0.00" value={newEntry.price_per_hour} onChange={e => setNewEntry(p => ({ ...p, price_per_hour: e.target.value }))} />
              </div>
            )}
            {newEntry.payment_type === "daily" && (
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Rate ({curr}/day)</label>
                <input type="number" step="0.01" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" placeholder="0.00" value={newEntry.price_per_day} onChange={e => setNewEntry(p => ({ ...p, price_per_day: e.target.value }))} />
              </div>
            )}
            {newEntry.payment_type === "contract" && (
              <>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee Pay ({curr}) *</label>
                  <input type="number" step="0.01" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" placeholder="0.00" value={newEntry.contract_employee_pay} onChange={e => setNewEntry(p => ({ ...p, contract_employee_pay: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Client Charge ({curr}) *</label>
                  <input type="number" step="0.01" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" placeholder="0.00" value={newEntry.contract_client_charge} onChange={e => setNewEntry(p => ({ ...p, contract_client_charge: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Start Date *</label>
              <input type="date" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" value={newEntry.start_date} onChange={e => setNewEntry(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Start Time *</label>
              <input type="time" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" value={newEntry.start_time} onChange={e => setNewEntry(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            {newEntry.payment_type !== "daily" && newEntry.payment_type !== "contract" && (
              <>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">End Date</label>
                  <input type="date" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" value={newEntry.end_date} onChange={e => setNewEntry(p => ({ ...p, end_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">End Time</label>
                  <input type="time" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" value={newEntry.end_time} onChange={e => setNewEntry(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Comment</label>
              <input type="text" className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 text-xs" placeholder="Optional" value={newEntry.comment} onChange={e => setNewEntry(p => ({ ...p, comment: e.target.value }))} />
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

      {/* Import Resolution Modal */}
       {importResolution && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
             <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
               <div>
                 <h2 className="text-lg font-bold text-gray-900 dark:text-white">Resolve Import Issues</h2>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Some rows couldn't be automatically matched. Please resolve before importing.</p>
               </div>
               <button onClick={() => setImportResolution(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
             </div>
            <div className="overflow-auto flex-1 px-6 py-4 space-y-3">
              {importResolution.map((row, idx) => {
                const hasIssue = !row.resolved_user_id || !row.resolved_household_id || !row.resolved_job;
                return (
                  <div key={idx} className={`border rounded-lg p-3 text-sm ${hasIssue ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30" : "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hasIssue ? "bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200" : "bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-200"}`}>
                        Row {idx + 1} — {hasIssue ? "⚠ Needs attention" : "✓ Ready"}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">{row.start} → {row.end}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Employee */}
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">
                          Employee <span className="text-gray-400 dark:text-gray-500 font-normal">(CSV: "{row.employee}")</span>
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className={`h-8 text-xs justify-between w-full font-normal ${!row.resolved_user_id ? "border-amber-400" : ""}`}>
                              {users.find(u => u.id === row.resolved_user_id)?.full_name || users.find(u => u.id === row.resolved_user_id)?.email || 'Select employee...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search employees..." />
                              <CommandList>
                                <CommandEmpty>No employees found.</CommandEmpty>
                                <CommandGroup>
                                  {users.map(u => (
                                    <CommandItem key={u.id} value={u.id} onSelect={(val) => {
                                      const user = users.find(u => u.id === val);
                                      setImportResolution(prev => prev.map((r, i) => i === idx ? { ...r, resolved_user_id: val, resolved_user_name: user?.full_name } : r));
                                    }}>
                                      <Check className={`mr-2 h-4 w-4 ${row.resolved_user_id === u.id ? 'opacity-100' : 'opacity-0'}`} />
                                      {u.full_name || u.email}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {/* Household */}
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">
                          Household <span className="text-gray-400 dark:text-gray-500 font-normal">(CSV: "{row.household}")</span>
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className={`h-8 text-xs justify-between w-full font-normal ${!row.resolved_household_id ? "border-amber-400" : ""}`}>
                              {(() => {
                                const h = allHouseholds.find(x => x.id === row.resolved_household_id);
                                return h ? `${h.name}${h.season ? ` (${h.season})` : ""}` : 'Select household...';
                              })()}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search households..." />
                              <CommandList>
                                <CommandEmpty>No households found.</CommandEmpty>
                                <CommandGroup>
                                  {allHouseholds.map(h => (
                                    <CommandItem key={h.id} value={h.id} onSelect={(val) => {
                                      const household = allHouseholds.find(h => h.id === val);
                                      setImportResolution(prev => prev.map((r, i) => i === idx ? { ...r, resolved_household_id: val, resolved_household_name: household?.name } : r));
                                    }}>
                                      <Check className={`mr-2 h-4 w-4 ${row.resolved_household_id === h.id ? 'opacity-100' : 'opacity-0'}`} />
                                      {h.name}{h.season ? ` (${h.season})` : ""}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {/* Job */}
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">
                          Job <span className="text-gray-400 dark:text-gray-500 font-normal">(CSV: "{row.job}")</span>
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className={`h-8 text-xs justify-between w-full font-normal ${!row.resolved_job ? "border-amber-400" : ""}`}>
                              {row.resolved_job || 'Select job...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search jobs..." />
                              <CommandList>
                                <CommandEmpty>No jobs found.</CommandEmpty>
                                <CommandGroup>
                                  {VALID_JOBS.map(j => (
                                    <CommandItem key={j} value={j} onSelect={(val) => setImportResolution(prev => prev.map((r, i) => i === idx ? { ...r, resolved_job: val } : r))}>
                                      <Check className={`mr-2 h-4 w-4 ${row.resolved_job === j ? 'opacity-100' : 'opacity-0'}`} />
                                      {j}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {importResolution.filter(r => !r.resolved_user_id || !r.resolved_household_id || !r.resolved_job).length} row(s) still unresolved — they will be skipped.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportResolution(null)}>Cancel</Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => commitImport(importResolution)}>
                  Import {importResolution.filter(r => r.resolved_user_id && r.resolved_household_id && r.resolved_job).length} Rows
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End time prompt modal */}
      {endTimePrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-gray-900 dark:text-white">End Time Required</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              To switch this shift to <strong>Hourly</strong>, please provide the shift end time.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">End Date *</label>
                <input
                  type="date"
                  className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-2 text-xs"
                  value={endTimePrompt.endDate}
                  onChange={e => setEndTimePrompt(p => ({ ...p, endDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">End Time *</label>
                <input
                  type="time"
                  className="h-8 w-full border dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded px-2 text-xs"
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