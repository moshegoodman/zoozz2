import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarDays, Check, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import SeasonCalendarGrid from './SeasonCalendarGrid';
import { useNavigate } from 'react-router-dom';

export default function HouseholdCalendarOnboarding({ household, season, mealTemplates = [] }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hhCalendar, setHhCalendar] = useState(null);
  const [seasonDays, setSeasonDays] = useState([]);
  const [existingMenus, setExistingMenus] = useState([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    load();
  }, [household?.id, season?.id]);

  const load = async () => {
    if (!household?.id || !season?.id) return;
    setLoading(true);
    const [existing, globalDays, menus] = await Promise.all([
      base44.entities.HouseholdSeasonCalendar.filter({ household_id: household.id, season_id: season.id }),
      base44.entities.SeasonCalendarDay.filter({ season_id: season.id }, 'date', 500),
      base44.entities.Menu.filter({ household_id: household.id, season_id: season.id }),
    ]);
    setSeasonDays(globalDays || []);
    setHhCalendar(existing?.[0] || null);
    setExistingMenus(menus || []);
    setLoading(false);
  };

  const handleInitialize = async () => {
    // Take a snapshot of the global season calendar and save as this household's copy
    setSaving(true);
    const snapshot = (seasonDays || []).map(d => ({
      date: d.date,
      hebrew_date: d.hebrew_date || '',
      holiday: d.holiday || '',
      parsha: d.parsha || '',
      day_notes: d.day_notes || '',
      candle_lighting: d.candle_lighting || '',
      shabbos_ends: d.shabbos_ends || '',
      assigned_meals: (d.assigned_meals || []).map(m => ({ ...m })),
    }));

    const record = await base44.entities.HouseholdSeasonCalendar.create({
      household_id: household.id,
      season_id: season.id,
      calendar_days: snapshot,
      onboarded_at: new Date().toISOString(),
    });
    setHhCalendar(record);
    setSaving(false);
    setStatus('saved');
    setTimeout(() => setStatus(null), 2000);
  };

  const handleGenerateMenus = async () => {
    if (!hhCalendar?.calendar_days?.length) return;
    setGenerating(true);
    setGenerateStatus(null);

    // Load client profile for course structure + existing menus to avoid duplicates
    const [profileList, existingMenus] = await Promise.all([
      base44.entities.ClientMenuProfile.filter({ household_id: household.id, season_id: season.id }),
      base44.entities.Menu.filter({ household_id: household.id, season_id: season.id }),
    ]);
    const profile = profileList?.[0] || null;

    // Build a set of existing meal keys to skip
    const existingKeys = new Set(
      (existingMenus || []).map(m => `${m.english_date}__${m.meal_type}`)
    );

    // Determine courses per meal type from profile
    const uid = () => Math.random().toString(36).slice(2, 9);
    const coursesFor = (mealType) => {
      if (!profile) return [];
      const t = mealType?.toLowerCase();
      if (t === 'dinner') return profile.dinner_courses || [];
      if (t === 'lunch') return profile.lunch_courses || [];
      if (t === 'kiddush') return profile.kiddush_courses || [];
      if (t === 'kiddish') {
        const checklist = profile.kiddish_checklist || [];
        if (!checklist.length) return profile.kiddush_courses || [];
        return [{
          id: uid(),
          title_english: 'Kiddish',
          title_hebrew: 'קידיש',
          dishes: checklist.map(item => ({
            id: uid(),
            english: item.english || '',
            hebrew: item.hebrew || '',
          })),
        }];
      }
      return [];
    };

    let created = 0;
    let skipped = 0;
    let mealCounter = (existingMenus || []).length;

    for (const day of hhCalendar.calendar_days) {
      if (!day.assigned_meals?.length) continue;
      for (const meal of day.assigned_meals) {
        const key = `${day.date}__${meal.meal_type_name?.toLowerCase() || 'other'}`;
        if (existingKeys.has(key)) { skipped++; continue; }

        mealCounter++;
        const mealType = (meal.meal_type_name || 'other').toLowerCase();
        const courses = coursesFor(mealType);

        await base44.entities.Menu.create({
          season_id: season.id,
          household_id: household.id,
          household_name: household.name || '',
          household_name_hebrew: household.name_hebrew || '',
          meal_number: mealCounter,
          stage: 'chef_drafting',
          meal_type: ['dinner','lunch','kiddush','toamia','kiddish','other'].includes(mealType) ? mealType : 'other',
          meal_type_id: meal.meal_type_id || '',
          english_date: day.date,
          hebrew_date: day.hebrew_date || '',
          holiday: day.holiday || '',
          time: meal.time || '',
          guest_count: 0,
          courses: courses,
        });
        existingKeys.add(key);
        created++;
      }
    }

    setGenerating(false);
    setGenerateStatus({ created, skipped });
    // Reload menus to get updated meal numbers
    const refreshed = await base44.entities.Menu.filter({ household_id: household.id, season_id: season.id });
    setExistingMenus(refreshed || []);
    setTimeout(() => setGenerateStatus(null), 5000);
  };

  const handleGenerateSingleMenu = async (day, meal) => {
    const uid = () => Math.random().toString(36).slice(2, 9);
    const mealType = (meal.meal_type_name || 'other').toLowerCase();

    const [profileList] = await Promise.all([
      base44.entities.ClientMenuProfile.filter({ household_id: household.id, season_id: season.id }),
    ]);
    const profile = profileList?.[0] || null;

    const coursesFor = (t) => {
      if (!profile) return [];
      if (t === 'dinner') return profile.dinner_courses || [];
      if (t === 'lunch') return profile.lunch_courses || [];
      if (t === 'kiddush') return profile.kiddush_courses || [];
      if (t === 'kiddish') {
        const checklist = profile.kiddish_checklist || [];
        if (!checklist.length) return profile.kiddush_courses || [];
        return [{ id: uid(), title_english: 'Kiddish', title_hebrew: 'קידיש', dishes: checklist.map(item => ({ id: uid(), english: item.english || '', hebrew: item.hebrew || '' })) }];
      }
      return [];
    };

    const mealCounter = existingMenus.length + 1;
    const created = await base44.entities.Menu.create({
      season_id: season.id,
      household_id: household.id,
      household_name: household.name || '',
      household_name_hebrew: household.name_hebrew || '',
      meal_number: mealCounter,
      stage: 'chef_drafting',
      meal_type: ['dinner','lunch','kiddush','toamia','kiddish','other'].includes(mealType) ? mealType : 'other',
      meal_type_id: meal.meal_type_id || '',
      english_date: day.date,
      hebrew_date: day.hebrew_date || '',
      holiday: day.holiday || '',
      time: meal.time || '',
      guest_count: 0,
      courses: coursesFor(mealType),
    });
    const refreshed = await base44.entities.Menu.filter({ household_id: household.id, season_id: season.id });
    setExistingMenus(refreshed || []);
    navigate(`/MenuEditor?id=${created.id}`);
  };

  const handleDaysChange = async (updatedDays) => {
    if (!hhCalendar?.id) return;
    const updated = await base44.entities.HouseholdSeasonCalendar.update(hhCalendar.id, {
      calendar_days: updatedDays,
    });
    setHhCalendar(updated);
    setStatus('saved');
    setTimeout(() => setStatus(null), 1500);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            {household.name} — {season.name} Calendar
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">
            {hhCalendar
              ? `Onboarded ${new Date(hhCalendar.onboarded_at).toLocaleDateString()}. Edits here only affect this household.`
              : 'This household has not yet inherited the season calendar.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {status === 'saved' && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
          {generateStatus && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> {generateStatus.created} menus created{generateStatus.skipped > 0 ? `, ${generateStatus.skipped} skipped` : ''}
            </span>
          )}
          {hhCalendar && (
            <Button
              size="sm"
              className="h-8 gap-1 text-xs bg-amber-600 hover:bg-amber-700"
              onClick={handleGenerateMenus}
              disabled={generating}
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate All Menus
            </Button>
          )}
          {hhCalendar ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={handleInitialize}
              disabled={saving}
            >
              <RefreshCw className="w-3 h-3" />
              Re-sync from Season
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 gap-1 bg-blue-600 hover:bg-blue-700"
              onClick={handleInitialize}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarDays className="w-3 h-3" />}
              Initialize from Season Calendar
            </Button>
          )}
        </div>
      </div>

      {!hhCalendar ? (
        <Card className="border-dashed border-2 border-blue-200">
          <CardContent className="p-8 text-center">
            <CalendarDays className="w-10 h-10 text-blue-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-1">
              No household calendar yet for this season.
            </p>
            <p className="text-xs text-gray-400">
              Click "Initialize from Season Calendar" to copy the current season calendar as this household's starting point. You can then customize it independently.
            </p>
            {seasonDays.length === 0 && (
              <div className="flex items-center gap-1 justify-center mt-3 text-amber-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                The global season calendar has no days assigned yet. Set them in the Seasons tab first.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <SeasonCalendarGrid
          season={season}
          mealTemplates={mealTemplates}
          isHouseholdMode={true}
          householdCalendarDays={hhCalendar.calendar_days || []}
          onHouseholdDaysChange={handleDaysChange}
          existingMenus={existingMenus}
          onGenerateSingleMenu={handleGenerateSingleMenu}
        />
      )}
    </div>
  );
}