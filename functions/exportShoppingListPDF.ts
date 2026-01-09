import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@2.30.0";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { shoppingList, vendorName, language } = await req.json();

        const isHebrew = language === 'Hebrew';
        const dir = isHebrew ? 'rtl' : 'ltr';
        const fontFamily = isHebrew ? "'Rubik', sans-serif" : "'Arial', sans-serif";

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
            <h1>${isHebrew ? 'רשימת קניות' : 'Shopping List'} - ${vendorName}</h1>
            <p>${isHebrew ? 'תאריך' : 'Date'}: ${format(new Date(), 'yyyy-MM-dd')}</p>
            <table>
                <thead>
                    <tr>
                        <th>${isHebrew ? 'מוצר' : 'Product'}</th>
                        <th>${isHebrew ? 'כמות כוללת' : 'Total Quantity'}</th>
                        <th>${isHebrew ? 'יחידה' : 'Unit'}</th>
                        <th>${isHebrew ? 'מספר הזמנות' : '# of Orders'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${(shoppingList || []).map(item => `
                        <tr>
                            <td>${isHebrew && item.name_hebrew ? item.name_hebrew : item.name}</td>
                            <td>${item.quantity}</td>
                            <td>${item.unit}</td>
                            <td>${item.ordersCount}</td>
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
        console.error("Error exporting shopping list HTML:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});