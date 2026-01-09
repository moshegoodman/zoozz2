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
    if (!user || !['admin', 'chief of staff', 'vendor', 'picker'].includes(user.user_type)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!twilioWhatsAppFromNumber) {
      return new Response(JSON.stringify({ error: 'WhatsApp from number not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { 
      phoneNumber, 
      message, 
      templateName,
      templateVariables = {}, 
      messageType = 'customer_support',
      checkConsent = true,
      userEmail 
    } = await req.json();

    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: 'Phone number is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Format phone number
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+972${phoneNumber.replace(/^0/, '')}`;

    // Check consent if required
    if (checkConsent && userEmail) {
      try {
        const consentRecords = await base44.asServiceRole.entities.WhatsAppConsent.filter({
          user_email: userEmail,
          phone_number: formattedPhone,
          consent_given: true
        });

        if (consentRecords.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'No WhatsApp consent found for this user',
            requiresConsent: true
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const consent = consentRecords[0];
        
        // Check if user consented to this type of message
        if (!consent.message_types_consented.includes(messageType)) {
          return new Response(JSON.stringify({ 
            error: `User has not consented to receive ${messageType} messages`,
            requiresConsent: true
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('Error checking consent:', error);
        return new Response(JSON.stringify({ error: 'Failed to verify consent' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const from_number = `whatsapp:${twilioWhatsAppFromNumber}`;
    const to_number = `whatsapp:${formattedPhone}`;
    
    let messageOptions = {
      from: from_number,
      to: to_number
    };

    if (templateName) {
      // Get template from database
      const templates = await base44.asServiceRole.entities.WhatsAppTemplate.filter({
        name: templateName,
        is_active: true
      });

      if (templates.length === 0) {
        return new Response(JSON.stringify({ error: `Template '${templateName}' not found or inactive` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const template = templates[0];
      
      // Use template message
      messageOptions.contentSid = template.template_sid;
      messageOptions.contentVariables = JSON.stringify(templateVariables);
      
      console.log('Sending Template Message:', templateName);
    } else if (message) {
      // Use session message (only works within 24 hours of customer message)
      messageOptions.body = message;
      console.log('Sending Session Message');
    } else {
      return new Response(JSON.stringify({ error: 'Either message or templateName must be provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const twilioMessage = await client.messages.create(messageOptions);

    // Update consent record with last message sent
    if (userEmail) {
      try {
        await base44.asServiceRole.entities.WhatsAppConsent.update(consent.id, {
          last_message_sent: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to update consent record:', error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageSid: twilioMessage.sid,
      status: twilioMessage.status,
      messageType: templateName ? 'template' : 'session'
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