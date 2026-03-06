import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Shift, Expense, HouseholdStaff, Household } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, BarChart2, CheckCircle, LogIn, LogOut, Upload, Home, Calendar, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/components/i18n/LanguageContext";

const translations = {
  English: {
    title: "Staff Portal", subtitle: "KCS",
    tabs: { clock: "Clock In/Out", shift: "Log Shift", expense: "Expense", summary: "Summary" },
    clock: { selectHousehold: "Select Household", placeholder: "Which household are you working at?", clockedInAt: "Clocked in at", clockIn: "Clock In", clockOut: "Clock Out", clockingIn: "Clocking in...", clockingOut: "Clocking out...", notClockedIn: "Not clocked in", tapToClock: "Tap below when you start your shift", recentShifts: "Recent Shifts", inProgress: "In progress", success: "Shift clocked out! Pending approval." },
    shift: { title: "Log a Past Shift", subtitle: "Use this to record shifts after the fact.", household: "Household", startDate: "Start Date", startTime: "Start Time", endDate: "End Date", endTime: "End Time", duration: "Duration", hours: "hours", notes: "Notes (optional)", notesPlaceholder: "Any notes about this shift...", submit: "Submit Shift", submitting: "Submitting...", success: "Shift submitted! Pending approval." },
    expense: { title: "Submit an Expense", subtitle: "Receipts will be reviewed by chief of staff.", household: "Household", amount: "Amount (₪)", date: "Date", description: "Description", descriptionPlaceholder: "What was this expense for?", receipt: "Receipt", receiptUploaded: "Receipt uploaded", view: "View", uploadReceipt: "Tap to upload receipt", uploading: "Uploading...", submit: "Submit Expense", submitting: "Submitting...", success: "Expense submitted! Pending approval." },
    summary: { approvedHours: "Approved hrs", shiftPay: "Shift pay", expenses: "Expenses", shifts: "Shifts", total: "total", pending: "Pending", approved: "Approved", noShifts: "No shifts yet", noExpenses: "No expenses yet", viewReceipt: "View receipt" },
    selectPlaceholder: "Select household...", required: "*", pending: "pending",
  },
  Hebrew: {
    title: "פורטל צוות", subtitle: "KCS",
    tabs: { clock: "כניסה/יציאה", shift: "דיווח משמרת", expense: "הוצאה", summary: "סיכום" },
    clock: { selectHousehold: "בחר לקוח", placeholder: "באיזה לקוח אתה עובד?", clockedInAt: "נכנסת אצל", clockIn: "כניסה", clockOut: "יציאה", clockingIn: "מתחבר...", clockingOut: "מנותק...", notClockedIn: "לא מחובר", tapToClock: "לחץ כאן כשמשמרתך מתחילה", recentShifts: "משמרות אחרונות", inProgress: "בתהליך", success: "המשמרת הסתיימה! ממתין לאישור." },
    shift: { title: "דיווח משמרת ידני", subtitle: "להוסיף משמרת שעברה.", household: "לקוח", startDate: "תאריך התחלה", startTime: "שעת התחלה", endDate: "תאריך סיום", endTime: "שעת סיום", duration: "משך", hours: "שעות", notes: "הערות (אופציונלי)", notesPlaceholder: "הערות על המשמרת...", submit: "שלח משמרת", submitting: "שולח...", success: "המשמרת נשלחה! ממתין לאישור." },
    expense: { title: "דיווח הוצאה", subtitle: "הוצאות יבדקו על ידי ראש הצוות.", household: "לקוח", amount: "סכום (₪)", date: "תאריך", description: "תיאור", descriptionPlaceholder: "על מה ההוצאה?", receipt: "קבלה", receiptUploaded: "קבלה הועלתה", view: "צפה", uploadReceipt: "לחץ להעלות קבלה", uploading: "מעלה...", submit: "שלח הוצאה", submitting: "שולח...", success: "ההוצאה נשלחה! ממתין לאישור." },
    summary: { approvedHours: "שעות מאושרות", shiftPay: "תשלום משמרות", expenses: "הוצאות", shifts: "משמרות", total: "סה\"כ", pending: "ממתין", approved: "אושר", noShifts: "אין משמרות עדיין", noExpenses: "אין הוצאות עדיין", viewReceipt: "צפה בקבלה" },
    selectPlaceholder: "בחר לקוח...", required: "*", pending: "ממתין",
  }
};

