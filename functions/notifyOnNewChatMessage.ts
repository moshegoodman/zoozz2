import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate the request
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { chatId, senderType, messageText } = await req.json();

        if (!chatId || !senderType) {
            return Response.json({ 
                error: 'Missing required parameters: chatId and senderType are required' 
            }, { status: 400 });
        }

        // Fetch the chat to get context
        const chat = await base44.asServiceRole.entities.Chat.get(chatId);
        if (!chat) {
            return Response.json({ error: 'Chat not found' }, { status: 404 });
        }

        // Determine recipient based on sender type
        let recipientEmail;
        let notificationMessage;

        if (senderType === 'vendor') {
            // Vendor sent message, notify customer
            recipientEmail = chat.customer_email;
            const vendorName = chat.vendor_name_hebrew || chat.vendor_name || 'ספק';
            notificationMessage = `הודעה חדשה מ${vendorName}: ${messageText || 'הודעה חדשה'}`;
        } else if (senderType === 'customer' || senderType === 'admin') {
            // Customer or admin sent message, notify vendor
            // We need to find the vendor's contact email
            const vendor = await base44.asServiceRole.entities.Vendor.get(chat.vendor_id);
            if (vendor && vendor.contact_email) {
                recipientEmail = vendor.contact_email;
                const senderName = user.full_name || user.first_name || 'לקוח';
                notificationMessage = `הודעה חדשה מ${senderName}: ${messageText || 'הודעה חדשה'}`;
            } else {
                console.warn(`No contact email found for vendor ${chat.vendor_id}`);
                return Response.json({ 
                    success: false, 
                    message: 'Vendor contact email not found' 
                }, { status: 200 });
            }
        } else {
            return Response.json({ 
                error: 'Invalid sender type. Must be "vendor", "customer", or "admin"' 
            }, { status: 400 });
        }

        if (!recipientEmail) {
            console.warn('No recipient email determined for SMS notification');
            return Response.json({ 
                success: false, 
                message: 'No recipient found' 
            }, { status: 200 });
        }

        // Fetch recipient's phone number
        const recipientUsers = await base44.asServiceRole.entities.User.filter({ email: recipientEmail });
        const recipient = recipientUsers && recipientUsers.length > 0 ? recipientUsers[0] : null;

        if (!recipient || !recipient.phone) {
            console.warn(`No phone number found for recipient: ${recipientEmail}`);
            return Response.json({ 
                success: false, 
                message: 'Recipient phone number not found' 
            }, { status: 200 });
        }

        // Send SMS via sendSMS function
        try {
            await base44.asServiceRole.functions.invoke('sendSMS', {
                to: recipient.phone,
                message: notificationMessage
            });

            console.log(`SMS notification sent successfully to ${recipient.phone}`);
            
            return Response.json({ 
                success: true, 
                message: 'SMS notification sent successfully',
                recipient: recipientEmail
            });
        } catch (smsError) {
            console.error('Failed to send SMS:', smsError);
            return Response.json({ 
                success: false, 
                message: 'Failed to send SMS notification',
                error: smsError.message 
            }, { status: 200 }); // Return 200 to not break the chat flow
        }

    } catch (error) {
        console.error('Error in notifyOnNewChatMessage:', error);
        return Response.json({ 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
});