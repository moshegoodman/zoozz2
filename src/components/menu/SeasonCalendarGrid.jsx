import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, X, Pencil, Save, Calendar, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbos'];
const uid = () => Math.random().toString(36).slice(2, 9);

function generateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const dates = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const dayOfWeek = start.getDay();
  const padStart = new Date(start);
  padStart.setDate(padStart.getDate() - dayOfWeek);
  const cur = new Date(padStart);
  while (cur <= end || cur.getDay() !== 0) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
    if (cur > end && cur.getDay() === 0) break;
  }
  return dates;
}

function formatDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(d)}`;
}

function isInRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

// Portal-based dropdown to escape any overflow clipping
function PortalDropdown({ anchorRef, onClose, children }) {
  const [style, setStyle] = useState({});

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 2,
      left: rect.left,
      zIndex: 9999,
      minWidth: Math.max(rect.width, 190),
    });
  }, [anchorRef]);

  useEffect(() => {
    let handler;
    // Delay so the mousedown that opened this dropdown doesn't immediately close it
    const timer = setTimeout(() => {
      handler = (e) => {
        if (anchorRef.current && anchorRef.current.contains(e.target)) return;
        onClose();
      };
      document.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      if (handler) document.removeEventListener('mousedown', handler);
    };
  }, [anchorRef, onClose]);

  return ReactDOM.createPortal(
    <div style={style} className="bg-white border border-gray-200 rounded-lg shadow-2xl py-1">
      {children}
    </div>,
    document.body
  );
}

function DayCell({ date, dayData, mealTemplates, inRange, onUpdate, isHouseholdMode = false }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(dayData);
  const [addingMeal, setAddingMeal] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const cellRef = useRef(null);
  const addBtnRef = useRef(null);
  const noteBtnRef = useRef(null);

  useEffect(() => { setLocal(dayData); }, [dayData]);

  const dow = new Date(date + 'T00:00:00').getDay();
  const suggestions = mealTemplates.filter(t => (t.day_of_week_trigger || []).includes(dow));
  const others = mealTemplates.filter(t => !(t.day_of_week_trigger || []).includes(dow));

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

  const moveMeal = (index, direction) => {
    const meals = [...(local.assigned_meals || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= meals.length) return;
    [meals[index], meals[newIndex]] = [meals[newIndex], meals[index]];
    const updated = { ...local, assigned_meals: meals };
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
          {local.hebrew_date && <div className="text-gray-500 text-[10px]" dir="rtl">{local.hebrew_date}</div>}
        </div>
      </div>

      {local.holiday && <div className="text-green-700 font-semibold mb-0.5">{local.holiday}</div>}
      {local.parsha && <div className="text-purple-600 mb-0.5">📖 {local.parsha}</div>}
      {local.candle_lighting && <div className="text-red-600">🕯 {local.candle_lighting}</div>}
      {local.shabbos_ends && <div className="text-blue-600">✡ {local.shabbos_ends}</div>}
      {local.day_notes && !editing && (
        <div className="text-gray-500 italic mt-0.5 truncate">{local.day_notes}</div>
      )}

      {/* Assigned meals with reorder controls */}
      <div className="flex flex-col gap-0.5 mt-1 flex-1">
        {(local.assigned_meals || []).map((meal, idx) => (
          <div key={meal.id} className="flex items-center gap-1 rounded px-1 py-0.5 group/meal" style={{ backgroundColor: (meal.color || '#3b82f6') + '22' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meal.color || '#3b82f6' }} />
            <span className="flex-1 truncate font-medium text-[10px]" style={{ color: meal.color || '#3b82f6' }}>{meal.meal_type_name}</span>
            {inRange && !isHouseholdMode && (
              <div className="flex items-center gap-0 opacity-0 group-hover/meal:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); moveMeal(idx, -1); }}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 p-0"
                  title="Move up"
                >
                  <ArrowUp className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveMeal(idx, 1); }}
                  disabled={idx === (local.assigned_meals || []).length - 1}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 p-0"
                  title="Move down"
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }} className="text-gray-400 hover:text-red-500 p-0">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit action buttons */}
      {inRange && (
        <div className="mt-1 flex gap-1">
          <button
            ref={addBtnRef}
            onClick={(e) => { e.stopPropagation(); setAddingMeal(v => !v); setEditing(false); }}
            className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5 bg-blue-50 hover:bg-blue-100 rounded px-1 py-0.5"
          >
            <Plus className="w-3 h-3" /> <span>meal</span>
          </button>
          <button
            ref={noteBtnRef}
            onClick={(e) => { e.stopPropagation(); setEditing(v => !v); setAddingMeal(false); }}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-0.5 bg-gray-50 hover:bg-gray-100 rounded px-1 py-0.5"
          >
            <Pencil className="w-3 h-3" /> <span>note</span>
          </button>
        </div>
      )}

      {/* Add meal dropdown — rendered in portal to escape overflow clipping */}
      {addingMeal && (
        <PortalDropdown anchorRef={addBtnRef} onClose={() => setAddingMeal(false)}>
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
          {suggestions.length > 0 && others.length > 0 && <div className="border-t my-1" />}
          {others.map(t => (
            <button key={t.id} onClick={() => addMeal(t)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#3b82f6' }} />
              {t.name}
            </button>
          ))}
          {mealTemplates.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No meal templates. Add them in Seasons → Meal Templates.</div>
          )}
          <div className="border-t mt-1">
            <button onClick={() => setAddingMeal(false)} className="w-full px-3 py-1 text-xs text-gray-400 hover:text-gray-600 text-left">Cancel</button>
          </div>
        </PortalDropdown>
      )}

      {/* Note editor — also portal */}
      {editing && (
        <PortalDropdown anchorRef={noteBtnRef} onClose={() => setEditing(false)}>
          <div className="p-2 space-y-1 min-w-[220px]">
            <Input value={local.day_notes || ''} onChange={e => setLocal(p => ({ ...p, day_notes: e.target.value }))} placeholder="Event or note..." className="h-7 text-xs" />
            <Input value={local.hebrew_date || ''} onChange={e => setLocal(p => ({ ...p, hebrew_date: e.target.value }))} placeholder="Hebrew date" className="h-7 text-xs text-right" dir="rtl" />
            <Input value={local.holiday || ''} onChange={e => setLocal(p => ({ ...p, holiday: e.target.value }))} placeholder="Holiday name" className="h-7 text-xs" />
            <Input value={local.parsha || ''} onChange={e => setLocal(p => ({ ...p, parsha: e.target.value }))} placeholder="Parsha" className="h-7 text-xs" />
            <Input value={local.candle_lighting || ''} onChange={e => setLocal(p => ({ ...p, candle_lighting: e.target.value }))} placeholder="Candle lighting" className="h-7 text-xs" />
            <Input value={local.shabbos_ends || ''} onChange={e => setLocal(p => ({ ...p, shabbos_ends: e.target.value }))} placeholder="Shabbos/YT ends" className="h-7 text-xs" />
            <div className="flex gap-1 pt-1">
              <Button size="sm" className="h-6 text-xs px-2" onClick={() => { updateNote(); setEditing(false); }}>
                {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        </PortalDropdown>
      )}
    </div>
  );
}

export default function SeasonCalendarGrid({ season, mealTemplates = [], isHouseholdMode = false, householdCalendarDays = null, onHouseholdDaysChange = null }) {
  const [calendarDays, setCalendarDays] = useState({});
  const [loading, setLoading] = useState(true);
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
      const map = {};
      (householdCalendarDays || []).forEach(d => { map[d.date] = d; });
      setCalendarDays(map);
      setLoading(false);
      return;
    }
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
      if (isHouseholdMode && onHouseholdDaysChange) {
        setCalendarDays(prev => {
          const next = { ...prev, ...updates };
          onHouseholdDaysChange(Object.values(next));
          return next;
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 1500);
        return;
      }
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
      <div className="hidden sm:block rounded-lg border border-gray-200">
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