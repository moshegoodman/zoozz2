
import React, { useState, useEffect } from "react";
import { User } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ArrowRight, Globe } from "lucide-react";
import { useLanguage } from "../components/i18n/LanguageContext";
import { createPageUrl } from "@/utils";

export default function StaffSetup() {
  const { t, language, toggleLanguage } = useLanguage();
  const isRTL = language === 'Hebrew';
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    shirt_size: ""
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Check if staff setup is already completed
      if (currentUser.user_type === 'kcs staff' &&
          currentUser.first_name &&
          currentUser.last_name &&
          currentUser.phone &&
          currentUser.shirt_size) {
        // Staff is already set up, redirect to home
        window.location.href = createPageUrl("Home");
        return;
      }

      // If user is not kcs staff type, redirect to home
      if (currentUser.user_type && currentUser.user_type !== 'kcs staff') {
        window.location.href = createPageUrl("Home");
        return;
      }
      
      // Pre-fill any existing data
      setFormData(prev => ({
        ...prev,
        first_name: currentUser.first_name || "",
        last_name: currentUser.last_name || "",
        phone: currentUser.phone || "",
        address: currentUser.address || "",
        shirt_size: currentUser.shirt_size || ""
      }));
    } catch (error) {
      console.error("Error loading user:", error);
      window.location.href = createPageUrl("Home");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.phone || !formData.shirt_size) {
      alert(t('staff.setup.fillAllRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Update user profile data
      await User.updateMyUserData({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        address: formData.address,
        shirt_size: formData.shirt_size
      });

      // Redirect to household selector
      window.location.href = createPageUrl("HouseholdSelector");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert(t('staff.setup.errorUpdating'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <Button variant="outline" onClick={toggleLanguage}>
          <Globe className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {language === 'English' ? 'עברית' : 'English'}
        </Button>
      </div>
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-2xl">
            <Users className="w-8 h-8 text-purple-600" />
            {t('staff.setup.title')}
          </CardTitle>
          <p className="text-gray-600 mt-2">
            {t('staff.setup.description')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">{t('staff.setup.firstName')} *</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  placeholder={t('staff.setup.firstNamePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="last_name">{t('staff.setup.lastName')} *</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  placeholder={t('staff.setup.lastNamePlaceholder')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">{t('staff.setup.phone')} *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                required
                placeholder={t('staff.setup.phonePlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="address">{t('staff.setup.address')}</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder={t('staff.setup.addressPlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="shirt_size">{t('staff.setup.shirtSize')} *</Label>
              <Select
                name="shirt_size"
                value={formData.shirt_size}
                onValueChange={(value) => setFormData(prev => ({ ...prev, shirt_size: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('staff.setup.selectShirtSize')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XS">XS</SelectItem>
                  <SelectItem value="S">S</SelectItem>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="XL">XL</SelectItem>
                  <SelectItem value="XXL">XXL</SelectItem>
                  <SelectItem value="XXXL">XXXL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-2">{t('staff.setup.nextSteps')}</h4>
              <p className="text-purple-800 text-sm">
                {t('staff.setup.householdAssignment')}
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t('staff.setup.completing')}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {t('staff.setup.completeSetup')}
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
