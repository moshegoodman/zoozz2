import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ISRAEL_SHEET_ID = '1jKhDfOu60pieSde3wK03rSnYwjJecftLfRkPLSkFDzM';
const AMERICA_SHEET_ID = '1K_CbUcVo2kmtOVP4ghbLkIDarO1kGDe-i3oPdACYSy0';
const USA_VALS = ['america', 'usa'];
const TAB = 'ap';
const HEADERS = ['Employee', 'Household', 'Description', 'Amount', 'Date', 'Paid By', 'Reimbursable', 'Approved', 'Date Logged'];

async function ensureHeaders(accessToken, spreadsheetId) {
    const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:I1`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await checkRes.json();
    if (!data.values || !data.values[0] || data.values[0].length === 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:I1?valueInputOption=RAW`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [HEADERS] }),
        });
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const expenseId = payload.data?.id || payload.event?.entity_id;

        if (!expenseId) return Response.json({ error: 'No expense id' }, { status: 400 });

        const expense = await base44.asServiceRole.entities.Expense.get(expenseId);
        if (!expense) return Response.json({ error: 'Expense not found' }, { status: 404 });

        const [household, user] = await Promise.all([
            expense.household_id
                ? base44.asServiceRole.entities.Household.get(expense.household_id).catch(() => null)
                : Promise.resolve(null),
            base44.asServiceRole.entities.User.filter({ id: expense.user_id }).then(r => r?.[0] || null).catch(() => null),
        ]);

        const country = (household?.country || '').toLowerCase().trim();
        const isAmerican = USA_VALS.includes(country);
        const spreadsheetId = isAmerican ? AMERICA_SHEET_ID : ISRAEL_SHEET_ID;
        const curr = isAmerican ? '$' : '₪';

        const STAFF_PAID = ['Staff member CC', 'Staff member Cash'];
        const isReimbursable = STAFF_PAID.includes(expense.paid_by);

        const row = [
            user?.full_name || expense.user_id || '',
            household?.name || expense.household_id || '',
            expense.description || '',
            `${curr}${(expense.amount || 0).toFixed(2)}`,
            expense.date || '',
            expense.paid_by || '',
            isReimbursable ? 'Yes' : 'No',
            expense.is_approved ? 'Yes' : 'No',
            new Date().toISOString().split('T')[0],
        ];

        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
        await ensureHeaders(accessToken, spreadsheetId);

        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const res = await fetch(appendUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [row] }),
        });

        if (!res.ok) throw new Error(`Sheets API error: ${await res.text()}`);

        console.log(`✅ Expense ${expenseId} logged to ${isAmerican ? 'America' : 'Israel'} sheet (ap tab)`);
        return Response.json({ success: true });

    } catch (error) {
        console.error('logExpenseToGoogleSheet error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});