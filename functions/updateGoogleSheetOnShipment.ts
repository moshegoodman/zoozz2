import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    let event, data;
    
    try {
        const payload = await req.json();
        event = payload.event;
        data = payload.data;
        
        console.log('🚀 Automation triggered:', {
            event_type: event?.type,
            entity_id: event?.entity_id,
            order_number: data?.order_number,
            status: data?.status
        });

        if (!event || !data) {
            console.error('Missing event or data in payload');
            return Response.json({ error: 'Missing event or data' }, { status: 400 });
        }

        // Only process if order status changed to shipping-related statuses
        const validStatuses = ['delivered', 'ready_for_shipping', 'delivery'];
        if (!validStatuses.includes(data.status)) {
            console.log('Status not relevant, skipping:', data.status);
            return Response.json({ message: 'Status not relevant for processing', skipped: true });
        }
        
        console.log('✅ Valid status detected, proceeding with processing');

        // Get access tokens
        console.log('🔑 Getting access tokens...');
        const sheetsToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        const driveToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        console.log('✅ Tokens obtained');

        // Fetch full order and vendor data for PDF generation
        console.log('📦 Fetching order and vendor data for:', event.entity_id);
        const order = await base44.asServiceRole.entities.Order.get(event.entity_id);
        const vendor = await base44.asServiceRole.entities.Vendor.get(order.vendor_id);
        
        if (!order || !vendor) {
            throw new Error('Failed to fetch order or vendor data');
        }
        console.log('✅ Order and vendor data fetched');

        // Generate invoice PDF
        console.log('📄 Generating invoice PDF for order:', order.order_number);
        const invoiceResponse = await base44.asServiceRole.functions.invoke('generateInvoicePDF', { 
            order: order, 
            vendor: vendor,
            language: order.order_language || 'English'
        });
        
        if (!invoiceResponse.data?.pdfBase64) {
            console.error('Failed to generate invoice PDF. Response:', invoiceResponse);
            throw new Error('Failed to generate invoice PDF');
        }
        console.log('✅ PDF generated successfully');

        // Convert base64 to binary for upload
        const pdfBase64 = invoiceResponse.data.pdfBase64.replace(/\s/g, '');
        const pdfBinary = atob(pdfBase64);
        const pdfArrayBuffer = new Uint8Array(pdfBinary.length);
        for (let i = 0; i < pdfBinary.length; i++) {
            pdfArrayBuffer[i] = pdfBinary.charCodeAt(i);
        }
        console.log('✅ PDF converted to ArrayBuffer, size:', pdfArrayBuffer.length);

        // Upload PDF to Google Drive using simple multipart upload
        const fileName = `Invoice_${data.order_number || data.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        console.log('☁️ Uploading to Google Drive:', fileName);
        
        // Create multipart body
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const metadata = {
            name: fileName,
            mimeType: 'application/pdf',
            parents: [Deno.env.get("GOOGLE_DRIVE_INVOICES_FOLDER_ID")]
        };

        const multipartBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/pdf\r\n\r\n';

        // Combine metadata and PDF binary
        const metadataBytes = new TextEncoder().encode(multipartBody);
        const closeBytes = new TextEncoder().encode(closeDelim);
        const fullBody = new Uint8Array(metadataBytes.length + pdfArrayBuffer.length + closeBytes.length);
        fullBody.set(metadataBytes, 0);
        fullBody.set(pdfArrayBuffer, metadataBytes.length);
        fullBody.set(closeBytes, metadataBytes.length + pdfArrayBuffer.length);

        const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${driveToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: fullBody
            }
        );

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('❌ Google Drive upload failed:', {
                status: uploadResponse.status,
                errorText: errorText
            });
            throw new Error(`Drive upload failed (${uploadResponse.status}): ${errorText}`);
        }

        const driveResult = await uploadResponse.json();
        console.log('✅ Successfully uploaded invoice to Google Drive:', driveResult.id);

        const SPREADSHEET_ID = Deno.env.get("GOOGLE_SPREADSHEET_ID");
        if (!SPREADSHEET_ID) {
            console.log('⚠️ GOOGLE_SPREADSHEET_ID not set, skipping sheets update');
            
            // Create success notification (Drive only)
            await base44.asServiceRole.entities.Notification.create({
                user_email: data.user_email,
                title: `Invoice Uploaded - ${data.order_number}`,
                message: `Invoice uploaded to Google Drive: ${fileName}`,
                type: 'order_update',
                order_id: event.entity_id,
                vendor_id: data.vendor_id,
                is_read: false
            });
            
            return Response.json({ 
                success: true, 
                message: 'PDF uploaded to Drive (Sheets update skipped - no spreadsheet ID)',
                order_number: data.order_number,
                drive_file_id: driveResult.id,
                drive_file_name: fileName
            });
        }
        
        const SHEET_NAME = 'Orders';

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
        console.log('📊 Updating Google Sheet...');
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
        console.log('✅ Successfully added order to Google Sheet');

        // Create success notification
        console.log('📧 Creating success notification for:', data.user_email);
        await base44.asServiceRole.entities.Notification.create({
            user_email: data.user_email,
            title: `Invoice Uploaded - ${data.order_number}`,
            message: `Invoice uploaded to Google Drive: ${fileName}. Order data added to tracking sheet.`,
            type: 'order_update',
            order_id: event.entity_id,
            vendor_id: data.vendor_id,
            is_read: false
        });
        console.log('✅ Success notification created');

        return Response.json({ 
            success: true, 
            message: 'Order processed: PDF uploaded to Drive and data added to Sheet',
            order_number: data.order_number,
            drive_file_id: driveResult.id,
            drive_file_name: fileName,
            sheet_updated_range: sheetsResult.updates?.updatedRange
        });

    } catch (error) {
        console.error('💥 Error in automation:', error.message);
        console.error('Error details:', error);

        // Create error notification
        if (data?.user_email) {
            try {
                console.log('📧 Creating error notification for:', data.user_email);
                await base44.asServiceRole.entities.Notification.create({
                    user_email: data.user_email,
                    title: `Invoice Upload Failed - ${data.order_number || 'Unknown'}`,
                    message: `Failed to upload invoice: ${error.message}`,
                    type: 'system_alert',
                    order_id: event?.entity_id,
                    vendor_id: data?.vendor_id,
                    is_read: false
                });
                console.log('✅ Error notification created');
            } catch (notifError) {
                console.error('❌ Failed to create error notification:', notifError);
            }
        }

        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});