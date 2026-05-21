import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PayrollTimeLog from "./payroll/PayrollTimeLog";
import PayrollAP from "./payroll/PayrollAP";
import PayrollPayments from "./payroll/PayrollPayments";
import PayrollSummary from "./payroll/PayrollSummary";
import SeasonFilter from "./SeasonFilter";

export default function PayrollManagement() {
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(null); // null = not yet initialized

  useEffect(() => {
    const loadShared = async () => {
      try {
        // Use a high limit so payroll always sees the full set
        // (default page size can otherwise truncate users/households/staff and
        // cause rows to silently go missing from the payroll tabs).
        const [usersData, householdsData, staffData, appSettings] = await Promise.all([
          base44.entities.User.list("-created_date", 5000),
          base44.entities.Household.list("-created_date", 5000),
          base44.entities.HouseholdStaff.list("-created_date", 5000),
          base44.entities.AppSettings.list(),
        ]);
        setUsers(usersData);
        setHouseholds(householdsData);
        setHouseholdStaff(staffData);
        // Default to the active season from AppSettings (empty string => All seasons)
        const activeSeason = appSettings?.[0]?.activeSeason || "";
        setSelectedSeason(activeSeason);
      } catch (error) {
        console.error("Error loading payroll shared data:", error);
        setSelectedSeason("");
      } finally {
        setIsLoading(false);
      }
    };
    loadShared();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const getFilteredData = (country) => {
    const USA_VALUES = ["america", "usa"];
    const ISRAEL_VALUES = ["israel"];
    const normalize = (c) => (c || "").toLowerCase().trim();
    const isUSA = (h) => USA_VALUES.includes(normalize(h.country));
    const isIsrael = (h) => ISRAEL_VALUES.includes(normalize(h.country)) || !normalize(h.country);

    let filteredHouseholds = country === "__other__"
      ? households.filter(h => !isUSA(h) && !isIsrael(h))
      : country === "America"
        ? households.filter(h => isUSA(h))
        : households.filter(h => isIsrael(h));

    // Apply season filter (empty string => All seasons)
    if (selectedSeason) {
      const seasonKey = selectedSeason.toUpperCase();
      filteredHouseholds = filteredHouseholds.filter(h => (h.season || "").toUpperCase() === seasonKey);
    }

    const filteredHouseholdIds = new Set(filteredHouseholds.map(h => h.id));
    const staffUserIds = new Set(
      householdStaff.filter(s => filteredHouseholdIds.has(s.household_id)).map(s => s.staff_user_id)
    );
    // Always include admin and chief of staff users regardless of HouseholdStaff assignments
    const filteredUsers = users.filter(u =>
      staffUserIds.has(u.id) || ['admin', 'chief of staff'].includes(u.user_type)
    );
    return { filteredUsers, filteredHouseholds };
  };

  const renderInner = (country) => {
    const { filteredUsers, filteredHouseholds } = getFilteredData(country);
    return (
    <Tabs defaultValue="timelog">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="timelog">Time Log</TabsTrigger>
        <TabsTrigger value="ap">AP</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="payroll">Payroll</TabsTrigger>
      </TabsList>

      <TabsContent value="timelog">
        <PayrollTimeLog users={filteredUsers} households={filteredHouseholds} />
      </TabsContent>

      <TabsContent value="ap">
        <PayrollAP users={filteredUsers} households={filteredHouseholds} />
      </TabsContent>

      <TabsContent value="payments">
        <PayrollPayments users={filteredUsers} selectedSeason={selectedSeason} />
      </TabsContent>

      <TabsContent value="payroll">
        <PayrollSummary users={filteredUsers} households={filteredHouseholds} />
      </TabsContent>
    </Tabs>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border p-3">
        <SeasonFilter
          households={households}
          value={selectedSeason || ""}
          onChange={setSelectedSeason}
        />
      </div>
      <Tabs defaultValue="israel">
        <TabsList className="mb-2 flex w-full">
          <TabsTrigger value="israel" className="flex-1">🇮🇱 Israel</TabsTrigger>
          <TabsTrigger value="america" className="flex-1">🇺🇸 America</TabsTrigger>
          <TabsTrigger value="other" className="text-xs text-gray-400 px-3">Other</TabsTrigger>
        </TabsList>
        <TabsContent value="israel">{renderInner("Israel")}</TabsContent>
        <TabsContent value="america">{renderInner("America")}</TabsContent>
        <TabsContent value="other">{renderInner("__other__")}</TabsContent>
      </Tabs>
    </div>
  );
}