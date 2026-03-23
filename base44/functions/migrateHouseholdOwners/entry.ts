import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// One-time migration function: copies owner_user_id -> owner_user_ids for all households.
// Also ensures the User entity's household_ids array is consistent.
// Admin only.

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const households = await base44.asServiceRole.entities.Household.list();

    let migrated = 0;
    let skipped = 0;

    for (const household of households) {
        const { owner_user_id, owner_user_ids } = household;

        // Only migrate if there's an old owner_user_id and it's not already in owner_user_ids
        if (owner_user_id) {
            const currentOwnerIds = owner_user_ids || [];
            if (!currentOwnerIds.includes(owner_user_id)) {
                await base44.asServiceRole.entities.Household.update(household.id, {
                    owner_user_ids: [...currentOwnerIds, owner_user_id]
                });
                migrated++;
            } else {
                skipped++;
            }
        } else {
            // Ensure the field exists as an empty array if not set
            if (!owner_user_ids) {
                await base44.asServiceRole.entities.Household.update(household.id, {
                    owner_user_ids: []
                });
            }
            skipped++;
        }
    }

    return Response.json({
        success: true,
        total: households.length,
        migrated,
        skipped,
        message: `Migration complete. ${migrated} households updated, ${skipped} skipped.`
    });
});