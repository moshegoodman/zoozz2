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
            return Response.json({ message: 'Status not relevant for processing', skipped: true });
        }

        // Get access tokens
        const sheetsToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        const driveToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");

        // Generate invoice PDF
        const invoiceResponse = await base44.functions.invoke('generateInvoicePDF', { orderId: data.id });
        
        if (!invoiceResponse.data?.pdf_url) {
            throw new Error('Failed to generate invoice PDF');
        }

        const pdfUrl = invoiceResponse.data.pdf_url;
        
        // Fetch the PDF content
        const pdfResponse = await fetch(pdfUrl);
        const pdfBlob = await pdfResponse.blob();
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();

        // Upload PDF to Google Drive
        const fileName = `Invoice_${data.order_number || data.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        const driveMetadata = {
            name: fileName,
            mimeType: 'application/pdf'
        };

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(driveMetadata)], { type: 'application/json' }));
        formData.append('file', new Blob([pdfArrayBuffer], { type: 'application/pdf' }));

        const driveResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${driveToken}`
            },
            body: formData
        });

        if (!driveResponse.ok) {
            const errorText = await driveResponse.text();
            throw new Error(`Google Drive upload error: ${errorText}`);
        }

        const driveResult = await driveResponse.json();
        console.log('Successfully uploaded invoice to Google Drive:', driveResult.id);

        const SPREADSHEET_ID = Deno.env.get("GOOGLE_SPREADSHEET_ID");
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SPREADSHEET_ID environment variable not set');
        }
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
        
        const sheetsResponse = await fetch(sheetsUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sheetsToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: [rowData]
            })
        });

        if (!sheetsResponse.ok) {
            const errorText = await sheetsResponse.text();
            throw new Error(`Google Sheets API error: ${errorText}`);
        }

        const sheetsResult = await sheetsResponse.json();
        console.log('Successfully added order to Google Sheet:', data.order_number);

        return Response.json({ 
            success: true, 
            message: 'Order processed: PDF uploaded to Drive and data added to Sheet',
            order_number: data.order_number,
            drive_file_id: driveResult.id,
            drive_file_name: fileName,
            sheet_updated_range: sheetsResult.updates?.updatedRange
        });

    } catch (error) {
        console.error('Error updating Google Sheet:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});