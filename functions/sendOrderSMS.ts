import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderId, messageType, recipientType = 'customer' } = await req.json();

        if (!orderId || !messageType) {
            return Response.json({ 
                success: false, 
                error: 'Order ID and message type are required' 
            }, { status: 400 });
        }

        // DISABLED: Logging instead of sending to prevent costs
        console.log('[SMS DISABLED] Would have sent order SMS:', {
            orderId,
            messageType,
            recipientType
        });

        return Response.json({ 
            success: false,
            error: 'SMS functionality is temporarily disabled',
            note: 'SMS sending is disabled to prevent costs. Check server logs for message details.'
        });

        /* ORIGINAL CODE - COMMENTED OUT TO DISABLE SMS
        const { Order, Vendor, Household, User } = await import('npm:@base44/sdk@0.7.1/entities');
        
        const order = await base44.asServiceRole.entities.Order.get(orderId);
        if (!order) {
            return Response.json({ 
                success: false, 
                error: 'Order not found' 
            }, { status: 404 });
        }

        const vendor = await base44.asServiceRole.entities.Vendor.get(order.vendor_id);
        let household = null;
        if (order.household_id) {
            household = await base44.asServiceRole.entities.Household.get(order.household_id);
        }

        let phoneNumber;
        let message;

        if (recipientType === 'customer') {
            phoneNumber = order.household_lead_phone || order.phone;
            
            if (!phoneNumber) {
                return Response.json({ 
                    success: false, 
                    error: 'No phone number found for customer' 
                }, { status: 400 });
            }

            const vendorName = vendor?.name || 'Vendor';
            const householdName = household?.name || 'Customer';

            switch (messageType) {
                case 'order_confirmed':
                    message = `Your order ${order.order_number} from ${vendorName} has been confirmed! We'll notify you when it's ready for delivery.`;
                    break;
                case 'order_ready':
                    message = `Good news! Your order ${order.order_number} from ${vendorName} is ready and will be delivered soon.`;
                    break;
                case 'order_shipped':
                    message = `Your order ${order.order_number} from ${vendorName} is on its way! ${order.delivery_time ? `Expected delivery: ${order.delivery_time}` : ''}`;
                    break;
                case 'order_delivered':
                    message = `Your order ${order.order_number} from ${vendorName} has been delivered. Thank you for your order!`;
                    break;
                case 'delivery_date_updated':
                    message = `Update: The delivery date for your order ${order.order_number} from ${vendorName} has been changed to ${order.delivery_time || 'TBD'}.`;
                    break;
                default:
                    message = `Update on your order ${order.order_number} from ${vendorName}.`;
            }
        } else if (recipientType === 'vendor') {
            phoneNumber = vendor?.contact_email;
            
            if (!phoneNumber) {
                return Response.json({ 
                    success: false, 
                    error: 'No phone number found for vendor' 
                }, { status: 400 });
            }

            const householdName = household?.name || order.household_name || 'Customer';
            
            switch (messageType) {
                case 'new_order':
                    message = `New order received! Order ${order.order_number} from ${householdName}. Total: ₪${order.total_amount?.toFixed(2)}. Check your dashboard for details.`;
                    break;
                default:
                    message = `Update on order ${order.order_number} from ${householdName}.`;
            }
        } else {
            return Response.json({ 
                success: false, 
                error: 'Invalid recipient type' 
            }, { status: 400 });
        }

        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

        if (!accountSid || !authToken || !twilioPhoneNumber) {
            return Response.json({ 
                success: false, 
                error: 'Twilio credentials not configured' 
            }, { status: 500 });
        }

        let formattedPhoneNumber = phoneNumber.trim();
        if (formattedPhoneNumber.startsWith('0')) {
            formattedPhoneNumber = '+972' + formattedPhoneNumber.substring(1);
        } else if (!formattedPhoneNumber.startsWith('+')) {
            formattedPhoneNumber = '+972' + formattedPhoneNumber;
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = btoa(`${accountSid}:${authToken}`);
        
        const body = new URLSearchParams({
            To: formattedPhoneNumber,
            From: twilioPhoneNumber,
            Body: message
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Twilio API Error:', data);
            return Response.json({ 
                success: false, 
                error: data.message || 'Failed to send SMS',
                details: data
            }, { status: response.status });
        }

        return Response.json({ 
            success: true, 
            messageSid: data.sid,
            status: data.status,
            phoneNumber: formattedPhoneNumber,
            messageType: messageType
        });
        */

    } catch (error) {
        console.error('Error in sendOrderSMS:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});