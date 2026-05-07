import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Save, X, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ChecklistEditor from './ChecklistEditor';

const uid = () => Math.random().toString(36).slice(2, 9);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbos'];

const COLORS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Indigo', value: '#6366f1' },
];

const emptyTemplate = {
  name: '',
  name_hebrew: '',
  day_of_week_trigger: [],
  default_courses: [],
  default_toamia_checklist: [],
  default_kiddish_checklist: [],
  color: '#3b82f6',
  sort_order: 0,
};

function CourseEditor({ courses, onChange }) {
  const addCourse = () => {
    onChange([...courses, { id: uid(), title_english: '', title_hebrew: '', dishes: [] }]);
  };
  const removeCourse = (id) => onChange(courses.filter(c => c.id !== id));
  const updateCourse = (id, field, val) =>
    onChange(courses.map(c => c.id === id ? { ...c, [field]: val } : c));
  const addDish = (courseId) => {
    onChange(courses.map(c => c.id === courseId
      ? { ...c, dishes: [...(c.dishes || []), { id: uid(), hebrew: '', english: '' }] }
      : c));
  };
  const removeDish = (courseId, dishId) => {
    onChange(courses.map(c => c.id === courseId
      ? { ...c, dishes: c.dishes.filter(d => d.id !== dishId) }
      : c));
  };
  const updateDish = (courseId, dishId, field, val) => {
    onChange(courses.map(c => c.id === courseId
      ? { ...c, dishes: c.dishes.map(d => d.id === dishId ? { ...d, [field]: val } : d) }
      : c));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Default Courses / Menu Structure</Label>
        <Button size="sm" variant="outline" onClick={addCourse} className="h-7 px-2 gap-1 text-xs">
          <Plus className="w-3 h-3" /> Add Course
        </Button>
      </div>
      {courses.map((course, ci) => (
        <div key={course.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="flex gap-2 items-center">
            <Input
              value={course.title_english}
              onChange={e => updateCourse(course.id, 'title_english', e.target.value)}
              placeholder="Course name (English)"
              className="h-7 text-xs flex-1"
            />
            <Input
              value={course.title_hebrew}
              onChange={e => updateCourse(course.id, 'title_hebrew', e.target.value)}
              placeholder="שם הקורס"
              className="h-7 text-xs flex-1 text-right"
              dir="rtl"
            />
            <button onClick={() => removeCourse(course.id)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 pl-2">
            {(course.dishes || []).map(dish => (
              <div key={dish.id} className="flex gap-2 items-center">
                <Input
                  value={dish.english}
                  onChange={e => updateDish(course.id, dish.id, 'english', e.target.value)}
                  placeholder="Dish (English)"
                  className="h-6 text-xs flex-1"
                />
                <Input
                  value={dish.hebrew}
                  onChange={e => updateDish(course.id, dish.id, 'hebrew', e.target.value)}
                  placeholder="שם מנה"
                  className="h-6 text-xs flex-1 text-right"
                  dir="rtl"
                />
                <button onClick={() => removeDish(course.id, dish.id)} className="text-red-300 hover:text-red-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button onClick={() => addDish(course.id)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add dish
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateForm({ template, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...emptyTemplate, ...template });

  const toggleDay = (d) => {
    const curr = form.day_of_week_trigger || [];
    setForm(p => ({
      ...p,
      day_of_week_trigger: curr.includes(d) ? curr.filter(x => x !== d) : [...curr, d],
    }));
  };

  return (
    <Card className="border-blue-200 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{template?.id ? 'Edit Meal Type' : 'New Meal Type'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Name (English) *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Friday Night Dinner" className="mt-1 h-8" />
          </div>
          <div>
            <Label className="text-xs">Name (Hebrew)</Label>
            <Input value={form.name_hebrew} onChange={e => setForm(p => ({ ...p, name_hebrew: e.target.value }))} placeholder="ארוחת ליל שישי" className="mt-1 h-8 text-right" dir="rtl" />
          </div>
        </div>

        {/* Day triggers */}
        <div>
          <Label className="text-xs mb-1 block">Auto-suggest on days of week</Label>
          <div className="flex gap-1 flex-wrap">
            {DAY_NAMES.map((d, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  (form.day_of_week_trigger || []).includes(i)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <Label className="text-xs mb-1 block">Calendar Color</Label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setForm(p => ({ ...p, color: c.value }))}
                className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Courses */}
        <CourseEditor
          courses={form.default_courses || []}
          onChange={v => setForm(p => ({ ...p, default_courses: v }))}
        />

        {/* Checklists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
          <ChecklistEditor
            label="Default Toamia Checklist"
            items={form.default_toamia_checklist || []}
            onChange={v => setForm(p => ({ ...p, default_toamia_checklist: v }))}
          />
          <ChecklistEditor
            label="Default Kiddish Checklist"
            items={form.default_kiddish_checklist || []}
            onChange={v => setForm(p => ({ ...p, default_kiddish_checklist: v }))}
          />
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={() => onSave(form)} disabled={saving || !form.name} className="bg-blue-600 hover:bg-blue-700 h-8 text-sm">
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Save
          </Button>
          <Button variant="outline" onClick={onCancel} className="h-8 text-sm">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MealTypeManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.MealTypeTemplate.list('sort_order', 100);
    setTemplates(data || []);
    setLoading(false);
  };

  const handleSave = async (form) => {
    setSaving(true);
    if (editingTemplate?.id) {
      await base44.entities.MealTypeTemplate.update(editingTemplate.id, form);
    } else {
      await base44.entities.MealTypeTemplate.create(form);
    }
    setSaving(false);
    setShowForm(false);
    setEditingTemplate(null);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this meal type template?')) return;
    await base44.entities.MealTypeTemplate.delete(id);
    await load();
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs text-gray-500">Define reusable meal types with default courses and checklists. These are used as blueprints when building the season calendar.</p>
        </div>
        <Button size="sm" onClick={() => { setEditingTemplate(null); setShowForm(true); }} className="gap-1 bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="w-4 h-4" /> New Meal Type
        </Button>
      </div>

      {showForm && (
        <TemplateForm
          template={editingTemplate || {}}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingTemplate(null); }}
          saving={saving}
        />
      )}

      <div className="space-y-2">
        {templates.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No meal type templates yet. Create your first one above.</p>}
        {templates.map(t => (
          <div key={t.id} className="border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#3b82f6' }} />
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  {t.name_hebrew && <p className="text-xs text-gray-400" dir="rtl">{t.name_hebrew}</p>}
                </div>
                <div className="flex gap-1">
                  {(t.day_of_week_trigger || []).map(d => (
                    <Badge key={d} variant="outline" className="text-[10px] px-1 py-0">{DAY_NAMES[d]}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{(t.default_courses || []).length} courses · {(t.default_toamia_checklist || []).length} toamia items</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setEditingTemplate(t); setShowForm(true); }}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={e => { e.stopPropagation(); handleDelete(t.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {expandedId === t.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>
            {expandedId === t.id && (
              <div className="border-t bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">Courses</h5>
                  {(t.default_courses || []).length === 0 && <p className="text-xs text-gray-400">No courses defined</p>}
                  {(t.default_courses || []).map((c, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-xs font-medium text-gray-700">{c.title_english} {c.title_hebrew && <span dir="rtl" className="text-gray-400">/ {c.title_hebrew}</span>}</p>
                      {(c.dishes || []).map((d, j) => (
                        <p key={j} className="text-xs text-gray-500 pl-2">• {d.english} {d.hebrew && <span dir="rtl">/ {d.hebrew}</span>}</p>
                      ))}
                    </div>
                  ))}
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">Toamia Checklist ({(t.default_toamia_checklist || []).length})</h5>
                  {(t.default_toamia_checklist || []).map((item, i) => (
                    <p key={i} className="text-xs text-gray-500">• {item.english} <span dir="rtl" className="text-gray-400">{item.hebrew}</span></p>
                  ))}
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">Kiddish Checklist ({(t.default_kiddish_checklist || []).length})</h5>
                  {(t.default_kiddish_checklist || []).map((item, i) => (
                    <p key={i} className="text-xs text-gray-500">• {item.english} <span dir="rtl" className="text-gray-400">{item.hebrew}</span></p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}