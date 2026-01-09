
import React, { useState, useEffect } from 'react';
import { User, Household, HouseholdStaff } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Shirt, 
  UserCheck,
  Home,
  Star,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

export default function StaffManagement() {
  const { t, language } = useLanguage();
  const [staffMembers, setStaffMembers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [householdStaffLinks, setHouseholdStaffLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const isRTL = language === 'Hebrew';


  useEffect(() => {
    loadStaffData();
  }, []);

  const loadStaffData = async () => {
    setIsLoading(true);
    try {
      const [staffUsers, householdsData, staffLinksData] = await Promise.all([
        User.filter({ user_type: 'kcs staff' }),
        Household.list(),
        HouseholdStaff.list()
      ]);

      setStaffMembers(staffUsers);
      setHouseholds(householdsData);
      setHouseholdStaffLinks(staffLinksData);
    } catch (error) {
      console.error('Error loading staff data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStaffHouseholds = (userId) => {
    const staffLinks = householdStaffLinks.filter(link => link.staff_user_id === userId);
    return staffLinks.map(link => {
      const household = households.find(h => h.id === link.household_id);
      return {
        ...link,
        household: household
      };
    }).filter(item => item.household);
  };

  const getRoleDisplayName = (role) => {
    const roleMap = {
      'chef': t('admin.staff.roles.chef'),
      'cook': t('admin.staff.roles.cook'),
      'householdManager': t('admin.staff.roles.houseManager'), // Fixed 'house manager' to 'householdManager'
      'waiter': t('admin.staff.roles.waiter'),
      'housekeeping': t('admin.staff.roles.housekeeping')
    };
    return roleMap[role] || role;
  };

  const getShirtSizeColor = (size) => {
    const sizeColors = {
      'XS': 'bg-purple-100 text-purple-800',
      'S': 'bg-blue-100 text-blue-800',
      'M': 'bg-green-100 text-green-800',
      'L': 'bg-yellow-100 text-yellow-800',
      'XL': 'bg-orange-100 text-orange-800',
      'XXL': 'bg-red-100 text-red-800',
      'XXXL': 'bg-gray-100 text-gray-800'
    };
    return sizeColors[size] || 'bg-gray-100 text-gray-800';
  };

  const exportToCSV = () => {
    const headers = [
      'Full Name',
      'Email',
      'Phone',
      'Address',
      'Shirt Size',
      'Account Created',
      'Active',
      'Households',
      'Roles',
      'Lead Positions'
    ];

    const csvData = filteredStaff.map(staff => {
      const staffHouseholds = getStaffHouseholds(staff.id);
      const householdNames = staffHouseholds.map(sh => sh.household.name).join('; ');
      const roles = staffHouseholds.map(sh => getRoleDisplayName(sh.job_role)).join('; ');
      const leadPositions = staffHouseholds.filter(sh => sh.is_lead).map(sh => sh.household.name).join('; ');

      return [
        staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'N/A',
        staff.email,
        staff.phone || 'N/A',
        staff.address || 'N/A',
        staff.shirt_size || 'N/A',
        format(new Date(staff.created_date), 'yyyy-MM-dd'),
        staff.is_active ? 'Yes' : 'No',
        householdNames || 'None',
        roles || 'None',
        leadPositions || 'None'
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `staff-members-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredStaff = staffMembers.filter(staff => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const fullName = staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
    const staffHouseholds = getStaffHouseholds(staff.id);
    const householdNames = staffHouseholds.map(sh => sh.household?.name || '').join(' ');
    
    return (
      fullName.toLowerCase().includes(searchLower) ||
      staff.email.toLowerCase().includes(searchLower) ||
      (staff.phone && staff.phone.includes(searchTerm)) ||
      householdNames.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.staff.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('admin.staff.title')} ({filteredStaff.length})
            </CardTitle>
            <p className="text-gray-600 mt-1">{t('admin.staff.description')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {t('admin.staff.exportCSV')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={t('admin.staff.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? t('admin.staff.noResultsFound') : t('admin.staff.noStaffMembers')}
            </h3>
            <p className="text-gray-600">
              {searchTerm ? t('admin.staff.tryDifferentSearch') : t('admin.staff.noStaffMembersDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStaff.map((staff) => {
              const staffHouseholds = getStaffHouseholds(staff.id);
              const fullName = staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Name not set';
              
              return (
                <div key={staff.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Staff Basic Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{fullName}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            {staff.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={staff.is_active 
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-red-100 text-red-800 border-red-200"
                            }
                          >
                            {staff.is_active ? t('admin.staff.active') : t('admin.staff.inactive')}
                          </Badge>
                          {staff.shirt_size && (
                            <Badge className={`${getShirtSizeColor(staff.shirt_size)} border`}>
                              <Shirt className="w-3 h-3 mr-1" />
                              {staff.shirt_size}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          {staff.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="w-4 h-4" />
                              {staff.phone}
                            </div>
                          )}
                          {staff.address && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span className="truncate">{staff.address}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <UserCheck className="w-4 h-4" />
                            {t('admin.staff.joinedOn')} {format(new Date(staff.created_date), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Household Assignments */}
                    <div className="lg:w-96">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        {t('admin.staff.householdAssignments')} ({staffHouseholds.length})
                      </h4>
                      {staffHouseholds.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">{t('admin.staff.noAssignments')}</p>
                      ) : (
                        <div className="space-y-2">
                          {staffHouseholds.map((assignment) => (
                            <div key={`${assignment.household_id}-${assignment.job_role}`} 
                                 className="bg-gray-50 rounded-lg p-3 border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">
                                  {language === 'Hebrew' && assignment.household.name_hebrew 
                                    ? assignment.household.name_hebrew 
                                    : assignment.household.name}
                                </span>
                                {assignment.is_lead && (
                                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                    <Star className="w-3 h-3 mr-1" />
                                    {t('admin.staff.lead')}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">{t('admin.staff.role')}: </span>
                                {getRoleDisplayName(assignment.job_role)}
                              </div>
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">{t('admin.staff.canOrder')}: </span>
                                {assignment.can_order ? t('common.yes') : t('common.no')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
