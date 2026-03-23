import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { order } = await req.json();

        if (!order) {
            return Response.json({ error: 'Order is required' }, { status: 400 });
        }

        const isStaffOrder = order.household_id && order.user_email && order.user_email.includes('household_');
        
        // Generate order-specific link
        const orderLink = `${req.headers.get('origin') || 'https://zoozz.base44.app'}/Orders?order_id=${order.id}`;

        let emailBody;
        if (isStaffOrder) {
            // Staff order email - without prices
            emailBody = `
                <h2>Order Confirmation - ${order.order_number || 'N/A'}</h2>
                <p>Your order has been placed successfully for ${order.household_name || 'the household'}.</p>
                
                <h3>Order Details:</h3>
                <ul>
                    ${order.items ? order.items.map(item => `
                        <li>${item.quantity} x ${item.product_name}</li>
                    `).join('') : '<li>No items found</li>'}
                </ul>
                
                <p><strong>Delivery Address:</strong><br>
                ${order.delivery_details?.street || order.street || ''} ${order.delivery_details?.building_number || order.building_number || ''}${order.delivery_details?.household_number || order.household_number ? ', Apt ' + (order.delivery_details?.household_number || order.household_number) : ''}<br>
                ${order.delivery_details?.neighborhood || order.neighborhood || ''}</p>
                
                ${order.delivery_details?.notes || order.delivery_notes ? `<p><strong>Delivery Notes:</strong> ${order.delivery_details?.notes || order.delivery_notes}</p>` : ''}
                
                <p><a href="${orderLink}" style="background: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order Details</a></p>
                
                <p>Thank you for your order!</p>
            `;
        } else {
            // Regular customer order email - with prices
            const totalAmount = order.total_amount || 0;
            const deliveryFee = order.delivery_fee || 0;
            
            emailBody = `
                <h2>Order Confirmation - ${order.order_number || 'N/A'}</h2>
                <p>Your order has been placed successfully!</p>
                
                <h3>Order Details:</h3>
                <ul>
                    ${order.items ? order.items.map(item => `
                        <li>${item.quantity} x ${item.product_name} - ₪${(item.price * item.quantity).toFixed(2)}</li>
                    `).join('') : '<li>No items found</li>'}
                </ul>
                
                <p><strong>Subtotal:</strong> ₪${(totalAmount - deliveryFee).toFixed(2)}</p>
                ${deliveryFee > 0 ? `<p><strong>Delivery Fee:</strong> ₪${deliveryFee.toFixed(2)}</p>` : ''}
                <p><strong>Total:</strong> ₪${totalAmount.toFixed(2)}</p>
                
                <p><strong>Delivery Address:</strong><br>
                ${order.delivery_details?.street || order.street || ''} ${order.delivery_details?.building_number || order.building_number || ''}${order.delivery_details?.household_number || order.household_number ? ', Apt ' + (order.delivery_details?.household_number || order.household_number) : ''}<br>
                ${order.delivery_details?.neighborhood || order.neighborhood || ''}</p>
                
                ${order.delivery_details?.notes || order.delivery_notes ? `<p><strong>Delivery Notes:</strong> ${order.delivery_details?.notes || order.delivery_notes}</p>` : ''}
                
                <p><a href="${orderLink}" style="background: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order Details</a></p>
                
                <p>Thank you for your order!</p>
            `;
        }

        // Use the correct integration
        const sendEmailResponse = await base44.integrations.Core.SendEmail({
            to: order.user_email,
            subject: `Order Confirmation - ${order.order_number || 'N/A'}`,
            body: emailBody
        });

        return Response.json({ success: true, emailResponse: sendEmailResponse });
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});