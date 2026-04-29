import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2, ArrowLeft, CheckCircle, MessageCircle, ChefHat, Printer, AlertTriangle, ThumbsUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import MenuProgressStepper from '../components/menu/MenuProgressStepper';
import AllergyBanner from '../components/menu/AllergyBanner';
import MenuComments from '../components/menu/MenuComments';

export default function MenuReview() {
  const urlParams = new URLSearchParams(window.location.search);
  const menuId = urlParams.get('id');

  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState(null);
  const [allergyText, setAllergyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState('');
  const [approving, setApproving] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => { if (menuId) load(); }, [menuId]);

  const load = async () => {
    setLoading(true);
    const [me, m] = await Promise.all([
      base44.auth.me(),
      base44.entities.Menu.get(menuId),
    ]);
    setUser(me);
    setMenu(m);
    if (m?.client_signature) setSignature(m.client_signature);

    if (m?.household_id && m?.season_id) {
      const profiles = await base44.entities.ClientMenuProfile.filter({
        household_id: m.household_id,
        season_id: m.season_id,
      });
      if (profiles?.length > 0) setAllergyText(profiles[0].allergy_header || '');
    }
    setLoading(false);
  };

  const isManager = ['admin', 'chief of staff'].includes((user?.user_type || '').trim().toLowerCase()) || user?.role === 'admin';
  const isClient = user?.user_type === 'household owner';

  const handleManagerApprove = async () => {
    setApproving(true);
    await base44.entities.Menu.update(menu.id, { stage: 'client_approval' });
    await load();
    setApproving(false);
  };

  const handleClientApprove = async () => {
    if (!signature.trim()) return;
    setApproving(true);
    await base44.entities.Menu.update(menu.id, {
      stage: 'finalized',
      client_approved_final: true,
      client_signature: signature,
    });
    await load();
    setApproving(false);
  };

  const handleDishApproval = async (courseIdx, dishIdx, approved) => {
    const newCourses = menu.courses.map((c, ci) =>
      ci !== courseIdx ? c : {
        ...c,
        dishes: c.dishes.map((d, di) =>
          di !== dishIdx ? d : { ...d, client_approved: approved }
        )
      }
    );
    await base44.entities.Menu.update(menu.id, { courses: newCourses });
    setMenu(prev => ({ ...prev, courses: newCourses }));
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  if (!menu) return <div className="min-h-screen flex items-center justify-center text-gray-400">Menu not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Non-print header */}
      <div className="max-w-4xl mx-auto px-4 py-8 print:hidden">
        <div className="flex items-center gap-3 mb-6">
          <Link to={createPageUrl('MenuEngine')}>
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">
              {menu.household_name} — Meal #{menu.meal_number}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowComments(v => !v)} className="gap-1">
              <MessageCircle className="w-4 h-4" /> Comments
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <MenuProgressStepper stage={menu.stage} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className={`grid gap-6 ${showComments ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>
          <div className={showComments ? 'lg:col-span-2' : ''}>

            {/* Allergy banner */}
            <AllergyBanner text={allergyText} />

            {/* Menu card — polished client view */}
            <Card className="shadow-lg print:shadow-none">
              {/* Print header */}
              <div className="hidden print:flex items-center justify-center py-6 border-b">
                <div className="text-center">
                  <h2 className="text-3xl font-bold tracking-wide">KCS</h2>
                  <p className="text-sm text-gray-500 mt-1">Private Culinary Services</p>
                </div>
              </div>

              <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{menu.household_name}</CardTitle>
                    {menu.household_name_hebrew && <p className="text-lg text-gray-600 mt-0.5" dir="rtl">{menu.household_name_hebrew}</p>}
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">{menu.english_date}</p>
                    {menu.hebrew_date && <p className="text-gray-600" dir="rtl">{menu.hebrew_date}</p>}
                    {menu.time && <p className="text-sm text-gray-500">🕐 {menu.time}</p>}
                    {menu.guest_count > 0 && <p className="text-sm text-gray-500">👥 {menu.guest_count} guests</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 print:hidden">
                  <Badge className="capitalize bg-amber-100 text-amber-700">{menu.meal_type}</Badge>
                  <Badge className="bg-blue-100 text-blue-700">Meal #{menu.meal_number}</Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {(menu.courses || []).map((course, ci) => (
                  <div key={course.id || ci}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800 text-lg border-b border-gray-200 pb-1 flex-1">
                        {course.title_english}
                      </h3>
                      {course.title_hebrew && (
                        <h3 className="font-bold text-gray-800 text-lg border-b border-gray-200 pb-1 ml-4 text-right" dir="rtl">
                          {course.title_hebrew}
                        </h3>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(course.dishes || []).map((dish, di) => (
                        <div key={dish.id || di} className={`flex items-start gap-4 p-3 rounded-xl transition-all ${dish.client_approved ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'}`}>
                          {dish.photo_url && (
                            <img src={dish.photo_url} alt={dish.english} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-900">{dish.english}</span>
                              <span className="text-gray-600 text-right" dir="rtl">{dish.hebrew}</span>
                            </div>
                            {dish.client_comment && (
                              <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded px-2 py-1">💬 {dish.client_comment}</p>
                            )}
                          </div>
                          {/* Per-dish client approval (client_approval stage) */}
                          {isClient && menu.stage === 'client_approval' && (
                            <button
                              onClick={() => handleDishApproval(ci, di, !dish.client_approved)}
                              className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${dish.client_approved ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'}`}
                              title={dish.client_approved ? 'Approved' : 'Approve this dish'}
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                          )}
                          {dish.client_approved && !isClient && (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Manager approval action */}
                {isManager && menu.stage === 'manager_review' && (
                  <div className="border-t pt-4">
                    <Button onClick={handleManagerApprove} disabled={approving} className="bg-blue-600 hover:bg-blue-700 gap-1">
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve & Send to Client
                    </Button>
                  </div>
                )}

                {/* Client digital signature */}
                {(isClient || isManager) && menu.stage === 'client_approval' && !menu.client_approved_final && (
                  <div className="border-t pt-4 space-y-3">
                    <Label className="font-semibold">Client Approval</Label>
                    <p className="text-sm text-gray-600">Please type your name below as a digital signature to approve this menu.</p>
                    <Input
                      value={signature}
                      onChange={e => setSignature(e.target.value)}
                      placeholder="Type your full name..."
                      className="max-w-sm"
                    />
                    <Button
                      onClick={handleClientApprove}
                      disabled={approving || !signature.trim()}
                      className="bg-green-600 hover:bg-green-700 gap-1"
                    >
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve Menu
                    </Button>
                  </div>
                )}

                {/* Finalized badge */}
                {menu.stage === 'finalized' && (
                  <div className="border-t pt-4 flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Menu finalized</span>
                    {menu.client_signature && <span className="text-sm text-gray-500">— Signed by {menu.client_signature}</span>}
                  </div>
                )}
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
                    authorRole={isManager ? 'manager' : isClient ? 'client' : 'chef'}
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