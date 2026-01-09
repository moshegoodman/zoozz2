
import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserIcon, Mail, Phone, MapPin, Save, Shirt } from "lucide-react";
import { useLanguage } from "../components/i18n/LanguageContext";

export default function ProfilePage() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    shirt_size: "",
    preferences: {
      delivery_instructions: ""
    }
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      setProfileData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        phone: currentUser.phone || "",
        address: currentUser.address || "",
        shirt_size: currentUser.shirt_size || "",
        preferences: {
          delivery_instructions: currentUser.delivery_instructions || ""
        }
      });
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      await User.updateMyUserData({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        full_name: `${profileData.first_name} ${profileData.last_name}`,
        phone: profileData.phone,
        address: profileData.address,
        shirt_size: profileData.shirt_size,
        delivery_instructions: profileData.preferences.delivery_instructions
      });
      
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Error saving profile Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value
      }
    }));
  };
  
  const getUserTypeBadge = (userType) => {
    switch (userType) {
      case "admin": return <Badge className="bg-red-100 text-red-800">Admin</Badge>;
      case "vendor": return <Badge className="bg-green-100 text-green-800">Vendor</Badge>;
      case "kcs staff": return <Badge className="bg-purple-100 text-purple-800">KCS Staff</Badge>;
      case "picker": return <Badge className="bg-yellow-100 text-yellow-800">Picker</Badge>; // Added picker badge
      default: return <Badge className="bg-blue-100 text-blue-800">Customer</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Profile..</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('common.profile')}</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Overview */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name}</h3>
                    {user && getUserTypeBadge(user.user_type)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{user?.email}</span>
                  </div>
                  {profileData.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{profileData.phone}</span>
                    </div>
                  )}
                  {profileData.address && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{profileData.address}</span>
                    </div>
                  )}
                  {profileData.shirt_size && user?.user_type === 'kcs staff' && user?.user_type !== 'picker' && (
                    <div className="flex items-center gap-3 text-sm">
                      <Shirt className="w-4 h-4 text-gray-400" />
                      <span>{t('profile.shirtSize')}: {profileData.shirt_size}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6"> 
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.accountInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">{t('profile.firstName')}</Label>
                    <Input
                      id="first_name"
                      placeholder={t('')}
                      value={profileData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">{t('profile.lastName')}</Label>
                    <Input
                      id="last_name"
                      placeholder={t('')}
                      value={profileData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">{t('profile.phoneNumber')}</Label>
                    <Input
                      id="phone"
                      placeholder={t('')}
                      value={profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>
                  {user?.user_type === 'kcs staff' && user?.user_type !== 'vendor' && (
                    <div>
                      <Label htmlFor="shirt_size">{t('profile.shirtSize')}</Label>
                      <Select value={profileData.shirt_size} onValueChange={(value) => handleSelectChange('shirt_size', value)}>
                        <SelectTrigger id="shirt_size">
                          <SelectValue placeholder={t('profile.selectSize')} />
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
                  )}
                </div>
                <div>
                  <Label htmlFor="address">{t('profile.address')}</Label>
                  <Input
                    id="address"
                    placeholder={t('')}
                    value={profileData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>


            <div className="flex justify-end">
              <Button
                onClick={saveProfile}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t('save')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
