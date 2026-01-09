import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { format } from "npm:date-fns@2.30.0";

// Helper function for return invoices
function generateReturnInvoiceHTMLContent(order, vendor, household, language, appSettings) {
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
                quantity: "Qty",
                price: "Price",
                total: "Total",
                subtotal: "Subtotal",
                beforeTax: "Total Before Tax",
                vat: "VAT (18%)",
                deliveryFee: "Delivery Fee",
                grandTotal: "Grand Total",
                returnedItemsOnly: "This invoice shows only returned items",
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
                quantity: "כמות",
                price: "מחיר",
                total: "סה\"כ",
                subtotal: "סכום ביניים",
                beforeTax: "סה\"כ לפני מע\"מ",
                vat: "מע\"מ (18%)",
                deliveryFee: "דמי משלוח",
                grandTotal: "סה\"כ כללי",
                returnedItemsOnly: "חשבונית זו מציגה רק פריטים שהוחזרו",
            }
        };
        return translations[isRTL ? 'he' : 'en'][key] || key;
    };

    const subtotal = order.items.reduce((acc, item) => {
        const quantity = item.amount_returned || 0;
        return acc + (quantity * (item.price || 0));
    }, 0);

    const deliveryFee = 0; // No delivery fee on returns
    const total = subtotal + deliveryFee;
    const hasVat = vendor.has_vat !== false;

    let totalBeforeTax, vatAmount, grandTotal;
    if (hasVat) {
        const vatRate = 0.18;
        totalBeforeTax = total / (1 + vatRate);
        vatAmount = total - totalBeforeTax;
        grandTotal = total;
    } else {
        totalBeforeTax = total;
        vatAmount = 0;
        grandTotal = total;
    }

    const invoiceNumber = order.order_number ? order.order_number.replace('PO-', 'RET-') : 'N/A';
    const orderDateFormatted = format(new Date(order.created_date), 'MM/dd/yyyy');

    let billingAddress = '';
    if (household) {
        const addressParts = [
            household.street,
            household.building_number,
            household.household_number,
            household.neighborhood
        ].filter(Boolean);
        billingAddress = addressParts.join(', ');
        if (household.city) billingAddress += (billingAddress ? ', ' : '') + household.city;
        if (household.zip_code) billingAddress += (billingAddress ? ' ' : '') + household.zip_code;
    }
    if (!billingAddress && order.delivery_address) {
        billingAddress = order.delivery_address;
    }

    let lineNumber = 1;
    const itemsHtml = order.items
        .filter(item => {
            const quantity = item.amount_returned || 0;
            return quantity > 0;
        })
        .map(item => {
            const productName = isRTL ? (item.product_name_hebrew || item.product_name) : item.product_name;
            const quantity = item.amount_returned || 0;
            const price = item.price || 0;
            const itemTotal = quantity * price;
            const currentLineNumber = lineNumber++;

            return '<tr><td class="center"><span class="english-text">' + currentLineNumber + '</span></td><td class="product-name">' + productName + '</td><td class="center"><span class="english-text">' + (item.sku || 'N/A') + '</span></td><td class="center">' + (isRTL ? (item.subcategory_hebrew || item.subcategory || 'N/A') : (item.subcategory || 'N/A')) + '</td><td class="center"><span class="english-text">' + quantity + '</span></td><td class="center"><span class="english-text">' + currencySymbol + price.toFixed(2) + '</span></td><td class="right"><span class="english-text">' + currencySymbol + itemTotal.toFixed(2) + '</span></td></tr>';
        }).join('');

    return '<!DOCTYPE html><html lang="' + (isRTL ? 'he' : 'en') + '" dir="' + (isRTL ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + t('title') + ' - ' + invoiceNumber + '</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:\'Noto Sans Hebrew\',\'Noto Sans\',Arial,sans-serif;margin:0;padding:20px;color:#333;direction:' + (isRTL ? 'rtl' : 'ltr') + ';background:white;line-height:1.4;font-size:11pt}.english-text{direction:ltr!important;unicode-bidi:isolate!important;display:inline-block;font-family:\'Noto Sans\',Arial,monospace}.container{max-width:800px;margin:0 auto;direction:' + (isRTL ? 'rtl' : 'ltr') + '}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #dc2626;padding-bottom:15px}.title{font-size:24pt;font-weight:bold;margin:0 0 10px 0;color:#dc2626}.invoice-meta{background:#fef3c7;padding:12px;border-radius:5px;margin-top:10px;text-align:center;border:2px solid #f59e0b}.invoice-meta p{margin:3px 0;font-weight:500;font-size:10pt}.returned-notice{background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:10px;margin-bottom:20px;text-align:center;font-weight:bold;color:#92400e;font-size:10pt}.bill-to{background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;text-align:' + (isRTL ? 'right' : 'left') + '}.bill-to h3{border-bottom:2px solid #dc2626;padding-bottom:6px;margin:0 0 8px 0;color:#dc2626;font-size:14pt}.bill-to p{margin:2px 0;font-size:10pt}.items-table{width:100%;border-collapse:collapse;border:1px solid #000;direction:' + (isRTL ? 'rtl' : 'ltr') + ';margin-bottom:20px}.items-table th,.items-table td{border:1px solid #000;padding:8px;text-align:' + (isRTL ? 'right' : 'left') + ';vertical-align:top}.items-table th{background-color:#fee;font-weight:bold;font-size:10pt}.items-table td{font-size:10pt}.center{text-align:center!important}.right{text-align:' + (isRTL ? 'left' : 'right') + '!important;font-weight:bold}.product-name{min-width:150px;font-weight:500}.totals-section{float:' + (isRTL ? 'left' : 'right') + ';width:350px;margin-top:15px}.totals-table{width:100%;border-collapse:collapse}.totals-table td{padding:8px 10px;border-bottom:1px solid #eee;font-size:10pt}.totals-table td:first-child{font-weight:bold;text-align:' + (isRTL ? 'right' : 'left') + ';background-color:#f8f9fa}.totals-table td:last-child{text-align:' + (isRTL ? 'left' : 'right') + ';font-weight:bold}.grand-total-row{background-color:#dc2626!important;color:white!important;font-weight:bold!important;font-size:12pt!important}.grand-total-row td{border-bottom:none!important;border-top:2px solid #991b1b!important}.footer{clear:both;text-align:center;margin-top:30px;padding-top:15px;border-top:2px solid #eee;color:#666}.footer p{margin:8px 0;font-size:10pt}</style></head><body><div class="container"><div class="header"><h1 class="title">' + t('title') + '</h1>' + (vendor.image_url ? '<img src="' + vendor.image_url + '" alt="' + vendor.name + '" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:10px;">' : '<div style="font-size:1.1em;color:#666;margin-bottom:10px;">' + (vendor.name || 'Vendor') + '</div>') + '<div class="invoice-meta"><p><strong>' + t('invoiceNumber') + ':</strong> <span class="english-text">' + invoiceNumber + '</span></p><p><strong>' + t('orderNumber') + ':</strong> <span class="english-text">' + (order.order_number || 'N/A') + '</span></p><p><strong>' + t('date') + ':</strong> <span class="english-text">' + orderDateFormatted + '</span></p></div></div><div class="returned-notice">' + t('returnedItemsOnly') + '</div><div class="bill-to"><h3>' + t('billTo') + '</h3><p><strong>' + (household ? (isRTL ? household.name_hebrew || household.name : household.name) : order.user_email || 'Customer') + '</strong></p>' + (billingAddress ? '<p>' + billingAddress + '</p>' : '') + (order.phone ? '<p>Phone: <span class="english-text">' + (household ? household.lead_phone : '') + '</span></p>' : '') + '</div><table class="items-table"><thead><tr><th class="center">' + t('lineNo') + '</th><th>' + t('product') + '</th><th class="center">' + t('sku') + '</th><th class="center">' + t('subcategory') + '</th><th class="center">' + t('quantity') + '</th><th class="center">' + t('price') + '</th><th class="right">' + t('total') + '</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><div class="totals-section"><table class="totals-table"><tr><td>' + t('subtotal') + '</td><td><span class="english-text">' + currencySymbol + subtotal.toFixed(2) + '</span></td></tr>' + (deliveryFee > 0 ? '<tr><td>' + t('deliveryFee') + '</td><td><span class="english-text">' + currencySymbol + deliveryFee.toFixed(2) + '</span></td></tr>' : '') + (hasVat ? '<tr><td>' + t('beforeTax') + '</td><td><span class="english-text">' + currencySymbol + totalBeforeTax.toFixed(2) + '</span></td></tr><tr><td>' + t('vat') + '</td><td><span class="english-text">' + currencySymbol + vatAmount.toFixed(2) + '</span></td></tr>' : '') + '<tr class="grand-total-row"><td>' + t('grandTotal') + '</td><td><strong><span class="english-text">' + currencySymbol + grandTotal.toFixed(2) + '</span></strong></td></tr></table></div><div style="clear:both;"></div></div></body></html>';
}

