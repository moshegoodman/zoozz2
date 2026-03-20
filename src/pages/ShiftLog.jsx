import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shift, HouseholdStaff, Household } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Select kept for household dropdown
import { Textarea } from "@/components/ui/textarea";

export default function ShiftLog() {
    const [user, setUser] = useState(null);
    const [households, setHouseholds] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);

    const [assignments, setAssignments] = useState([]);
    const [form, setForm] = useState({
        start_date: today,
        start_time: nowTime,
        end_date: today,
        end_time: "",
        household_id: "",
        comment: ""
    });

    useEffect(() => {
        const load = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);

                // Load households this staff member is assigned to
                const staffAssignments = await HouseholdStaff.filter({ staff_user_id: currentUser.id });
                setAssignments(staffAssignments);
                if (staffAssignments.length > 0) {
                    const householdIds = staffAssignments.map(a => a.household_id);
                    const allHouseholds = await Household.filter({ id: { $in: householdIds } });
                    setHouseholds(allHouseholds);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // Determine if the selected household assignment is daily pay
    const selectedAssignment = assignments.find(a => a.household_id === form.household_id);
    const isDaily = selectedAssignment?.payment_type === 'daily';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.household_id || !form.start_date || !form.start_time) {
            alert("Please fill in all required fields.");
            return;
        }
        if (!isDaily && (!form.end_date || !form.end_time)) {
            alert("Please enter your shift end time.");
            return;
        }

        setIsSubmitting(true);
        try {
            const startDateTime = new Date(`${form.start_date}T${form.start_time}`).toISOString();
            const endDateTime = form.end_date && form.end_time
                ? new Date(`${form.end_date}T${form.end_time}`).toISOString()
                : null;

            // Auto-determine job role and price from HouseholdStaff assignment
            const assignment = assignments.find(a => a.household_id === form.household_id);
            const job = assignment?.job_role || 'other';
            const paymentType = assignment?.payment_type || 'hourly';
            const pricePerHour = assignment?.price_per_hour || 0;
            const pricePerDay = assignment?.price_per_day || 0;

            await Shift.create({
                user_id: user.id,
                household_id: form.household_id,
                job: job,
                payment_type: paymentType,
                price_per_hour: pricePerHour,
                price_per_day: pricePerDay,
                start_date_time: startDateTime,
                ...(endDateTime && { done_date_time: endDateTime }),
                ...(form.comment && { comment: form.comment })
            });

            setSubmitted(true);
        } catch (err) {
            console.error(err);
            alert("Failed to submit shift: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClear = () => {
        setForm({
            start_date: today,
            start_time: nowTime,
            end_date: today,
            end_time: "",
            household_id: "",
            comment: ""
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Shift Submitted!</h2>
                    <p className="text-gray-500 mb-6">Your response has been recorded.</p>
                    <Button onClick={() => { setSubmitted(false); handleClear(); }} className="bg-gray-800 hover:bg-gray-700 text-white">
                        Submit Another
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header banner */}
            <div className="bg-gray-800 text-center py-6 px-4">
                <h1 className="text-yellow-400 font-extrabold text-4xl tracking-wide uppercase">Staff Time Log</h1>
                <p className="text-yellow-300 text-sm mt-1">KCS</p>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Intro card */}
                <div className="bg-white rounded shadow mb-4 p-5 border-t-4 border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-800 mb-1">Staff Time Log</h2>
                    <p className="text-sm text-gray-600">Please fill out every day your hours besides in the time log in the booklet.</p>
                    <p className="text-sm text-gray-600 mt-1">נא למלאות את הטופס בנוסף לטופס שאצל השף</p>
                    {user && <p className="text-sm text-gray-500 mt-3">{user.email}</p>}
                    <p className="text-xs text-red-500 mt-2">* Indicates required question</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Shift Start */}
                    <div className="bg-white rounded shadow p-5">
                        <Label className="text-base font-medium text-gray-800">
                            Shift Start <span className="text-gray-500">תחילת משמרת</span> <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex gap-4 mt-3">
                            <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-1">Date</p>
                                <Input
                                    type="date"
                                    value={form.start_date}
                                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                                    required
                                    className="text-yellow-600"
                                />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-1">Time</p>
                                <Input
                                    type="time"
                                    value={form.start_time}
                                    onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                                    required
                                    className="text-yellow-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Shift End - hidden for daily pay */}
                    {!isDaily && (
                        <div className="bg-white rounded shadow p-5">
                            <Label className="text-base font-medium text-gray-800">
                                Shift ends <span className="text-gray-500">סוף משמרת</span> <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex gap-4 mt-3">
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 mb-1">Date</p>
                                    <Input
                                        type="date"
                                        value={form.end_date}
                                        onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                                        className="text-yellow-600"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 mb-1">Time</p>
                                    <Input
                                        type="time"
                                        value={form.end_time}
                                        onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                                        className="text-yellow-600"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {isDaily && (
                        <div className="bg-blue-50 rounded shadow p-4 border border-blue-200">
                            <p className="text-sm text-blue-700 font-medium">📅 Daily pay — no end time needed</p>
                            <p className="text-xs text-blue-600 mt-1">תשלום יומי — אין צורך לציין שעת סיום</p>
                        </div>
                    )}

                    {/* Household / Client */}
                    <div className="bg-white rounded shadow p-5">
                        <Label className="text-base font-medium text-gray-800">
                            Client <span className="text-gray-500">לקוח</span> <span className="text-red-500">*</span>
                        </Label>
                        <div className="mt-3">
                            {households.length > 0 ? (
                                <Select value={form.household_id} onValueChange={v => setForm(p => ({ ...p, household_id: v }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select household..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {households.map(h => (
                                            <SelectItem key={h.id} value={h.id}>
                                                {h.name} {h.name_hebrew ? `/ ${h.name_hebrew}` : ''} {h.household_code ? `(${h.household_code.slice(0, 4)})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    placeholder="Your answer"
                                    value={form.household_id}
                                    onChange={e => setForm(p => ({ ...p, household_id: e.target.value }))}
                                />
                            )}
                        </div>
                    </div>

                    {/* Comment */}
                    <div className="bg-white rounded shadow p-5">
                        <Label className="text-base font-medium text-gray-800">
                            Comment <span className="text-gray-500">הערות</span>
                        </Label>
                        <Textarea
                            className="mt-3 border-0 border-b border-gray-300 rounded-none focus:ring-0 resize-none"
                            placeholder="Your answer"
                            value={form.comment}
                            onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                            rows={2}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between py-2">
                        <Button type="submit" disabled={isSubmitting} className="bg-gray-800 hover:bg-gray-700 text-white px-8">
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </Button>
                        <button type="button" onClick={handleClear} className="text-blue-600 text-sm hover:underline">
                            Clear form
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}