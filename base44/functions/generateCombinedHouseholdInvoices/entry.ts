import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { format } from "npm:date-fns@2.30.0";

// Shared Bill To block. Falls back to order.household_* fields when the
// household record is not provided, so combined PDFs never show "undefined".
function buildBillToHTML(order, household, t, isRTL) {
    const name = isRTL
        ? (household?.name_hebrew || household?.name || order.household_name_hebrew || order.household_name || order.user_email || 'Customer')
        : (household?.name || order.household_name || order.user_email || 'Customer');
    const leadName = order.household_lead_name || household?.lead_name || '';
    const leadPhone = order.household_lead_phone || household?.lead_phone || order.phone || '';

    let billingAddress = '';
    if (household) {
        const parts = [household.street, household.building_number, household.household_number, household.neighborhood].filter(Boolean);
        billingAddress = parts.join(', ');
        if (household.city) billingAddress += (billingAddress ? ', ' : '') + household.city;
        if (household.zip_code) billingAddress += (billingAddress ? ' ' : '') + household.zip_code;
    }
    if (!billingAddress && order.delivery_address) billingAddress = order.delivery_address;

    let html = '<div class="bill-to"><h3>' + t('billTo') + '</h3>';
    html += '<p><strong>' + name + '</strong></p>';
    if (leadName) html += '<p><strong>' + t('lead') + ':</strong> ' + leadName + '</p>';
    if (billingAddress) html += '<p>' + billingAddress + '</p>';
    if (leadPhone) html += '<p>Phone: <span class="english-text">' + leadPhone + '</span></p>';
    html += '</div>';
    return html;
}

