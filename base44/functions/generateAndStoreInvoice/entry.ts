import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Triggered on order shipped (status = delivery).
 * Generates invoice PDF and stores it in OrderPDF entity.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || !data.id) {
      return Response.json({ error: 'Invalid order data' }, { status: 400 });
    }

    const order = data;
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
    return Response.json({ success: true, pdf_id: invoiceRecord.id });
  } catch (error) {
    console.error('❌ Error generating and storing invoice:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});