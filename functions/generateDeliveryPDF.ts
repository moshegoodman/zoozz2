import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sdk = base44.asServiceRole;

        const { order, language } = await req.json();

        if (!order) {
            return Response.json({ error: 'Order data is required' }, { status: 400 });
        }

        console.log('🔧 PDF DEBUGGING: Starting delivery PDF generation for order:', order.order_number);

        // Fetch related data
        console.log('🔧 PDF DEBUGGING: Fetching related data...');
        const [vendor, household] = await Promise.all([
            order.vendor_id ? sdk.entities.Vendor.get(order.vendor_id).catch(e => {
                console.warn('🔧 PDF DEBUGGING: Failed to fetch vendor:', e);
                return null;
            }) : Promise.resolve(null),
            order.household_id ? sdk.entities.Household.get(order.household_id).catch(e => {
                console.warn('🔧 PDF DEBUGGING: Failed to fetch household:', e);
                return null;
            }) : Promise.resolve(null)
        ]);
        
        console.log('🔧 PDF DEBUGGING: Fetched data:', {
            vendorName: vendor?.name,
            householdName: household?.name,
            language: language
        });
        
        // Generate HTML content using generateDeliveryHTML function
        console.log('🔧 PDF DEBUGGING: Generating HTML content...');
        const htmlResponse = await sdk.functions.invoke('generateDeliveryHTML', {
            order: order,
            vendor: vendor,
            language: language
        });

        if (!htmlResponse || !htmlResponse.data) {
            throw new Error('Failed to generate delivery HTML content');
        }

        const htmlContent = htmlResponse.data;
        console.log('🔧 PDF DEBUGGING: HTML content generated:', {
            length: htmlContent.length,
            preview: htmlContent.substring(0, 200) + '...'
        });
        
        // Use my_html2pdf function for PDF generation
        try {
            console.log('🔧 PDF DEBUGGING: Calling my_html2pdf function...');
            const pdfResponse = await sdk.functions.invoke('my_html2pdf', {
                htmlContent: htmlContent,
                filename: `Delivery-${order.order_number}.pdf`,
                options: { 
                    format: 'A4', 
                    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
                    printBackground: true,
                    displayHeaderFooter: false
                }
            });

            console.log('🔧 PDF DEBUGGING: my_html2pdf raw response:', {
                hasResponse: !!pdfResponse,
                responseType: typeof pdfResponse,
                hasData: !!pdfResponse?.data,
                dataType: typeof pdfResponse?.data
            });

            if (pdfResponse && pdfResponse.data) {
                console.log('🔧 PDF DEBUGGING: PDF data received, processing...');
                
                // Handle different response formats
                let pdfBase64;
                if (typeof pdfResponse.data === 'string') {
                    console.log('🔧 PDF DEBUGGING: Response data is string, using directly');
                    pdfBase64 = pdfResponse.data;
                } else if (pdfResponse.data instanceof ArrayBuffer) {
                    console.log('🔧 PDF DEBUGGING: Response data is ArrayBuffer, converting to base64');
                    const pdfBuffer = new Uint8Array(pdfResponse.data);
                    pdfBase64 = btoa(String.fromCharCode(...pdfBuffer));
                } else if (pdfResponse.data.pdfBase64) {
                    console.log('🔧 PDF DEBUGGING: Response data has pdfBase64 property');
                    pdfBase64 = pdfResponse.data.pdfBase64;
                } else {
                    console.error('🔧 PDF DEBUGGING: Unexpected response format:', Object.keys(pdfResponse.data));
                    throw new Error('Unexpected PDF response format');
                }
                
                console.log('✅ PDF DEBUGGING: PDF generated successfully:', {
                    base64Length: pdfBase64?.length,
                    base64Preview: pdfBase64?.substring(0, 50) + '...'
                });
                
                return Response.json({ 
                    success: true, 
                    pdfBase64: pdfBase64 
                }, { status: 200 });
            } else {
                console.error('🔧 PDF DEBUGGING: my_html2pdf returned no data');
                throw new Error('PDF generation returned no data');
            }
        } catch (pdfError) {
            console.error("🔧 PDF DEBUGGING: my_html2pdf failed:", {
                message: pdfError.message,
                stack: pdfError.stack,
                name: pdfError.name
            });
            
            // Return HTML content as fallback
            return Response.json({ 
                success: false,
                htmlContent: htmlContent,
                error: `PDF generation failed: ${pdfError.message}`
            }, { status: 200 });
        }

    } catch (error) {
        console.error('🔧 PDF DEBUGGING: Critical error in generateDeliveryPDF:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return Response.json({ 
            success: false, 
            error: error.message || 'Unknown error occurred'
        }, { status: 500 });
    }
});