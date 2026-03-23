
import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import twilio from 'npm:twilio@4.19.0';

const client = twilio(
  Deno.env.get('TWILIO_ACCOUNT_SID'),
  Deno.env.get('TWILIO_AUTH_TOKEN')
);

const twilioWhatsAppFromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || !['admin', 'chief of staff'].includes(user.user_type)) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!twilioWhatsAppFromNumber) {
        console.error('TWILIO_WHATSAPP_FROM_NUMBER is not set in secrets.');
        return new Response(JSON.stringify({ error: 'Twilio WhatsApp "from" number is not configured in secrets.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { phoneNumber, message, templateSid, templateVariables } = await req.json();

    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: 'Phone number is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }
    
    // Format phone number to E.164 format if needed
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+972${phoneNumber.replace(/^0/, '')}`;

    const from_number = `whatsapp:${twilioWhatsAppFromNumber}`;
    const to_number = `whatsapp:${formattedPhone}`;
    
    console.log(`Attempting to send WhatsApp message. From: ${from_number}, To: ${to_number}`);

    // Fix: Remove explicit type annotation for messageOptions to allow type inference,
    // which simplifies the declaration and avoids potential issues if the type structure
    // becomes too complex or if the Deno/TypeScript setup prefers inference.
    const messageOptions = {
        from: from_number,
        to: to_number
    };

    if (templateSid) {
        // This is a Template Message
        if (!templateVariables) {
            return new Response(JSON.stringify({ error: 'Template variables are required for a template message.' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
        }
        // Ensure properties are assigned correctly
        Object.assign(messageOptions, {
            contentSid: templateSid,
            contentVariables: JSON.stringify(templateVariables) // Twilio's contentVariables expects a stringified JSON object
        });
        console.log('Sending Template Message with SID:', templateSid);
    } else if (message) {
        // This is a freeform Session Message
        // Ensure properties are assigned correctly
        Object.assign(messageOptions, {
            body: message
        });
        console.log('Sending Session Message.');
    } else {
        return new Response(JSON.stringify({ error: 'Either a message or a templateSid must be provided.' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }

    const twilioMessage = await client.messages.create(messageOptions);

    console.log('Twilio API response:', twilioMessage);

    return new Response(JSON.stringify({ 
      success: true, 
      messageSid: twilioMessage.sid,
      status: twilioMessage.status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('WhatsApp sending error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to send WhatsApp message' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

