import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sdk = base44.asServiceRole;

        const body = await req.json();
        const { order, vendor, household, language } = body;

        if (!order || !vendor) {
            return Response.json(
                { error: "Missing required order or vendor data" },
                { status: 400 }
            );
        }

        const isHebrew = language === 'he' || language === 'Hebrew';
        const currency = order.order_currency || 'ILS';
        const currencySymbol = currency === 'USD' ? '$' : '₪';

        // CRITICAL: Filter to only show RETURNED items
        const returnedItems = (order.items || []).filter(item => 
            item.is_returned === true && 
            item.amount_returned !== null && 
            item.amount_returned !== undefined &&
            item.amount_returned > 0
        );

        // If no returned items, return error
        if (returnedItems.length === 0) {
            return Response.json(
                { error: "No returned items found in this order" },
                { status: 400 }
            );
        }

        const vendorName = isHebrew && vendor.name_hebrew ? vendor.name_hebrew : vendor.name;
        const householdName = household
            ? (isHebrew && household.name_hebrew ? household.name_hebrew : household.name)
            : (order.household_name || 'Customer');

        const orderNumber = order.order_number || 'N/A';
        const orderDate = order.created_date ? new Date(order.created_date).toLocaleDateString('en-GB') : 'N/A';

        // Build delivery address
        let deliveryAddress = '';
        if (household) {
            const parts = [
                household.street,
                household.building_number,
                household.household_number,
                household.neighborhood
            ].filter(Boolean);
            deliveryAddress = parts.join(', ');
        } else if (order.delivery_address) {
            deliveryAddress = order.delivery_address;
        }

        const hasVAT = vendor.has_vat !== false;

        // Fetch settings for custom fonts
        let hebrewFontUrlRegular = null;
        let hebrewFontUrlBold = null;

        try {
            const settingsData = await sdk.entities.AppSettings.list();
            if (settingsData && settingsData.length > 0) {
                const settings = settingsData[0];
                hebrewFontUrlRegular = settings.hebrewFontUrlRegular || null;
                hebrewFontUrlBold = settings.hebrewFontUrlBold || null;
            }
        } catch (error) {
            console.warn("Could not fetch AppSettings for fonts:", error);
        }

        let fontFaceRegular = '';
        let fontFaceBold = '';
        if (isHebrew) {
            if (hebrewFontUrlRegular) {
                fontFaceRegular = `
                    @font-face {
                        font-family: 'CustomHebrew';
                        src: url('${hebrewFontUrlRegular}') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                    }
                `;
            }
            if (hebrewFontUrlBold) {
                fontFaceBold = `
                    @font-face {
                        font-family: 'CustomHebrew';
                        src: url('${hebrewFontUrlBold}') format('truetype');
                        font-weight: bold;
                        font-style: normal;
                    }
                `;
            }
        }

        const baseFont = isHebrew ? "'CustomHebrew', 'Arial', sans-serif" : "'Arial', sans-serif";

        // Calculate subtotal ONLY from returned items using amount_returned
        const subtotal = returnedItems.reduce((acc, item) => {
            const returnedQuantity = item.amount_returned || 0;
            const price = item.price || 0;
            return acc + (returnedQuantity * price);
        }, 0);

        // No delivery fee on returns
        const deliveryFee = 0;

        const total = subtotal + deliveryFee;

        let taxAmount = 0;
        let preTaxTotal = 0;
        if (hasVAT) {
            preTaxTotal = total / 1.18;
            taxAmount = total - preTaxTotal;
        }

        // Translations
        const translations = {
            he: {
                returnInvoice: 'חשבונית החזרה',
                taxInvoice: 'חשבונית מס',
                vendor: 'ספק',
                customer: 'לקוח',
                orderNumber: 'מספר הזמנה',
                invoiceDate: 'תאריך חשבונית',
                deliveryAddress: 'כתובת משלוח',
                item: 'פריט',
                quantity: 'כמות',
                unitPrice: 'מחיר ליחידה',
                subtotal: 'סכום ביניים',
                deliveryFee: 'דמי משלוח',
                total: 'סה"כ',
                totalBeforeTax: 'סה"כ לפני מע"מ',
                tax: 'מע"מ (18%)',
                totalIncludingTax: 'סה"כ כולל מע"מ',
                pricesIncludeVAT: 'המחירים כוללים מע"מ',
                returnedItemsOnly: 'חשבונית זו מציגה רק פריטים שהוחזרו'
            },
            en: {
                returnInvoice: 'Return Invoice',
                taxInvoice: 'Tax Invoice',
                vendor: 'Vendor',
                customer: 'Customer',
                orderNumber: 'Order Number',
                invoiceDate: 'Invoice Date',
                deliveryAddress: 'Delivery Address',
                item: 'Item',
                quantity: 'Qty',
                unitPrice: 'Unit Price',
                subtotal: 'Subtotal',
                deliveryFee: 'Delivery Fee',
                total: 'Total',
                totalBeforeTax: 'Total Before Tax',
                tax: 'VAT (18%)',
                totalIncludingTax: 'Total Including Tax',
                pricesIncludeVAT: 'Prices include VAT',
                returnedItemsOnly: 'This invoice shows only returned items'
            }
        };

        const t = translations[isHebrew ? 'he' : 'en'];
        const dir = isHebrew ? 'rtl' : 'ltr';
        const textAlign = isHebrew ? 'right' : 'left';

        // Build items HTML - ONLY returned items with amount_returned
        const itemsHTML = returnedItems.map(item => {
            const itemName = isHebrew && item.product_name_hebrew ? item.product_name_hebrew : item.product_name;
            const returnedQuantity = item.amount_returned || 0;
            const price = item.price || 0;
            const itemTotal = returnedQuantity * price;

            return `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${itemName}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${returnedQuantity}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: ${textAlign};">${currencySymbol}${price.toFixed(2)}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: ${textAlign}; font-weight: bold;">${currencySymbol}${itemTotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="${isHebrew ? 'he' : 'en'}" dir="${dir}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t.returnInvoice} - ${orderNumber}</title>
            <style>
                ${fontFaceRegular}
                ${fontFaceBold}
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: ${baseFont};
                    direction: ${dir};
                    background: white;
                    padding: 40px 20px;
                    color: #1f2937;
                }
                
                .invoice-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                }
                
                .invoice-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #dc2626;
                }
                
                .invoice-title {
                    flex: 1;
                }
                
                .invoice-title h1 {
                    font-size: 32px;
                    font-weight: bold;
                    color: #dc2626;
                    margin-bottom: 5px;
                }
                
                .invoice-title p {
                    font-size: 14px;
                    color: #6b7280;
                }
                
                .vendor-info {
                    text-align: ${isHebrew ? 'left' : 'right'};
                }
                
                .vendor-info h2 {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    color: #1f2937;
                }
                
                .info-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-bottom: 30px;
                }
                
                .info-box {
                    background: #f9fafb;
                    padding: 20px;
                    border-radius: 8px;
                }
                
                .info-box h3 {
                    font-size: 14px;
                    color: #6b7280;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .info-box p {
                    font-size: 16px;
                    color: #1f2937;
                    margin-bottom: 5px;
                }
                
                .returned-items-notice {
                    background: #fef3c7;
                    border: 2px solid #f59e0b;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 30px;
                    text-align: center;
                    font-weight: bold;
                    color: #92400e;
                    font-size: 14px;
                }
                
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                
                .items-table thead {
                    background: #f3f4f6;
                }
                
                .items-table th {
                    padding: 12px;
                    text-align: ${textAlign};
                    font-weight: bold;
                    font-size: 14px;
                    color: #374151;
                    border-bottom: 2px solid #e5e7eb;
                }
                
                .items-table td {
                    font-size: 14px;
                    color: #1f2937;
                }
                
                .totals-section {
                    margin-top: 30px;
                    ${isHebrew ? 'margin-right: auto; margin-left: 0;' : 'margin-left: auto; margin-right: 0;'}
                    width: 350px;
                }
                
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    font-size: 16px;
                }
                
                .total-row.grand-total {
                    border-top: 2px solid #dc2626;
                    margin-top: 10px;
                    padding-top: 15px;
                    font-size: 20px;
                    font-weight: bold;
                    color: #dc2626;
                }
                
                .total-row .label {
                    color: #6b7280;
                }
                
                .total-row .value {
                    font-weight: bold;
                    color: #1f2937;
                }
                
                .footer-note {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    font-size: 12px;
                    color: #6b7280;
                }
                
                @media print {
                    body {
                        padding: 0;
                    }
                    
                    .invoice-container {
                        max-width: 100%;
                    }
                }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="invoice-header">
                    <div class="invoice-title">
                        <h1>${t.returnInvoice}</h1>
                        <p>${t.taxInvoice}</p>
                    </div>
                    <div class="vendor-info">
                        <h2>${vendorName}</h2>
                    </div>
                </div>

                <div class="returned-items-notice">
                    ${t.returnedItemsOnly}
                </div>

                <div class="info-section">
                    <div class="info-box">
                        <h3>${t.customer}</h3>
                        <p><strong>${householdName}</strong></p>
                        ${deliveryAddress ? `<p style="font-size: 14px; color: #6b7280;">${deliveryAddress}</p>` : ''}
                    </div>
                    <div class="info-box">
                        <h3>${t.orderNumber}</h3>
                        <p><strong>${orderNumber}</strong></p>
                        <h3 style="margin-top: 15px;">${t.invoiceDate}</h3>
                        <p>${orderDate}</p>
                    </div>
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th>${t.item}</th>
                            <th style="text-align: center;">${t.quantity}</th>
                            <th style="text-align: ${textAlign};">${t.unitPrice}</th>
                            <th style="text-align: ${textAlign};">${t.subtotal}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div class="totals-section">
                    <div class="total-row">
                        <span class="label">${t.subtotal}:</span>
                        <span class="value">${currencySymbol}${subtotal.toFixed(2)}</span>
                    </div>
                    ${deliveryFee > 0 ? `
                    <div class="total-row">
                        <span class="label">${t.deliveryFee}:</span>
                        <span class="value">${currencySymbol}${deliveryFee.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${hasVAT ? `
                    <div class="total-row">
                        <span class="label">${t.totalBeforeTax}:</span>
                        <span class="value">${currencySymbol}${preTaxTotal.toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span class="label">${t.tax}:</span>
                        <span class="value">${currencySymbol}${taxAmount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span class="label">${hasVAT ? t.totalIncludingTax : t.total}:</span>
                        <span class="value">${currencySymbol}${total.toFixed(2)}</span>
                    </div>
                </div>

                ${hasVAT ? `
                <div class="footer-note">
                    <p>${t.pricesIncludeVAT}</p>
                </div>
                ` : ''}
            </div>
        </body>
        </html>
        `;

        return new Response(htmlContent, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    } catch (error) {
        console.error("Error generating return invoice HTML:", error);
        return Response.json(
            { error: error.message || "Failed to generate return invoice HTML" },
            { status: 500 }
        );
    }
});