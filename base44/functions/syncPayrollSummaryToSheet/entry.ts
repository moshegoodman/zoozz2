import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ISRAEL_SHEET_ID = '1jKhDfOu60pieSde3wK03rSnYwjJecftLfRkPLSkFDzM';
const AMERICA_SHEET_ID = '1K_CbUcVo2kmtOVP4ghbLkIDarO1kGDe-i3oPdACYSy0';
const USA_VALS = ['america', 'usa'];
const TAB = 'payroll';
const HEADERS = ['Employee', 'Shift Pay', 'Expenses', 'Payments', 'Balance (=B+C-D)', 'Confirmed by Staff', 'Was Paid'];

// Build per-employee payroll summary using raw entity data
async function buildSummaryRows(base44) {
    const [shifts, expenses, payments, payrolls, users, households] = await Promise.all([
        base44.asServiceRole.entities.Shift.list(),
        base44.asServiceRole.entities.Expense.list(),
        base44.asServiceRole.entities.KCSPayment.list(),
        base44.asServiceRole.entities.Payroll.list(),
        base44.asServiceRole.entities.User.filter({ user_type: 'kcs staff' }),
        base44.asServiceRole.entities.Household.list(),
    ]);

    const STAFF_PAID = ['Staff member CC', 'Staff member Cash'];

    return users.map(user => {
        const userShifts = shifts.filter(s => s.user_id === user.id && s.is_approved && (s.done_date_time || s.payment_type === 'daily'));
        const userExpenses = expenses.filter(e => e.user_id === user.id && e.is_approved && STAFF_PAID.includes(e.paid_by));
        const userPayments = payments.filter(p => p.employee_user_id === user.id);
        const payroll = payrolls.find(pr => pr.user_id === user.id);

        const calcHours = (s, e) => (!s || !e) ? 0 : (new Date(e) - new Date(s)) / 3600000;

        const totalShifts = userShifts.reduce((sum, s) => {
            if (s.payment_type === 'daily') return sum + (s.price_per_day || 0);
            return sum + calcHours(s.start_date_time, s.done_date_time) * (s.price_per_hour || 0);
        }, 0);
        const totalExpenses = userExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalPaid = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        if (totalShifts === 0 && totalExpenses === 0 && totalPaid === 0) return null;

        // Determine currency: if any shift household is American, use USD
        const householdIds = [...new Set(userShifts.map(s => s.household_id).filter(Boolean))];
        const anyAmerican = householdIds.some(id => {
            const h = households.find(hh => hh.id === id);
            return h && USA_VALS.includes((h.country || '').toLowerCase().trim());
        });

        return {
            name: user.full_name || user.email,
            totalShifts,
            totalExpenses,
            totalPaid,
            confirmed: payroll?.confirmed_by_staff ? 'Yes' : 'No',
            wasPaid: payroll?.was_paid ? 'Yes' : 'No',
            isAmerican: anyAmerican,
        };
    }).filter(Boolean);
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const summaryRows = await buildSummaryRows(base44);

        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

        // Write to both sheets (rows will just be empty for the non-applicable one if currency differs)
        // We split by isAmerican flag
        const israelRows = summaryRows.filter(r => !r.isAmerican);
        const americaRows = summaryRows.filter(r => r.isAmerican);

        for (const [rows, spreadsheetId] of [[israelRows, ISRAEL_SHEET_ID], [americaRows, AMERICA_SHEET_ID]]) {
            if (rows.length === 0) continue;

            // Clear the tab first (from row 1 onwards) then rewrite
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}?majorDimension=ROWS`,
                { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            // Build values: header + data rows with formula for balance column
            const values = [HEADERS];
            rows.forEach((r, i) => {
                const dataRow = i + 2; // row 2 = first data row (1-indexed, row 1 = header)
                values.push([
                    r.name,
                    r.totalShifts.toFixed(2),
                    r.totalExpenses.toFixed(2),
                    r.totalPaid.toFixed(2),
                    `=B${dataRow}+C${dataRow}-D${dataRow}`,
                    r.confirmed,
                    r.wasPaid,
                ]);
            });

            const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1?valueInputOption=USER_ENTERED`;
            const res = await fetch(updateUrl, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values }),
            });

            if (!res.ok) throw new Error(`Sheets API error: ${await res.text()}`);
        }

        console.log(`✅ Payroll summary synced to sheets`);
        return Response.json({ success: true, rows: summaryRows.length });

    } catch (error) {
        console.error('syncPayrollSummaryToSheet error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});