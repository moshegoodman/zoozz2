import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Languages, Loader2, Image as ImageIcon, Search, X, StickyNote, ArrowUp, ArrowDown
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AllergyBanner from './AllergyBanner';
import MenuProgressStepper from './MenuProgressStepper';

const SERVICE_STYLES = [
  { value: 'plated', label: 'Plated' },
  { value: 'family_style', label: 'Family Style' },
  { value: 'buffet', label: 'Buffet' },
];

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
  const [translating, setTranslating] = useState({});
  const [showLibrary, setShowLibrary] = useState(false);
  const [dishLibrary, setDishLibrary] = useState([]);
  const [libSearch, setLibSearch] = useState('');
  const [libLoading, setLibLoading] = useState(false);
  const [targetDish, setTargetDish] = useState(null); // { ci, di }
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!showLibrary || dishLibrary.length > 0) return;
    setLibLoading(true);
    base44.entities.DishLibrary.list('-use_count', 300).then(d => {
      setDishLibrary(d || []);
      setLibLoading(false);
    });
  }, [showLibrary]);

  const filteredLib = dishLibrary.filter(d => {
    if (!libSearch) return true;
    const q = libSearch.toLowerCase();
    return d.hebrew?.includes(libSearch) || d.english?.toLowerCase().includes(q);
  });

  const attachFromLibrary = (dish) => {
    if (!targetDish) return;
    const { ci, di } = targetDish;
    const newCourses = courses.map((c, cIdx) =>
      cIdx !== ci ? c : {
        ...c,
        dishes: c.dishes.map((d, dIdx) =>
          dIdx !== di ? d : { ...d, chef_dish_hebrew: dish.hebrew || '', chef_dish_english: dish.english || '' }
        )
      }
    );
    updateCourses(newCourses);
    setShowLibrary(false);
    setTargetDish(null);
    setLibSearch('');
  };

  const save = useCallback(async (newCourses, newHeader) => {
    setSaving(true);
    await base44.entities.Menu.update(menu.id, { courses: newCourses, ...newHeader });
    setSaving(false);
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

  const translateChefDish = async (courseIdx, dishIdx) => {
    const dish = courses[courseIdx].dishes[dishIdx];
    const dishKey = dish.id;
    setTranslating(p => ({ ...p, [dishKey]: true }));
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate this Hebrew dish name to English for a high-end kosher menu. Return ONLY the English translation, nothing else.\n\nHebrew: ${dish.chef_dish_hebrew}`,
      });
      const newCourses = courses.map((c, ci) =>
        ci !== courseIdx ? c : {
          ...c,
          dishes: c.dishes.map((d, di) =>
            di !== dishIdx ? d : { ...d, chef_dish_english: result }
          )
        }
      );
      updateCourses(newCourses);
      await base44.entities.DishLibrary.create({
        chef_id: menu.chef_id,
        hebrew: dish.chef_dish_hebrew,
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
      i !== ci ? c : {
        ...c,
        dishes: [...c.dishes, {
          id: uid(),
          hebrew: '',
          english: '',
          note: '',
          chef_dish_hebrew: '',
          chef_dish_english: '',
          dish_note: '',
          photo_url: '',
        }]
      }
    );
    updateCourses(newCourses);
  };

  const removeDish = (ci, di) => {
    const newCourses = courses.map((c, i) =>
      i !== ci ? c : { ...c, dishes: c.dishes.filter((_, j) => j !== di) }
    );
    updateCourses(newCourses);
  };

  const moveDish = (ci, di, direction) => {
    const newCourses = courses.map((c, i) => {
      if (i !== ci) return c;
      const dishes = [...c.dishes];
      const newIndex = di + direction;
      if (newIndex < 0 || newIndex >= dishes.length) return c;
      [dishes[di], dishes[newIndex]] = [dishes[newIndex], dishes[di]];
      return { ...c, dishes };
    });
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

      {/* Courses */}
      <div className="space-y-4">
        {courses.map((course, ci) => (
          <div key={course.id} className="border rounded-xl overflow-hidden shadow-sm">

            {/* Course header */}
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
                    placeholder="שם הקורס"
                  />
                  <Select
                    value={course.service_style || ''}
                    onValueChange={v => {
                      const nc = courses.map((c, i) => i !== ci ? c : { ...c, service_style: v });
                      updateCourses(nc);
                    }}
                  >
                    <SelectTrigger className="h-7 w-32 bg-gray-700 border-gray-600 text-white text-xs">
                      <SelectValue placeholder="Style..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_STYLES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={() => removeCourse(ci)} className="text-gray-400 hover:text-red-400 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex w-full justify-between items-center">
                  <span className="font-semibold">{course.title_english}</span>
                  {course.service_style && (
                    <span className="text-xs bg-gray-600 text-gray-200 px-2 py-0.5 rounded-full capitalize">
                      {SERVICE_STYLES.find(s => s.value === course.service_style)?.label || course.service_style}
                    </span>
                  )}
                  <span className="font-semibold" dir="rtl">{course.title_hebrew}</span>
                </div>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_1fr] bg-gray-100 border-b text-xs text-gray-500 font-semibold">
              <div className="px-3 py-1.5 border-r">Dish Option</div>
              <div className="px-3 py-1.5 border-r">Chef's Dish (English)</div>
              <div className="px-3 py-1.5 text-right" dir="rtl">מנת השף (עברית)</div>
            </div>

            {/* Dish rows */}
            <div className="divide-y">
              {course.dishes.map((dish, di) => (
                <div key={dish.id} className="flex flex-col">
                  <div className="grid grid-cols-[1fr_1fr_1fr] items-start">

                    {/* Col 1: Dish Option (from onboarding) — read-only label */}
                    <div className="px-3 py-2.5 bg-gray-50 border-r">
                      <div className="text-sm font-medium text-gray-700">{dish.english || dish.hebrew || <span className="text-gray-300 italic text-xs">—</span>}</div>
                      {dish.english && dish.hebrew && (
                        <div className="text-xs text-gray-400 mt-0.5" dir="rtl">{dish.hebrew}</div>
                      )}
                      {dish.service_style && (
                        <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded capitalize">
                          {SERVICE_STYLES.find(s => s.value === dish.service_style)?.label || dish.service_style}
                        </span>
                      )}
                      {dish.note && (
                        <div className="mt-1.5 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded px-2 py-1">
                          {dish.note}
                        </div>
                      )}

                    </div>

                    {/* Col 2: Chef's dish in English */}
                    <div className="px-3 py-2.5 bg-white border-r">
                      {dish.note && (
                        <div className="flex items-center gap-1 mb-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          <StickyNote className="w-3 h-3 flex-shrink-0 text-amber-500" />
                          <span className="font-medium">{dish.note}</span>
                        </div>
                      )}
                      {canEdit ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <Input
                              value={dish.chef_dish_english || ''}
                              onChange={e => updateDish(ci, di, 'chef_dish_english', e.target.value)}
                              className="h-7 text-sm flex-1"
                              placeholder="e.g. Tuna Tartare with Mango"
                            />
                            <button
                              onClick={() => { setTargetDish({ ci, di }); setShowLibrary(true); }}
                              className="flex items-center gap-1 text-xs px-1.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 whitespace-nowrap flex-shrink-0"
                              title="Search dish library"
                            >
                              <Search className="w-3 h-3" />
                            </button>
                          </div>
                          {/* Chef note */}
                          <div className="flex items-center gap-1">
                            <StickyNote className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            <Input
                              value={dish.dish_note || ''}
                              onChange={e => updateDish(ci, di, 'dish_note', e.target.value)}
                              className="h-6 text-xs border-0 shadow-none bg-transparent focus-visible:ring-0 p-0"
                              placeholder="Chef note..."
                            />
                          </div>
                          {/* Photo */}
                          <div className="flex items-center gap-2">
                            {dish.photo_url && <img src={dish.photo_url} alt="dish" className="w-10 h-10 rounded object-cover" />}
                            <label className="cursor-pointer flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                              <ImageIcon className="w-3 h-3" />
                              {dish.photo_url ? 'Change' : 'Photo'}
                              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleDishPhotoUpload(ci, di, e.target.files[0])} />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {dish.note && (
                            <div className="flex items-center gap-1 mb-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              <StickyNote className="w-3 h-3 flex-shrink-0 text-amber-500" />
                              <span className="font-medium">{dish.note}</span>
                            </div>
                          )}
                          <span className="text-sm">{dish.chef_dish_english}</span>
                          {dish.dish_note && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 italic">
                              <StickyNote className="w-3 h-3 flex-shrink-0" />{dish.dish_note}
                            </div>
                          )}
                          {dish.photo_url && <img src={dish.photo_url} alt="dish" className="w-14 h-14 rounded object-cover mt-1" />}
                        </div>
                      )}
                    </div>

                    {/* Col 3: Chef's dish in Hebrew */}
                    <div className="px-3 py-2.5 bg-amber-50" dir="rtl">
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={dish.chef_dish_hebrew || ''}
                            onChange={e => updateDish(ci, di, 'chef_dish_hebrew', e.target.value)}
                            className="h-7 text-sm text-right flex-1"
                            dir="rtl"
                            placeholder="למשל: טונה טארטר עם מנגו"
                          />
                          <button
                            onClick={() => translateChefDish(ci, di)}
                            disabled={translating[dish.id] || !dish.chef_dish_hebrew}
                            className="flex items-center gap-1 text-xs px-1.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                            title="Translate to English"
                          >
                            {translating[dish.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm">{dish.chef_dish_hebrew}</span>
                      )}
                    </div>
                  </div>

                  {/* Delete row */}
                  {canEdit && (
                    <div className="flex items-center justify-between px-3 py-1 bg-gray-50 border-t border-dashed border-gray-200">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveDish(ci, di, -1)}
                          disabled={di === 0}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveDish(ci, di, 1)}
                          disabled={di === course.dishes.length - 1}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button onClick={() => removeDish(ci, di)} className="text-red-300 hover:text-red-500">
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
                  <Plus className="w-3.5 h-3.5" /> Add Dish Option
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

      {/* Internal Notes */}
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

      {/* Dish Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLibrary(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-gray-800">Dish Library</span>
              <button onClick={() => setShowLibrary(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-700" /></button>
            </div>
            <div className="px-4 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  autoFocus
                  value={libSearch}
                  onChange={e => setLibSearch(e.target.value)}
                  placeholder="Search by Hebrew or English..."
                  className="pl-9 h-9"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {libLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}
              {!libLoading && filteredLib.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400">No dishes found.</div>
              )}
              {filteredLib.map(d => (
                <button
                  key={d.id}
                  onClick={() => attachFromLibrary(d)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 border-b border-gray-50 text-left"
                >
                  <span className="text-sm font-medium text-gray-800" dir="rtl">{d.hebrew}</span>
                  <span className="text-xs text-gray-400">{d.english}</span>
                </button>
              ))}
            </div>
          </div>
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