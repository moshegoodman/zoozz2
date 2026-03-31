import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Receipt, AlertCircle } from "lucide-react";

const CLIENT_CC_VALUES = ["Client CC", "clientCC"];
const STAFF_PAID = ["Staff member CC", "Staff member Cash"];

function isClientCC(paid_by) {
  return CLIENT_CC_VALUES.some(v => (paid_by || "").toLowerCase().includes(v.toLowerCase().replace(" ", ""))) ||
    (paid_by || "").toLowerCase().includes("client");
}

const USA_VALS = ["america", "usa"];
const isUSA = (c) => USA_VALS.includes((c || "").toLowerCase().trim());

export default function InvoicingAP({ household, users }) {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const curr = isUSA(household?.country) ? "$" : "₪";

  useEffect(() => {
    if (!household?.id) return;
    setIsLoading(true);
    base44.entities.Expense.filter({ household_id: household.id })
      .then(setExpenses)
      .finally(() => setIsLoading(false));
  }, [household?.id]);

  const rows = useMemo(() => expenses.map(exp => {
    const user = users.find(u => u.id === exp.user_id);
    const clientCC = isClientCC(exp.paid_by);
    const staffPaid = STAFF_PAID.includes(exp.paid_by);
    // Logic: if paid by client CC → show but don't charge; otherwise charge
    const chargeToClient = !clientCC && exp.is_approved;
    return {
      id: exp.id,
      employee: user?.full_name || "—",
      description: exp.description || "—",
      amount: exp.amount || 0,
      date: exp.date || "—",
      paid_by: exp.paid_by || "—",
      is_approved: exp.is_approved,
      clientCC,
      staffPaid,
      chargeToClient,
      receipt_url: exp.receipt_url || "",
    };
  }), [expenses, users]);

  const billableTotal = rows.filter(r => r.chargeToClient).reduce((s, r) => s + r.amount, 0);
  const clientCCTotal = rows.filter(r => r.clientCC).reduce((s, r) => s + r.amount, 0);

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Total Entries</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Billable to Client</p>
          <p className="text-2xl font-bold text-blue-700">{curr}{billableTotal.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Client CC (not charged)</p>
          <p className="text-2xl font-bold text-gray-500">{curr}{clientCCTotal.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Entries paid with the <strong>Client CC</strong> are shown for reference but are <strong>not added to the billable total</strong>. Only approved entries paid by KCS/Staff are charged to the client.</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="text-sm w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Employee</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Paid By</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">Approved</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">Charge to Client</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No expenses found for this household.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className={`border-b hover:bg-gray-50 ${row.clientCC ? "bg-gray-50 opacity-70" : ""}`}>
                <td className="px-3 py-2">{row.employee}</td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="px-3 py-2 text-gray-500">{row.date}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    row.clientCC ? "bg-blue-100 text-blue-700" :
                    row.staffPaid ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {row.paid_by}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  <span className={row.clientCC ? "text-gray-400 line-through" : "text-gray-800"}>
                    {curr}{row.amount.toFixed(2)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge className={row.is_approved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                    {row.is_approved ? "✓" : "Pending"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  {row.chargeToClient ? (
                    <span className="text-blue-600 font-semibold text-xs">✓ {curr}{row.amount.toFixed(2)}</span>
                  ) : row.clientCC ? (
                    <span className="text-gray-400 text-xs">Client CC</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.receipt_url
                    ? <a href={row.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View</a>
                    : <span className="text-gray-300 text-xs">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
              <td className="px-3 py-2 text-blue-800" colSpan={4}>Billable Total (approved, non-client-CC)</td>
              <td className="px-3 py-2 text-right text-blue-800">{curr}{billableTotal.toFixed(2)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}