import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, ChefHat, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import MenuEditor from '../components/menu/MenuEditor';
import MenuComments from '../components/menu/MenuComments';
import AllergyBanner from '../components/menu/AllergyBanner';

export default function MenuEditorPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const menuId = urlParams.get('id');

  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState(null);
  const [allergyText, setAllergyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => { if (menuId) loadAll(); }, [menuId]);

  const loadAll = async () => {
    setLoading(true);
    const [me, m] = await Promise.all([
      base44.auth.me(),
      base44.entities.Menu.get(menuId),
    ]);
    setUser(me);
    setMenu(m);

    // Load allergy header from ClientMenuProfile
    if (m?.household_id && m?.season_id) {
      const profiles = await base44.entities.ClientMenuProfile.filter({
        household_id: m.household_id,
        season_id: m.season_id,
      });
      if (profiles?.length > 0) setAllergyText(profiles[0].allergy_header || '');
    }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  if (!menu) return <div className="min-h-screen flex items-center justify-center text-gray-400">Menu not found.</div>;

  const isManager = ['admin', 'chief of staff'].includes((user?.user_type || '').trim().toLowerCase()) || user?.role === 'admin';
  const isChef = user?.id === menu.chef_id || isManager;
  const canEdit = isChef && ['chef_drafting', 'manager_review'].includes(menu.stage);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={createPageUrl('MenuEngine')}>
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-600" />
                {menu.household_name} — Meal #{menu.meal_number}
              </h1>
              {menu.household_name_hebrew && (
                <span className="text-gray-500" dir="rtl">{menu.household_name_hebrew}</span>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="capitalize text-xs">{menu.meal_type}</Badge>
              {menu.english_date && <Badge variant="outline" className="text-xs">{menu.english_date}</Badge>}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComments(v => !v)}
            className="gap-1"
          >
            <MessageCircle className="w-4 h-4" />
            Comments
          </Button>
        </div>

        <div className={`grid gap-6 ${showComments ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>
          {/* Main editor */}
          <div className={showComments ? 'lg:col-span-2' : ''}>
            <Card>
              <CardContent className="p-6">
                <MenuEditor
                  menu={menu}
                  allergyText={allergyText}
                  canEdit={canEdit}
                  isManager={isManager}
                  onSaved={loadAll}
                />
              </CardContent>
            </Card>
          </div>

          {/* Comments panel */}
          {showComments && (
            <div>
              <Card className="sticky top-4">
                <CardContent className="p-4">
                  <MenuComments
                    menuId={menu.id}
                    authorId={user?.id}
                    authorName={user?.full_name || user?.email}
                    authorRole={isManager ? 'manager' : 'chef'}
                    showInternal={isManager}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}