import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shift, Expense, HouseholdStaff, Household } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, BarChart2, CheckCircle, XCircle, Upload } from "lucide-react";
import { format } from "date-fns";

const tabs = [
  { id: "shift", label: "Submit Shift", icon: Clock },
  { id: "expense", label: "Submit Expense", icon: DollarSign },
  { id: "summary", label: "My Summary", icon: BarChart2 },
];

export default function StaffPortal() {
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [myExpenses, setMyExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState("shift");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [shiftForm, setShiftForm] = useState({
    start_date: today, start_time: nowTime,
    end_date: today, end_time: "",
    household_id: "", comment: ""
  });

  const [expenseForm, setExpenseForm] = useState({
    household_id: "", amount: "", description: "", date: today, receipt_url: ""
  });

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        const staffAssignments = await HouseholdStaff.filter({ staff_user_id: currentUser.id });
        setAssignments(staffAssignments);
        if (staffAssignments.length > 0) {
          const householdIds = staffAssignments.map(a => a.household_id);
          const allHouseholds = await Household.filter({ id: { $in: householdIds } });
          setHouseholds(allHouseholds);
        }
        const [shiftsData, expensesData] = await Promise.all([
          Shift.filter({ user_id: currentUser.id }),
          Expense.filter({ user_id: currentUser.id })
        ]);
        setMyShifts(shiftsData.sort((a, b) => new Date(b.start_date_time) - new Date(a.start_date_time)));
        setMyExpenses(expensesData.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const calcHours = (start, end) => {
    if (!end) return 0;
    return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
  };

  const handleSubmitShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.household_id || !shiftForm.start_date || !shiftForm.start_time) {
      alert("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      const startDateTime = new Date(`${shiftForm.start_date}T${shiftForm.start_time}`).toISOString();
      const endDateTime = shiftForm.end_date && shiftForm.end_time
        ? new Date(`${shiftForm.end_date}T${shiftForm.end_time}`).toISOString()
        : null;
      const assignment = assignments.find(a => a.household_id === shiftForm.household_id);
      const newShift = await Shift.create({
        user_id: user.id,
        household_id: shiftForm.household_id,
        job: assignment?.job_role || "other",
        price_per_hour: assignment?.price_per_hour || 0,
        start_date_time: startDateTime,
        ...(endDateTime && { done_date_time: endDateTime }),
        ...(shiftForm.comment && { comment: shiftForm.comment }),
        is_approved: false
      });
      setMyShifts(prev => [newShift, ...prev]);
      setShiftForm({ start_date: today, start_time: nowTime, end_date: today, end_time: "", household_id: "", comment: "" });
      setSuccessMsg("Shift submitted! Pending approval.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingReceipt(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setExpenseForm(prev => ({ ...prev, receipt_url: file_url }));
    setIsUploadingReceipt(false);
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.household_id || !expenseForm.amount || !expenseForm.description) {
      alert("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      const newExpense = await Expense.create({
        user_id: user.id,
        household_id: expenseForm.household_id,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        date: expenseForm.date,
        receipt_url: expenseForm.receipt_url || undefined,
        is_approved: false
      });
      setMyExpenses(prev => [newExpense, ...prev]);
      setExpenseForm({ household_id: "", amount: "", description: "", date: today, receipt_url: "" });
      setSuccessMsg("Expense submitted! Pending approval.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHouseholdName = (id) => {
    const h = households.find(h => h.id === id);
    return h ? (h.name_hebrew ? `${h.name} / ${h.name_hebrew}` : h.name) : id;
  };

  const totalApprovedHours = myShifts.filter(s => s.is_approved && s.done_date_time).reduce((sum, s) => sum + calcHours(s.start_date_time, s.done_date_time), 0);
  const totalApprovedPay = myShifts.filter(s => s.is_approved && s.done_date_time).reduce((sum, s) => sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0), 0);
  const totalApprovedExpenses = myExpenses.filter(e => e.is_approved).reduce((sum, e) => sum + (e.amount || 0), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-800 text-center py-6 px-4">
        <h1 className="text-yellow-400 font-extrabold text-4xl tracking-wide uppercase">Staff Portal</h1>
        <p className="text-yellow-300 text-sm mt-1">KCS</p>
        {user && <p className="text-gray-400 text-xs mt-1">{user.full_name || user.email}</p>}
      </div>

      {successMsg && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="bg-green-100 border border-green-400 text-green-800 rounded p-3 text-center font-medium">
            ✅ {successMsg}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2 bg-white rounded shadow p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold transition-colors ${
                activeTab === tab.id ? "bg-gray-800 text-yellow-400" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">

        {/* SHIFT FORM */}
        {activeTab === "shift" && (
          <form onSubmit={handleSubmitShift} className="space-y-4">
            <div className="bg-white rounded shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Submit a Shift</h2>
              <p className="text-sm text-gray-500">Your shift will be reviewed and approved by chief of staff.</p>
            </div>

            <div className="bg-white rounded shadow p-5">
              <Label className="text-base font-medium text-gray-800">Client / Household <span className="text-red-500">*</span></Label>
              <div className="mt-3">
                <Select value={shiftForm.household_id} onValueChange={v => setShiftForm(p => ({ ...p, household_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select household..." /></SelectTrigger>
                  <SelectContent>
                    {households.map(h => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}{h.household_code ? ` (${h.household_code.slice(0, 4)})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-white rounded shadow p-5">
              <Label className="text-base font-medium text-gray-800">Shift Start <span className="text-red-500">*</span></Label>
              <div className="flex gap-4 mt-3">
                <div className="flex-1"><p className="text-xs text-gray-500 mb-1">Date</p>
                  <Input type="date" value={shiftForm.start_date} onChange={e => setShiftForm(p => ({ ...p, start_date: e.target.value }))} required className="text-yellow-600" /></div>
                <div className="flex-1"><p className="text-xs text-gray-500 mb-1">Time</p>
                  <Input type="time" value={shiftForm.start_time} onChange={e => setShiftForm(p => ({ ...p, start_time: e.target.value }))} required className="text-yellow-600" /></div>
              </div>
            </div>

            <div className="bg-white rounded shadow p-5">
              <Label className="text-base font-medium text-gray-800">Shift End</Label>
              <div className="flex gap-4 mt-3">
                <div className="flex-1"><p className="text-xs text-gray-500 mb-1">Date</p>
                  <Input type="date" value={shiftForm.end_date} onChange={e => setShiftForm(p => ({ ...p, end_date: e.target.value }))} className="text-yellow-600" /></div>
                <div className="flex-1"><p className="text-xs text-gray-500 mb-1">Time</p>
                  <Input type="time" value={shiftForm.end_time} onChange={e => setShiftForm(p => ({ ...p, end_time: e.target.value }))} className="text-yellow-600" /></div>
              </div>
            </div>

            <div className="bg-white rounded shadow p-5">
              <Label className="text-base font-medium text-gray-800">Comment / הערות</Label>
              <Textarea className="mt-3 resize-none" placeholder="Optional notes..." value={shiftForm.comment} onChange={e => setShiftForm(p => ({ ...p, comment: e.target.value }))} rows={2} />
            </div>

            <div className="flex items-center justify-between py-2">
              <Button type="submit" disabled={isSubmitting} className="bg-gray-800 hover:bg-gray-700 text-white px-8">
                {isSubmitting ? "Submitting..." : "Submit Shift"}
              </Button>
            </div>
          </form>
        )}

        {/* EXPENSE FORM */}
        {activeTab === "expense" && (
          <form onSubmit={handleSubmitExpense} className="space-y-4">
            <div className="bg-white rounded shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Submit an Expense</h2>
              <p className="text-sm text-gray-500">Expenses will be reviewed and approved by chief of staff.</p>
            </div>

            <div className="bg-white rounded shadow p-5">
              <Label className="text-base font-medium text-gray-800">Client / Household <span className="text-red-500">*</span></Label>
              <div className="mt-3">
                <Select value={expenseForm.household_id} onValueChange={v => setExpenseForm(p => ({ ...p, household_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select household..." /></SelectTrigger>
                  <SelectContent>
                    {households.map(h => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-white rounded shadow p-5 space-y-4">
              <div>
                <Label className="text-base font-medium text-gray-800">Amount (₪) <span className="text-red-500">*</span></Label>
                <Input type="number" step="0.01" className="mt-2" placeholder="0.00" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div>
                <Label className="text-base font-medium text-gray-800">Date <span className="text-red-500">*</span></Label>
                <Input type="date" className="mt-2" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} required />
              </div>
              <div>
                <Label className="text-base font-medium text-gray-800">Description <span className="text-red-500">*</span></Label>
                <Textarea className="mt-2 resize-none" placeholder="What was this expense for?" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} rows={2} required />
              </div>
              <div>
                <Label className="text-base font-medium text-gray-800">Receipt (optional)</Label>
                <div className="mt-2 flex items-center gap-3">
                  {expenseForm.receipt_url ? (
                    <a href={expenseForm.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">View Receipt</a>
                  ) : null}
                  <label className="cursor-pointer">
                    <span className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-md transition-colors flex items-center gap-1">
                      <Upload className="w-4 h-4" />
                      {isUploadingReceipt ? "Uploading..." : "Upload Receipt"}
                    </span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadReceipt} disabled={isUploadingReceipt} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Button type="submit" disabled={isSubmitting || isUploadingReceipt} className="bg-gray-800 hover:bg-gray-700 text-white px-8">
                {isSubmitting ? "Submitting..." : "Submit Expense"}
              </Button>
            </div>
          </form>
        )}

        {/* SUMMARY */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            {/* Totals */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded shadow p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Approved Hours</p>
                <p className="text-2xl font-bold text-yellow-600">{totalApprovedHours.toFixed(1)}</p>
              </div>
              <div className="bg-white rounded shadow p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Shift Pay</p>
                <p className="text-2xl font-bold text-green-600">₪{totalApprovedPay.toFixed(0)}</p>
              </div>
              <div className="bg-white rounded shadow p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Expenses</p>
                <p className="text-2xl font-bold text-blue-600">₪{totalApprovedExpenses.toFixed(0)}</p>
              </div>
            </div>

            {/* Shifts */}
            <div className="bg-white rounded shadow p-5">
              <h3 className="font-semibold text-gray-800 mb-3">My Shifts ({myShifts.length})</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {myShifts.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No shifts yet</p>}
                {myShifts.map(shift => {
                  const hours = calcHours(shift.start_date_time, shift.done_date_time);
                  return (
                    <div key={shift.id} className="border rounded p-3 text-sm flex justify-between items-start">
                      <div>
                        <p className="font-medium">{getHouseholdName(shift.household_id)}</p>
                        <p className="text-gray-500">{format(new Date(shift.start_date_time), "MMM d, yyyy")} · {shift.job}</p>
                        {shift.done_date_time && <p className="text-gray-500">{hours.toFixed(1)} hrs @ ₪{shift.price_per_hour}/hr</p>}
                        {shift.comment && <p className="text-gray-400 italic text-xs mt-1">{shift.comment}</p>}
                      </div>
                      <Badge className={shift.is_approved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                        {shift.is_approved ? <><CheckCircle className="w-3 h-3 inline mr-1" />Approved</> : "Pending"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-white rounded shadow p-5">
              <h3 className="font-semibold text-gray-800 mb-3">My Expenses ({myExpenses.length})</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {myExpenses.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No expenses yet</p>}
                {myExpenses.map(expense => (
                  <div key={expense.id} className="border rounded p-3 text-sm flex justify-between items-start">
                    <div>
                      <p className="font-medium">₪{expense.amount} — {expense.description}</p>
                      <p className="text-gray-500">{getHouseholdName(expense.household_id)} · {expense.date}</p>
                      {expense.receipt_url && <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs underline">View receipt</a>}
                    </div>
                    <Badge className={expense.is_approved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {expense.is_approved ? <><CheckCircle className="w-3 h-3 inline mr-1" />Approved</> : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}