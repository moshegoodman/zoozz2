import React, { useState, useMemo } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parse } from "date-fns";

export default function PickingFilters({ 
  orders, 
  onFiltersChange,
  isHebrew,
  isAdmin,
  compact = false
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Extract unique households and leads from orders
  const uniqueHouseholds = useMemo(() => {
    const households = new Map();
    orders.forEach(o => {
      const key = o.household_id || o.user_email;
      if (!households.has(key)) {
        households.set(key, {
          id: key,
          name: (isHebrew ? o.household_name_hebrew : null) || o.household_name || o.user_email
        });
      }
    });
    return Array.from(households.values());
  }, [orders, isHebrew]);

  const uniqueLeads = useMemo(() => {
    const leads = new Map();
    orders.forEach(o => {
      if (o.household_lead_name) {
        leads.set(o.household_lead_name, o.household_lead_name);
      }
    });
    return Array.from(leads.values());
  }, [orders]);

  const statusOptions = [
    { value: "pending", label: isHebrew ? "ממתין" : "Pending" },
    { value: "confirmed", label: isHebrew ? "אושר" : "Confirmed" },
    { value: "shopping", label: isHebrew ? "בליקוט" : "Picking" },
    { value: "follow_up", label: isHebrew ? "מעקב" : "Follow Up" }
  ];

  // Apply filters
  const applyFilters = (filtered) => {
    let result = filtered;

    // Filter by households
    if (selectedHouseholds.length > 0) {
      result = result.filter(o => {
        const key = o.household_id || o.user_email;
        return selectedHouseholds.includes(key);
      });
    }

    // Filter by leads
    if (selectedLeads.length > 0) {
      result = result.filter(o => selectedLeads.includes(o.household_lead_name));
    }

    // Filter by statuses
    if (selectedStatuses.length > 0) {
      result = result.filter(o => selectedStatuses.includes(o.status));
    }

    // Filter by delivery date range
    if (dateRange.start || dateRange.end) {
      result = result.filter(o => {
        if (!o.delivery_time) return false;
        const deliveryDate = parse(o.delivery_time.split(' ')[0], 'yyyy-MM-dd', new Date());
        if (dateRange.start && deliveryDate < dateRange.start) return false;
        if (dateRange.end && deliveryDate > dateRange.end) return false;
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
    applyFilters(orders);
  };

  const handleLeadToggle = (lead) => {
    const updated = selectedLeads.includes(lead)
      ? selectedLeads.filter(l => l !== lead)
      : [...selectedLeads, lead];
    setSelectedLeads(updated);
    applyFilters(orders);
  };

  const handleStatusToggle = (status) => {
    const updated = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];
    setSelectedStatuses(updated);
    applyFilters(orders);
  };

  const handleDateChange = (type, value) => {
    const updated = { ...dateRange };
    if (type === "start") updated.start = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
    if (type === "end") updated.end = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
    setDateRange(updated);
    applyFilters(orders);
  };

  const clearAllFilters = () => {
    setSelectedHouseholds([]);
    setSelectedLeads([]);
    setSelectedStatuses([]);
    setDateRange({ start: null, end: null });
    onFiltersChange(orders);
  };

  const hasActiveFilters = selectedHouseholds.length > 0 || selectedLeads.length > 0 || selectedStatuses.length > 0 || dateRange.start || dateRange.end;

  if (compact) {
    return (
      <div className="relative">
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
          <div className="absolute top-9 right-0 bg-white rounded-lg border border-gray-200 shadow-lg p-4 space-y-4 z-50 w-72 max-h-96 overflow-y-auto">
            {/* Households */}
            <div>
              <h4 className="font-semibold text-sm mb-2">{isHebrew ? "משקי בית" : "Households"}</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {uniqueHouseholds.map(h => (
                  <label key={h.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedHouseholds.includes(h.id)}
                      onChange={() => handleHouseholdToggle(h.id)}
                      className="form-checkbox h-4 w-4"
                    />
                    <span className="text-sm text-gray-700 truncate">{h.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Leads */}
            {uniqueLeads.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">{isHebrew ? "אחראים" : "Leads"}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {uniqueLeads.map(lead => (
                    <label key={lead} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead)}
                        onChange={() => handleLeadToggle(lead)}
                        className="form-checkbox h-4 w-4"
                      />
                      <span className="text-sm text-gray-700 truncate">{lead}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <h4 className="font-semibold text-sm mb-2">{isHebrew ? "סטטוס" : "Status"}</h4>
              <div className="space-y-2">
                {statusOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(option.value)}
                      onChange={() => handleStatusToggle(option.value)}
                      className="form-checkbox h-4 w-4"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Delivery Date Range */}
            <div>
              <h4 className="font-semibold text-sm mb-2">{isHebrew ? "טווח תאריך משלוח" : "Delivery Date Range"}</h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-600">{isHebrew ? "מתאריך" : "From"}</label>
                  <input
                    type="date"
                    value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">{isHebrew ? "עד תאריך" : "To"}</label>
                  <input
                    type="date"
                    value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Clear button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                {isHebrew ? "נקה סנונים" : "Clear Filters"}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowFilters(!showFilters)}
        className="w-full flex items-center justify-center gap-2"
      >
        <Filter className="w-4 h-4" />
        {isHebrew ? "סנן הזמנות" : "Filter Orders"}
        {hasActiveFilters && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
          {selectedHouseholds.length + selectedLeads.length + selectedStatuses.length + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
        </span>}
      </Button>

      {showFilters && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
          {/* Households */}
          <div>
            <h4 className="font-semibold text-sm mb-2">{isHebrew ? "משקי בית" : "Households"}</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {uniqueHouseholds.map(h => (
                <label key={h.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedHouseholds.includes(h.id)}
                    onChange={() => handleHouseholdToggle(h.id)}
                    className="form-checkbox h-4 w-4"
                  />
                  <span className="text-sm text-gray-700 truncate">{h.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Leads */}
          {uniqueLeads.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">{isHebrew ? "אחראים" : "Leads"}</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {uniqueLeads.map(lead => (
                  <label key={lead} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead)}
                      onChange={() => handleLeadToggle(lead)}
                      className="form-checkbox h-4 w-4"
                    />
                    <span className="text-sm text-gray-700 truncate">{lead}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <h4 className="font-semibold text-sm mb-2">{isHebrew ? "סטטוס" : "Status"}</h4>
            <div className="space-y-2">
              {statusOptions.map(option => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(option.value)}
                    onChange={() => handleStatusToggle(option.value)}
                    className="form-checkbox h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Delivery Date Range */}
          <div>
            <h4 className="font-semibold text-sm mb-2">{isHebrew ? "טווח תאריך משלוח" : "Delivery Date Range"}</h4>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600">{isHebrew ? "מתאריך" : "From"}</label>
                <input
                  type="date"
                  value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">{isHebrew ? "עד תאריך" : "To"}</label>
                <input
                  type="date"
                  value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-2" />
              {isHebrew ? "נקה סנונים" : "Clear Filters"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}