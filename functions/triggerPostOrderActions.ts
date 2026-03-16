import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const sdk = base44.asServiceRole;

        const { orderId, order, language } = await req.json();

        // Handle both orderId and order parameters for backward compatibility
        let orderData = order;
        if (!orderData && orderId) {
            try {
                orderData = await sdk.entities.Order.get(orderId);
            } catch (error) {
                console.error('Failed to fetch order:', error);
                return Response.json({ 
                    success: false, 
                    error: 'Order not found',
                    details: error.message 
                }, { status: 404 });
            }
        }

        if (!orderData) {
            return Response.json({ 
                success: false, 
                error: 'Order data or orderId is required' 
            }, { status: 400 });
        }

        console.log('🚀 Starting post-order actions for order:', orderData.order_number);

        // Track all errors but don't fail the entire process
        const errors = [];
        const results = {
            pdfGenerated: false,
            vendorEmailSent: false,
            customerEmailSent: false,
            vendorSmsSent: false,
            customerSmsSent: false,
            vendorNotificationCreated: false,
            customerNotificationCreated: false
        };

        // Fetch vendor information
        let vendor = null;
        if (orderData.vendor_id) {
            try {
                vendor = await sdk.entities.Vendor.get(orderData.vendor_id);
                console.log('✅ Vendor fetched successfully:', vendor.name);
            } catch (error) {
                console.error('❌ Failed to fetch vendor:', error);
                errors.push({ step: 'fetch_vendor', error: error.message });
            }
        }

        // Define vendorName for consistent use in messages
        const vendorName = vendor?.name_hebrew || vendor?.name || (language === 'Hebrew' ? 'הספק' : 'the Vendor');

        // Generate Purchase Order PDF for attachment (use Hebrew)
        let pdfAttachment = null;
        try {
            console.log('📄 Starting PDF generation...');
            
            const pdfResponse = await sdk.functions.invoke('generatePurchaseOrderPDF', {
                order: orderData,
                language: 'Hebrew'
            });

            console.log('📄 PDF generation response received');

            if (pdfResponse && pdfResponse.data && pdfResponse.data.success && pdfResponse.data.pdfBase64) {
                const base64Data = pdfResponse.data.pdfBase64;
                
                pdfAttachment = {
                    content: base64Data,
                    filename: `PO-${orderData.order_number}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment'
                };
                
                results.pdfGenerated = true;
                console.log('✅ PDF generated successfully');
            } else {
                const pdfError = `PDF generation returned unsuccessful: ${pdfResponse?.data?.error || 'Unknown error'}`;
                console.error('❌', pdfError);
                errors.push({ step: 'generate_pdf', error: pdfError });
            }
        } catch (pdfError) {
            console.error('❌ PDF generation threw an error:', pdfError.message);
            errors.push({ step: 'generate_pdf', error: pdfError.message });
        }

        // Send email to vendor if contact email exists (in Hebrew)
        if (vendor && vendor.contact_email) {
            try {
                console.log('📧 Preparing vendor email...');
                
                const vendorEmailContent = generateVendorOrderEmailHebrew(orderData, vendor);
                
                const emailData = {
                    to: vendor.contact_email,
                    subject: `הזמנה חדשה התקבלה - ${orderData.order_number}`,
                    body: vendorEmailContent.html, // Using 'body' as per SendGrid API
                    fromName: 'Zoozz' // Add proper sender name
                };

                // Add PDF attachment if available
                if (pdfAttachment) {
                    emailData.attachments = [pdfAttachment];
                    console.log('✅ Added PDF attachment to vendor email');
                } else {
                    console.warn('❌ No PDF attachment available for vendor email');
                }

                console.log('📧 Calling sendGridEmail for vendor...');
                const emailResponse = await sdk.functions.invoke('sendGridEmail', emailData);
                
                if (emailResponse?.data?.success) {
                    results.vendorEmailSent = true;
                    console.log('✅ Vendor notification email sent successfully to:', vendor.contact_email);
                } else {
                    const emailError = `SendGrid vendor email failed: ${emailResponse?.data?.error || 'Unknown error'}`;
                    console.error('❌', emailError);
                    errors.push({ step: 'send_vendor_email', error: emailError });
                }
            } catch (emailError) {
                console.error('❌ Vendor email sending threw an error:', emailError.message);
                errors.push({ step: 'send_vendor_email', error: emailError.message });
            }
        } else {
            console.warn('❌ Cannot send vendor email - missing vendor or contact email:', {
                hasVendor: !!vendor,
                vendorName: vendor?.name,
                hasContactEmail: !!vendor?.contact_email,
                contactEmail: vendor?.contact_email
            });
            errors.push({ step: 'send_vendor_email', error: 'Missing vendor or contact email' });
        }

        // Send SMS to vendor
        try {
            await sdk.functions.invoke('sendOrderSMS', {
                orderId: orderData.id,
                messageType: 'new_order',
                recipientType: 'vendor',
                language: language // Pass language for proper formatting
            });
            results.vendorSmsSent = true;
            console.log('✅ Vendor SMS notification sent.');
        } catch (smsError) {
            console.warn('❌ Failed to send vendor SMS notification:', smsError.message);
            errors.push({ step: 'send_vendor_sms', error: smsError.message });
        }

        // Send SMS to customer
        try {
            await sdk.functions.invoke('sendOrderSMS', {
                orderId: orderData.id,
                messageType: 'order_placed',
                recipientType: 'customer',
                language: language // Pass language for proper formatting
            });
            results.customerSmsSent = true;
            console.log('✅ Customer SMS notification sent.');
        } catch (smsError) {
            console.warn('❌ Failed to send customer SMS notification:', smsError.message);
            errors.push({ step: 'send_customer_sms', error: smsError.message });
        }

        // Create notification for customer
        try {
            await sdk.entities.Notification.create({
                user_email: orderData.user_email,
                title: language === 'Hebrew' ? 'ההזמנה אושרה' : 'Order Confirmed',
                message: language === 'Hebrew' 
                    ? `ההזמנה שלך מ-${vendorName} אושרה`
                    : `Your order from ${vendorName} has been confirmed`,
                type: 'order_update',
                order_id: orderData.id,
                vendor_id: orderData.vendor_id,
                is_read: false
            });
            results.customerNotificationCreated = true;
            console.log('✅ Customer notification created.');
        } catch (notifError) {
            console.warn('❌ Failed to create customer notification:', notifError.message);
            errors.push({ step: 'create_customer_notification', error: notifError.message });
        }

        // Create notification for vendor
        if (vendor?.contact_email) {
            try {
                await sdk.entities.Notification.create({
                    user_email: vendor.contact_email,
                    title: language === 'Hebrew' ? 'הזמנה חדשה התקבלה' : 'New Order Received',
                    message: language === 'Hebrew'
                        ? `הזמנה חדשה מ-${orderData.household_name || orderData.user_email}`
                        : `New order from ${orderData.household_name || orderData.user_email}`,
                    type: 'order_update',
                    order_id: orderData.id,
                    vendor_id: orderData.vendor_id,
                    is_read: false
                });
                results.vendorNotificationCreated = true;
                console.log('✅ Vendor notification created.');
            } catch (notifError) {
                console.warn('❌ Failed to create vendor notification:', notifError.message);
                errors.push({ step: 'create_vendor_notification', error: notifError.message });
            }
        }

        // Send customer confirmation email (in Hebrew, WITH PDF attachment)
        try {
            console.log('📧 Preparing customer email...');
            const customerEmailContent = generateCustomerOrderEmailHebrew(orderData, vendor);
            
            const customerEmailData = {
                to: orderData.user_email,
                subject: `אישור הזמנה - ${orderData.order_number}`,
                body: customerEmailContent.html, // Using 'body' as per SendGrid API
                fromName: 'Zoozz' // Add proper sender name
            };

            // Add PDF attachment to customer email as well
            if (pdfAttachment) {
                customerEmailData.attachments = [pdfAttachment];
                console.log('✅ Added PDF attachment to customer email');
            } else {
                console.warn('❌ No PDF attachment available for customer email');
            }

            console.log('📧 Calling sendGridEmail for customer...');
            const customerEmailResponse = await sdk.functions.invoke('sendGridEmail', customerEmailData);

            if (customerEmailResponse?.data?.success) {
                results.customerEmailSent = true;
                console.log(`✅ Customer confirmation email sent successfully to: ${orderData.user_email}`);
            } else {
                const emailError = `SendGrid customer email failed: ${customerEmailResponse?.data?.error || 'Unknown error'}`;
                console.error('❌', emailError);
                errors.push({ step: 'send_customer_email', error: emailError });
            }
        } catch (customerEmailError) {
            console.error('❌ Customer email sending threw an error:', customerEmailError.message);
            errors.push({ step: 'send_customer_email', error: customerEmailError.message });
        }

        const finalResult = {
            success: errors.length === 0,
            results,
            errors: errors.length > 0 ? errors : undefined,
            orderNumber: orderData.order_number
        };

        console.log('🏁 Post-order actions complete:', finalResult);
        
        return Response.json(finalResult);

    } catch (error) {
        console.error('💥 Critical error in triggerPostOrderActions:', error);
        return Response.json({ 
            success: false, 
            error: 'Critical error in post-order actions',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});

// Helper function to generate Hebrew vendor order email content (NO PRICES)
function generateVendorOrderEmailHebrew(order, vendor) {
    const itemsHtml = order.items.map(item => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.product_name_hebrew || item.product_name}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.unit || 'יחידה'}</td>
        </tr>
    `).join('');

    const deliveryInfo = [
        order.delivery_time ? `זמן אספקה: ${order.delivery_time}` : '',
        order.neighborhood ? `שכונה: ${order.neighborhood}` : '',
        order.street ? `כתובת: ${order.street} ${order.building_number || ''}` : '',
        order.household_number ? `יחידה: ${order.household_number}` : '',
        order.entrance_code ? `קוד כניסה: ${order.entrance_code}` : '',
        order.phone ? `טלפון ליצירת קשר: ${order.phone}` : '',
        order.delivery_notes ? `הערות: ${order.delivery_notes}` : ''
    ].filter(Boolean).join('<br>');

    const html = `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; direction: rtl; text-align: right;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">הזמנה חדשה התקבלה</h2>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #1f2937;">פרטי הזמנה</h3>
                <p><strong>מספר הזמנה:</strong> ${order.order_number}</p>
                <p><strong>לקוח:</strong> ${order.user_email}</p>
                ${order.household_name ? `<p><strong>משק בית:</strong> ${order.household_name_hebrew || order.household_name} (#${order.household_code || 'N/A'})</p>` : ''}
                <p><strong>תאריך הזמנה:</strong> ${new Date(order.created_date).toLocaleString('he-IL')}</p>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="color: #1f2937;">פריטים שהוזמנו</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; direction: rtl;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">מוצר</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">כמות</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">יחידה</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div style="text-align: center; margin-top: 15px; font-weight: bold; font-size: 16px;">
                    סה"כ פריטים: ${order.items.length}
                </div>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #92400e;">מידע משלוח</h3>
                <div style="line-height: 1.6;">${deliveryInfo}</div>
            </div>

            <div style="background: #dbeafe; padding: 15px; border-radius: 8px; color: #1e40af;">
                <p style="margin: 0;"><strong>📋 הזמנת הרכש מצורפת למייל זה לתיעוד.</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 14px;">אנא עבדו על ההזמנה ועדכנו את הסטטוס בפאנל הספק שלכם.</p>
            </div>
        </div>
    `;

    const text = `
הזמנה חדשה התקבלה - ${order.order_number}

פרטי הזמנה:
- מספר הזמנה: ${order.order_number}
- לקוח: ${order.user_email}
${order.household_name ? `- משק בית: ${order.household_name_hebrew || order.household_name} (#${order.household_code || 'N/A'})` : ''}
- תאריך הזמנה: ${new Date(order.created_date).toLocaleString('he-IL')}

פריטים:
${order.items.map(item => `- ${item.product_name_hebrew || item.product_name} (כמות: ${item.quantity}) - ${item.unit || 'יחידה'}`).join('\n')}

סה"כ פריטים: ${order.items.length}

מידע משלוח:
${[
    order.delivery_time ? `זמן אספקה: ${order.delivery_time}` : '',
    order.neighborhood ? `שכונה: ${order.neighborhood}` : '',
    order.street ? `כתובת: ${order.street} ${order.building_number || ''}` : '',
    order.household_number ? `יחידה: ${order.household_number}` : '',
    order.entrance_code ? `קוד כניסה: ${order.entrance_code}` : '',
    order.phone ? `טלפון ליצירת קשר: ${order.phone}` : '',
    order.delivery_notes ? `הערות: ${order.delivery_notes}` : ''
].filter(Boolean).join('\n')}

הזמנת הרכש מצורפת למייל זה לתיעוד.
אנא עבדו על ההזמנה ועדכנו את הסטטוס בפאנל הספק שלכם.
    `;

    return { html, text };
}

// Helper function to generate Hebrew customer order email content (NO PRICES)
function generateCustomerOrderEmailHebrew(order, vendor) {
    const itemsHtml = order.items.map(item => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.product_name_hebrew || item.product_name}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.unit || 'יחידה'}</td>
        </tr>
    `).join('');

    const html = `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; direction: rtl; text-align: right;">
            <h2 style="color: #16a34a; margin-bottom: 20px;">אישור הזמנה</h2>
            
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #166534;">תודה על ההזמנה!</h3>
                <p>ההזמנה שלך התקבלה בהצלחה ונשלחה ל${vendor?.name_hebrew || vendor?.name || 'הספק'}.</p>
                <p><strong>מספר הזמנה:</strong> ${order.order_number}</p>
                <p><strong>תאריך הזמנה:</strong> ${new Date(order.created_date).toLocaleString('he-IL')}</p>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="color: #1f2937;">סיכום הזמנה</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; direction: rtl;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">מוצר</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">כמות</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">יחידה</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div style="text-align: center; margin-top: 15px; font-weight: bold; font-size: 16px;">
                    סה"כ פריטים: ${order.items.length}
                </div>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #92400e;">הצעדים הבאים</h3>
                <p style="margin: 0;">• הספק יעבד את ההזמנה שלך</p>
                <p style="margin: 5px 0 0 0;">• תקבל עדכונים על סטטוס ההזמנה</p>
                <p style="margin: 5px 0 0 0;">• זמן אספקה משוער: ${order.delivery_time || 'יקבע בהמשך'}</p>
                <p style="margin: 5px 0 0 0;">• הזמנת הרכש מצורפת לעיון</p>
            </div>
        </div>
    `;

    const text = `
אישור הזמנה - ${order.order_number}

תודה על ההזמנה! ההזמנה שלך התקבלה בהצלחה ונשלחה ל${vendor?.name_hebrew || vendor?.name || 'הספק'}.

פרטי הזמנה:
- מספר הזמנה: ${order.order_number}
- תאריך הזמנה: ${new Date(order.created_date).toLocaleString('he-IL')}

סיכום הזמנה:
${order.items.map(item => `- ${item.product_name_hebrew || item.product_name} (כמות: ${item.quantity}) - ${item.unit || 'יחידה'}`).join('\n')}

סה"כ פריטים: ${order.items.length}

הצעדים הבאים:
• הספק יעבד את ההזמנה שלך
• תקבל עדכונים על סטטוס ההזמנה
• זמן אספקה משוער: ${order.delivery_time || 'יקבע בהמשך'}
• הזמנת הרכש מצורפת לעיון
    `;

    return { html, text };
}