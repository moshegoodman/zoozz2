import React, { useState, useEffect, useCallback } from 'react';
import { User, HouseholdMealPlan } from '@/entities/all';
import { useLanguage } from '../components/i18n/LanguageContext';
import { sukkot2025Data } from '../components/meal_calendar/sukkot2025Data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, CalendarDays, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const weeks = [];
for (let i = 0; i < sukkot2025Data.length; i += 7) {
    weeks.push(sukkot2025Data.slice(i, i + 7));
}

const dayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'];

// String-based date formatting functions
const formatDateFromString = (dateString, language) => {
  // dateString format: 'YYYY-MM-DD'
  const [year, month, day] = dateString.split('-');
  const monthNum = parseInt(month, 10);
  
  const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const hebrewMonths = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ',
                        'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  
  const months = language === 'Hebrew' ? hebrewMonths : englishMonths;
  const monthName = months[monthNum - 1];
  const dayNum = parseInt(day, 10);
  
  return `${monthName} ${dayNum}`;
};

const getMonthYearFromString = (dateString, language) => {
  // dateString format: 'YYYY-MM-DD'
  const [year, month] = dateString.split('-');
  const monthNum = parseInt(month, 10);
  
  const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
  
  const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  
  const months = language === 'Hebrew' ? hebrewMonths : englishMonths;
  const monthName = months[monthNum - 1];
  
  return `${monthName} ${year}`;
};

const getDayFromString = (dateString) => {
  // dateString format: 'YYYY-MM-DD'
  const [, , day] = dateString.split('-');
  return parseInt(day, 10);
};

const isToday = (dateString) => {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateString === todayString;
};

// Check if date is in current month based on the first date in our data
const isCurrentMonth = (dateString) => {
  const firstDateInData = sukkot2025Data[0].date;
  const [firstYear, firstMonth] = firstDateInData.split('-');
  const [dateYear, dateMonth] = dateString.split('-');
  return firstYear === dateYear && firstMonth === dateMonth;
};

