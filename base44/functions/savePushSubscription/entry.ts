import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint, p256dh, auth } = await req.json();

    if (!endpoint || !p256dh || !auth) {
      return Response.json({ error: 'Missing subscription fields' }, { status: 400 });
    }

    // Check if already exists
    const existing = await base44.entities.PushSubscription.filter({ user_email: user.email, endpoint });

    if (existing && existing.length > 0) {
      return Response.json({ success: true, message: 'Already subscribed' });
    }

    await base44.entities.PushSubscription.create({
      user_email: user.email,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers.get('user-agent') || '',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});