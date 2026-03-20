import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, DollarSign, Download, Upload } from "lucide-react";
import { format } from "date-fns";
import ExcelTable from "./ExcelTable";

export default function PayrollTimeLog({ users, households }) {
  const [shifts, setShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => { loadShifts(); }, []);

  const loadShifts = async () => {
    setIsLoading(true);
    try { setShifts(await base44.entities.Shift.list()); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

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
    await base44.entities.Shift.update(shiftId, { is_approved: !current });
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, is_approved: !current } : s));
  };

  const rows = useMemo(() => shifts
    .filter(s => s.done_date_time)
    .map(s => {
      const user = users.find(u => u.id === s.user_id);
      const hh = households.find(h => h.id === s.household_id);
      const hours = calcHours(s.start_date_time, s.done_date_time);
      return {
        _id: s.id,
        _is_approved: s.is_approved,
        employee: user?.full_name || "Unknown",
        household: hh?.name || "Unknown",
        job: s.job || "",
        start: s.start_date_time ? format(new Date(s.start_date_time), "MMM dd yyyy HH:mm") : "",
        end: s.done_date_time ? format(new Date(s.done_date_time), "MMM dd yyyy HH:mm") : "",
        hours: hours,
        rate: s.price_per_hour || 0,
        pay: hours * (s.price_per_hour || 0),
        approved: s.is_approved ? "Yes" : "No",
        comment: s.comment || "",
        _start_raw: s.start_date_time,
      };
    }), [shifts, users, households]);

  const columns = [
    { key: "employee", label: "Employee", width: 130, rawValue: r => r.employee },
    { key: "household", label: "Household", width: 130, rawValue: r => r.household },
    { key: "job", label: "Job", width: 90 },
    { key: "start", label: "Shift Start", width: 140, rawValue: r => r._start_raw },
    { key: "end", label: "Shift End", width: 140 },
    { key: "hours", label: "Hours", width: 70, numeric: true, rawValue: r => r.hours, render: r => r.hours.toFixed(2) },
    { key: "rate", label: "Rate (₪)", width: 80, numeric: true, rawValue: r => r.rate, render: r => `₪${r.rate}` },
    { key: "pay", label: "Pay (₪)", width: 90, numeric: true, rawValue: r => r.pay, render: r => <span className="font-semibold text-green-700">₪{r.pay.toFixed(2)}</span> },
    { key: "approved", label: "Approved", width: 90, render: r => (
      <button
        onClick={() => handleToggleApproved(r._id, r._is_approved)}
        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer ${r._is_approved ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200" : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"}`}
      >
        {r._is_approved ? "✓ Approved" : "Pending"}
      </button>
    )},
    { key: "comment", label: "Comment", width: 160 },
  ];

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalPay = rows.reduce((s, r) => s + r.pay, 0);
  const uniqueEmployees = new Set(rows.map(r => r.employee)).size;

  const footerRow = {
    employee: `${uniqueEmployees} employees`,
    household: "",
    job: "",
    start: "",
    end: "",
    hours: totalHours.toFixed(2),
    rate: "",
    pay: `₪${totalPay.toFixed(2)}`,
    approved: "",
    comment: "",
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
          <div><p className="text-xs text-gray-500">Total Pay</p><p className="text-xl font-bold text-green-600">₪{totalPay.toFixed(2)}</p></div>
          <DollarSign className="w-7 h-7 text-green-500" />
        </CardContent></Card>
      </div>

      <div className="flex justify-end gap-2">
        <label className="cursor-pointer">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={isImporting} />
          <Button variant="outline" size="sm" asChild>
            <span>{isImporting ? "Importing..." : <><Upload className="w-4 h-4 mr-1" />Import Excel</>}</span>
          </Button>
        </label>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />Export CSV
        </Button>
      </div>

      <ExcelTable
        columns={columns}
        data={rows}
        getRowKey={r => r._id}
        footerRow={footerRow}
      />
    </div>
  );
}