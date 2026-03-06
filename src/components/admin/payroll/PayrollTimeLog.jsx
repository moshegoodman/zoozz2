import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, DollarSign, Download, Upload } from "lucide-react";
import { format } from "date-fns";

export default function PayrollTimeLog({ users, households }) {
  const [shifts, setShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [filterHousehold, setFilterHousehold] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.Shift.list();
      setShifts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDuration = (start, end) => {
    if (!end) return 0;
    return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
  };

  const filteredShifts = shifts.filter(shift => {
    if (!shift.done_date_time) return false;
    if (filterUser !== "all" && shift.user_id !== filterUser) return false;
    if (filterHousehold !== "all" && shift.household_id !== filterHousehold) return false;
    if (startDate && new Date(shift.start_date_time) < new Date(startDate)) return false;
    if (endDate && new Date(shift.start_date_time) > new Date(endDate)) return false;
    return true;
  });

  const summary = {};
  filteredShifts.forEach(shift => {
    if (!summary[shift.user_id]) {
      const user = users.find(u => u.id === shift.user_id);
      summary[shift.user_id] = { userName: user?.full_name || "Unknown", totalHours: 0, totalPay: 0, shifts: [] };
    }
    const hours = calculateDuration(shift.start_date_time, shift.done_date_time);
    summary[shift.user_id].totalHours += hours;
    summary[shift.user_id].totalPay += hours * shift.price_per_hour;
    summary[shift.user_id].shifts.push(shift);
  });
  const payrollSummary = Object.values(summary);
  const totalHours = payrollSummary.reduce((s, e) => s + e.totalHours, 0);
  const totalPay = payrollSummary.reduce((s, e) => s + e.totalPay, 0);

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
        const rows = result.output.rows.filter(r => r.name && r.shift_start);
        for (const row of rows) {
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
        alert(`Imported ${rows.length} shifts.`);
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
    let csv = "Employee,Household,Job,Start,End,Hours,Rate,Pay,Comment\n";
    filteredShifts.forEach(shift => {
      const user = users.find(u => u.id === shift.user_id);
      const hh = households.find(h => h.id === shift.household_id);
      const hours = calculateDuration(shift.start_date_time, shift.done_date_time);
      csv += `"${user?.full_name || ""}","${hh?.name || ""}","${shift.job}","${shift.start_date_time}","${shift.done_date_time || ""}",${hours.toFixed(2)},${shift.price_per_hour},${(hours * shift.price_per_hour).toFixed(2)},"${shift.comment || ""}"\n`;
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
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Employees</p><p className="text-2xl font-bold">{payrollSummary.length}</p></div>
          <Users className="w-8 h-8 text-blue-600" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Total Hours</p><p className="text-2xl font-bold">{totalHours.toFixed(2)}</p></div>
          <Clock className="w-8 h-8 text-purple-600" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Total Pay</p><p className="text-2xl font-bold text-green-600">₪{totalPay.toFixed(2)}</p></div>
          <DollarSign className="w-8 h-8 text-green-600" />
        </CardContent></Card>
      </div>

      {/* Filters + actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filters</span>
            <div className="flex gap-2">
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Employee</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="all">All</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Household</label>
              <select value={filterHousehold} onChange={e => setFilterHousehold(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="all">All</option>
                {households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee rows */}
      <Card>
        <CardHeader><CardTitle>Employee Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payrollSummary.map(emp => (
              <div key={emp.userName} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{emp.userName}</h3>
                    <p className="text-sm text-gray-600">{emp.shifts.length} shifts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">₪{emp.totalPay.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{emp.totalHours.toFixed(2)} hrs</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {emp.shifts.map(shift => {
                    const hh = households.find(h => h.id === shift.household_id);
                    const hours = calculateDuration(shift.start_date_time, shift.done_date_time);
                    return (
                      <div key={shift.id} className="text-sm bg-gray-50 p-2 rounded flex justify-between">
                        <div>
                          <span className="font-medium">{hh?.name || "Unknown"}</span>
                          <span className="text-gray-500 ml-2 capitalize">({shift.job})</span>
                          <span className="text-gray-400 ml-2">{format(new Date(shift.start_date_time), "MMM dd, yyyy")}</span>
                        </div>
                        <div className="text-right">
                          <span>{hours.toFixed(2)} hrs @ ₪{shift.price_per_hour}/hr</span>
                          <span className="text-green-600 ml-2 font-semibold">= ₪{(hours * shift.price_per_hour).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {payrollSummary.length === 0 && <p className="text-center text-gray-500 py-8">No shifts found</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}