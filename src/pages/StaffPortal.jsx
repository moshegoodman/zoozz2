import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Shift, Expense, HouseholdStaff, Household, AppSettings } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, BarChart2, CheckCircle, LogIn, LogOut, Upload, Home, Calendar, Briefcase, Wallet, Send, TrendingDown, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/components/i18n/LanguageContext";

const translations = {
  English: {
    title: "Staff Portal", subtitle: "KCS",
    tabs: { clock: "Clock In/Out", shift: "Log Shift", expense: "Expense", summary: "Summary", pay: "Pay Staff" },
    clock: { selectHousehold: "Select Household", placeholder: "Which household are you working at?", clockedInAt: "Clocked in at", clockIn: "Clock In", clockOut: "Clock Out", clockingIn: "Clocking in...", clockingOut: "Clocking out...", notClockedIn: "Not clocked in", tapToClock: "Tap below when you start your shift", recentShifts: "Recent Shifts", inProgress: "In progress", success: "Shift clocked out! Pending approval." },
    shift: { title: "Log a Past Shift", subtitle: "Use this to record shifts after the fact.", household: "Household", startDate: "Start Date", startTime: "Start Time", endDate: "End Date", endTime: "End Time", duration: "Duration", hours: "hours", notes: "Notes (optional)", notesPlaceholder: "Any notes about this shift...", submit: "Submit Shift", submitting: "Submitting...", success: "Shift submitted! Pending approval." },
    expense: { title: "Submit an Expense", subtitle: "Receipts will be reviewed by chief of staff.", household: "Household", amount: "Amount (₪)", date: "Date", description: "Description", descriptionPlaceholder: "What was this expense for?", paidBy: "Paid By", paidByPlaceholder: "Who paid for this?", receipt: "Receipt", receiptUploaded: "Receipt uploaded", view: "View", uploadReceipt: "Tap to upload receipt", uploading: "Uploading...", submit: "Submit Expense", submitting: "Submitting...", success: "Expense submitted! Pending approval." },
    summary: { approvedHours: "Approved hrs", shiftPay: "Shift pay", expenses: "Reimbursable Expenses", shifts: "Shifts", total: "total", pending: "Pending", approved: "Approved", noShifts: "No shifts yet", noExpenses: "No expenses yet", viewReceipt: "View receipt" },
    selectPlaceholder: "Select household...", required: "*", pending: "pending",
  },
  Hebrew: {
    title: "פורטל צוות", subtitle: "KCS",
    tabs: { clock: "כניסה/יציאה", shift: "דיווח משמרת", expense: "הוצאה", summary: "סיכום", pay: "תשלום לצוות" },
    clock: { selectHousehold: "בחר לקוח", placeholder: "באיזה לקוח אתה עובד?", clockedInAt: "נכנסת אצל", clockIn: "כניסה", clockOut: "יציאה", clockingIn: "מתחבר...", clockingOut: "מנותק...", notClockedIn: "לא מחובר", tapToClock: "לחץ כאן כשמשמרתך מתחילה", recentShifts: "משמרות אחרונות", inProgress: "בתהליך", success: "המשמרת הסתיימה! ממתין לאישור." },
    shift: { title: "דיווח משמרת ידני", subtitle: "להוסיף משמרת שעברה.", household: "לקוח", startDate: "תאריך התחלה", startTime: "שעת התחלה", endDate: "תאריך סיום", endTime: "שעת סיום", duration: "משך", hours: "שעות", notes: "הערות (אופציונלי)", notesPlaceholder: "הערות על המשמרת...", submit: "שלח משמרת", submitting: "שולח...", success: "המשמרת נשלחה! ממתין לאישור." },
    expense: { title: "דיווח הוצאה", subtitle: "הוצאות יבדקו על ידי ראש הצוות.", household: "לקוח", amount: "סכום (₪)", date: "תאריך", description: "תיאור", descriptionPlaceholder: "על מה ההוצאה?", paidBy: "מי שילם", paidByPlaceholder: "מי שילם עבור הוצאה זו?", receipt: "קבלה", receiptUploaded: "קבלה הועלתה", view: "צפה", uploadReceipt: "לחץ להעלות קבלה", uploading: "מעלה...", submit: "שלח הוצאה", submitting: "שולח...", success: "ההוצאה נשלחה! ממתין לאישור." },
    summary: { approvedHours: "שעות מאושרות", shiftPay: "תשלום משמרות", expenses: "הוצאות להחזר", shifts: "משמרות", total: "סה\"כ", pending: "ממתין", approved: "אושר", noShifts: "אין משמרות עדיין", noExpenses: "אין הוצאות עדיין", viewReceipt: "צפה בקבלה" },
    selectPlaceholder: "בחר לקוח...", required: "*", pending: "ממתין",
  }
};

