import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import Stripe from 'npm:stripe@12.18.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY'), {
            apiVersion: '2023-10-16'
        });

        const { orderData, successUrl, cancelUrl } = await req.json();

        if (!orderData || !orderData.items || !Array.isArray(orderData.items)) {
            return Response.json({ error: 'Invalid order data' }, { status: 400 });
        }

        // Create line items for Stripe
        const lineItems = orderData.items.map(item => ({
            price_data: {
                currency: 'ils',
                product_data: {
                    name: item.product_name_hebrew || item.product_name,
                    description: item.subcategory_hebrew || item.subcategory || '',
                },
                unit_amount: Math.round(item.product_price * 100),
            },
            quantity: item.quantity,
        }));

        if (orderData.delivery_fee && orderData.delivery_fee > 0) {
            lineItems.push({
                price_data: {
                    currency: 'ils',
                    product_data: {
                        name: 'Delivery Fee',
                    },
                    unit_amount: Math.round(orderData.delivery_fee * 100),
                },
                quantity: 1,
            });
        }

        // Simplify items for metadata to avoid size limit
        const simplifiedItems = orderData.items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            customer_email: user.email,
            metadata: {
                // Store only essential, size-limited data
                user_email: user.email,
                vendor_id: orderData.vendor_id,
                household_id: orderData.household_id || '',
                items: JSON.stringify(simplifiedItems),
                delivery_details: JSON.stringify(orderData.delivery_details),
                delivery_fee: orderData.delivery_fee || 0,
                payment_method: 'clientCC', // Hardcode as client Credit Card
            },
        });

        return Response.json({ 
            sessionId: session.id,
            url: session.url 
        });

    } catch (error) {
        console.error('Stripe checkout error:', {
            message: error.message,
            stack: error.stack,
        });
        return Response.json({ 
            error: `Stripe Error: ${error.message}` 
        }, { status: 500 });
    }
});