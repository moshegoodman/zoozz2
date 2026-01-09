import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        const userType = user.user_type?.trim().toLowerCase();
        if (userType !== 'admin' && userType !== 'chief of staff') {
            return new Response(JSON.stringify({ error: 'Access Denied. Admin privileges required.' }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        
        const { order_id } = await req.json();

        if (!order_id) {
            return new Response(JSON.stringify({ error: 'order_id is required' }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        // --- Data Integrity: Delete associated chats first ---
        try {
            const associatedChats = await base44.asServiceRole.entities.Chat.filter({ order_id: order_id });
            if (associatedChats && associatedChats.length > 0) {
                const deletePromises = associatedChats.map(chat => base44.asServiceRole.entities.Chat.delete(chat.id));
                await Promise.all(deletePromises);
            }
        } catch (chatError) {
            // Log the error but don't block order deletion if chat deletion fails
            console.error(`Warning: Failed to delete associated chats for order ${order_id}:`, chatError.message);
        }

        // --- Delete the order ---
        await base44.asServiceRole.entities.Order.delete(order_id);

        return new Response(JSON.stringify({ success: true, message: `Order ${order_id} and associated data deleted successfully.` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error deleting order:", error);
        
        if (error.message.includes("not found")) {
            return new Response(JSON.stringify({ error: 'Order not found.' }), { status: 404, headers: { "Content-Type": "application/json" } });
        }
        
        return new Response(JSON.stringify({ error: 'Failed to delete order: ' + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});