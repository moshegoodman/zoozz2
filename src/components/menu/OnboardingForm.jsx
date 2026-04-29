import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, AlertTriangle, User } from 'lucide-react';
import ChecklistEditor from './ChecklistEditor';

export default function OnboardingForm({ household, season, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    allergy_header: '',
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
    const existing = await base44.entities.ClientMenuProfile.filter({
      household_id: household.id,
      season_id: season.id,
    });
    if (existing?.length > 0) {
      const p = existing[0];
      setProfile(p);
      setForm({
        allergy_header: p.allergy_header || '',
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
      // Seed from season templates
      setForm(prev => ({
        ...prev,
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

      {/* Household Structure Defaults */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Household Structure Defaults</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { field: 'dinner_default', label: 'Dinner' },
            { field: 'lunch_default', label: 'Lunch' },
            { field: 'kiddush_default', label: 'Kiddush' },
          ].map(({ field, label }) => (
            <div key={field}>
              <Label>{label}</Label>
              <Textarea
                value={form[field]}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                placeholder={`Default ${label} structure...`}
                rows={3}
                className="mt-1 text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

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