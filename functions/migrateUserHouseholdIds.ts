import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Migration: For each Household with owner_user_ids, ensures each owner User has:
//   - household_ids: array containing this household's id
//   - default_household_id: set to the household matching activeSeason (if found), else most recent
// Admin only. Safe to run multiple times.

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [households, appSettings] = await Promise.all([
        base44.asServiceRole.entities.Household.list(),
        base44.asServiceRole.entities.AppSettings.list()
    ]);

    const activeSeason = appSettings?.[0]?.activeSeason || null;

    // Build a map: userId -> array of households they own
    const userHouseholdsMap = {};
    for (const household of households) {
        const ownerIds = household.owner_user_ids || [];
        for (const ownerId of ownerIds) {
            if (!userHouseholdsMap[ownerId]) userHouseholdsMap[ownerId] = [];
            userHouseholdsMap[ownerId].push(household);
        }
    }

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const [userId, ownedHouseholds] of Object.entries(userHouseholdsMap)) {
        const householdIds = ownedHouseholds.map(h => h.id);

        // Pick default: prefer household matching activeSeason, else last in list
        const activeHousehold = activeSeason
            ? ownedHouseholds.find(h => h.season === activeSeason)
            : null;
        const defaultHouseholdId = (activeHousehold || ownedHouseholds[ownedHouseholds.length - 1]).id;

        try {
            await base44.asServiceRole.entities.User.update(userId, {
                household_ids: householdIds,
                default_household_id: defaultHouseholdId
            });
            updated++;
        } catch (err) {
            errors.push({ userId, error: err.message });
        }
    }

    // Also clear household_ids for users who are no longer owners of any household
    // (i.e., users with household_ids set but not present in userHouseholdsMap)
    const allUsers = await base44.asServiceRole.entities.User.list();
    for (const u of allUsers) {
        if (!userHouseholdsMap[u.id] && (u.household_ids?.length > 0 || u.default_household_id)) {
            // Only clear if they are a household owner type
            if (u.user_type === 'household owner') {
                try {
                    await base44.asServiceRole.entities.User.update(u.id, {
                        household_ids: [],
                        default_household_id: null
                    });
                    skipped++; // reusing skipped as "cleared"
                } catch (err) {
                    errors.push({ userId: u.id, error: err.message });
                }
            }
        }
    }

    return Response.json({
        success: true,
        updated,
        cleared: skipped,
        errors,
        activeSeason,
        message: `Migration complete. ${updated} users updated, ${skipped} users cleared.`
    });
});