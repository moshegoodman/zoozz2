import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Plus, ChefHat, Calendar, Users, Search, Eye, Edit2, AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SeasonManager from '../components/menu/SeasonManager';
import OnboardingForm from '../components/menu/OnboardingForm';
import MenuProgressStepper from '../components/menu/MenuProgressStepper';

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

const MEAL_TYPES = ['dinner', 'lunch', 'kiddush', 'toamia', 'kiddish', 'other'];

export default function MenuEngine() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [menus, setMenus] = useState([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('menus');

  // New menu form
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newMenu, setNewMenu] = useState({ season_id: '', household_id: '', meal_type: 'dinner', english_date: '', hebrew_date: '', time: '', guest_count: 0 });
  const [creating, setCreating] = useState(false);

  // Onboarding panel
  const [onboardingHousehold, setOnboardingHousehold] = useState(null);
  const [onboardingSeason, setOnboardingSeason] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
      const allowed = ['admin', 'chief of staff'];
      if (!allowed.includes((me?.user_type || '').trim().toLowerCase()) && me?.role !== 'admin') {
        setAccessDenied(true);
        return;
      }
      const [s, h, m] = await Promise.all([
        base44.entities.MenuSeason.list('-created_date', 50),
        base44.entities.Household.list('-created_date', 500),
        base44.entities.Menu.list('-created_date', 500),
      ]);
      setSeasons(s || []);
      setHouseholds(h || []);
      setMenus(m || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateMenu = async () => {
    if (!newMenu.season_id || !newMenu.household_id) return;
    setCreating(true);
    const hh = households.find(h => h.id === newMenu.household_id);
    // Auto-increment meal number for this household+season
    const existing = menus.filter(m => m.household_id === newMenu.household_id && m.season_id === newMenu.season_id);
    const mealNumber = existing.length + 1;
    const created = await base44.entities.Menu.create({
      ...newMenu,
      guest_count: parseInt(newMenu.guest_count) || 0,
      household_name: hh?.name || '',
      household_name_hebrew: hh?.name_hebrew || '',
      stage: 'chef_drafting',
      meal_number: mealNumber,
      courses: [],
    });
    setCreating(false);
    setShowNewMenu(false);
    navigate(`/MenuEditor?id=${created.id}`);
  };

  const filteredMenus = menus.filter(m => {
    const hhName = (m.household_name || '').toLowerCase();
    const matchSearch = !search || hhName.includes(search.toLowerCase()) || (m.english_date || '').toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || m.stage === stageFilter;
    const matchSeason = seasonFilter === 'all' || m.season_id === seasonFilter;
    return matchSearch && matchStage && matchSeason;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-sm"><CardContent className="p-8 text-center text-gray-600 flex flex-col items-center gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        Access denied. Admin or Chief of Staff only.
      </CardContent></Card>
    </div>
  );

  const activeSeason = seasons.find(s => s.is_active) || seasons[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ChefHat className="w-7 h-7 text-amber-600" /> Menu Engine
            </h1>
            <p className="text-sm text-gray-500 mt-1">Season-based menu creation, review & approval</p>
          </div>
          <Button onClick={() => setShowNewMenu(true)} className="bg-amber-600 hover:bg-amber-700 gap-1">
            <Plus className="w-4 h-4" /> New Menu
          </Button>
        </div>

        {/* New Menu Modal */}
        {showNewMenu && (
          <Card className="mb-6 border-amber-200">
            <CardHeader className="pb-3"><CardTitle className="text-base">Create New Menu</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label>Season *</Label>
                  <Select value={newMenu.season_id} onValueChange={v => setNewMenu(p => ({ ...p, season_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select season..." /></SelectTrigger>
                    <SelectContent>{seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Household *</Label>
                  <Select value={newMenu.household_id} onValueChange={v => setNewMenu(p => ({ ...p, household_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select household..." /></SelectTrigger>
                    <SelectContent className="max-h-56 overflow-y-auto">
                      {households.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Meal Type</Label>
                  <Select value={newMenu.meal_type} onValueChange={v => setNewMenu(p => ({ ...p, meal_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{MEAL_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>English Date</Label>
                  <Input value={newMenu.english_date} onChange={e => setNewMenu(p => ({ ...p, english_date: e.target.value }))} placeholder="Friday, April 18" className="mt-1" />
                </div>
                <div>
                  <Label>Hebrew Date</Label>
                  <Input value={newMenu.hebrew_date} onChange={e => setNewMenu(p => ({ ...p, hebrew_date: e.target.value }))} placeholder="כ׳ ניסן" className="mt-1 text-right" dir="rtl" />
                </div>
                <div>
                  <Label>Guests</Label>
                  <Input type="number" value={newMenu.guest_count} onChange={e => setNewMenu(p => ({ ...p, guest_count: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleCreateMenu} disabled={creating || !newMenu.season_id || !newMenu.household_id} className="bg-amber-600 hover:bg-amber-700">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Create & Open Editor
                </Button>
                <Button variant="outline" onClick={() => setShowNewMenu(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="menus" className="gap-1"><ChefHat className="w-4 h-4" /> Menus</TabsTrigger>
            <TabsTrigger value="onboarding" className="gap-1"><Users className="w-4 h-4" /> Onboarding</TabsTrigger>
            <TabsTrigger value="seasons" className="gap-1"><Calendar className="w-4 h-4" /> Seasons</TabsTrigger>
          </TabsList>

          {/* MENUS TAB */}
          <TabsContent value="menus">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by household or date..." className="pl-9 h-9" />
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {Object.entries(STAGE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Seasons</SelectItem>
                  {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-5 gap-3 mb-5">
              {Object.entries(STAGE_LABEL).map(([key, label]) => {
                const count = menus.filter(m => m.stage === key).length;
                return (
                  <button key={key} onClick={() => setStageFilter(stageFilter === key ? 'all' : key)}
                    className={`text-center p-3 rounded-xl border cursor-pointer transition-all ${stageFilter === key ? 'ring-2 ring-amber-500' : ''} ${STAGE_BADGE[key]} bg-opacity-50`}>
                    <div className="text-xl font-bold">{count}</div>
                    <div className="text-xs mt-0.5">{label}</div>
                  </button>
                );
              })}
            </div>

            {/* Menu list */}
            <div className="space-y-2">
              {filteredMenus.length === 0 && (
                <Card><CardContent className="p-8 text-center text-gray-400">
                  No menus found. Create your first menu above.
                </CardContent></Card>
              )}
              {filteredMenus.map(menu => {
                const season = seasons.find(s => s.id === menu.season_id);
                return (
                  <div key={menu.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{menu.household_name || '—'}</span>
                          {menu.household_name_hebrew && <span className="text-gray-500 text-sm" dir="rtl">{menu.household_name_hebrew}</span>}
                          <Badge className="text-xs bg-amber-100 text-amber-700">Meal #{menu.meal_number}</Badge>
                          <Badge className={`text-xs ${STAGE_BADGE[menu.stage]}`}>{STAGE_LABEL[menu.stage]}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{menu.meal_type}</Badge>
                        </div>
                        <div className="text-xs text-gray-400 flex gap-3">
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
                      <div className="flex gap-2 flex-shrink-0">
                        <Link to={`/MenuEditor?id=${menu.id}`}>
                          <Button size="sm" variant="outline" className="gap-1"><Edit2 className="w-3.5 h-3.5" /> Edit</Button>
                        </Link>
                        <Link to={`/MenuReview?id=${menu.id}`}>
                          <Button size="sm" variant="outline" className="gap-1"><Eye className="w-3.5 h-3.5" /> Review</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ONBOARDING TAB */}
          <TabsContent value="onboarding">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Selectors */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Select Client & Season</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Season</Label>
                    <Select value={onboardingSeason?.id || ''} onValueChange={v => setOnboardingSeason(seasons.find(s => s.id === v) || null)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select season..." /></SelectTrigger>
                      <SelectContent>{seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Household</Label>
                    <Select value={onboardingHousehold?.id || ''} onValueChange={v => setOnboardingHousehold(households.find(h => h.id === v) || null)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select household..." /></SelectTrigger>
                      <SelectContent className="max-h-56 overflow-y-auto">
                        {households.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Onboarding form */}
              <div className="md:col-span-2">
                {onboardingHousehold && onboardingSeason ? (
                  <OnboardingForm
                    household={onboardingHousehold}
                    season={onboardingSeason}
                    onSaved={() => {}}
                  />
                ) : (
                  <Card><CardContent className="p-8 text-center text-gray-400">
                    Select a household and season to begin onboarding.
                  </CardContent></Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* SEASONS TAB */}
          <TabsContent value="seasons">
            <Card>
              <CardContent className="p-6"><SeasonManager /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}