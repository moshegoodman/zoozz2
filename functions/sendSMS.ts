import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { phoneNumber, message, messageType = 'general' } = await req.json();

        if (!phoneNumber || !message) {
            return Response.json({ 
                success: false, 
                error: 'Phone number and message are required' 
            }, { status: 400 });
        }

        // DISABLED: Using invalid credentials to prevent actual SMS sending
        console.log('[SMS DISABLED] Would have sent SMS:', {
            to: phoneNumber,
            message: message,
            messageType: messageType
        });

        return Response.json({ 
            success: false,
            error: 'SMS functionality is temporarily disabled',
            note: 'SMS sending is disabled to prevent costs. Check server logs for message details.'
        });

        /* ORIGINAL CODE - COMMENTED OUT TO DISABLE SMS
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
            phoneNumber: formattedPhoneNumber
        });
        */

    } catch (error) {
        console.error('Error in sendSMS:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});