import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import ExcelTable from "./ExcelTable";

function calcHours(start, end) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
}

const USA_VALUES = ["america", "usa"];
const isUSA = (country) => USA_VALUES.includes((country || "").toLowerCase().trim());

export default function PayrollSummary({ users, households }) {
  // Determine currency from the households being shown
  const isAmerican = (households || []).length > 0 && (households || []).every(h => isUSA(h.country));
  const curr = isAmerican ? "$" : "₪";
  const [shifts, setShifts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [s, e, p, pr, hs] = await Promise.all([
        base44.entities.Shift.list(),
        base44.entities.Expense.list(),
        base44.entities.KCSPayment.list(),
        base44.entities.Payroll.list(),
        base44.entities.HouseholdStaff.list(),
      ]);
      setShifts(s);
      setExpenses(e);
      setPayments(p);
      setPayrolls(pr);
      setHouseholdStaff(hs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleField = async (userId, field, currentValue) => {
    const existing = payrolls.find(pr => pr.user_id === userId);
    if (existing) {
      const updated = await base44.entities.Payroll.update(existing.id, { [field]: !currentValue });
      setPayrolls(prev => prev.map(pr => pr.id === existing.id ? { ...pr, [field]: !currentValue } : pr));
    } else {
      const user = users.find(u => u.id === userId);
      const created = await base44.entities.Payroll.create({
        user_id: userId,
        user_name: user?.full_name || "",
        user_email: user?.email || "",
        [field]: true,
      });
      setPayrolls(prev => [...prev, created]);
    }
  };

  const STAFF_PAID_OPTIONS = ["Staff member CC", "Staff member Cash"];

  const filteredHouseholdIds = useMemo(() => new Set((households || []).map(h => h.id)), [households]);

  const rows = useMemo(() => {
    return users.map(user => {
      const userShifts = shifts.filter(s => s.user_id === user.id && s.is_active !== false && s.is_approved && (s.done_date_time || s.payment_type === 'daily') && filteredHouseholdIds.has(s.household_id));
      // Only expenses paid by the staff member themselves are reimbursable
      const userExpenses = expenses.filter(e => e.user_id === user.id && e.is_approved && STAFF_PAID_OPTIONS.includes(e.paid_by) && filteredHouseholdIds.has(e.household_id));
      const userPayments = payments.filter(p => p.employee_user_id === user.id);
      const payroll = payrolls.find(pr => pr.user_id === user.id);

      // HouseholdStaff records for this user within filtered households
      const userStaffLinks = householdStaff.filter(hs => hs.staff_user_id === user.id && filteredHouseholdIds.has(hs.household_id));
      const shiftsComplete = userStaffLinks.length > 0 && userStaffLinks.every(hs => hs.approved_shifts_complete === true);
      const apComplete = userStaffLinks.length > 0 && userStaffLinks.every(hs => hs.approved_ap_complete === true);

      const totalShifts = userShifts.reduce((sum, s) => {
        if (s.payment_type === 'daily') return sum + (s.price_per_day || 0);
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
        was_paid: payroll?.was_paid || false,
      };
    }).filter(r => r.totalShifts > 0 || r.totalExpenses > 0 || r.totalPaid > 0 || r.was_paid);
  }, [users, shifts, expenses, payments, payrolls, householdStaff, filteredHouseholdIds]);

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
    { key: "was_paid", label: "Was Paid in Full", width: 130, render: r => (
      <button onClick={() => toggleField(r._userId, "was_paid", r._was_paid)}>
        <Badge className={r._was_paid ? "bg-green-100 text-green-700 border-green-200 cursor-pointer" : "bg-gray-100 text-gray-500 border-gray-200 cursor-pointer"}>
          {r._was_paid ? "Yes" : "No"}
        </Badge>
      </button>
    )},
  ];

  const getFooterRow = (filteredRows) => ({
    employee: `${filteredRows.length} employees`,
    totalShifts: `${curr}${filteredRows.reduce((s, r) => s + r.totalShifts, 0).toFixed(2)}`,
    totalExpenses: `${curr}${filteredRows.reduce((s, r) => s + r.totalExpenses, 0).toFixed(2)}`,
    totalPaid: `${curr}${filteredRows.reduce((s, r) => s + r.totalPaid, 0).toFixed(2)}`,
    balance: `${curr}${filteredRows.reduce((s, r) => s + r.balance, 0).toFixed(2)}`,
    shiftsComplete: "",
    apComplete: "",
    was_paid: "",
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
    </div>
  );
}