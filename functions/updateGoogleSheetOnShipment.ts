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

        if (!event || !event.entity_id) {
            console.error('Missing event or entity_id in payload');
            return Response.json({ error: 'Missing event or entity_id' }, { status: 400 });
        }

        // Always fetch fresh order from DB using entity_id (handles payload_too_large case)
        console.log('📦 Fetching fresh order data for:', event.entity_id);
        const order = await base44.asServiceRole.entities.Order.get(event.entity_id);
        
        if (!order) {
            throw new Error(`Order not found for id: ${event.entity_id}`);
        }
        console.log('✅ Order fetched, status:', order.status);

        // Only process if order status is delivery-related
        const validStatuses = ['delivered', 'ready_for_shipping', 'delivery'];
        if (!validStatuses.includes(order.status)) {
            console.log('Status not relevant, skipping:', order.status);
            return Response.json({ message: 'Status not relevant for processing', skipped: true });
        }
        
        console.log('✅ Valid status detected, proceeding with processing');

        // Get access tokens
        console.log('🔑 Getting access tokens...');
        const sheetsToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
        const driveToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
        console.log('✅ Tokens obtained');

        // Fetch vendor data
        const vendor = await base44.asServiceRole.entities.Vendor.get(order.vendor_id);
        
        if (!vendor) {
            throw new Error('Failed to fetch vendor data');
        }
        console.log('✅ Vendor data fetched');

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

        // Upload PDF to Google Drive using resumable upload (works with drive.file scope)
        const fileName = `Invoice_${order.order_number || order.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        console.log('☁️ Starting Google Drive upload process');
        console.log('📋 Upload details:', {
            fileName: fileName,
            pdfSize: pdfArrayBuffer.length,
            orderNumber: order.order_number,
            orderId: order.id
        });
        
        const invoicesFolderId = Deno.env.get("GOOGLE_DRIVE_INVOICES_FOLDER_ID");
        console.log('📁 Target folder ID:', invoicesFolderId);
        
        if (!invoicesFolderId) {
            throw new Error('GOOGLE_DRIVE_INVOICES_FOLDER_ID not set in secrets');
        }
        
        const metadata = {
            name: fileName,
            mimeType: 'application/pdf',
            parents: [invoicesFolderId]
        };
        console.log('📝 Upload metadata:', JSON.stringify(metadata));

        // Step 1: Initiate resumable upload
        console.log('🔄 Step 1: Initiating resumable upload...');
        const initiateResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${driveToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            }
        );

        console.log('📡 Initiate response status:', initiateResponse.status);
        
        if (!initiateResponse.ok) {
            const errorText = await initiateResponse.text();
            console.error('❌ Upload initiation failed:', {
                status: initiateResponse.status,
                statusText: initiateResponse.statusText,
                errorText: errorText,
                headers: Object.fromEntries(initiateResponse.headers.entries())
            });
            throw new Error(`Upload initiation failed (${initiateResponse.status}): ${errorText}`);
        }

        const uploadUrl = initiateResponse.headers.get('Location');
        console.log('🔗 Upload URL received:', uploadUrl ? 'YES' : 'NO');
        
        if (!uploadUrl) {
            console.error('❌ No Location header in response');
            console.error('Response headers:', Object.fromEntries(initiateResponse.headers.entries()));
            throw new Error('No upload URL received from Google Drive');
        }
        
        console.log('✅ Upload initiated successfully');
        console.log('🔄 Step 2: Uploading PDF content (' + pdfArrayBuffer.length + ' bytes)...');

        // Step 2: Upload PDF content
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/pdf'
            },
            body: pdfArrayBuffer
        });

        console.log('📡 Upload response status:', uploadResponse.status);
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('❌ Content upload failed:', {
                status: uploadResponse.status,
                statusText: uploadResponse.statusText,
                errorText: errorText,
                headers: Object.fromEntries(uploadResponse.headers.entries())
            });
            throw new Error(`Content upload failed (${uploadResponse.status}): ${errorText}`);
        }

        const driveResult = await uploadResponse.json();
        console.log('✅ Successfully uploaded invoice to Google Drive!');
        console.log('📄 Drive file details:', {
            id: driveResult.id,
            name: driveResult.name,
            mimeType: driveResult.mimeType,
            webViewLink: driveResult.webViewLink
        });

        const SPREADSHEET_ID = Deno.env.get("GOOGLE_SPREADSHEET_ID");
        if (!SPREADSHEET_ID) {
            console.log('⚠️ GOOGLE_SPREADSHEET_ID not set, skipping sheets update');
            
            // Create success notification (Drive only)
            await base44.asServiceRole.entities.Notification.create({
                user_email: order.user_email,
                title: `Invoice Uploaded - ${order.order_number}`,
                message: `Invoice uploaded to Google Drive: ${fileName}`,
                type: 'order_update',
                order_id: order.id,
                vendor_id: order.vendor_id,
                is_read: false
            });
            
            return Response.json({ 
                success: true, 
                message: 'PDF uploaded to Drive (Sheets update skipped - no spreadsheet ID)',
                order_number: order.order_number,
                drive_file_id: driveResult.id,
                drive_file_name: fileName
            });
        }
        
        const SHEET_NAME = 'Orders';

        // Prepare row data (use freshly fetched order, not payload data)
        const rowData = [
            order.order_number || '',
            order.household_name || order.user_email || '',
            order.total_amount || 0,
            order.delivery_price || 0,
            order.order_currency || 'ILS',
            order.status || '',
            new Date().toISOString(),
            order.household_code || '',
            order.vendor_id || ''
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