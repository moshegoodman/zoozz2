import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sdk = base44.asServiceRole;

        const { order, vendor, language } = await req.json();

        if (!order) {
            return Response.json({ error: 'Order data is required' }, { status: 400 });
        }
        if (!vendor) {
            return Response.json({ error: 'Vendor data is required' }, { status: 400 });
        }

        console.log('🔧 PDF DEBUGGING: Starting invoice PDF generation for order:', order.order_number);

        // Generate HTML content using generateInvoiceHTML function
        console.log('🔧 PDF DEBUGGING: Generating HTML content...');
        const htmlResponse = await sdk.functions.invoke('generateInvoiceHTML', {
            order: order,
            vendor: vendor,
            language: language
        });

        if (!htmlResponse || !htmlResponse.data) {
            throw new Error('Failed to generate invoice HTML content');
        }

        const htmlContent = htmlResponse.data;
        console.log('🔧 PDF DEBUGGING: HTML content generated, length:', htmlContent.length);
        
        // Use my_html2pdf function for PDF generation
        try {
            console.log('🔧 PDF DEBUGGING: Calling my_html2pdf function...');
            const pdfResponse = await sdk.functions.invoke('my_html2pdf', {
                htmlContent: htmlContent,
                filename: `Invoice-${order.order_number}.pdf`,
                options: { 
                    format: 'A4', 
                    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
                    printBackground: true,
                    displayHeaderFooter: false
                }
            });

            console.log('🔧 PDF DEBUGGING: my_html2pdf raw response received from invoke:', {
                hasResponse: !!pdfResponse,
                responseType: typeof pdfResponse,
                hasData: !!pdfResponse?.data,
                dataType: typeof pdfResponse?.data
            });

            if (pdfResponse && pdfResponse.data) {
                let pdfBase64;
                let data = pdfResponse.data;

                // If data is a string, attempt to parse it as JSON
                if (typeof data === 'string') {
                    console.log('🔧 PDF DEBUGGING: my_html2pdf response data is a string, attempting JSON parse...');
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        console.warn('🔧 PDF DEBUGGING: Could not parse my_html2pdf string response as JSON, using as-is.');
                        // If it's not JSON, it might be the raw base64 string itself
                    }
                }

                // Now, check if 'data' object has pdfBase64 property
                if (data && typeof data === 'object' && data.pdfBase64) {
                    pdfBase64 = data.pdfBase64;
                    console.log('🔧 PDF DEBUGGING: Extracted pdfBase64 from object response.');
                } else if (typeof data === 'string') {
                    // Fallback: if data is still a string and not an object with pdfBase64, assume it's the raw base64
                    pdfBase64 = data;
                    console.log('🔧 PDF DEBUGGING: Assuming raw base64 string directly from my_html2pdf response.');
                } else {
                    console.error('🔧 PDF DEBUGGING: Unexpected final format of my_html2pdf response:', { finalDataType: typeof data, dataKeys: data ? Object.keys(data) : 'N/A' });
                    throw new Error('Unexpected PDF response format from my_html2pdf.');
                }
                
                // Final cleaning step: ensure no whitespace. No need to remove JSON key/value wrappers here if extraction is correct.
                if (pdfBase64 && typeof pdfBase64 === 'string') {
                    pdfBase64 = pdfBase64.replace(/\s/g, '');
                }
                
                if (!pdfBase64) {
                    throw new Error('PDF base64 data is empty or invalid after extraction.');
                }

                console.log('✅ PDF DEBUGGING: Cleaned base64 string prepared for return, length:', pdfBase64.length);
                
                return Response.json({ 
                    success: true, 
                    pdfBase64: pdfBase64 
                }, { status: 200 });
            } else {
                console.error('🔧 PDF DEBUGGING: my_html2pdf returned no data or an empty response.');
                throw new Error('PDF generation returned no data.');
            }
        } catch (pdfError) {
            console.error("🔧 PDF DEBUGGING: my_html2pdf invocation failed:", {
                message: pdfError.message,
                stack: pdfError.stack,
                name: pdfError.name,
                fullError: pdfError
            });
            
            throw new Error(`PDF generation via my_html2pdf failed: ${pdfError.message}`);
        }

    } catch (error) {
        console.error('💥 PDF DEBUGGING: Critical error in generateInvoicePDF:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            fullError: error
        });
        return Response.json({ 
            success: false, 
            error: error.message || 'Unknown error occurred'
        }, { status: 500 });
    }
});