// Helper function for return invoices
function generateReturnInvoiceHTMLContent(order, vendor, household, language, appSettings) {
    const isRTL = language === 'he';
    // Default to ILS (Israeli Shekel) unless the order was actually placed in USD
    const orderCurrency = (order.order_currency === 'USD') ? 'USD' : 'ILS';
    const currencySymbol = orderCurrency === 'USD' ? '$' : '₪';

    const t = (key) => {
        const translations = {
            en: {
                title: "Return Invoice",
                orderNumber: "Order #",
                invoiceNumber: "Return Invoice #",
                date: "Date",
                billTo: "Bill To",
                lead: "Lead",
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
                lead: "איש קשר",
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

    const deliveryFee = 0;
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

    let lineNumber = 1;
    const itemsHtml = order.items
        .filter(item => (item.amount_returned || 0) > 0)
        .map(item => {
            const productName = isRTL ? (item.product_name_hebrew || item.product_name) : item.product_name;
            const quantity = item.amount_returned || 0;
            const price = item.price || 0;
            const itemTotal = quantity * price;
            const currentLineNumber = lineNumber++;
            return '<tr><td class="center"><span class="english-text">' + currentLineNumber + '</span></td><td class="product-name">' + productName + '</td><td class="center"><span class="english-text">' + (item.sku || 'N/A') + '</span></td><td class="center">' + (isRTL ? (item.subcategory_hebrew || item.subcategory || 'N/A') : (item.subcategory || 'N/A')) + '</td><td class="center"><span class="english-text">' + quantity + '</span></td><td class="center"><span class="english-text">' + currencySymbol + price.toFixed(2) + '</span></td><td class="right"><span class="english-text">' + currencySymbol + itemTotal.toFixed(2) + '</span></td></tr>';
        }).join('');

    const billToHtml = buildBillToHTML(order, household, t, isRTL);

    return '<!DOCTYPE html><html lang="' + (isRTL ? 'he' : 'en') + '" dir="' + (isRTL ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + t('title') + ' - ' + invoiceNumber + '</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:\'Noto Sans Hebrew\',\'Noto Sans\',Arial,sans-serif;margin:0;padding:20px;color:#333;direction:' + (isRTL ? 'rtl' : 'ltr') + ';background:white;line-height:1.4;font-size:11pt}.english-text{direction:ltr!important;unicode-bidi:isolate!important;display:inline-block;font-family:\'Noto Sans\',Arial,monospace}.container{max-width:800px;margin:0 auto;direction:' + (isRTL ? 'rtl' : 'ltr') + '}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #dc2626;padding-bottom:15px}.title{font-size:24pt;font-weight:bold;margin:0 0 10px 0;color:#dc2626}.vendor-name{font-size:14pt;color:#333;font-weight:700;margin:6px 0 10px 0}.invoice-meta{background:#fef3c7;padding:12px;border-radius:5px;margin-top:10px;text-align:center;border:2px solid #f59e0b}.invoice-meta p{margin:3px 0;font-weight:500;font-size:10pt}.returned-notice{background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:10px;margin-bottom:20px;text-align:center;font-weight:bold;color:#92400e;font-size:10pt}.bill-to{background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;text-align:' + (isRTL ? 'right' : 'left') + '}.bill-to h3{border-bottom:2px solid #dc2626;padding-bottom:6px;margin:0 0 8px 0;color:#dc2626;font-size:14pt}.bill-to p{margin:2px 0;font-size:10pt}.items-table{width:100%;border-collapse:collapse;border:1px solid #000;direction:' + (isRTL ? 'rtl' : 'ltr') + ';margin-bottom:20px}.items-table th,.items-table td{border:1px solid #000;padding:8px;text-align:' + (isRTL ? 'right' : 'left') + ';vertical-align:top}.items-table th{background-color:#fee;font-weight:bold;font-size:10pt}.items-table td{font-size:10pt}.center{text-align:center!important}.right{text-align:' + (isRTL ? 'left' : 'right') + '!important;font-weight:bold}.product-name{min-width:150px;font-weight:500}.totals-section{float:' + (isRTL ? 'left' : 'right') + ';width:350px;margin-top:15px}.totals-table{width:100%;border-collapse:collapse}.totals-table td{padding:8px 10px;border-bottom:1px solid #eee;font-size:10pt}.totals-table td:first-child{font-weight:bold;text-align:' + (isRTL ? 'right' : 'left') + ';background-color:#f8f9fa}.totals-table td:last-child{text-align:' + (isRTL ? 'left' : 'right') + ';font-weight:bold}.grand-total-row{background-color:#dc2626!important;color:white!important;font-weight:bold!important;font-size:12pt!important}.grand-total-row td{border-bottom:none!important;border-top:2px solid #991b1b!important}.footer{clear:both;text-align:center;margin-top:30px;padding-top:15px;border-top:2px solid #eee;color:#666}.footer p{margin:8px 0;font-size:10pt}</style></head><body><div class="container"><div class="header"><h1 class="title">' + t('title') + '</h1>' + (vendor.image_url ? '<img src="' + vendor.image_url + '" alt="' + vendor.name + '" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:6px;">' : '') + '<div class="vendor-name">' + (vendor.name || 'Vendor') + '</div>' + '<div class="invoice-meta"><p><strong>' + t('invoiceNumber') + ':</strong> <span class="english-text">' + invoiceNumber + '</span></p><p><strong>' + t('orderNumber') + ':</strong> <span class="english-text">' + (order.order_number || 'N/A') + '</span></p><p><strong>' + t('date') + ':</strong> <span class="english-text">' + orderDateFormatted + '</span></p></div></div><div class="returned-notice">' + t('returnedItemsOnly') + '</div>' + billToHtml + '<table class="items-table"><thead><tr><th class="center">' + t('lineNo') + '</th><th>' + t('product') + '</th><th class="center">' + t('sku') + '</th><th class="center">' + t('subcategory') + '</th><th class="center">' + t('quantity') + '</th><th class="center">' + t('price') + '</th><th class="right">' + t('total') + '</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><div class="totals-section"><table class="totals-table"><tr><td>' + t('subtotal') + '</td><td><span class="english-text">' + currencySymbol + subtotal.toFixed(2) + '</span></td></tr>' + (deliveryFee > 0 ? '<tr><td>' + t('deliveryFee') + '</td><td><span class="english-text">' + currencySymbol + deliveryFee.toFixed(2) + '</span></td></tr>' : '') + (hasVat ? '<tr><td>' + t('beforeTax') + '</td><td><span class="english-text">' + currencySymbol + totalBeforeTax.toFixed(2) + '</span></td></tr><tr><td>' + t('vat') + '</td><td><span class="english-text">' + currencySymbol + vatAmount.toFixed(2) + '</span></td></tr>' : '') + '<tr class="grand-total-row"><td>' + t('grandTotal') + '</td><td><strong><span class="english-text">' + currencySymbol + grandTotal.toFixed(2) + '</span></strong></td></tr></table></div><div style="clear:both;"></div></div></body></html>';
}

// Helper function from generateInvoiceHTML
function generateInvoiceHTMLContent(order, vendor, household, language, appSettings) {
    const isRTL = language === 'he';
    // Default to ILS (Israeli Shekel) unless the order was actually placed in USD
    const orderCurrency = (order.order_currency === 'USD') ? 'USD' : 'ILS';
    const currencySymbol = orderCurrency === 'USD' ? '$' : '₪';

    const t = (key) => {
        const translations = {
            en: {
                title: "Invoice",
                orderNumber: "Order #",
                invoiceNumber: "Invoice #",
                date: "Date",
                billTo: "Bill To",
                lead: "Lead",
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
                lead: "איש קשר",
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

    // Effective total = total_amount - sum(amount_returned * price). Matches OrdersMatrix exactly.
    const baseTotal = order.total_amount || 0;
    const returnedValueInv = (order.items || []).reduce((sum, item) => {
        const qty = Number(item.amount_returned) || 0;
        if (qty <= 0) return sum;
        return sum + qty * (Number(item.price) || 0);
    }, 0);
    const total = baseTotal - returnedValueInv;
    const deliveryFee = order.delivery_price || 0;
    // Derive items subtotal as total - delivery (kept for display only)
    const subtotal = total - deliveryFee;
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

    let lineNumber = 1;
    const itemsHtml = order.items
        .filter(item => {
            if (item.available === false || item.is_returned) return false;
            const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
            const effectiveQty = quantity - (item.amount_returned || 0);
            return effectiveQty > 0;
        })
        .map(item => {
            const productName = isRTL ? (item.product_name_hebrew || item.product_name) : item.product_name;
            const rawQty = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : (item.quantity || 0);
            const quantity = rawQty - (item.amount_returned || 0);
            const price = item.price || 0;
            const itemTotal = quantity * price;
            const currentLineNumber = lineNumber++;
            return '<tr><td class="center"><span class="english-text">' + currentLineNumber + '</span></td><td class="product-name">' + productName + '</td><td class="center"><span class="english-text">' + (item.sku || 'N/A') + '</span></td><td class="center">' + (isRTL ? (item.subcategory_hebrew || item.subcategory || 'N/A') : (item.subcategory || 'N/A')) + '</td><td class="center"><span class="english-text">' + quantity + '</span></td><td class="center"><span class="english-text">' + currencySymbol + price.toFixed(2) + '</span></td><td class="right"><span class="english-text">' + currencySymbol + itemTotal.toFixed(2) + '</span></td></tr>';
        }).join('');

    const billToHtml = buildBillToHTML(order, household, t, isRTL);

    return '<!DOCTYPE html><html lang="' + (isRTL ? 'he' : 'en') + '" dir="' + (isRTL ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + t('title') + ' - ' + invoiceNumber + '</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:\'Noto Sans Hebrew\',\'Noto Sans\',Arial,sans-serif;margin:0;padding:20px;color:#333;direction:' + (isRTL ? 'rtl' : 'ltr') + ';background:white;line-height:1.4;font-size:11pt}.english-text{direction:ltr!important;unicode-bidi:isolate!important;display:inline-block;font-family:\'Noto Sans\',Arial,monospace}.container{max-width:800px;margin:0 auto;direction:' + (isRTL ? 'rtl' : 'ltr') + '}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #333;padding-bottom:15px}.title{font-size:24pt;font-weight:bold;margin:0 0 10px 0;color:#2c3e50}.vendor-name{font-size:14pt;color:#333;font-weight:700;margin:6px 0 10px 0}.invoice-meta{background:#f8f9fa;padding:12px;border-radius:5px;margin-top:10px;text-align:center}.invoice-meta p{margin:3px 0;font-weight:500;font-size:10pt}.bill-to{background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;text-align:' + (isRTL ? 'right' : 'left') + '}.bill-to h3{border-bottom:2px solid #007bff;padding-bottom:6px;margin:0 0 8px 0;color:#007bff;font-size:14pt}.bill-to p{margin:2px 0;font-size:10pt}.items-table{width:100%;border-collapse:collapse;border:1px solid #000;direction:' + (isRTL ? 'rtl' : 'ltr') + ';margin-bottom:20px}.items-table th,.items-table td{border:1px solid #000;padding:8px;text-align:' + (isRTL ? 'right' : 'left') + ';vertical-align:top}.items-table th{background-color:#f2f2f2;font-weight:bold;font-size:10pt}.items-table td{font-size:10pt}.center{text-align:center!important}.right{text-align:' + (isRTL ? 'left' : 'right') + '!important;font-weight:bold}.product-name{min-width:150px;font-weight:500}.totals-section{float:' + (isRTL ? 'left' : 'right') + ';width:350px;margin-top:15px}.totals-table{width:100%;border-collapse:collapse}.totals-table td{padding:8px 10px;border-bottom:1px solid #eee;font-size:10pt}.totals-table td:first-child{font-weight:bold;text-align:' + (isRTL ? 'right' : 'left') + ';background-color:#f8f9fa}.totals-table td:last-child{text-align:' + (isRTL ? 'left' : 'right') + ';font-weight:bold}.grand-total-row{background-color:#28a745!important;color:white!important;font-weight:bold!important;font-size:12pt!important}.grand-total-row td{border-bottom:none!important;border-top:2px solid #1e7e34!important}.footer{clear:both;text-align:center;margin-top:30px;padding-top:15px;border-top:2px solid #eee;color:#666}.footer p{margin:8px 0;font-size:10pt}</style></head><body><div class="container"><div class="header"><h1 class="title">' + t('title') + '</h1>' + (vendor.image_url ? '<img src="' + vendor.image_url + '" alt="' + vendor.name + '" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:6px;">' : '') + '<div class="vendor-name">' + (vendor.name || 'Vendor') + '</div>' + '<div class="invoice-meta"><p><strong>' + t('invoiceNumber') + ':</strong> <span class="english-text">' + invoiceNumber + '</span></p><p><strong>' + t('orderNumber') + ':</strong> <span class="english-text">' + (order.order_number || 'N/A') + '</span></p><p><strong>' + t('date') + ':</strong> <span class="english-text">' + orderDateFormatted + '</span></p></div></div>' + billToHtml + '<table class="items-table"><thead><tr><th class="center">' + t('lineNo') + '</th><th>' + t('product') + '</th><th class="center">' + t('sku') + '</th><th class="center">' + t('subcategory') + '</th><th class="center">' + t('quantity') + '</th><th class="center">' + t('price') + '</th><th class="right">' + t('total') + '</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><div class="totals-section"><table class="totals-table"><tr><td>' + t('subtotal') + '</td><td><span class="english-text">' + currencySymbol + subtotal.toFixed(2) + '</span></td></tr>' + (deliveryFee > 0 ? '<tr><td>' + t('deliveryFee') + '</td><td><span class="english-text">' + currencySymbol + deliveryFee.toFixed(2) + '</span></td></tr>' : '') + (hasVat ? '<tr><td>' + t('beforeTax') + '</td><td><span class="english-text">' + currencySymbol + totalBeforeTax.toFixed(2) + '</span></td></tr><tr><td>' + t('vat') + '</td><td><span class="english-text">' + currencySymbol + vatAmount.toFixed(2) + '</span></td></tr>' : '') + '<tr class="grand-total-row"><td>' + t('grandTotal') + '</td><td><strong><span class="english-text">' + currencySymbol + grandTotal.toFixed(2) + '</span></strong></td></tr></table></div><div style="clear:both;"></div><div class="footer"><p>' + t('thankYou') + '</p></div></div></body></html>';
}

// POS heuristic: orders are flagged paid+kcs at creation and never go through picking.
const isPOSOrder = (o) => o.is_paid === true && o.payment_status === 'kcs' && !o.picker_id;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { householdId, vendorId, language, convertToUSD } = body;
        const sdk = base44.asServiceRole;

        const orderFilter = { status: { $in: ['delivery', 'delivered'] } };
        if (householdId && householdId !== 'all') orderFilter.household_id = householdId;
        if (vendorId) orderFilter.vendor_id = vendorId;

        const [orders, vendors, settings, allHouseholds] = await Promise.all([
            sdk.entities.Order.filter(orderFilter),
            sdk.entities.Vendor.list(),
            sdk.entities.AppSettings.list(),
            sdk.entities.Household.list(undefined, 5000)
        ]);

        // Build household lookup
        const householdsMap = {};
        for (const h of allHouseholds) householdsMap[h.id] = h;

        let household = null;
        if (householdId && householdId !== 'all') {
            household = householdsMap[householdId];
            if (!household) return Response.json({ error: 'Household not found' }, { status: 404 });
        }

        // Default to current active season when generating for "all" households
        const activeSeason = settings?.[0]?.activeSeason || '';
        let scopedOrders = orders;
        if ((!householdId || householdId === 'all') && activeSeason) {
            const target = activeSeason.trim().toUpperCase();
            scopedOrders = orders.filter((o) => {
                const h = householdsMap[o.household_id];
                if (!h) return false;
                return (h.season || '').trim().toUpperCase() === target;
            });
        }

        const ILS_TO_USD_RATE = 3.24;
        const isHebrew = language === 'he' || language === 'Hebrew';

        // Orders with shopped items (for regular invoices)
        const ordersWithShoppedItems = scopedOrders.filter((order) => {
            const items = order.items || [];
            return items.some((i) => {
                const shopped = i.shopped && i.available;
                const hasActual = i.actual_quantity !== null && i.actual_quantity !== undefined && i.actual_quantity > 0;
                return shopped || hasActual;
            });
        });

        if (ordersWithShoppedItems.length === 0) {
            return Response.json({ error: 'No orders with shopped items found' }, { status: 404 });
        }

        const ordersWithReturnedItems = scopedOrders.filter((order) => {
            const items = order.items || [];
            return items.some((i) => i.is_returned === true && (i.amount_returned || 0) > 0);
        });

        // Fonts
        let fontStyles = '';
        if (isHebrew && settings && settings.length > 0) {
            const r = settings[0].hebrewFontUrlRegular;
            const b = settings[0].hebrewFontUrlBold;
            if (r) fontStyles += "@font-face { font-family: 'CustomHebrew'; src: url('" + r + "') format('truetype'); font-weight: normal; }";
            if (b) fontStyles += "@font-face { font-family: 'CustomHebrew'; src: url('" + b + "') format('truetype'); font-weight: bold; }";
        }
        const baseFont = isHebrew ? "'CustomHebrew', 'Arial', sans-serif" : "'Arial', sans-serif";
        const dir = isHebrew ? 'rtl' : 'ltr';
        const textAlign = isHebrew ? 'right' : 'left';

        // Build per-order summary entries
        const orderSummaries = [];

        const buildSummary = (order, totalAmount, type) => {
            const vendor = vendors.find((v) => v.id === order.vendor_id);
            const vendorName = vendor ? (isHebrew && vendor.name_hebrew ? vendor.name_hebrew : vendor.name) : 'Unknown Vendor';
            const h = householdsMap[order.household_id];
            const hName = h
                ? (isHebrew && h.name_hebrew ? h.name_hebrew : h.name)
                : ((isHebrew ? (order.household_name_hebrew || order.household_name) : order.household_name) || (isHebrew ? 'לא משוייך' : 'Unassigned'));
            return {
                orderNumber: order.order_number,
                vendorName,
                date: new Date(order.created_date).toLocaleDateString('en-GB'),
                createdDate: order.created_date,
                total: totalAmount,
                type,
                source: isPOSOrder(order) ? 'POS' : 'Online',
                householdId: order.household_id || 'unassigned',
                householdName: hName
            };
        };

        for (const order of ordersWithShoppedItems) {
            // Effective total = total_amount - sum(amount_returned * price). Matches OrdersMatrix exactly.
            let base = order.total_amount || 0;
            const returnedValue = (order.items || []).reduce((sum, i) => {
                const qty = Number(i.amount_returned) || 0;
                if (qty <= 0) return sum;
                return sum + qty * (Number(i.price) || 0);
            }, 0);
            let effective = base - returnedValue;
            if (convertToUSD && order.order_currency !== 'USD') effective = effective / ILS_TO_USD_RATE;
            orderSummaries.push(buildSummary(order, effective, 'invoice'));
        }

        for (const order of ordersWithReturnedItems) {
            const returnedItems = (order.items || []).filter((i) => i.is_returned === true && (i.amount_returned || 0) > 0);
            const returnSubtotal = returnedItems.reduce((acc, i) => {
                const qty = i.amount_returned || 0;
                let p = i.price || 0;
                if (convertToUSD && order.order_currency !== 'USD') p = p / ILS_TO_USD_RATE;
                return acc + qty * p;
            }, 0);
            orderSummaries.push(buildSummary(order, -returnSubtotal, 'return'));
        }

        const t = isHebrew ? {
            summaryTitle: 'סיכום חשבוניות',
            totalOrders: 'סה"כ הזמנות',
            grandTotal: 'סה"כ כללי',
            householdTotal: 'סה"כ למשק בית',
            orderNumber: 'מספר הזמנה',
            vendor: 'ספק',
            date: 'תאריך',
            total: 'סה"כ',
            type: 'סוג',
            source: 'מקור',
            invoice: 'חשבונית',
            returnInvoice: 'החזרה',
            season: 'עונה'
        } : {
            summaryTitle: 'Invoices Summary',
            totalOrders: 'Total Orders',
            grandTotal: 'Grand Total',
            householdTotal: 'Household Total',
            orderNumber: 'Order Number',
            vendor: 'Vendor',
            date: 'Date',
            total: 'Total',
            type: 'Type',
            source: 'Source',
            invoice: 'Invoice',
            returnInvoice: 'Return',
            season: 'Season'
        };

        // Group summaries by household, sort each group by newest order first
        const grouped = new Map();
        for (const s of orderSummaries) {
            if (!grouped.has(s.householdId)) grouped.set(s.householdId, { name: s.householdName, orders: [], total: 0 });
            const g = grouped.get(s.householdId);
            g.orders.push(s);
            g.total += s.total;
        }
        for (const [, g] of grouped) {
            g.orders.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
        }

        const summaryCurrencySymbol = convertToUSD ? '$' : '₪';

        // Assign anchors based on the order groups are iterated for invoice generation
        const orderToAnchor = new Map();
        let anchorIdx = 0;
        for (const [, g] of grouped) {
            for (const s of g.orders) orderToAnchor.set(s.orderNumber + '|' + s.type, anchorIdx++);
        }

        let grandTotalSum = 0;
        for (const [, g] of grouped) grandTotalSum += g.total;

        const headerTitle = (householdId && householdId !== 'all' && household)
            ? (isHebrew && household.name_hebrew ? household.name_hebrew : household.name)
            : (isHebrew ? 'כל משקי הבית' : 'All Households');
        const seasonLabel = activeSeason ? (' — ' + t.season + ': ' + activeSeason) : '';

        const thStyle = 'padding:8px;text-align:' + textAlign + ';font-weight:bold;border-bottom:1px solid #d1d5db;';
        const tdStyle = 'padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11pt;';

        const groupSections = Array.from(grouped.values()).map((g) => {
            const rows = g.orders.map((s) => {
                const typeLabel = s.type === 'return' ? '<span style="color:#dc2626;font-weight:bold;">' + t.returnInvoice + '</span>' : t.invoice;
                const totalColor = s.type === 'return' ? 'color:#dc2626;' : '';
                const sourceColor = s.source === 'POS' ? 'color:#7c3aed;font-weight:600;' : 'color:#0369a1;font-weight:600;';
                const anchor = orderToAnchor.get(s.orderNumber + '|' + s.type);
                return '<tr><td style="' + tdStyle + '"><a href="#invoice-' + anchor + '" style="color:#059669;text-decoration:underline;font-weight:bold;">' + s.orderNumber + '</a></td><td style="' + tdStyle + '">' + s.vendorName + '</td><td style="' + tdStyle + '">' + typeLabel + '</td><td style="' + tdStyle + sourceColor + '">' + s.source + '</td><td style="' + tdStyle + '">' + s.date + '</td><td style="' + tdStyle + totalColor + 'font-weight:bold;">' + summaryCurrencySymbol + s.total.toFixed(2) + '</td></tr>';
            }).join('');
            return '<div style="margin-bottom:24px;page-break-inside:avoid;"><h2 style="font-size:18px;font-weight:bold;color:#059669;margin:16px 0 8px 0;border-bottom:2px solid #059669;padding-bottom:6px;">' + g.name + '</h2><table style="width:100%;border-collapse:collapse;"><thead style="background:#f3f4f6;"><tr><th style="' + thStyle + '">' + t.orderNumber + '</th><th style="' + thStyle + '">' + t.vendor + '</th><th style="' + thStyle + '">' + t.type + '</th><th style="' + thStyle + '">' + t.source + '</th><th style="' + thStyle + '">' + t.date + '</th><th style="' + thStyle + '">' + t.total + '</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr style="background:#ecfdf5;font-weight:bold;"><td colspan="5" style="padding:10px 8px;text-align:' + (isHebrew ? 'left' : 'right') + ';">' + t.householdTotal + '</td><td style="padding:10px 8px;color:#059669;">' + summaryCurrencySymbol + g.total.toFixed(2) + '</td></tr></tfoot></table></div>';
        }).join('');

        const summaryPage = '<div style="page-break-after:always;margin:32px;"><h1 style="font-size:30px;font-weight:bold;text-align:center;margin-bottom:18px;">' + t.summaryTitle + '</h1><div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:20px;text-align:center;"><h2 style="font-size:22px;font-weight:bold;color:#059669;margin:0 0 6px 0;">' + headerTitle + seasonLabel + '</h2><p style="color:#6b7280;font-size:13px;margin:0;">' + t.totalOrders + ': ' + orderSummaries.length + '</p></div>' + groupSections + '<div style="background:linear-gradient(135deg,#059669 0%,#047857 100%);color:white;padding:22px;border-radius:12px;text-align:center;margin-top:20px;"><div style="font-size:16px;margin-bottom:6px;">' + t.grandTotal + '</div><div style="font-size:36px;font-weight:bold;">' + summaryCurrencySymbol + grandTotalSum.toFixed(2) + '</div></div></div>';

        const htmlPages = [summaryPage];

        // Build individual invoice pages in the same order as the summary anchors
        let pageIdx = 0;
        for (const [, g] of grouped) {
            for (const s of g.orders) {
                const ord = scopedOrders.find((o) => o.order_number === s.orderNumber);
                if (!ord) { pageIdx++; continue; }
                const vendor = vendors.find((v) => v.id === ord.vendor_id);
                if (!vendor) { pageIdx++; continue; }
                const orderHousehold = householdsMap[ord.household_id] || null;

                let enriched;
                if (s.type === 'return') {
                    enriched = {
                        ...ord,
                        items: (ord.items || []).filter((i) => i.is_returned === true && (i.amount_returned || 0) > 0)
                    };
                } else {
                    enriched = {
                        ...ord,
                        items: (ord.items || []).filter((i) => {
                            const shopped = i.shopped && i.available;
                            const hasActual = i.actual_quantity !== null && i.actual_quantity !== undefined && i.actual_quantity > 0;
                            return shopped || hasActual;
                        })
                    };
                }

                if (convertToUSD && enriched.order_currency !== 'USD') {
                    enriched = {
                        ...enriched,
                        order_currency: 'USD',
                        items: enriched.items.map((i) => ({ ...i, price: i.price / ILS_TO_USD_RATE })),
                        delivery_price: (enriched.delivery_price || 0) / ILS_TO_USD_RATE
                    };
                }

                const html = s.type === 'return'
                    ? generateReturnInvoiceHTMLContent(enriched, vendor, orderHousehold, language, settings[0] || {})
                    : generateInvoiceHTMLContent(enriched, vendor, orderHousehold, language, settings[0] || {});

                const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
                const styles = styleMatch ? styleMatch[1] : '';
                const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                const bodyContent = bodyMatch ? bodyMatch[1] : html;

                htmlPages.push('<div id="invoice-' + pageIdx + '" style="page-break-before:always;"><style>' + styles + '</style>' + bodyContent + '</div>');
                pageIdx++;
            }
        }

        const combinedHTML = '<!DOCTYPE html><html lang="' + (isHebrew ? 'he' : 'en') + '" dir="' + dir + '"><head><meta charset="UTF-8"><style>' + fontStyles + ' body{font-family:' + baseFont + ';direction:' + dir + ';margin:0;padding:0;}</style></head><body>' + htmlPages.join('') + '</body></html>';

        const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
        if (!pdfShiftApiKey) return Response.json({ error: 'PDFSHIFT_API_KEY not configured' }, { status: 500 });

        const pdfShiftResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa('api:' + pdfShiftApiKey),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ source: combinedHTML, landscape: false, use_print: false }),
        });

        if (!pdfShiftResponse.ok) {
            const errorText = await pdfShiftResponse.text();
            console.error('PDFShift error:', errorText);
            return Response.json({ error: 'Failed to generate PDF', details: errorText }, { status: 500 });
        }

        const pdfBuffer = await pdfShiftResponse.arrayBuffer();
        const uint8Array = new Uint8Array(pdfBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) binaryString += String.fromCharCode(uint8Array[i]);
        const pdfBase64 = btoa(binaryString);

        return Response.json({ success: true, pdfBase64 });

    } catch (error) {
        console.error('Error generating combined invoices:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});