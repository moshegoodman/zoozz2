export async function generatePdf(htmlContent, options) {
    const debug = options && options.debug ? options.debug : false;

    try {
        const API_KEY = Deno.env.get("PDFMONKEY_API_KEY");
        const TEMPLATE_ID = Deno.env.get("PDFMONKEY_TEMPLATE_ID");

        if (!API_KEY || !TEMPLATE_ID) {
            throw new Error("PDFMonkey credentials are not configured on the server.");
        }

        // More aggressive cleaning of the API key to ensure it's a valid ByteString
        let cleanApiKey = String(API_KEY);
        // Remove any non-printable ASCII characters and whitespace
        cleanApiKey = cleanApiKey.replace(/[^\x21-\x7E]/g, '').trim();
        
        // Ensure we have a valid key after cleaning
        if (!cleanApiKey || cleanApiKey.length < 10) {
            throw new Error("PDFMonkey API Key is invalid or too short after cleaning.");
        }
        
        const cleanTemplateId = String(TEMPLATE_ID).replace(/[^\x21-\x7E]/g, '').trim();
        
        const payload = {
            document: {
                document_template_id: cleanTemplateId,
                payload: { _html: htmlContent },
                status: "pending"
            }
        };

        // Create headers object step by step to avoid any constructor issues
        const authValue = `Bearer ${cleanApiKey}`;
        
        // Validate that our auth header value is a valid ByteString
        try {
            new TextEncoder().encode(authValue);
        } catch (encodeError) {
            throw new Error(`Invalid characters in authorization header: ${encodeError.message}`);
        }

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authValue
            },
            body: JSON.stringify(payload)
        };

        const initialResponse = await fetch('https://api.pdfmonkey.io/api/v1/documents', requestOptions);
        const initialResult = await initialResponse.json();

        if (!initialResponse.ok) {
            throw new Error(`PDFMonkey initial request failed with status ${initialResponse.status}: ${JSON.stringify(initialResult)}`);
        }

        const statusUrl = initialResult.document?.url;
        if (!statusUrl) {
            throw new Error("PDFMonkey's response did not include a 'document.url' to poll.");
        }

        let finalStatus = 'pending';
        let downloadUrl = null;
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts && finalStatus === 'pending') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;

            const statusOptions = {
                method: 'GET',
                headers: {
                    'Authorization': authValue
                }
            };

            const statusResponse = await fetch(statusUrl, statusOptions);

            if (statusResponse.ok) {
                const statusResult = await statusResponse.json();
                finalStatus = statusResult.document.status;
                downloadUrl = statusResult.document.download_url;
            } else {
                finalStatus = 'polling_failed';
                break;
            }
        }
        
        if (debug) {
            return {
                message: `PDF generation process completed. Final status: ${finalStatus}`,
                isSuccess: finalStatus === 'success' && !!downloadUrl,
                finalStatus,
                downloadUrl,
                attempts,
            };
        }

        if (finalStatus !== 'success' || !downloadUrl) {
            throw new Error(`PDF generation failed or timed out. Final status: ${finalStatus}`);
        }

        const pdfResponse = await fetch(downloadUrl);
        if (!pdfResponse.ok) {
            throw new Error('Failed to download the generated PDF from the final URL.');
        }

        return await pdfResponse.arrayBuffer();

    } catch (error) {
        if (debug) {
            return {
                isSuccess: false,
                message: "An exception occurred in generatePdf helper.",
                error: error.message,
                stack: error.stack,
            };
        }
        throw error;
    }
}