import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Home } from "lucide-react";
import InvoicingAP from "./InvoicingAP";
import InvoicingTimeLog from "./InvoicingTimeLog";
import InvoicingOrdersSummary from "./InvoicingOrdersSummary";
import InvoicingFullSummary from "./InvoicingFullSummary";

const SUB_TABS = [
  { id: "timelog", label: "Time Log" },
  { id: "ap", label: "A/P (Purchasing)" },
  { id: "orders", label: "Orders Summary" },
  { id: "summary", label: "Full Summary" },
];

export default function ClientInvoicing({ households, orders, users, vendors }) {
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [subTab, setSubTab] = useState("ap");
  const [appSettings, setAppSettings] = useState(null);

  useEffect(() => {
    base44.entities.AppSettings.list().then(s => setAppSettings(s?.[0] || null));
  }, []);

  const selectedHousehold = useMemo(
    () => households.find(h => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  return (
    <div className="space-y-5">
      {/* Household selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Home className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Household / Client:</label>
            <Select value={selectedHouseholdId} onValueChange={setSelectedHouseholdId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a household to invoice..." />
              </SelectTrigger>
              <SelectContent>
                {households.map(h => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}{h.name_hebrew ? ` / ${h.name_hebrew}` : ""}{h.season ? ` (${h.season})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedHouseholdId && (
        <>
          {/* Sub-tab nav */}
          <div className="flex gap-1 bg-white rounded-lg shadow-sm border p-1">
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

          {/* Sub-tab content */}
          {subTab === "ap" && (
            <InvoicingAP
              household={selectedHousehold}
              users={users}
              appSettings={appSettings}
            />
          )}
          {subTab === "timelog" && (
            <InvoicingTimeLog
              household={selectedHousehold}
              appSettings={appSettings}
            />
          )}
          {subTab === "orders" && (
            <InvoicingOrdersSummary
              household={selectedHousehold}
              orders={orders}
              vendors={vendors}
            />
          )}
          {subTab === "summary" && (
            <InvoicingFullSummary
              household={selectedHousehold}
              orders={orders}
              appSettings={appSettings}
            />
          )}
        </>
      )}

      {!selectedHouseholdId && (
        <div className="text-center py-16 text-gray-400">
          <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a household above to begin invoicing.</p>
        </div>
      )}
    </div>
  );
}