import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Shield, Store, Package, Users, Briefcase, Home as HomeIcon, User as UserIcon, Truck } from "lucide-react";
import { getActiveRole, setActiveRole, getActiveVendorId, setActiveVendorId, getUserRoles } from "@/lib/activeRole";
import { Vendor } from "@/entities/all";
import { useLanguage } from "@/components/i18n/LanguageContext";

const ROLE_META = {
  'admin': { en: 'Admin', he: 'מנהל', icon: Shield, color: 'text-red-600' },
  'chief of staff': { en: 'Chief of Staff', he: 'ראש צוות', icon: Briefcase, color: 'text-indigo-600' },
  'vendor': { en: 'Vendor', he: 'ספק', icon: Store, color: 'text-green-600' },
  'picker': { en: 'Picker', he: 'מלקט', icon: Package, color: 'text-orange-600' },
  'driver': { en: 'Driver', he: 'נהג', icon: Truck, color: 'text-blue-600' },
  'kcs staff': { en: 'KCS Staff', he: 'צוות KCS', icon: Users, color: 'text-purple-600' },
  'household owner': { en: 'Household Owner', he: 'בעל בית', icon: HomeIcon, color: 'text-teal-600' },
  'customerApp': { en: 'Customer', he: 'לקוח', icon: UserIcon, color: 'text-gray-600' },
};

// Compact, header-friendly role switcher.
// `variant`: "desktop" = button with chevron, "mobile" = inline list rendered directly (no dropdown).
export default function RoleSwitcherDropdown({ user, variant = "desktop", onSwitch }) {
  const { language } = useLanguage();
  const isHe = language === 'Hebrew';
  const allRoles = getUserRoles(user);
  // Hide "household owner" if the user has no household assigned (prevents being stuck on pending page)
  const hasHousehold = !!(user?.default_household_id || (user?.household_ids && user.household_ids.length > 0));
  const roles = allRoles.filter(r => r !== 'household owner' || hasHousehold);
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState({});
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    const ids = user?.vendor_ids || [];
    if (ids.length === 0) return;
    Promise.all(ids.map(id => Vendor.get(id).catch(() => null))).then(list => {
      const map = {};
      list.forEach(v => { if (v) map[v.id] = v; });
      setVendors(map);
    });
  }, [user?.vendor_ids?.join(',')]);

  if (!user || roles.length <= 1) return null;

  const activeRole = getActiveRole() || roles[0];
  const activeMeta = ROLE_META[activeRole] || ROLE_META.customerApp;
  const ActiveIcon = activeMeta.icon;
  const activeRoleLabel = isHe ? activeMeta.he : activeMeta.en;
  const activeVendorId = getActiveVendorId();
  const activeVendor = activeVendorId ? vendors[activeVendorId] : null;
  const vendorIds = user.vendor_ids || (user.vendor_id ? [user.vendor_id] : []);
  const isVendorRole = ['vendor', 'picker', 'driver'].includes(activeRole);

  const getLandingPathForRole = (role) => {
    if (['vendor', 'picker'].includes(role)) return '/VendorDashboard';
    if (role === 'driver') return '/DeliveryDashboard';
    if (['admin', 'chief of staff'].includes(role)) return '/AdminDashboard';
    if (role === 'kcs staff') return '/StaffPortal';
    if (role === 'household owner') return '/Stores';
    return '/';
  };

  const handleSelectRole = (role) => {
    setActiveRole(role);
    if (['vendor', 'picker', 'driver'].includes(role) && vendorIds.length > 0) {
      if (!getActiveVendorId() || !vendorIds.includes(getActiveVendorId())) {
        setActiveVendorId(vendorIds[0]);
      }
    }
    // Clear any shopping/household session so the new role starts clean
    try {
      sessionStorage.removeItem('shoppingForHousehold');
    } catch {}
    if (onSwitch) onSwitch();
    // Hard navigation to the role's landing page — avoids reloading the previous
    // page's heavy dashboards (which were causing 429 rate-limit storms).
    window.location.href = getLandingPathForRole(role);
  };

  const handleSelectVendor = (vendorId) => {
    setActiveVendorId(vendorId);
    if (onSwitch) onSwitch();
    window.location.href = '/VendorDashboard';
  };

  const MenuContent = (
    <>
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {isHe ? 'תפקידים' : 'Switch role'}
      </div>
      {roles.map(role => {
        const meta = ROLE_META[role] || ROLE_META.customerApp;
        const Icon = meta.icon;
        const isActive = role === activeRole;
        return (
          <button
            key={role}
            onClick={() => handleSelectRole(role)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 ${isActive ? 'bg-green-50' : ''}`}
          >
            <span className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${meta.color}`} />
              <span className={isActive ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                {isHe ? meta.he : meta.en}
              </span>
            </span>
            {isActive && <Check className="w-4 h-4 text-green-600" />}
          </button>
        );
      })}
      {isVendorRole && vendorIds.length > 1 && (
        <>
          <div className="border-t my-1" />
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {isHe ? 'חנות' : 'Store'}
          </div>
          {vendorIds.map(vid => {
            const v = vendors[vid];
            const isActive = vid === activeVendorId;
            return (
              <button
                key={vid}
                onClick={() => handleSelectVendor(vid)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 ${isActive ? 'bg-green-50' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-green-600" />
                  <span className={isActive ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                    {v?.name || vid}
                  </span>
                </span>
                {isActive && <Check className="w-4 h-4 text-green-600" />}
              </button>
            );
          })}
        </>
      )}
    </>
  );

  if (variant === "mobile") {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        {MenuContent}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 max-w-[220px]"
        title={isHe ? 'החלף תפקיד' : 'Switch role'}
      >
        <ActiveIcon className={`w-4 h-4 flex-shrink-0 ${activeMeta.color}`} />
        <span className="truncate">
          {activeRoleLabel}
          {isVendorRole && activeVendor && ` · ${activeVendor.name}`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[240px] py-1">
          {MenuContent}
        </div>
      )}
    </div>
  );
}