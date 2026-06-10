import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, DollarSign } from "lucide-react";
import ExcelTable from "./ExcelTable";
import QuickPaymentModal from "./QuickPaymentModal";

function calcHours(start, end) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
}

const USA_VALUES = ["america", "usa"];
const isUSA = (country) => USA_VALUES.includes((country || "").toLowerCase().trim());

export default function PayrollSummary({ users, households, selectedSeason = "" }) {
  // Determine currency from the households being shown
  const isAmerican = (households || []).length > 0 && (households || []).every(h => isUSA(h.country));
  const curr = isAmerican ? "$" : "₪";
  const [shifts, setShifts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [apSources, setApSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentModalRow, setPaymentModalRow] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [s, e, p, pr, hs, ms, st, ap] = await Promise.all([
        base44.entities.Shift.list(),
        base44.entities.Expense.list(),
        base44.entities.KCSPayment.list(),
        base44.entities.Payroll.list(),
        base44.entities.HouseholdStaff.list(),
        base44.entities.MenuSeason.list(),
        base44.entities.AppSettings.list(),
        base44.entities.APPaymentSource.list(),
      ]);
      setShifts(s);
      setExpenses(e);
      setPayments(p);
      setPayrolls(pr);
      setHouseholdStaff(hs);
      setSeasons(ms);
      setAppSettings(st?.[0] || null);
      setApSources(ap || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleField = async (userId, field, currentValue) => {
    const seasonKey = (selectedSeason || "").toUpperCase();
    const existing = payrolls.find(pr => pr.user_id === userId && (!seasonKey || (pr.season || "").toUpperCase() === seasonKey));
    if (existing) {
      const updated = await base44.entities.Payroll.update(existing.id, { [field]: !currentValue });
      setPayrolls(prev => prev.map(pr => pr.id === existing.id ? { ...pr, [field]: !currentValue } : pr));
    } else {
      const user = users.find(u => u.id === userId);
      const created = await base44.entities.Payroll.create({
        user_id: userId,
        user_name: user?.full_name || "",
        user_email: user?.email || "",
        season: selectedSeason || "",
        [field]: true,
      });
      setPayrolls(prev => [...prev, created]);
    }
  };

  // Staff-paid options come from AppSettings.paid_by_options where is_staff_paid === true.
  // Fall back to the legacy hardcoded labels so older data still matches.
  const STAFF_PAID_OPTIONS = useMemo(() => {
    const fromSettings = (appSettings?.paid_by_options || [])
      .filter(o => o?.is_staff_paid)
      .map(o => o.label);
    const legacy = ["Staff member", "Staff member CC", "Staff member Cash"];
    return Array.from(new Set([...fromSettings, ...legacy]));
  }, [appSettings]);

  // Map APPaymentSource.name -> user_id. When an expense's paid_by matches a source
  // tagged to a user, that expense is attributed to that user in payroll.
  const apSourceUserByName = useMemo(() => {
    const m = new Map();
    (apSources || []).forEach(src => {
      if (src?.name && src?.user_id) m.set(src.name, src.user_id);
    });
    return m;
  }, [apSources]);

  const filteredHouseholdIds = useMemo(() => new Set((households || []).map(h => h.id)), [households]);

  // Strict date range for the selected season, sourced from MenuSeason.
  // If no matching MenuSeason (or no season selected), no date constraint is applied.
  const seasonRange = useMemo(() => {
    if (!selectedSeason) return null;
    const key = selectedSeason.toUpperCase();
    const match = (seasons || []).find(x => (x.code || "").toUpperCase() === key);
    if (!match || !match.start_date || !match.end_date) return null;
    return {
      start: new Date(match.start_date + 'T00:00:00').getTime(),
      end: new Date(match.end_date + 'T23:59:59').getTime(),
    };
  }, [seasons, selectedSeason]);

  const inSeasonRange = (dateStr) => {
    if (!seasonRange) return true;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return false;
    return t >= seasonRange.start && t <= seasonRange.end;
  };

  const rows = useMemo(() => {
    return users.map(user => {
      const seasonKey = (selectedSeason || "").toUpperCase();
      const userShifts = shifts.filter(s => {
        if (s.user_id !== user.id) return false;
        if (s.is_active === false) return false;
        if (!s.is_approved) return false;
        if (!s.done_date_time && s.payment_type !== 'daily' && s.payment_type !== 'contract') return false;
        if (!filteredHouseholdIds.has(s.household_id)) return false;
        if (seasonKey) {
          // Season tag wins — explicitly tagged shifts for this season are always included.
          if (s.season) return (s.season || "").toUpperCase() === seasonKey;
          // Untagged (legacy): fall back to the season's date window.
          return inSeasonRange(s.start_date_time);
        }
        return inSeasonRange(s.start_date_time);
      });
      // Only expenses paid by the staff member themselves are reimbursable.
      // Match against household-typed charge entities within the country filter,
      // OR include expenses with no entity (KCS/unassigned) and vendor-charged ones.
      const userExpenses = expenses.filter(e => {
        if (e.is_active === false) return false;
        if (!e.is_approved) return false;
        // Resolve the user this expense belongs to in payroll:
        // if paid_by matches an APPaymentSource linked to a user, that source's user wins.
        const mappedUserId = apSourceUserByName.get(e.paid_by);
        // seasonKey is declared at the top of the map() iteration above.
        const resolvedUserId = mappedUserId || e.user_id;
        if (resolvedUserId !== user.id) return false;
        // Reimbursable check: skip when paid_by is mapped via APPaymentSource (already user-tagged),
        // otherwise require the legacy staff-paid options.
        if (!mappedUserId && !STAFF_PAID_OPTIONS.includes(e.paid_by)) return false;
        const type = e.charge_entity_type || (e.charge_entity_id ? 'household' : '');
        if (seasonKey) {
          // Season tag wins — explicitly tagged AP for this season is always included.
          if (e.season) return (e.season || '').toUpperCase() === seasonKey;
          // Untagged (legacy): must fall within the season's date window AND match a household in scope (or be KCS/vendor billed).
          if (!inSeasonRange(e.date)) return false;
          if (type === 'household' && e.charge_entity_id) return filteredHouseholdIds.has(e.charge_entity_id);
          return true;
        }
        if (!e.charge_entity_id || type !== 'household') return true;
        return filteredHouseholdIds.has(e.charge_entity_id);
      });
      const userPayments = payments.filter(p => {
        if (p.employee_user_id !== user.id) return false;
        if (p.is_active === false) return false;
        if (seasonKey) {
          // Season tag wins — explicitly tagged payments for this season are always included.
          if (p.season) return (p.season || "").toUpperCase() === seasonKey;
          // Untagged: fall back to date range
          return inSeasonRange(p.payment_date);
        }
        return inSeasonRange(p.payment_date);
      });
      const payroll = payrolls.find(pr => pr.user_id === user.id && (!seasonKey || (pr.season || "").toUpperCase() === seasonKey));

      // HouseholdStaff records for this user within filtered households
      const userStaffLinks = householdStaff.filter(hs => hs.staff_user_id === user.id && filteredHouseholdIds.has(hs.household_id));
      const shiftsComplete = userStaffLinks.length > 0 && userStaffLinks.every(hs => hs.approved_shifts_complete === true);
      const apComplete = userStaffLinks.length > 0 && userStaffLinks.every(hs => hs.approved_ap_complete === true);
      const paymentReceived = userStaffLinks.length > 0 && userStaffLinks.every(hs => hs.approved_payment_received === true);

      const totalShifts = userShifts.reduce((sum, s) => {
        if (s.payment_type === 'daily' || s.payment_type === 'contract') return sum + (s.price_per_day || 0);
        return sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0);
      }, 0);
      const totalExpenses = userExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalPaid = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const total = totalShifts + totalExpenses - totalPaid;

      return {
        user,
        totalShifts,
        totalExpenses,
        totalPaid,
        total,
        shiftsComplete,
        apComplete,
        paymentReceived,
        was_paid: payroll?.was_paid || false,
      };
    }).filter(r => r.totalShifts > 0 || r.totalExpenses > 0 || r.totalPaid > 0 || r.was_paid);
  }, [users, shifts, expenses, payments, payrolls, householdStaff, filteredHouseholdIds, selectedSeason, seasonRange, STAFF_PAID_OPTIONS, apSourceUserByName]);

  const tableRows = useMemo(() => rows.map(row => ({
    _userId: row.user.id,
    _was_paid: row.was_paid,
    employee: row.user.full_name || row.user.email,
    totalShifts: row.totalShifts,
    totalExpenses: row.totalExpenses,
    totalPaid: row.totalPaid,
    balance: row.total,
    shiftsComplete: row.shiftsComplete,
    apComplete: row.apComplete,
    paymentReceived: row.paymentReceived,
    was_paid: row.was_paid ? "Yes" : "No",
  })), [rows]);

  const summaryColumns = [
    { key: "employee", label: "Employee", width: 180, rawValue: r => r.employee },
    { key: "totalShifts", label: "Shift Pay", width: 110, numeric: true, rawValue: r => r.totalShifts, render: r => <span className="font-medium text-blue-700">{curr}{r.totalShifts.toFixed(2)}</span> },
    { key: "totalExpenses", label: "Expenses", width: 110, numeric: true, rawValue: r => r.totalExpenses, render: r => <span className="font-medium text-purple-700">{curr}{r.totalExpenses.toFixed(2)}</span> },
    { key: "totalPaid", label: "Payments", width: 110, numeric: true, rawValue: r => r.totalPaid, render: r => <span className="font-medium text-green-700">{curr}{r.totalPaid.toFixed(2)}</span> },
    { key: "balance", label: "Balance", width: 110, numeric: true, rawValue: r => r.balance, render: r => <span className={`font-bold ${r.balance > 0 ? "text-amber-600" : "text-green-600"}`}>{curr}{r.balance.toFixed(2)}</span> },
    { key: "shiftsComplete", label: "Shifts Complete", width: 130, render: r => (
      <Badge className={r.shiftsComplete ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
        {r.shiftsComplete ? "Yes" : "No"}
      </Badge>
    )},
    { key: "apComplete", label: "A/P Complete", width: 120, render: r => (
      <Badge className={r.apComplete ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
        {r.apComplete ? "Yes" : "No"}
      </Badge>
    )},
    { key: "paymentReceived", label: "Staff Confirmed Payment", width: 160, render: r => (
      <Badge className={r.paymentReceived ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
        {r.paymentReceived ? "Yes" : "No"}
      </Badge>
    )},
    { key: "was_paid", label: "Was Paid in Full", width: 130, render: r => (
      <button onClick={() => toggleField(r._userId, "was_paid", r._was_paid)}>
        <Badge className={r._was_paid ? "bg-green-100 text-green-700 border-green-200 cursor-pointer" : "bg-gray-100 text-gray-500 border-gray-200 cursor-pointer"}>
          {r._was_paid ? "Yes" : "No"}
        </Badge>
      </button>
    )},
    { key: "action", label: "Action", width: 130, render: r => {
      const user = users.find(u => u.id === r._userId);
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
          onClick={() => setPaymentModalRow({ user, balance: r.balance })}
        >
          <DollarSign className="w-3 h-3 mr-1" />Add Payment
        </Button>
      );
    }},
  ];

  const getFooterRow = (filteredRows) => ({
    employee: `${filteredRows.length} employees`,
    totalShifts: `${curr}${filteredRows.reduce((s, r) => s + r.totalShifts, 0).toFixed(2)}`,
    totalExpenses: `${curr}${filteredRows.reduce((s, r) => s + r.totalExpenses, 0).toFixed(2)}`,
    totalPaid: `${curr}${filteredRows.reduce((s, r) => s + r.totalPaid, 0).toFixed(2)}`,
    balance: `${curr}${filteredRows.reduce((s, r) => s + r.balance, 0).toFixed(2)}`,
    shiftsComplete: "",
    apComplete: "",
    paymentReceived: "",
    was_paid: "",
    action: "",
  });

  if (isLoading) return (
    <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={loadAll}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>
      <ExcelTable
        columns={summaryColumns}
        data={tableRows}
        getRowKey={r => r._userId}
        getFooterRow={getFooterRow}
      />

      <QuickPaymentModal
        open={!!paymentModalRow}
        onClose={() => setPaymentModalRow(null)}
        employee={paymentModalRow?.user}
        suggestedAmount={paymentModalRow?.balance || 0}
        defaultCurrency={isAmerican ? "USD" : "ILS"}
        season={selectedSeason || ""}
        onSaved={loadAll}
      />
    </div>
  );
}