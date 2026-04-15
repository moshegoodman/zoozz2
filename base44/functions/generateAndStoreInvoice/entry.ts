import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Generates invoice PDF, uploads to Google Drive, stores URL on the order.
 * Called by:
 * 1. Automation: when order status changes to "delivery" (payload: { event, data, old_data })
 * 2. Frontend: manually via base44.functions.invoke (payload: { event, data })
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both automation payload { event, data } and direct call { data }
    let order = body.data;

    // If payload_too_large or data missing, fetch by entity_id from event
    if (!order && body.event?.entity_id) {
      order = await base44.asServiceRole.entities.Order.get(body.event.entity_id);
    }

    if (!order || !order.id) {
      return Response.json({ error: 'Invalid order data' }, { status: 400 });
    }

    console.log(`📋 Generating Invoice for order: ${order.order_number}`);

    // Get vendor data
    const vendor = await base44.asServiceRole.entities.Vendor.get(order.vendor_id);
    if (!vendor) {
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
    const season = settings?.[0]?.activeSeason || 'unknown';

    // Store the invoice in DB
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
    let driveUrl = null;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
      const invoicesFolderId = Deno.env.get("GOOGLE_DRIVE_INVOICES_FOLDER_ID");

      if (accessToken && invoicesFolderId) {
        const pdfBinary = atob(invoiceResponse.pdfBase64.replace(/\s/g, ''));
        const pdfArray = new Uint8Array(pdfBinary.length);
        for (let i = 0; i < pdfBinary.length; i++) pdfArray[i] = pdfBinary.charCodeAt(i);

        const fileName = `INV_${order.order_number}_${new Date().toISOString().split('T')[0]}.pdf`;

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
            driveUrl = `https://drive.google.com/file/d/${fileData.id}/view`;
            await base44.asServiceRole.entities.Order.update(order.id, { drive_invoice_url: driveUrl });
            console.log(`✅ Invoice uploaded to Drive: ${driveUrl}`);
          }
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ Drive upload failed (non-fatal):', driveErr.message);
    }

    return Response.json({ success: true, pdf_id: invoiceRecord.id, drive_invoice_url: driveUrl });
  } catch (error) {
    console.error('❌ Error generating and storing invoice:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});