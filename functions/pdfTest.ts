import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') });

Deno.serve(async (req) => {
    try {
        // Authenticate the user
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return new Response('Unauthorized', { status: 401 });
        base44.auth.setToken(authHeader.split(' ')[1]);
        await base44.auth.me();

        // Safely get the JSON body from the request
        let testData = {};
        try {
            testData = await req.json();
        } catch (e) {
            // Ignore error if no body is present, just use default empty object
        }

        const { title, content, timestamp, test_message } = testData;

        // Get PDFMonkey secrets
        const apiKey = Deno.env.get("PDFMONKEY_API_KEY");
        const templateId = Deno.env.get("PDFMONKEY_TEMPLATE_ID");

        if (!apiKey || !templateId) {
            throw new Error("PDFMonkey secrets are not configured on the server.");
        }

        // Generate HTML from the test data, with fallbacks
        const htmlContent = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc;">
                <h1>${title || 'Default Test Title'}</h1>
                <p>${content || 'This is the default content body.'}</p>
                <p><strong>Test Message:</strong> ${test_message || 'N/A'}</p>
                <hr>
                <p><small>Generated at: ${timestamp || new Date().toISOString()}</small></p>
            </div>
        `;

        // Call PDFMonkey API
        const response = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                document: {
                    document_template_id: templateId,
                    payload: { _html: htmlContent },
                    status: "pending",
                },
            }),
        });
        
        if (!response.ok) {
            throw new Error(`PDFMonkey API Error: ${response.status} ${await response.text()}`);
        }

        // Get the download URL (with the smart fallback for draft status)
        const result = await response.json();
        let downloadUrl = result.document?.download_url;

        if (!downloadUrl && result.document?.preview_url) {
            const previewUrl = new URL(result.document.preview_url);
            downloadUrl = previewUrl.searchParams.get('file');
        }

        if (!downloadUrl) {
            throw new Error("PDFMonkey did not return a usable download URL.");
        }

        // Download the actual PDF file
        const pdfResponse = await fetch(downloadUrl);
        if (!pdfResponse.ok) {
            throw new Error(`Failed to download the generated PDF. Status: ${pdfResponse.status}`);
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // Return the PDF to the user
        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="test.pdf"'
            }
        });

    } catch (error) {
        console.error("pdfTest function error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
        });
    }
});