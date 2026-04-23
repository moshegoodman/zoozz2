import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const reqClone = req.clone();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint, p256dh, auth } = await reqClone.json();

    if (!endpoint || !p256dh || !auth) {
      return Response.json({ error: 'Missing subscription fields' }, { status: 400 });
    }

    // Check if this exact endpoint already exists for this user
    const allSubs = await base44.asServiceRole.entities.PushSubscription.list('-created_date', 10000);
    const existing = allSubs.find(s =>
      (s.data?.user_email || s.user_email) === user.email &&
      (s.data?.endpoint || s.endpoint) === endpoint
    );

    if (existing) {
      return Response.json({ success: true, message: 'Already subscribed' });
    }

    await base44.asServiceRole.entities.PushSubscription.create({
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