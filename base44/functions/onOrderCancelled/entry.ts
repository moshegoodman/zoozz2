import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Entity automation handler — fires when an Order is updated to status="cancelled".
 * Sends a notification email to:
 *   - The vendor (vendor.contact_emails)
 *   - The user who placed the order (order.user_email)
 *   - The household lead staff (HouseholdStaff with is_lead=true on the order's household)
 *
 * Triggered by the "Order Cancellation Notifier" automation (entity update + condition).
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const event = payload?.event || {};
        let order = payload?.data;
        const orderId = event?.entity_id || order?.id;

        if (!orderId) {
            return Response.json({ success: false, error: 'Missing order id' }, { status: 400 });
        }

        // Re-fetch if the payload was too large or data wasn't included
        if (!order || payload?.payload_too_large) {
            order = await base44.asServiceRole.entities.Order.get(orderId);
        }

        if (!order || order.status !== 'cancelled') {
            return Response.json({ success: true, message: 'Order not in cancelled state — skipping.' });
        }

        // Vendor
        let vendor = null;
        try {
            vendor = await base44.asServiceRole.entities.Vendor.get(order.vendor_id);
        } catch (e) {
            console.warn('Could not fetch vendor:', e?.message);
        }

        const recipients = new Set();

        // 1. Vendor contact emails
        if (vendor?.contact_emails && Array.isArray(vendor.contact_emails)) {
            vendor.contact_emails.forEach(e => e && recipients.add(e));
        }

        // 2. User who placed the order (typically a household staff member)
        if (order.user_email) {
            recipients.add(order.user_email);
        }

        // 3. Household lead
        if (order.household_id) {
            try {
                const leadLinks = await base44.asServiceRole.entities.HouseholdStaff.filter({
                    household_id: order.household_id,
                    is_lead: true,
                });
                if (leadLinks && leadLinks.length > 0) {
                    const leadIds = leadLinks.map(l => l.staff_user_id).filter(Boolean);
                    if (leadIds.length > 0) {
                        const leadUsers = await base44.asServiceRole.entities.User.filter({ id: { $in: leadIds } });
                        leadUsers.forEach(u => u?.email && recipients.add(u.email));
                    }
                }
            } catch (e) {
                console.warn('Could not fetch household lead:', e?.message);
            }
        }

        if (recipients.size === 0) {
            return Response.json({ success: true, message: 'No recipients to notify.' });
        }

        const vendorName = vendor?.name || order.vendor_name || 'Vendor';
        const householdName = order.household_name || '';
        const orderNumber = order.order_number || orderId;

        const subject = `Order ${orderNumber} has been cancelled`;
        const body = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Order Cancelled</h2>
                <p>Order <strong>#${escapeHtml(orderNumber)}</strong> from <strong>${escapeHtml(vendorName)}</strong> has been cancelled.</p>
                ${householdName ? `<p><strong>Household:</strong> ${escapeHtml(householdName)}</p>` : ''}
                ${order.total_amount != null ? `<p><strong>Order total:</strong> ${order.order_currency === 'USD' ? '$' : '₪'}${Number(order.total_amount).toFixed(2)}</p>` : ''}
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    If you have any questions, please contact your team or reply to this email.
                </p>
                <p style="color: #666; font-size: 12px;">— Zoozz</p>
            </div>
        `;

        const results = await Promise.allSettled(
            Array.from(recipients).map(to =>
                base44.asServiceRole.functions.invoke('sendGridEmail', { to, subject, body })
            )
        );

        const failed = results.filter(r => r.status === 'rejected').length;
        return Response.json({
            success: true,
            sent: recipients.size - failed,
            failed,
            recipients: Array.from(recipients),
        });
    } catch (error) {
        console.error('onOrderCancelled error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}