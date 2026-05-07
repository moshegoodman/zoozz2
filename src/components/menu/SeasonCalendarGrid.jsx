import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Pencil, Save, Calendar, Sparkles } from 'lucide-react';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbos'];
const uid = () => Math.random().toString(36).slice(2, 9);

// Generate date range array for a season
function generateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const dates = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  // Backfill to start of week (Sunday)
  const dayOfWeek = start.getDay();
  const padStart = new Date(start);
  padStart.setDate(padStart.getDate() - dayOfWeek);

  const cur = new Date(padStart);
  while (cur <= end || cur.getDay() !== 0) {
    const iso = cur.toISOString().slice(0, 10);
    dates.push(iso);
    cur.setDate(cur.getDate() + 1);
    if (cur > end && cur.getDay() === 0) break;
  }
  return dates;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(d)}`;
}

function isInRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

// Day cell for editing
function DayCell({ date, dayData, mealTemplates, inRange, onUpdate, isHouseholdMode = false }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(dayData);
  const [addingMeal, setAddingMeal] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const cellRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => { setLocal(dayData); }, [dayData]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!addingMeal && !editing) return;
    const handler = (e) => {
      if (cellRef.current && !cellRef.current.contains(e.target)) {
        setAddingMeal(false);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addingMeal, editing]);

  const dow = new Date(date + 'T00:00:00').getDay();

  // Auto-suggest meal types based on day of week
  const suggestions = mealTemplates.filter(t => (t.day_of_week_trigger || []).includes(dow));

  const addMeal = (template) => {
    const newMeal = {
      id: uid(),
      meal_type_id: template.id,
      meal_type_name: template.name,
      meal_type_name_hebrew: template.name_hebrew,
      time: '',
      color: template.color || '#3b82f6',
    };
    const updated = { ...local, assigned_meals: [...(local.assigned_meals || []), newMeal] };
    setLocal(updated);
    setAddingMeal(false);
    onUpdate(date, updated);
  };

  const removeMeal = (mealId) => {
    const updated = { ...local, assigned_meals: (local.assigned_meals || []).filter(m => m.id !== mealId) };
    setLocal(updated);
    onUpdate(date, updated);
  };

  const updateNote = () => {
    setSavingNote(true);
    onUpdate(date, local);
    setTimeout(() => setSavingNote(false), 600);
  };

  const bgClass = inRange ? 'bg-white' : 'bg-gray-50 opacity-60';

  return (
    <div ref={cellRef} className={`border-r border-b border-gray-200 p-1.5 min-h-[130px] flex flex-col text-xs ${bgClass} relative`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-1">
        <div>
          <span className={`font-bold text-sm ${inRange ? 'text-gray-900' : 'text-gray-400'}`}>{parseInt(date.split('-')[2])}</span>
          <span className="text-gray-400 ml-1">{formatDate(date).split(' ')[0]}</span>
        </div>
        <div className="text-right">
          {dayData.hebrew_date && <div className="text-gray-500" dir="rtl">{dayData.hebrew_date}</div>}
        </div>
      </div>

      {/* Holiday / Parsha */}
      {dayData.holiday && <div className="text-green-700 font-semibold mb-0.5">{dayData.holiday}</div>}
      {dayData.parsha && <div className="text-purple-600 mb-0.5">📖 {dayData.parsha}</div>}

      {/* Candle lighting / Shabbos ends */}
      {dayData.candle_lighting && <div className="text-red-600">🕯 {dayData.candle_lighting}</div>}
      {dayData.shabbos_ends && <div className="text-blue-600">✡ {dayData.shabbos_ends}</div>}

      {/* Day notes */}
      {dayData.day_notes && !editing && (
        <div className="text-gray-500 italic mt-0.5 truncate">{dayData.day_notes}</div>
      )}

      {/* Assigned meals */}
      <div className="flex flex-col gap-0.5 mt-1 flex-1">
        {(local.assigned_meals || []).map(meal => (
          <div key={meal.id} className="flex items-center gap-1 rounded px-1 py-0.5" style={{ backgroundColor: (meal.color || '#3b82f6') + '22' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meal.color || '#3b82f6' }} />
            <span className="flex-1 truncate font-medium" style={{ color: meal.color || '#3b82f6' }}>{meal.meal_type_name}</span>
            {inRange && !isHouseholdMode && (
              <button onClick={() => removeMeal(meal.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Edit actions — always visible when in range */}
      {inRange && (
        <div className="mt-1 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setAddingMeal(v => !v); setEditing(false); }}
            className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5 bg-blue-50 hover:bg-blue-100 rounded px-1 py-0.5"
          >
            <Plus className="w-3 h-3" /> <span>meal</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(v => !v); setAddingMeal(false); }}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-0.5 bg-gray-50 hover:bg-gray-100 rounded px-1 py-0.5"
          >
            <Pencil className="w-3 h-3" /> <span>note</span>
          </button>
        </div>
      )}

      {/* Add meal dropdown */}
      {addingMeal && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 z-[9999] bg-white border rounded-lg shadow-xl min-w-[180px] py-1"
        >
          {suggestions.length > 0 && (
            <div className="px-2 py-1 text-[10px] text-blue-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Suggested
            </div>
          )}
          {suggestions.map(t => (
            <button key={t.id} onClick={() => addMeal(t)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#3b82f6' }} />
              {t.name}
            </button>
          ))}
          {suggestions.length > 0 && mealTemplates.filter(t => !suggestions.includes(t)).length > 0 && (
            <div className="border-t my-1" />
          )}
          {mealTemplates.filter(t => !suggestions.includes(t)).map(t => (
            <button key={t.id} onClick={() => addMeal(t)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#3b82f6' }} />
              {t.name}
            </button>
          ))}
          {mealTemplates.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No meal templates found. Add them in Seasons → Meal Templates.</div>
          )}
          <button onClick={() => setAddingMeal(false)} className="w-full px-3 py-1 text-xs text-gray-400 hover:text-gray-600 text-left border-t">Cancel</button>
        </div>
      )}

      {/* Note editor */}
      {editing && (
        <div className="absolute top-full left-0 z-[9999] bg-white border rounded-lg shadow-xl p-2 min-w-[220px]">
          <Input
            value={local.day_notes || ''}
            onChange={e => setLocal(p => ({ ...p, day_notes: e.target.value }))}
            placeholder="Event or note..."
            className="h-7 text-xs mb-1"
          />
          <Input
            value={local.hebrew_date || ''}
            onChange={e => setLocal(p => ({ ...p, hebrew_date: e.target.value }))}
            placeholder="Hebrew date"
            className="h-7 text-xs mb-1 text-right"
            dir="rtl"
          />
          <Input
            value={local.holiday || ''}
            onChange={e => setLocal(p => ({ ...p, holiday: e.target.value }))}
            placeholder="Holiday name"
            className="h-7 text-xs mb-1"
          />
          <Input
            value={local.parsha || ''}
            onChange={e => setLocal(p => ({ ...p, parsha: e.target.value }))}
            placeholder="Parsha"
            className="h-7 text-xs mb-1"
          />
          <Input
            value={local.candle_lighting || ''}
            onChange={e => setLocal(p => ({ ...p, candle_lighting: e.target.value }))}
            placeholder="Candle lighting"
            className="h-7 text-xs mb-1"
          />
          <Input
            value={local.shabbos_ends || ''}
            onChange={e => setLocal(p => ({ ...p, shabbos_ends: e.target.value }))}
            placeholder="Shabbos/YT ends"
            className="h-7 text-xs mb-1"
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-xs px-2" onClick={() => { updateNote(); setEditing(false); }}>
              {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SeasonCalendarGrid({ season, mealTemplates = [], isHouseholdMode = false, householdCalendarDays = null, onHouseholdDaysChange = null }) {
  const [calendarDays, setCalendarDays] = useState({}); // date -> day data object
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const pendingUpdates = React.useRef({});
  const saveTimer = React.useRef(null);

  const dates = React.useMemo(() =>
    generateDateRange(season.start_date, season.end_date),
    [season.start_date, season.end_date]
  );

  const load = useCallback(async () => {
    setLoading(true);
    if (isHouseholdMode && householdCalendarDays) {
      // In household mode use the pre-loaded snapshot
      const map = {};
      (householdCalendarDays || []).forEach(d => { map[d.date] = d; });
      setCalendarDays(map);
      setLoading(false);
      return;
    }
    // Load global season calendar days
    const data = await base44.entities.SeasonCalendarDay.filter({ season_id: season.id }, 'date', 500);
    const map = {};
    (data || []).forEach(d => { map[d.date] = d; });
    setCalendarDays(map);
    setLoading(false);
  }, [season.id, isHouseholdMode, householdCalendarDays]);

  useEffect(() => { load(); }, [load]);

  const getDayData = (date) => calendarDays[date] || { date, assigned_meals: [], holiday: '', hebrew_date: '', parsha: '', day_notes: '', candle_lighting: '', shabbos_ends: '' };

  const scheduleSave = useCallback((date, updated) => {
    pendingUpdates.current[date] = updated;
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updates = { ...pendingUpdates.current };
      pendingUpdates.current = {};
      // In household mode, propagate to parent
      if (isHouseholdMode && onHouseholdDaysChange) {
        setCalendarDays(prev => {
          const next = { ...prev, ...updates };
          const arr = Object.values(next);
          onHouseholdDaysChange(arr);
          return next;
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 1500);
        return;
      }
      // Global season mode: persist to DB
      for (const [d, data] of Object.entries(updates)) {
        const existing = calendarDays[d];
        if (existing?.id) {
          await base44.entities.SeasonCalendarDay.update(existing.id, data);
        } else {
          const created = await base44.entities.SeasonCalendarDay.create({ ...data, season_id: season.id, date: d });
          setCalendarDays(prev => ({ ...prev, [d]: created }));
        }
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 1500);
    }, 700);
  }, [season.id, isHouseholdMode, onHouseholdDaysChange, calendarDays]);

  const handleUpdate = (date, updated) => {
    setCalendarDays(prev => ({ ...prev, [date]: { ...prev[date], ...updated, date, season_id: season.id } }));
    scheduleSave(date, { ...getDayData(date), ...updated, date, season_id: season.id });
  };

  // Group dates into weeks
  const weeks = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!season.start_date || !season.end_date) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>Set the Season's start and end dates in General Settings to generate the calendar.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {isHouseholdMode ? 'Editing household-specific calendar. Changes only affect this household.' : 'Click a day cell to add meals or notes. Changes auto-save.'}
        </p>
        <div className="text-xs text-gray-400 flex items-center gap-1 min-w-[80px]">
          {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>}
          {saveStatus === 'saved' && <span className="text-green-600">✓ Saved</span>}
        </div>
      </div>

      {/* Legend */}
      {mealTemplates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {mealTemplates.map(t => (
            <span key={t.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: t.color, color: t.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Desktop Grid */}
      <div className="hidden sm:block overflow-visible rounded-lg border border-gray-200">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center text-xs font-bold p-2 text-gray-600 border-r border-gray-200 last:border-r-0">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map(date => (
              <DayCell
                key={date}
                date={date}
                dayData={getDayData(date)}
                mealTemplates={mealTemplates}
                inRange={isInRange(date, season.start_date, season.end_date)}
                onUpdate={handleUpdate}
                isHouseholdMode={isHouseholdMode}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Mobile: weekly cards */}
      <div className="sm:hidden space-y-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="border rounded-xl overflow-hidden">
            <div className="bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">Week {wi + 1}</div>
            {week.filter(d => isInRange(d, season.start_date, season.end_date)).map(date => {
              const data = getDayData(date);
              const dow = new Date(date + 'T00:00:00').getDay();
              return (
                <div key={date} className="p-3 border-t">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-sm">{DAY_HEADERS[dow]}, {formatDate(date)}</div>
                    {data.hebrew_date && <div className="text-xs text-gray-500" dir="rtl">{data.hebrew_date}</div>}
                  </div>
                  {data.holiday && <div className="text-xs text-green-700 font-semibold">{data.holiday}</div>}
                  {data.parsha && <div className="text-xs text-purple-600">📖 {data.parsha}</div>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(data.assigned_meals || []).map(m => (
                      <span key={m.id} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: (m.color || '#3b82f6') + '22', color: m.color || '#3b82f6' }}>
                        {m.meal_type_name}
                      </span>
                    ))}
                  </div>
                  {data.day_notes && <div className="text-xs text-gray-400 italic mt-0.5">{data.day_notes}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}