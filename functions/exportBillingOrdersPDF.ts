import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { orders, household, language, startDate, endDate } = await req.json();
        
        const isHebrew = language === 'Hebrew';
        const dir = isHebrew ? 'rtl' : 'ltr';
        const fontFamily = isHebrew ? "'Rubik', sans-serif" : "'Inter', sans-serif";

        const htmlContent = `
        <!DOCTYPE html>
        <html dir="${dir}">
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: ${fontFamily};
                    direction: ${dir};
                }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: ${isHebrew ? 'right' : 'left'}; }
                th { background-color: #f2f2f2; }
                h1 { text-align: center; }
                
                /* CSS for PDF pagination */
                @media print, screen {
                    thead { display: table-header-group; }
                    tr { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <h1>${isHebrew ? 'דו"ח הזמנות לחיוב' : 'Billing Orders Report'}</h1>
            <p>${isHebrew ? 'משק בית' : 'Household'}: ${household ? (isHebrew ? household.name_hebrew : household.name) : 'N/A'}</p>
            <p>${isHebrew ? 'תקופה' : 'Period'}: ${startDate} - ${endDate}</p>
            <table>
                <thead>
                    <tr>
                        <th>${isHebrew ? 'מספר הזמנה' : 'Order #'}</th>
                        <th>${isHebrew ? 'תאריך' : 'Date'}</th>
                        <th>${isHebrew ? 'ספק' : 'Vendor'}</th>
                        <th>${isHebrew ? 'סכום' : 'Amount'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${(orders || []).map(order => `
                        <tr>
                            <td>${order.order_number}</td>
                            <td>${new Date(order.created_date).toLocaleDateString()}</td>
                            <td>${order.vendor_name}</td>
                            <td>₪${(order.total_amount || 0).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
        `;

        return new Response(htmlContent, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});