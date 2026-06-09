import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let to, cc, subject, body, attachments, context, order_id, order_number;

    try {
        const payload = await req.json();
        ({ to, cc, subject, body, attachments, context, order_id, order_number } = payload);
        
        if (!to || !subject || !body) {
            throw new Error('Missing required fields: to, subject, and body are required');
        }

        const apiKey = Deno.env.get('SENDGRID_API_KEY');
        const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL');

        if (!apiKey || !fromEmail) {
            throw new Error('SendGrid credentials not configured');
        }

        // Normalize CC to an array of unique addresses, excluding the primary recipient.
        const ccList = (Array.isArray(cc) ? cc : (cc ? [cc] : []))
            .filter(e => e && e !== to);

        const personalization = { to: [{ email: to }] };
        if (ccList.length > 0) personalization.cc = ccList.map(email => ({ email }));

        const emailData = {
            personalizations: [personalization],
            from: { email: fromEmail, name: 'Zoozz' },
            subject: subject,
            content: [{
                type: 'text/html',
                value: body
            }]
        };

        // Add attachments if provided
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            emailData.attachments = attachments.map(att => ({
                content: att.content,
                filename: att.filename,
                type: att.type || 'application/pdf',
                disposition: att.disposition || 'attachment'
            }));
        }

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SendGrid error response:', errorText);
            throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
        }

        // Log successful send
        await logEmail(base44, {
            to, from_email: fromEmail, subject, body, attachments,
            status: 'sent', context, order_id, order_number
        });

        return new Response(JSON.stringify({
            success: true,
            message: 'Email sent successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Email sending error:', error);

        // Log failed send
        try {
            await logEmail(base44, {
                to, from_email: Deno.env.get('SENDGRID_FROM_EMAIL'),
                subject, body, attachments,
                status: 'failed', error_message: error.message,
                context, order_id, order_number
            });
        } catch (logErr) {
            console.error('Failed to log email failure:', logErr.message);
        }

        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

async function logEmail(base44, { to, from_email, subject, body, attachments, status, error_message, context, order_id, order_number }) {
    try {
        const bodyPreview = body ? String(body).replace(/<[^>]*>/g, '').slice(0, 500) : '';
        const attachmentNames = Array.isArray(attachments) ? attachments.map(a => a?.filename).filter(Boolean) : [];
        await base44.asServiceRole.entities.EmailLog.create({
            to: to || '',
            from_email: from_email || '',
            subject: subject || '',
            body_preview: bodyPreview,
            has_attachments: attachmentNames.length > 0,
            attachment_names: attachmentNames,
            status: status,
            error_message: error_message || '',
            context: context || '',
            order_id: order_id || '',
            order_number: order_number || '',
        });
    } catch (err) {
        console.error('logEmail error:', err.message);
    }
}