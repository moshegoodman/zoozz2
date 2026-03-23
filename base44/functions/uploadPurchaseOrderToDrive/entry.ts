import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getOrCreateFolder(driveToken, parentFolderId, folderName) {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`
    )}&fields=files(id,name)`;
    
    const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${driveToken}` }
    });
    if (!searchRes.ok) throw new Error(`Folder search failed: ${await searchRes.text()}`);
    
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }
    
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${driveToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        })
    });
    if (!createRes.ok) throw new Error(`Folder creation failed: ${await createRes.text()}`);
    
    const newFolder = await createRes.json();
    return newFolder.id;
}

async function uploadPdfToFolder(driveToken, folderId, fileName, pdfArrayBuffer) {
    const initiateRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${driveToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: fileName, mimeType: 'application/pdf', parents: [folderId] })
        }
    );
    if (!initiateRes.ok) throw new Error(`Upload initiation failed: ${await initiateRes.text()}`);
    
    const uploadUrl = initiateRes.headers.get('Location');
    if (!uploadUrl) throw new Error('No upload URL received from Google Drive');
    
    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfArrayBuffer
    });
    if (!uploadRes.ok) throw new Error(`Content upload failed: ${await uploadRes.text()}`);
    
    return await uploadRes.json();
}

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    let event, data;

    try {
        const payload = await req.json();
        event = payload.event;
        data = payload.data;

        if (!event || !event.entity_id) {
            return Response.json({ error: 'Missing event or entity_id' }, { status: 400 });
        }

        // Fetch fresh order
        const order = await base44.asServiceRole.entities.Order.get(event.entity_id);
        if (!order) throw new Error(`Order not found: ${event.entity_id}`);

        // Only process 'pending' orders (newly placed orders)
        if (order.status !== 'pending') {
            console.log('Skipping - order status is not pending:', order.status);
            return Response.json({ message: 'Skipped - not a new pending order', skipped: true });
        }

        // Only process orders placed by KCS staff (they have household_id set)
        if (!order.household_id) {
            console.log('Skipping - no household_id, not a KCS staff order');
            return Response.json({ message: 'Skipped - not a KCS staff order', skipped: true });
        }

        console.log('📄 Processing purchase order upload for:', order.order_number);

        const driveToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");

        // Fetch vendor
        const vendor = await base44.asServiceRole.entities.Vendor.get(order.vendor_id);
        if (!vendor) throw new Error('Vendor not found');

        // Generate Purchase Order PDF
        const pdfResponse = await base44.asServiceRole.functions.invoke('generatePurchaseOrderPDF', { order });

        if (!pdfResponse?.data?.pdfBase64) {
            throw new Error('Failed to generate Purchase Order PDF');
        }

        // Convert base64 to ArrayBuffer
        const pdfBase64 = pdfResponse.data.pdfBase64.replace(/\s/g, '');
        const pdfBinary = atob(pdfBase64);
        const pdfArrayBuffer = new Uint8Array(pdfBinary.length);
        for (let i = 0; i < pdfBinary.length; i++) {
            pdfArrayBuffer[i] = pdfBinary.charCodeAt(i);
        }

        const fileName = `PO_${order.order_number}_${new Date().toISOString().split('T')[0]}.pdf`;

        const purchaseOrderFolderId = Deno.env.get("GOOGLE_DRIVE_PURCHASE_ORDER_FOLDER_ID");
        if (!purchaseOrderFolderId) throw new Error('GOOGLE_DRIVE_PURCHASE_ORDER_FOLDER_ID not set');

        // Get or create vendors and households top-level folders
        const [vendorsFolderId, householdsFolderId] = await Promise.all([
            getOrCreateFolder(driveToken, purchaseOrderFolderId, 'vendors'),
            getOrCreateFolder(driveToken, purchaseOrderFolderId, 'households')
        ]);

        // Get or create specific vendor and household subfolders
        const vendorFolderName = vendor.name || order.vendor_id;
        const householdFolderName = order.household_code || order.household_id;

        const [specificVendorFolderId, specificHouseholdFolderId] = await Promise.all([
            getOrCreateFolder(driveToken, vendorsFolderId, vendorFolderName),
            getOrCreateFolder(driveToken, householdsFolderId, householdFolderName)
        ]);

        // Upload to both folders simultaneously
        await Promise.all([
            uploadPdfToFolder(driveToken, specificVendorFolderId, fileName, pdfArrayBuffer),
            uploadPdfToFolder(driveToken, specificHouseholdFolderId, fileName, pdfArrayBuffer)
        ]);

        console.log('✅ Purchase Order uploaded to both vendor and household folders:', fileName);

        return Response.json({
            success: true,
            message: 'Purchase Order uploaded to Google Drive',
            order_number: order.order_number,
            file_name: fileName
        });

    } catch (error) {
        console.error('💥 Error uploading purchase order:', error.message);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});