export default function StaffPortal() {
  const { language } = useLanguage();
  const s = translations[language] || translations.English;
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [myExpenses, setMyExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState("clock");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // Clock-in/out state
  const [clockedInShift, setClockedInShift] = useState(null); // active shift being tracked
  const [clockHousehold, setClockHousehold] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Manual shift form
  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);
  const [shiftForm, setShiftForm] = useState({
    start_date: today, start_time: "08:00",
    end_date: today, end_time: "16:00",
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
          if (allHouseholds.length === 1) {
            setClockHousehold(allHouseholds[0].id);
            setShiftForm(p => ({ ...p, household_id: allHouseholds[0].id }));
            setExpenseForm(p => ({ ...p, household_id: allHouseholds[0].id }));
          }
        }
        const [shiftsData, expensesData] = await Promise.all([
          Shift.filter({ user_id: currentUser.id }),
          Expense.filter({ user_id: currentUser.id })
        ]);
        const sorted = shiftsData.sort((a, b) => new Date(b.start_date_time) - new Date(a.start_date_time));
        setMyShifts(sorted);
        setMyExpenses(expensesData.sort((a, b) => new Date(b.date) - new Date(a.date)));

        // Check for any open shift (clocked in but no end time) stored locally
        const savedClock = localStorage.getItem("kcs_active_shift");
        if (savedClock) {
          const parsed = JSON.parse(savedClock);
          // Validate it's this user
          if (parsed.user_id === currentUser.id) {
            setClockedInShift(parsed);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Live timer for clocked-in shift
  useEffect(() => {
    if (clockedInShift) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - new Date(clockedInShift.start_date_time).getTime());
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => clearInterval(timerRef.current);
  }, [clockedInShift]);

  const formatElapsed = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleClockIn = async () => {
    if (!clockHousehold) { alert("Please select a household first."); return; }
    setIsSubmitting(true);
    const assignment = assignments.find(a => a.household_id === clockHousehold);
    const newShift = await Shift.create({
      user_id: user.id,
      household_id: clockHousehold,
      job: assignment?.job_role || "other",
      price_per_hour: assignment?.price_per_hour || 0,
      start_date_time: new Date().toISOString(),
      is_approved: false
    });
    setClockedInShift(newShift);
    localStorage.setItem("kcs_active_shift", JSON.stringify(newShift));
    setMyShifts(prev => [newShift, ...prev]);
    setIsSubmitting(false);
  };

  const handleClockOut = async () => {
    if (!clockedInShift) return;
    setIsSubmitting(true);
    const updated = await Shift.update(clockedInShift.id, { done_date_time: new Date().toISOString() });
    setClockedInShift(null);
    localStorage.removeItem("kcs_active_shift");
    setMyShifts(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSuccessMsg(s.clock.success);
    setTimeout(() => setSuccessMsg(""), 4000);
    setIsSubmitting(false);
  };

  const handleSubmitShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.household_id || !shiftForm.start_date || !shiftForm.start_time) {
      alert("Please fill in all required fields."); return;
    }
    setIsSubmitting(true);
    const startDateTime = new Date(`${shiftForm.start_date}T${shiftForm.start_time}`).toISOString();
    const endDateTime = shiftForm.end_date && shiftForm.end_time
      ? new Date(`${shiftForm.end_date}T${shiftForm.end_time}`).toISOString() : null;
    const assignment = assignments.find(a => a.household_id === shiftForm.household_id);
    const newShift = await Shift.create({
      user_id: user.id, household_id: shiftForm.household_id,
      job: assignment?.job_role || "other", price_per_hour: assignment?.price_per_hour || 0,
      start_date_time: startDateTime,
      ...(endDateTime && { done_date_time: endDateTime }),
      ...(shiftForm.comment && { comment: shiftForm.comment }),
      is_approved: false
    });
    setMyShifts(prev => [newShift, ...prev]);
    setShiftForm({ start_date: today, start_time: "08:00", end_date: today, end_time: "16:00", household_id: shiftForm.household_id, comment: "" });
    setSuccessMsg(s.shift.success);
    setTimeout(() => setSuccessMsg(""), 4000);
    setIsSubmitting(false);
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
      alert("Please fill in all required fields."); return;
    }
    setIsSubmitting(true);
    const newExpense = await Expense.create({
      user_id: user.id, household_id: expenseForm.household_id,
      amount: parseFloat(expenseForm.amount), description: expenseForm.description,
      date: expenseForm.date, receipt_url: expenseForm.receipt_url || undefined, is_approved: false
    });
    setMyExpenses(prev => [newExpense, ...prev]);
    setExpenseForm({ household_id: expenseForm.household_id, amount: "", description: "", date: today, receipt_url: "" });
    setSuccessMsg(s.expense.success);
    setTimeout(() => setSuccessMsg(""), 4000);
    setIsSubmitting(false);
  };

  const calcHours = (start, end) => {
    if (!end) return 0;
    return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
  };

  const getHouseholdName = (id) => {
    const h = households.find(h => h.id === id);
    return h ? h.name : "—";
  };

  const totalApprovedHours = myShifts.filter(s => s.is_approved && s.done_date_time).reduce((sum, s) => sum + calcHours(s.start_date_time, s.done_date_time), 0);
  const totalApprovedPay = myShifts.filter(s => s.is_approved && s.done_date_time).reduce((sum, s) => sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0), 0);
  const totalApprovedExpenses = myExpenses.filter(e => e.is_approved).reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingShifts = myShifts.filter(s => !s.is_approved).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: "clock", label: s.tabs.clock, icon: LogIn },
    { id: "shift", label: s.tabs.shift, icon: Clock },
    { id: "expense", label: s.tabs.expense, icon: DollarSign },
    { id: "summary", label: s.tabs.summary, icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{s.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {user?.full_name || user?.email}
                {clockedInShift && (
                  <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
                    Clocked in
                  </span>
                )}
              </p>
            </div>
            {pendingShifts > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
              {pendingShifts} {s.pending}
            </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex bg-white rounded-xl shadow-sm border overflow-hidden">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-all ${
                i < tabs.length - 1 ? "border-r" : ""
              } ${
                activeTab === tab.id
                  ? "bg-green-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── CLOCK IN / OUT ── */}
        {activeTab === "clock" && (
          <div className="space-y-4">
            {/* Household picker */}
            {!clockedInShift && (
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">{s.clock.selectHousehold}</Label>
                <Select value={clockHousehold} onValueChange={setClockHousehold}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={s.clock.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {households.map(h => (
                      <SelectItem key={h.id} value={h.id}>
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-gray-400" />
                          {h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Clock widget */}
            <div className={`rounded-2xl border shadow-sm p-8 text-center transition-all ${clockedInShift ? "bg-green-50 border-green-200" : "bg-white"}`}>
              {clockedInShift ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-sm text-green-700 font-medium mb-1">{s.clock.clockedInAt} {getHouseholdName(clockedInShift.household_id)}</p>
                  <p className="text-xs text-gray-500 mb-4">{format(new Date(clockedInShift.start_date_time), "h:mm a · MMM d")}</p>
                  <div className="text-5xl font-mono font-bold text-green-700 mb-6 tabular-nums">
                    {formatElapsed(elapsed)}
                  </div>
                  <Button
                    onClick={handleClockOut}
                    disabled={isSubmitting}
                    className="bg-red-500 hover:bg-red-600 text-white px-10 h-12 text-base rounded-xl font-semibold"
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    {isSubmitting ? s.clock.clockingOut : s.clock.clockOut}
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 mb-1 font-medium">{s.clock.notClockedIn}</p>
                  <p className="text-sm text-gray-400 mb-6">{s.clock.tapToClock}</p>
                  <Button
                    onClick={handleClockIn}
                    disabled={isSubmitting || !clockHousehold}
                    className="bg-green-600 hover:bg-green-700 text-white px-10 h-12 text-base rounded-xl font-semibold disabled:opacity-40"
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    {isSubmitting ? s.clock.clockingIn : s.clock.clockIn}
                  </Button>
                </>
              )}
            </div>

            {/* Recent shifts mini-list */}
            {myShifts.length > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{s.clock.recentShifts}</h3>
                <div className="space-y-2">
                  {myShifts.slice(0, 3).map(shift => {
                    const hours = calcHours(shift.start_date_time, shift.done_date_time);
                    return (
                      <div key={shift.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{getHouseholdName(shift.household_id)}</p>
                          <p className="text-xs text-gray-400">{format(new Date(shift.start_date_time), "MMM d · h:mm a")}{shift.done_date_time ? ` — ${hours.toFixed(1)}h` : " · In progress"}</p>
                        </div>
                        <Badge className={shift.is_approved ? "bg-green-100 text-green-700 text-xs" : "bg-amber-50 text-amber-700 text-xs border border-amber-200"}>
                          {shift.is_approved ? "Approved" : "Pending"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LOG SHIFT MANUALLY ── */}
        {activeTab === "shift" && (
          <form onSubmit={handleSubmitShift} className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-0.5">{s.shift.title}</h2>
              <p className="text-sm text-gray-400">{s.shift.subtitle}</p>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">{s.shift.household} <span className="text-red-400">{s.required}</span></Label>
                <Select value={shiftForm.household_id} onValueChange={v => setShiftForm(p => ({ ...p, household_id: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={s.selectPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {households.map(h => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.shift.startDate} <span className="text-red-400">{s.required}</span></Label>
                  <Input type="date" value={shiftForm.start_date} onChange={e => setShiftForm(p => ({ ...p, start_date: e.target.value }))} required className="h-11" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.shift.startTime} <span className="text-red-400">{s.required}</span></Label>
                  <Input type="time" value={shiftForm.start_time} onChange={e => setShiftForm(p => ({ ...p, start_time: e.target.value }))} required className="h-11" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.shift.endDate}</Label>
                  <Input type="date" value={shiftForm.end_date} onChange={e => setShiftForm(p => ({ ...p, end_date: e.target.value }))} className="h-11" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.shift.endTime}</Label>
                  <Input type="time" value={shiftForm.end_time} onChange={e => setShiftForm(p => ({ ...p, end_time: e.target.value }))} className="h-11" />
                </div>
              </div>

              {shiftForm.start_time && shiftForm.end_time && shiftForm.start_date && shiftForm.end_date && (
                <div className="bg-green-50 rounded-lg p-3 text-center text-sm text-green-700 font-medium">
                  {s.shift.duration}: {calcHours(`${shiftForm.start_date}T${shiftForm.start_time}`, `${shiftForm.end_date}T${shiftForm.end_time}`).toFixed(1)} {s.shift.hours}
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.shift.notes}</Label>
                <Textarea className="resize-none" placeholder={s.shift.notesPlaceholder} value={shiftForm.comment} onChange={e => setShiftForm(p => ({ ...p, comment: e.target.value }))} rows={2} />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl text-base font-semibold">
              {isSubmitting ? s.shift.submitting : s.shift.submit}
            </Button>
          </form>
        )}

        {/* ── EXPENSE ── */}
        {activeTab === "expense" && (
          <form onSubmit={handleSubmitExpense} className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-0.5">{s.expense.title}</h2>
              <p className="text-sm text-gray-400">{s.expense.subtitle}</p>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">{s.expense.household} <span className="text-red-400">{s.required}</span></Label>
                <Select value={expenseForm.household_id} onValueChange={v => setExpenseForm(p => ({ ...p, household_id: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={s.selectPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {households.map(h => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.expense.amount} <span className="text-red-400">{s.required}</span></Label>
                  <Input type="number" step="0.01" className="h-11 text-lg font-semibold" placeholder="0.00" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.expense.date} <span className="text-red-400">{s.required}</span></Label>
                  <Input type="date" className="h-11" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{s.expense.description} <span className="text-red-400">{s.required}</span></Label>
                <Textarea className="resize-none" placeholder={s.expense.descriptionPlaceholder} value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} rows={2} required />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">{s.expense.receipt}</Label>
                <label className={`flex items-center justify-center gap-3 w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${expenseForm.receipt_url ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-300 hover:bg-gray-50"}`}>
                  {expenseForm.receipt_url ? (
                    <div className="text-center">
                      <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-green-700 font-medium">{s.expense.receiptUploaded}</p>
                      <a href={expenseForm.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline" onClick={e => e.stopPropagation()}>{s.expense.view}</a>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">{isUploadingReceipt ? s.expense.uploading : s.expense.uploadReceipt}</p>
                    </div>
                  )}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadReceipt} disabled={isUploadingReceipt} />
                </label>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting || isUploadingReceipt} className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl text-base font-semibold">
              {isSubmitting ? s.expense.submitting : s.expense.submit}
            </Button>
          </form>
        )}

        {/* ── SUMMARY ── */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
                <Clock className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">{totalApprovedHours.toFixed(1)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.summary.approvedHours}</p>
              </div>
              <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
                <Briefcase className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">₪{totalApprovedPay.toFixed(0)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.summary.shiftPay}</p>
              </div>
              <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
                <DollarSign className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">₪{totalApprovedExpenses.toFixed(0)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.summary.expenses}</p>
              </div>
            </div>

            {/* Shifts list */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{s.summary.shifts}</h3>
                <span className="text-xs text-gray-400">{myShifts.length} {s.summary.total}</span>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {myShifts.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{s.summary.noShifts}</p>}
                {myShifts.map(shift => {
                  const hours = calcHours(shift.start_date_time, shift.done_date_time);
                  return (
                    <div key={shift.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{getHouseholdName(shift.household_id)}</p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(shift.start_date_time), "MMM d, yyyy")}
                          {shift.done_date_time ? ` · ${hours.toFixed(1)}h` : ` · ${s.clock.inProgress}`}
                        </p>
                        {shift.comment && <p className="text-xs text-gray-400 italic">{shift.comment}</p>}
                      </div>
                      <Badge className={shift.is_approved ? "bg-green-100 text-green-700 border border-green-200 text-xs" : "bg-amber-50 text-amber-700 border border-amber-200 text-xs"}>
                        {shift.is_approved ? `✓ ${s.summary.approved}` : s.summary.pending}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expenses list */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{s.summary.expenses}</h3>
                <span className="text-xs text-gray-400">{myExpenses.length} {s.summary.total}</span>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {myExpenses.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{s.summary.noExpenses}</p>}
                {myExpenses.map(expense => (
                  <div key={expense.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">₪{expense.amount} — {expense.description}</p>
                      <p className="text-xs text-gray-400">{getHouseholdName(expense.household_id)} · {expense.date}</p>
                      {expense.receipt_url && <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">{s.summary.viewReceipt}</a>}
                    </div>
                    <Badge className={expense.is_approved ? "bg-green-100 text-green-700 border border-green-200 text-xs" : "bg-amber-50 text-amber-700 border border-amber-200 text-xs"}>
                      {expense.is_approved ? "✓ Approved" : "Pending"}
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