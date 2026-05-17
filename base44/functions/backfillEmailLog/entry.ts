import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * One-off backfill: fetch the past N days of email activity from SendGrid
 * and create EmailLog records for any messages not already logged.
 *
 * Admin-only. Requires SendGrid Email Activity API access on your plan.
 *
 * Payload: { days?: number (default 7) }
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { days = 7 } = (await req.json().catch(() => ({})));

        const apiKey = Deno.env.get('SENDGRID_API_KEY');
        if (!apiKey) {
            return Response.json({ success: false, error: 'SENDGRID_API_KEY not configured' }, { status: 500 });
        }

        const sinceTs = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
        const query = encodeURIComponent(`last_event_time BETWEEN TIMESTAMP "${sinceTs}" AND TIMESTAMP "${Math.floor(Date.now()/1000)}"`);

        // SendGrid Email Activity API - paginated
        // Docs: https://docs.sendgrid.com/api-reference/e-mail-activity/filter-all-messages
        const messages = [];
        let url = `https://api.sendgrid.com/v3/messages?limit=1000&query=${query}`;

        const resp = await fetch(url, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!resp.ok) {
            const errText = await resp.text();
            return Response.json({
                success: false,
                error: `SendGrid API error: ${resp.status}`,
                details: errText,
                hint: resp.status === 401 || resp.status === 403
                    ? 'Your SendGrid plan may not include Email Activity API access (Pro/Premier plans, or the Email Activity add-on).'
                    : undefined,
            }, { status: 500 });
        }

        const data = await resp.json();
        if (Array.isArray(data?.messages)) {
            messages.push(...data.messages);
        }

        // Get existing logs in the same window to avoid duplicates
        const sinceISO = new Date(sinceTs * 1000).toISOString();
        const existing = await base44.asServiceRole.entities.EmailLog.filter({
            created_date: { $gte: sinceISO }
        }, '-created_date', 5000);

        const existingKeys = new Set(
            existing.map(l => `${(l.to || '').toLowerCase()}|${l.subject || ''}|${l.created_date?.slice(0, 16)}`)
        );

        let created = 0;
        const skipped = [];

        for (const m of messages) {
            const to = m.to_email || '';
            const subject = m.subject || '';
            const status = (m.status === 'delivered' || m.status === 'processed') ? 'sent' : (m.status === 'not_delivered' ? 'failed' : 'sent');
            const ts = m.last_event_time ? new Date(m.last_event_time) : new Date();
            const key = `${to.toLowerCase()}|${subject}|${ts.toISOString().slice(0, 16)}`;

            if (existingKeys.has(key)) {
                skipped.push(key);
                continue;
            }

            try {
                await base44.asServiceRole.entities.EmailLog.create({
                    to,
                    from_email: m.from_email || Deno.env.get('SENDGRID_FROM_EMAIL') || '',
                    subject,
                    body_preview: '(backfilled from SendGrid — body not available)',
                    has_attachments: false,
                    attachment_names: [],
                    status,
                    error_message: status === 'failed' ? (m.status || '') : '',
                    context: 'backfill_sendgrid',
                    order_id: '',
                    order_number: '',
                });
                created++;
                existingKeys.add(key);
            } catch (e) {
                console.error('Failed to insert EmailLog:', e.message);
            }
        }

        return Response.json({
            success: true,
            days,
            fetched: messages.length,
            created,
            skipped: skipped.length,
        });
    } catch (error) {
        console.error('backfillEmailLog error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});