const PAID_BY_OPTIONS = [
  "KCS Cash", "KCS CC 1234", "Meir CC 2222", "Meir CC 1111",
  "Avi CC 3140", "Avi CC 5023", "Avi CC 7923",
  "Chaim CC 4602", "Chaim CC 7030", "Simcha CC 8277",
  "KCS Bank Transfer", "Client CC", "Staff member CC", "Staff member Cash"
];

const STAFF_PAID_OPTIONS = ["Staff member CC", "Staff member Cash"];

export default function StaffPortal() {
  const { language } = useLanguage();
  const s = translations[language] || translations.English;
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [myExpenses, setMyExpenses] = useState([]);
  const [myPayments, setMyPayments] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [allHouseholds, setAllHouseholds] = useState([]);
  const [selectedSummarySeasons, setSelectedSummarySeasons] = useState(null);
  const [activeTab, setActiveTab] = useState("clock");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // Clock-in/out state
  const [clockedInShift, setClockedInShift] = useState(null);
  const [clockHousehold, setClockHousehold] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Manual shift form
  const today = new Date().toISOString().split("T")[0];
  const [shiftForm, setShiftForm] = useState({
    start_date: today, start_time: "08:00",
    end_date: today, end_time: "16:00",
    household_id: "", comment: ""
  });

  const [expenseForm, setExpenseForm] = useState({
    household_id: "", amount: "", description: "", date: today, receipt_url: "", paid_by: ""
  });

  const [allStaffUsers, setAllStaffUsers] = useState([]);
  const [payForm, setPayForm] = useState({ recipient_user_id: "", amount: "", notes: "", payment_date: today, payment_method: "cash" });

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        const [staffAssignments, settingsData] = await Promise.all([
          HouseholdStaff.filter({ staff_user_id: currentUser.id }),
          AppSettings.list()
        ]);
        const season = settingsData?.[0]?.activeSeason || null;
        setActiveSeason(season);
        setAssignments(staffAssignments);
        if (staffAssignments.length > 0) {
          const householdIds = staffAssignments.map(a => a.household_id);
          const allHouseholds = await Household.filter({ id: { $in: householdIds } });
          setAllHouseholds(allHouseholds);
          const filtered = season
            ? allHouseholds.filter(h => h.season === season)
            : allHouseholds;
          setHouseholds(filtered);
          if (filtered.length === 1) {
            setClockHousehold(filtered[0].id);
            setShiftForm(p => ({ ...p, household_id: filtered[0].id }));
            setExpenseForm(p => ({ ...p, household_id: filtered[0].id }));
          }
        }
        const [shiftsData, expensesData, paymentsData] = await Promise.all([
          Shift.filter({ user_id: currentUser.id }),
          Expense.filter({ user_id: currentUser.id }),
          base44.entities.KCSPayment.filter({ employee_user_id: currentUser.id })
        ]);
        const sorted = shiftsData.sort((a, b) => new Date(b.start_date_time) - new Date(a.start_date_time));
        setMyShifts(sorted);
        setMyExpenses(expensesData.sort((a, b) => new Date(b.date) - new Date(a.date)));
        setMyPayments(paymentsData.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)));

        if (currentUser.can_pay_staff) {
          const staffUsers = await base44.entities.User.filter({ user_type: "kcs staff" });
          setAllStaffUsers(staffUsers.filter(u => u.id !== currentUser.id));
          const payerLabel = currentUser.full_name || currentUser.email;
          setPayForm(p => ({ ...p, notes: `Cash transfer made by ${payerLabel}` }));
        }

        const savedClock = localStorage.getItem("kcs_active_shift");
        if (savedClock) {
          const parsed = JSON.parse(savedClock);
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
    const sec = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleClockIn = async () => {
    if (!clockHousehold) { alert("Please select a household first."); return; }
    setIsSubmitting(true);
    const assignment = assignments.find(a => a.household_id === clockHousehold);
    const isDaily = assignment?.payment_type === 'daily';
    const newShift = await Shift.create({
      user_id: user.id,
      household_id: clockHousehold,
      job: assignment?.job_role || "other",
      payment_type: assignment?.payment_type || 'hourly',
      price_per_hour: !isDaily ? (assignment?.price_per_hour || 0) : 0,
      price_per_day: isDaily ? (assignment?.price_per_day || 0) : 0,
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
    setMyShifts(prev => prev.map(sh => sh.id === updated.id ? updated : sh));
    setSuccessMsg(s.clock.success);
    setTimeout(() => setSuccessMsg(""), 4000);
    setIsSubmitting(false);
  };

  const shiftAssignment = assignments.find(a => a.household_id === shiftForm.household_id);
  const isShiftDaily = shiftAssignment?.payment_type === 'daily';

  const handleSubmitShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.household_id || !shiftForm.start_date || !shiftForm.start_time) {
      alert("Please fill in all required fields."); return;
    }
    if (!isShiftDaily && (!shiftForm.end_date || !shiftForm.end_time)) {
      alert("Please enter your shift end time."); return;
    }
    setIsSubmitting(true);
    const startDateTime = new Date(`${shiftForm.start_date}T${shiftForm.start_time}`).toISOString();
    const endDateTime = !isShiftDaily && shiftForm.end_date && shiftForm.end_time
      ? new Date(`${shiftForm.end_date}T${shiftForm.end_time}`).toISOString() : null;
    const assignment = shiftAssignment;
    const newShift = await Shift.create({
      user_id: user.id, household_id: shiftForm.household_id,
      job: assignment?.job_role || "other",
      payment_type: assignment?.payment_type || 'hourly',
      price_per_hour: !isShiftDaily ? (assignment?.price_per_hour || 0) : 0,
      price_per_day: isShiftDaily ? (assignment?.price_per_day || 0) : 0,
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
    if (!expenseForm.household_id || !expenseForm.amount || !expenseForm.description || !expenseForm.paid_by) {
      alert("Please fill in all required fields."); return;
    }
    setIsSubmitting(true);
    const newExpense = await Expense.create({
      user_id: user.id, household_id: expenseForm.household_id,
      amount: parseFloat(expenseForm.amount), description: expenseForm.description,
      date: expenseForm.date, receipt_url: expenseForm.receipt_url || undefined,
      paid_by: expenseForm.paid_by, is_approved: false
    });
    setMyExpenses(prev => [newExpense, ...prev]);
    setExpenseForm({ household_id: expenseForm.household_id, amount: "", description: "", date: today, receipt_url: "", paid_by: "" });
    setSuccessMsg(s.expense.success);
    setTimeout(() => setSuccessMsg(""), 4000);
    setIsSubmitting(false);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!payForm.recipient_user_id || !payForm.amount) {
      alert("Please fill in all required fields."); return;
    }
    setIsSubmitting(true);
    const recipient = allStaffUsers.find(u => u.id === payForm.recipient_user_id);
    await base44.entities.KCSPayment.create({
      employee_user_id: payForm.recipient_user_id,
      employee_name: recipient?.full_name || recipient?.email || "",
      amount: parseFloat(payForm.amount),
      currency: "ILS",
      payment_date: payForm.payment_date,
      payment_method: "cash",
      notes: payForm.notes,
      is_confirmed: false
    });
    const payerLabel = user?.full_name || user?.email;
    setPayForm({ recipient_user_id: "", amount: "", notes: `Cash transfer made by ${payerLabel}`, payment_date: today, payment_method: "cash" });
    setSuccessMsg(language === 'Hebrew' ? "תשלום נרשם בהצלחה!" : "Payment recorded successfully!");
    setTimeout(() => setSuccessMsg(""), 4000);
    setIsSubmitting(false);
  };

  const calcHours = (start, end) => {
    if (!end) return 0;
    return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
  };

  const getHouseholdName = (id) => {
    const h = households.find(h => h.id === id) || allHouseholds.find(h => h.id === id);
    return h ? h.name : "—";
  };

  const allSeasons = [...new Set(allHouseholds.map(h => h.season).filter(Boolean))].sort();
  const displaySeason = selectedSummarySeasons ?? activeSeason;

  const summaryHouseholdIds = displaySeason
    ? allHouseholds.filter(h => h.season === displaySeason).map(h => h.id)
    : allHouseholds.map(h => h.id);

  const summaryShifts = myShifts.filter(s => summaryHouseholdIds.includes(s.household_id));
  const summaryExpenses = myExpenses.filter(e => summaryHouseholdIds.includes(e.household_id));

  const totalApprovedHours = summaryShifts.filter(s => s.is_approved && s.done_date_time && s.payment_type !== 'daily').reduce((sum, s) => sum + calcHours(s.start_date_time, s.done_date_time), 0);
  const totalApprovedPay = summaryShifts.filter(s => s.is_approved).reduce((sum, s) => {
    if (s.payment_type === 'daily') return sum + (s.price_per_day || 0);
    if (s.done_date_time) return sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0);
    return sum;
  }, 0);
  // Only staff-paid (reimbursable) expenses count toward what KCS owes staff
  const totalApprovedExpenses = summaryExpenses.filter(e => e.is_approved && STAFF_PAID_OPTIONS.includes(e.paid_by)).reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPaid = myPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  // positive = KCS owes staff; negative = staff was overpaid (owes KCS)
  const balance = (totalApprovedPay + totalApprovedExpenses) - totalPaid;
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
    ...(user?.can_pay_staff ? [{ id: "pay", label: s.tabs.pay, icon: Send }] : []),
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
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">{s.expense.paidBy} <span className="text-red-400">{s.required}</span></Label>
                <Select value={expenseForm.paid_by} onValueChange={v => setExpenseForm(p => ({ ...p, paid_by: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={s.expense.paidByPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {PAID_BY_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {expenseForm.paid_by && STAFF_PAID_OPTIONS.includes(expenseForm.paid_by) && (
                  <p className="text-xs text-amber-600 mt-1.5 font-medium">✓ This expense will be reimbursed in your payroll.</p>
                )}
                {expenseForm.paid_by && !STAFF_PAID_OPTIONS.includes(expenseForm.paid_by) && (
                  <p className="text-xs text-gray-400 mt-1.5">This expense will NOT be added to your payroll (paid by KCS/Client).</p>
                )}
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

        {/* ── PAY STAFF ── */}
        {activeTab === "pay" && user?.can_pay_staff && (
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-0.5">{language === 'Hebrew' ? 'תשלום מזומן לעובד' : 'Pay a Staff Member'}</h2>
              <p className="text-sm text-gray-400">{language === 'Hebrew' ? 'רשום תשלום מזומן שנתת לעובד אחר.' : 'Record a cash payment you gave to another staff member.'}</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Send className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">{language === 'Hebrew' ? 'גישה זו הוקצתה לך זמנית על ידי מנהל.' : 'This access has been temporarily granted to you by an admin.'}</p>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  {language === 'Hebrew' ? 'עובד מקבל' : 'Recipient Staff Member'} <span className="text-red-400">*</span>
                </Label>
                <Select value={payForm.recipient_user_id} onValueChange={v => setPayForm(p => ({ ...p, recipient_user_id: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={language === 'Hebrew' ? 'בחר עובד...' : 'Select staff member...'} /></SelectTrigger>
                  <SelectContent>
                    {allStaffUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                    {language === 'Hebrew' ? 'סכום (₪)' : 'Amount (₪)'} <span className="text-red-400">*</span>
                  </Label>
                  <Input type="number" step="0.01" className="h-11 text-lg font-semibold" placeholder="0.00" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{language === 'Hebrew' ? 'תאריך' : 'Date'}</Label>
                  <Input type="date" className="h-11" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{language === 'Hebrew' ? 'הערות (אופציונלי)' : 'Notes (optional)'}</Label>
                <Textarea className="resize-none" placeholder={language === 'Hebrew' ? 'סיבת התשלום...' : 'Reason for payment...'} value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl text-base font-semibold">
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? (language === 'Hebrew' ? 'שולח...' : 'Submitting...') : (language === 'Hebrew' ? 'רשום תשלום' : 'Record Payment')}
            </Button>
          </form>
        )}

        {/* ── SUMMARY ── */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            {/* Season selector */}
            {allSeasons.length > 1 && (
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{language === 'Hebrew' ? 'עונה' : 'Season'}</p>
                <div className="flex flex-wrap gap-2">
                  {allSeasons.map(season => (
                    <button
                      key={season}
                      onClick={() => setSelectedSummarySeasons(season === displaySeason && season !== activeSeason ? activeSeason : season)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        displaySeason === season
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-green-400"
                      }`}
                    >
                      {season}
                      {season === activeSeason && <span className="ml-1 text-xs opacity-75">{language === 'Hebrew' ? '(נוכחי)' : '(current)'}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
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
              <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
                <Wallet className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">₪{totalPaid.toFixed(0)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{language === 'Hebrew' ? 'שולם' : 'Paid to You'}</p>
              </div>
            </div>

            {/* Balance card — clear who owes who */}
            {balance > 0 ? (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{language === 'Hebrew' ? 'KCS חייבת לך' : 'KCS owes you'}</p>
                    <p className="text-3xl font-bold text-amber-700">₪{balance.toFixed(0)}</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  {language === 'Hebrew'
                    ? `משמרות ₪${totalApprovedPay.toFixed(0)} + הוצאות ₪${totalApprovedExpenses.toFixed(0)} − שולם ₪${totalPaid.toFixed(0)}`
                    : `Shifts ₪${totalApprovedPay.toFixed(0)} + Expenses ₪${totalApprovedExpenses.toFixed(0)} − Paid ₪${totalPaid.toFixed(0)}`}
                </p>
              </div>
            ) : balance < 0 ? (
              <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-600">{language === 'Hebrew' ? 'אתה חייב ל-KCS' : 'You owe KCS'}</p>
                    <p className="text-3xl font-bold text-red-600">₪{Math.abs(balance).toFixed(0)}</p>
                  </div>
                </div>
                <p className="text-xs text-red-400 mt-1">
                  {language === 'Hebrew'
                    ? `שולם ₪${totalPaid.toFixed(0)} > משמרות ₪${totalApprovedPay.toFixed(0)} + הוצאות ₪${totalApprovedExpenses.toFixed(0)}`
                    : `Paid ₪${totalPaid.toFixed(0)} exceeds Shifts ₪${totalApprovedPay.toFixed(0)} + Expenses ₪${totalApprovedExpenses.toFixed(0)}`}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">{language === 'Hebrew' ? 'מאוזן' : 'All Settled'}</p>
                <p className="text-3xl font-bold text-green-700">₪0</p>
              </div>
            )}

            {/* Shifts list */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{s.summary.shifts}</h3>
                <span className="text-xs text-gray-400">{summaryShifts.length} {s.summary.total}</span>
              </div>
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {summaryShifts.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{s.summary.noShifts}</p>}
                {(() => {
                  const completedShifts = summaryShifts.filter(s => s.done_date_time);
                  const maxHours = completedShifts.length > 0 ? Math.max(...completedShifts.map(s => calcHours(s.start_date_time, s.done_date_time))) : 1;
                  return summaryShifts.map(shift => {
                    const hours = calcHours(shift.start_date_time, shift.done_date_time);
                    const pay = hours * (shift.price_per_hour || 0);
                    const barWidth = shift.done_date_time ? Math.max(4, (hours / maxHours) * 100) : 0;
                    return (
                      <div key={shift.id} className="px-5 py-3">
                        <div className="flex items-start justify-between mb-1.5">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{getHouseholdName(shift.household_id)}</p>
                            <p className="text-xs text-gray-400">
                              {format(new Date(shift.start_date_time), "MMM d, yyyy · h:mm a")}
                              {shift.done_date_time ? ` — ${format(new Date(shift.done_date_time), "h:mm a")}` : ""}
                            </p>
                            {shift.comment && <p className="text-xs text-gray-400 italic mt-0.5">{shift.comment}</p>}
                          </div>
                          <Badge className={shift.is_approved ? "bg-green-100 text-green-700 border border-green-200 text-xs shrink-0 ml-2" : "bg-amber-50 text-amber-700 border border-amber-200 text-xs shrink-0 ml-2"}>
                            {shift.is_approved ? `✓ ${s.summary.approved}` : s.summary.pending}
                          </Badge>
                        </div>
                        {shift.done_date_time ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-400 w-16 shrink-0">⏱ {hours.toFixed(1)}h</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${shift.is_approved ? "bg-green-500" : "bg-amber-400"}`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                            {shift.price_per_hour > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-16 shrink-0">💰 ₪{pay.toFixed(0)}</span>
                                <span className="text-xs text-gray-400">@ ₪{shift.price_per_hour}/hr</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-blue-500 font-medium">{s.clock.inProgress}</span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Payments received list */}
            {myPayments.length > 0 && (
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{language === 'Hebrew' ? 'תשלומים שהתקבלו' : 'Payments Received'}</h3>
                  <span className="text-xs text-gray-400">{myPayments.length} {s.summary.total}</span>
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {myPayments.map(payment => (
                    <div key={payment.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-700">₪{payment.amount?.toFixed(0)}</p>
                        <p className="text-xs text-gray-400">{payment.payment_date} · {(payment.payment_method || '').replace(/_/g, ' ')}</p>
                        {payment.notes && <p className="text-xs text-gray-400 italic">{payment.notes}</p>}
                      </div>
                      <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">✓ {language === 'Hebrew' ? 'שולם' : 'Paid'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses list */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{s.summary.expenses}</h3>
                <span className="text-xs text-gray-400">{summaryExpenses.length} {s.summary.total}</span>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {summaryExpenses.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{s.summary.noExpenses}</p>}
                {summaryExpenses.map(expense => (
                  <div key={expense.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">₪{expense.amount} — {expense.description}</p>
                      <p className="text-xs text-gray-400">{getHouseholdName(expense.household_id)} · {expense.date}</p>
                      {expense.paid_by && (
                        <p className={`text-xs font-medium mt-0.5 ${STAFF_PAID_OPTIONS.includes(expense.paid_by) ? "text-amber-600" : "text-gray-400"}`}>
                          {STAFF_PAID_OPTIONS.includes(expense.paid_by) ? "🔄 " : ""}{expense.paid_by}
                          {STAFF_PAID_OPTIONS.includes(expense.paid_by) ? " (reimbursable)" : ""}
                        </p>
                      )}
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