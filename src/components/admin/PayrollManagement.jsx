import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, Download, Clock } from "lucide-react";
import { format } from "date-fns";

export default function PayrollManagement() {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('all');
  const [filterHousehold, setFilterHousehold] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shiftsData, usersData, householdsData] = await Promise.all([
        base44.entities.Shift.list(),
        base44.entities.User.list(),
        base44.entities.Household.list()
      ]);

      setShifts(shiftsData);
      setUsers(usersData.filter(u => u.user_type === 'kcs staff'));
      setHouseholds(householdsData);
    } catch (error) {
      console.error("Error loading payroll data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDuration = (start, end) => {
    if (!end) return 0;
    const startTime = new Date(start);
    const endTime = new Date(end);
    return (endTime - startTime) / (1000 * 60 * 60);
  };

  const filteredShifts = shifts.filter(shift => {
    if (filterUser !== 'all' && shift.user_id !== filterUser) return false;
    if (filterHousehold !== 'all' && shift.household_id !== filterHousehold) return false;
    if (startDate && new Date(shift.start_date_time) < new Date(startDate)) return false;
    if (endDate && new Date(shift.start_date_time) > new Date(endDate)) return false;
    return shift.done_date_time; // Only completed shifts
  });

  const calculatePayrollSummary = () => {
    const summary = {};
    
    filteredShifts.forEach(shift => {
      if (!summary[shift.user_id]) {
        const user = users.find(u => u.id === shift.user_id);
        summary[shift.user_id] = {
          userName: user?.full_name || 'Unknown',
          totalHours: 0,
          totalPay: 0,
          shifts: []
        };
      }
      
      const hours = calculateDuration(shift.start_date_time, shift.done_date_time);
      const pay = hours * shift.price_per_hour;
      
      summary[shift.user_id].totalHours += hours;
      summary[shift.user_id].totalPay += pay;
      summary[shift.user_id].shifts.push(shift);
    });

    return Object.values(summary);
  };

  const exportPayroll = () => {
    const summary = calculatePayrollSummary();
    let csv = 'Employee,Total Hours,Total Pay,Number of Shifts\n';
    
    summary.forEach(emp => {
      csv += `${emp.userName},${emp.totalHours.toFixed(2)},${emp.totalPay.toFixed(2)},${emp.shifts.length}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>;
  }

  const payrollSummary = calculatePayrollSummary();
  const totalPay = payrollSummary.reduce((sum, emp) => sum + emp.totalPay, 0);
  const totalHours = payrollSummary.reduce((sum, emp) => sum + emp.totalHours, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold">{payrollSummary.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(2)}</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Payroll</p>
                <p className="text-2xl font-bold text-green-600">₪{totalPay.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filters</span>
            <Button onClick={exportPayroll} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Employee</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="all">All Employees</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Household</label>
              <select
                value={filterHousehold}
                onChange={(e) => setFilterHousehold(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="all">All Households</option>
                {households.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payrollSummary.map(emp => (
              <div key={emp.userName} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{emp.userName}</h3>
                    <p className="text-sm text-gray-600">{emp.shifts.length} shifts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">₪{emp.totalPay.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{emp.totalHours.toFixed(2)} hours</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {emp.shifts.map(shift => {
                    const household = households.find(h => h.id === shift.household_id);
                    const hours = calculateDuration(shift.start_date_time, shift.done_date_time);
                    return (
                      <div key={shift.id} className="text-sm bg-gray-50 p-2 rounded flex justify-between">
                        <div>
                          <span className="font-medium">{household?.name || 'Unknown'}</span>
                          <span className="text-gray-600 ml-2 capitalize">({shift.job})</span>
                          <span className="text-gray-500 ml-2">{format(new Date(shift.start_date_time), 'MMM dd, yyyy')}</span>
                        </div>
                        <div>
                          <span className="font-medium">{hours.toFixed(2)} hrs</span>
                          <span className="text-gray-600 ml-2">@ ₪{shift.price_per_hour}/hr</span>
                          <span className="text-green-600 ml-2 font-semibold">= ₪{(hours * shift.price_per_hour).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {payrollSummary.length === 0 && (
              <p className="text-center text-gray-500 py-8">No shifts found for selected filters</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}