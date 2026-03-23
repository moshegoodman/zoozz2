import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        if (!(await base44.auth.isAuthenticated())) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderId } = await req.json();
        
        if (!orderId) {
            return Response.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // Get order details
        const order = await base44.entities.Order.get(orderId);
        if (!order) {
            return Response.json({ error: 'Order not found' }, { status: 404 });
        }

        // Get vendor details
        const vendor = await base44.entities.Vendor.get(order.vendor_id);
        const vendorName = vendor?.name_hebrew || vendor?.name || 'הספק';

        // Get customer email
        let recipientEmail = order.user_email;
        let recipientName = order.user_email;

        // If it's a household order, get the lead's info
        if (order.household_id) {
            const household = await base44.entities.Household.get(order.household_id);
            if (household?.lead_id) {
                const leadUsers = await base44.entities.User.filter({ id: household.lead_id });
                if (leadUsers.length > 0) {
                    recipientEmail = leadUsers[0].email;
                    recipientName = leadUsers[0].full_name || leadUsers[0].email;
                }
            }
        }

        // Generate delivery PDF
        const pdfResponse = await base44.functions.invoke('generateDeliveryPDF', {
            order: order,
            language: 'Hebrew'
        });

        if (!pdfResponse.data?.success || !pdfResponse.data?.pdfBase64) {
            throw new Error('Failed to generate delivery PDF');
        }

        // Prepare email content
        const householdName = order.household_name_hebrew || order.household_name || '';
        const deliveryTime = order.delivery_time || 'בקרוב';
        
        const emailSubject = `משלוח בדרך - הזמנה מ-${vendorName}`;
        const emailBody = `
            <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">שלום ${recipientName},</h2>
                <p style="font-size: 16px; line-height: 1.6;">
                    ההזמנה שלך מ-<strong>${vendorName}</strong> נשלחה ובדרך אליך!
                </p>
                ${householdName ? `<p style="font-size: 14px; color: #666;">משק בית: ${householdName}</p>` : ''}
                <p style="font-size: 14px; color: #666;">מספר הזמנה: #${order.order_number}</p>
                <p style="font-size: 14px; color: #666;">זמן משלוח משוער: ${deliveryTime}</p>
                ${order.delivery_notes ? `<p style="font-size: 14px; color: #666;">הערות משלוח: ${order.delivery_notes}</p>` : ''}
                
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;">
                        תעודת משלוח מצורפת למייל זה.
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    תודה שבחרת ב-Zoozz!
                </p>
            </div>
        `;

        // Send email with PDF attachment
        const emailResponse = await base44.functions.invoke('sendGridEmail', {
            to: recipientEmail,
            subject: emailSubject,
            body: emailBody,
            fromName: 'Zoozz',
            attachments: [{
                content: pdfResponse.data.pdfBase64,
                filename: `delivery-${order.order_number}.pdf`,
                type: 'application/pdf',
                disposition: 'attachment'
            }]
        });

        if (!emailResponse.data?.success) {
            throw new Error('Failed to send email');
        }

        // Create notification for customer
        try {
            await base44.entities.Notification.create({
                user_email: recipientEmail,
                title: 'ההזמנה שלך נשלחה',
                message: `ההזמנה מ-${vendorName} נשלחה ובדרך אליך`,
                type: 'order_update',
                order_id: order.id,
                vendor_id: order.vendor_id,
                is_read: false
            });
        } catch (notifError) {
            console.warn('Failed to create notification:', notifError);
        }

        return Response.json({
            success: true,
            message: 'Shipping notification email sent successfully',
            recipient: recipientEmail
        });

    } catch (error) {
        console.error('Error sending shipping notification email:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});