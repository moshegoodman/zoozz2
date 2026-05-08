import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Plus, Trash2, ChevronDown, ChevronUp, UtensilsCrossed } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChecklistEditor from './ChecklistEditor';

const uid = () => Math.random().toString(36).slice(2, 9);

const SERVICE_STYLES = [
  { value: 'plated', label: 'Plated' },
  { value: 'family_style', label: 'Family Style' },
  { value: 'buffet', label: 'Buffet' },
];

function coursesFromTemplate(template) {
  if (!template?.default_courses?.length) return [];
  return template.default_courses.map(c => ({
    id: uid(),
    title_english: c.title_english || '',
    title_hebrew: c.title_hebrew || '',
    dishes: (c.dishes || []).map(d => ({ id: uid(), english: d.english || '', hebrew: d.hebrew || '' })),
  }));
}

function DishCombobox({ value, onChange, suggestions, placeholder }) {
  const listId = React.useId();
  return (
    <div className="flex-1 relative">
      <input
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-6 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <datalist id={listId}>
        {suggestions.map((s, i) => <option key={i} value={s} />)}
      </datalist>
    </div>
  );
}

function CourseStructureEditor({ courses, onChange, dishSuggestions = [] }) {
  const addCourse = () =>
    onChange([...courses, { id: uid(), title_english: '', title_hebrew: '', dishes: [] }]);
  const removeCourse = (id) => onChange(courses.filter(c => c.id !== id));
  const updateCourse = (id, field, val) =>
    onChange(courses.map(c => c.id === id ? { ...c, [field]: val } : c));
  const addDish = (cid) =>
    onChange(courses.map(c => c.id === cid ? { ...c, dishes: [...(c.dishes || []), { id: uid(), english: '', hebrew: '' }] } : c));
  const removeDish = (cid, did) =>
    onChange(courses.map(c => c.id === cid ? { ...c, dishes: c.dishes.filter(d => d.id !== did) } : c));
  const updateDish = (cid, did, field, val) =>
    onChange(courses.map(c => c.id === cid
      ? { ...c, dishes: c.dishes.map(d => d.id === did ? { ...d, [field]: val } : d) }
      : c));

  return (
    <div className="space-y-2 mt-2">
      {courses.map((course) => (
        <div key={course.id} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-700 text-white px-3 py-1.5 flex items-center gap-2">
            <Input
              value={course.title_english}
              onChange={e => updateCourse(course.id, 'title_english', e.target.value)}
              placeholder="Course (English)"
              className="h-6 bg-gray-600 border-gray-500 text-white text-xs flex-1 placeholder:text-gray-400"
            />
            <Input
              value={course.title_hebrew}
              onChange={e => updateCourse(course.id, 'title_hebrew', e.target.value)}
              placeholder="שם קורס"
              className="h-6 bg-gray-600 border-gray-500 text-white text-xs flex-1 text-right placeholder:text-gray-400"
              dir="rtl"
            />
            <Select value={course.service_style || ''} onValueChange={v => updateCourse(course.id, 'service_style', v)}>
              <SelectTrigger className="h-6 text-xs w-32 bg-gray-600 border-gray-500 text-white">
                <SelectValue placeholder="Style..." />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={() => removeCourse(course.id)} className="text-gray-400 hover:text-red-400 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y bg-white">
            {(course.dishes || []).map(dish => (
            <div key={dish.id} className="flex items-center gap-2 px-3 py-1.5">
              <DishCombobox
                value={dish.english}
                onChange={v => updateDish(course.id, dish.id, 'english', v)}
                suggestions={dishSuggestions}
                placeholder="Dish option (English)"
              />
              <Input
                value={dish.hebrew}
                onChange={e => updateDish(course.id, dish.id, 'hebrew', e.target.value)}
                placeholder="שם מנה"
                className="h-6 text-xs flex-1 text-right"
                dir="rtl"
              />
              <Select
                value={dish.service_style || course.service_style || ''}
                onValueChange={v => updateDish(course.id, dish.id, 'service_style', v)}
              >
                <SelectTrigger className="h-6 text-xs w-28 flex-shrink-0">
                  <SelectValue placeholder="Style..." />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <input
                value={dish.note || ''}
                onChange={e => updateDish(course.id, dish.id, 'note', e.target.value)}
                placeholder="Note..."
                className="h-6 text-xs flex-1 rounded-md border border-input bg-transparent px-2 py-1 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <button onClick={() => removeDish(course.id, dish.id)} className="text-red-300 hover:text-red-500 flex-shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            ))}
            <div className="px-3 py-1">
              <button onClick={() => addDish(course.id)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add dish
              </button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addCourse} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 w-full justify-center hover:border-gray-400 transition-colors">
        <Plus className="w-3 h-3" /> Add Course
      </button>
    </div>
  );
}

function MealBlock({ label, styleValue, courses, onStyleChange, onCoursesChange, dishSuggestions }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gray-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-800">{label}</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={styleValue} onValueChange={onStyleChange}>
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue placeholder="Service style..." />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={() => setCollapsed(v => !v)} className="text-gray-400 hover:text-gray-600">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-2">
          <CourseStructureEditor courses={courses} onChange={onCoursesChange} dishSuggestions={dishSuggestions} />
        </CardContent>
      )}
    </Card>
  );
}

