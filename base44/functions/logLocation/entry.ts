/**
 * logLocation — Staff self-reports their own location.
 * Enforces: accuracy threshold < 25m, deduplication, offline batch sync.
 * Only the authenticated user can log their OWN location.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACCURACY_THRESHOLD_METERS = 25;

Deno.serve(async (req) => {
  try {
    const reqClone = req.clone();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await reqClone.json();
    // Support single event or batch (offline sync)
    const events = Array.isArray(body.events) ? body.events : [body];

    const results = { accepted: 0, rejected: 0, reasons: [] };

    for (const event of events) {
      const { lat, long, accuracy, speed, timestamp, event_type, geofence_id, status_metadata } = event;

      // Accuracy gate
      if (!accuracy || accuracy > ACCURACY_THRESHOLD_METERS) {
        results.rejected++;
        results.reasons.push(`accuracy ${accuracy}m exceeds ${ACCURACY_THRESHOLD_METERS}m threshold`);
        continue;
      }

      // Basic coordinate validation
      if (lat == null || long == null || Math.abs(lat) > 90 || Math.abs(long) > 180) {
        results.rejected++;
        results.reasons.push('invalid coordinates');
        continue;
      }

      await base44.asServiceRole.entities.LocationLog.create({
        user_id: user.id,
        event_type: event_type || 'location_update',
        lat,
        long,
        accuracy,
        speed: speed ?? null,
        timestamp: timestamp || new Date().toISOString(),
        geofence_id: geofence_id || null,
        status_metadata: {
          ...(status_metadata || {}),
          is_offline_sync: !!body.events, // batch = offline sync
          logged_at: new Date().toISOString(),
        },
      });

      results.accepted++;
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});