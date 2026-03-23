import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Authenticate the user and check for admin role
        const user = await base44.auth.me();
        if (!user || user.user_type !== 'admin') {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Admin access required.' }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 2. Get vendor_id from the request body
        const { vendor_id } = await req.json();
        if (!vendor_id) {
            return new Response(JSON.stringify({ success: false, error: 'vendor_id is required.' }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }
        
        // Use the service role client for elevated permissions
        const sdk = base44.asServiceRole;

        // 3. Find all products associated with the vendor
        const productsToDelete = await sdk.entities.Product.filter({ vendor_id: vendor_id });
        const count = productsToDelete.length;

        if (count === 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'No products found for this vendor to delete.',
                count: 0
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 4. Delete products sequentially to avoid rate limiting
        let deletedCount = 0;
        for (const product of productsToDelete) {
            try {
                await sdk.entities.Product.delete(product.id);
                deletedCount++;
                
                // Add a small delay to avoid hitting rate limits
                if (deletedCount % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (deleteError) {
                console.error(`Failed to delete product ${product.id}:`, deleteError);
                // Continue with other products even if one fails
            }
        }

        // 6. Return a success response
        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully deleted ${deletedCount} out of ${count} products.`,
            count: deletedCount 
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error('Error deleting vendor products:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});