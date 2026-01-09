
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@2.30.0";

/**
 * Generates the HTML content for an invoice.
 *
 * @param {object} order - The order object.
 * @param {object} vendor - The vendor object.
 * @param {object | null} household - The household object, if available.
 * @param {string} language - The language for the invoice (e.g., 'en', 'he').
 * @param {object} appSettings - Application settings, including font URLs.
 * @returns {string} The HTML string for the invoice.
 */
function generateInvoiceHTMLContent(order, vendor, household, language, appSettings) {
    const isRTL = language === 'he';
    // Removed specific font URLs as Google Fonts are now used.

    // Determine currency symbol based on order currency
    const orderCurrency = order.order_currency || 'ILS'; // Default to ILS if not specified
    const currencySymbol = orderCurrency === 'USD' ? '$' : '₪';

    // Translation utility
    const t = (key) => {
        const translations = {
            en: {
                title: "Purchase Order",
                orderNumber: "Order #",
                invoiceNumber: "Purchase Order #",
                date: "Date",
                billTo: "Bill To",
                lineNo: "#",
                product: "Product",
                sku: "SKU",
                subcategory: "Category",
                quantity: "Qty",
                price: "Price",
                total: "Total",
                subtotal: "Subtotal",
                beforeTax: "Total Before Tax",
                vat: "VAT (18%)",
                deliveryFee: "Delivery Fee",
                grandTotal: "Grand Total",
                thankYou: "Thank you for your business!",
                terms: "Payment Terms: Net 30 days",
            },
            he: {
                title: "חשבונית",
                orderNumber: "הזמנה #",
                invoiceNumber: "חשבונית #",
                date: "תאריך",
                billTo: "לכבוד",
                lineNo: "#",
                product: "מוצר",
                sku: "מק\"ט",
                subcategory: "קטגוריה",
                quantity: "כמות",
                price: "מחיר",
                total: "סה\"כ",
                subtotal: "סכום ביניים",
                beforeTax: "סה\"כ לפני מע\"מ",
                vat: "מע\"מ (18%)",
                deliveryFee: "דמי משלוח",
                grandTotal: "סה\"כ כללי",
                thankYou: "תודה על עסקיכם!",
                terms: "תנאי תשלום: 30 יום נטו",
            }
        };
        // Fallback to key itself if not found, as per outline
        return translations[isRTL ? 'he' : 'en'][key] || key;
    };

    // Calculate subtotal from items based on actual_quantity or quantity
    const subtotal = order.items.reduce((acc, item) => {
        const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
        return acc + (quantity * (item.price || 0));
    }, 0);

    const deliveryFee = order.delivery_price || 0;
    const total = subtotal + deliveryFee;

    // Check if vendor charges VAT
    const hasVat = vendor.has_vat !== false; // Default to true if not specified

    // Calculate VAT components only if vendor charges VAT
    let totalBeforeTax, vatAmount, grandTotal;
    
    if (hasVat) {
        const vatRate = 0.18; // 18%
        totalBeforeTax = total / (1 + vatRate);
        vatAmount = total - totalBeforeTax;
        grandTotal = total;
    } else {
        // No VAT - all amounts are the same
        totalBeforeTax = total;
        vatAmount = 0;
        grandTotal = total;
    }

    // Generate invoice number based on order number
    const invoiceNumber = order.order_number ? order.order_number.replace('PO-', 'INV-') : 'N/A';

    // Date formatting
    const orderDateFormatted = format(new Date(order.created_date), 'MM/dd/yyyy');

    // Build billing address
    let billingAddress = '';
    if (household) {
        const addressParts = [
            household.street,
            household.building_number,
            household.household_number,
            household.neighborhood
        ].filter(Boolean); // Filter out any null/undefined/empty parts
        billingAddress = addressParts.join(', ');
        if (household.city) billingAddress += (billingAddress ? ', ' : '') + household.city;
        if (household.zip_code) billingAddress += (billingAddress ? ' ' : '') + household.zip_code;
    }

    // Fallback to order delivery address if no household address is built
    if (!billingAddress && order.delivery_address) {
        billingAddress = order.delivery_address;
    }

    // Generate items HTML with line numbers, SKU, and subcategory
    let lineNumber = 1;
    const itemsHtml = order.items
        .filter(item => {
            const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
            return quantity > 0; // Only show items with positive quantity
        })
        .map(item => {
            const productName = isRTL ? (item.product_name_hebrew || item.product_name) : item.product_name;
            const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
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
            </tr>
            `;
        }).join('');

    return `
    <!DOCTYPE html>
    <html lang="${isRTL ? 'he' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('title')} - ${invoiceNumber}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Noto Sans Hebrew', 'Noto Sans', Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                direction: ${isRTL ? 'rtl' : 'ltr'};
                background: white;
                line-height: 1.4;
                font-size: 11pt;
            }
            
            .english-text {
                direction: ltr !important;
                unicode-bidi: isolate !important;
                display: inline-block;
                font-family: 'Noto Sans', Arial, monospace;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                direction: ${isRTL ? 'rtl' : 'ltr'};
            }
            
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
            }
            
            .title {
                font-size: 24pt;
                font-weight: bold;
                margin: 0 0 10px 0;
                color: #2c3e50;
            }
            
            .invoice-meta {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 5px;
                margin-top: 10px;
                text-align: center;
            }
            
            .invoice-meta p {
                margin: 3px 0;
                font-weight: 500;
                font-size: 10pt;
            }
            
            .bill-to {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: ${isRTL ? 'right' : 'left'};
            }
            
            .bill-to h3 {
                border-bottom: 2px solid #007bff;
                padding-bottom: 6px;
                margin: 0 0 8px 0;
                color: #007bff;
                font-size: 14pt;
            }
            
            .bill-to p {
                margin: 2px 0;
                font-size: 10pt;
            }
            
            .items-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #000;
                direction: ${isRTL ? 'rtl' : 'ltr'};
                margin-bottom: 20px;
            }
            
            .items-table th, .items-table td {
                border: 1px solid #000;
                padding: 8px;
                text-align: ${isRTL ? 'right' : 'left'};
                vertical-align: top;
            }
            
            .items-table th {
                background-color: #f2f2f2;
                font-weight: bold;
                font-size: 10pt;
            }
            
            .items-table td {
                font-size: 10pt;
            }
            
            .center {
                text-align: center !important;
            }
            
            .right {
                text-align: ${isRTL ? 'left' : 'right'} !important;
                font-weight: bold;
            }
            
            .product-name {
                min-width: 150px;
                font-weight: 500;
            }
            
            .totals-section {
                float: ${isRTL ? 'left' : 'right'};
                width: 350px;
                margin-top: 15px;
            }
            
            .totals-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .totals-table td {
                padding: 8px 10px;
                border-bottom: 1px solid #eee;
                font-size: 10pt;
            }
            
            .totals-table td:first-child {
                font-weight: bold;
                text-align: ${isRTL ? 'right' : 'left'};
                background-color: #f8f9fa;
            }
            
            .totals-table td:last-child {
                text-align: ${isRTL ? 'left' : 'right'};
                font-weight: bold;
            }
            
            .grand-total-row {
                background-color: #28a745 !important;
                color: white !important;
                font-weight: bold !important;
                font-size: 12pt !important;
            }
            
            .grand-total-row td {
                border-bottom: none !important;
                border-top: 2px solid #1e7e34 !important;
            }
            
            .footer {
                clear: both;
                text-align: center;
                margin-top: 30px;
                padding-top: 15px;
                border-top: 2px solid #eee;
                color: #666;
            }
            
            .footer p {
                margin: 8px 0;
                font-size: 10pt;
            }
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

            <div class="bill-to">
                <h3>${t('billTo')}</h3>
                <p><strong>${household ? (isRTL ? household.name_hebrew || household.name : household.name) : order.user_email || 'Customer'}</strong></p>
                ${billingAddress ? `<p>${billingAddress}</p>` : ''}
                ${order.phone ? `<p>Phone: <span class="english-text">${household ? household.lead_phone:''}</span></p>` : ''}
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
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="totals-section">
                <table class="totals-table">
                    <tr>
                        <td>${t('subtotal')}</td>
                        <td><span class="english-text">${currencySymbol}${subtotal.toFixed(2)}</span></td>
                    </tr>
                    ${deliveryFee > 0 ? `
                    <tr>
                        <td>${t('deliveryFee')}</td>
                        <td><span class="english-text">${currencySymbol}${deliveryFee.toFixed(2)}</span></td>
                    </tr>
                    ` : ''}
                    ${hasVat ? `
                    <tr>
                        <td>${t('beforeTax')}</td>
                        <td><span class="english-text">${currencySymbol}${totalBeforeTax.toFixed(2)}</span></td>
                    </tr>
                    <tr>
                        <td>${t('vat')}</td>
                        <td><span class="english-text">${currencySymbol}${vatAmount.toFixed(2)}</span></td>
                    </tr>
                    ` : ''}
                    <tr class="grand-total-row">
                        <td>${t('grandTotal')}</td>
                        <td><strong><span class="english-text">${currencySymbol}${grandTotal.toFixed(2)}</span></strong></td>
                    </tr>
                </table>
            </div>

            <div style="clear: both;"></div>

            <div class="footer">
                <p>${t('thankYou')}</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { order, vendor, language } = await req.json();

        // Check for required data
        if (!order) {
            return new Response(JSON.stringify({ error: "Missing order data" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (!vendor) {
            return new Response(JSON.stringify({ error: "Vendor data is required" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const sdk = base44.asServiceRole;
        
        let household = null;
        if (order.household_id) {
            try {
                household = await sdk.entities.Household.get(order.household_id);
            } catch (e) {
                console.warn(`Could not fetch household with ID ${order.household_id} for Purchase Order generation. Proceeding with order data. Error:`, e.message);
                // The household variable will remain null, and the rest of the function will use fallbacks.
            }
        }

        // Enrich order items with SKU and subcategory data from products
        const enrichedOrder = { ...order };
        if (order.items && order.items.length > 0) {
            const productIds = order.items.map(item => item.product_id).filter(Boolean);
            if (productIds.length > 0) {
                const products = await sdk.entities.Product.filter({ id: { $in: productIds } });
                const productMap = products.reduce((map, product) => {
                    map[product.id] = product;
                    return map;
                }, {});

                enrichedOrder.items = order.items.map(item => {
                    const product = productMap[item.product_id];
                    return {
                        ...item,
                        sku: item.sku || product?.sku || 'N/A',
                        subcategory: item.subcategory || product?.subcategory || 'N/A',
                        subcategory_hebrew: item.subcategory_hebrew || product?.subcategory_hebrew || product?.subcategory || 'N/A'
                    };
                });
            }
        }

        const settingsData = await sdk.entities.AppSettings.filter({}, null, 1);
        const appSettings = settingsData.length > 0 ? settingsData[0] : {};

        // Pass all necessary data to the utility function
        const htmlContent = generateInvoiceHTMLContent(enrichedOrder, vendor, household, language, appSettings);

        return new Response(htmlContent, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });

    } catch (error) {
        console.error('generateInvoiceHTML Error:', error);
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});
