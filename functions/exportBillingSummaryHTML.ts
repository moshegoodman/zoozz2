import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { summary, vendorName, month, language } = await req.json();
        
        const t = (key, lang) => {
            const translations = {
                he: {
                    billingReport: "דוח חיובים",
                    summary: "סיכום",
                    for: "עבור",
                    household: "משק בית",
                    totalOrders: "סה\"כ הזמנות",
                    ordersWithReturns: "הזמנות עם החזרות",
                    totalPurchases: "סה\"כ רכישות",
                    totalReturns: "סה\"כ החזרות",
                    netPurchases: "רכישות נטו",
                    amountPaid: "שולם",
                    amountDue: "יתרה לתשלום",
                },
                en: {
                    billingReport: "Billing Report",
                    summary: "Summary",
                    for: "for",
                    household: "Household",
                    totalOrders: "Total Orders",
                    ordersWithReturns: "Orders with Returns",
                    totalPurchases: "Total Purchases",
                    totalReturns: "Total Returns",
                    netPurchases: "Net Purchases",
                    amountPaid: "Amount Paid",
                    amountDue: "Amount Due",
                }
            };
            return translations[lang]?.[key] || key;
        };

        const lang = language === 'Hebrew' ? 'he' : 'en';
        const isRTL = lang === 'he';
        
        const itemsHTML = summary.map(item => `
            <tr>
                <td>${item.display_name}</td>
                <td class="center">${item.totalOrders}</td>
                <td class="center ${item.ordersWithReturns > 0 ? 'orange-text' : ''}">${item.ordersWithReturns || 0}</td>
                <td class="${isRTL ? 'left' : 'right'}">₪${item.totalPurchases?.toFixed(2)}</td>
                <td class="${isRTL ? 'left' : 'right'} ${item.totalReturns > 0 ? 'orange-text' : ''}">
                    ${item.totalReturns > 0 ? `-₪${item.totalReturns.toFixed(2)}` : '₪0.00'}
                </td>
                <td class="${isRTL ? 'left' : 'right'} bold">₪${item.netPurchases?.toFixed(2)}</td>
                <td class="${isRTL ? 'left' : 'right'}">₪${item.totalPaid?.toFixed(2)}</td>
                <td class="${isRTL ? 'left' : 'right'}">₪${item.totalUnpaid?.toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
            <head>
                <meta charset="UTF-8">
                <title>${t('billingReport', lang)}</title>
                 <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
                    .container { max-width: 1000px; margin: 20px auto; padding: 20px; }
                    h1 { color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 10px; border: 1px solid #ddd; text-align: ${isRTL ? 'right' : 'left'}; }
                    thead th { background-color: #f2f2f2; }
                    .right { text-align: right; }
                    .left { text-align: left; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .orange-text { color: #f97316; font-weight: 600; }
                </style>
            </head>
            <body>
                 <div class="container">
                    <h1>${t('billingReport', lang)}: ${t('summary', lang)}</h1>
                    <h2>${vendorName} - ${t('for', lang)} ${month}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>${t('household', lang)}</th>
                                <th class="center">${t('totalOrders', lang)}</th>
                                <th class="center">${t('ordersWithReturns', lang)}</th>
                                <th class="${isRTL ? 'left' : 'right'}">${t('totalPurchases', lang)}</th>
                                <th class="${isRTL ? 'left' : 'right'}">${t('totalReturns', lang)}</th>
                                <th class="${isRTL ? 'left' : 'right'}">${t('netPurchases', lang)}</th>
                                <th class="${isRTL ? 'left' : 'right'}">${t('amountPaid', lang)}</th>
                                <th class="${isRTL ? 'left' : 'right'}">${t('amountDue', lang)}</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHTML}</tbody>
                    </table>
                </div>
            </body>
            </html>
        `;

        return new Response(htmlContent, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
        console.error("Error in exportBillingSummaryHTML:", e);
        return Response.json({ error: e.message }, { status: 500 });
    }
});