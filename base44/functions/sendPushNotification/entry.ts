import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const reqClone = req.clone();
    const base44 = createClientFromRequest(req);

    const reqBody = await reqClone.json();
    const { userEmail, title, body, url, tag } = reqBody;

    // Auth check — only admins or internal calls (no user token)
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    webpush.setVapidDetails('mailto:support@zoozz.com', vapidPublicKey, vapidPrivateKey);

    // Fetch all subscriptions via service role (bypasses RLS)
    const allSubscriptions = await base44.asServiceRole.entities.PushSubscription.list('-created_date', 10000);
    console.log('[DEBUG] Total subscriptions fetched:', allSubscriptions?.length);

    let subscriptions;
    if (userEmail) {
      const emailQuery = userEmail.toLowerCase().trim();
      subscriptions = allSubscriptions.filter(s =>
        (s.data?.user_email || s.user_email || '').toLowerCase() === emailQuery
      );
      console.log('[DEBUG] Filtered for', emailQuery, ':', subscriptions.length);
    } else {
      subscriptions = allSubscriptions;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No subscriptions found' });
    }

    const notificationPayload = JSON.stringify({
      title: title || 'Zoozz',
      body: body || '',
      data: { url: url || '/' },
      tag: tag || 'zoozz',
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const endpoint = sub.data?.endpoint || sub.endpoint;
      const p256dh = sub.data?.p256dh || sub.p256dh;
      const auth = sub.data?.auth || sub.auth;
      const subId = sub.id;

      if (!endpoint || !p256dh || !auth) {
        console.warn('[WARN] Skipping incomplete subscription:', subId);
        failed++;
        continue;
      }

      const pushSubscription = { endpoint, keys: { p256dh, auth } };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
        console.log('[DEBUG] Sent to:', endpoint.slice(0, 60));
        sent++;
      } catch (err) {
        console.error('[ERROR] Push failed for', endpoint.slice(0, 60), ':', err.statusCode, err.message);
        // 404 or 410 = subscription expired/invalid, remove it
        if (err.statusCode === 404 || err.statusCode === 410) {
          await base44.asServiceRole.entities.PushSubscription.delete(subId).catch(() => {});
        }
        failed++;
      }
    }

    console.log('[DONE] sent:', sent, 'failed:', failed);
    return Response.json({ success: true, sent, failed });
  } catch (error) {
    console.error('[FATAL]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});