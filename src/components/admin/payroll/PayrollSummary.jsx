import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

function calcHours(start, end) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
}

export default function PayrollSummary({ users }) {
  const [shifts, setShifts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [s, e, p, pr] = await Promise.all([
        base44.entities.Shift.list(),
        base44.entities.Expense.list(),
        base44.entities.KCSPayment.list(),
        base44.entities.Payroll.list(),
      ]);
      setShifts(s);
      setExpenses(e);
      setPayments(p);
      setPayrolls(pr);
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

  const rows = useMemo(() => {
    return users.map(user => {
      const userShifts = shifts.filter(s => s.user_id === user.id && s.is_approved && s.done_date_time);
      const userExpenses = expenses.filter(e => e.user_id === user.id && e.is_approved);
      const userPayments = payments.filter(p => p.employee_user_id === user.id);
      const payroll = payrolls.find(pr => pr.user_id === user.id);

      const totalShifts = userShifts.reduce((sum, s) => sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0), 0);
      const totalExpenses = userExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalPaid = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const total = totalShifts + totalExpenses - totalPaid;

      return {
        user,
        totalShifts,
        totalExpenses,
        totalPaid,
        total,
        confirmed_by_staff: payroll?.confirmed_by_staff || false,
        was_paid: payroll?.was_paid || false,
      };
    }).filter(r => r.totalShifts > 0 || r.totalExpenses > 0 || r.totalPaid > 0 || r.confirmed_by_staff || r.was_paid);
  }, [users, shifts, expenses, payments, payrolls]);

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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">User</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Shift Pay</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Expenses</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Payments</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Balance</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Confirmed by Staff</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Was Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No payroll data found.</td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row.user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{row.user.full_name}</p>
                  <p className="text-xs text-gray-400">{row.user.email}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium text-blue-700">₪{row.totalShifts.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium text-purple-700">₪{row.totalExpenses.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium text-green-700">₪{row.totalPaid.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold ${row.total > 0 ? "text-amber-600" : "text-green-600"}`}>
                    ₪{row.total.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleField(row.user.id, "confirmed_by_staff", row.confirmed_by_staff)}>
                    <Badge className={row.confirmed_by_staff ? "bg-green-100 text-green-700 border-green-200 cursor-pointer" : "bg-gray-100 text-gray-500 border-gray-200 cursor-pointer"}>
                      {row.confirmed_by_staff ? "Yes" : "No"}
                    </Badge>
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleField(row.user.id, "was_paid", row.was_paid)}>
                    <Badge className={row.was_paid ? "bg-green-100 text-green-700 border-green-200 cursor-pointer" : "bg-gray-100 text-gray-500 border-gray-200 cursor-pointer"}>
                      {row.was_paid ? "Yes" : "No"}
                    </Badge>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}