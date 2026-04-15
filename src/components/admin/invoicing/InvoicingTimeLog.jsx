import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const USA_VALS = ["america", "usa"];
const isUSA = (c) => USA_VALS.includes((c || "").toLowerCase().trim());

function calcHours(start, end) {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
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

  // Get charge rates from AppSettings role_rates
  const getRoleChargeRate = (job, paymentType) => {
    const roleRates = appSettings?.role_rates || [];
    const match = roleRates.find(r => r.job_role?.toLowerCase() === (job || "").toLowerCase());
    if (!match) return 0;
    if (paymentType === "daily") {
      return isAmerican ? (match.charge_per_day_usd || 0) : (match.charge_per_day || 0);
    }
    return isAmerican ? (match.charge_per_hour_usd || 0) : (match.charge_per_hour || 0);
  };

  const toggleApprove = async (shift) => {
    const updated = await base44.entities.Shift.update(shift.id, { is_approved: !shift.is_approved });
    setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, is_approved: updated.is_approved } : s));
  };

  const rows = useMemo(() => shifts
    .filter(s => s.done_date_time || s.payment_type === "daily")
    .map(s => {
      const user = users.find(u => u.id === s.user_id);
      const isDaily = s.payment_type === "daily";
      const hours = isDaily ? null : calcHours(s.start_date_time, s.done_date_time);
      const chargeRate = getRoleChargeRate(s.job, s.payment_type);
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
    }), [shifts, users, appSettings]);

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
        <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm text-gray-700">Detailed Shift Log</div>
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
                <td className="px-3 py-2 text-right text-gray-500">
                  {row.isDaily ? `${curr}${row.chargeRate}/day` : `${curr}${row.chargeRate}/hr`}
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
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
              <td className="px-3 py-2 text-blue-800" colSpan={7}>Total (approved only)</td>
              <td className="px-3 py-2 text-right text-blue-800">{curr}{totalCharged.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}