import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarDays, Check, AlertCircle, RefreshCw } from 'lucide-react';
import SeasonCalendarGrid from './SeasonCalendarGrid';

export default function HouseholdCalendarOnboarding({ household, season, mealTemplates = [] }) {
  const [loading, setLoading] = useState(true);
  const [hhCalendar, setHhCalendar] = useState(null); // HouseholdSeasonCalendar record
  const [seasonDays, setSeasonDays] = useState([]); // global season days for inheritance
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'saved' | null

  useEffect(() => {
    load();
  }, [household?.id, season?.id]);

  const load = async () => {
    if (!household?.id || !season?.id) return;
    setLoading(true);
    const [existing, globalDays] = await Promise.all([
      base44.entities.HouseholdSeasonCalendar.filter({
        household_id: household.id,
        season_id: season.id,
      }),
      base44.entities.SeasonCalendarDay.filter({ season_id: season.id }, 'date', 500),
    ]);
    setSeasonDays(globalDays || []);
    setHhCalendar(existing?.[0] || null);
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
        <div className="flex items-center gap-2">
          {status === 'saved' && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
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
        />
      )}
    </div>
  );
}