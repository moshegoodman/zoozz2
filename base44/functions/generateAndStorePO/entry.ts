import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Triggered on order creation.
 * Generates purchase order PDF and stores it in OrderPDF entity.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || !data.id) {
      return Response.json({ error: 'Invalid order data' }, { status: 400 });
    }

    const order = data;
    console.log(`📄 Generating PO for order: ${order.order_number}`);

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
    
    // Call the PDF generation function
    const generatePOResponse = await base44.asServiceRole.functions.invoke('generatePurchaseOrderPDF', {
      order,
      vendor,
      household,
      language,
    });

    if (!generatePOResponse.success || !generatePOResponse.pdfBase64) {
      console.error('❌ PDF generation failed:', generatePOResponse.error);
      return Response.json({ success: false, error: 'PDF generation failed' }, { status: 500 });
    }

    // Get active season from settings
    const settings = await base44.asServiceRole.entities.AppSettings.list();
    const season = settings?.[0]?.activeSeason || order.household_id?.slice(0, 3) || 'unknown';

    // Store the PDF
    const pdfRecord = await base44.asServiceRole.entities.OrderPDF.create({
      order_id: order.id,
      pdf_type: 'purchase_order',
      pdf_base64: generatePOResponse.pdfBase64,
      season,
      language,
      generated_at: new Date().toISOString(),
    });

    console.log(`✅ PO stored in database: ${pdfRecord.id}`);
    return Response.json({ success: true, pdf_id: pdfRecord.id });
  } catch (error) {
    console.error('❌ Error generating and storing PO:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});