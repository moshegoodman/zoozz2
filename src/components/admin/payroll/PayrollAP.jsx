import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Receipt } from "lucide-react";
import ExcelTable from "./ExcelTable";

export default function PayrollAP({ users, households }) {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    setIsLoading(true);
    try { setExpenses(await base44.entities.Expense.list()); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleToggleApproved = async (expId, current) => {
    await base44.entities.Expense.update(expId, { is_approved: !current });
    setExpenses(prev => prev.map(e => e.id === expId ? { ...e, is_approved: !current } : e));
  };

  const rows = useMemo(() => expenses.map(exp => {
    const user = users.find(u => u.id === exp.user_id);
    const hh = households.find(h => h.id === exp.household_id);
    return {
      _id: exp.id,
      _is_approved: exp.is_approved,
      employee: user?.full_name || "Unknown",
      household: hh?.name || "—",
      description: exp.description || "",
      amount: exp.amount || 0,
      date: exp.date || "",
      approved: exp.is_approved ? "Yes" : "No",
    };
  }), [expenses, users, households]);

  const columns = [
    { key: "employee", label: "Employee", width: 140, rawValue: r => r.employee },
    { key: "household", label: "Household / Bill To", width: 150, rawValue: r => r.household },
    { key: "description", label: "Description", width: 200 },
    { key: "amount", label: "Amount (₪)", width: 100, numeric: true, rawValue: r => r.amount, render: r => <span className="font-semibold text-orange-600">₪{r.amount?.toFixed(2)}</span> },
    { key: "date", label: "Date", width: 100 },
    { key: "approved", label: "Approved", width: 90, render: r => (
      <button
        onClick={() => handleToggleApproved(r._id, r._is_approved)}
        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer ${r._is_approved ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200" : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"}`}
      >
        {r._is_approved ? "✓ Approved" : "Pending"}
      </button>
    )},
  ];

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const footerRow = {
    employee: `${rows.length} entries`,
    household: "",
    description: "",
    amount: `₪${totalAmount.toFixed(2)}`,
    date: "",
    approved: "",
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
        const validRows = result.output.rows.filter(r => r.who_spent);
        for (const row of validRows) {
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
        alert(`Imported ${validRows.length} AP entries.`);
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
    let csv = "Employee,Household,Description,Amount,Date,Approved\n";
    rows.forEach(r => {
      csv += `"${r.employee}","${r.household}","${r.description}",${r.amount},"${r.date}","${r.approved}"\n`;
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
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total Entries</p><p className="text-xl font-bold">{rows.length}</p></div>
          <Receipt className="w-7 h-7 text-blue-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total Amount</p><p className="text-xl font-bold text-orange-600">₪{totalAmount.toFixed(2)}</p></div>
          <Receipt className="w-7 h-7 text-orange-500" />
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