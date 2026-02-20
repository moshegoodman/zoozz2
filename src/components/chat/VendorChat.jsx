import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chat, User, Vendor, Household, Notification, Order, HouseholdStaff } from "@/entities/all";
import { MessageCircle, Send, Paperclip, Loader2, User as UserIcon, Store, Camera, Mic, Play, Pause, Square, Home, Package, Phone, X, CheckCircle2 } from "lucide-react";
import { UploadFile } from "@/integrations/Core";
import { generatePurchaseOrderHTML } from "@/functions/generatePurchaseOrderHTML";
import { useLanguage } from "../i18n/LanguageContext";
import OrderDetailsModal from "../vendor/OrderDetailsModal";
import { generatePurchaseOrderPDF } from "@/functions/generatePurchaseOrderPDF";
import { generateDeliveryHTML } from "@/functions/generateDeliveryHTML";
import { sendOrderSMS } from "@/functions/sendOrderSMS";
import { generateOrderNumber } from "@/components/OrderUtils";
import { formatDate, formatRelativeTime } from '../i18n/dateUtils';
import { notifyOnNewChatMessage } from '@/functions/notifyOnNewChatMessage';

export default function VendorChat({ chats: initialChats, onChatUpdate, orderToChat, onChatOpened, onOrderUpdate }) {
  const { t, language } = useLanguage();
  const [chats, setChats] = useState(initialChats || []);
  const [openChats, setOpenChats] = useState([]);
  const [closedChats, setClosedChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [householdLeads, setHouseholdLeads] = useState({});
  const [viewingOrderId, setViewingOrderId] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('open');
  const [isClosingChat, setIsClosingChat] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    User.me().then(setUser).catch(() => setUser(null));
    loadHouseholds();
    loadVendors();
    loadHouseholdLeads();
  }, []);

  useEffect(() => {
    const allChats = initialChats || [];
    setChats(allChats);
    setOpenChats(allChats.filter(c => c.status === 'active').sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
    setClosedChats(allChats.filter(c => c.status === 'closed').sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
  }, [initialChats]);

  useEffect(() => {
    if (orderToChat) {
      if (orderToChat.chat) {
        setSelectedChat(orderToChat.chat);
        const chatExists = chats.find(c => c.id === orderToChat.chat.id);
        if (!chatExists) {
          setChats(prev => [orderToChat.chat, ...prev]);
        }
      } else {
        const chatForOrder = chats.find(c => c.order_id === orderToChat.id);
        if (chatForOrder) {
          setSelectedChat(chatForOrder);
        }
      }
      if (onChatOpened) {
        onChatOpened();
      }
    }
  }, [orderToChat, chats, onChatOpened]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChat?.messages]);

  const handleCloseChat = async (chatId) => {
    if (!chatId || isClosingChat) return;
    
    setIsClosingChat(true);
    try {
      await Chat.update(chatId, { status: 'closed' });
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
      if (onChatUpdate) {
        await onChatUpdate();
      }
    } catch (error) {
      console.error('Error closing chat:', error);
      alert(t('vendor.chat.failedToCloseChat'));
    } finally {
      setIsClosingChat(false);
    }
  };

  const loadHouseholds = async () => {
    try {
      const householdsData = await Household.list();
      setHouseholds(householdsData);
    } catch (error) {
      console.error("Error loading households:", error);
    }
  };

  const loadVendors = async () => {
    try {
      const vendorsData = await Vendor.list();
      setVendors(vendorsData);
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const loadHouseholdLeads = async () => {
    try {
      const staffLinks = await HouseholdStaff.filter({ is_lead: true });
      if (staffLinks.length === 0) return;

      const leadUserIds = staffLinks.map(link => link.staff_user_id);
      const leadUsers = await User.filter({ id: { $in: leadUserIds } });

      const userMap = leadUsers.reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});

      const leadMap = {};
      staffLinks.forEach(link => {
        const user = userMap[link.staff_user_id];
        if (user) {
          leadMap[link.household_id] = {
            name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A',
            phone: user.phone
          };
        }
      });
      setHouseholdLeads(leadMap);
    } catch (error) {
      console.error("Error loading household leads:", error);
    }
  };

  const handleOpenOrderDetails = async (orderId) => {
    if (!orderId) return;
    try {
      setViewingOrderId(orderId);
      const order = await Order.get(orderId);
      if (order) {
        setViewingOrder(order);
      } else {
        alert(t('vendor.chat.orderNotFound'));
      }
    } catch (error) {
      console.error("Failed to fetch order details:", error);
      alert(t('vendor.chat.fetchOrderError'));
    } finally {
      setViewingOrderId(null);
    }
  };

  const handleModalOrderUpdate = (updatedOrder) => {
    if (onOrderUpdate) {
      onOrderUpdate(updatedOrder);
    }
    setViewingOrder(prev => prev ? { ...prev, ...updatedOrder } : null);
  };

  const handleDownloadPO = async (orderId, lang) => {
    try {
      const order = await Order.get(orderId);
      if (order) {
        const response = await generatePurchaseOrderPDF({ order, language: lang });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO-${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading Purchase Order:", error);
      alert(t('vendor.orderManagement.alerts.downloadPOFailed'));
    }
  };

  const handleViewPOHTML = async (orderId, lang) => {
    try {
      const order = await Order.get(orderId);
      if (order) {
        const vendorData = vendors.find(v => v.id === order.vendor_id);
        const householdData = households.find(h => h.id === order.household_id);
        const response = await generatePurchaseOrderHTML({ order, vendor: vendorData, household: householdData, language: lang });
        const htmlContent = response.data;
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          alert(t('common.popupBlocked'));
        }
      }
    } catch (error) {
      console.error("Error viewing Purchase Order HTML:", error);
      alert(t('vendor.orderManagement.alerts.viewPOHTMLFailed'));
    }
  };

  const handleViewDeliveryHTML = async (orderId) => {
    try {
      const order = await Order.get(orderId);
      if (order) {
        const vendorData = vendors.find(v => v.id === order.vendor_id);
        const response = await generateDeliveryHTML({ order, vendor: vendorData, language });
        const htmlContent = response.data;
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          alert(t('common.popupBlockedDelivery'));
        }
      }
    } catch (error) {
      console.error("Error viewing Delivery Note HTML:", error);
      alert(`${t('vendor.orderManagement.alerts.viewDeliveryHTMLFailed')}: ${error.message || t('common.unknownError')}`);
    }
  };

  const handleMarkAsReady = async (orderId) => {
    const orderToUpdate = await Order.get(orderId);
    if (!orderToUpdate) return;
    const updatedOrderData = { ...orderToUpdate, status: "ready_for_shipping" };
    if (onOrderUpdate) {
      onOrderUpdate(updatedOrderData);
    }
    setViewingOrder(updatedOrderData);
    try {
      await Order.update(orderId, { status: "ready_for_shipping" });
    } catch (error) {
      console.error("Error marking order as ready:", error);
      if (onOrderUpdate) {
        onOrderUpdate(orderToUpdate);
      }
      setViewingOrder(orderToUpdate);
    }
  };

  const handleMarkAsShipped = async (orderId) => {
    try {
      const orderToUpdate = await Order.get(orderId);
      if (orderToUpdate) {
        await Order.update(orderId, { status: "delivery" });
        const newOrderState = { ...orderToUpdate, status: "delivery" };
        if (onOrderUpdate) {
          onOrderUpdate(newOrderState);
        }
        if (viewingOrder && viewingOrder.id === orderId) {
          setViewingOrder(prev => ({ ...prev, status: "delivery" }));
        }
        try {
          await sendOrderSMS({ orderId: orderId, messageType: 'order_shipped', recipientType: 'customer' });
        } catch (smsError) {
          console.warn('Failed to send SMS notification:', smsError);
        }

        const itemsNotFulfilled = orderToUpdate.items.filter(item => {
          const actualQuantity = item.actual_quantity;
          return actualQuantity === 0 || actualQuantity === null || actualQuantity === undefined;
        });
        if (itemsNotFulfilled.length > 0) {
          const followUpOrderNumber = generateOrderNumber(orderToUpdate.vendor_id, orderToUpdate.household_id);
          const newTotal = itemsNotFulfilled.reduce((total, item) => total + (item.price * item.quantity), 0);
          const followUpOrder = {
            order_number: followUpOrderNumber,
            user_email: orderToUpdate.user_email,
            vendor_id: orderToUpdate.vendor_id,
            household_id: orderToUpdate.household_id,
            items: itemsNotFulfilled.map(item => ({
              ...item, shopped: false, available: true, modified: false, actual_quantity: null,
              substitute_product_id: null, substitute_product_name: null,
              vendor_notes: `Follow-up for ${orderToUpdate.order_number}`
            })),
            total_amount: newTotal, status: "pending",
            street: orderToUpdate.street, building_number: orderToUpdate.building_number,
            neighborhood: orderToUpdate.neighborhood, household_number: orderToUpdate.household_number,
            entrance_code: orderToUpdate.entrance_code, delivery_address: orderToUpdate.delivery_address,
            delivery_time: orderToUpdate.delivery_time, phone: orderToUpdate.phone,
            delivery_notes: `Follow-up order for items not fulfilled in ${orderToUpdate.order_number}`
          };
          await Order.create(followUpOrder);
          alert(t('vendor.orderManagement.alerts.shipSuccessWithFollowUp', { followUpOrderNumber, itemCount: itemsNotFulfilled.length }));
        } else {
          alert(t('vendor.orderManagement.alerts.shipSuccess'));
        }
      }
    } catch (error) {
      console.error("Error marking order as shipped:", error);
      alert(t('vendor.orderManagement.alerts.shipFailed'));
    }
  };


  const handleSendMessage = async (text, imageUrl = null, voiceUrl = null, voiceDuration = null) => {
    if ((!text || !text.trim()) && !imageUrl && !voiceUrl) return;
    if (!selectedChat || !user) return;

    setIsSending(true);
    try {
      const messageData = {
        sender_email: user.email,
        sender_type: "vendor",
        message: text,
        image_url: imageUrl,
        voice_url: voiceUrl,
        voice_duration: voiceDuration,
        timestamp: new Date().toISOString(), // Use ISO string for consistent storage
        read: false,
      };

      const updatedMessages = [...(selectedChat.messages || []), messageData];
      const updatedChat = await Chat.update(selectedChat.id, {
        messages: updatedMessages,
        last_message_at: new Date().toISOString(),
      });

      setSelectedChat(updatedChat);
      setNewMessage("");
      if (onChatUpdate) {
        onChatUpdate();
      }

      try {
        const chatVendor = vendors.find(v => v.id === selectedChat.vendor_id);
        const vendorName = chatVendor?.name || 'Vendor';

        await Notification.create({
          user_email: selectedChat.customer_email,
          title: t('notifications.newMessageFromVendorTitle', { vendorName }),
          message: text || (imageUrl ? t('notifications.sentAnImage') : voiceUrl ? t('notifications.sentAVoiceMessage') : t('notifications.newMessage')),
          type: 'new_message',
          chat_id: selectedChat.id,
          vendor_id: selectedChat.vendor_id || null, // Ensure vendor_id is explicitly null if not present
          order_id: selectedChat.order_id || null,   // Ensure order_id is explicitly null if not present
          is_read: false
        });

        console.log('Created notification with:', {
          chat_id: selectedChat.id,
          vendor_id: selectedChat.vendor_id,
          order_id: selectedChat.order_id
        });
      } catch (notificationError) {
        console.error("Failed to send chat notification:", notificationError);
      }

      // NEW: Send SMS notification
      try {
          const notificationText = text || (imageUrl ? '[Image]' : voiceUrl ? '[Voice Message]' : 'New message');
          await notifyOnNewChatMessage({
              chatId: selectedChat.id,
              senderType: 'vendor',
              messageText: notificationText,
          });
      } catch (smsError) {
          console.warn("SMS notification failed to send:", smsError);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      alert(t('vendor.chat.sendMessageError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      await handleSendMessage(newMessage, file_url);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(t('common.uploadError'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' });

        setIsUploading(true);
        try {
          const { file_url } = await UploadFile({ file: audioFile });
          await handleSendMessage(newMessage, null, file_url, recordingTime);
        } catch (error) {
          console.error("Error uploading voice message:", error);
          alert(t('common.uploadError'));
        } finally {
          setIsUploading(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(1);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      alert(t('common.mediaError'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const playVoiceMessage = (voiceUrl, messageIndex) => {
    if (playingVoice !== null) {
      setPlayingVoice(null);
    }

    if (playingVoice === messageIndex) {
      setPlayingVoice(null);
      return;
    }

    const audio = new Audio(voiceUrl);
    setPlayingVoice(messageIndex);

    audio.onended = () => {
      setPlayingVoice(null);
    };

    audio.play().catch(() => {
      setPlayingVoice(null);
      alert(t('common.mediaError'));
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onFinalSendMessage = () => {
    handleSendMessage(newMessage, null);
  };

  const getChatTitle = (chat) => {
    const householdName = chat.household_name
      ? (language === 'Hebrew' ? (chat.household_name_hebrew || chat.household_name) : chat.household_name)
      : t('common.unknownHousehold');

    const householdCode = (chat.household_code || '').slice(0, 4) || 'N/A';
    
    // Dynamically get vendor name - first try chat object, then lookup from vendors list
    let displayVendorName = t('common.unknownVendor', 'Unknown Vendor');
    if (chat.vendor_name) {
      displayVendorName = language === 'Hebrew' ? (chat.vendor_name_hebrew || chat.vendor_name) : chat.vendor_name;
    } else if (chat.vendor_id && vendors.length > 0) {
      const vendor = vendors.find(v => v.id === chat.vendor_id);
      if (vendor) {
        displayVendorName = language === 'Hebrew' ? (vendor.name_hebrew || vendor.name) : vendor.name;
      }
    }

    return `${householdName} (#${householdCode}), ${displayVendorName}`;
  };

  const getChatIcon = (chat) => {
    if (chat.chat_type === "household_vendor_chat") {
      return <Home className="w-4 h-4 text-purple-500" />;
    } else {
      return <Package className="w-4 h-4 text-blue-500" />;
    }
  };

  const renderChatList = (chatList) => {
    if (chatList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>{activeTab === 'open' ? t('vendor.chat.noActiveChats') : t('vendor.chat.noClosedChats')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {chatList.map((chat) => (
          <div
            key={chat.id}
            onClick={() => setSelectedChat(chat)}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              selectedChat?.id === chat.id
                ? 'bg-blue-50 border-2 border-blue-200'
                : 'hover:bg-gray-50 border-2 border-transparent'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    {getChatIcon(chat)}
                    <p className="font-medium text-sm">{getChatTitle(chat)}</p>
                </div>
                {chat.status === 'active' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCloseChat(chat.id);
                        }}
                        disabled={isClosingChat}
                        title={t('vendor.chat.closeChat')}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
                {chat.status === 'closed' && (
                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                )}
            </div>

            {householdLeads[chat.household_id] && (
                <div className="mt-2 text-xs text-gray-600 space-y-1 pl-1 border-l-2 border-gray-200 ml-1">
                    <div className="flex items-center gap-2 pl-2">
                        <UserIcon className="w-3 h-3 text-gray-500" />
                        <span>{householdLeads[chat.household_id].name || t('common.notAvailable')}</span>
                    </div>
                    {householdLeads[chat.household_id].phone && (
                        <div className="flex items-center gap-2 pl-2">
                        <Phone className="w-3 h-3 text-gray-500" />
                        <span>{householdLeads[chat.household_id].phone}</span>
                        </div>
                    )}
                </div>
            )}

            {chat.order_id && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                  disabled={viewingOrderId === chat.order_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenOrderDetails(chat.order_id);
                  }}
                >
                  {viewingOrderId === chat.order_id ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Package className="w-3 h-3 mr-1" />
                  )}
                  {t('vendor.chat.viewOrder')}
                </Button>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-2">
              {formatDate(new Date(chat.last_message_at), 'MMM d, HH:mm', language)}
            </p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              {t('vendor.chat.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="open">{t('vendor.chat.openChats')} ({openChats.length})</TabsTrigger>
                <TabsTrigger value="closed">{t('vendor.chat.closedChats')} ({closedChats.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="open" className="p-4">
                {renderChatList(openChats)}
              </TabsContent>
              <TabsContent value="closed" className="p-4">
                {renderChatList(closedChats)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Chat Detail */}
        <Card className="lg:col-span-2 flex flex-col max-h-[90vh]">
          <CardContent className="flex-grow flex flex-col p-0 max-h-[90vh]">
            {selectedChat ? (
              <>
                <div className="p-4 border-b flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold">{getChatTitle(selectedChat)}</h3>
                        <p className="text-sm text-gray-500">{selectedChat.customer_email}</p>
                    </div>
                    {selectedChat.status === 'active' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCloseChat(selectedChat.id)}
                            disabled={isClosingChat}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                            <X className="w-4 h-4 mr-2" />
                            {isClosingChat ? t('common.closing') : t('vendor.chat.closeChat')}
                        </Button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                  {selectedChat.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex flex-col gap-1 ${
                        msg.sender_type === 'vendor' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-md p-3 rounded-lg ${
                          msg.sender_type === 'vendor'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        {msg.message && <p className="text-sm">{msg.message}</p>}
                        {msg.image_url && (
                          <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                            <img src={msg.image_url} alt="Chat attachment" className="mt-2 rounded-lg max-w-[200px] cursor-pointer" />
                          </a>
                        )}
                        {msg.voice_url && (
                          <div className="mt-2 flex items-center gap-2 bg-black/10 rounded-lg p-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => playVoiceMessage(msg.voice_url, index)}
                              className="h-8 w-8 p-0"
                            >
                              {playingVoice === index ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                            <span className="text-xs">
                              {msg.voice_duration ? formatTime(msg.voice_duration) : t('vendor.chat.voice')}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        {msg.sender_type === 'vendor' ? <Store className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        <span className="mr-2">{msg.sender_email}</span>
                        <span>{formatRelativeTime(new Date(msg.timestamp), language)}</span>
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {selectedChat.status === 'active' ? (
                  <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                      <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />

                      <Button variant="ghost" size="icon" onClick={handleUploadClick} disabled={isUploading || isSending || isRecording}>
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                      </Button>

                      <Button variant="ghost" size="icon" onClick={handleCameraClick} disabled={isUploading || isSending || isRecording}>
                        <Camera className="w-5 h-5" />
                      </Button>

                      {!isRecording ? (
                        <Button variant="ghost" size="icon" onClick={startRecording} disabled={isUploading || isSending}>
                          <Mic className="w-5 h-5" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={stopRecording} className="text-red-600">
                            <Square className="w-5 h-5" />
                          </Button>
                          <span className="text-sm text-red-600">{formatTime(recordingTime)}</span>
                        </div>
                      )}

                      <Input
                        placeholder={t('vendor.chat.typeMessage')}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && !isRecording && onFinalSendMessage()}
                        disabled={isSending || isUploading || isRecording}
                      />
                      <Button onClick={onFinalSendMessage} disabled={isSending || isUploading || isRecording || !newMessage.trim()}>
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-500">
                    {t('vendor.chat.chatClosed')}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <div>
                  <MessageCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p>{t('vendor.chat.selectChat')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <OrderDetailsModal
        order={viewingOrder}
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        onOrderUpdate={handleModalOrderUpdate}
        onDownloadPO={(lang) => viewingOrder && handleDownloadPO(viewingOrder.id, lang)}
        onViewPOHTML={(lang) => viewingOrder && handleViewPOHTML(viewingOrder.id, lang)}
        onViewDeliveryHTML={() => viewingOrder && handleViewDeliveryHTML(viewingOrder.id)}
        onMarkAsReady={() => viewingOrder && handleMarkAsReady(viewingOrder.id)}
        onMarkAsShipped={() => viewingOrder && handleMarkAsShipped(viewingOrder.id)}
        onChatOpen={() => {
          if (viewingOrder) {
            const chatForOrder = chats.find(c => c.order_id === viewingOrder.id);
            if (chatForOrder) {
                setSelectedChat(chatForOrder);
            }
            setViewingOrder(null);
          }
        }}
      />
    </div>
  );
}