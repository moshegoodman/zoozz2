import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ISRAEL_SHEET_ID = '1jKhDfOu60pieSde3wK03rSnYwjJecftLfRkPLSkFDzM';
const AMERICA_SHEET_ID = '1K_CbUcVo2kmtOVP4ghbLkIDarO1kGDe-i3oPdACYSy0';
const RECEIPTS_FOLDER_ID = '1CDfZQRpEEbIlra7ZF5p9pa-7sk2o4WL6';
const USA_VALS = ['america', 'usa'];
const TAB = 'ap';
const HEADERS = ['Employee', 'Household', 'Description', 'Amount', 'Date', 'Paid By', 'Reimbursable', 'Approved', 'Receipt', 'Date Logged'];

async function ensureHeaders(accessToken, spreadsheetId) {
    const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:J1`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const data = await checkRes.json();
    if (!data.values || !data.values[0] || data.values[0].length === 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}!A1:J1?valueInputOption=RAW`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [HEADERS] }),
        });
    }
}

async function uploadReceiptToDrive(driveAccessToken, receiptUrl, fileName) {
    try {
        // Fetch the receipt file from its URL
        const fileRes = await fetch(receiptUrl);
        if (!fileRes.ok) return null;

        const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
        const fileBytes = await fileRes.arrayBuffer();

        // Upload to Google Drive using multipart upload
        const boundary = 'receipt_boundary_' + Date.now();
        const metadata = JSON.stringify({ name: fileName, parents: [RECEIPTS_FOLDER_ID] });

        const bodyParts = [
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
            `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
        ];

        const encoder = new TextEncoder();
        const part1 = encoder.encode(bodyParts[0]);
        const part2 = encoder.encode(bodyParts[1]);
        const part3 = new Uint8Array(fileBytes);
        const closing = encoder.encode(`\r\n--${boundary}--`);

        const combined = new Uint8Array(part1.length + part2.length + part3.length + closing.length);
        combined.set(part1, 0);
        combined.set(part2, part1.length);
        combined.set(part3, part1.length + part2.length);
        combined.set(closing, part1.length + part2.length + part3.length);

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${driveAccessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: combined,
        });

        if (!uploadRes.ok) {
            console.error('Drive upload error:', await uploadRes.text());
            return null;
        }

        const uploadData = await uploadRes.json();
        return uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`;
    } catch (err) {
        console.error('Receipt upload failed:', err.message);
        return null;
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

        // Get connections for both sheets and drive
        const [sheetsConn, driveConn] = await Promise.all([
            base44.asServiceRole.connectors.getConnection('googlesheets'),
            base44.asServiceRole.connectors.getConnection('googledrive'),
        ]);

        // Upload receipt to Drive if present
        let receiptDriveLink = '';
        if (expense.receipt_url) {
            const employeeName = (user?.full_name || 'unknown').replace(/\s+/g, '_');
            const fileName = `receipt_${employeeName}_${expense.date || 'nodate'}_${expenseId.slice(-6)}`;
            receiptDriveLink = await uploadReceiptToDrive(driveConn.accessToken, expense.receipt_url, fileName) || expense.receipt_url;
        }

        const row = [
            user?.full_name || expense.user_id || '',
            household?.name || expense.household_id || '',
            expense.description || '',
            `${curr}${(expense.amount || 0).toFixed(2)}`,
            expense.date || '',
            expense.paid_by || '',
            isReimbursable ? 'Yes' : 'No',
            expense.is_approved ? 'Yes' : 'No',
            receiptDriveLink,
            new Date().toISOString().split('T')[0],
        ];

        await ensureHeaders(sheetsConn.accessToken, spreadsheetId);

        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TAB)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const res = await fetch(appendUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sheetsConn.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [row] }),
        });

        if (!res.ok) throw new Error(`Sheets API error: ${await res.text()}`);

        console.log(`✅ Expense ${expenseId} logged to ${isAmerican ? 'America' : 'Israel'} sheet (ap tab)${receiptDriveLink ? ' with receipt' : ''}`);
        return Response.json({ success: true });

    } catch (error) {
        console.error('logExpenseToGoogleSheet error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});