import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Languages, Upload, Loader2, Save, ChevronDown, ChevronUp, Image as ImageIcon
} from 'lucide-react';
import AllergyBanner from './AllergyBanner';
import MenuProgressStepper from './MenuProgressStepper';

const uid = () => Math.random().toString(36).slice(2, 9);

const STAGE_LABELS = {
  onboarding: 'Onboarding',
  chef_drafting: 'Chef Drafting',
  manager_review: 'Manager Review',
  client_approval: 'Client Approval',
  finalized: 'Finalized',
};

const NEXT_STAGE = {
  chef_drafting: 'manager_review',
  manager_review: 'client_approval',
  client_approval: 'finalized',
};

export default function MenuEditor({ menu, allergyText, onSaved, canEdit, isManager }) {
  const [courses, setCourses] = useState(menu.courses || []);
  const [header, setHeader] = useState({
    english_date: menu.english_date || '',
    hebrew_date: menu.hebrew_date || '',
    time: menu.time || '',
    guest_count: menu.guest_count || 0,
    notes_internal: menu.notes_internal || '',
  });
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState({}); // dishId -> bool
  const [suggestions, setSuggestions] = useState([]); // dish suggestions
  const [activeDishInput, setActiveDishInput] = useState(null);
  const debounceRef = useRef(null);

  const save = useCallback(async (newCourses, newHeader) => {
    setSaving(true);
    await base44.entities.Menu.update(menu.id, {
      courses: newCourses,
      ...newHeader,
    });
    setSaving(false);
    onSaved?.();
  }, [menu.id]);

  const scheduleSave = useCallback((c, h) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(c, h), 800);
  }, [save]);

  const updateCourses = (newCourses) => {
    setCourses(newCourses);
    scheduleSave(newCourses, header);
  };

  const updateHeader = (newHeader) => {
    setHeader(newHeader);
    scheduleSave(courses, newHeader);
  };

  // Dish suggestion fetch
  const fetchSuggestions = async (query, chefId) => {
    if (!query || query.length < 2) { setSuggestions([]); return; }
    const results = await base44.entities.DishLibrary.filter({ chef_id: chefId }, '-use_count', 20);
    const filtered = results.filter(d =>
      d.hebrew?.includes(query) || d.english?.toLowerCase().includes(query.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 6));
  };

  const translateDish = async (courseIdx, dishIdx) => {
    const dish = courses[courseIdx].dishes[dishIdx];
    const dishKey = dish.id;
    setTranslating(p => ({ ...p, [dishKey]: true }));
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate this Hebrew dish name to English for a high-end kosher menu. Return ONLY the English translation, nothing else.\n\nHebrew: ${dish.hebrew}`,
      });
      const newCourses = courses.map((c, ci) =>
        ci !== courseIdx ? c : {
          ...c,
          dishes: c.dishes.map((d, di) =>
            di !== dishIdx ? d : { ...d, english: result }
          )
        }
      );
      updateCourses(newCourses);

      // Save to dish library
      await base44.entities.DishLibrary.create({
        chef_id: menu.chef_id,
        hebrew: dish.hebrew,
        english: result,
        use_count: 1,
      }).catch(() => {});
    } catch (e) { console.error(e); }
    finally { setTranslating(p => ({ ...p, [dishKey]: false })); }
  };

  const addCourse = () => {
    updateCourses([...courses, { id: uid(), title_hebrew: '', title_english: '', dishes: [] }]);
  };

  const removeCourse = (ci) => {
    updateCourses(courses.filter((_, i) => i !== ci));
  };

  const addDish = (ci) => {
    const newCourses = courses.map((c, i) =>
      i !== ci ? c : { ...c, dishes: [...c.dishes, { id: uid(), hebrew: '', english: '', photo_url: '' }] }
    );
    updateCourses(newCourses);
  };

  const removeDish = (ci, di) => {
    const newCourses = courses.map((c, i) =>
      i !== ci ? c : { ...c, dishes: c.dishes.filter((_, j) => j !== di) }
    );
    updateCourses(newCourses);
  };

  const updateDish = (ci, di, field, val) => {
    const newCourses = courses.map((c, i) =>
      i !== ci ? c : { ...c, dishes: c.dishes.map((d, j) => j !== di ? d : { ...d, [field]: val }) }
    );
    updateCourses(newCourses);
  };

  const handleDishPhotoUpload = async (ci, di, file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateDish(ci, di, 'photo_url', file_url);
  };

  const advanceStage = async () => {
    const next = NEXT_STAGE[menu.stage];
    if (!next) return;
    await base44.entities.Menu.update(menu.id, { stage: next });
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <MenuProgressStepper stage={menu.stage} />
      <AllergyBanner text={allergyText} />

      {/* Header metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-xl p-4 border">
        <div>
          <Label className="text-xs text-gray-500">Meal #</Label>
          <div className="text-lg font-bold text-blue-700">#{menu.meal_number || '—'}</div>
        </div>
        <div>
          <Label className="text-xs text-gray-500">English Date</Label>
          {canEdit
            ? <Input value={header.english_date} onChange={e => updateHeader({ ...header, english_date: e.target.value })} className="h-8 text-sm mt-1" placeholder="Friday, April 18" />
            : <div className="text-sm font-medium mt-1">{header.english_date || '—'}</div>}
        </div>
        <div>
          <Label className="text-xs text-gray-500">Hebrew Date</Label>
          {canEdit
            ? <Input value={header.hebrew_date} onChange={e => updateHeader({ ...header, hebrew_date: e.target.value })} className="h-8 text-sm mt-1 text-right" dir="rtl" placeholder="כ׳ ניסן" />
            : <div className="text-sm font-medium mt-1 text-right" dir="rtl">{header.hebrew_date || '—'}</div>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-500">Guests</Label>
            {canEdit
              ? <Input type="number" value={header.guest_count} onChange={e => updateHeader({ ...header, guest_count: parseInt(e.target.value) || 0 })} className="h-8 text-sm mt-1" />
              : <div className="text-sm font-medium mt-1">{header.guest_count}</div>}
          </div>
          <div>
            <Label className="text-xs text-gray-500">Time</Label>
            {canEdit
              ? <Input value={header.time} onChange={e => updateHeader({ ...header, time: e.target.value })} className="h-8 text-sm mt-1" placeholder="7:30 PM" />
              : <div className="text-sm font-medium mt-1">{header.time || '—'}</div>}
          </div>
        </div>
      </div>

      {/* Bilingual split: Hebrew right / English left */}
      <div className="space-y-4">
        {courses.map((course, ci) => (
          <div key={course.id} className="border rounded-xl overflow-hidden shadow-sm">
            {/* Course title */}
            <div className="bg-gray-800 text-white px-4 py-2 flex items-center gap-2">
              {canEdit ? (
                <>
                  <Input
                    value={course.title_english}
                    onChange={e => {
                      const nc = courses.map((c, i) => i !== ci ? c : { ...c, title_english: e.target.value });
                      updateCourses(nc);
                    }}
                    className="h-7 bg-gray-700 border-gray-600 text-white text-sm flex-1 placeholder:text-gray-400"
                    placeholder="Course name (English)"
                  />
                  <Input
                    value={course.title_hebrew}
                    onChange={e => {
                      const nc = courses.map((c, i) => i !== ci ? c : { ...c, title_hebrew: e.target.value });
                      updateCourses(nc);
                    }}
                    className="h-7 bg-gray-700 border-gray-600 text-white text-sm flex-1 text-right placeholder:text-gray-400"
                    dir="rtl"
                    placeholder="שם מנה"
                  />
                  <button onClick={() => removeCourse(ci)} className="text-gray-400 hover:text-red-400 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex w-full justify-between">
                  <span className="font-semibold">{course.title_english}</span>
                  <span className="font-semibold" dir="rtl">{course.title_hebrew}</span>
                </div>
              )}
            </div>

            {/* Dishes — split view */}
            <div className="divide-y">
              {course.dishes.map((dish, di) => (
                <div key={dish.id} className="flex">
                  {/* English (left) */}
                  <div className="flex-1 p-3 bg-white border-r">
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={dish.english}
                          onChange={e => updateDish(ci, di, 'english', e.target.value)}
                          className="h-7 text-sm flex-1"
                          placeholder="English dish name"
                        />
                        <button
                          onClick={() => translateDish(ci, di)}
                          disabled={translating[dish.id] || !dish.hebrew}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 whitespace-nowrap"
                          title="Translate from Hebrew"
                        >
                          {translating[dish.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                          Translate
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm">{dish.english}</span>
                    )}
                    {/* Photo */}
                    {canEdit && (
                      <div className="mt-1.5 flex items-center gap-2">
                        {dish.photo_url
                          ? <img src={dish.photo_url} alt="dish" className="w-12 h-12 rounded object-cover" />
                          : null}
                        <label className="cursor-pointer flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                          <ImageIcon className="w-3 h-3" />
                          {dish.photo_url ? 'Change' : 'Photo'}
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleDishPhotoUpload(ci, di, e.target.files[0])} />
                        </label>
                      </div>
                    )}
                    {!canEdit && dish.photo_url && (
                      <img src={dish.photo_url} alt="dish" className="w-16 h-16 rounded object-cover mt-1" />
                    )}
                  </div>

                  {/* Hebrew (right) */}
                  <div className="flex-1 p-3 bg-amber-50" dir="rtl">
                    {canEdit ? (
                      <div className="relative">
                        <Input
                          value={dish.hebrew}
                          onChange={e => {
                            updateDish(ci, di, 'hebrew', e.target.value);
                            fetchSuggestions(e.target.value, menu.chef_id);
                            setActiveDishInput(`${ci}-${di}`);
                          }}
                          onBlur={() => setTimeout(() => { setActiveDishInput(null); setSuggestions([]); }, 200)}
                          className="h-7 text-sm text-right w-full"
                          dir="rtl"
                          placeholder="שם המנה בעברית"
                        />
                        {activeDishInput === `${ci}-${di}` && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden" dir="rtl">
                            {suggestions.map(s => (
                              <button
                                key={s.id}
                                onMouseDown={() => {
                                  updateDish(ci, di, 'hebrew', s.hebrew);
                                  updateDish(ci, di, 'english', s.english || '');
                                  setSuggestions([]);
                                }}
                                className="w-full text-right px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                              >
                                <span className="font-medium">{s.hebrew}</span>
                                {s.english && <span className="text-gray-400 text-xs ml-2">{s.english}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm">{dish.hebrew}</span>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center px-2 bg-gray-50">
                      <button onClick={() => removeDish(ci, di)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="px-4 py-2 bg-gray-50 border-t">
                <button onClick={() => addDish(ci)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Add Dish
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <button onClick={addCourse} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 w-full justify-center hover:border-gray-400 transition-colors">
          <Plus className="w-4 h-4" /> Add Course
        </button>
      )}

      {/* Internal Notes (manager/chef only) */}
      {isManager && (
        <div>
          <Label className="text-sm font-semibold text-gray-600">Internal Notes (not visible to client)</Label>
          <Textarea
            value={header.notes_internal}
            onChange={e => updateHeader({ ...header, notes_internal: e.target.value })}
            rows={2}
            className="mt-1 text-sm"
            placeholder="Private notes for chef/manager..."
          />
        </div>
      )}

      {/* Stage controls */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {saving && <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>}
        </div>
        {canEdit && NEXT_STAGE[menu.stage] && (
          <Button onClick={advanceStage} className="bg-blue-600 hover:bg-blue-700 text-sm">
            Submit for {STAGE_LABELS[NEXT_STAGE[menu.stage]]} →
          </Button>
        )}
      </div>
    </div>
  );
}