export default function MealStructureForm({ household, season, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dishSuggestions, setDishSuggestions] = useState([]);
  const [form, setForm] = useState({
    dinner_style: '', dinner_courses: [],
    lunch_style: '', lunch_courses: [],
    kiddush_style: '', kiddush_courses: [],
    toamia_checklist: [], kiddish_checklist: [],
  });

  useEffect(() => {
    if (!household?.id || !season?.id) return;
    load();
  }, [household?.id, season?.id]);

  const load = async () => {
    setLoading(true);
    const [tplList, dishLib] = await Promise.all([
      base44.entities.MealTypeTemplate.list('sort_order', 100),
      base44.entities.DishLibrary.list('-use_count', 200),
    ]);
    const suggestions = [...new Set((dishLib || []).map(d => d.english).filter(Boolean))];
    setDishSuggestions(suggestions);

    const findTpl = (kw) => tplList.find(t => (t.name || '').toLowerCase().includes(kw));
    const dinnerTpl = findTpl('dinner');
    const lunchTpl = findTpl('lunch');
    const kiddushTpl = findTpl('kiddush') || findTpl('kiddish');

    const existing = await base44.entities.ClientMenuProfile.filter({ household_id: household.id, season_id: season.id });

    if (existing?.length > 0) {
      const p = existing[0];
      setProfile(p);
      setForm({
        dinner_style: p.dinner_style || '',
        dinner_courses: p.dinner_courses?.length ? p.dinner_courses : coursesFromTemplate(dinnerTpl),
        lunch_style: p.lunch_style || '',
        lunch_courses: p.lunch_courses?.length ? p.lunch_courses : coursesFromTemplate(lunchTpl),
        kiddush_style: p.kiddush_style || '',
        kiddush_courses: p.kiddush_courses?.length ? p.kiddush_courses : coursesFromTemplate(kiddushTpl),
        toamia_checklist: p.toamia_checklist?.length ? p.toamia_checklist : (season.default_toamia_checklist || []),
        kiddish_checklist: p.kiddish_checklist?.length ? p.kiddish_checklist : (season.default_kiddish_checklist || []),
      });
    } else {
      setForm({
        dinner_style: '', dinner_courses: coursesFromTemplate(dinnerTpl),
        lunch_style: '', lunch_courses: coursesFromTemplate(lunchTpl),
        kiddush_style: '', kiddush_courses: coursesFromTemplate(kiddushTpl),
        toamia_checklist: season.default_toamia_checklist || [],
        kiddish_checklist: season.default_kiddish_checklist || [],
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { household_id: household.id, season_id: season.id, ...form };
    if (profile?.id) {
      await base44.entities.ClientMenuProfile.update(profile.id, payload);
    } else {
      const created = await base44.entities.ClientMenuProfile.create({ ...payload, onboarding_complete: false });
      setProfile(created);
    }
    setSaving(false);
    onSaved?.();
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const MEALS = [
    { label: 'Dinner', styleField: 'dinner_style', coursesField: 'dinner_courses' },
    { label: 'Lunch', styleField: 'lunch_style', coursesField: 'lunch_courses' },
    { label: 'Kiddush', styleField: 'kiddush_style', coursesField: 'kiddush_courses' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <UtensilsCrossed className="w-4 h-4 text-gray-600" />
        <h3 className="font-semibold text-gray-800">Household Meal Structure</h3>
        <span className="text-xs text-gray-400">— course & dish blueprint for the chef</span>
      </div>

      {MEALS.map(({ label, styleField, coursesField }) => (
        <MealBlock
          key={coursesField}
          label={label}
          styleValue={form[styleField]}
          courses={form[coursesField]}
          onStyleChange={v => setForm(p => ({ ...p, [styleField]: v }))}
          onCoursesChange={v => setForm(p => ({ ...p, [coursesField]: v }))}
          dishSuggestions={dishSuggestions}
        />
      ))}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Toamia Checklist</CardTitle></CardHeader>
          <CardContent>
            <ChecklistEditor items={form.toamia_checklist} onChange={v => setForm(p => ({ ...p, toamia_checklist: v }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Kiddish Checklist</CardTitle></CardHeader>
          <CardContent>
            <ChecklistEditor items={form.kiddish_checklist} onChange={v => setForm(p => ({ ...p, kiddish_checklist: v }))} />
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Meal Structure
      </Button>
    </div>
  );
}