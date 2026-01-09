
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            vendorId,
            householdId,
            deliveryDetails,
            items,
            deliveryPrice,
            paymentStatus,
            isPaid,
            isBilled,
            paymentMethod,
            initialStatus
        } = await req.json();

        // Authorization check
        const userType = user.user_type?.toLowerCase().trim();
        if (userType === 'vendor' && user.vendor_id !== vendorId) {
            return Response.json({ error: 'Not authorized to create orders for this vendor' }, { status: 403 });
        }
        if (!['admin', 'chief of staff', 'vendor'].includes(userType)) {
            return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        // Fetch household details
        const household = await base44.asServiceRole.entities.Household.get(householdId);
        if (!household) {
            return Response.json({ error: 'Household not found' }, { status: 404 });
        }

        // Fetch vendor details
        const vendor = await base44.asServiceRole.entities.Vendor.get(vendorId);
        if (!vendor) {
            return Response.json({ error: 'Vendor not found' }, { status: 404 });
        }

        // Fetch product details and construct order items
        const orderItems = [];
        for (const item of items) {
            const product = await base44.asServiceRole.entities.Product.get(item.productId);
            if (!product) {
                return Response.json({ error: `Product ${item.productId} not found` }, { status: 404 });
            }

            orderItems.push({
                product_id: product.id,
                sku: product.sku || '',
                product_name: product.name,
                product_name_hebrew: product.name_hebrew || '',
                subcategory: product.subcategory || '',
                subcategory_hebrew: product.subcategory_hebrew || '',
                quantity: item.quantity,
                quantity_per_unit: product.quantity_in_unit || '',
                actual_quantity: item.quantity, // Set actual_quantity same as quantity for quick orders
                price: item.price,
                unit: product.unit || 'each',
                shopped: true, // Mark as shopped since it's a quick order
                available: true,
                substitute_product_id: '',
                substitute_product_name: '',
                vendor_notes: '',
                modified: false,
                is_returned: false,
                amount_returned: null
            });
        }

        // Calculate total
        const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalAmount = subtotal + (deliveryPrice || 0);

        // Generate order number
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
        const orderNumber = `PO-${datePart}-${timePart}-${householdPart}-${vendorPart}-${runningNumber}`;

        // Create order object
        const orderData = {
            order_number: orderNumber,
            user_email: user.email,
            vendor_id: vendorId,
            household_id: householdId,
            household_code: household.household_code || '',
            household_name: household.name || '',
            household_name_hebrew: household.name_hebrew || '',
            household_lead_name: household.lead_name || '',
            household_lead_phone: household.lead_phone || '',
            items: orderItems,
            total_amount: totalAmount,
            delivery_price: deliveryPrice || 0,
            status: initialStatus || 'shopping',
            neighborhood: deliveryDetails.neighborhood || household.neighborhood || '',
            street: deliveryDetails.street || household.street || '',
            building_number: deliveryDetails.building_number || household.building_number || '',
            household_number: deliveryDetails.household_number || household.household_number || '',
            entrance_code: deliveryDetails.entrance_code || household.entrance_code || '',
            delivery_time: deliveryDetails.delivery_time || '',
            phone: deliveryDetails.phone || household.lead_phone || '',
            delivery_notes: deliveryDetails.delivery_notes || '',
            picker_id: '',
            picker_name: '',
            payment_status: paymentStatus || 'kcs',
            is_billed: isBilled !== undefined ? isBilled : true,
            is_paid: isPaid !== undefined ? isPaid : true,
            payment_method: paymentMethod || 'kcs_cash',
            has_returned_item: false
        };

        // Create the order
        const createdOrder = await base44.asServiceRole.entities.Order.create(orderData);

        return Response.json({
            success: true,
            order: createdOrder
        });

    } catch (error) {
        console.error('Error creating quick order:', error);
        return Response.json({
            error: error.message || 'Failed to create quick order'
        }, { status: 500 });
    }
});
