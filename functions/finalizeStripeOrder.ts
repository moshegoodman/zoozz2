
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';
import Stripe from 'npm:stripe@12.18.0';

// Helper from another file, ensure it's available or define it here
const generateOrderNumber = (vendorId, householdId) => {
  const now = new Date();
  const datePart = `D${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const timePart = `H${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  const householdPart = `C${(householdId || '0000').slice(-4)}`;
  const vendorPart = `V${(vendorId || '0000').slice(-4)}`;
  const runningNumber = Date.now().toString().slice(-4).padStart(4, '0');
  return `PO-${datePart}-${timePart}-${householdPart}-${vendorPart}-${runningNumber}`;
};

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const adminBase44 = base44.asServiceRole;

    try {
        const { session_id } = await req.json();
        if (!session_id) {
            throw new Error("Stripe session_id is required.");
        }

        // Check if an order for this session already exists
        const existingOrders = await adminBase44.entities.Order.filter({ stripe_session_id: session_id });
        if (existingOrders.length > 0) {
            return Response.json({ success: true, order: existingOrders[0], message: "Order already exists." });
        }

        const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY'), { apiVersion: '2023-10-16' });
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            throw new Error("Payment was not successful.");
        }

        const metadata = session.metadata;
        const deliveryDetails = JSON.parse(metadata.delivery_details);
        const simplifiedItems = JSON.parse(metadata.items);

        // Reconstruct order items with full product details
        const productIds = simplifiedItems.map(item => item.product_id);
        const products = await adminBase44.entities.Product.filter({ id: { $in: productIds } });
        
        const orderItems = simplifiedItems.map(item => {
            const product = products.find(p => p.id === item.product_id);
            if (!product) throw new Error(`Product with ID ${item.product_id} not found.`);
            return {
                product_id: product.id,
                product_name: product.name,
                product_name_hebrew: product.name_hebrew,
                quantity: item.quantity,
                price: product.price_customer_kcs || product.price_customer_app || product.price_base,
                unit: product.unit,
                sku: product.sku,
                subcategory: product.subcategory,
                subcategory_hebrew: product.subcategory_hebrew,
                quantity_per_unit: product.quantity_in_unit, // Added this line
                shopped: false,
                available: true,
            };
        });

        const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) + parseFloat(metadata.delivery_fee);

        const household = metadata.household_id ? await adminBase44.entities.Household.get(metadata.household_id) : null;

        const orderNumber = generateOrderNumber(metadata.vendor_id, metadata.household_id);

        const newOrder = {
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
            delivery_fee: parseFloat(metadata.delivery_fee),
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
            stripe_session_id: session_id,
        };

        const createdOrder = await adminBase44.entities.Order.create(newOrder);

        // TODO: Add email/SMS notifications here if needed

        return Response.json({ success: true, order: createdOrder });

    } catch (error) {
        console.error('Finalize Stripe Order Error:', { message: error.message, stack: error.stack });
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});
