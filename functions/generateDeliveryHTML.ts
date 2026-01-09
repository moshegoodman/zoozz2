
import { format } from "npm:date-fns@2.30.0";
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { order, vendor, language } = await req.json(); // 'language' is still received but the output document is fixed to Hebrew RTL as per outline.

        if (!order || !vendor) {
            return Response.json({ error: 'Missing required data' }, { status: 400 });
        }

        // As per the outline, the output document is now fixed to Hebrew (he) and Right-to-Left (rtl).
        // The input 'language' parameter no longer dynamically changes the document's direction or primary language.
        const lang = 'he'; // Fixed to Hebrew as per outline's HTML/CSS
        const isRTL = true; // Fixed to true for Hebrew
        const dir = 'rtl'; // Fixed to rtl for Hebrew

        // Translation function - will always return Hebrew translations based on 'lang' being 'he'.
        const t = (key) => {
            const translations = {
                en: {
                    title: 'Delivery Slip',
                    supplier: 'Supplier',
                    orderNum: 'Order #',
                    date: 'Date',
                    household: 'Household',
                    contactPerson: 'Contact Person',
                    contactPhone: 'Contact Phone',
                    neighborhood: 'Neighborhood',
                    street: 'Street',
                    buildingNum: 'Building No.',
                    aptNum: 'Apt. No.',
                    deliveryTime: 'Delivery Time',
                    entranceCode: 'Entrance Code',
                    deliveryNotes: 'Delivery Notes',
                    orderSummary: 'Order Summary',
                    totalItems: 'Total Items',
                    supplied: 'Supplied',
                    replaced: 'Replaced',
                    notSupplied: 'Not Supplied',
                    tableNum: '#',
                    tableProduct: 'Product',
                    tableSku: 'SKU',
                    tableCategory: 'Category',
                    tableOrdered: 'Ordered',
                    tableSupplied: 'Supplied',
                    tableStatus: 'Status',
                    statusSupplied: 'Supplied',
                    statusNotSupplied: 'Not Supplied',
                    statusReplaced: 'Replaced'
                },
                he: {
                    title: 'תעודת משלוח',
                    supplier: 'ספק',
                    orderNum: 'הזמנה #',
                    date: 'תאריך',
                    household: 'משק בית',
                    contactPerson: 'איש קשר',
                    contactPhone: 'טלפון קשר',
                    neighborhood: 'שכונה',
                    street: 'רחוב',
                    buildingNum: 'מספר בניין',
                    aptNum: 'מספר דירה',
                    deliveryTime: 'זמן משלוח',
                    entranceCode: 'קוד כניסה',
                    deliveryNotes: 'הערות למשלוח',
                    orderSummary: 'סיכום הזמנה',
                    totalItems: 'סה"כ פריטים',
                    supplied: 'סופקו',
                    replaced: 'הוחלפו',
                    notSupplied: 'לא סופקו',
                    tableNum: '#',
                    tableProduct: 'מוצר',
                    tableSku: 'מק"ט',
                    tableCategory: 'קטגוריה',
                    tableOrdered: 'הוזמן',
                    tableSupplied: 'סופק',
                    tableStatus: 'סטטוס',
                    statusSupplied: 'סופק',
                    statusNotSupplied: 'לא סופק',
                    statusReplaced: 'הוחלף'
                }
            };
            return translations[lang][key] || key;
        };

        // --- Data Preparation ---
        const totalItems = order.items.length;
        const suppliedItems = order.items.filter(item => item.actual_quantity > 0 && !item.substitute_product_id).length;
        const replacedItems = order.items.filter(item => !!item.substitute_product_id).length;
        const notSuppliedItems = totalItems - suppliedItems - replacedItems;

        const summaryText = `${t('totalItems')} ${totalItems} | ${t('supplied')} ${suppliedItems} | ${t('replaced')} ${replacedItems} | ${t('notSupplied')} ${notSuppliedItems}`;

        // Variables for the new detailsHtml structure, using 'isRTL' (which is now always true) for content selection
        const vendorName = vendor.name_hebrew || vendor.name;
        const formattedDate = format(new Date(order.created_date), 'dd.MM.yyyy');
        const customerName = `${order.household_name_hebrew || order.household_name} (#${order.household_code})`;
        const customerPhone = order.household_lead_phone || order.phone || 'N/A';
        const deliveryTimeFormatted = order.delivery_time || 'N/A';
        const entranceCode = order.entrance_code || 'N/A';

        // --- Items Table HTML ---
        const itemsHtml = order.items.map((item, index) => {
            // Always prefer Hebrew name/category since document is RTL
            const productName = item.product_name_hebrew || item.product_name;
            const category = item.subcategory_hebrew || item.subcategory;
            const actualQty = item.actual_quantity !== null && item.actual_quantity !== undefined ? item.actual_quantity : 0;

            let statusText = '';
            if (item.substitute_product_id) {
                statusText = t('statusReplaced');
            } else if (actualQty > 0) {
                statusText = t('statusSupplied');
            } else {
                statusText = t('statusNotSupplied');
            }

            return `
                <tr>
                    <td><span class="english-text">${index + 1}</span></td>
                    <td class="product-name">${productName}</td>
                    <td><span class="english-text">${item.sku || ''}</span></td>
                    <td>${category || ''}</td>
                    <td><span class="english-text">${item.quantity}</span></td>
                    <td><span class="english-text">${actualQty}</span></td>
                    <td>${statusText}</td>
                </tr>
            `;
        }).join('');

        // Details HTML - Now with label first, value second, and 'N/A' for missing values as per outline
        const detailsHtml = `
            <div class="detail-row"><div class="detail-label">${t('supplier')}:</div><div class="detail-value">${vendorName}</div></div>
            <div class="detail-row"><div class="detail-label">${t('orderNum')}:</div><div class="detail-value"><span class="english-text">${order.order_number}</span></div></div>
            <div class="detail-row"><div class="detail-label">${t('date')}:</div><div class="detail-value"><span class="english-text">${formattedDate}</span></div></div>
            <div class="detail-row"><div class="detail-label">${t('household')}:</div><div class="detail-value">${customerName}</div></div>
            <div class="detail-row"><div class="detail-label">${t('contactPerson')}:</div><div class="detail-value">${order.household_lead_name || 'N/A'}</div></div>
            <div class="detail-row"><div class="detail-label">${t('contactPhone')}:</div><div class="detail-value"><span class="english-text">${customerPhone}</span></div></div>
            <div class="detail-row"><div class="detail-label">${t('neighborhood')}:</div><div class="detail-value">${order.neighborhood || 'N/A'}</div></div>
            <div class="detail-row"><div class="detail-label">${t('street')}:</div><div class="detail-value">${order.street || 'N/A'}</div></div>
            <div class="detail-row"><div class="detail-label">${t('buildingNum')}:</div><div class="detail-value"><span class="english-text">${order.building_number || 'N/A'}</span></div></div>
            <div class="detail-row"><div class="detail-label">${t('aptNum')}:</div><div class="detail-value"><span class="english-text">${order.household_number || 'N/A'}</span></div></div>
            <div class="detail-row"><div class="detail-label">${t('deliveryTime')}:</div><div class="detail-value"><span class="english-text">${deliveryTimeFormatted}</span></div></div>
            <div class="detail-row"><div class="detail-label">${t('entranceCode')}:</div><div class="detail-value"><span class="english-text">${entranceCode}</span></div></div>
            ${order.delivery_notes ? `<div class="detail-row"><div class="detail-label">${t('deliveryNotes')}:</div><div class="detail-value">${order.delivery_notes}</div></div>` : ''}
        `;

        // --- Final HTML Document --- Fixed to Hebrew RTL as per outline
        const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Noto Sans Hebrew', 'Noto Sans', sans-serif;
            font-size: 11pt;
            direction: rtl;
            text-align: right;
            padding: 20px;
            background: white;
            color: #000;
            margin: 0;
        }
        .english-text {
            font-family: 'Noto Sans', sans-serif;
            direction: ltr;
            unicode-bidi: embed;
            display: inline-block;
        }
        .container { 
            max-width: 800px; 
            margin: auto; 
            direction: rtl;
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
        }
        .title { 
            font-size: 24pt; 
            font-weight: bold; 
            border-bottom: 2px solid #000; 
            padding-bottom: 10px; 
        }
        .details-grid { 
            display: grid; 
            grid-template-columns: 1fr;
            gap: 5px;
            margin-bottom: 20px;
            direction: rtl;
        }
        .detail-row {
            display: grid;
            grid-template-columns: auto 1fr; /* Changed to label first, value second */
            gap: 10px;
            text-align: right;
            direction: rtl;
        }
        .detail-label { 
            font-weight: bold; 
            text-align: right;
        }
        .detail-value { 
            text-align: right; 
        }
        .summary-line {
            padding-top: 10px;
            margin-bottom: 20px;
            border-top: 1px solid #000;
            font-weight: bold;
            direction: rtl;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            direction: rtl;
        }
        .items-table th, .items-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: right;
            vertical-align: top;
        }
        .items-table th { 
            background-color: #f2f2f2; 
            font-weight: bold; 
        }
        .items-table td { 
            font-size: 10pt; 
        }
        .product-name { 
            min-width: 150px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${t('title')}</h1>
        </div>

        <div class="details-grid">
            ${detailsHtml}
        </div>

        <div class="summary-line">
            <div class="detail-row">
                <div class="detail-label">${t('orderSummary')}:</div>
                <div class="detail-value">${summaryText}</div>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>${t('tableNum')}</th>
                    <th>${t('tableProduct')}</th>
                    <th>${t('tableSku')}</th>
                    <th>${t('tableCategory')}</th>
                    <th>${t('tableOrdered')}</th>
                    <th>${t('tableSupplied')}</th>
                    <th>${t('tableStatus')}</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
    </div>
</body>
</html>`;

        return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error) {
        console.error("Error generating delivery HTML:", error);
        return new Response(JSON.stringify({ error: 'Failed to generate delivery HTML', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
