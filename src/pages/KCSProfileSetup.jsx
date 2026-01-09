
import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Globe } from 'lucide-react';
import { useLanguage } from '../components/i18n/LanguageContext';

export default function KCSProfileSetupPage() {
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    shirt_size: '',
  });

  const isRTL = language === 'Hebrew';
  const shirtSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        if (currentUser.user_type !== 'kcs staff') {
            navigate(createPageUrl("Home"));
            return;
        }
        setUser(currentUser);
        // Pre-populate form with existing data
        setFormData({
          first_name: currentUser.first_name || currentUser.full_name?.split(' ')[0] || '',
          last_name: currentUser.last_name || currentUser.full_name?.split(' ').slice(1).join(' ') || '',
          phone: currentUser.phone || '',
          shirt_size: currentUser.shirt_size || '',
        });
      } catch (error) {
        // Not logged in, redirect home
        navigate(createPageUrl('Home'));
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.phone || !formData.shirt_size) {
      alert(t('kcsProfileSetup.fillAllFields'));
      return;
    }
    setIsSaving(true);
    try {
      await User.updateMyUserData({
        ...formData,
        full_name: `${formData.first_name} ${formData.last_name}`,
      });
      // For KCS users, the next logical step is to select a household
      navigate(createPageUrl('HouseholdSelector'));
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(t('kcsProfileSetup.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('kcsProfileSetup.loadingProfile')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
            <Button variant="outline" onClick={toggleLanguage}>
              <Globe className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
              {language === 'English' ? 'עברית' : 'English'}
            </Button>
        </div>
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">{t('kcsProfileSetup.title')}</CardTitle>
          <CardDescription className="text-lg text-gray-600 mt-2">
            {t('kcsProfileSetup.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">{t('kcsProfileSetup.firstName')}</Label>
                <Input id="first_name" value={formData.first_name} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">{t('kcsProfileSetup.lastName')}</Label>
                <Input id="last_name" value={formData.last_name} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('kcsProfileSetup.email')}</Label>
              <Input id="email" value={user?.email || ''} disabled readOnly />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{t('kcsProfileSetup.phoneNumber')}</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shirt_size">{t('kcsProfileSetup.shirtSize')}</Label>
                <Select
                  value={formData.shirt_size}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, shirt_size: value }))}
                  required // Keep required attribute
                >
                  <SelectTrigger
                    id="shirt_size"
                    className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}
                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                  >
                    <SelectValue
                      placeholder={t('kcsProfileSetup.selectSize')}
                      className={isRTL ? 'text-right' : 'text-left'}
                    />
                  </SelectTrigger>
                  <SelectContent className={isRTL ? 'text-right' : 'text-left'}>
                    {shirtSizes.map(size => (
                      <SelectItem
                        key={size}
                        value={size}
                        className={`${isRTL ? 'text-right' : 'text-left'} cursor-pointer`}
                        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                      >
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('kcsProfileSetup.saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('kcsProfileSetup.saveAndContinue')}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
