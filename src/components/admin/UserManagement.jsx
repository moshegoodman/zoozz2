import { useState } from "react";
import { User, Vendor } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, Edit, Store, Shield, User as UserIcon, Save, X, Info, Package, Briefcase, Home as HomeIcon, Phone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "../i18n/LanguageContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ALL_ROLES = [
  'customerApp',
  'kcs staff',
  'vendor',
  'picker',
  'driver',
  'chief of staff',
  'household owner',
  'admin',
];

export default function UserManagement({ users, vendors, onUserUpdate }) {
  const { t, language } = useLanguage();
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
      case "driver": return { color: "bg-blue-100 text-blue-800", icon: <Package className="w-3 h-3" />, label: t('admin.userManagement.roleDriver') };
      case "chief of staff": return { color: "bg-indigo-100 text-indigo-800", icon: <Briefcase className="w-3 h-3" />, label: t('admin.userManagement.roleChief') };
      case "household owner": return { color: "bg-teal-100 text-teal-800", icon: <HomeIcon className="w-3 h-3" />, label: t('admin.userManagement.roleHouseholdOwner') };
      default: return { color: "bg-blue-100 text-blue-800", icon: <UserIcon className="w-3 h-3" />, label: t('admin.userManagement.roleCustomer') };
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return t('admin.userManagement.roleAdmin');
      case 'vendor': return t('admin.userManagement.roleVendor');
      case 'kcs staff': return t('admin.userManagement.roleKCS');
      case 'picker': return t('admin.userManagement.rolePicker');
      case 'driver': return t('admin.userManagement.roleDriver');
      case 'chief of staff': return t('admin.userManagement.roleChief');
      case 'household owner': return t('admin.userManagement.roleHouseholdOwner');
      default: return t('admin.userManagement.roleCustomer');
    }
  };

  const userTypeTabs = [
    { value: 'all', label: t('admin.userManagement.tabs.all') },
    { value: 'customerApp', label: t('admin.userManagement.roleCustomer') },
    { value: 'kcs staff', label: t('admin.userManagement.roleKCS') },
    { value: 'vendor', label: t('admin.userManagement.roleVendor') },
    { value: 'picker', label: t('admin.userManagement.rolePicker') },
    { value: 'driver', label: t('admin.userManagement.roleDriver') },
    { value: 'chief of staff', label: t('admin.userManagement.roleChief') },
    { value: 'household owner', label: t('admin.userManagement.roleHouseholdOwner') },
    { value: 'admin', label: t('admin.userManagement.roleAdmin') },
  ];

  const handleEditClick = (user) => {
    const initialRoles = Array.isArray(user.user_types) && user.user_types.length > 0
      ? user.user_types
      : (user.user_type ? [user.user_type] : ['customerApp']);
    const initialVendorIds = Array.isArray(user.vendor_ids) && user.vendor_ids.length > 0
      ? user.vendor_ids
      : (user.vendor_id ? [user.vendor_id] : []);
    setEditingUser({
      ...user,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      address: user.address || '',
      shirt_size: user.shirt_size || '',
      profile_image: user.profile_image || '',
      user_type: user.user_type || initialRoles[0] || 'customerApp',
      user_types: initialRoles,
      vendor_id: user.vendor_id || initialVendorIds[0] || null,
      vendor_ids: initialVendorIds,
      is_active: user.is_active ?? true
    });
  };

  const handleCancelClick = () => {
    setEditingUser(null);
  };

  const toggleRole = (role) => {
    setEditingUser(prev => {
      const current = prev.user_types || [];
      const exists = current.includes(role);
      let next = exists ? current.filter(r => r !== role) : [...current, role];
      if (next.length === 0) next = [role]; // never allow empty
      // keep user_type in sync with first role
      const primary = next.includes(prev.user_type) ? prev.user_type : next[0];
      return { ...prev, user_types: next, user_type: primary };
    });
  };

  const toggleVendor = (vendorId) => {
    setEditingUser(prev => {
      const current = prev.vendor_ids || [];
      const exists = current.includes(vendorId);
      const next = exists ? current.filter(v => v !== vendorId) : [...current, vendorId];
      const primary = next.includes(prev.vendor_id) ? prev.vendor_id : (next[0] || null);
      return { ...prev, vendor_ids: next, vendor_id: primary };
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    const needsVendor = editingUser.user_types.some(r => ['vendor', 'picker', 'driver'].includes(r));
    if (needsVendor && (!editingUser.vendor_ids || editingUser.vendor_ids.length === 0)) {
      alert(t('admin.userManagement.vendorRoleWarning'));
      return;
    }

    setIsSaving(true);
    try {
      const userDataToUpdate = {
        first_name: editingUser.first_name || null,
        last_name: editingUser.last_name || null,
        phone: editingUser.phone || null,
        address: editingUser.address || null,
        shirt_size: editingUser.shirt_size || null,
        profile_image: editingUser.profile_image || null,
        user_type: editingUser.user_type,
        user_types: editingUser.user_types,
        vendor_id: editingUser.vendor_id || null,
        vendor_ids: editingUser.vendor_ids || [],
        is_active: editingUser.is_active
      };

      await User.update(editingUser.id, userDataToUpdate);

      // Update contact email on every assigned vendor
      if (needsVendor && Array.isArray(editingUser.vendor_ids)) {
        for (const vid of editingUser.vendor_ids) {
          try {
            await Vendor.update(vid, { contact_email: editingUser.email });
          } catch (e) {
            console.warn('Failed to update vendor contact_email for', vid, e);
          }
        }
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
    const roles = Array.isArray(user.user_types) && user.user_types.length > 0
      ? user.user_types
      : [user.user_type || 'customerApp'];
    return roles.includes(activeTab);
  });

  const needsVendorAssignment = editingUser && editingUser.user_types.some(r => ['vendor', 'picker', 'driver'].includes(r));

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
                  const userRoles = Array.isArray(user.user_types) && user.user_types.length > 0
                    ? user.user_types
                    : [user.user_type || 'customerApp'];
                  const userVendorIds = Array.isArray(user.vendor_ids) && user.vendor_ids.length > 0
                    ? user.vendor_ids
                    : (user.vendor_id ? [user.vendor_id] : []);
                  const assignedVendors = userVendorIds.map(id => vendors.find(v => v.id === id)).filter(Boolean);
                  const isActiveBadge = user.is_active ? { color: "bg-green-100 text-green-800", label: t('admin.userManagement.statusActive') } : { color: "bg-red-100 text-red-800", label: t('admin.userManagement.statusInactive') };

                  return (
                    <div key={user.id} dir={isRTL ? 'rtl' : 'ltr'} className={`p-4 border rounded-lg transition-colors ${isEditingThisUser ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                        <div className="flex items-start gap-4">
                          {user.profile_image && (
                            <img src={user.profile_image} alt={user.full_name} className="w-16 h-16 rounded-full object-cover border" />
                          )}
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
                              {userRoles.map(role => {
                                const b = getUserTypeBadge(role);
                                return (
                                  <Badge key={role} className={b.color + " flex items-center gap-1"}>
                                    {b.icon}
                                    {b.label}
                                  </Badge>
                                );
                              })}
                              {assignedVendors.map(v => (
                                <Badge key={v.id} variant="outline" className="flex items-center gap-1">
                                  <Store className="w-3 h-3" />
                                  {v.name}
                                </Badge>
                              ))}
                              <Badge className={isActiveBadge.color}>
                                  {isActiveBadge.label}
                              </Badge>
                            </div>
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
                        <div className="mt-4 pt-4 border-t space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="first_name">First Name</Label>
                              <Input
                                  id="first_name"
                                  value={editingUser.first_name || ''}
                                  onChange={(e) => handleFieldChange('first_name', e.target.value)}
                                  disabled={isSaving}
                                  placeholder="First name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="last_name">Last Name</Label>
                              <Input
                                  id="last_name"
                                  value={editingUser.last_name || ''}
                                  onChange={(e) => handleFieldChange('last_name', e.target.value)}
                                  disabled={isSaving}
                                  placeholder="Last name"
                              />
                            </div>
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
                            <div className="md:col-span-2">
                              <Label htmlFor="address">Address</Label>
                              <Input
                                  id="address"
                                  value={editingUser.address || ''}
                                  onChange={(e) => handleFieldChange('address', e.target.value)}
                                  disabled={isSaving}
                                  placeholder="Default delivery address"
                              />
                            </div>
                            <div>
                              <Label htmlFor="shirt_size">Shirt Size</Label>
                              <Select
                                value={editingUser.shirt_size || ''}
                                onValueChange={(value) => handleFieldChange('shirt_size', value)}
                                disabled={isSaving}
                              >
                                <SelectTrigger id="shirt_size">
                                  <SelectValue placeholder="Select shirt size" />
                                </SelectTrigger>
                                <SelectContent>
                                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(size => (
                                    <SelectItem key={size} value={size}>{size}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="profile_image">Profile Image URL</Label>
                              <Input
                                  id="profile_image"
                                  value={editingUser.profile_image || ''}
                                  onChange={(e) => handleFieldChange('profile_image', e.target.value)}
                                  disabled={isSaving}
                                  placeholder="https://..."
                              />
                              {editingUser.profile_image && (
                                <img src={editingUser.profile_image} alt="Profile preview" className="mt-2 w-16 h-16 rounded-full object-cover border" />
                              )}
                            </div>
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

                          <div>
                            <Label className="mb-2 block">{t('admin.userManagement.userRole')} (multiple allowed)</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border rounded-lg bg-white">
                              {ALL_ROLES.map(role => (
                                <label key={role} className="flex items-center gap-2 cursor-pointer text-sm">
                                  <Checkbox
                                    checked={editingUser.user_types.includes(role)}
                                    onCheckedChange={() => toggleRole(role)}
                                    disabled={isSaving}
                                  />
                                  <span>{getRoleLabel(role)}</span>
                                </label>
                              ))}
                            </div>
                            {editingUser.user_types.length > 1 && (
                              <div className="mt-2">
                                <Label htmlFor="primary_role" className="text-xs text-gray-600">Primary (default on login)</Label>
                                <Select
                                  value={editingUser.user_type}
                                  onValueChange={(value) => handleFieldChange('user_type', value)}
                                  disabled={isSaving}
                                >
                                  <SelectTrigger id="primary_role" className="w-full md:w-64">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {editingUser.user_types.map(r => (
                                      <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {needsVendorAssignment && (
                            <div>
                              <Label className="mb-2 block">{t('admin.userManagement.assignStore')} (multiple allowed)</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 border rounded-lg bg-white max-h-48 overflow-y-auto">
                                {vendors.map(v => (
                                  <label key={v.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <Checkbox
                                      checked={(editingUser.vendor_ids || []).includes(v.id)}
                                      onCheckedChange={() => toggleVendor(v.id)}
                                      disabled={isSaving}
                                    />
                                    <span>{v.name}</span>
                                  </label>
                                ))}
                              </div>
                              {(editingUser.vendor_ids || []).length > 1 && (
                                <div className="mt-2">
                                  <Label htmlFor="primary_vendor" className="text-xs text-gray-600">Primary store</Label>
                                  <Select
                                    value={editingUser.vendor_id || ''}
                                    onValueChange={(value) => handleFieldChange('vendor_id', value)}
                                    disabled={isSaving}
                                  >
                                    <SelectTrigger id="primary_vendor" className="w-full md:w-64">
                                      <SelectValue placeholder={t('admin.userManagement.selectStore')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(editingUser.vendor_ids || []).map(vid => {
                                        const v = vendors.find(x => x.id === vid);
                                        return <SelectItem key={vid} value={vid}>{v?.name || vid}</SelectItem>;
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}
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