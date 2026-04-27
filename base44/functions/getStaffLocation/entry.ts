/**
 * getStaffLocation — Manager queries a staff member's location history.
 * ABAC enforcement:
 *   1. Requesting user must be admin or chief of staff.
 *   2. Audit log is written for every successful retrieval.
 *
 * Params: { target_user_id, from_ts?, to_ts?, event_type?, limit? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const reqClone = req.clone();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ABAC: only admin / chief of staff may query other users' locations
    const allowedRoles = ['admin', 'chief of staff'];
    const userType = (user.user_type || '').trim().toLowerCase();
    if (!allowedRoles.includes(userType) && user.role !== 'admin') {
      // Write a failed access attempt for auditing
      await base44.asServiceRole.entities.AccessLog.create({
        requesting_user_id: user.id,
        requesting_user_email: user.email,
        target_user_id: 'N/A',
        action: 'location_read',
        filters_applied: {},
        records_returned: 0,
        ip_address: req.headers.get('x-forwarded-for') || '',
        user_agent: req.headers.get('user-agent') || '',
        status_metadata: { denied: true, reason: 'insufficient_role' },
      }).catch(() => {});

      return Response.json({ error: 'Forbidden: manager role required' }, { status: 403 });
    }

    const { target_user_id, from_ts, to_ts, event_type, limit } = await reqClone.json();

    if (!target_user_id) {
      return Response.json({ error: 'target_user_id is required' }, { status: 400 });
    }

    // Fetch all logs for target user (service role bypasses RLS)
    let logs = await base44.asServiceRole.entities.LocationLog.filter(
      { user_id: target_user_id },
      '-timestamp',
      Math.min(limit || 500, 1000)
    );

    // Apply optional time-range filter in-memory
    if (from_ts) logs = logs.filter(l => new Date(l.timestamp) >= new Date(from_ts));
    if (to_ts)   logs = logs.filter(l => new Date(l.timestamp) <= new Date(to_ts));
    if (event_type) logs = logs.filter(l => l.event_type === event_type);

    // AUDIT LOG — record every successful retrieval
    await base44.asServiceRole.entities.AccessLog.create({
      requesting_user_id: user.id,
      requesting_user_email: user.email,
      target_user_id,
      action: 'location_read',
      filters_applied: { from_ts, to_ts, event_type, limit },
      records_returned: logs.length,
      ip_address: req.headers.get('x-forwarded-for') || '',
      user_agent: req.headers.get('user-agent') || '',
    }).catch(err => console.error('AccessLog write failed:', err.message));

    return Response.json({ success: true, logs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});