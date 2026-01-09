import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { to, subject, body, attachments } = await req.json();
        
        if (!to || !subject || !body) {
            throw new Error('Missing required fields: to, subject, and body are required');
        }

        const apiKey = Deno.env.get('SENDGRID_API_KEY');
        const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL');

        if (!apiKey || !fromEmail) {
            throw new Error('SendGrid credentials not configured');
        }

        const emailData = {
            personalizations: [{
                to: [{ email: to }]
            }],
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

        return new Response(JSON.stringify({
            success: true,
            message: 'Email sent successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Email sending error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});