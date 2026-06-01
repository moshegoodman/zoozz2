import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { format } from "npm:date-fns@2.30.0";

/**
 * Generates the HTML for a RETURNS invoice — same layout as the regular invoice
 * but with a red accent, no delivery fee, and only the items that were returned.
 * Quantity column shows `amount_returned`. VAT logic mirrors the regular invoice.
 */
function generateReturnsInvoiceHTMLContent(order, vendor, household, language) {
    const isRTL = language === 'he';
    const orderCurrency = order.order_currency || 'ILS';
    const currencySymbol = orderCurrency === 'USD' ? '$' : '₪';

    const t = (key) => {
        const translations = {
            en: {
                title: "Return Invoice",
                orderNumber: "Order #",
                invoiceNumber: "Return Invoice #",
                date: "Date",
                billTo: "Bill To",
                lineNo: "#",
                product: "Product",
                sku: "SKU",
                subcategory: "Category",
                quantity: "Qty Returned",
                price: "Price",
                total: "Total",
                subtotal: "Subtotal",
                beforeTax: "Total Before Tax",
                vat: "VAT (18%)",
                grandTotal: "Grand Total (Credit)",
                billingSummary: "Returns Summary",
                returnedItemsOnly: "This invoice covers only returned items.",
            },
            he: {
                title: "חשבונית החזרה",
                orderNumber: "הזמנה #",
                invoiceNumber: "חשבונית החזרה #",
                date: "תאריך",
                billTo: "לכבוד",
                lineNo: "#",
                product: "מוצר",
                sku: "מק\"ט",
                subcategory: "קטגוריה",
                quantity: "כמות שהוחזרה",
                price: "מחיר",
                total: "סה\"כ",
                subtotal: "סכום ביניים",
                beforeTax: "סה\"כ לפני מע\"מ",
                vat: "מע\"מ (18%)",
                grandTotal: "סה\"כ זיכוי",
                billingSummary: "סיכום החזרות",
                returnedItemsOnly: "חשבונית זו מציגה רק פריטים שהוחזרו.",
            }
        };
        return translations[isRTL ? 'he' : 'en'][key] || key;
    };

    const returnedItems = (order.items || []).filter(item =>
        item.is_returned === true && (item.amount_returned || 0) > 0
    );

    const subtotal = returnedItems.reduce((acc, item) => {
        return acc + ((item.amount_returned || 0) * (item.price || 0));
    }, 0);

    const hasVat = vendor.has_vat !== false;
    const vatRate = 0.18;
    let totalBeforeTax, vatAmount, grandTotal;
    if (hasVat) {
        grandTotal = subtotal;
        vatAmount = grandTotal - (grandTotal / (1 + vatRate));
        totalBeforeTax = grandTotal - vatAmount;
    } else {
        totalBeforeTax = subtotal;
        vatAmount = totalBeforeTax * vatRate;
        grandTotal = totalBeforeTax + vatAmount;
    }

    const invoiceNumber = order.order_number ? order.order_number.replace('PO-', 'RET-') : 'N/A';
    const orderDateFormatted = format(new Date(order.created_date), 'MM/dd/yyyy');

    let billingAddress = '';
    if (household) {
        const parts = [household.street, household.building_number, household.household_number, household.neighborhood].filter(Boolean);
        billingAddress = parts.join(', ');
        if (household.city) billingAddress += (billingAddress ? ', ' : '') + household.city;
        if (household.zip_code) billingAddress += (billingAddress ? ' ' : '') + household.zip_code;
    }
    if (!billingAddress && order.delivery_address) billingAddress = order.delivery_address;

    let lineNumber = 1;
    const itemsHtml = returnedItems.map(item => {
        const productName = isRTL ? (item.product_name_hebrew || item.product_name) : item.product_name;
        const quantity = item.amount_returned || 0;
        const price = item.price || 0;
        const itemTotal = quantity * price;
        const currentLineNumber = lineNumber++;
        return `
        <tr>
            <td class="center"><span class="english-text">${currentLineNumber}</span></td>
            <td class="product-name">${productName}</td>
            <td class="center"><span class="english-text">${item.sku || 'N/A'}</span></td>
            <td class="center">${isRTL ? (item.subcategory_hebrew || item.subcategory || 'N/A') : (item.subcategory || 'N/A')}</td>
            <td class="center"><span class="english-text">${quantity}</span></td>
            <td class="center"><span class="english-text">${currencySymbol}${price.toFixed(2)}</span></td>
            <td class="right"><span class="english-text">${currencySymbol}${itemTotal.toFixed(2)}</span></td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="${isRTL ? 'he' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('title')} - ${invoiceNumber}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans Hebrew', 'Noto Sans', Arial, sans-serif; margin: 0; padding: 20px; color: #333; direction: ${isRTL ? 'rtl' : 'ltr'}; background: white; line-height: 1.4; font-size: 11pt; }
        .english-text { direction: ltr !important; unicode-bidi: isolate !important; display: inline-block; font-family: 'Noto Sans', Arial, monospace; }
        .container { max-width: 800px; margin: 0 auto; direction: ${isRTL ? 'rtl' : 'ltr'}; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #dc2626; padding-bottom: 15px; }
        .title { font-size: 24pt; font-weight: bold; margin: 0 0 10px 0; color: #dc2626; }
        .invoice-meta { background: #fef2f2; padding: 12px; border-radius: 5px; margin-top: 10px; text-align: center; border: 1px solid #fecaca; }
        .invoice-meta p { margin: 3px 0; font-weight: 500; font-size: 10pt; }
        .return-notice { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 10px; margin-bottom: 20px; text-align: center; font-weight: bold; color: #92400e; font-size: 10pt; }
        .bill-to { background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: ${isRTL ? 'right' : 'left'}; }
        .bill-to h3 { border-bottom: 2px solid #dc2626; padding-bottom: 6px; margin: 0 0 8px 0; color: #dc2626; font-size: 14pt; }
        .bill-to p { margin: 2px 0; font-size: 10pt; }
        .items-table { width: 100%; border-collapse: collapse; border: 1px solid #000; direction: ${isRTL ? 'rtl' : 'ltr'}; margin-bottom: 20px; }
        .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: ${isRTL ? 'right' : 'left'}; vertical-align: top; }
        .items-table th { background-color: #fee2e2; font-weight: bold; font-size: 10pt; color: #991b1b; }
        .items-table td { font-size: 10pt; }
        .center { text-align: center !important; }
        .right { text-align: ${isRTL ? 'left' : 'right'} !important; font-weight: bold; }
        .product-name { min-width: 150px; font-weight: 500; }
        .summary-section { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 30px 0; clear: both; direction: ${isRTL ? 'rtl' : 'ltr'}; }
        .summary-title { font-size: 13pt; font-weight: bold; color: #dc2626; margin: 0 0 15px 0; text-align: center; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fecaca; font-size: 11pt; }
        .summary-row:last-child { border-bottom: none; padding-top: 10px; margin-top: 5px; border-top: 2px solid #dc2626; font-size: 13pt; font-weight: bold; color: #dc2626; }
        .summary-label { font-weight: 500; color: #333; }
        .summary-amount { text-align: right; font-weight: bold; color: #333; }
        .footer { clear: both; text-align: center; margin-top: 30px; padding-top: 15px; border-top: 2px solid #eee; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${t('title')}</h1>
            ${vendor.image_url ? `<img src="${vendor.image_url}" alt="${vendor.name}" style="max-width: 120px; max-height: 60px; object-fit: contain; margin-bottom: 10px;">` : `<div style="font-size: 1.1em; color: #666; margin-bottom: 10px;">${vendor.name || 'Vendor'}</div>`}
            <div class="invoice-meta">
                <p><strong>${t('invoiceNumber')}:</strong> <span class="english-text">${invoiceNumber}</span></p>
                <p><strong>${t('orderNumber')}:</strong> <span class="english-text">${order.order_number || 'N/A'}</span></p>
                <p><strong>${t('date')}:</strong> <span class="english-text">${orderDateFormatted}</span></p>
            </div>
        </div>

        <div class="return-notice">${t('returnedItemsOnly')}</div>

        <div class="bill-to">
            <h3>${t('billTo')}</h3>
            <p><strong>${household ? (isRTL ? household.name_hebrew || household.name : household.name) : order.user_email || 'Customer'}</strong></p>
            ${billingAddress ? `<p>${billingAddress}</p>` : ''}
            ${household?.lead_phone ? `<p>Phone: <span class="english-text">${household.lead_phone}</span></p>` : ''}
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th class="center">${t('lineNo')}</th>
                    <th>${t('product')}</th>
                    <th class="center">${t('sku')}</th>
                    <th class="center">${t('subcategory')}</th>
                    <th class="center">${t('quantity')}</th>
                    <th class="center">${t('price')}</th>
                    <th class="right">${t('total')}</th>
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
        </table>

        <div class="summary-section">
            <div class="summary-title">${t('billingSummary')}</div>
            <div class="summary-row">
                <span class="summary-label">${t('subtotal')}</span>
                <span class="summary-amount english-text">${currencySymbol}${subtotal.toFixed(2)}</span>
            </div>
            ${vatAmount > 0 ? `
            <div class="summary-row">
                <span class="summary-label">${t('beforeTax')}</span>
                <span class="summary-amount english-text">${currencySymbol}${totalBeforeTax.toFixed(2)}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">${t('vat')}</span>
                <span class="summary-amount english-text">${currencySymbol}${vatAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="summary-row">
                <span class="summary-label">${t('grandTotal')}</span>
                <span class="summary-amount english-text">${currencySymbol}${grandTotal.toFixed(2)}</span>
            </div>
        </div>
    </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { order, vendor, language } = await req.json();
        if (!order) return Response.json({ error: 'Missing order data' }, { status: 400 });
        if (!vendor) return Response.json({ error: 'Vendor data is required' }, { status: 400 });

        const sdk = base44.asServiceRole;

        let household = null;
        if (order.household_id) {
            try { household = await sdk.entities.Household.get(order.household_id); }
            catch (e) { console.warn(`Household ${order.household_id} fetch failed:`, e.message); }
        }

        // Enrich items with SKU/subcategory
        const enrichedOrder = { ...order };
        if (order.items && order.items.length > 0) {
            const productIds = order.items.map(i => i.product_id).filter(Boolean);
            if (productIds.length > 0) {
                const products = await sdk.entities.Product.filter({ id: { $in: productIds } });
                const productMap = products.reduce((m, p) => { m[p.id] = p; return m; }, {});
                enrichedOrder.items = order.items.map(item => {
                    const product = productMap[item.product_id];
                    return {
                        ...item,
                        sku: item.sku || product?.sku || 'N/A',
                        subcategory: item.subcategory || product?.subcategory || 'N/A',
                        subcategory_hebrew: item.subcategory_hebrew || product?.subcategory_hebrew || product?.subcategory || 'N/A',
                    };
                });
            }
        }

        const htmlContent = generateReturnsInvoiceHTMLContent(enrichedOrder, vendor, household, language);
        return new Response(htmlContent, { status: 200, headers: { 'Content-Type': 'text/html' } });
    } catch (error) {
        console.error('generateReturnsInvoiceHTML Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});