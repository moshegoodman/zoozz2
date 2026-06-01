import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ChevronDown, X } from "lucide-react";
import InvoicingAP from "./InvoicingAP";
import InvoicingTimeLog from "./InvoicingTimeLog";
import InvoicingOrdersSummary from "./InvoicingOrdersSummary";
import InvoicingFullSummary from "./InvoicingFullSummary";
import SpendingReport from "./SpendingReport";
import InvoicingOverview from "./InvoicingOverview";
import SeasonFilter from "../SeasonFilter";

const SUB_TABS = [
  { id: "overview", label: "Overview" },
  { id: "timelog", label: "Time Log" },
  { id: "ap", label: "A/P (Purchasing)" },
  { id: "orders", label: "Orders Summary" },
  { id: "summary", label: "Full Summary" },
  { id: "spending_report", label: "Spending Report" },
];

export default function ClientInvoicing({ households, orders, users, vendors }) {
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [subTab, setSubTab] = useState("overview");
  const [appSettings, setAppSettings] = useState(null);
  const [localOrders, setLocalOrders] = useState(orders);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null); // null = not yet initialized
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    base44.entities.AppSettings.list().then(s => {
      const settings = s?.[0] || null;
      setAppSettings(settings);
      // Default season to AppSettings.activeSeason (empty string => All seasons)
      setSelectedSeason(settings?.activeSeason || "");
    }).catch(() => setSelectedSeason(""));
  }, []);

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  const handleRefresh = async () => {
    const updated = await base44.entities.Order.list();
    setLocalOrders(updated);
  };

  const selectedHousehold = useMemo(
    () => households.find(h => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  // Households filtered by the currently selected season (used by Overview, Spending Report, and the household selector below).
  const seasonFilteredHouseholds = useMemo(() => {
    if (!selectedSeason) return households;
    const key = selectedSeason.toUpperCase();
    return households.filter(h => (h.season || "").toUpperCase() === key);
  }, [households, selectedSeason]);

  // Clear household selection if it falls outside the current season filter
  useEffect(() => {
    if (selectedHouseholdId && !seasonFilteredHouseholds.find(h => h.id === selectedHouseholdId)) {
      setSelectedHouseholdId("");
    }
  }, [seasonFilteredHouseholds, selectedHouseholdId]);

  const filteredHouseholds = useMemo(() => {
    if (!search.trim()) return seasonFilteredHouseholds;
    const q = search.toLowerCase();
    return seasonFilteredHouseholds.filter(h =>
      (h.name || "").toLowerCase().includes(q) ||
      (h.name_hebrew || "").toLowerCase().includes(q) ||
      (h.season || "").toLowerCase().includes(q)
    );
  }, [seasonFilteredHouseholds, search]);

  const handleSelect = (id) => {
    setSelectedHouseholdId(id);
    setSearch("");
    setDropdownOpen(false);
  };

  const displayValue = selectedHousehold
    ? `${selectedHousehold.name}${selectedHousehold.name_hebrew ? ` / ${selectedHousehold.name_hebrew}` : ""}${selectedHousehold.season ? ` (${selectedHousehold.season})` : ""}`
    : "";

  return (
    <div className="space-y-5">
      {/* Season filter — always visible, defaults to active season */}
      <div className="bg-white rounded-lg shadow-sm border p-3">
        <SeasonFilter
          households={households}
          value={selectedSeason || ""}
          onChange={setSelectedSeason}
        />
      </div>

      {/* Tab nav — always visible */}
      <div className="flex gap-1 bg-white rounded-lg shadow-sm border p-1 flex-wrap">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              subTab === tab.id
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview — no household required */}
      {subTab === "overview" && (
        <InvoicingOverview households={seasonFilteredHouseholds} orders={localOrders} vendors={vendors} />
      )}

      {/* Spending Report — no household required */}
      {subTab === "spending_report" && (
        <SpendingReport households={seasonFilteredHouseholds} orders={localOrders} />
      )}

      {/* Per-household tabs */}
      {subTab !== "spending_report" && subTab !== "overview" && (
        <>
          {/* Household selector */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Home className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Household / Client:</label>
                <div className="relative w-72" ref={dropdownRef}>
                  <div className="flex items-center border border-gray-300 rounded-md bg-white px-2 h-9 gap-1 focus-within:ring-1 focus-within:ring-blue-400 focus-within:border-blue-400">
                    <input
                      className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
                      placeholder={selectedHousehold ? displayValue : "Search or select a household..."}
                      value={dropdownOpen ? search : (selectedHousehold ? displayValue : "")}
                      onFocus={() => { setDropdownOpen(true); setSearch(""); }}
                      onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
                    />
                    {selectedHouseholdId && (
                      <button onClick={() => { setSelectedHouseholdId(""); setSearch(""); }} className="text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredHouseholds.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400 italic">No households found</div>
                      )}
                      {filteredHouseholds.map(h => (
                        <button
                          key={h.id}
                          onClick={() => handleSelect(h.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${h.id === selectedHouseholdId ? "bg-blue-50 font-semibold text-blue-700" : "text-gray-700"}`}
                        >
                          {h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}{h.season ? ` (${h.season})` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedHouseholdId && (
            <>
              {subTab === "ap" && (
                <InvoicingAP key={selectedHouseholdId} household={selectedHousehold} users={users} appSettings={appSettings} />
              )}
              {subTab === "timelog" && (
                <InvoicingTimeLog key={selectedHouseholdId} household={selectedHousehold} appSettings={appSettings} />
              )}
              {subTab === "orders" && (
                <InvoicingOrdersSummary key={selectedHouseholdId} household={selectedHousehold} orders={localOrders} vendors={vendors} onRefresh={handleRefresh} />
              )}
              {subTab === "summary" && (
                <InvoicingFullSummary key={selectedHouseholdId} household={selectedHousehold} orders={localOrders} appSettings={appSettings} />
              )}
            </>
          )}

          {!selectedHouseholdId && (
            <div className="text-center py-16 text-gray-400">
              <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a household above to begin invoicing.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}