export default function MealCalendarPage() {
    const { t, language } = useLanguage();
    const navigate = useNavigate();

    const [household, setHousehold] = useState(null);
    const [mealPlan, setMealPlan] = useState(null);
    const [selectedMealIds, setSelectedMealIds] = useState([]);
    const [notes, setNotes] = useState('');
    const [activeWeek, setActiveWeek] = useState("week1");
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Split data into weeks for mobile tabs
    const weeklyData = {
        week1: sukkot2025Data.slice(0, 7),   // Sept 28 - Oct 4
        week2: sukkot2025Data.slice(7, 14),  // Oct 5 - Oct 11
        week3: sukkot2025Data.slice(14, 21)  // Oct 12 - Oct 18
    };

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentUser = await User.me();
            
            let householdDataString = null;
            // Admins/Chiefs use 'shoppingForHousehold' context, which triggers the correct banner
            if (['admin', 'chief of staff'].includes(currentUser?.user_type)) {
                householdDataString = sessionStorage.getItem('shoppingForHousehold');
            } else {
            // KCS Staff and other users rely on 'selectedHousehold'
                householdDataString = sessionStorage.getItem('selectedHousehold');
            }

            if (!householdDataString) {
                // If no household context is found, handle it gracefully.
                if (!['admin', 'chief of staff'].includes(currentUser?.user_type)) {
                    navigate(createPageUrl("HouseholdSelector"));
                }
                // For admins, we'll show an error message in the render part.
                setIsLoading(false);
                return;
            }

            const currentHousehold = JSON.parse(householdDataString);
            setHousehold(currentHousehold);

            const plans = await HouseholdMealPlan.filter({
                household_id: currentHousehold.id,
                event_name: 'sukkot_2025'
            });

            if (plans.length > 0) {
                const existingPlan = plans[0];
                setMealPlan(existingPlan);
                setSelectedMealIds(existingPlan.selected_meal_ids || []);
                setNotes(existingPlan.notes || '');
            } else {
                setMealPlan({
                    household_id: currentHousehold.id,
                    event_name: 'sukkot_2025',
                    selected_meal_ids: [],
                    notes: ''
                });
                setSelectedMealIds([]);
                setNotes('');
            }
        } catch (error) {
            console.error("Error loading meal calendar data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleToggleMeal = (mealId) => {
        setSelectedMealIds(prev =>
            prev.includes(mealId)
                ? prev.filter(id => id !== mealId)
                : [...prev, mealId]
        );
    };

    const handleSave = async () => {
        if (!mealPlan) return;
        setIsSaving(true);
        try {
            const planData = {
                ...mealPlan,
                selected_meal_ids: selectedMealIds,
                notes: notes,
            };

            if (mealPlan.id) {
                // Update existing plan
                const updatedPlan = await HouseholdMealPlan.update(mealPlan.id, planData);
                setMealPlan(updatedPlan);
            } else {
                // Create new plan
                const newPlan = await HouseholdMealPlan.create(planData);
                setMealPlan(newPlan);
            }
            alert(t('mealCalendar.saveSuccess'));
        } catch (error) {
            console.error("Error saving meal plan:", error);
            alert(t('mealCalendar.saveError'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-green-600" />
            </div>
        );
    }
    
    // Graceful handling for missing household context for admins
    if (!household) {
        return (
            <div className="max-w-[90rem] mx-auto p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="text-red-500" />
                            {t('mealCalendar.noHouseholdContextTitle')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4">
                            {t('mealCalendar.noHouseholdContextAdmin')}
                        </p>
                        <Link to={createPageUrl("AdminDashboard")}>
                            <Button>{t('mealCalendar.backToAdminDashboard')}</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Get the current month/year from the first date in our data
    const currentMonthYear = getMonthYearFromString(sukkot2025Data[0].date, language);

    return (
        <div className="max-w-[90rem] mx-auto p-4 sm:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <CardTitle className="text-2xl sm:text-3xl flex items-center gap-3">
                                <CalendarDays className="w-8 h-8 text-green-600" />
                                {t('mealCalendar.title')}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                {t('mealCalendar.description')} {household ? <span className="font-bold">{household.name}</span> : ''}
                            </CardDescription>
                        </div>
                        <Button onClick={handleSave} disabled={isSaving} size="lg">
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5 mr-2" />
                            )}
                            {t('mealCalendar.saveButton')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Desktop Grid View */}
                    <div className="hidden sm:block overflow-x-auto">
                        <div className="mb-4 text-center">
                            <h3 className="text-lg font-semibold">{currentMonthYear}</h3>
                        </div>
                        <div className="min-w-full inline-block">
                            <div className="grid grid-cols-7 border-t border-l border-gray-200">
                                {dayHeaders.map(day => (
                                    <div key={day} className="text-center font-bold p-2 bg-gray-100 border-r border-b border-gray-200">
                                        {t(`common.days.${day.toLowerCase()}`)}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 border-l border-gray-200">
                                {weeks.flat().map((dayData, index) => (
                                    <div key={index} className="border-r border-b border-gray-200 p-2 min-h-[180px] flex flex-col">
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start text-xs mb-1">
                                                <span className="font-bold">{formatDateFromString(dayData.date, language)}</span>
                                                <span className="text-gray-500">{dayData.hebrewDate}</span>
                                            </div>
                                            {dayData.holiday && <p className="text-xs font-semibold text-green-700">{dayData.holiday}</p>}
                                            <div className="space-y-2 mt-2">
                                                {dayData.meals.map(meal => (
                                                    <div key={meal.id} className="flex items-start space-x-2">
                                                        <Checkbox
                                                            id={`meal-${meal.id}`}
                                                            checked={selectedMealIds.includes(meal.id)}
                                                            onCheckedChange={() => handleToggleMeal(meal.id)}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <Label htmlFor={`meal-${meal.id}`} className="text-sm font-medium cursor-pointer block">
                                                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded mr-1">
                                                                    #{meal.id}
                                                                </span>
                                                                {language === 'Hebrew' ? meal.hebrewName : meal.name}
                                                            </Label>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-xs text-red-600 font-semibold mt-auto pt-1">
                                            {dayData.candleLighting && <span>{t('mealCalendar.candleLighting')}: {dayData.candleLighting}</span>}
                                            {dayData.shabbosEnds && <span className="text-blue-600">{t('mealCalendar.shabbosEnds')}: {dayData.shabbosEnds}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Mobile Tabbed View */}
                    <div className="block sm:hidden">
                        <Tabs value={activeWeek} onValueChange={setActiveWeek}>
                            <TabsList className="grid w-full grid-cols-3 mb-4">
                                <TabsTrigger value="week1" className="text-sm">{t('mealCalendar.week1Tab')}</TabsTrigger>
                                <TabsTrigger value="week2" className="text-sm">{t('mealCalendar.week2Tab')}</TabsTrigger>
                                <TabsTrigger value="week3" className="text-sm">{t('mealCalendar.week3Tab')}</TabsTrigger>
                            </TabsList>

                            {Object.entries(weeklyData).map(([weekKey, weekData]) => (
                                <TabsContent key={weekKey} value={weekKey} className="space-y-2">
                                    {weekData.map((dayData, index) => (
                                        <Card key={index} className="w-full">
                                            <CardHeader className="p-3 pb-2">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <CardTitle className="text-base">{t(`common.days.${dayData.dayOfWeek.toLowerCase()}`)}</CardTitle>
                                                        <CardDescription className="text-sm">{formatDateFromString(dayData.date, language)}</CardDescription>
                                                    </div>
                                                    <div className="text-right text-xs text-gray-500">
                                                        {dayData.hebrewDate}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-0 pb-3">
                                                {dayData.holiday && <p className="text-xs font-semibold text-green-700 mb-2">{dayData.holiday}</p>}
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                    {dayData.meals.map(meal => (
                                                        <div key={meal.id} className="flex items-start space-x-2">
                                                            <Checkbox
                                                                id={`mobile-${weekKey}-meal-${meal.id}`}
                                                                checked={selectedMealIds.includes(meal.id)}
                                                                onCheckedChange={() => handleToggleMeal(meal.id)}
                                                                className="mt-0.5 h-3 w-3 flex-shrink-0"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <Label htmlFor={`mobile-${weekKey}-meal-${meal.id}`} className="text-xs font-medium cursor-pointer block leading-tight">
                                                                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-1 py-0.5 rounded mr-1">
                                                                        #{meal.id}
                                                                    </span>
                                                                    <span className="truncate">
                                                                        {language === 'Hebrew' ? meal.hebrewName : meal.name}
                                                                    </span>
                                                                </Label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {(dayData.candleLighting || dayData.shabbosEnds) && (
                                                    <div className="text-xs font-semibold mt-2 pt-2 border-t border-gray-100">
                                                        {dayData.candleLighting && <span className="text-red-600 block">{t('mealCalendar.candleLighting')}: {dayData.candleLighting}</span>}
                                                        {dayData.shabbosEnds && <span className="text-blue-600 block">{t('mealCalendar.shabbosEnds')}: {dayData.shabbosEnds}</span>}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </TabsContent>
                            ))}
                        </Tabs>
                    </div>

                     <div className="mt-6">
                        <Label htmlFor="notes" className="text-lg font-semibold">{t('mealCalendar.notesTitle')}</Label>
                        <Textarea
                            id="notes"
                            placeholder={t('mealCalendar.notesPlaceholder')}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-2"
                            rows={4}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}