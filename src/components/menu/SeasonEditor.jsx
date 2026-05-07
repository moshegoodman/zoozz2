import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, Loader2, ArrowLeft, Settings, Utensils, CalendarDays } from 'lucide-react';
import ChecklistEditor from './ChecklistEditor';
import MealTypeManager from './MealTypeManager';
import SeasonCalendarGrid from './SeasonCalendarGrid';

export default function SeasonEditor({ season, mealTemplates, onBack, onSaved }) {
  const [form, setForm] = useState({
    name: season.name || '',
    code: season.code || '',
    start_date: season.start_date || '',
    end_date: season.end_date || '',
    is_active: season.is_active !== false,
    default_toamia_checklist: season.default_toamia_checklist || [],
    default_kiddish_checklist: season.default_kiddish_checklist || [],
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (season.id) {
      await base44.entities.MenuSeason.update(season.id, form);
    } else {
      await base44.entities.MenuSeason.create(form);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 h-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{season.id ? `Edit: ${season.name}` : 'New Season'}</h3>
          {season.code && <p className="text-xs text-gray-400">{season.code}</p>}
        </div>
        {season.is_active && <Badge className="bg-green-100 text-green-700">Active</Badge>}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings className="w-3.5 h-3.5" /> General Settings
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Utensils className="w-3.5 h-3.5" /> Meal Templates
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5" disabled={!season.id}>
            <CalendarDays className="w-3.5 h-3.5" /> Calendar View
          </TabsTrigger>
        </TabsList>

        {/* ── General Settings ── */}
        <TabsContent value="general">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Season Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Pesach 2026"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="e.g. 26P"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_active" className="cursor-pointer">Mark as Active Season</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                <ChecklistEditor
                  label="Default Toamia Checklist (Season-Level)"
                  items={form.default_toamia_checklist}
                  onChange={v => setForm(p => ({ ...p, default_toamia_checklist: v }))}
                />
                <ChecklistEditor
                  label="Default Kiddish Checklist (Season-Level)"
                  items={form.default_kiddish_checklist}
                  onChange={v => setForm(p => ({ ...p, default_kiddish_checklist: v }))}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button onClick={handleSave} disabled={saving || !form.name} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Season
                </Button>
                <Button variant="outline" onClick={onBack}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Meal Templates ── */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700">
                Global Meal Type Templates
              </CardTitle>
              <p className="text-xs text-gray-400">
                Meal type templates are global and shared across all seasons. They define the default courses and checklists used when assigning meals on the calendar.
              </p>
            </CardHeader>
            <CardContent>
              <MealTypeManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Calendar View ── */}
        <TabsContent value="calendar">
          {season.id ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-500" />
                  Season Calendar — {season.name}
                </CardTitle>
                <p className="text-xs text-gray-400">
                  Assign meals to days. Households inherit this calendar when onboarded and can then customize independently.
                </p>
              </CardHeader>
              <CardContent>
                <SeasonCalendarGrid
                  season={season}
                  mealTemplates={mealTemplates}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                Save the season first to access the calendar.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}