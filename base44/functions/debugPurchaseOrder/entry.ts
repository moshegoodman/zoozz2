import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sdk = base44.asServiceRole;

        const body = await req.json();
        const { order, vendor, household, language, testType } = body;

        if (!order || !testType) {
            return Response.json({ error: 'Missing order data or testType' }, { status: 400 });
        }

        // Use the canonical HTML generation function
        if (testType === 'html') {
            const htmlResponse = await sdk.functions.invoke('generatePurchaseOrderHTML', {
                order: order,
                language: language
            });

            if (!htmlResponse || !htmlResponse.data) {
                throw new Error('Failed to generate Purchase Order HTML content');
            }

            return new Response(htmlResponse.data, { 
                headers: { 'Content-Type': 'text/html; charset=utf-8' } 
            });
        }
        
        return Response.json({ 
            error: `Test type '${testType}' is not supported` 
        }, { status: 400 });

    } catch (error) {
        console.error('Debug Function Error:', error);
        return Response.json({ 
            error: error.message, 
            stack: error.stack 
        }, { status: 500 });
    }
});