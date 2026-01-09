import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Briefcase } from "lucide-react";
import { useLanguage } from "../components/i18n/LanguageContext";

export default function TimeTrackingPage() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [recentShifts, setRecentShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [selectedJob, setSelectedJob] = useState("chef");
  const [hourlyRate, setHourlyRate] = useState(0);

  const jobs = ["chef", "cleaner", "house manager", "other", "cook", "waiter"];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Get households for this staff member
      const staffAssignments = await base44.entities.HouseholdStaff.filter({ 
        staff_user_id: currentUser.id 
      });
      
      const householdIds = staffAssignments.map(s => s.household_id);
      const householdsData = await base44.entities.Household.filter({ 
        id: { $in: householdIds } 
      });
      setHouseholds(householdsData);

      // Get active shift
      const shifts = await base44.entities.Shift.filter({
        user_id: currentUser.id,
        done_date_time: null
      });
      
      if (shifts.length > 0) {
        setActiveShift(shifts[0]);
        const household = householdsData.find(h => h.id === shifts[0].household_id);
        setSelectedHousehold(household);
      }

      // Get recent completed shifts
      const completed = await base44.entities.Shift.filter({
        user_id: currentUser.id,
        done_date_time: { $ne: null }
      }, '-done_date_time', 10);
      setRecentShifts(completed);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!selectedHousehold || !hourlyRate) {
      alert(language === 'Hebrew' ? 'אנא בחר משק בית ושכר לשעה' : 'Please select a household and hourly rate');
      return;
    }

    try {
      const newShift = await base44.entities.Shift.create({
        user_id: user.id,
        household_id: selectedHousehold.id,
        job: selectedJob,
        price_per_hour: hourlyRate,
        start_date_time: new Date().toISOString()
      });
      
      setActiveShift(newShift);
      alert(language === 'Hebrew' ? 'שעון תחילת עבודה נרשם בהצלחה' : 'Clocked in successfully');
    } catch (error) {
      console.error("Error clocking in:", error);
      alert(language === 'Hebrew' ? 'שגיאה בשעון תחילת עבודה' : 'Error clocking in');
    }
  };

  const handleClockOut = async () => {
    if (!activeShift) return;

    try {
      await base44.entities.Shift.update(activeShift.id, {
        done_date_time: new Date().toISOString()
      });
      
      setActiveShift(null);
      await loadData();
      alert(language === 'Hebrew' ? 'שעון סיום עבודה נרשם בהצלחה' : 'Clocked out successfully');
    } catch (error) {
      console.error("Error clocking out:", error);
      alert(language === 'Hebrew' ? 'שגיאה בשעון סיום עבודה' : 'Error clocking out');
    }
  };

  const calculateDuration = (start, end) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    return hours.toFixed(2);
  };

  const calculatePay = (shift) => {
    const hours = calculateDuration(shift.start_date_time, shift.done_date_time);
    return (hours * shift.price_per_hour).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
          <Clock className="w-8 h-8 text-green-600" />
          {language === 'Hebrew' ? 'מעקב שעות עבודה' : 'Time Tracking'}
        </h1>

        {/* Active Shift */}
        {activeShift ? (
          <Card className="mb-8 border-green-500 border-2">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Badge className="bg-green-600 text-white">
                    {language === 'Hebrew' ? 'במשמרת' : 'Active Shift'}
                  </Badge>
                  {selectedHousehold && (language === 'Hebrew' ? selectedHousehold.name_hebrew || selectedHousehold.name : selectedHousehold.name)}
                </span>
                <span className="text-2xl font-mono">
                  {calculateDuration(activeShift.start_date_time, null)} {language === 'Hebrew' ? 'שעות' : 'hrs'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">{language === 'Hebrew' ? 'תפקיד' : 'Job'}</p>
                  <p className="font-semibold capitalize">{activeShift.job}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{language === 'Hebrew' ? 'שכר לשעה' : 'Hourly Rate'}</p>
                  <p className="font-semibold">₪{activeShift.price_per_hour}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{language === 'Hebrew' ? 'התחלה' : 'Started'}</p>
                  <p className="font-semibold">{new Date(activeShift.start_date_time).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{language === 'Hebrew' ? 'שכר נוכחי' : 'Current Pay'}</p>
                  <p className="font-semibold text-green-600">₪{calculatePay(activeShift)}</p>
                </div>
              </div>
              <Button onClick={handleClockOut} className="w-full bg-red-600 hover:bg-red-700" size="lg">
                <LogOut className="w-5 h-5 mr-2" />
                {language === 'Hebrew' ? 'סיום משמרת' : 'Clock Out'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{language === 'Hebrew' ? 'התחלת משמרת' : 'Start Shift'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'Hebrew' ? 'בחר משק בית' : 'Select Household'}
                </label>
                <select
                  value={selectedHousehold?.id || ''}
                  onChange={(e) => setSelectedHousehold(households.find(h => h.id === e.target.value))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">{language === 'Hebrew' ? 'בחר משק בית' : 'Select household'}</option>
                  {households.map(h => (
                    <option key={h.id} value={h.id}>
                      {language === 'Hebrew' ? h.name_hebrew || h.name : h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'Hebrew' ? 'תפקיד' : 'Job Type'}
                </label>
                <select
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {jobs.map(job => (
                    <option key={job} value={job} className="capitalize">{job}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'Hebrew' ? 'שכר לשעה (₪)' : 'Hourly Rate (₪)'}
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="0"
                  step="0.5"
                />
              </div>

              <Button onClick={handleClockIn} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                <LogIn className="w-5 h-5 mr-2" />
                {language === 'Hebrew' ? 'התחלת משמרת' : 'Clock In'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Shifts */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'Hebrew' ? 'משמרות אחרונות' : 'Recent Shifts'}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentShifts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {language === 'Hebrew' ? 'אין משמרות קודמות' : 'No previous shifts'}
              </p>
            ) : (
              <div className="space-y-3">
                {recentShifts.map(shift => {
                  const household = households.find(h => h.id === shift.household_id);
                  return (
                    <div key={shift.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">
                            {household && (language === 'Hebrew' ? household.name_hebrew || household.name : household.name)}
                          </p>
                          <p className="text-sm text-gray-600 capitalize">
                            <Briefcase className="w-4 h-4 inline mr-1" />
                            {shift.job}
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          ₪{calculatePay(shift)}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 grid grid-cols-2 gap-2">
                        <div>{new Date(shift.start_date_time).toLocaleString()}</div>
                        <div>{new Date(shift.done_date_time).toLocaleString()}</div>
                      </div>
                      <div className="text-sm font-medium mt-2">
                        {calculateDuration(shift.start_date_time, shift.done_date_time)} {language === 'Hebrew' ? 'שעות' : 'hours'} @ ₪{shift.price_per_hour}/{language === 'Hebrew' ? 'שעה' : 'hr'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}