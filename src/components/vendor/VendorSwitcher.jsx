import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Store, Loader2 } from "lucide-react";
import { Vendor } from "@/entities/all";
import { User } from "@/entities/User";

/**
 * Vendor switcher — shows current vendor name and (when the user has access to
 * more than one vendor) allows switching the active vendor via dropdown.
 *
 * Switching sets user.vendor_id on the User entity and reloads the app so all
 * vendor-scoped data refetches with the new vendor context.
 */
export default function VendorSwitcher({ user, isHebrew = false, variant = "mobile" }) {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(null);
  const wrapperRef = useRef(null);

  const ids = Array.isArray(user?.vendor_ids) && user.vendor_ids.length > 0
    ? user.vendor_ids
    : (user?.vendor_id ? [user.vendor_id] : []);
  const hasMultiple = ids.length > 1;

  // Load vendor list lazily on first open
  useEffect(() => {
    if (!open || vendors.length > 0 || !hasMultiple) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const results = await Promise.all(ids.map(id => Vendor.get(id).catch(() => null)));
        if (!cancelled) setVendors(results.filter(Boolean));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, hasMultiple, ids.join(",")]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentVendor = vendors.find(v => v.id === user?.vendor_id);
  const currentName = isHebrew
    ? (currentVendor?.name_hebrew || currentVendor?.name || user?.vendor_name || user?.full_name || "")
    : (currentVendor?.name || user?.vendor_name || user?.full_name || "");

  const handleSwitch = async (vendorId) => {
    if (!vendorId || vendorId === user?.vendor_id) { setOpen(false); return; }
    setSwitching(vendorId);
    try {
      await User.updateMyUserData({ vendor_id: vendorId });
      // Reload so the entire app refetches with the new vendor context
      window.location.reload();
    } catch (e) {
      console.error("Failed to switch vendor:", e);
      setSwitching(null);
    }
  };

  // Single-vendor: just show the name as plain text (no dropdown affordance)
  if (!hasMultiple) {
    return (
      <span className={variant === "mobile" ? "font-semibold text-gray-900 text-sm truncate max-w-[120px]" : "font-bold text-gray-900 dark:text-white text-xl"}>
        {currentName}
      </span>
    );
  }

  const triggerClass = variant === "mobile"
    ? "flex items-center gap-1 font-semibold text-gray-900 text-sm truncate max-w-[160px] hover:text-gray-700"
    : "flex items-center gap-1.5 font-bold text-gray-900 dark:text-white text-xl hover:text-gray-700 dark:hover:text-gray-200";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
        className={triggerClass}
        aria-label={isHebrew ? "החלף ספק" : "Switch vendor"}
      >
        <span className="truncate">{currentName}</span>
        <ChevronDown className={`flex-shrink-0 ${variant === "mobile" ? "w-3.5 h-3.5" : "w-4 h-4"} text-gray-500`} />
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 ${variant === "mobile" ? "left-0" : "left-0"} bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-64 py-1 max-h-80 overflow-y-auto`}>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
            {isHebrew ? "החלף ספק" : "Switch Vendor"}
          </div>
          {loading && (
            <div className="flex items-center justify-center py-4 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {!loading && vendors.map(v => {
            const isActive = v.id === user?.vendor_id;
            const isSwitching = switching === v.id;
            const name = isHebrew ? (v.name_hebrew || v.name) : v.name;
            return (
              <button
                key={v.id}
                onClick={() => handleSwitch(v.id)}
                disabled={isSwitching || isActive}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                  isActive
                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                } disabled:opacity-60`}
              >
                <Store className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span className="flex-1 truncate">{name}</span>
                {isSwitching ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />
                ) : isActive ? (
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}