import { generatePdf } from './utils/pdfGenerator.js';
import { format } from "npm:date-fns";

Deno.serve(async (req) => {
    try {
        const { orders } = await req.json();

        const columns = [
            { header: { en: 'Order #' }, dataKey: 'order_number' },
            { header: { en: 'Date' }, dataKey: 'created_date' },
            { header: { en: 'Customer' }, dataKey: 'display_name' },
            { header: { en: 'Address' }, dataKey: 'delivery_address' },
            { header: { en: 'Total' }, dataKey: 'total_amount' },
            { header: { en: 'Picker' }, dataKey: 'picker_name' },
            { header: { en: 'Status' }, dataKey: 'status' },
        ];
        
        const data = orders.map(order => ({
            ...order,
            created_date: format(new Date(order.created_date), "yyyy-MM-dd HH:mm"),
            total_amount: `₪${(order.total_amount || 0).toFixed(2)}`,
            picker_name: order.picker_name || 'N/A',
        }));

        const meta = {
            "Report Date": format(new Date(), 'yyyy-MM-dd'),
        };

        return generatePdf({
            title: 'Vendor Orders Report',
            meta,
            columns,
            data,
            summary: null,
            language: 'en', // This is an internal report, so keeping it in English
            translations: {},
            fileName: `Vendor-Orders-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        });

    } catch (error) {
        console.error('Vendor Orders PDF Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});