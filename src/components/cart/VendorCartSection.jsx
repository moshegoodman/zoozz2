
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCart } from "./CartContext";
import CartItemCard from "./CartItemCard";
import OrderSummary from "./OrderSummary";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chat } from "@/entities/all";
import VendorChatDialog from "../chat/VendorChatDialog";
import { useLanguage } from '../i18n/LanguageContext';


export default function VendorCartSection({ vendor, items, onPlaceOrder, isPlacingOrder }) {
    const { t, language } = useLanguage();
    const { updateQuantity, removeFromCart, clearCart, user, selectedHousehold, shoppingForHousehold } = useCart();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
    const [currentChat, setCurrentChat] = useState(null);

    const handleUpdateQuantity = async (itemId, newQuantity) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await updateQuantity(itemId, newQuantity);
        } catch (error) {
            console.error("Error updating quantity:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemoveItem = async (itemId) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await removeFromCart(itemId);
        } catch (error) {
            console.error("Error removing item:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const subtotal = items.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);

    const minimumOrder = vendor?.minimum_order || 0;
    const deliveryFeeAmount = vendor?.delivery_fee || 0;
    const deliveryFee = subtotal >= minimumOrder ? 0 : deliveryFeeAmount;
    const total = subtotal + deliveryFee;

    const handlePlaceOrderWrapper = (deliveryDetails) => {
        onPlaceOrder(deliveryDetails);
    };

    const handleChatClick = async () => {
        if (!user) {
            alert(t("cart.chatSignInRequired"));
            return;
        }

        // Add defensive checks
        if (!vendor || !vendor.id) {
            console.error("Chat Error: Vendor data missing", { vendor });
            alert("Could not initialize chat: Vendor information missing");
            return;
        }

        console.log("🚀 Starting chat initialization", {
            userType: user.user_type,
            vendorId: vendor.id,
            selectedHousehold: selectedHousehold?.id,
            shoppingForHousehold: typeof shoppingForHousehold === 'string' ? shoppingForHousehold : shoppingForHousehold?.id
        });

        let householdId = null;
        let chatType = "household_vendor_chat"; // Keep consistent
        let chatFilterCriteria = {};
        
        try {
            // Determine chat context based on user type
            if (user.user_type === 'kcs staff' && selectedHousehold) {
                householdId = selectedHousehold.id;
                chatFilterCriteria = {
                    vendor_id: vendor.id,
                    household_id: householdId,
                    chat_type: "household_vendor_chat"
                };
            } else if ((user.user_type === 'vendor' || user.user_type === 'picker' || user.user_type === 'admin' || user.user_type === 'chief of staff') && shoppingForHousehold) {
                // Handle both string ID and object cases
                householdId = typeof shoppingForHousehold === 'string' ? shoppingForHousehold : shoppingForHousehold.id;
                chatFilterCriteria = {
                    vendor_id: vendor.id,
                    household_id: householdId,
                    chat_type: "household_vendor_chat"
                };
            } else if (user.user_type === 'household owner' && user.household_id) {
                // Household owners use their assigned household
                householdId = user.household_id;
                chatFilterCriteria = {
                    vendor_id: vendor.id,
                    household_id: householdId,
                    chat_type: "household_vendor_chat"
                };
            } else {
                // Regular customers (customerApp) - use customer email based chat
                chatFilterCriteria = {
                    vendor_id: vendor.id,
                    customer_email: user.email,
                    chat_type: "household_vendor_chat"
                };
            }

            console.log("🔍 Chat filter criteria:", chatFilterCriteria);

            const existingChats = await Chat.filter(chatFilterCriteria);
            console.log("📋 Found existing chats:", existingChats.length);

            let chat;
            if (existingChats.length > 0) {
                chat = existingChats[0];
                console.log("✅ Using existing chat:", chat.id);
            } else {
                console.log("🆕 Creating new chat...");
                
                // Create new chat with appropriate data structure
                const chatData = {
                    customer_email: user.email,
                    vendor_id: vendor.id,
                    vendor_name: vendor.name, // Added this line from the outline
                    vendor_name_hebrew: vendor.name_hebrew || '', // Added this line from the outline
                    chat_type: "household_vendor_chat",
                    messages: [{
                        sender_email: user.email,
                        sender_type: user.user_type === 'admin' || user.user_type === 'chief of staff' ? 'admin' : 'customer',
                        message: t("cart.initialChatMessage", {defaultValue:"Hello! I'd like to chat about my cart."}),
                        timestamp: new Date().toISOString(),
                        read: false
                    }],
                    status: "active",
                    last_message_at: new Date().toISOString()
                };

                // Add household information if available
                if (householdId) {
                    const householdContext = selectedHousehold || 
                        (typeof shoppingForHousehold === 'object' ? shoppingForHousehold : null) ||
                        (user.user_type === 'household owner' ? { id: user.household_id, name: 'My Household' } : null);
                    
                    if (householdContext) {
                        chatData.household_id = householdId;
                        chatData.household_name = householdContext.name;
                        chatData.household_name_hebrew = householdContext.name_hebrew;
                        chatData.household_code = householdContext.household_code;
                    }
                }

                console.log("📝 Chat data to create:", chatData);
                // The following two lines were removed as per the outline, they are now part of the chatData object literal initialization
                // chatData.vendor_name=vendor.name;
                // chatData.vendor_name_hebrew=vendor.name_hebrew;
                chat = await Chat.create(chatData);
                console.log("✅ Created new chat:", chat.id);
            }

            console.log("🎯 About to set chat state and open dialog");
            setCurrentChat(chat);
            console.log("✅ Chat state set successfully");
            setIsChatDialogOpen(true);
            console.log("✅ Dialog opened successfully");
        } catch (error) {
            console.error("❌ Chat initialization error:", error);
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
                userType: user.user_type,
                vendorId: vendor.id,
                chatFilterCriteria
            });
            alert(`Could not initialize chat: ${error.message}`);
        }
    };

    const handleChatUpdate = async () => {
        if (currentChat) {
            try {
                const updatedChat = await Chat.filter({
                    id: currentChat.id
                });
                if (updatedChat.length > 0) {
                    setCurrentChat(updatedChat[0]);
                }
            } catch (error) {
                console.error("Error updating chat:", error);
            }
        }
    };

    return (
        <>
            <Card className="overflow-hidden">
                <CardHeader className="bg-gray-50 pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                            {t('cart.cartFrom', { vendorName: vendor?.name || t('common.store') })}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleChatClick}
                                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                {t('cart.chatWithVendor')}
                            </Button>
                           
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-5">
                        <div className="lg:col-span-3 p-4 border-b lg:border-b-0 lg:border-r border-gray-200">
                            <h3 className="font-semibold text-gray-900 mb-3">{t('cart.itemsCount', { count: items.length })}</h3>
                            <div className="space-y-3 max-h-[680px] overflow-y-auto">
                                {items.map((item) => (
                                    <CartItemCard
                                        key={item.id}
                                        item={item}
                                        onUpdateQuantity={handleUpdateQuantity}
                                        onRemove={handleRemoveItem}
                                        isUpdating={isUpdating}
                                        userType={user?.user_type}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-2 p-4 bg-gray-50">
                            <OrderSummary
                                subtotal={subtotal}
                                deliveryFee={deliveryFee}
                                total={total}
                                cartItems={items}
                                vendor={vendor}
                                user={user}
                                shoppingForHousehold={shoppingForHousehold}
                                onPlaceOrder={handlePlaceOrderWrapper}
                                isPlacingOrder={isPlacingOrder}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <VendorChatDialog
                isOpen={isChatDialogOpen}
                onClose={() => {
                    setIsChatDialogOpen(false);
                    setCurrentChat(null);
                }}
                vendor={vendor}
                chat={currentChat}
                onChatUpdate={handleChatUpdate}
                user={user}
                household={selectedHousehold || (typeof shoppingForHousehold === 'object' ? shoppingForHousehold : null) || (user?.user_type === 'household owner' && user.household_id ? { id: user.household_id, name: 'My Household' } : null)}
            />
        </>
    );
}
