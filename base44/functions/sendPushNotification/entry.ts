import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Minimal VAPID JWT + web-push implementation using Web Crypto API
async function generateVapidJWT(audience, subject, publicKey, privateKeyB64u) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const b64u = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const signingInput = `${b64u(header)}.${b64u(payload)}`;

  // Import private key
  const privateKeyBytes = base64urlToBytes(privateKeyB64u);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    toPKCS8(privateKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64u = bytesToBase64url(new Uint8Array(signature));
  return `${signingInput}.${sigB64u}`;
}

function base64urlToBytes(b64u) {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64u.length + (4 - b64u.length % 4) % 4, '='
  );
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function bytesToBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toPKCS8(rawPrivateKey) {
  // Wrap raw 32-byte EC private key in PKCS#8 DER for P-256
  const prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20
  ]);
  const result = new Uint8Array(prefix.length + rawPrivateKey.length);
  result.set(prefix);
  result.set(rawPrivateKey, prefix.length);
  return result.buffer;
}

async function sendWebPush(subscription, payload, vapidPublicKey, vapidPrivateKey, subject) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await generateVapidJWT(audience, subject, vapidPublicKey, vapidPrivateKey);

  const body = JSON.stringify(payload);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'TTL': '86400',
    },
    body,
  });

  return response;
}

Deno.serve(async (req) => {
  console.log('[START] sendPushNotification called, method:', req.method);
  try {
    // Clone request so both body reading and SDK init can work
    const reqClone = req.clone();
    const base44 = createClientFromRequest(req);
    console.log('[START] SDK initialized');

    const reqBody = await reqClone.json();
    const { userEmail, title, body: msgBody, url, tag } = reqBody;
    console.log('[START] Body parsed, userEmail:', userEmail);

    // Auth check — require admin
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // Get all subscriptions as service role (bypasses RLS), filter in memory
    const allSubscriptions = await base44.asServiceRole.entities.PushSubscription.list('-created_date', 10000);
    console.log('[DEBUG] Total subscriptions fetched:', allSubscriptions?.length);

    let subscriptions;
    if (userEmail) {
      const emailQuery = userEmail.toLowerCase().trim();
      subscriptions = allSubscriptions.filter(s => {
        const email = (s.data?.user_email || s.user_email || '').toLowerCase();
        return email === emailQuery;
      });
      console.log('[DEBUG] Filtered for', emailQuery, ':', subscriptions.length);
    } else {
      subscriptions = allSubscriptions;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No subscriptions found' });
    }

    const pushPayload = { title, body: msgBody, data: { url: url || '/' }, tag: tag || 'zoozz' };

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const endpoint = sub.data?.endpoint || sub.endpoint;
      const p256dh = sub.data?.p256dh || sub.p256dh;
      const auth = sub.data?.auth || sub.auth;
      const subId = sub.id;

      try {
        const res = await sendWebPush(
          { endpoint, keys: { p256dh, auth } },
          pushPayload,
          vapidPublicKey,
          vapidPrivateKey,
          'mailto:support@zoozz.com'
        );
        console.log('[DEBUG] Push result for', endpoint?.slice(0, 50), ':', res.status);

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          await base44.asServiceRole.entities.PushSubscription.delete(subId);
          failed++;
        } else {
          failed++;
          console.error('Push failed with status:', res.status);
        }
      } catch (err) {
        failed++;
        console.error('Push send error:', err.message);
      }
    }

    return Response.json({ success: true, sent, failed });
  } catch (error) {
    console.error('Function error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});