import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Generates a returns invoice PDF, uploads it to Google Drive, and stores the URL
 * on the order in `drive_returns_invoice_url`. Returns the pdfBase64 so the
 * frontend can also download it immediately.
 *
 * Payload: { order } or { event, data } (entity-automation style).
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        let order = body.order || body.data;
        if (!order && body.event?.entity_id) {
            order = await base44.asServiceRole.entities.Order.get(body.event.entity_id);
        }
        if (!order || !order.id) return Response.json({ error: 'Invalid order data' }, { status: 400 });

        const sdk = base44.asServiceRole;
        const vendor = await sdk.entities.Vendor.get(order.vendor_id);
        if (!vendor) return Response.json({ success: false, error: 'Vendor not found' }, { status: 404 });

        const language = body.language || (order.order_language === 'English' ? 'en' : 'he');

        // 1. Generate HTML
        const htmlRes = await sdk.functions.invoke('generateReturnsInvoiceHTML', { order, vendor, language });
        let htmlContent = htmlRes?.data;
        if (typeof htmlContent !== 'string' || !htmlContent.startsWith('<')) {
            return Response.json({ success: false, error: 'Failed to generate returns invoice HTML' }, { status: 500 });
        }

        // 2. Convert to PDF
        const pdfRes = await sdk.functions.invoke('my_html2pdf', {
            htmlContent,
            filename: `Returns-Invoice-${order.order_number}.pdf`,
            options: {
                format: 'A4',
                margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
                printBackground: true
            }
        });
        let pdfData = pdfRes?.data;
        while (typeof pdfData === 'string') { try { pdfData = JSON.parse(pdfData); } catch { break; } }
        const pdfBase64 = (pdfData?.pdfBase64 || pdfData || '').toString().replace(/\s/g, '');
        if (!pdfBase64) return Response.json({ success: false, error: 'PDF generation failed' }, { status: 500 });

        // 3. Upload to Google Drive
        let driveUrl = null;
        try {
            const { accessToken } = await sdk.connectors.getConnection('googledrive');
            const folderId = Deno.env.get('GOOGLE_DRIVE_INVOICES_FOLDER_ID');
            if (accessToken && folderId) {
                const bin = atob(pdfBase64);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);

                const fileName = `RET_${order.order_number}_${new Date().toISOString().split('T')[0]}.pdf`;
                const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: fileName, mimeType: 'application/pdf', parents: [folderId] })
                });
                if (initRes.ok) {
                    const uploadUrl = initRes.headers.get('Location');
                    const upRes = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/pdf' },
                        body: arr
                    });
                    if (upRes.ok) {
                        const fileData = await upRes.json();
                        driveUrl = `https://drive.google.com/file/d/${fileData.id}/view`;
                        await sdk.entities.Order.update(order.id, { drive_returns_invoice_url: driveUrl });
                    }
                }
            }
        } catch (driveErr) {
            console.warn('Drive upload failed (non-fatal):', driveErr.message);
        }

        return Response.json({ success: true, pdfBase64, drive_returns_invoice_url: driveUrl });
    } catch (error) {
        console.error('generateAndStoreReturnsInvoice error:', error.message);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});