import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PayrollTimeLog from "./payroll/PayrollTimeLog";
import PayrollAP from "./payroll/PayrollAP";
import PayrollPayments from "./payroll/PayrollPayments";
import PayrollSummary from "./payroll/PayrollSummary";

export default function PayrollManagement() {
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadShared = async () => {
      try {
        const [usersData, householdsData, staffData] = await Promise.all([
          base44.entities.User.list(),
          base44.entities.Household.list(),
          base44.entities.HouseholdStaff.list(),
        ]);
        setUsers(usersData);
        setHouseholds(householdsData);
        setHouseholdStaff(staffData);
      } catch (error) {
        console.error("Error loading payroll shared data:", error);
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
    const filteredHouseholds = country === "__other__"
      ? households.filter(h => h.country !== "Israel" && h.country !== "America")
      : households.filter(h => h.country === country);
    const filteredHouseholdIds = new Set(filteredHouseholds.map(h => h.id));
    const staffUserIds = new Set(
      householdStaff.filter(s => filteredHouseholdIds.has(s.household_id)).map(s => s.staff_user_id)
    );
    const filteredUsers = users.filter(u => staffUserIds.has(u.id));
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
        <PayrollPayments users={filteredUsers} />
      </TabsContent>

      <TabsContent value="payroll">
        <PayrollSummary users={filteredUsers} households={filteredHouseholds} />
      </TabsContent>
    </Tabs>
    );
  };

  return (
    <div className="space-y-4">
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