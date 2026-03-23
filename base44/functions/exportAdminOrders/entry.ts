import { createClient } from 'npm:@base44/sdk@0.1.0';

const base44 = createClient({
    appId: Deno.env.get('BASE44_APP_ID'),
});

Deno.serve(async (req) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        base44.auth.setToken(token);

        const { orders } = await req.json();

        // Import jsPDF dynamically to avoid timeout issues
        const { jsPDF } = await import('npm:jspdf@2.5.1');
        
        const doc = new jsPDF();
        
        // Title
        doc.setFontSize(20);
        doc.setTextColor(51, 65, 85);
        doc.text('Admin Orders Report', 20, 20);
        
        // Date
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 30);
        
        // Headers
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.setFont(undefined, 'bold');
        doc.text('Order ID', 15, 45);
        doc.text('Date', 40, 45);
        doc.text('Vendor', 65, 45);
        doc.text('Customer', 90, 45);
        doc.text('Household', 120, 45);
        doc.text('Total', 150, 45);
        doc.text('Status', 170, 45);
        doc.text('Picker', 190, 45);

        // Content
        doc.setFont(undefined, 'normal');
        doc.setTextColor(55, 65, 81);
        
        let y = 55;
        
        // Process orders in batches to avoid timeout
        const batchSize = 50;
        for (let i = 0; i < orders.length; i += batchSize) {
            const batch = orders.slice(i, i + batchSize);
            
            batch.forEach((order) => {
                if (y > 280) { // Add new page if near bottom
                    doc.addPage();
                    y = 20;
                    
                    // Re-add headers on new page
                    doc.setFontSize(8);
                    doc.setTextColor(51, 65, 85);
                    doc.setFont(undefined, 'bold');
                    doc.text('Order ID', 15, y);
                    doc.text('Date', 40, y);
                    doc.text('Vendor', 65, y);
                    doc.text('Customer', 90, y);
                    doc.text('Household', 120, y);
                    doc.text('Total', 150, y);
                    doc.text('Status', 170, y);
                    doc.text('Picker', 190, y);
                    
                    y += 10;
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(55, 65, 81);
                }
                
                doc.setFontSize(7);
                doc.text((order.order_number || '').substring(0, 15), 15, y);
                doc.text(new Date(order.created_date).toLocaleDateString(), 40, y);
                doc.text((order.vendor_name || '').substring(0, 12), 65, y);
                doc.text((order.user_email || '').substring(0, 15), 90, y);
                doc.text((order.household_name || '').substring(0, 15), 120, y);
                doc.text(`₪${(order.total_amount || 0).toFixed(2)}`, 150, y);
                doc.text((order.status || '').substring(0, 10), 170, y);
                doc.text((order.picker_name || 'N/A').substring(0, 10), 190, y);
                
                y += 8;
            });
        }

        const pdfBytes = doc.output('arraybuffer');

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename=admin-orders.pdf'
            }
        });
    } catch (error) {
        console.error('PDF Export Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});