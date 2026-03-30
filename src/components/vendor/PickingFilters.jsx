import React, { useState, useMemo, useEffect, useRef } from "react";
import { Filter, X, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Vendor } from "@/entities/all";
import { format, parse } from "date-fns";

export default function PickingFilters({ 
  orders, 
  allOrders,
  onFiltersChange,
  isHebrew,
  isAdmin,
  compact = false
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [vendorNames, setVendorNames] = useState({});
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showFilters) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  // Detect the most common season from household_codes (use allOrders for detection so admins always see it)
  const detectedSeason = useMemo(() => {
    const base = allOrders || orders;
    const seasonCounts = {};
    base.forEach(o => {
      if (o.household_code) {
        const parts = o.household_code.split('-');
        if (parts.length >= 2) {
          const season = parts.slice(1).join('-');
          seasonCounts[season] = (seasonCounts[season] || 0) + 1;
        }
      }
    });
    const entries = Object.entries(seasonCounts);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [orders, allOrders]);

  // Extract unique households and leads from all available orders
  const baseForOptions = allOrders || orders;
  const uniqueHouseholds = useMemo(() => {
    const households = new Map();
    baseForOptions.forEach(o => {
      const key = o.household_id || o.user_email;
      if (!households.has(key)) {
        households.set(key, {
          id: key,
          name: (isHebrew ? o.household_name_hebrew : null) || o.household_name || o.user_email
        });
      }
    });
    return Array.from(households.values());
  }, [baseForOptions, isHebrew]);

  const uniqueLeads = useMemo(() => {
    const leads = new Map();
    baseForOptions.forEach(o => {
      if (o.household_lead_name) {
        leads.set(o.household_lead_name, o.household_lead_name);
      }
    });
    return Array.from(leads.values());
  }, [baseForOptions]);

  useEffect(() => {
    const fetchVendorNames = async () => {
      try {
        const vendors = await Vendor.list();
        const nameMap = {};
        vendors.forEach(v => {
          nameMap[v.id] = v.name;
        });
        setVendorNames(nameMap);
      } catch (error) {
        console.error('Failed to fetch vendors:', error);
      }
    };
    fetchVendorNames();
  }, []);

  const uniqueVendors = useMemo(() => {
    if (!isAdmin) return [];
    const vendors = new Map();
    baseForOptions.forEach(o => {
      if (o.vendor_id) {
        vendors.set(o.vendor_id, o.vendor_id);
      }
    });
    return Array.from(vendors.values()).sort();
  }, [baseForOptions, isAdmin]);

  const statusOptions = [
    { value: "pending", label: isHebrew ? "ממתין" : "Pending" },
    { value: "confirmed", label: isHebrew ? "אושר" : "Confirmed" },
    { value: "shopping", label: isHebrew ? "בליקוט" : "Picking" },
    { value: "ready_for_shipping", label: isHebrew ? "מוכן למשלוח" : "Ready for Shipping" },
    { value: "delivery", label: isHebrew ? "במשלוח" : "Delivery" },
    { value: "delivered", label: isHebrew ? "נמסר" : "Delivered" },
    { value: "cancelled", label: isHebrew ? "ביטול" : "Cancelled" },
    { value: "follow_up", label: isHebrew ? "הזמנת השלמה" : "Follow Up" }
  ];

  // Core filter logic — accepts explicit current values to avoid stale closure bugs
  const applyFiltersWithOverrides = ({
    households = selectedHouseholds,
    leads = selectedLeads,
    statuses = selectedStatuses,
    vendors = selectedVendors,
    date = dateRange,
    showAll = showAllSeasons,
  } = {}) => {
    // Always use allOrders as the full source; fall back to orders if allOrders not provided
    const fullSource = allOrders || orders;
    let result = showAll ? fullSource : fullSource.filter(o => {
      // When not showing all seasons, restrict to detected season only
      if (!detectedSeason) return true;
      if (!o.household_code) return true;
      const parts = o.household_code.split('-');
      if (parts.length < 2) return true;
      return parts.slice(1).join('-') === detectedSeason;
    });

    if (households.length > 0) {
      result = result.filter(o => households.includes(o.household_id || o.user_email));
    }

    if (leads.length > 0) {
      result = result.filter(o => leads.includes(o.household_lead_name));
    }

    if (statuses.length > 0) {
      result = result.filter(o => statuses.includes(o.status));
    }

    if (vendors.length > 0) {
      result = result.filter(o => vendors.includes(o.vendor_id));
    }

    if (date.start || date.end) {
      result = result.filter(o => {
        if (!o.delivery_time) return false;
        const deliveryDate = parse(o.delivery_time.split(' ')[0], 'yyyy-MM-dd', new Date());
        if (date.start && deliveryDate < date.start) return false;
        if (date.end && deliveryDate > date.end) return false;
        return true;
      });
    }

    onFiltersChange(result);
  };

  const handleHouseholdToggle = (id) => {
    const updated = selectedHouseholds.includes(id)
      ? selectedHouseholds.filter(h => h !== id)
      : [...selectedHouseholds, id];
    setSelectedHouseholds(updated);
    applyFiltersWithOverrides({ households: updated });
  };

  const handleLeadToggle = (lead) => {
    const updated = selectedLeads.includes(lead)
      ? selectedLeads.filter(l => l !== lead)
      : [...selectedLeads, lead];
    setSelectedLeads(updated);
    applyFiltersWithOverrides({ leads: updated });
  };

  const handleStatusToggle = (status) => {
    const updated = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];
    setSelectedStatuses(updated);
    applyFiltersWithOverrides({ statuses: updated });
  };

  const handleVendorToggle = (vendorId) => {
    const updated = selectedVendors.includes(vendorId)
      ? selectedVendors.filter(v => v !== vendorId)
      : [...selectedVendors, vendorId];
    setSelectedVendors(updated);
    applyFiltersWithOverrides({ vendors: updated });
  };

  const handleDateChange = (type, value) => {
    const updated = { ...dateRange };
    if (type === "start") updated.start = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
    if (type === "end") updated.end = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
    setDateRange(updated);
    applyFiltersWithOverrides({ date: updated });
  };

  const handleSeasonToggle = () => {
    const next = !showAllSeasons;
    setShowAllSeasons(next);
    applyFiltersWithOverrides({ showAll: next });
  };

  const clearAllFilters = () => {
    setSelectedHouseholds([]);
    setSelectedLeads([]);
    setSelectedStatuses([]);
    setSelectedVendors([]);
    setDateRange({ start: null, end: null });
    setShowAllSeasons(false);
    applyFiltersWithOverrides({ households: [], leads: [], statuses: [], vendors: [], date: { start: null, end: null }, showAll: false });
  };

  // Show season toggle if there are multiple distinct seasons in allOrders, or if detectedSeason is set
  const hasMultipleSeasons = useMemo(() => {
    const base = allOrders || orders;
    const seasons = new Set();
    base.forEach(o => {
      if (o.household_code) {
        const parts = o.household_code.split('-');
        if (parts.length >= 2) seasons.add(parts.slice(1).join('-'));
      }
    });
    return seasons.size > 1;
  }, [allOrders, orders]);

  const showSeasonToggle = detectedSeason || hasMultipleSeasons;

  const hasActiveFilters = selectedHouseholds.length > 0 || selectedLeads.length > 0 || selectedStatuses.length > 0 || selectedVendors.length > 0 || dateRange.start || dateRange.end || showAllSeasons;

  const dateActiveCount = (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0);

  // Track which sections are open — default open if has active filters
  const [openSections, setOpenSections] = useState({ households: true, leads: false, status: false, vendors: false, date: false });

  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const FilterSection = ({ sectionKey, label, activeCount, children }) => {
    const isOpen = openSections[sectionKey];
    const hasActive = activeCount > 0;
    return (
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${hasActive ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100"}`}
        >
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <div className="flex items-center gap-2">
            {hasActive && (
              <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-xs font-bold leading-none">
                {activeCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </button>
        {isOpen && (
          <div className="px-3 py-2 bg-white">
            {children}
          </div>
        )}
      </div>
    );
  };

  const FilterContent = () => (
    <div className="space-y-2">
      {/* Clear Filters (top) */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => clearAllFilters()}
          className="w-full text-red-600 border-red-200 hover:bg-red-50 mb-1"
        >
          <X className="w-4 h-4 mr-2" />
          {isHebrew ? "נקה סנונים" : "Clear All Filters"}
        </Button>
      )}

      {/* Households */}
      <FilterSection sectionKey="households" label={isHebrew ? "משקי בית" : "Households"} activeCount={selectedHouseholds.length}>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto py-1">
          {uniqueHouseholds.map(h => {
            const isSelected = selectedHouseholds.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => handleHouseholdToggle(h.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span className="truncate max-w-[140px]">{h.name}</span>
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Leads */}
      {uniqueLeads.length > 0 && (
        <FilterSection sectionKey="leads" label={isHebrew ? "אחראים" : "Leads"} activeCount={selectedLeads.length}>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto py-1">
            {uniqueLeads.map(lead => {
              const isSelected = selectedLeads.includes(lead);
              return (
                <button
                  key={lead}
                  type="button"
                  onClick={() => handleLeadToggle(lead)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{lead}</span>
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Status */}
      <FilterSection sectionKey="status" label={isHebrew ? "סטטוס" : "Status"} activeCount={selectedStatuses.length}>
        <div className="flex flex-wrap gap-2 py-1">
          {statusOptions.map(option => {
            const isSelected = selectedStatuses.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStatusToggle(option.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Vendors (Admin only) */}
      {isAdmin && uniqueVendors.length > 0 && (
        <FilterSection sectionKey="vendors" label={isHebrew ? "חנויות" : "Vendors"} activeCount={selectedVendors.length}>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto py-1">
            {uniqueVendors.map(vendorId => {
              const isSelected = selectedVendors.includes(vendorId);
              return (
                <button
                  key={vendorId}
                  type="button"
                  onClick={() => handleVendorToggle(vendorId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span className="truncate max-w-[140px]">{vendorNames[vendorId] || vendorId}</span>
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Delivery Date Range */}
      <FilterSection sectionKey="date" label={isHebrew ? "טווח תאריך משלוח" : "Delivery Date"} activeCount={dateActiveCount}>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">{isHebrew ? "מתאריך" : "From"}</label>
            <input type="date" value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''} onChange={(e) => handleDateChange('start', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">{isHebrew ? "עד תאריך" : "To"}</label>
            <input type="date" value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''} onChange={(e) => handleDateChange('end', e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </FilterSection>
    </div>
  );

  // Mobile: Bottom drawer
  if (!compact) {
    return (
      <div className="space-y-3 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-center gap-2"
        >
          <Filter className="w-4 h-4" />
          {isHebrew ? "סנן הזמנות" : "Filter Orders"}
          {hasActiveFilters && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
            {selectedHouseholds.length + selectedLeads.length + selectedStatuses.length + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
          </span>}
        </Button>

        {/* Mobile: Bottom Sheet Drawer */}
        {showFilters && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setShowFilters(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between rounded-t-2xl">
                <h3 className="font-bold text-lg">{isHebrew ? "סנן הזמנות" : "Filter Orders"}</h3>
                <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Content */}
              <div className="px-4 py-4 pb-24">
                <FilterContent />
              </div>

              {/* Footer Actions */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => {
                      clearAllFilters();
                    }}
                  >
                    {isHebrew ? "נקה" : "Clear"}
                  </Button>
                )}
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setShowFilters(false)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isHebrew ? "סגור" : "Done"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Compact mode (in small spaces): Just the icon button for both mobile & desktop
  if (compact) {
    return (
      <div className="relative" ref={containerRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-center gap-2"
        >
          <Filter className="w-4 h-4" />
          {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
        </Button>

        {showFilters && (
          <>
            {/* Mobile overlay */}
            <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setShowFilters(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between rounded-t-2xl">
                <h3 className="font-bold text-lg">{isHebrew ? "סנן הזמנות" : "Filter Orders"}</h3>
                <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 py-4 pb-24">
                <FilterContent />
              </div>
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => clearAllFilters()}
                  >
                    {isHebrew ? "נקה" : "Clear"}
                  </Button>
                )}
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowFilters(false)}>
                  <Check className="w-4 h-4 mr-2" />
                  {isHebrew ? "סגור" : "Done"}
                </Button>
              </div>
            </div>

            {/* Desktop dropdown */}
            <div className="hidden md:block absolute top-10 left-0 bg-white rounded-lg border border-gray-200 shadow-lg p-4 space-y-4 z-30 w-72 max-h-[60vh] overflow-y-auto">
              <FilterContent />
            </div>
          </>
        )}
      </div>
    );
  }

  // Desktop: Icon button with compact dropdown (non-compact mode)
  return (
    <div className="relative hidden md:block" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowFilters(!showFilters)}
        className="h-8 w-8 relative"
      >
        <Filter className="w-4 h-4" />
        {hasActiveFilters && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </Button>

      {showFilters && (
        <div className="absolute top-10 left-0 bg-white rounded-lg border border-gray-200 shadow-lg p-4 space-y-4 z-30 w-72 max-h-[60vh] overflow-y-auto">
          <FilterContent />
        </div>
      )}
    </div>
  );
}