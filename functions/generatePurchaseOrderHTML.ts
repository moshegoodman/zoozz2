import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sdk = base44.asServiceRole;

        const { order, language } = await req.json();

        if (!order) {
            return Response.json({ error: 'Order data is required' }, { status: 400 });
        }

        console.log('🔧 Generating Purchase Order HTML for order:', order.order_number);

        // Fetch related data
        const [vendor, household, settingsData] = await Promise.all([
            order.vendor_id ? sdk.entities.Vendor.get(order.vendor_id).catch(e => {
                console.warn('Failed to fetch vendor:', e);
                return null;
            }) : Promise.resolve(null),
            order.household_id ? sdk.entities.Household.get(order.household_id).catch(e => {
                console.warn('Failed to fetch household:', e);
                return null;
            }) : Promise.resolve(null),
            sdk.entities.AppSettings.filter({}, null, 1).catch(e => {
                console.warn('Failed to fetch app settings:', e);
                return [];
            })
        ]);
        
        const appSettings = settingsData.length > 0 ? settingsData[0] : {};
        
        // Generate HTML content
        const htmlContent = generatePurchaseOrderHTMLContent(order, vendor, household, language, appSettings);
        
        return new Response(htmlContent, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error) {
        console.error('Error generating Purchase Order HTML:', error);
        return Response.json({ 
            error: 'Failed to generate Purchase Order HTML', 
            details: error.message 
        }, { status: 500 });
    }
});

// Helper function to translate text
function t(translations, language, key) {
    return translations[language]?.[key] || key;
}

// Helper function to format dates
function formatDate(dateString, isRTL = false) {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
}

