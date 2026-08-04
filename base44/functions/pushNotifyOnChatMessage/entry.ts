import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Entity automation on Chat (update): pushes a Web Push notification to every
// participant that did NOT send the latest message.
//
// Recipients per sender_type of the newest message:
//   - "customer" or "admin" -> all users linked to the vendor (vendor_id or vendor_ids)
//     + admins (only when sender is customer, so admins get notified too)
//   - "vendor" or "admin"   -> the chat's customer_email
//
// We fan out by invoking sendPushNotification once per recipient email.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Entity automation payload shape
    const event = body?.event || {};
    let data = body?.data || null;
    const oldData = body?.old_data || null;

    // If payload was too large, fetch the full chat via service role
    if (!data && event?.entity_id) {
      data = await base44.asServiceRole.entities.Chat.get(event.entity_id).catch(() => null);
    }
    if (!data) {
      return Response.json({ success: false, reason: 'no chat data' });
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (messages.length === 0) {
      return Response.json({ success: false, reason: 'no messages' });
    }

    const prevCount = Array.isArray(oldData?.messages) ? oldData.messages.length : 0;
    // Only act if a new message was appended (not e.g. a read-status flip)
    if (messages.length <= prevCount) {
      return Response.json({ success: false, reason: 'no new message' });
    }

    const lastMsg = messages[messages.length - 1];
    const senderType = lastMsg?.sender_type;
    const senderEmail = (lastMsg?.sender_email || '').toLowerCase();
    const text = lastMsg?.message || (lastMsg?.image_url ? '📷 Image' : lastMsg?.voice_url ? '🎤 Voice message' : 'New message');

    // Build recipient email list
    const recipientEmails = new Set();

    // Notify the customer when someone else wrote
    if (senderType !== 'customer' && data.customer_email) {
      recipientEmails.add(data.customer_email.toLowerCase());
    }

    // Notify the vendor's users when the customer or admin wrote
    if ((senderType === 'customer' || senderType === 'admin') && data.vendor_id) {
      const vendorUsers = await base44.asServiceRole.entities.User.list('-created_date', 5000).catch(() => []);
      for (const u of vendorUsers) {
        const vid = u.vendor_id;
        const vids = Array.isArray(u.vendor_ids) ? u.vendor_ids : [];
        if (vid === data.vendor_id || vids.includes(data.vendor_id)) {
          if (u.email) recipientEmails.add(u.email.toLowerCase());
        }
      }
    }

    // Never notify the sender themselves
    if (senderEmail) recipientEmails.delete(senderEmail);

    if (recipientEmails.size === 0) {
      return Response.json({ success: true, sent: 0, reason: 'no recipients' });
    }

    // Title / body
    let title = 'Zoozz';
    if (data.vendor_name || data.vendor_name_hebrew) {
      title = data.vendor_name_hebrew || data.vendor_name;
    }
    const bodyText = (text || '').slice(0, 140);

    let sent = 0;
    let failed = 0;
    for (const email of recipientEmails) {
      try {
        await base44.asServiceRole.functions.invoke('sendPushNotification', {
          userEmail: email,
          title,
          body: bodyText,
          url: '/Chat',
          tag: `chat-${event?.entity_id || data.id || 'msg'}`
        });
        sent++;
      } catch (e) {
        console.error('[pushNotifyOnChatMessage] send failed for', email, e?.message || e);
        failed++;
      }
    }

    return Response.json({ success: true, sent, failed, recipients: [...recipientEmails] });
  } catch (error) {
    console.error('[pushNotifyOnChatMessage] error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}