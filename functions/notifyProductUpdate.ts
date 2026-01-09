import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    // This function can only be called by an authenticated user
    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { productId, vendorId, changedData, skipBulkCheck = false } = await req.json();

    if (!productId || !vendorId || !changedData) {
        return new Response(JSON.stringify({ error: 'Missing required parameters: productId, vendorId, and changedData.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const currentUser = await base44.auth.me();
        
        // Don't send notifications for admin bulk operations (unless explicitly requested)
        if ((currentUser.user_type === 'admin' || currentUser.user_type === 'chief of staff') && !skipBulkCheck) {
            console.log('Skipping admin notification for admin-initiated product update to avoid bulk email spam.');
            return new Response(JSON.stringify({ success: true, message: 'Notification skipped for admin operation.' }), { status: 200 });
        }

        const sdk = base44.asServiceRole;

        const [product, vendor, admins] = await Promise.all([
            sdk.entities.Product.get(productId),
            sdk.entities.Vendor.get(vendorId),
            sdk.entities.User.filter({ user_type: 'admin' })
        ]);

        if (!product || !vendor) {
             console.warn("Could not find product or vendor for notification.", { productId, vendorId });
             return new Response(JSON.stringify({ success: true, message: 'Product or Vendor not found.' }), { status: 200 });
        }
        
        if (admins.length === 0) {
            console.log('No admin users found to notify.');
            return new Response(JSON.stringify({ success: true, message: 'No admin users to notify.' }), { status: 200 });
        }
        
        // Format the changed data for HTML email
        const changesListHTML = Object.entries(changedData)
            .map(([key, value]) => `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`)
            .join('');

        const emailSubject = `Product Update: "${product.name}" by ${vendor.name}`;
        
        const emailBody = `
            <h3>Product Update Notification</h3>
            <p>Hello Admin,</p>
            <p>A product has been updated by a vendor. Please review the changes.</p>
            
            <hr>
            <h4>Vendor Details:</h4>
            <ul>
                <li><strong>Name:</strong> ${vendor.name}</li>
                <li><strong>ID:</strong> ${vendor.id}</li>
            </ul>
            
            <h4>Product Details:</h4>
            <ul>
                <li><strong>Name:</strong> ${product.name}</li>
                <li><strong>SKU:</strong> ${product.sku || 'N/A'}</li>
                <li><strong>ID:</strong> ${productId}</li>
            </ul>
            
            <h4>Fields Changed:</h4>
            <ul>
                ${changesListHTML}
            </ul>
            
            <hr>
            <p>You can view this product in the admin dashboard.</p>
            
            <p>Thank you,<br>
            Zoozz System</p>
        `;

        // Send an email to each admin
        const emailPromises = admins.map(admin => {
            return sdk.integrations.Core.SendEmail({
                to: admin.email,
                subject: emailSubject,
                body: emailBody,
                from_name: "Zoozz System"
            });
        });

        await Promise.all(emailPromises);

        return new Response(JSON.stringify({ success: true, message: `Successfully notified ${admins.length} admins.` }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error sending product update notification:", error);
        return new Response(JSON.stringify({ error: 'Failed to process notification.', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});