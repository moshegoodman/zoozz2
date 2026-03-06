import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Receipt } from "lucide-react";

export default function PayrollAP({ users, households }) {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [filterHousehold, setFilterHousehold] = useState("all");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.Expense.list();
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = expenses.filter(exp => {
    if (filterUser !== "all" && exp.user_id !== filterUser) return false;
    if (filterHousehold !== "all" && exp.household_id !== filterHousehold) return false;
    return true;
  });

  const totalNIS = filtered.reduce((s, e) => s + (e.amount || 0), 0);

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
                  line_number: { type: "number" },
                  usd: { type: "number" },
                  nis: { type: "number" },
                  who_spent: { type: "string" },
                  how_paid: { type: "string" },
                  category: { type: "string" },
                  what_is_it: { type: "string" },
                  merchant: { type: "string" },
                  bill_to: { type: "string" },
                  receipt_link: { type: "string" },
                  scanned: { type: "boolean" },
                  added_to_bill: { type: "boolean" },
                  added_to_payroll: { type: "boolean" },
                  notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.status === "success" && result.output?.rows?.length) {
        const rows = result.output.rows.filter(r => r.who_spent);
        for (const row of rows) {
          const matchedUser = users.find(u => u.full_name?.toLowerCase().includes(row.who_spent?.toLowerCase()));
          const matchedHousehold = households.find(h =>
            h.name?.toLowerCase().includes(row.bill_to?.toLowerCase()) ||
            h.name_hebrew?.toLowerCase().includes(row.bill_to?.toLowerCase())
          );
          await base44.entities.Expense.create({
            user_id: matchedUser?.id || "",
            household_id: matchedHousehold?.id || "",
            amount: row.nis || (row.usd ? row.usd * 3.7 : 0),
            description: `${row.what_is_it || ""} - ${row.merchant || ""}`.trim(),
            date: new Date().toISOString().split("T")[0],
            is_approved: row.added_to_bill || false
          });
        }
        await loadExpenses();
        alert(`Imported ${rows.length} AP entries.`);
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
    let csv = "Employee,Household,Description,Amount (NIS),Date,Approved\n";
    filtered.forEach(exp => {
      const user = users.find(u => u.id === exp.user_id);
      const hh = households.find(h => h.id === exp.household_id);
      csv += `"${user?.full_name || ""}","${hh?.name || ""}","${exp.description || ""}",${exp.amount},${exp.date},${exp.is_approved}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ap_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Total Entries</p><p className="text-2xl font-bold">{filtered.length}</p></div>
          <Receipt className="w-8 h-8 text-blue-600" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-gray-600">Total Amount</p><p className="text-2xl font-bold text-orange-600">₪{totalNIS.toFixed(2)}</p></div>
          <Receipt className="w-8 h-8 text-orange-600" />
        </CardContent></Card>
      </div>

      {/* Filters */}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Employee</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="all">All</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Household / Bill To</label>
              <select value={filterHousehold} onChange={e => setFilterHousehold(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="all">All</option>
                {households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>AP Entries</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2 pr-4">Employee</th>
                  <th className="pb-2 pr-4">Household</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2">Approved</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => {
                  const user = users.find(u => u.id === exp.user_id);
                  const hh = households.find(h => h.id === exp.household_id);
                  return (
                    <tr key={exp.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">{user?.full_name || "—"}</td>
                      <td className="py-2 pr-4">{hh?.name || "—"}</td>
                      <td className="py-2 pr-4">{exp.description}</td>
                      <td className="py-2 pr-4 font-semibold text-orange-600">₪{exp.amount?.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-gray-500">{exp.date}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${exp.is_approved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {exp.is_approved ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500">No entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}