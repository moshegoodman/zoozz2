import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, AlertTriangle, User, Plus, Trash2, ChevronDown, ChevronUp, Phone, MapPin, Users, Calendar, UtensilsCrossed } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChecklistEditor from './ChecklistEditor';

const uid = () => Math.random().toString(36).slice(2, 9);

const SERVICE_STYLES = [
{ value: 'plated', label: 'Plated' },
{ value: 'family_style', label: 'Family Style' },
{ value: 'buffet', label: 'Buffet' }];


function coursesFromTemplate(template) {
  if (!template?.default_courses?.length) return [];
  return template.default_courses.map((c) => ({
    id: uid(),
    title_english: c.title_english || '',
    title_hebrew: c.title_hebrew || '',
    dishes: (c.dishes || []).map((d) => ({ id: uid(), english: d.english || '', hebrew: d.hebrew || '' }))
  }));
}

function DishCombobox({ value, onChange, suggestions, placeholder, className }) {
  const listId = React.useId();
  return (
    <div className="flex-1 relative">
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex h-6 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className || ''}`} />
      
      <datalist id={listId}>
        {suggestions.map((s, i) => <option key={i} value={s} />)}
      </datalist>
    </div>);

}

function CourseStructureEditor({ courses, onChange, dishSuggestions = [] }) {
  const addCourse = () =>
  onChange([...courses, { id: uid(), title_english: '', title_hebrew: '', dishes: [] }]);
  const removeCourse = (id) => onChange(courses.filter((c) => c.id !== id));
  const updateCourse = (id, field, val) =>
  onChange(courses.map((c) => c.id === id ? { ...c, [field]: val } : c));
  const addDish = (cid) =>
  onChange(courses.map((c) => c.id === cid ? { ...c, dishes: [...(c.dishes || []), { id: uid(), english: '', hebrew: '' }] } : c));
  const removeDish = (cid, did) =>
  onChange(courses.map((c) => c.id === cid ? { ...c, dishes: c.dishes.filter((d) => d.id !== did) } : c));
  const updateDish = (cid, did, field, val) =>
  onChange(courses.map((c) => c.id === cid ?
  { ...c, dishes: c.dishes.map((d) => d.id === did ? { ...d, [field]: val } : d) } :
  c));

  return (
    <div className="space-y-2 mt-2">
      {courses.map((course) =>
      <div key={course.id} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-700 text-white px-3 py-1.5 flex items-center gap-2">
            <Input
            value={course.title_english}
            onChange={(e) => updateCourse(course.id, 'title_english', e.target.value)}
            placeholder="Course (English)"
            className="h-6 bg-gray-600 border-gray-500 text-white text-xs flex-1 placeholder:text-gray-400" />
          
            <Input
            value={course.title_hebrew}
            onChange={(e) => updateCourse(course.id, 'title_hebrew', e.target.value)}
            placeholder="שם קורס"
            className="h-6 bg-gray-600 border-gray-500 text-white text-xs flex-1 text-right placeholder:text-gray-400"
            dir="rtl" />
          
            <Select value={course.service_style || ''} onValueChange={(v) => updateCourse(course.id, 'service_style', v)}>
              <SelectTrigger className="h-6 text-xs w-32 bg-gray-600 border-gray-500 text-white">
                <SelectValue placeholder="Style..." />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_STYLES.map((s) =>
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              )}
              </SelectContent>
            </Select>
            <button onClick={() => removeCourse(course.id)} className="text-gray-400 hover:text-red-400 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y bg-white">
            {(course.dishes || []).map((dish) =>
          <div key={dish.id} className="flex items-center gap-2 px-3 py-1.5">
                <DishCombobox
              value={dish.english}
              onChange={(v) => updateDish(course.id, dish.id, 'english', v)}
              suggestions={dishSuggestions}
              placeholder="Dish name (English)" />
            
                <Input
              value={dish.hebrew}
              onChange={(e) => updateDish(course.id, dish.id, 'hebrew', e.target.value)}
              placeholder="שם מנה"
              className="h-6 text-xs flex-1 text-right"
              dir="rtl" />
            
                <Select
              value={dish.service_style || course.service_style || ''}
              onValueChange={(v) => updateDish(course.id, dish.id, 'service_style', v)}>
              
                  <SelectTrigger className="h-6 text-xs w-28 flex-shrink-0">
                    <SelectValue placeholder="Style..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_STYLES.map((s) =>
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                )}
                  </SelectContent>
                </Select>
                <button onClick={() => removeDish(course.id, dish.id)} className="text-red-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
          )}
            <div className="px-3 py-1">
              <button onClick={() => addDish(course.id)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add dish
              </button>
            </div>
          </div>
        </div>
      )}
      <button onClick={addCourse} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 w-full justify-center hover:border-gray-400 transition-colors">
        <Plus className="w-3 h-3" /> Add Course
      </button>
    </div>);

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
                {SERVICE_STYLES.map((s) =>
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <button onClick={() => setCollapsed((v) => !v)} className="text-gray-400 hover:text-gray-600">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </CardHeader>
      {!collapsed &&
      <CardContent className="pt-2">
          <CourseStructureEditor courses={courses} onChange={onCoursesChange} dishSuggestions={dishSuggestions} />
        </CardContent>
      }
    </Card>);

}

function SectionCard({ icon: Icon, title, children, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <Card>
      <CardHeader className="pb-2 bg-gray-50 cursor-pointer" onClick={() => setCollapsed((v) => !v)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-gray-500" />}
            {title}
          </CardTitle>
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="pt-4 space-y-3">{children}</CardContent>}
    </Card>);

}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs text-gray-500 mb-1 block">{label}</Label>
      {children}
    </div>);

}

function Row({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function StaffRow({ label, qtyKey, nameKey, form, setForm }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</span>
      <Input
        type="number"
        min={0}
        value={form[qtyKey] || ''}
        onChange={(e) => setForm((p) => ({ ...p, [qtyKey]: e.target.value ? Number(e.target.value) : undefined }))}
        placeholder="QTY"
        className="h-7 text-xs w-16" />
      
      {nameKey &&
      <Input
        value={form[nameKey] || ''}
        onChange={(e) => setForm((p) => ({ ...p, [nameKey]: e.target.value }))}
        placeholder="Name"
        className="h-7 text-xs flex-1" />

      }
    </div>);

}

const EMPTY_FORM = {
  family_name: '', husband_name: '', wife_name: '',
  email_address: '', phone_number: '', israeli_phone_number: '',
  event: '', location_of_event: '', location_access_info: '',
  own_or_rent: '', date_to_access_home: '',
  contact_name: '', contact_relation: '', contact_phone: '',
  staff_chef_qty: undefined, staff_chef_name: '',
  staff_cook_qty: undefined, staff_cook_name: '',
  staff_house_manager_qty: undefined, staff_house_manager_name: '',
  staff_waiter_qty: undefined, staff_waiter_name: '',
  staff_housekeeping_notes: '', staff_foreign_housekeeping: '',
  staff_security_qty: undefined, staff_bartenders_qty: undefined,
  staff_notes: '',
  arrival_date: '', departure_date: '',
  kashrut: '', has_allergy: false, allergy_who: '', allergy_what: '',
  dietary_restrictions: '',
  house_stocked: false, house_stocked_notes: '', high_chair_cribs: '',
  keeps_2_days: '', soft_drinks: '', wine_list: '',
  has_dishes: '', designer_flowers_cloth: '', kitchen_utensils: '',
  fridge_freezer_rental: '', special_requests: '',
  allergy_header: '',
  dinner_courses: [], dinner_style: '',
  lunch_courses: [], lunch_style: '',
  kiddush_courses: [], kiddush_style: '',
  dinner_default: '', lunch_default: '', kiddush_default: '',
  toamia_checklist: [], kiddish_checklist: [],
  nudge_notifications_enabled: false, nudge_whatsapp: '', nudge_email: ''
};

export default function OnboardingForm({ household, season, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dishSuggestions, setDishSuggestions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!household?.id || !season?.id) return;
    loadProfile();
  }, [household?.id, season?.id]);

  const loadProfile = async () => {
    setLoading(true);
    const [tplList, dishLib] = await Promise.all([
    base44.entities.MealTypeTemplate.list('sort_order', 100),
    base44.entities.DishLibrary.list('-use_count', 200)]
    );
    const suggestions = [...new Set((dishLib || []).map((d) => d.english).filter(Boolean))];
    setDishSuggestions(suggestions);

    const findTpl = (kw) => tplList.find((t) => (t.name || '').toLowerCase().includes(kw));
    const dinnerTpl = findTpl('dinner');
    const lunchTpl = findTpl('lunch');
    const kiddushTpl = findTpl('kiddush') || findTpl('kiddish');

    const existing = await base44.entities.ClientMenuProfile.filter({
      household_id: household.id,
      season_id: season.id
    });

    if (existing?.length > 0) {
      const p = existing[0];
      setProfile(p);
      setForm({
        ...EMPTY_FORM,
        ...p,
        dinner_courses: p.dinner_courses?.length ? p.dinner_courses : coursesFromTemplate(dinnerTpl),
        lunch_courses: p.lunch_courses?.length ? p.lunch_courses : coursesFromTemplate(lunchTpl),
        kiddush_courses: p.kiddush_courses?.length ? p.kiddush_courses : coursesFromTemplate(kiddushTpl),
        toamia_checklist: p.toamia_checklist?.length ? p.toamia_checklist : season.default_toamia_checklist || [],
        kiddish_checklist: p.kiddish_checklist?.length ? p.kiddish_checklist : season.default_kiddish_checklist || []
      });
    } else {
      setForm((prev) => ({
        ...prev,
        dinner_courses: coursesFromTemplate(dinnerTpl),
        lunch_courses: coursesFromTemplate(lunchTpl),
        kiddush_courses: coursesFromTemplate(kiddushTpl),
        toamia_checklist: season.default_toamia_checklist || [],
        kiddish_checklist: season.default_kiddish_checklist || []
      }));
    }
    setLoading(false);
  };

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target ? e.target.value : e }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { household_id: household.id, season_id: season.id, ...form, onboarding_complete: true };
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

  return (
    <div className="space-y-4">

      {/* Contact Info */}
      <SectionCard icon={User} title="Contact Info">
        <Row>
          <Field label="Family Name">
            <Input value={form.family_name} onChange={set('family_name')} placeholder="e.g. Rosenberg" className="h-8 text-sm" />
          </Field>
          <Field label="Email Address">
            <Input value={form.email_address} onChange={set('email_address')} placeholder="email@example.com" className="h-8 text-sm" />
          </Field>
        </Row>
        <Row>
          <Field label="Husband Name">
            <Input value={form.husband_name} onChange={set('husband_name')} placeholder="Husband" className="h-8 text-sm" />
          </Field>
          <Field label="Wife Name">
            <Input value={form.wife_name} onChange={set('wife_name')} placeholder="Wife" className="h-8 text-sm" />
          </Field>
        </Row>
        <Row>
          <Field label="Phone Number">
            <Input value={form.phone_number} onChange={set('phone_number')} placeholder="+1..." className="h-8 text-sm" />
          </Field>
          <Field label="Israeli Phone Number">
            <Input value={form.israeli_phone_number} onChange={set('israeli_phone_number')} placeholder="+972..." className="h-8 text-sm" />
          </Field>
        </Row>
        <Row>
          <Field label="Event">
            <Input value={form.event} onChange={set('event')} placeholder="e.g. Pesach, Family Vacation" className="h-8 text-sm" />
          </Field>
          <Field label="Own / Rent?">
            <Select value={form.own_or_rent} onValueChange={(v) => setForm((p) => ({ ...p, own_or_rent: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="own">Own</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Row>
        <Field label="Location of Event">
          <Input value={form.location_of_event} onChange={set('location_of_event')} placeholder="City / Address" className="h-8 text-sm" />
        </Field>
        <Field label="Location Access Info">
          <Textarea value={form.location_access_info} onChange={set('location_access_info')} placeholder="Gate code, parking, etc." className="text-sm min-h-[60px]" />
        </Field>
        <Field label="Date to Access Home">
          <Input type="date" value={form.date_to_access_home} onChange={set('date_to_access_home')} className="h-8 text-sm" />
        </Field>
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Property Manager</p>
          <Row>
            <Field label="Contact Name">
              <Input value={form.contact_name} onChange={set('contact_name')} placeholder="Name" className="h-8 text-sm" />
            </Field>
            <Field label="Relation / Position">
              <Input value={form.contact_relation} onChange={set('contact_relation')} placeholder="e.g. Housekeeper, Caretaker" className="h-8 text-sm" />
            </Field>
          </Row>
          <Field label="Contact Phone">
            <Input value={form.contact_phone} onChange={set('contact_phone')} placeholder="+1..." className="h-8 text-sm mt-1" />
          </Field>
        </div>
      </SectionCard>

      {/* Staff */}
      <SectionCard icon={Users} title="Staff">
        <div className="space-y-2">
          <div className="grid grid-cols-[7rem_4rem_1fr] text-xs font-semibold text-gray-400 pb-1 border-b">
            <span>Role</span><span className="text-center">QTY</span><span className="pl-2">Name</span>
          </div>
          <StaffRow label="Chef" qtyKey="staff_chef_qty" nameKey="staff_chef_name" form={form} setForm={setForm} />
          <StaffRow label="Cook" qtyKey="staff_cook_qty" nameKey="staff_cook_name" form={form} setForm={setForm} />
          <StaffRow label="House Manager" qtyKey="staff_house_manager_qty" nameKey="staff_house_manager_name" form={form} setForm={setForm} />
          <StaffRow label="Waiter" qtyKey="staff_waiter_qty" nameKey="staff_waiter_name" form={form} setForm={setForm} />
          <StaffRow label="Security" qtyKey="staff_security_qty" nameKey={null} form={form} setForm={setForm} />
          <StaffRow label="Bartenders" qtyKey="staff_bartenders_qty" nameKey={null} form={form} setForm={setForm} />
          <div className="flex items-start gap-2 pt-1">
            <span className="text-xs text-gray-600 w-28 flex-shrink-0 pt-1">Housekeeping</span>
            <Input
              value={form.staff_housekeeping_notes}
              onChange={set('staff_housekeeping_notes')}
              placeholder="Notes (e.g. יש מנקה משלהם)"
              className="h-7 text-xs flex-1" />
            
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-600 w-28 flex-shrink-0 pt-1">Foreign HK</span>
            <Input
              value={form.staff_foreign_housekeeping}
              onChange={set('staff_foreign_housekeeping')}
              placeholder="Foreign housekeeping notes"
              className="h-7 text-xs flex-1" />
            
          </div>
        </div>
        <Field label="General Staff / Chef Notes">
          <Textarea
            value={form.staff_notes}
            onChange={set('staff_notes')}
            placeholder="e.g. 9 אנשים בדירה, 2 ילדים חלק מהזמן. בחג שני לוודא שהשאריות משמשות..."
            className="text-sm min-h-[70px]" />
          
        </Field>
      </SectionCard>

      {/* Arrival & Departure */}
      <SectionCard icon={Calendar} title="Arrival & Departure">
        <Row>
          <Field label="Arrival">
            <Input type="date" value={form.arrival_date} onChange={set('arrival_date')} className="h-8 text-sm" />
          </Field>
          <Field label="Departure">
            <Input type="date" value={form.departure_date} onChange={set('departure_date')} className="h-8 text-sm" />
          </Field>
        </Row>
      </SectionCard>

      {/* Kashrut & Dietary */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Kashrut & Dietary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <Row>
            <Field label="Kashrut Level">
              <Input value={form.kashrut} onChange={set('kashrut')} placeholder="e.g. High, Chalav Yisrael, Pas Yisrael" className="h-8 text-sm bg-white" />
            </Field>
            <Field label="Allergy Header (shown on all menus)">
              <Input value={form.allergy_header} onChange={set('allergy_header')} placeholder="e.g. Nut allergy — strictly nut-free kitchen" className="h-8 text-sm bg-white" />
            </Field>
          </Row>
          <div className="flex items-center gap-3">
            <Switch checked={form.has_allergy} onCheckedChange={(v) => setForm((p) => ({ ...p, has_allergy: v }))} />
            <Label className="text-sm">Does anyone have an allergy?</Label>
          </div>
          {form.has_allergy &&
          <Row>
              <Field label="Who has allergy?">
                <Input value={form.allergy_who} onChange={set('allergy_who')} placeholder="Name(s)" className="h-8 text-sm bg-white" />
              </Field>
              <Field label="What allergy?">
                <Input value={form.allergy_what} onChange={set('allergy_what')} placeholder="e.g. Nuts, Gluten, Dairy" className="h-8 text-sm bg-white" />
              </Field>
            </Row>
          }
          <Field label="Dietary Restrictions / Vegetarian etc.">
            <Textarea value={form.dietary_restrictions} onChange={set('dietary_restrictions')} placeholder="e.g. האמא אוכלת דיאטה מבוססת צמחים" className="text-sm min-h-[60px] bg-white" />
          </Field>
        </CardContent>
      </Card>

      {/* General / Household */}
      <SectionCard icon={UtensilsCrossed} title="General / Household">
        <div className="flex items-center gap-3">
          <Switch checked={form.house_stocked} onCheckedChange={(v) => setForm((p) => ({ ...p, house_stocked: v }))} />
          <Label className="text-sm">Do you want the house stocked?</Label>
        </div>
        {form.house_stocked &&
        <Field label="Stocking List / Notes (send to chef)">
            <Textarea value={form.house_stocked_notes} onChange={set('house_stocked_notes')} placeholder="List items to stock..." className="text-sm min-h-[60px]" />
          </Field>
        }
        <Row>
          <Field label="High Chair / Cribs">
            <Input value={form.high_chair_cribs} onChange={set('high_chair_cribs')} placeholder="Yes / No / details" className="h-8 text-sm" />
          </Field>
          <Field label="Do you keep 2 days?">
            <Input value={form.keeps_2_days} onChange={set('keeps_2_days')} placeholder="e.g. לא אבל הילדים כן" className="h-8 text-sm" />
          </Field>
        </Row>
        <Field label="Soft Drinks Preferences">
          <Textarea value={form.soft_drinks} onChange={set('soft_drinks')} placeholder="e.g. בקבוקי מים קטנים, מי עדן גדולים, דיאט בקבוקים קטנים" className="text-sm min-h-[60px]" />
        </Field>
        <Field label="Wine List">
          <Textarea value={form.wine_list} onChange={set('wine_list')} placeholder="Wine preferences / list" className="text-sm min-h-[60px]" />
        </Field>
        <Row>
          <Field label="Do they have dishes?">
            <Input value={form.has_dishes} onChange={set('has_dishes')} placeholder="e.g. כן חד פעמי" className="h-8 text-sm" />
          </Field>
          <Field label="Designer / Flowers / Cloth?">
            <Input value={form.designer_flowers_cloth} onChange={set('designer_flowers_cloth')} placeholder="Yes / No / details" className="h-8 text-sm" />
          </Field>
        </Row>
        <Row>
          <Field label="Kitchen Cooking Utensils?">
            <Input value={form.kitchen_utensils} onChange={set('kitchen_utensils')} placeholder="Notes" className="h-8 text-sm" />
          </Field>
          <Field label="Fridge / Freezer Rental?">
            <Input value={form.fridge_freezer_rental} onChange={set('fridge_freezer_rental')} placeholder="e.g. לא" className="h-8 text-sm" />
          </Field>
        </Row>
        <Field label="What can we do to make the vacation more enjoyable?">
          <Textarea value={form.special_requests} onChange={set('special_requests')} placeholder="Special requests..." className="text-sm min-h-[60px]" />
        </Field>
      </SectionCard>

      {/* Meal Structure */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UtensilsCrossed className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold text-gray-800">Household Meal Structure</h3>
          <span className="text-xs text-gray-400">— for the chef to build the menu</span>
        </div>
        <div className="space-y-4">
          {[
          { label: 'Dinner', styleField: 'dinner_style', coursesField: 'dinner_courses' },
          { label: 'Lunch', styleField: 'lunch_style', coursesField: 'lunch_courses' },
          { label: 'Kiddush', styleField: 'kiddush_style', coursesField: 'kiddush_courses' }].
          map(({ label, styleField, coursesField }) =>
          <MealBlock
            key={coursesField}
            label={label}
            styleValue={form[styleField]}
            courses={form[coursesField]}
            onStyleChange={(v) => setForm((p) => ({ ...p, [styleField]: v }))}
            onCoursesChange={(v) => setForm((p) => ({ ...p, [coursesField]: v }))}
            dishSuggestions={dishSuggestions} />

          )}
        </div>
      </div>

      {/* Checklists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Toamia Checklist</CardTitle></CardHeader>
          <CardContent>
            <ChecklistEditor items={form.toamia_checklist} onChange={(v) => setForm((p) => ({ ...p, toamia_checklist: v }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Kiddish Checklist</CardTitle></CardHeader>
          <CardContent>
            <ChecklistEditor items={form.kiddish_checklist} onChange={(v) => setForm((p) => ({ ...p, kiddish_checklist: v }))} />
          </CardContent>
        </Card>
      </div>

      {/* Nudge Notifications */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Automated Nudge Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={form.nudge_notifications_enabled} onCheckedChange={(v) => setForm((p) => ({ ...p, nudge_notifications_enabled: v }))} />
            <Label>Send reminder if menu is pending review for &gt;24 hours</Label>
          </div>
          {form.nudge_notifications_enabled &&
          <Row>
              <Field label="WhatsApp Number">
                <Input value={form.nudge_whatsapp} onChange={set('nudge_whatsapp')} placeholder="+1234567890" className="h-8 text-sm" />
              </Field>
              <Field label="Email">
                <Input value={form.nudge_email} onChange={set('nudge_email')} placeholder="client@example.com" className="h-8 text-sm" />
              </Field>
            </Row>
          }
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Client Profile
      </Button>
    </div>);

}