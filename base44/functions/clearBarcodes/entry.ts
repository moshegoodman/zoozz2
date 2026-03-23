import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'),
});

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);
        
        const user = await base44.auth.me();
        if (!user || user.user_type !== 'admin') {
            return new Response('Admin access required', { status: 403 });
        }

        // Get all products
        const products = await base44.entities.Product.filter({});
        
        let updatedCount = 0;
        
        // Update each product to set barcode to null
        for (const product of products) {
            if (product.barcode) {
                await base44.entities.Product.update(product.id, { barcode: null });
                updatedCount++;
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully cleared barcodes from ${updatedCount} products`,
            totalProducts: products.length
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});