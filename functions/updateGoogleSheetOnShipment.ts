import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { event, data } = await req.json();

        if (!event || !data) {
            return Response.json({ error: 'Missing event or data' }, { status: 400 });
        }

        // Only process if order status changed to 'delivered' or 'ready_for_shipping'
        if (data.status !== 'delivered' && data.status !== 'ready_for_shipping') {
            return Response.json({ message: 'Status not relevant for sheet update', skipped: true });
        }

        // Get Google Sheets access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");

        // TODO: Replace with your actual Spreadsheet ID
        const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
        const SHEET_NAME = 'Orders'; // The sheet tab name

        // Prepare row data
        const rowData = [
            data.order_number || '',
            data.household_name || data.user_email || '',
            data.total_amount || 0,
            data.delivery_price || 0,
            data.order_currency || 'ILS',
            data.status || '',
            new Date().toISOString(),
            data.household_code || '',
            data.vendor_id || ''
        ];

        // Append to Google Sheet
        const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=RAW`;
        
        const response = await fetch(sheetsUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: [rowData]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Sheets API error: ${errorText}`);
        }

        const result = await response.json();
        console.log('Successfully added order to Google Sheet:', data.order_number);

        return Response.json({ 
            success: true, 
            message: 'Order added to Google Sheet',
            order_number: data.order_number,
            updatedRange: result.updates?.updatedRange
        });

    } catch (error) {
        console.error('Error updating Google Sheet:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});