// Canonical HTML generation function
function generatePurchaseOrderHTMLContent(order, vendor, household, language, appSettings) {
    const lang = language === 'Hebrew' ? 'Hebrew' : 'English';
    const isRTL = language === 'Hebrew';
    
    const translations = {
        English: {
            purchaseOrder: 'Purchase Order',
            orderNumber: 'Order Number',
            orderDate: 'Order Date', 
            deliveryDate: 'Delivery Date',
            vendor: 'Vendor',
            household: 'Household',
            contact: 'Contact',
            contactPhone: 'Contact Phone Number',
            customer: 'Customer',
            address: 'Address',
            entranceCode: 'Entrance Code',
            deliveryNotes: 'Delivery Notes',
            items: 'Items',
            rowNumber: '#',
            sku: 'SKU',
            productName: 'Product Name',
            category: 'Category',
            quantity: 'Quantity',
            unit: 'Unit',
            pickerNotes: 'Picker Notes'
        },
        Hebrew: {
            purchaseOrder: 'הזמנת רכש',
            orderNumber: 'מספר הזמנה',
            orderDate: 'תאריך הזמנה',
            deliveryDate: 'תאריך משלוח',
            vendor: 'ספק',
            household: 'משק בית',
            contact: 'איש קשר',
            contactPhone: 'טלפון איש קשר',
            customer: 'לקוח',
            address: 'כתובת',
            entranceCode: 'קוד כניסה',
            deliveryNotes: 'הערות משלוח',
            items: 'פריטים',
            rowNumber: '#',
            sku: 'מק"ט',
            productName: 'פריט',
            category: 'קטגוריה',
            quantity: 'כמות',
            unit: 'יחידה',
            pickerNotes: 'הערות למלקט'
        }
    };

    // Format date
    const orderDate = formatDate(order.created_date, isRTL);
    
    // Prepare customer information
    const householdName = household ? (isRTL ? (household.name_hebrew || household.name) : household.name) : 'N/A';
    const householdCode = order.household_code || household?.household_code || 'N/A';
    const contactName = order.household_lead_name || household?.lead_name || 'N/A';
    const contactPhone = order.household_lead_phone || household?.lead_phone || 'N/A';
    const customerName = order.household_lead_name || order.user_email || 'N/A';
    
    // Build address string
    const addressParts = [
        order.building_number,
        order.street,
        order.neighborhood
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : (order.delivery_address || 'N/A');
    const entranceCode = order.entrance_code || 'N/A';

    return `
    <!DOCTYPE html>
    <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'he' : 'en'}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t(translations, lang, 'purchaseOrder')} - ${order.order_number}</title>
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
            
            /* Critical BiDi text handling for mixed Hebrew/English content */
            .ltr {
                direction: ltr !important;
                unicode-bidi: isolate !important;
                display: inline-block;
                font-family: 'Noto Sans', Arial, monospace;
            }
            
            .english-text {
                direction: ltr !important;
                unicode-bidi: isolate !important;
                display: inline-block;
                font-family: 'Noto Sans', Arial, sans-serif;
            }
            
            /* Ensure numbers, codes, emails always render LTR */
            .order-number, .sku, .price, .phone, .email, .code {
                direction: ltr !important;
                unicode-bidi: isolate !important;
                display: inline-block;
                font-family: 'Noto Sans', monospace;
                font-weight: bold;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                direction: ${isRTL ? 'rtl' : 'ltr'};
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
            }
            .header h1 {
                font-size: 28px;
                margin: 0;
                color: #2c3e50;
            }
            .header-info {
                text-align: ${isRTL ? 'left' : 'right'};
                font-size: 14px;
            }
            .section {
                margin-bottom: 25px;
            }
            .section h2 {
                font-size: 20px;
                margin-bottom: 15px;
                color: #2c3e50;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
            }
            
            /* Updated table styles to match delivery PDF - no gaps */
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
                margin: 0;
                border-spacing: 0;
            }

            .items-table th { 
                background-color: #f2f2f2; 
                font-weight: bold; 
                font-size: 10pt;
            }
            
            .items-table td { 
                font-size: 10pt;
            }

            .items-table .center {
                text-align: center;
            }

            .items-table .number {
                text-align: center;
                font-weight: bold;
                vertical-align: middle;
            }

            .items-table .sku {
                text-align: center;
                font-family: 'Noto Sans', monospace;
                font-weight: 500;
                vertical-align: middle;
                font-size: 10pt;
            }

            .items-table .product-name {
                min-width: 150px;
                font-weight: 500;
            }

            .items-table .category {
                text-align: center;
                font-size: 10pt;
            }

            .items-table .quantity {
                text-align: center;
                font-weight: bold;
                vertical-align: middle;
            }

            .items-table .unit {
                text-align: center;
                vertical-align: middle;
                font-size: 10pt;
            }

            .items-table .notes {
                vertical-align: top;
                font-size: 9pt;
                line-height: 1.2;
            }
            
            .customer-info {
                margin-bottom: 20px;
            }
            .customer-info h3 {
                margin: 0 0 10px 0;
                font-size: 16px;
                color: #2c3e50;
            }
            .customer-info p {
                margin: 5px 0;
                font-size: 14px;
            }
            .header-left {
                flex: 1;
            }
            .header-right {
                flex: 1;
                text-align: ${isRTL ? 'left' : 'right'};
            }
            .order-info p {
                margin: 10px 0;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-left">
                    <h1>${t(translations, lang, 'purchaseOrder')}</h1>
                    <div class="order-info">
                        <p><strong>${t(translations, lang, 'orderNumber')}:</strong><br/>
                        <span class="ltr order-number">${order.order_number}</span></p>
                        <p><strong>${t(translations, lang, 'orderDate')}:</strong><br/>
                        <span class="ltr">${orderDate}</span></p>
                        <p><strong>${t(translations, lang, 'deliveryDate')}:</strong><br/>
                        <span class="ltr">${order.delivery_time || 'N/A'}</span></p>
                    </div>
                </div>
                <div class="header-right">
                    <div class="customer-info">
                        <h3>${t(translations, lang, 'vendor')}</h3>
                        <p><strong>${vendor ? (isRTL ? (vendor.name_hebrew || vendor.name) : vendor.name) : 'N/A'}</strong></p>
                        <p><span class="ltr email">${vendor?.contact_email || 'N/A'}</span></p>
                    </div>
                    <div class="customer-info" style="margin-top: 20px;">
                        <p><strong>${t(translations, lang, 'household')}:</strong> ${householdName} <span class="ltr">(<span class="code">${householdCode}</span>)</span></p>
                        <p><strong>${t(translations, lang, 'contact')}:</strong> ${contactName}</p>
                        <p><strong>${t(translations, lang, 'contactPhone')}:</strong> <span class="ltr phone">${contactPhone}</span></p>
                        <p><strong>${t(translations, lang, 'customer')}:</strong> ${customerName}</p>
                        <p><strong>${t(translations, lang, 'address')}:</strong> ${fullAddress}</p>
                        <p><strong>${t(translations, lang, 'entranceCode')}:</strong> <span class="ltr code">${entranceCode}</span></p>
                        <p><strong>${t(translations, lang, 'deliveryNotes')}:</strong> ${order.delivery_notes || 'N/A'}</p>
                    </div>
                </div>
            </div>

            ${order.delivery_notes ? `
            <div class="section">
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-right: 4px solid #007bff;">
                    <p style="margin: 0; font-weight: bold; color: #007bff;">${t(translations, lang, 'deliveryNotes')}:</p>
                    <p style="margin: 5px 0 0 0; color: #333;">${order.delivery_notes}</p>
                </div>
            </div>
            ` : ''}

            <div class="section">
                <h2>${t(translations, lang, 'items')}</h2>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="number center">${t(translations, lang, 'rowNumber')}</th>
                            <th class="sku center">${t(translations, lang, 'sku')}</th>
                            <th class="product-name">${t(translations, lang, 'productName')}</th>
                            <th class="category center">${t(translations, lang, 'category')}</th>
                            <th class="quantity center">${t(translations, lang, 'quantity')}</th>
                            <th class="unit center">${t(translations, lang, 'unit')}</th>
                            <th class="notes">${t(translations, lang, 'pickerNotes')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map((item, index) => {
                            const quantity = typeof item.actual_quantity === 'number' ? item.actual_quantity : item.quantity;
                            const productName = isRTL && item.product_name_hebrew ? item.product_name_hebrew : item.product_name;
                            const category = isRTL && item.subcategory_hebrew ? item.subcategory_hebrew : item.subcategory;
                            
                            return `
                            <tr>
                                <td class="number center"><span class="english-text">${index + 1}</span></td>
                                <td class="sku center"><span class="english-text">${item.sku || ''}</span></td>
                                <td class="product-name">${productName}</td>
                                <td class="category center">${category || ''}</td>
                                <td class="quantity center"><span class="english-text">${quantity}</span></td>
                                <td class="unit center">${item.unit || 'יחידה'}</td>
                                <td class="notes">${item.vendor_notes || ''}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    `;
}