import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Save, X, Loader2, Calendar } from 'lucide-react';
import ChecklistEditor from './ChecklistEditor';

const emptyForm = { name: '', code: '', start_date: '', end_date: '', is_active: true, default_toamia_checklist: [], default_kiddish_checklist: [] };

export default function SeasonManager() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSeasons(); }, []);

  const loadSeasons = async () => {
    setLoading(true);
    const data = await base44.entities.MenuSeason.list('-created_date', 50);
    setSeasons(data || []);
    setLoading(false);
  };

  const handleEdit = (s) => {
    setForm({
      name: s.name || '',
      code: s.code || '',
      start_date: s.start_date || '',
      end_date: s.end_date || '',
      is_active: s.is_active !== false,
      default_toamia_checklist: s.default_toamia_checklist || [],
      default_kiddish_checklist: s.default_kiddish_checklist || [],
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editingId) {
      await base44.entities.MenuSeason.update(editingId, form);
    } else {
      await base44.entities.MenuSeason.create(form);
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    await loadSeasons();
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Calendar className="w-5 h-5" /> Seasons</h3>
        <Button size="sm" onClick={handleNew} className="gap-1"><Plus className="w-4 h-4" /> New Season</Button>
      </div>

      {showForm && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3"><CardTitle className="text-base">{editingId ? 'Edit Season' : 'New Season'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Season Name *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Pesach 2026" className="mt-1" />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. 26P" className="mt-1" />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              <ChecklistEditor
                label="Default Toamia Checklist"
                items={form.default_toamia_checklist}
                onChange={v => setForm(p => ({ ...p, default_toamia_checklist: v }))}
              />
              <ChecklistEditor
                label="Default Kiddish Checklist"
                items={form.default_kiddish_checklist}
                onChange={v => setForm(p => ({ ...p, default_kiddish_checklist: v }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.name} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}><X className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {seasons.map(s => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Badge variant={s.is_active ? 'default' : 'secondary'} className={s.is_active ? 'bg-green-100 text-green-700' : ''}>
                {s.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <div>
                <p className="font-medium text-sm">{s.name}</p>
                {s.code && <p className="text-xs text-gray-400">{s.code} {s.start_date && `· ${s.start_date}`}</p>}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleEdit(s)}><Edit2 className="w-4 h-4" /></Button>
          </div>
        ))}
        {seasons.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No seasons yet.</p>}
      </div>
    </div>
  );
}