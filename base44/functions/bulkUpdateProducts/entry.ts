import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { updates } = await req.json();

        if (!updates || !Array.isArray(updates)) {
            return Response.json({ error: 'Missing required "updates" parameter, which should be an array.' }, { status: 400 });
        }

        const sdk = base44.asServiceRole;
        const results = {
            successCount: 0,
            failureCount: 0,
            results: []
        };
        
        // Process each update from the payload
        for (const update of updates) {
            if (!update.id || !update.data) {
                results.failureCount++;
                results.results.push({ 
                    id: update.id || 'Unknown ID', 
                    success: false, 
                    error: 'Invalid update format. Each item must have an "id" and a "data" object.' 
                });
                continue;
            }
            try {
                // The update.data should already be a clean object from the frontend
                await sdk.entities.Product.update(update.id, update.data);
                results.successCount++;
                results.results.push({ id: update.id, success: true });
            } catch (error) {
                results.failureCount++;
                results.results.push({ id: update.id, success: false, error: error.message });
                console.error(`Failed to update product ${update.id}:`, error);
            }
        }

        return Response.json({ success: true, ...results });

    } catch (error) {
        console.error('Error in bulkUpdateProducts function:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});