import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    try {
        const vendors = await base44.asServiceRole.entities.Vendor.list();
        
        let migrated = 0;
        let skipped = 0;
        let errors = [];

        for (const vendor of vendors) {
            if (!vendor.detailed_schedule) {
                skipped++;
                continue;
            }

            try {
                // Check if a VendorSchedule record already exists for this vendor
                const existing = await base44.asServiceRole.entities.VendorSchedule.filter({ vendor_id: vendor.id });
                
                if (existing && existing.length > 0) {
                    console.log(`VendorSchedule already exists for vendor ${vendor.name}, skipping.`);
                    skipped++;
                    continue;
                }

                // Parse the schedule if it's a string
                let schedule = vendor.detailed_schedule;
                if (typeof schedule === 'string') {
                    schedule = JSON.parse(schedule);
                }

                await base44.asServiceRole.entities.VendorSchedule.create({
                    vendor_id: vendor.id,
                    detailed_schedule: schedule
                });

                console.log(`Migrated schedule for vendor: ${vendor.name}`);
                migrated++;
            } catch (err) {
                console.error(`Error migrating vendor ${vendor.name}:`, err.message);
                errors.push({ vendor: vendor.name, error: err.message });
            }
        }

        return Response.json({
            success: true,
            total_vendors: vendors.length,
            migrated,
            skipped,
            errors
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});