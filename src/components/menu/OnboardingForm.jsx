import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, AlertTriangle, User, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChecklistEditor from './ChecklistEditor';

const uid = () => Math.random().toString(36).slice(2, 9);

const SERVICE_STYLES = [
  { value: 'plated', label: 'Plated' },
  { value: 'family_style', label: 'Family Style' },
  { value: 'buffet', label: 'Buffet' },
];

// Build course structure from a MealTypeTemplate
function coursesFromTemplate(template) {
  if (!template?.default_courses?.length) return [];
  return template.default_courses.map(c => ({
    id: uid(),
    title_english: c.title_english || '',
    title_hebrew: c.title_hebrew || '',
    dishes: (c.dishes || []).map(d => ({ id: uid(), english: d.english || '', hebrew: d.hebrew || '' })),
  }));
}

// Inline course structure editor
function CourseStructureEditor({ courses, onChange }) {
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
      {courses.map((course, ci) => (
        <div key={course.id} className="border rounded-lg overflow-hidden">
          {/* Course header */}
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
            <button onClick={() => removeCourse(course.id)} className="text-gray-400 hover:text-red-400 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Dishes */}
          <div className="divide-y bg-white">
            {(course.dishes || []).map(dish => (
              <div key={dish.id} className="flex items-center gap-2 px-3 py-1.5">
                <Input
                  value={dish.english}
                  onChange={e => updateDish(course.id, dish.id, 'english', e.target.value)}
                  placeholder="Dish name (English)"
                  className="h-6 text-xs flex-1"
                />
                <Input
                  value={dish.hebrew}
                  onChange={e => updateDish(course.id, dish.id, 'hebrew', e.target.value)}
                  placeholder="שם מנה"
                  className="h-6 text-xs flex-1 text-right"
                  dir="rtl"
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

// One meal block (Dinner / Lunch / Kiddush)
function MealBlock({ label, styleField, coursesField, styleValue, courses, onStyleChange, onCoursesChange }) {
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
                {SERVICE_STYLES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={() => setCollapsed(v => !v)} className="text-gray-400 hover:text-gray-600">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {styleValue && (
          <p className="text-xs text-gray-500 mt-0.5">
            Style: <span className="font-medium capitalize">{SERVICE_STYLES.find(s => s.value === styleValue)?.label}</span>
            {' · '}{courses.length} course{courses.length !== 1 ? 's' : ''}
          </p>
        )}
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-2">
          <CourseStructureEditor courses={courses} onChange={onCoursesChange} />
        </CardContent>
      )}
    </Card>
  );
}

export default function OnboardingForm({ household, season, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState({ dinner: null, lunch: null, kiddush: null });
  const [form, setForm] = useState({
    allergy_header: '',
    dinner_courses: [],
    dinner_style: '',
    lunch_courses: [],
    lunch_style: '',
    kiddush_courses: [],
    kiddush_style: '',
    // keep legacy text fields for backward compat
    dinner_default: '',
    lunch_default: '',
    kiddush_default: '',
    toamia_checklist: [],
    kiddish_checklist: [],
    nudge_notifications_enabled: false,
    nudge_whatsapp: '',
    nudge_email: '',
  });

  useEffect(() => {
    if (!household?.id || !season?.id) return;
    loadProfile();
  }, [household?.id, season?.id]);

  const loadProfile = async () => {
    setLoading(true);

    const tplList = await base44.entities.MealTypeTemplate.list('sort_order', 100);
    const findTpl = (kw) => tplList.find(t => (t.name || '').toLowerCase().includes(kw));
    const dinnerTpl = findTpl('dinner');
    const lunchTpl = findTpl('lunch');
    const kiddushTpl = findTpl('kiddush') || findTpl('kiddish');
    setTemplates({ dinner: dinnerTpl, lunch: lunchTpl, kiddush: kiddushTpl });

    const existing = await base44.entities.ClientMenuProfile.filter({
      household_id: household.id,
      season_id: season.id,
    });

    if (existing?.length > 0) {
      const p = existing[0];
      setProfile(p);
      setForm({
        allergy_header: p.allergy_header || '',
        dinner_courses: p.dinner_courses?.length ? p.dinner_courses : coursesFromTemplate(dinnerTpl),
        dinner_style: p.dinner_style || '',
        lunch_courses: p.lunch_courses?.length ? p.lunch_courses : coursesFromTemplate(lunchTpl),
        lunch_style: p.lunch_style || '',
        kiddush_courses: p.kiddush_courses?.length ? p.kiddush_courses : coursesFromTemplate(kiddushTpl),
        kiddush_style: p.kiddush_style || '',
        dinner_default: p.dinner_default || '',
        lunch_default: p.lunch_default || '',
        kiddush_default: p.kiddush_default || '',
        toamia_checklist: p.toamia_checklist?.length ? p.toamia_checklist : (season.default_toamia_checklist || []),
        kiddish_checklist: p.kiddish_checklist?.length ? p.kiddish_checklist : (season.default_kiddish_checklist || []),
        nudge_notifications_enabled: p.nudge_notifications_enabled || false,
        nudge_whatsapp: p.nudge_whatsapp || '',
        nudge_email: p.nudge_email || '',
      });
    } else {
      setForm(prev => ({
        ...prev,
        dinner_courses: coursesFromTemplate(dinnerTpl),
        lunch_courses: coursesFromTemplate(lunchTpl),
        kiddush_courses: coursesFromTemplate(kiddushTpl),
        toamia_checklist: season.default_toamia_checklist || [],
        kiddish_checklist: season.default_kiddish_checklist || [],
      }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      household_id: household.id,
      season_id: season.id,
      ...form,
      onboarding_complete: true,
    };
    if (profile?.id) {
      await base44.entities.ClientMenuProfile.update(profile.id, payload);
    } else {
      const created = await base44.entities.ClientMenuProfile.create(payload);
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
    <div className="space-y-6">
      {/* Allergy Header */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Allergy / Health Alert Header
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={form.allergy_header}
            onChange={e => setForm(p => ({ ...p, allergy_header: e.target.value }))}
            placeholder="e.g. Nut allergy, Gluten-free required, Dairy-free..."
            className="bg-white border-red-300 focus:border-red-500"
          />
          <p className="text-xs text-red-600 mt-1">⚠ This will appear as a sticky red banner on every menu screen for this client.</p>
        </CardContent>
      </Card>

      {/* Meal Structure Defaults */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold text-gray-800">Household Meal Structure</h3>
          <span className="text-xs text-gray-400">— pulled from meal type templates · edit to match this household</span>
        </div>
        <div className="space-y-4">
          {MEALS.map(({ label, styleField, coursesField }) => (
            <MealBlock
              key={coursesField}
              label={label}
              styleField={styleField}
              coursesField={coursesField}
              styleValue={form[styleField]}
              courses={form[coursesField]}
              onStyleChange={v => setForm(p => ({ ...p, [styleField]: v }))}
              onCoursesChange={v => setForm(p => ({ ...p, [coursesField]: v }))}
            />
          ))}
        </div>
      </div>

      {/* Checklists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Toamia Checklist</CardTitle></CardHeader>
          <CardContent>
            <ChecklistEditor
              items={form.toamia_checklist}
              onChange={v => setForm(p => ({ ...p, toamia_checklist: v }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Kiddish Checklist</CardTitle></CardHeader>
          <CardContent>
            <ChecklistEditor
              items={form.kiddish_checklist}
              onChange={v => setForm(p => ({ ...p, kiddish_checklist: v }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Nudge Notifications */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Automated Nudge Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.nudge_notifications_enabled}
              onCheckedChange={v => setForm(p => ({ ...p, nudge_notifications_enabled: v }))}
            />
            <Label>Send reminder if menu is pending review for &gt;24 hours</Label>
          </div>
          {form.nudge_notifications_enabled && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label>WhatsApp Number</Label>
                <Input value={form.nudge_whatsapp} onChange={e => setForm(p => ({ ...p, nudge_whatsapp: e.target.value }))} placeholder="+1234567890" className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.nudge_email} onChange={e => setForm(p => ({ ...p, nudge_email: e.target.value }))} placeholder="client@example.com" className="mt-1" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Client Profile
      </Button>
    </div>
  );
}