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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadShared = async () => {
      try {
        const [usersData, householdsData] = await Promise.all([
          base44.entities.User.list(),
          base44.entities.Household.list()
        ]);
        setUsers(usersData);
        setHouseholds(householdsData);
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

  return (
    <div className="space-y-4">
      <Tabs defaultValue="timelog">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timelog">Time Log</TabsTrigger>
          <TabsTrigger value="ap">AP</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="timelog">
          <PayrollTimeLog users={users} households={households} />
        </TabsContent>

        <TabsContent value="ap">
          <PayrollAP users={users} households={households} />
        </TabsContent>

        <TabsContent value="payments">
          <PayrollPayments users={users} />
        </TabsContent>
      </Tabs>
    </div>
  );
}