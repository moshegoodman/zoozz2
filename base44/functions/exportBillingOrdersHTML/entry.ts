import { createClient } from 'npm:@base44/sdk@0.1.0';

Deno.serve(async (req) => {
    try {
        const { orders, vendorName, month, language, userType = 'customer', showAddedToBill = false } = await req.json();

        const t = (key, lang) => {
            const translations = {
                he: {
                    billingReport: "דוח חיובים",
                    orders: "הזמנות",
                    for: "עבור",
                    orderNum: "הזמנה",
                    date: "תאריך",
                    customer: "לקוח",
                    total: "סה\"כ",
                    status: "סטטוס",
                    paid: "שולם",
                    orderId: "מספר הזמנה",
                    vendor: "ספק",
                    paidBy: "שולם על ידי",
                    addedToBill: "נוסף לחשבון",
                    yes: "כן",
                    no: "לא",
                    pending: "ממתין",
                    completed: "הושלם",
                    cancelled: "בוטל",
                    refunded: "הוחזר",
                    'SKU': 'מק"ט'
                },
                en: {
                    billingReport: "Billing Report",
                    orders: "Orders",
                    for: "for",
                    orderNum: "Order",
                    date: "Date",
                    customer: "Customer",
                    total: "Total",
                    status: "Status",
                    paid: "Paid",
                    orderId: "Order ID",
                    vendor: "Vendor",
                    paidBy: "Paid By",
                    addedToBill: "Added to Bill",
                    yes: "Yes",
                    no: "No",
                    pending: "Pending",
                    completed: "Completed",
                    cancelled: "Cancelled",
                    refunded: "Refunded",
                    'SKU': 'SKU'
                }
            };
            return translations[lang] && translations[lang][key] ? translations[lang][key] : key;
        };

        const lang = language === 'Hebrew' ? 'he' : 'en';
        const isRTL = lang === 'he';
        const rightAlign = isRTL ? 'left' : 'right';

        const formatDate = (dateString, lang) => {
            if (!dateString) return 'N/A';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            } catch (e) {
                console.warn('Invalid date string:', dateString, e);
                return dateString;
            }
        };

        const getStatusLabel = (status, lang) => {
            const normalizedStatus = status && status.toLowerCase();
            switch (normalizedStatus) {
                case 'pending':
                    return t('pending', lang);
                case 'completed':
                    return t('completed', lang);
                case 'cancelled':
                    return t('cancelled', lang);
                case 'refunded':
                    return t('refunded', lang);
                default:
                    return status || 'N/A';
            }
        };

        const ordersHTML = orders.map((order, index) => {
            const sku = 'N/A';
            return `
                <tr>
                    <td class="center">${index + 1}</td>
                    <td>${sku}</td>
                    <td class="center font-medium text-blue-600">${order.order_number || 'N/A'}</td>
                    <td class="center">${formatDate(order.created_date, lang)}</td>
                    ${userType === 'admin' ? `<td>${order.vendor_name || 'N/A'}</td>` : ''}
                    <td>${order.customer_name || 'N/A'}</td>
                    <td class="${rightAlign} font-semibold text-green-600">₪${(order.total_amount || 0).toFixed(2)}</td>
                    ${userType === 'admin' ? `<td class="center"><span class="status-badge status-${order.status && order.status.toLowerCase()}">${getStatusLabel(order.status, lang)}</span></td>` : ''}
                    <td class="center"><span class="paid-badge ${order.is_paid ? 'paid' : 'unpaid'}">${order.is_paid ? t('yes', lang) : t('no', lang)}</span></td>
                    ${userType === 'admin' ? `<td class="center">${order.paid_by || 'Customer'}</td>` : ''}
                    ${userType === 'admin' && showAddedToBill ? `<td class="center"><span class="paid-badge ${order.added_to_bill ? 'paid' : 'unpaid'}">${order.added_to_bill ? t('yes', lang) : t('no', lang)}</span></td>` : ''}
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
            <head>
                <meta charset="UTF-8">
                <title>${t('billingReport', lang)}</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                        margin: 0;
                        padding: 0;
                        color: #333;
                        font-size: 14px;
                    }
                    .container { 
                        max-width: 800px; 
                        margin: 20px auto; 
                        padding: 20px; 
                        border: 1px solid #eee;
                        box-shadow: 0 0 10px rgba(0,0,0,0.05);
                        border-radius: 8px;
                    }
                    h1 { 
                        color: #333; 
                        text-align: center;
                        margin-bottom: 10px;
                        font-size: 24px;
                    }
                    h2 {
                        color: #555;
                        text-align: center;
                        margin-top: 0;
                        margin-bottom: 25px;
                        font-size: 18px;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 20px; 
                        table-layout: auto;
                    }
                    th, td { 
                        padding: 10px; 
                        border: 1px solid #ddd; 
                        text-align: ${isRTL ? 'right' : 'left'}; 
                        word-break: break-word;
                    }
                    thead th { 
                        background-color: #f2f2f2; 
                        font-weight: bold;
                        color: #444;
                        white-space: nowrap;
                    }
                    tbody tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .right { text-align: right; }
                    .left { text-align: left; }
                    .center { text-align: center; }
                    .font-medium { font-weight: 500; }
                    .font-semibold { font-weight: 600; }
                    .text-blue-600 { color: #2563eb; }
                    .text-green-600 { color: #16a34a; }
                    .status-badge, .paid-badge {
                        display: inline-block;
                        padding: 4px 8px;
                        border-radius: 9999px;
                        font-size: 0.85em;
                        font-weight: 600;
                        white-space: nowrap;
                    }
                    .status-badge.status-pending { background-color: #fef3c7; color: #b45309; }
                    .status-badge.status-completed { background-color: #d1fae5; color: #065f46; }
                    .status-badge.status-cancelled { background-color: #fee2e2; color: #dc2626; }
                    .status-badge.status-refunded { background-color: #e0f2fe; color: #0284c7; }
                    .status-badge { background-color: #e5e7eb; color: #4b5563; }
                    .paid-badge.paid { background-color: #d1fae5; color: #065f46; }
                    .paid-badge.unpaid { background-color: #fee2e2; color: #dc2626; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>${t('billingReport', lang)}: ${t('orders', lang)}</h1>
                    <h2>${vendorName} - ${t('for', lang)} ${month}</h2>
                    <table class="orders-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>${t('SKU', lang)}</th>
                                <th>${t('orderId', lang)}</th>
                                <th>${t('date', lang)}</th>
                                ${userType === 'admin' ? `<th>${t('vendor', lang)}</th>` : ''}
                                <th>${t('customer', lang)}</th>
                                <th class="${rightAlign}">${t('total', lang)}</th>
                                ${userType === 'admin' ? `<th>${t('status', lang)}</th>` : ''}
                                <th>${t('paid', lang)}</th>
                                ${userType === 'admin' ? `<th>${t('paidBy', lang)}</th>` : ''}
                                ${userType === 'admin' && showAddedToBill ? `<th>${t('addedToBill', lang)}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${ordersHTML}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;

        return new Response(htmlContent, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
        console.error("Error in exportBillingOrdersHTML:", e);
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});