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
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userEmail, title, body, url, tag } = await req.json();

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // Get subscriptions for user(s)
    let subscriptions;
    if (userEmail) {
      subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: userEmail.toLowerCase().trim() });
    } else {
      subscriptions = await base44.asServiceRole.entities.PushSubscription.list();
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No subscriptions found' });
    }

    const payload = { title, body, data: { url: url || '/' }, tag: tag || 'zoozz' };

    let sent = 0;
    let failed = 0;
    const failedEndpoints = [];

    for (const sub of subscriptions) {
      try {
        const res = await sendWebPush(
          { endpoint: sub.data?.endpoint || sub.endpoint, keys: { p256dh: sub.data?.p256dh || sub.p256dh, auth: sub.data?.auth || sub.auth } },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          'mailto:support@zoozz.com'
        );

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          // Subscription expired, remove it
          await base44.asServiceRole.entities.PushSubscription.delete(sub.id || sub.data?.id);
          failed++;
        } else {
          failed++;
          failedEndpoints.push({ endpoint: sub.endpoint, status: res.status });
        }
      } catch (err) {
        failed++;
        console.error('Push send error:', err.message);
      }
    }

    return Response.json({ success: true, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});