import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, UserCog, Check } from "lucide-react";
import { getActiveRole, setActiveRole, getActiveVendorId, setActiveVendorId, getUserRoles } from "@/lib/activeRole";
import { Vendor } from "@/entities/all";
import { useLanguage } from "@/components/i18n/LanguageContext";

const ROLE_LABELS = {
  'admin': { en: 'Admin', he: 'מנהל' },
  'chief of staff': { en: 'Chief of Staff', he: 'ראש צוות' },
  'vendor': { en: 'Vendor', he: 'ספק' },
  'picker': { en: 'Picker', he: 'מלקט' },
  'driver': { en: 'Driver', he: 'נהג' },
  'kcs staff': { en: 'KCS Staff', he: 'צוות KCS' },
  'household owner': { en: 'Household Owner', he: 'בעל בית' },
  'customerApp': { en: 'Customer', he: 'לקוח' },
};

export default function RoleSwitcherBanner({ user, topOffset = 0 }) {
  const { language } = useLanguage();
  const roles = getUserRoles(user);
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

  // Load vendor names for multi-vendor users
  useEffect(() => {
    const vendorIds = user?.vendor_ids || [];
    if (vendorIds.length === 0) return;
    Promise.all(vendorIds.map(id => Vendor.get(id).catch(() => null)))
      .then(list => {
        const map = {};
        list.forEach(v => { if (v) map[v.id] = v; });
        setVendors(map);
      });
  }, [user?.vendor_ids?.join(',')]);

  if (!user || roles.length <= 1) return null;

  const activeRole = getActiveRole() || roles[0];
  const activeVendorId = getActiveVendorId();
  const activeRoleLabel = ROLE_LABELS[activeRole]?.[language === 'Hebrew' ? 'he' : 'en'] || activeRole;
  const activeVendor = activeVendorId ? vendors[activeVendorId] : null;
  const vendorIds = user.vendor_ids || (user.vendor_id ? [user.vendor_id] : []);
  const isVendorRole = ['vendor', 'picker', 'driver'].includes(activeRole);

  const handleSelectRole = (role) => {
    setActiveRole(role);
    // If switching to a vendor role and we have vendor_ids, default to first
    if (['vendor', 'picker', 'driver'].includes(role) && vendorIds.length > 0) {
      if (!getActiveVendorId() || !vendorIds.includes(getActiveVendorId())) {
        setActiveVendorId(vendorIds[0]);
      }
    }
    window.location.reload();
  };

  const handleSelectVendor = (vendorId) => {
    setActiveVendorId(vendorId);
    window.location.reload();
  };

  return (
    <div
      className="w-full bg-indigo-700 text-white text-center text-sm font-medium fixed left-0 right-0 z-50 h-[34px] flex items-center justify-center px-2"
      style={{ top: `${topOffset}px` }}
    >
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1 rounded hover:bg-indigo-800"
        >
          <UserCog className="w-4 h-4" />
          <span>
            {language === 'Hebrew' ? 'פועל כ:' : 'Acting as:'}{' '}
            <strong>{activeRoleLabel}{isVendorRole && activeVendor ? ` — ${activeVendor.name}` : ''}</strong>
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white text-gray-800 rounded-lg shadow-xl border min-w-[240px] py-1 text-left">
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
              {language === 'Hebrew' ? 'תפקידים' : 'Roles'}
            </div>
            {roles.map(role => {
              const label = ROLE_LABELS[role]?.[language === 'Hebrew' ? 'he' : 'en'] || role;
              const isActive = role === activeRole;
              return (
                <button
                  key={role}
                  onClick={() => handleSelectRole(role)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${isActive ? 'bg-indigo-50 font-semibold' : ''}`}
                >
                  <span>{label}</span>
                  {isActive && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              );
            })}
            {isVendorRole && vendorIds.length > 1 && (
              <>
                <div className="border-t my-1" />
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                  {language === 'Hebrew' ? 'חנות' : 'Store'}
                </div>
                {vendorIds.map(vid => {
                  const v = vendors[vid];
                  const isActive = vid === activeVendorId;
                  return (
                    <button
                      key={vid}
                      onClick={() => handleSelectVendor(vid)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${isActive ? 'bg-indigo-50 font-semibold' : ''}`}
                    >
                      <span>{v?.name || vid}</span>
                      {isActive && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}