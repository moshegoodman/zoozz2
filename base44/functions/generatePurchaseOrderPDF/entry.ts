import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sdk = base44.asServiceRole;

        const { order } = await req.json();
        
        // FORCE HEBREW LANGUAGE - ignore any language parameter passed in
        const language = 'Hebrew';

        if (!order) {
            return Response.json({ 
                success: false, 
                error: 'Order data is required' 
            }, { status: 400 });
        }

        console.log('📄 Generating Purchase Order PDF for order:', order.order_number, 'in Hebrew (forced)');

        // Call the canonical HTML generation function
        const htmlResponse = await sdk.functions.invoke('generatePurchaseOrderHTML', {
            order,
            language
        });

        if (!htmlResponse || !htmlResponse.data) {
            console.error('Failed to generate HTML:', htmlResponse);
            return Response.json({
                success: false,
                error: 'Failed to generate Purchase Order HTML'
            }, { status: 500 });
        }

        const htmlContent = htmlResponse.data;

        // Convert HTML to PDF using my_html2pdf
        const pdfResponse = await sdk.functions.invoke('my_html2pdf', {
            htmlContent: htmlContent,
            filename: `PO-${order.order_number}.pdf`
        });

        if (!pdfResponse || !pdfResponse.data) {
            console.error('PDF generation failed:', pdfResponse);
            return Response.json({
                success: false,
                error: 'Failed to convert HTML to PDF',
                htmlContent
            }, { status: 500 });
        }

        const pdfData = pdfResponse.data;

        if (pdfData.success && pdfData.pdfBase64) {
            console.log('✅ Purchase Order PDF generated successfully (Hebrew)');
            return Response.json({
                success: true,
                pdfBase64: pdfData.pdfBase64
            });
        } else {
            console.error('PDF conversion returned unsuccessful:', pdfData);
            return Response.json({
                success: false,
                error: pdfData.error || 'PDF conversion failed',
                htmlContent
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ Error generating Purchase Order PDF:', error);
        return Response.json({ 
            success: false,
            error: 'Failed to generate Purchase Order PDF', 
            details: error.message 
        }, { status: 500 });
    }
});