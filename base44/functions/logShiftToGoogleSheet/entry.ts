import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ISRAEL_SHEET_ID = '1jKhDfOu60pieSde3wK03rSnYwjJecftLfRkPLSkFDzM';
const AMERICA_SHEET_ID = '1K_CbUcVo2kmtOVP4ghbLkIDarO1kGDe-i3oPdACYSy0';
const USA_VALS = ['america', 'usa'];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        // Support both direct call (shift object) and entity automation payload
        const shift = payload.shift || payload.data || payload;
        const shiftId = shift?.id || payload?.event?.entity_id;

        if (!shiftId) {
            return Response.json({ error: 'No shift id provided' }, { status: 400 });
        }

        // Fetch fresh shift data
        const freshShift = await base44.asServiceRole.entities.Shift.get(shiftId);
        if (!freshShift) {
            return Response.json({ error: 'Shift not found' }, { status: 404 });
        }

        // Fetch related household and user
        const [household, user] = await Promise.all([
            freshShift.household_id
                ? base44.asServiceRole.entities.Household.get(freshShift.household_id).catch(() => null)
                : Promise.resolve(null),
            base44.asServiceRole.entities.User.filter({ id: freshShift.user_id }).then(r => r?.[0] || null).catch(() => null),
        ]);

        // Determine which sheet to write to
        const country = (household?.country || '').toLowerCase().trim();
        const isAmerican = USA_VALS.includes(country);
        const spreadsheetId = isAmerican ? AMERICA_SHEET_ID : ISRAEL_SHEET_ID;
        const curr = isAmerican ? '$' : '₪';

        // Calculate hours
        const calcHours = (start, end) => {
            if (!start || !end) return 0;
            return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
        };

        const isDaily = freshShift.payment_type === 'daily';
        const hours = isDaily ? null : calcHours(freshShift.start_date_time, freshShift.done_date_time);
        const pay = isDaily
            ? (freshShift.price_per_day || 0)
            : (hours || 0) * (freshShift.price_per_hour || 0);

        const formatDT = (dt) => dt ? new Date(dt).toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem' }) : '';

        const row = [
            user?.full_name || freshShift.user_id || '',
            household?.name || freshShift.household_id || '',
            freshShift.job || '',
            isDaily ? 'Daily' : 'Hourly',
            formatDT(freshShift.start_date_time),
            freshShift.done_date_time ? formatDT(freshShift.done_date_time) : (isDaily ? '—' : ''),
            isDaily ? '—' : (hours != null ? hours.toFixed(2) : ''),
            isDaily ? `${curr}${freshShift.price_per_day || 0}/day` : `${curr}${freshShift.price_per_hour || 0}/hr`,
            `${curr}${pay.toFixed(2)}`,
            freshShift.is_approved ? 'Yes' : 'No',
            freshShift.comment || '',
            new Date().toISOString().split('T')[0], // logged date
        ];

        // Get sheets access token
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

        const headers = ['Employee', 'Household', 'Job', 'Pay Type', 'Shift Start', 'Shift End', 'Hours', 'Rate', 'Pay', 'Approved', 'Comment', 'Date Logged'];

        // Check if row 1 already has headers
        const TAB = 'time log';
        const checkRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:L1`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const checkData = await checkRes.json();
        const hasHeaders = checkData.values && checkData.values[0] && checkData.values[0].length > 0;

        if (!hasHeaders) {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:L1?valueInputOption=RAW`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [headers] }),
            });
        }

        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const res = await fetch(appendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: [row] }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Sheets API error: ${errText}`);
        }

        console.log(`✅ Shift ${shiftId} logged to ${isAmerican ? 'America' : 'Israel'} sheet`);
        return Response.json({ success: true, sheet: isAmerican ? 'america' : 'israel' });

    } catch (error) {
        console.error('logShiftToGoogleSheet error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});