// Helper function from generateInvoiceHTML
function generateInvoiceHTMLContent(order, vendor, household, language, appSettings) {
    const isRTL = language === 'he';
    const orderCurrency = order.order_currency || 'ILS';
    const currencySymbol = orderCurrency === 'USD' ? '$' : '₪';

    const t = (key) => {
        const translations = {
            en: {
                title: "Invoice",
                orderNumber: "Order #",
                invoiceNumber: "Invoice #",
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
            }
        };
        return translations[isRTL ? 'he' : 'en'][key] || key;
    };

    const subtotal = order.items.reduce((acc, item) => {
        const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
        return acc + (quantity * (item.price || 0));
    }, 0);

    const deliveryFee = order.delivery_price || 0;
    const total = subtotal + deliveryFee;
    const hasVat = vendor.has_vat !== false;

    let totalBeforeTax, vatAmount, grandTotal;
    if (hasVat) {
        const vatRate = 0.18;
        totalBeforeTax = total / (1 + vatRate);
        vatAmount = total - totalBeforeTax;
        grandTotal = total;
    } else {
        totalBeforeTax = total;
        vatAmount = 0;
        grandTotal = total;
    }

    const invoiceNumber = order.order_number ? order.order_number.replace('PO-', 'INV-') : 'N/A';
    const orderDateFormatted = format(new Date(order.created_date), 'MM/dd/yyyy');

    let billingAddress = '';
    if (household) {
        const addressParts = [
            household.street,
            household.building_number,
            household.household_number,
            household.neighborhood
        ].filter(Boolean);
        billingAddress = addressParts.join(', ');
        if (household.city) billingAddress += (billingAddress ? ', ' : '') + household.city;
        if (household.zip_code) billingAddress += (billingAddress ? ' ' : '') + household.zip_code;
    }
    if (!billingAddress && order.delivery_address) {
        billingAddress = order.delivery_address;
    }

    let lineNumber = 1;
    const itemsHtml = order.items
        .filter(item => {
            const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
            return quantity > 0;
        })
        .map(item => {
            const productName = isRTL ? (item.product_name_hebrew || item.product_name) : item.product_name;
            const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
            const price = item.price || 0;
            const itemTotal = quantity * price;
            const currentLineNumber = lineNumber++;

            return '<tr><td class="center"><span class="english-text">' + currentLineNumber + '</span></td><td class="product-name">' + productName + '</td><td class="center"><span class="english-text">' + (item.sku || 'N/A') + '</span></td><td class="center">' + (isRTL ? (item.subcategory_hebrew || item.subcategory || 'N/A') : (item.subcategory || 'N/A')) + '</td><td class="center"><span class="english-text">' + quantity + '</span></td><td class="center"><span class="english-text">' + currencySymbol + price.toFixed(2) + '</span></td><td class="right"><span class="english-text">' + currencySymbol + itemTotal.toFixed(2) + '</span></td></tr>';
        }).join('');

    return '<!DOCTYPE html><html lang="' + (isRTL ? 'he' : 'en') + '" dir="' + (isRTL ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + t('title') + ' - ' + invoiceNumber + '</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:\'Noto Sans Hebrew\',\'Noto Sans\',Arial,sans-serif;margin:0;padding:20px;color:#333;direction:' + (isRTL ? 'rtl' : 'ltr') + ';background:white;line-height:1.4;font-size:11pt}.english-text{direction:ltr!important;unicode-bidi:isolate!important;display:inline-block;font-family:\'Noto Sans\',Arial,monospace}.container{max-width:800px;margin:0 auto;direction:' + (isRTL ? 'rtl' : 'ltr') + '}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #333;padding-bottom:15px}.title{font-size:24pt;font-weight:bold;margin:0 0 10px 0;color:#2c3e50}.invoice-meta{background:#f8f9fa;padding:12px;border-radius:5px;margin-top:10px;text-align:center}.invoice-meta p{margin:3px 0;font-weight:500;font-size:10pt}.bill-to{background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;text-align:' + (isRTL ? 'right' : 'left') + '}.bill-to h3{border-bottom:2px solid #007bff;padding-bottom:6px;margin:0 0 8px 0;color:#007bff;font-size:14pt}.bill-to p{margin:2px 0;font-size:10pt}.items-table{width:100%;border-collapse:collapse;border:1px solid #000;direction:' + (isRTL ? 'rtl' : 'ltr') + ';margin-bottom:20px}.items-table th,.items-table td{border:1px solid #000;padding:8px;text-align:' + (isRTL ? 'right' : 'left') + ';vertical-align:top}.items-table th{background-color:#f2f2f2;font-weight:bold;font-size:10pt}.items-table td{font-size:10pt}.center{text-align:center!important}.right{text-align:' + (isRTL ? 'left' : 'right') + '!important;font-weight:bold}.product-name{min-width:150px;font-weight:500}.totals-section{float:' + (isRTL ? 'left' : 'right') + ';width:350px;margin-top:15px}.totals-table{width:100%;border-collapse:collapse}.totals-table td{padding:8px 10px;border-bottom:1px solid #eee;font-size:10pt}.totals-table td:first-child{font-weight:bold;text-align:' + (isRTL ? 'right' : 'left') + ';background-color:#f8f9fa}.totals-table td:last-child{text-align:' + (isRTL ? 'left' : 'right') + ';font-weight:bold}.grand-total-row{background-color:#28a745!important;color:white!important;font-weight:bold!important;font-size:12pt!important}.grand-total-row td{border-bottom:none!important;border-top:2px solid #1e7e34!important}.footer{clear:both;text-align:center;margin-top:30px;padding-top:15px;border-top:2px solid #eee;color:#666}.footer p{margin:8px 0;font-size:10pt}</style></head><body><div class="container"><div class="header"><h1 class="title">' + t('title') + '</h1>' + (vendor.image_url ? '<img src="' + vendor.image_url + '" alt="' + vendor.name + '" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:10px;">' : '<div style="font-size:1.1em;color:#666;margin-bottom:10px;">' + (vendor.name || 'Vendor') + '</div>') + '<div class="invoice-meta"><p><strong>' + t('invoiceNumber') + ':</strong> <span class="english-text">' + invoiceNumber + '</span></p><p><strong>' + t('orderNumber') + ':</strong> <span class="english-text">' + (order.order_number || 'N/A') + '</span></p><p><strong>' + t('date') + ':</strong> <span class="english-text">' + orderDateFormatted + '</span></p></div></div><div class="bill-to"><h3>' + t('billTo') + '</h3><p><strong>' + (household ? (isRTL ? household.name_hebrew || household.name : household.name) : order.user_email || 'Customer') + '</strong></p>' + (billingAddress ? '<p>' + billingAddress + '</p>' : '') + (order.phone ? '<p>Phone: <span class="english-text">' + (household ? household.lead_phone : '') + '</span></p>' : '') + '</div><table class="items-table"><thead><tr><th class="center">' + t('lineNo') + '</th><th>' + t('product') + '</th><th class="center">' + t('sku') + '</th><th class="center">' + t('subcategory') + '</th><th class="center">' + t('quantity') + '</th><th class="center">' + t('price') + '</th><th class="right">' + t('total') + '</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><div class="totals-section"><table class="totals-table"><tr><td>' + t('subtotal') + '</td><td><span class="english-text">' + currencySymbol + subtotal.toFixed(2) + '</span></td></tr>' + (deliveryFee > 0 ? '<tr><td>' + t('deliveryFee') + '</td><td><span class="english-text">' + currencySymbol + deliveryFee.toFixed(2) + '</span></td></tr>' : '') + (hasVat ? '<tr><td>' + t('beforeTax') + '</td><td><span class="english-text">' + currencySymbol + totalBeforeTax.toFixed(2) + '</span></td></tr><tr><td>' + t('vat') + '</td><td><span class="english-text">' + currencySymbol + vatAmount.toFixed(2) + '</span></td></tr>' : '') + '<tr class="grand-total-row"><td>' + t('grandTotal') + '</td><td><strong><span class="english-text">' + currencySymbol + grandTotal.toFixed(2) + '</span></strong></td></tr></table></div><div style="clear:both;"></div><div class="footer"><p>' + t('thankYou') + '</p></div></div></body></html>';
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { householdId, vendorId, language, convertToUSD } = body;

        const sdk = base44.asServiceRole;

        // Build order filter with optional household and vendor filters
        const orderFilter = { 
            status: { $in: ['delivery', 'delivered'] }
        };
        if (householdId && householdId !== 'all') {
            orderFilter.household_id = householdId;
        }
        if (vendorId) {
            orderFilter.vendor_id = vendorId;
        }
        
        const orders = await sdk.entities.Order.filter(orderFilter);
        const vendors = await sdk.entities.Vendor.list();
        const settings = await sdk.entities.AppSettings.list();
        
        // Get household if specific one selected
        let household = null;
        if (householdId && householdId !== 'all') {
            household = await sdk.entities.Household.get(householdId);
            if (!household) {
                return Response.json({ error: 'Household not found' }, { status: 404 });
            }
        }

        const ILS_TO_USD_RATE = 3.24;

        // Filter to only orders with shopped items
        const ordersWithShoppedItems = orders.filter(order => {
            const shoppedItems = (order.items || []).filter(item => {
                const wasShoppedAndAvailable = item.shopped && item.available;
                const hasActualQuantity = item.actual_quantity !== null && 
                                         item.actual_quantity !== undefined && 
                                         item.actual_quantity > 0;
                return wasShoppedAndAvailable || hasActualQuantity;
            });
            return shoppedItems.length > 0;
        });

        if (ordersWithShoppedItems.length === 0) {
            return Response.json({ error: 'No orders with shopped items found for this household' }, { status: 404 });
        }

        const isHebrew = language === 'he' || language === 'Hebrew';
        const householdName = household ? (isHebrew && household.name_hebrew ? household.name_hebrew : household.name) : 'All Households';

        // Get font URLs
        let fontStyles = '';
        if (isHebrew && settings && settings.length > 0) {
            const hebrewFontUrlRegular = settings[0].hebrewFontUrlRegular;
            const hebrewFontUrlBold = settings[0].hebrewFontUrlBold;
            
            if (hebrewFontUrlRegular) {
                fontStyles += "@font-face { font-family: 'CustomHebrew'; src: url('" + hebrewFontUrlRegular + "') format('truetype'); font-weight: normal; }";
            }
            if (hebrewFontUrlBold) {
                fontStyles += "@font-face { font-family: 'CustomHebrew'; src: url('" + hebrewFontUrlBold + "') format('truetype'); font-weight: bold; }";
            }
        }

        const baseFont = isHebrew ? "'CustomHebrew', 'Arial', sans-serif" : "'Arial', sans-serif";
        const dir = isHebrew ? 'rtl' : 'ltr';
        const textAlign = isHebrew ? 'right' : 'left';

        // Filter orders with returned items
        const ordersWithReturnedItems = orders.filter(order => {
            const returnedItems = (order.items || []).filter(item => 
                item.is_returned === true && 
                item.amount_returned !== null && 
                item.amount_returned !== undefined &&
                item.amount_returned > 0
            );
            return returnedItems.length > 0;
        });

        // Calculate summary totals
        let summaryTotal = 0;
        const orderSummaries = [];

        for (const order of ordersWithShoppedItems) {
            const shoppedItems = (order.items || []).filter(item => {
                const wasShoppedAndAvailable = item.shopped && item.available;
                const hasActualQuantity = item.actual_quantity !== null && 
                                         item.actual_quantity !== undefined && 
                                         item.actual_quantity > 0;
                return wasShoppedAndAvailable || hasActualQuantity;
            });

            const subtotal = shoppedItems.reduce((acc, item) => {
                const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
                    ? item.actual_quantity
                    : (item.quantity || 0);
                let price = item.price || 0;
                // Convert to USD if needed
                if (convertToUSD && order.order_currency !== 'USD') {
                    price = price / ILS_TO_USD_RATE;
                }
                return acc + (quantity * price);
            }, 0);

            let deliveryFee = order.delivery_price || 0;
            if (convertToUSD && order.order_currency !== 'USD') {
                deliveryFee = deliveryFee / ILS_TO_USD_RATE;
            }
            
            const orderTotal = subtotal + deliveryFee;
            summaryTotal += orderTotal;

            const vendor = vendors.find(v => v.id === order.vendor_id);
            const vendorName = vendor ? (isHebrew && vendor.name_hebrew ? vendor.name_hebrew : vendor.name) : 'Unknown Vendor';

            orderSummaries.push({
                orderNumber: order.order_number,
                vendorName: vendorName,
                date: new Date(order.created_date).toLocaleDateString('en-GB'),
                total: orderTotal,
                type: 'invoice'
            });
        }

        // Add return invoices to summary
        for (const order of ordersWithReturnedItems) {
            const returnedItems = (order.items || []).filter(item => 
                item.is_returned === true && 
                item.amount_returned !== null && 
                item.amount_returned !== undefined &&
                item.amount_returned > 0
            );

            const returnSubtotal = returnedItems.reduce((acc, item) => {
                const quantity = item.amount_returned || 0;
                let price = item.price || 0;
                // Convert to USD if needed
                if (convertToUSD && order.order_currency !== 'USD') {
                    price = price / ILS_TO_USD_RATE;
                }
                return acc + (quantity * price);
            }, 0);

            summaryTotal -= returnSubtotal; // Subtract returns from total

            const vendor = vendors.find(v => v.id === order.vendor_id);
            const vendorName = vendor ? (isHebrew && vendor.name_hebrew ? vendor.name_hebrew : vendor.name) : 'Unknown Vendor';

            orderSummaries.push({
                orderNumber: order.order_number,
                vendorName: vendorName,
                date: new Date(order.created_date).toLocaleDateString('en-GB'),
                total: -returnSubtotal, // Negative for returns
                type: 'return'
            });
        }

        const t = isHebrew ? {
            summaryTitle: 'סיכום חשבוניות',
            totalOrders: 'סה"כ הזמנות',
            grandTotal: 'סה"כ כללי',
            orderNumber: 'מספר הזמנה',
            vendor: 'ספק',
            date: 'תאריך',
            total: 'סה"כ',
            type: 'סוג',
            invoice: 'חשבונית',
            returnInvoice: 'החזרה',
            customer: 'לקוח',
            item: 'פריט',
            qty: 'כמות',
            unitPrice: 'מחיר ליחידה',
            subtotal: 'סכום ביניים',
            deliveryFee: 'דמי משלוח',
            beforeTax: 'לפני מע"מ',
            vat: 'מע"מ (18%)'
        } : {
            summaryTitle: 'Invoices Summary',
            totalOrders: 'Total Orders',
            grandTotal: 'Grand Total',
            orderNumber: 'Order Number',
            vendor: 'Vendor',
            date: 'Date',
            total: 'Total',
            type: 'Type',
            invoice: 'Invoice',
            returnInvoice: 'Return',
            customer: 'Customer',
            item: 'Item',
            qty: 'Qty',
            unitPrice: 'Unit Price',
            subtotal: 'Subtotal',
            deliveryFee: 'Delivery Fee',
            beforeTax: 'Before Tax',
            vat: 'VAT (18%)'
        };

        // Build HTML pages array
        const htmlPages = [];

        // Determine currency symbol for summary
        const summaryCurrencySymbol = convertToUSD ? '$' : '₪';

        // Summary page with clickable order numbers
        const summaryRows = orderSummaries.map((s, index) => {
            const typeLabel = s.type === 'return' ? '<span style="color: #dc2626; font-weight: bold;">' + t.returnInvoice + '</span>' : t.invoice;
            const totalColor = s.type === 'return' ? 'color: #dc2626;' : '';
            return '<tr><td><strong><a href="#invoice-' + index + '" style="color: #059669; text-decoration: underline; cursor: pointer;">' + s.orderNumber + '</a></strong></td><td>' + s.vendorName + '</td><td>' + typeLabel + '</td><td>' + s.date + '</td><td style="' + totalColor + '"><strong>' + summaryCurrencySymbol + s.total.toFixed(2) + '</strong></td></tr>';
        }).join('');

        htmlPages.push('<div style="page-break-after: always; margin: 40px;"><h1 style="font-size: 32px; font-weight: bold; text-align: center; margin-bottom: 30px;">' + t.summaryTitle + '</h1><div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center;"><h2 style="font-size: 24px; font-weight: bold; color: #059669; margin-bottom: 10px;">' + householdName + '</h2><p style="color: #6b7280; font-size: 14px;">' + t.totalOrders + ': ' + orderSummaries.length + '</p></div><table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;"><thead style="background: #f3f4f6;"><tr><th style="padding: 12px; text-align: ' + textAlign + '; font-weight: bold;">' + t.orderNumber + '</th><th style="padding: 12px; text-align: ' + textAlign + '; font-weight: bold;">' + t.vendor + '</th><th style="padding: 12px; text-align: ' + textAlign + '; font-weight: bold;">' + t.type + '</th><th style="padding: 12px; text-align: ' + textAlign + '; font-weight: bold;">' + t.date + '</th><th style="padding: 12px; text-align: ' + textAlign + '; font-weight: bold;">' + t.total + '</th></tr></thead><tbody>' + summaryRows + '</tbody></table><div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-top: 30px;"><div style="font-size: 18px; margin-bottom: 10px;">' + t.grandTotal + '</div><div style="font-size: 48px; font-weight: bold;">' + summaryCurrencySymbol + summaryTotal.toFixed(2) + '</div></div></div>');

        // Individual invoice pages - using generateInvoiceHTMLContent
        let invoiceIndex = 0;
        ordersWithShoppedItems.forEach((order) => {
            const vendor = vendors.find(v => v.id === order.vendor_id);
            if (!vendor) return;

            // Filter to shopped items only for this invoice
            let enrichedOrder = {
                ...order,
                items: (order.items || []).filter(item => {
                    const wasShoppedAndAvailable = item.shopped && item.available;
                    const hasActualQuantity = item.actual_quantity !== null && 
                                             item.actual_quantity !== undefined && 
                                             item.actual_quantity > 0;
                    return wasShoppedAndAvailable || hasActualQuantity;
                })
            };

            // Convert to USD if requested
            if (convertToUSD && enrichedOrder.order_currency !== 'USD') {
                enrichedOrder = {
                    ...enrichedOrder,
                    order_currency: 'USD',
                    items: enrichedOrder.items.map(item => ({
                        ...item,
                        price: item.price / ILS_TO_USD_RATE
                    })),
                    delivery_price: (enrichedOrder.delivery_price || 0) / ILS_TO_USD_RATE
                };
            }

            const orderHousehold = household || (async () => {
                try {
                    return await sdk.entities.Household.get(order.household_id);
                } catch {
                    return null;
                }
            })();

            const invoiceHTML = generateInvoiceHTMLContent(enrichedOrder, vendor, orderHousehold, language, settings[0] || {});
            // Extract styles and body content separately to preserve layout
            const styleMatch = invoiceHTML.match(/<style>([\s\S]*?)<\/style>/i);
            const styles = styleMatch ? styleMatch[1] : '';
            const bodyMatch = invoiceHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            const bodyContent = bodyMatch ? bodyMatch[1] : invoiceHTML;
            
            // Wrap with anchor, page break, and include the styles
            const invoiceWithAnchor = '<div id="invoice-' + invoiceIndex + '" style="page-break-before: always;"><style>' + styles + '</style>' + bodyContent + '</div>';
            htmlPages.push(invoiceWithAnchor);
            invoiceIndex++;
        });

        // Add return invoice pages
        ordersWithReturnedItems.forEach((order) => {
            const vendor = vendors.find(v => v.id === order.vendor_id);
            if (!vendor) return;

            // Filter to returned items only
            let returnOrder = {
                ...order,
                items: (order.items || []).filter(item => 
                    item.is_returned === true && 
                    item.amount_returned !== null && 
                    item.amount_returned !== undefined &&
                    item.amount_returned > 0
                )
            };

            // Convert to USD if requested
            if (convertToUSD && returnOrder.order_currency !== 'USD') {
                returnOrder = {
                    ...returnOrder,
                    order_currency: 'USD',
                    items: returnOrder.items.map(item => ({
                        ...item,
                        price: item.price / ILS_TO_USD_RATE
                    })),
                    delivery_price: (returnOrder.delivery_price || 0) / ILS_TO_USD_RATE
                };
            }

            const orderHousehold = household || (async () => {
                try {
                    return await sdk.entities.Household.get(order.household_id);
                } catch {
                    return null;
                }
            })();

            const returnHTML = generateReturnInvoiceHTMLContent(returnOrder, vendor, orderHousehold, language, settings[0] || {});
            const styleMatch = returnHTML.match(/<style>([\s\S]*?)<\/style>/i);
            const styles = styleMatch ? styleMatch[1] : '';
            const bodyMatch = returnHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            const bodyContent = bodyMatch ? bodyMatch[1] : returnHTML;
            
            const returnWithAnchor = '<div id="invoice-' + invoiceIndex + '" style="page-break-before: always;"><style>' + styles + '</style>' + bodyContent + '</div>';
            htmlPages.push(returnWithAnchor);
            invoiceIndex++;
        });

        // Combine all pages
        const combinedHTML = '<!DOCTYPE html><html lang="' + (isHebrew ? 'he' : 'en') + '" dir="' + dir + '"><head><meta charset="UTF-8"><style>' + fontStyles + ' body{font-family:' + baseFont + ';direction:' + dir + ';margin:0;padding:0;}</style></head><body>' + htmlPages.join('') + '</body></html>';

        // Use PDFShift to generate PDF
        const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
        if (!pdfShiftApiKey) {
            return Response.json({ error: 'PDFSHIFT_API_KEY not configured' }, { status: 500 });
        }

        const pdfShiftResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa('api:' + pdfShiftApiKey),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: combinedHTML,
                landscape: false,
                use_print: false,
            }),
        });

        if (!pdfShiftResponse.ok) {
            const errorText = await pdfShiftResponse.text();
            console.error('PDFShift error:', errorText);
            return Response.json({ error: 'Failed to generate PDF', details: errorText }, { status: 500 });
        }

        const pdfBuffer = await pdfShiftResponse.arrayBuffer();
        const uint8Array = new Uint8Array(pdfBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const pdfBase64 = btoa(binaryString);

        return Response.json({
            success: true,
            pdfBase64: pdfBase64
        });

    } catch (error) {
        console.error('Error generating combined invoices:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});