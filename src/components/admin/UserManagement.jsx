
import React, { useState } from "react";
import { User, Vendor } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, Edit, Store, Shield, User as UserIcon, Save, X, Info, Package, Briefcase, Home as HomeIcon, Phone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "../i18n/LanguageContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UserManagement({ users, vendors, onUserUpdate }) {
  const { t ,language} = useLanguage();
  const isRTL = language === 'Hebrew';
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const getUserTypeBadge = (userType) => {
    switch (userType) {
      case "admin": return { color: "bg-red-100 text-red-800", icon: <Shield className="w-3 h-3" />, label: t('admin.userManagement.roleAdmin') };
      case "vendor": return { color: "bg-green-100 text-green-800", icon: <Store className="w-3 h-3" />, label: t('admin.userManagement.roleVendor') };
      case "kcs staff": return { color: "bg-purple-100 text-purple-800", icon: <Users className="w-3 h-3" />, label: t('admin.userManagement.roleKCS') };
      case "picker": return { color: "bg-orange-100 text-orange-800", icon: <Package className="w-3 h-3" />, label: t('admin.userManagement.rolePicker') };
      case "chief of staff": return { color: "bg-indigo-100 text-indigo-800", icon: <Briefcase className="w-3 h-3" />, label: t('admin.userManagement.roleChief') };
      case "household owner": return { color: "bg-teal-100 text-teal-800", icon: <HomeIcon className="w-3 h-3" />, label: t('admin.userManagement.roleHouseholdOwner') };
      default: return { color: "bg-blue-100 text-blue-800", icon: <UserIcon className="w-3 h-3" />, label: t('admin.userManagement.roleCustomer') };
    }
  };
  
  const userTypeTabs = [
    { value: 'all', label: t('admin.userManagement.tabs.all') },
    { value: 'customerApp', label: t('admin.userManagement.roleCustomer') },
    { value: 'kcs staff', label: t('admin.userManagement.roleKCS') },
    { value: 'vendor', label: t('admin.userManagement.roleVendor') },
    { value: 'picker', label: t('admin.userManagement.rolePicker') },
    { value: 'chief of staff', label: t('admin.userManagement.roleChief') },
    { value: 'household owner', label: t('admin.userManagement.roleHouseholdOwner') },
    { value: 'admin', label: t('admin.userManagement.roleAdmin') },
  ];

  const handleEditClick = (user) => {
    setEditingUser({
      ...user,
      phone: user.phone || '',
      user_type: user.user_type || 'customerApp',
      vendor_id: user.vendor_id || null,
      is_active: user.is_active ?? true
    });
  };

  const handleCancelClick = () => {
    setEditingUser(null);
  };
  
  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    // Validation for vendor_id if user_type is 'vendor' or 'picker'
    if ((editingUser.user_type === 'vendor' || editingUser.user_type === 'picker') && !editingUser.vendor_id) {
      alert(t('admin.userManagement.vendorRoleWarning'));
      return;
    }
    
    setIsSaving(true);
    try {
      const userDataToUpdate = {
        phone: editingUser.phone || null,
        user_type: editingUser.user_type,
        vendor_id: editingUser.vendor_id || null,
        is_active: editingUser.is_active
      };
      
      await User.update(editingUser.id, userDataToUpdate);
      
      // If user is assigned as a vendor or picker, update the vendor's contact email
      // This logic now applies to both 'vendor' and 'picker' types
      if ((userDataToUpdate.user_type === 'vendor' || userDataToUpdate.user_type === 'picker') && userDataToUpdate.vendor_id) {
        // Only update the contact_email field, preserve all other vendor data using PATCH behavior
        await Vendor.update(userDataToUpdate.vendor_id, {
          contact_email: editingUser.email
        });
      }
  
      setEditingUser(null);
      await onUserUpdate();
    } catch (error) {
      console.error("Error updating user:", error);
      alert(t('admin.userManagement.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditingUser(prev => ({ ...prev, [field]: value }));
  };

  const filteredUsers = users.filter(user => {
    if (activeTab === 'all') return true;
    const userType = user.user_type || 'customerApp';
    return userType === activeTab;
  });

  return (
    <Card dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex justify-between items-center mb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('admin.userManagement.title')}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">{t('admin.userManagement.description')}</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg flex items-start gap-3 text-sm">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
                <span className="font-semibold">{t('admin.userManagement.howToAdd')}</span>
                <p>{t('admin.userManagement.inviteInstruction')}</p>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`flex flex-wrap h-auto justify-start gap-1 sm:gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {userTypeTabs.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            <div className="mt-6 space-y-4">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const isEditingThisUser = editingUser?.id === user.id;
                  const userBadge = getUserTypeBadge(user.user_type || 'customerApp');
                  const assignedVendor = (user.user_type === 'vendor' || user.user_type === 'picker') && user.vendor_id 
                      ? vendors.find(v => v.id === user.vendor_id) 
                      : null;
                  const isActiveBadge = user.is_active ? { color: "bg-green-100 text-green-800", label: t('admin.userManagement.statusActive') } : { color: "bg-red-100 text-red-800", label: t('admin.userManagement.statusInactive') };
      
                  return (
                    <div key={user.id} dir={isRTL ? 'rtl' : 'ltr'} className={`p-4 border rounded-lg transition-colors ${isEditingThisUser ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                        <div>
                          <p className="font-semibold">{user.full_name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          {user.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <Phone className="w-3 h-3" />
                                <span>{user.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className={userBadge.color + " flex items-center gap-1"}>
                              {userBadge.icon}
                              {userBadge.label}
                            </Badge>
                            {assignedVendor && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Store className="w-3 h-3" />
                                {assignedVendor.name}
                              </Badge>
                            )}
                            <Badge className={isActiveBadge.color}>
                                {isActiveBadge.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-4 sm:mt-0">
                          {!isEditingThisUser ? (
                            <Button variant="outline" size="sm" onClick={() => handleEditClick(user)}>
                              <Edit className="w-4 h-4 mr-2" /> {t('admin.userManagement.edit')}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={handleCancelClick} disabled={isSaving}>
                                  <X className="w-4 h-4" />
                                </Button>
                                <Button size="sm" onClick={handleSaveUser} disabled={isSaving}>
                                  <Save className="w-4 h-4 mr-2" />
                                  {isSaving ? t('admin.userManagement.saving') : t('admin.userManagement.save')}
                                </Button>
                            </div>
                          )}
                        </div>
                      </div>
      
                      {isEditingThisUser && (
                        <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end" dir={isRTL ? 'rtl' : 'ltr'}>
                          <div>
                            <Label htmlFor="phone">{t('admin.userManagement.phone')}</Label>
                            <Input
                                id="phone"
                                value={editingUser.phone || ''}
                                onChange={(e) => handleFieldChange('phone', e.target.value)}
                                disabled={isSaving}
                                placeholder={t('admin.userManagement.phonePlaceholder')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="user_type">{t('admin.userManagement.userRole')}</Label>
                            <Select
                              value={editingUser.user_type}
                              onValueChange={(value) => handleFieldChange('user_type', value)}
                              disabled={isSaving}
                            >
                              <SelectTrigger id="user_type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="customerApp">{t('admin.userManagement.roleCustomer')}</SelectItem>
                                <SelectItem value="kcs staff">{t('admin.userManagement.roleKCS')}</SelectItem>
                                <SelectItem value="vendor">{t('admin.userManagement.roleVendor')}</SelectItem>
                                <SelectItem value="picker">{t('admin.userManagement.rolePicker')}</SelectItem>
                                <SelectItem value="chief of staff">{t('admin.userManagement.roleChief')}</SelectItem>
                                <SelectItem value="household owner">{t('admin.userManagement.roleHouseholdOwner')}</SelectItem>
                                <SelectItem value="admin">{t('admin.userManagement.roleAdmin')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {(editingUser.user_type === 'vendor' || editingUser.user_type === 'picker') && (
                             <div>
                               <Label htmlFor="vendor_id">{t('admin.userManagement.assignStore')}</Label>
                               <Select
                                  value={editingUser.vendor_id}
                                  onValueChange={(value) => handleFieldChange('vendor_id', value)}
                                  disabled={isSaving}
                               >
                                  <SelectTrigger id="vendor_id">
                                     <SelectValue placeholder={t('admin.userManagement.selectStore')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                     {vendors.map((v) => (
                                         <SelectItem key={v.id} value={v.id}>
                                             {v.name}
                                         </SelectItem>
                                     ))}
                                  </SelectContent>
                               </Select>
                             </div>
                          )}
                          <div className="flex items-center space-x-2">
                              <Switch
                                  id="is_active"
                                  checked={editingUser.is_active}
                                  onCheckedChange={(checked) => handleFieldChange('is_active', checked)}
                                  disabled={isSaving}
                              />
                              <Label htmlFor="is_active">{t('admin.userManagement.accountActive')}</Label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10">
                    <p className="text-gray-500">{t('admin.userManagement.noUsersInTab')}</p>
                </div>
              )}
            </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
