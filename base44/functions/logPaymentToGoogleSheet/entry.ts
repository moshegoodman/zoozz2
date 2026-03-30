import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ISRAEL_SHEET_ID = '1jKhDfOu60pieSde3wK03rSnYwjJecftLfRkPLSkFDzM';
const AMERICA_SHEET_ID = '1K_CbUcVo2kmtOVP4ghbLkIDarO1kGDe-i3oPdACYSy0';
const TAB = 'payments';
const HEADERS = ['Employee', 'Amount', 'Currency', 'Payment Date', 'Method', 'Notes', 'Confirmed', 'Date Logged'];

async function ensureHeaders(accessToken, spreadsheetId) {
    const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:H1`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await checkRes.json();
    if (!data.values || !data.values[0] || data.values[0].length === 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:H1?valueInputOption=RAW`, {
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
        const paymentId = payload.data?.id || payload.event?.entity_id;

        if (!paymentId) return Response.json({ error: 'No payment id' }, { status: 400 });

        const payment = await base44.asServiceRole.entities.KCSPayment.get(paymentId);
        if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

        // Route to the correct sheet based on currency
        const isUSD = (payment.currency || '').toUpperCase() === 'USD';
        const spreadsheetId = isUSD ? AMERICA_SHEET_ID : ISRAEL_SHEET_ID;
        const curr = isUSD ? '$' : '₪';

        const row = [
            payment.employee_name || '',
            `${curr}${(payment.amount || 0).toFixed(2)}`,
            payment.currency || 'ILS',
            payment.payment_date || '',
            (payment.payment_method || '').replace(/_/g, ' '),
            payment.notes || '',
            payment.is_confirmed ? 'Yes' : 'No',
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

        console.log(`✅ Payment ${paymentId} logged to ${isUSD ? 'America' : 'Israel'} sheet (payments tab)`);
        return Response.json({ success: true });

    } catch (error) {
        console.error('logPaymentToGoogleSheet error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});