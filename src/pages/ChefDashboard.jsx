import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChefHat, Search, Edit2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import MenuProgressStepper from '@/components/menu/MenuProgressStepper';

const STAGE_BADGE = {
  onboarding: 'bg-gray-100 text-gray-600',
  chef_drafting: 'bg-yellow-100 text-yellow-700',
  manager_review: 'bg-blue-100 text-blue-700',
  client_approval: 'bg-purple-100 text-purple-700',
  finalized: 'bg-green-100 text-green-700',
};

const STAGE_LABEL = {
  onboarding: 'Onboarding',
  chef_drafting: 'Chef Drafting',
  manager_review: 'Manager Review',
  client_approval: 'Client Approval',
  finalized: 'Finalized',
};

export default function ChefDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [menus, setMenus] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);

      const allowedTypes = ['kcs staff', 'chief of staff', 'admin'];
      const isChef = allowedTypes.includes((me?.user_type || '').trim().toLowerCase()) || me?.role === 'admin';
      if (!isChef) {
        setAccessDenied(true);
        return;
      }

      const [allMenus, allSeasons] = await Promise.all([
        base44.entities.Menu.list('-created_date', 500),
        base44.entities.MenuSeason.list('-created_date', 50),
      ]);

      // Chefs see menus assigned to them; admins/chiefs see all
      const isAdmin = me?.role === 'admin' || (me?.user_type || '').trim().toLowerCase() === 'admin' || (me?.user_type || '').trim().toLowerCase() === 'chief of staff';
      const filtered = isAdmin
        ? allMenus
        : (allMenus || []).filter(m => m.chef_id === me.id);

      setMenus(filtered || []);
      setSeasons(allSeasons || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredMenus = menus.filter(m => {
    const matchSearch = !search ||
      (m.household_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.english_date || '').toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || m.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const pendingCount = menus.filter(m => m.stage === 'chef_drafting').length;
  const reviewCount = menus.filter(m => m.stage === 'manager_review').length;
  const finalizedCount = menus.filter(m => m.stage === 'finalized').length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );

  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-sm">
        <CardContent className="p-8 text-center text-gray-600 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          Access denied. KCS Staff or above only.
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-amber-600" /> Chef Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {user?.full_name || 'Chef'} — here are your menus
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => setStageFilter(stageFilter === 'chef_drafting' ? 'all' : 'chef_drafting')}
            className={`text-center p-4 rounded-xl border transition-all ${stageFilter === 'chef_drafting' ? 'ring-2 ring-amber-500' : ''} bg-yellow-50 border-yellow-200`}
          >
            <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
            <div className="text-xs text-yellow-600 mt-0.5">To Draft</div>
          </button>
          <button
            onClick={() => setStageFilter(stageFilter === 'manager_review' ? 'all' : 'manager_review')}
            className={`text-center p-4 rounded-xl border transition-all ${stageFilter === 'manager_review' ? 'ring-2 ring-amber-500' : ''} bg-blue-50 border-blue-200`}
          >
            <div className="text-2xl font-bold text-blue-700">{reviewCount}</div>
            <div className="text-xs text-blue-600 mt-0.5">In Review</div>
          </button>
          <button
            onClick={() => setStageFilter(stageFilter === 'finalized' ? 'all' : 'finalized')}
            className={`text-center p-4 rounded-xl border transition-all ${stageFilter === 'finalized' ? 'ring-2 ring-amber-500' : ''} bg-green-50 border-green-200`}
          >
            <div className="text-2xl font-bold text-green-700">{finalizedCount}</div>
            <div className="text-xs text-green-600 mt-0.5">Finalized</div>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by household or date..."
              className="pl-9 h-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {Object.entries(STAGE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Menu list */}
        <div className="space-y-2">
          {filteredMenus.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                No menus found.
              </CardContent>
            </Card>
          )}
          {filteredMenus.map(menu => {
            const season = seasons.find(s => s.id === menu.season_id);
            const canEdit = menu.stage === 'chef_drafting' || menu.stage === 'manager_review';
            return (
              <div key={menu.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{menu.household_name || '—'}</span>
                      {menu.household_name_hebrew && (
                        <span className="text-gray-500 text-sm" dir="rtl">{menu.household_name_hebrew}</span>
                      )}
                      <Badge className="text-xs bg-amber-100 text-amber-700">Meal #{menu.meal_number}</Badge>
                      <Badge className={`text-xs ${STAGE_BADGE[menu.stage]}`}>{STAGE_LABEL[menu.stage]}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{menu.meal_type}</Badge>
                    </div>
                    <div className="text-xs text-gray-400 flex flex-wrap gap-3">
                      {season && <span>📅 {season.name}</span>}
                      {menu.english_date && <span>{menu.english_date}</span>}
                      {menu.hebrew_date && <span dir="rtl">{menu.hebrew_date}</span>}
                      {menu.guest_count > 0 && <span>👥 {menu.guest_count} guests</span>}
                      {menu.time && <span>🕐 {menu.time}</span>}
                    </div>
                    <div className="mt-2">
                      <MenuProgressStepper stage={menu.stage} />
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {canEdit ? (
                      <Link to={`/MenuEditor?id=${menu.id}`}>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1">
                          <Edit2 className="w-3.5 h-3.5" /> Edit Menu
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/MenuReview?id=${menu.id}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}