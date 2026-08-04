import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Entity automation on Notification (create): sends a Web Push notification
// to the target user containing the notification's title and message.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const event = body?.event || {};
    let data = body?.data || null;

    // If payload was too large, fetch the full record via service role
    if (!data && event?.entity_id) {
      data = await base44.asServiceRole.entities.Notification.get(event.entity_id).catch(() => null);
    }
    if (!data) {
      return Response.json({ success: false, reason: 'no notification data' });
    }

    const userEmail = (data.user_email || '').trim().toLowerCase();
    if (!userEmail) {
      return Response.json({ success: false, reason: 'no recipient email' });
    }

    const title = data.title || 'Zoozz';
    const bodyText = (data.message || '').slice(0, 200);
    const url = data.link_to || '/';
    const tag = `notif-${event?.entity_id || data.id || Date.now()}`;

    await base44.asServiceRole.functions.invoke('sendPushNotification', {
      userEmail,
      title,
      body: bodyText,
      url,
      tag
    });

    return Response.json({ success: true, recipient: userEmail });
  } catch (error) {
    console.error('[pushNotifyOnNotification] error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}