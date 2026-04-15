import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggered on order shipped (status = delivery).
 * Generates invoice PDF and stores it in OrderPDF entity.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    const entityId = event?.entity_id;

    // If payload is too large or data is missing, fetch directly from DB
    let order = data;
    if (!order || !order.id) {
      if (!entityId) {
        return Response.json({ error: 'Invalid order data and no entity_id' }, { status: 400 });
      }
      order = await base44.asServiceRole.entities.Order.get(entityId);
      if (!order) {
        return Response.json({ error: 'Order not found' }, { status: 404 });
      }
    }
    console.log(`📋 Generating Invoice for order: ${order.order_number}`);

    // Get vendor data
    const vendor = await base44.asServiceRole.entities.Vendor.get(order.vendor_id);
    if (!vendor) {
      console.warn(`⚠️ Vendor not found: ${order.vendor_id}`);
      return Response.json({ success: false, error: 'Vendor not found' }, { status: 404 });
    }

    // Get household data if exists
    let household = null;
    if (order.household_id) {
      household = await base44.asServiceRole.entities.Household.get(order.household_id);
    }

    // Determine language
    const language = order.order_language || 'Hebrew';
    
    // Call the invoice generation function
    const invoiceResponse = await base44.asServiceRole.functions.invoke('generateInvoicePDF', {
      order,
      vendor,
      household,
      language,
    });

    if (!invoiceResponse.success || !invoiceResponse.pdfBase64) {
      console.error('❌ Invoice generation failed:', invoiceResponse.error);
      return Response.json({ success: false, error: 'Invoice generation failed' }, { status: 500 });
    }

    // Get active season from settings
    const settings = await base44.asServiceRole.entities.AppSettings.list();
    const season = settings?.[0]?.activeSeason || order.household_id?.slice(0, 3) || 'unknown';

    // Store the invoice
    const invoiceRecord = await base44.asServiceRole.entities.OrderPDF.create({
      order_id: order.id,
      pdf_type: 'invoice',
      pdf_base64: invoiceResponse.pdfBase64,
      season,
      language,
      generated_at: new Date().toISOString(),
    });

    console.log(`✅ Invoice stored in database: ${invoiceRecord.id}`);

    // Upload to Google Drive and save the URL back to the order
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
      const invoicesFolderId = Deno.env.get("GOOGLE_DRIVE_INVOICES_FOLDER_ID");

      if (accessToken && invoicesFolderId) {
        // Convert base64 to binary
        const pdfBinary = atob(invoiceResponse.pdfBase64.replace(/\s/g, ''));
        const pdfArray = new Uint8Array(pdfBinary.length);
        for (let i = 0; i < pdfBinary.length; i++) pdfArray[i] = pdfBinary.charCodeAt(i);

        const fileName = `INV_${order.order_number}_${new Date().toISOString().split('T')[0]}.pdf`;

        // Upload to Drive
        const initiateRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fileName, mimeType: 'application/pdf', parents: [invoicesFolderId] })
        });

        if (initiateRes.ok) {
          const uploadUrl = initiateRes.headers.get('Location');
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/pdf' },
            body: pdfArray
          });

          if (uploadRes.ok) {
            const fileData = await uploadRes.json();
            const driveUrl = `https://drive.google.com/file/d/${fileData.id}/view`;
            // Save URL to order
            await base44.asServiceRole.entities.Order.update(order.id, { drive_invoice_url: driveUrl });
            console.log(`✅ Invoice uploaded to Drive: ${driveUrl}`);
          }
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ Drive upload failed (non-fatal):', driveErr.message);
    }

    return Response.json({ success: true, pdf_id: invoiceRecord.id });
  } catch (error) {
    console.error('❌ Error generating and storing invoice:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});