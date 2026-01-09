Deno.serve(async (req) => {
    try {
        console.log('🔧 Starting my_html2pdf function with PDFShift');
        
        const { htmlContent, options = {} } = await req.json();
        
        if (!htmlContent) {
            console.error('❌ No HTML content provided');
            return Response.json({ error: 'HTML content is required' }, { status: 400 });
        }

        console.log('🔧 HTML content received, length:', htmlContent.length);
        console.log('🔧 PDF options:', options);

        const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
        if (!pdfShiftApiKey) {
            console.error('❌ PDFSHIFT_API_KEY not found');
            return Response.json({ error: 'PDFShift API key not configured' }, { status: 500 });
        }

        console.log('🔧 Calling PDFShift API...');
        
        // Prepare PDFShift request with only supported options
        const requestBody = {
            source: htmlContent,
            landscape: options.orientation === 'landscape' || false,
            use_print: false,
            format: options.format || 'A4',
            margin: {
                top: options.marginTop || '0.5in',
                right: options.marginRight || '0.5in', 
                bottom: options.marginBottom || '0.5in',
                left: options.marginLeft || '0.5in'
            }
        };

        // Only add supported PDFShift options
        if (options.filename) requestBody.filename = options.filename;
        if (options.delay !== undefined) requestBody.delay = options.delay;
        if (options.timeout !== undefined) requestBody.timeout = options.timeout;

        const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
            method: 'POST',
            headers: {
                'X-API-Key': pdfShiftApiKey,
                'Content-type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ PDFShift API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error(`PDFShift API error (${response.status} ${response.statusText}): ${errorText}`);
        }

        console.log('✅ PDFShift API call successful');
        
        // Get PDF as array buffer
        const pdfBuffer = await response.arrayBuffer();
        console.log('✅ PDF generated successfully, size:', pdfBuffer.byteLength, 'bytes');

        // Convert to base64 efficiently for large files
        const uint8Array = new Uint8Array(pdfBuffer);
        let binaryString = '';
        const chunkSize = 8192; // Process in chunks to avoid stack overflow
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
        }
        
        const base64Pdf = btoa(binaryString);
        console.log('✅ PDF converted to base64, length:', base64Pdf.length);

        return Response.json({
            success: true,
            pdfBase64: base64Pdf,
            size: pdfBuffer.byteLength
        });

    } catch (error) {
        console.error('❌ Error in my_html2pdf:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            fullError: error
        });
        
        return Response.json({
            success: false,
            error: error.message || 'Failed to generate PDF',
            stack: error.stack
        }, { status: 500 });
    }
});