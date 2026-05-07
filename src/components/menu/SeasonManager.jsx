import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Loader2, Calendar, CalendarDays } from 'lucide-react';
import SeasonEditor from './SeasonEditor';

export default function SeasonManager() {
  const [seasons, setSeasons] = useState([]);
  const [mealTemplates, setMealTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSeason, setEditingSeason] = useState(null); // null = list view, {} = new, or season object

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [s, t] = await Promise.all([
      base44.entities.MenuSeason.list('-created_date', 50),
      base44.entities.MealTypeTemplate.list('sort_order', 100),
    ]);
    setSeasons(s || []);
    setMealTemplates(t || []);
    setLoading(false);
  };

  const handleSaved = async () => {
    await load();
    setEditingSeason(null);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  // Edit mode
  if (editingSeason !== null) {
    return (
      <SeasonEditor
        season={editingSeason}
        mealTemplates={mealTemplates}
        onBack={() => setEditingSeason(null)}
        onSaved={handleSaved}
      />
    );
  }

  // List mode
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Seasons
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{mealTemplates.length} meal type templates · {seasons.length} seasons</p>
        </div>
        <Button size="sm" onClick={() => setEditingSeason({})} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4" /> New Season
        </Button>
      </div>

      <div className="space-y-2">
        {seasons.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No seasons yet. Create your first one.</p>}
        {seasons.map(s => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Badge variant={s.is_active ? 'default' : 'secondary'} className={s.is_active ? 'bg-green-100 text-green-700 border-green-200' : ''}>
                {s.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <div>
                <p className="font-medium text-sm text-gray-900">{s.name}</p>
                <div className="text-xs text-gray-400 flex gap-2">
                  {s.code && <span>{s.code}</span>}
                  {s.start_date && <span>{s.start_date} → {s.end_date || '...'}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setEditingSeason(s)}>
                <CalendarDays className="w-3.5 h-3.5" /> Open
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingSeason(s)}>
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}