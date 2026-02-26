import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { household_id, period_start, period_end } = await req.json();

    if (!household_id || !period_start || !period_end) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get all shifts for this household in the period
    const shifts = await base44.asServiceRole.entities.Shift.filter({
      household_id,
      start_date_time: { $gte: period_start }
    });

    const filteredShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.start_date_time);
      return shiftDate >= new Date(period_start) && shiftDate <= new Date(period_end);
    });

    // Group shifts by staff member
    const staffShifts = {};
    filteredShifts.forEach(shift => {
      if (!staffShifts[shift.user_id]) {
        staffShifts[shift.user_id] = [];
      }
      staffShifts[shift.user_id].push(shift);
    });

    // Calculate hours and salary for each staff member
    const payrollData = [];
    for (const [staffId, shifts] of Object.entries(staffShifts)) {
      let totalHours = 0;
      
      shifts.forEach(shift => {
        if (shift.start_date_time && shift.done_date_time) {
          const start = new Date(shift.start_date_time);
          const end = new Date(shift.done_date_time);
          const hours = (end - start) / (1000 * 60 * 60);
          totalHours += hours;
        }
      });

      // Get the user to find their name
      const staffUser = await base44.asServiceRole.entities.User.get(staffId);
      const householdStaff = await base44.asServiceRole.entities.HouseholdStaff.filter({
        staff_user_id: staffId,
        household_id
      });

      const hourlyRate = householdStaff[0]?.price_per_hour || 0;
      const grossSalary = totalHours * hourlyRate;

      payrollData.push({
        staff_user_id: staffId,
        staff_name: staffUser?.full_name || 'Unknown',
        household_id,
        total_hours: Math.round(totalHours * 100) / 100,
        hourly_rate: hourlyRate,
        gross_salary: Math.round(grossSalary * 100) / 100,
        period_start,
        period_end
      });
    }

    return Response.json({ payrollData });
  } catch (error) {
    console.error('Payroll calculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});