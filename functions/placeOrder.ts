import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// This helper function is duplicated from the frontend to make this function self-contained.
function generateOrderNumber(vendorId, householdId) {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const datePart = `D${year}${month}${day}`;
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const timePart = `H${hours}${minutes}`;
  const householdPart = `C${(householdId || '0000').slice(-4)}`;
  const vendorPart = `V${(vendorId || '0000').slice(-4)}`;
  const runningNumber = Date.now().toString().slice(-4).padStart(4, '0');
  return `PO-${datePart}-${timePart}-${householdPart}-${vendorPart}-${runningNumber}`;
}

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            vendorId, 
            itemsForVendor, 
            deliveryDetails, 
            shoppingForHousehold, 
            selectedHousehold,
            vendor: vendorFromClient
        } = await req.json();

        console.log('📦 Place Order Request:', {
            vendorId,
            itemCount: itemsForVendor?.length,
            language: deliveryDetails?.language,
            userEmail: user.email
        });

        if (!itemsForVendor || !Array.isArray(itemsForVendor) || itemsForVendor.length === 0) {
            console.error('❌ Missing or empty cart items');
            return Response.json({ success: false, error: 'Missing or empty cart items' }, { status: 400 });
        }
        if (!deliveryDetails) {
            console.error('❌ Missing delivery details');
            return Response.json({ success: false, error: 'Missing delivery details' }, { status: 400 });
        }

        // Extract language from deliveryDetails
        const language = deliveryDetails.language || 'Hebrew';
        
        // Determine currency based on language
        const orderCurrency = language === 'English' ? 'USD' : 'ILS';
        const orderLanguage = language;
        
        // Conversion rate
        const ILS_TO_USD_RATE = 3.24;

        console.log('💱 Order currency settings:', { language, orderCurrency, orderLanguage });

        // Determine household ID from either shoppingForHousehold or selectedHousehold
        let householdId = null;
        if (shoppingForHousehold?.id) {
            householdId = shoppingForHousehold.id;
        } else if (selectedHousehold?.id) {
            householdId = selectedHousehold.id;
        }

        let household = null;
        if (householdId) {
            try {
                household = await base44.asServiceRole.entities.Household.get(householdId);
                console.log('🏠 Household loaded:', household?.name);
            } catch (error) {
                console.warn(`⚠️ Household with ID ${householdId} not found:`, error.message);
            }
        }

        // Enforce active season restriction: orders can only be placed for the active season's households
        if (household) {
            const settingsList = await base44.asServiceRole.entities.AppSettings.list();
            const activeSeason = settingsList?.[0]?.activeSeason;
            if (activeSeason && household.season !== activeSeason) {
                console.warn(`🚫 Order blocked: household season "${household.season}" does not match active season "${activeSeason}"`);
                return Response.json({ 
                    success: false, 
                    error: `Orders can only be placed for the current season (${activeSeason}). This household belongs to season "${household.season}".` 
                }, { status: 403 });
            }
        }

        // Group cart items by vendor
        const itemsByVendor = itemsForVendor.reduce((acc, item) => {
            const vid = item.vendor_id || vendorId;
            if (!vid) {
                console.warn(`⚠️ Cart item with product_id ${item.product_id} is missing vendor_id, skipping.`);
                return acc;
            }
            if (!acc[vid]) acc[vid] = [];
            acc[vid].push(item);
            return acc;
        }, {});

        console.log('📊 Items grouped by vendor:', Object.keys(itemsByVendor));

        const createdOrders = [];

        for (const [currentVendorId, items] of Object.entries(itemsByVendor)) {
            if (vendorId && currentVendorId !== vendorId) {
                console.log(`⏭️ Skipping vendor ${currentVendorId} (not the target vendor)`);
                continue;
            }

            console.log(`🏪 Processing vendor ${currentVendorId} with ${items.length} items`);

            // Use vendor data passed from client to avoid cross-environment DB lookup issues
            const vendor = vendorFromClient || await base44.asServiceRole.entities.Vendor.get(currentVendorId);
            if (!vendor) {
                const errorMsg = `Vendor with ID ${currentVendorId} not found`;
                console.error('❌', errorMsg);
                throw new Error(errorMsg);
            }

            console.log('✅ Vendor loaded:', vendor.name);

            // Note: product_price in cart items was already set based on household_type
            // (price_customer_app for 'private' households, price_customer_kcs for 'kcs' households)
            // at the time the item was added to the cart via CartContext.getProductPrice.
            const orderItems = items.map(item => {
                let itemPrice = item.product_price; // Correct price already set by CartContext
                
                // Convert to USD if placing English order
                if (orderCurrency === 'USD') {
                    itemPrice = itemPrice / ILS_TO_USD_RATE;
                    console.log(`💱 Converted item ${item.product_name}: ₪${item.product_price} → $${itemPrice.toFixed(2)}`);
                }
                
                return {
                    product_id: item.product_id,
                    sku: item.sku || '',
                    product_name: item.product_name,
                    product_name_hebrew: item.product_name_hebrew,
                    subcategory: item.subcategory,
                    subcategory_hebrew: item.subcategory_hebrew,
                    quantity: item.quantity,
                    quantity_per_unit: item.quantity_in_unit,
                    actual_quantity: null,
                    price: itemPrice, // Now in correct currency
                    unit: item.unit,
                    shopped: false,
                    available: true,
                    is_returned: false,
                    amount_returned: null,
                };
            });

            const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // Convert delivery fee to USD if order is in English
            let deliveryFee = vendor.delivery_fee || 0;
            if (orderCurrency === 'USD' && deliveryFee > 0) {
                const originalIlsDeliveryFee = deliveryFee;
                deliveryFee = deliveryFee / ILS_TO_USD_RATE;
                console.log(`🚚 Delivery fee converted for USD order: ₪${originalIlsDeliveryFee} → $${deliveryFee.toFixed(2)}`);
            }
            
            const totalAmount = subtotal + deliveryFee;

            console.log('💰 Order totals:', { 
                subtotal: subtotal.toFixed(2), 
                deliveryFee: deliveryFee.toFixed(2), 
                totalAmount: totalAmount.toFixed(2),
                currency: orderCurrency 
            });

            const orderNumber = generateOrderNumber(currentVendorId, householdId);
            console.log('🔢 Generated order number:', orderNumber);

            const orderData = {
                order_number: orderNumber,
                user_email: user.email,
                vendor_id: currentVendorId,
                vendor_name: vendor.name,
                vendor_name_hebrew: vendor.name_hebrew,
                items: orderItems,
                total_amount: totalAmount,
                delivery_price: deliveryFee,
                order_currency: orderCurrency,
                order_language: orderLanguage,
                status: 'pending',
                neighborhood: deliveryDetails.neighborhood || '',
                street: deliveryDetails.street || '',
                building_number: deliveryDetails.building_number || '',
                household_number: deliveryDetails.household_number || '',
                entrance_code: deliveryDetails.entrance_code || '',
                delivery_time: deliveryDetails.time || '',
                phone: deliveryDetails.phone || '',
                delivery_notes: deliveryDetails.notes || '',
                payment_status: 'none',
                payment_method: 'none',
                is_paid: false,
            };

            if (householdId && household) {
                orderData.household_id = householdId;
                orderData.household_code = household.household_code;
                orderData.household_name = household.name;
                orderData.household_name_hebrew = household.name_hebrew;
                orderData.household_lead_name = household.lead_name;
                orderData.household_lead_phone = household.lead_phone;
            }

            // Construct delivery_address
            const addressParts = [
                orderData.neighborhood,
                orderData.street,
                orderData.building_number,
                orderData.household_number
            ].filter(Boolean);
            orderData.delivery_address = addressParts.join(', ') || deliveryDetails.address || 'Address to be confirmed';

            console.log('📝 Creating order in database...');
            const createdOrder = await base44.asServiceRole.entities.Order.create(orderData);
            console.log('✅ Order created successfully:', createdOrder.id);
            
            createdOrders.push(createdOrder);
        }

        if (createdOrders.length === 0) {
            const errorMsg = 'No orders were created';
            console.error('❌', errorMsg);
            return Response.json({ success: false, error: errorMsg }, { status: 400 });
        }

        console.log('🎉 Place order completed successfully');
        return Response.json({ 
            success: true, 
            order: createdOrders[0],
            orders: createdOrders
        }, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('❌ Error in placeOrder function:', error);
        console.error('Stack trace:', error.stack);
        return Response.json({ 
            success: false, 
            error: error.message, 
            details: error.stack 
        }, { status: 500 });
    }
});