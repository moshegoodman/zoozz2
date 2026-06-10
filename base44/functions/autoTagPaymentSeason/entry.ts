import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Entity automation handler: when a KCSPayment is created OR updated without a
// `season`, auto-tag it with the active season from AppSettings. This is the
// server-side safety net so untagged payments can NEVER slip through, even if
// a frontend has cached old JS.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, payload_too_large } = body;

    if (!event?.entity_id) {
      return Response.json({ ok: true, skipped: 'no entity_id' });
    }

    // If payload too large, fetch the record
    let record = data;
    if (payload_too_large || !record) {
      record = await base44.asServiceRole.entities.KCSPayment.get(event.entity_id);
    }

    if (!record) {
      return Response.json({ ok: true, skipped: 'record not found' });
    }

    // Already tagged — nothing to do
    if (record.season && record.season.trim()) {
      return Response.json({ ok: true, skipped: 'already tagged', season: record.season });
    }

    // Look up active season from AppSettings
    const settings = await base44.asServiceRole.entities.AppSettings.list();
    const activeSeason = settings?.[0]?.activeSeason || '';

    if (!activeSeason) {
      console.warn('No activeSeason in AppSettings — cannot auto-tag payment', event.entity_id);
      return Response.json({ ok: true, skipped: 'no active season set' });
    }

    await base44.asServiceRole.entities.KCSPayment.update(event.entity_id, { season: activeSeason });
    console.log(`Auto-tagged KCSPayment ${event.entity_id} with season=${activeSeason}`);
    return Response.json({ ok: true, tagged: activeSeason });
  } catch (error) {
    console.error('autoTagPaymentSeason error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});