import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Manages PDF storage and retrieval for orders.
 * Can store, retrieve, or delete PDFs with seasonal cleanup.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, order_id, pdf_type, pdf_base64, season, language } = await req.json();

    if (action === 'store') {
      // Store a new PDF
      if (!order_id || !pdf_type || !pdf_base64 || !season) {
        return Response.json({ error: 'Missing required fields for store action' }, { status: 400 });
      }

      // Delete existing PDF of same type for this order
      const existing = await base44.asServiceRole.entities.OrderPDF.filter({
        order_id,
        pdf_type,
      });
      if (existing.length > 0) {
        for (const pdf of existing) {
          await base44.asServiceRole.entities.OrderPDF.delete(pdf.id);
        }
      }

      // Store new PDF
      const newPDF = await base44.asServiceRole.entities.OrderPDF.create({
        order_id,
        pdf_type,
        pdf_base64,
        season,
        language: language || 'English',
        generated_at: new Date().toISOString(),
      });

      return Response.json({ success: true, pdf_id: newPDF.id });
    }

    if (action === 'retrieve') {
      // Retrieve stored PDF
      if (!order_id || !pdf_type) {
        return Response.json({ error: 'Missing order_id or pdf_type' }, { status: 400 });
      }

      const pdfs = await base44.asServiceRole.entities.OrderPDF.filter({
        order_id,
        pdf_type,
      });

      if (pdfs.length === 0) {
        return Response.json({ success: false, pdf_base64: null });
      }

      // Return most recent PDF (should only be one, but just in case)
      const pdf = pdfs.sort((a, b) => 
        new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
      )[0];

      return Response.json({ success: true, pdf_base64: pdf.pdf_base64 });
    }

    if (action === 'cleanup_old_seasons') {
      // Delete all PDFs from seasons other than the active season
      if (!season) {
        return Response.json({ error: 'Missing season parameter' }, { status: 400 });
      }

      const allPDFs = await base44.asServiceRole.entities.OrderPDF.list();
      const toDelete = allPDFs.filter(pdf => pdf.season !== season);

      for (const pdf of toDelete) {
        await base44.asServiceRole.entities.OrderPDF.delete(pdf.id);
      }

      return Response.json({ success: true, deleted_count: toDelete.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});