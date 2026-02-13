import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { event, data } = await req.json();

        if (!event || !data) {
            return Response.json({ error: 'Missing event or data' }, { status: 400 });
        }

        // Only process if order status changed to shipping-related statuses
        const validStatuses = ['delivered', 'ready_for_shipping', 'delivery'];
        if (!validStatuses.includes(data.status)) {
            return Response.json({ message: 'Status not relevant for processing', skipped: true });
        }

        // Get access tokens
        const sheetsToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        const driveToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");

        // Fetch full order and vendor data for PDF generation
        console.log('Fetching order and vendor data for:', data.id);
        const order = await base44.asServiceRole.entities.Order.get(data.id);
        const vendor = await base44.asServiceRole.entities.Vendor.get(data.vendor_id);
        
        if (!order || !vendor) {
            throw new Error('Failed to fetch order or vendor data');
        }

        // Generate invoice PDF
        console.log('Generating invoice PDF for order:', order.order_number);
        const invoiceResponse = await base44.functions.invoke('generateInvoicePDF', { 
            order: order, 
            vendor: vendor,
            language: order.order_language || 'English'
        });
        console.log('Invoice response:', invoiceResponse);
        
        if (!invoiceResponse.data?.pdfBase64) {
            console.error('Failed to generate invoice PDF. Response:', invoiceResponse);
            throw new Error('Failed to generate invoice PDF');
        }

        // Convert base64 to ArrayBuffer
        const pdfBase64 = invoiceResponse.data.pdfBase64;
        const pdfBinary = atob(pdfBase64);
        const pdfArrayBuffer = new Uint8Array(pdfBinary.length);
        for (let i = 0; i < pdfBinary.length; i++) {
            pdfArrayBuffer[i] = pdfBinary.charCodeAt(i);
        }
        console.log('PDF converted to ArrayBuffer, size:', pdfArrayBuffer.length);

        // Upload PDF to Google Drive using resumable upload (works better with large files and drive.file scope)
        const fileName = `Invoice_${data.order_number || data.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        const metadata = {
            name: fileName,
            mimeType: 'application/pdf'
        };

        // Step 1: Initiate resumable upload session
        const initiateResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${driveToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!initiateResponse.ok) {
            const errorText = await initiateResponse.text();
            console.error('Failed to initiate Drive upload:', errorText);
            throw new Error(`Google Drive initiation error (${initiateResponse.status}): ${errorText}`);
        }

        const uploadUrl = initiateResponse.headers.get('Location');
        console.log('Got upload URL:', uploadUrl);

        // Step 2: Upload the actual file content
        const driveResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/pdf'
            },
            body: pdfArrayBuffer
        });

        if (!driveResponse.ok) {
            const errorText = await driveResponse.text();
            console.error('Google Drive upload failed:', errorText);
            console.error('Drive response status:', driveResponse.status);
            throw new Error(`Google Drive upload error (${driveResponse.status}): ${errorText}`);
        }

        const driveResult = await driveResponse.json();
        console.log('Successfully uploaded invoice to Google Drive:', driveResult.id);
        console.log('Drive file details:', driveResult);

        const SPREADSHEET_ID = Deno.env.get("GOOGLE_SPREADSHEET_ID");
        if (!SPREADSHEET_ID) {
            console.log('GOOGLE_SPREADSHEET_ID not set, skipping sheets update');
            return Response.json({ 
                success: true, 
                message: 'PDF uploaded to Drive (Sheets update skipped - no spreadsheet ID configured)',
                order_number: data.order_number,
                drive_file_id: driveResult.id,
                drive_file_name: fileName
            });
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