import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const { name, email, subject, message } = await req.json();

    if (!email || !message) {
      return Response.json({ error: 'Email and message are required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    await base44.asServiceRole.entities.AdminNotification.create({
      type: 'order_issue',
      title: `New Contact: ${subject || 'Get Your Custom System'}`,
      message: `From: ${name || 'Unknown'} <${email}>\n\n${message}`,
      is_read: false,
      is_dismissed: false,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});