import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/i18n/LanguageContext';
import { createPageUrl } from '@/utils';
import { getUserRoles, setActiveRole, setActiveVendorId } from '@/lib/activeRole';
import { ChevronDown } from 'lucide-react';

export default function SetupPageRoleSwitcher({ user }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const roles = useMemo(() => getUserRoles(user), [user]);
  
  if (!user || roles.length <= 1) return null;

  const roleLabels = {
    'admin': language === 'Hebrew' ? 'מנהל' : 'Admin',
    'vendor': language === 'Hebrew' ? 'מוכר' : 'Vendor',
    'picker': language === 'Hebrew' ? 'קוטף' : 'Picker',
    'kcs staff': language === 'Hebrew' ? 'צוות KCS' : 'KCS Staff',
    'chief of staff': language === 'Hebrew' ? 'ראש הצוות' : 'Chief of Staff',
    'household owner': language === 'Hebrew' ? 'בעל בית' : 'Owner',
    'chef': language === 'Hebrew' ? 'שף' : 'Chef',
    'driver': language === 'Hebrew' ? 'נהג' : 'Driver',
  };

  const handleRoleSwitch = (role) => {
    setActiveRole(role);
    
    if (role === 'vendor' || role === 'picker') {
      if (Array.isArray(user.vendor_ids) && user.vendor_ids.length > 0) {
        setActiveVendorId(user.vendor_ids[0]);
      }
    }

    const paths = {
      'admin': 'AdminDashboard',
      'vendor': 'VendorDashboard',
      'picker': 'VendorDashboard',
      'kcs staff': 'StaffPortal',
      'chief of staff': 'AdminDashboard',
      'household owner': 'Home',
      'chef': 'Stores',
      'driver': 'DeliveryDashboard',
    };

    navigate(createPageUrl(paths[role] || 'Stores'), { replace: true });
  };

  return (
    <div className="absolute top-4 right-4 z-50">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700"
        >
          <span className="text-xs">{roleLabels[user.user_type] || user.user_type}</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {isOpen && (
          <div className="absolute top-full mt-2 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-40">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => {
                  handleRoleSwitch(role);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                  user.user_type === role ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-700'
                }`}
              >
                {roleLabels[role] || role}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}