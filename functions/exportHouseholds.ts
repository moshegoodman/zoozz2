import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Helper to convert array of objects to CSV string
const toCSV = (data) => {
    if (!data || data.length === 0) {
        return "";
    }
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '""'); // Excel-friendly escaping
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        
        const userType = user.user_type?.trim().toLowerCase();
        if (userType !== 'admin' && userType !== 'chief of staff') {
             return new Response(JSON.stringify({ error: 'Access Denied' }), { status: 403, headers: { "Content-Type": "application/json" } });
        }

        const [households, staffLinks, users] = await Promise.all([
            base44.asServiceRole.entities.Household.list("-created_date"),
            base44.asServiceRole.entities.HouseholdStaff.list(),
            base44.asServiceRole.entities.User.list(),
        ]);
        
        const usersMap = new Map(users.map(u => [u.id, u]));

        const dataToExport = households.map(h => {
            const owner = h.owner_user_id ? usersMap.get(h.owner_user_id) : null;
            
            // Find the lead staff member
            const leadStaffLink = staffLinks.find(link => link.household_id === h.id && link.is_lead);
            const leadStaff = leadStaffLink ? usersMap.get(leadStaffLink.staff_user_id) : null;

            return {
                household_id: h.id,
                name: h.name,
                name_hebrew: h.name_hebrew || '',
                household_code: h.household_code,
                owner_name: owner ? owner.full_name : 'N/A',
                owner_email: owner ? owner.email : 'N/A',
                lead_staff_name: leadStaff ? leadStaff.full_name : (h.lead_name || 'N/A'),
                lead_staff_phone: leadStaff ? leadStaff.phone : (h.lead_phone || 'N/A'),
                lead_staff_role: leadStaffLink ? leadStaffLink.job_role : 'N/A',
                address: [h.street, h.building_number, h.household_number, h.neighborhood].filter(Boolean).join(', '),
                entrance_code: h.entrance_code || '',
                instructions: h.instructions || '',
                created_date: h.created_date,
            };
        });

        const csvData = toCSV(dataToExport);
        // Add BOM for proper UTF-8 encoding in Excel - same as OrderManagement
        const csvWithBOM = '\uFEFF' + csvData;

        return new Response(csvWithBOM, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="households_export_${new Date().toISOString().split('T')[0]}.csv"`,
            }
        });

    } catch (error) {
        console.error("Error exporting households:", error);
        return new Response(JSON.stringify({ error: 'Failed to export households: ' + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});