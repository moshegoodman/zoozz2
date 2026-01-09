
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import Stripe from 'npm:stripe@12.18.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    // Use service role for webhook operations since there's no authenticated user
    const adminBase44 = base44.asServiceRole;

    try {
        const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY'), {
            apiVersion: '2023-10-16'
        });

        const body = await req.text();
        const signature = req.headers.get('stripe-signature');
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

        if (!webhookSecret) {
            console.error('STRIPE_WEBHOOK_SECRET is not configured');
            return new Response('Webhook secret not configured', { status: 500 });
        }

        // Verify webhook signature
        let event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return new Response('Invalid signature', { status: 400 });
        }

        console.log('Received Stripe event:', event.type, 'with ID:', event.id);

        // Handle the event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            console.log('Processing completed checkout session:', session.id);
            
            // Check if we already processed this session to avoid duplicates
            const existingOrders = await adminBase44.entities.Order.filter({
                stripe_session_id: session.id
            });

            if (existingOrders.length > 0) {
                console.log('Order already exists for session:', session.id);
                return new Response('Order already processed', { status: 200 });
            }

            // Get the metadata from the session
            const metadata = session.metadata;
            if (!metadata || !metadata.user_email || !metadata.vendor_id) {
                console.error('Missing required metadata in session:', session.id);
                return new Response('Invalid session metadata', { status: 400 });
            }

            // Parse the delivery details and items from metadata
            const deliveryDetails = JSON.parse(metadata.delivery_details);
            const simplifiedItems = JSON.parse(metadata.items);

            // Get full product details for the order items
            const productIds = simplifiedItems.map(item => item.product_id);
            const products = await adminBase44.entities.Product.filter({
                id: { $in: productIds }
            });

            // Reconstruct order items with full product information
            const orderItems = simplifiedItems.map(item => {
                const product = products.find(p => p.id === item.product_id);
                if (!product) {
                    throw new Error(`Product not found: ${item.product_id}`);
                }

                // Determine the correct price based on household context
                let price = product.price_customer_app; // Default
                if (metadata.household_id) {
                    price = product.price_customer_kcs || product.price_customer_app;
                }

                return {
                    product_id: product.id,
                    product_name: product.name,
                    product_name_hebrew: product.name_hebrew,
                    quantity: item.quantity,
                    price: price,
                    unit: product.unit,
                    sku: product.sku,
                    subcategory: product.subcategory,
                    subcategory_hebrew: product.subcategory_hebrew,
                    quantity_per_unit: product.quantity_in_unit,
                    shopped: false,
                    available: true,
                };
            });

            // Calculate total amount
            const itemsTotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryFeeAmount = parseFloat(metadata.delivery_fee) || 0;
            const totalAmount = itemsTotal + deliveryFeeAmount;

            // Generate order number (using the same logic as in Cart)
            const generateOrderNumber = (vendorId, householdId) => {
                const now = new Date();
                const year = now.getFullYear().toString().slice(-2);
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const day = now.getDate().toString().padStart(2, '0');
                const datePart = `D${year}${month}${day}`;
                
                const hours = now.getHours().toString().padStart(2, '0');
                const minutes = now.getMinutes().toString().padStart(2, '0');
                const timePart = `H${hours}${minutes}`;
                
                const householdPart = `C${(householdId || '0000').slice(-4)}`;
                const vendorPart = `V${(vendorId || '0000').slice(-4)}`;
                const runningNumber = Date.now().toString().slice(-4).padStart(4, '0');
                
                return `PO-${datePart}-${timePart}-${householdPart}-${vendorPart}-${runningNumber}`;
            };

            const orderNumber = generateOrderNumber(metadata.vendor_id, metadata.household_id);

            // Get household information if applicable
            let household = null;
            if (metadata.household_id) {
                try {
                    household = await adminBase44.entities.Household.get(metadata.household_id);
                } catch (error) {
                    console.warn('Could not fetch household:', metadata.household_id, error);
                }
            }

            // Create the order
            const orderData = {
                order_number: orderNumber,
                user_email: metadata.user_email,
                vendor_id: metadata.vendor_id,
                household_id: metadata.household_id || null,
                household_code: household?.household_code || null,
                household_name: household?.name || null,
                household_name_hebrew: household?.name_hebrew || null,
                household_lead_name: household?.lead_name || null,
                household_lead_phone: household?.lead_phone || null,
                items: orderItems,
                total_amount: totalAmount,
                delivery_fee: deliveryFeeAmount,
                delivery_time: deliveryDetails.time,
                phone: deliveryDetails.phone,
                delivery_notes: deliveryDetails.notes || '',
                neighborhood: deliveryDetails.neighborhood || '',
                street: deliveryDetails.street || '',
                building_number: deliveryDetails.building_number || '',
                household_number: deliveryDetails.household_number || '',
                entrance_code: deliveryDetails.entrance_code || '',
                status: 'pending',
                payment_status: 'client',
                is_paid: true,
                payment_method: metadata.payment_method,
                stripe_session_id: session.id,
            };

            // Build delivery address
            const addressParts = [
                orderData.neighborhood,
                orderData.street,
                orderData.building_number,
                orderData.household_number
            ].filter(Boolean);
            orderData.delivery_address = addressParts.join(', ') || 'Address to be confirmed';

            console.log('Creating order:', orderData);
            const createdOrder = await adminBase44.entities.Order.create(orderData);
            console.log('Order created successfully:', createdOrder.id);

            // Send notifications (email/SMS) - you can implement this later
            // For now, just log success
            console.log('Payment completed and order created for session:', session.id);

            return new Response(JSON.stringify({ 
                success: true, 
                orderId: createdOrder.id,
                orderNumber: createdOrder.order_number
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // For other event types, just acknowledge receipt
        console.log('Unhandled event type:', event.type);
        return new Response('Event received', { status: 200 });

    } catch (error) {
        console.error('Webhook processing error:', {
            message: error.message,
            stack: error.stack,
        });
        
        return new Response(JSON.stringify({ 
            error: 'Webhook processing failed',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
