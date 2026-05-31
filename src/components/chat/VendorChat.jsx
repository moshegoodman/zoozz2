import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chat, User, Vendor, Household, Notification, Order, HouseholdStaff, AppSettings } from "@/entities/all";
import { base44 } from "@/api/base44Client";
import { MessageCircle, Send, Paperclip, Loader2, User as UserIcon, Store, Camera, Mic, Play, Pause, Square, Home, Package, Phone, X, CheckCircle2, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function VendorChat({ chats: initialChats, onChatUpdate, orderToChat, onChatOpened, onOrderUpdate, onChatSelected, clearChatSignal, activeSeason: activeSeasonProp, showAllChatSeasons, totalChatsCount, onToggleAllSeasons }) {
  const { t, language } = useLanguage();
  const [chats, setChats] = useState(initialChats || []);
  const [openChats, setOpenChats] = useState([]);
  const [closedChats, setClosedChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [householdLeads, setHouseholdLeads] = useState({});
  const [viewingOrderId, setViewingOrderId] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('open');
  const [isClosingChat, setIsClosingChat] = useState(false);
  const [userNamesCache, setUserNamesCache] = useState({}); // email -> display name
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(null);
  const [activeSeason, setActiveSeason] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [voiceFile, setVoiceFile] = useState(null);

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
    AppSettings.list().then((list) => setActiveSeason(list?.[0]?.activeSeason || '')).catch(() => {});
  }, []);

  useEffect(() => {
    const allChats = initialChats || [];
    setChats(allChats);
    setOpenChats(allChats.filter((c) => c.status === 'active').sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
    setClosedChats(allChats.filter((c) => c.status === 'closed').sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
  }, [initialChats]);

  useEffect(() => {
    if (orderToChat) {
      if (orderToChat.chat) {
        setSelectedChat(orderToChat.chat);
        const chatExists = chats.find((c) => c.id === orderToChat.chat.id);
        if (!chatExists) {
          setChats((prev) => [orderToChat.chat, ...prev]);
        }
      } else {
        const chatForOrder = chats.find((c) => c.order_id === orderToChat.id);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [selectedChat?.messages]);

  useEffect(() => {
    if (onChatSelected) {
      onChatSelected(selectedChat ? getChatTitle(selectedChat) : null);
    }
    // Mark customer messages as read when vendor opens the chat
    if (selectedChat?.id && selectedChat.messages?.length) {
      const hasUnread = selectedChat.messages.some((m) => m.sender_type !== 'vendor' && m.read === false);
      if (hasUnread) {
        const updatedMessages = selectedChat.messages.map((m) =>
          m.sender_type !== 'vendor' && m.read === false ? { ...m, read: true } : m
        );
        Chat.update(selectedChat.id, { messages: updatedMessages })
          .then((updated) => {
            setSelectedChat((prev) => (prev?.id === selectedChat.id ? updated : prev));
            setChats((prev) => prev.map((c) => (c.id === selectedChat.id ? updated : c)));
          })
          .catch((err) => console.warn('Failed to mark messages as read:', err));
      }
    }
  }, [selectedChat?.id]);

  useEffect(() => {
    if (clearChatSignal) {
      setSelectedChat(null);
    }
  }, [clearChatSignal]);

  // Real-time subscription: receive new chat messages instantly (no polling)
  useEffect(() => {
    if (!user?.vendor_id) return;

    const unsubscribe = base44.entities.Chat.subscribe((event) => {
      const incoming = event?.data;
      if (!incoming) return;
      // Only react to chats belonging to this vendor
      if (incoming.vendor_id && incoming.vendor_id !== user.vendor_id) return;

      if (event.type === 'delete') {
        setChats((prev) => prev.filter((c) => c.id !== event.id));
        setSelectedChat((prev) => (prev?.id === event.id ? null : prev));
        return;
      }

      // create or update: merge into local chat list
      setChats((prev) => {
        const exists = prev.some((c) => c.id === incoming.id);
        return exists ? prev.map((c) => (c.id === incoming.id ? incoming : c)) : [incoming, ...prev];
      });

      // If the currently open chat was the one that changed, swap in fresh data so messages render immediately
      setSelectedChat((prev) => (prev?.id === incoming.id ? incoming : prev));
    });

    return () => {
      try { unsubscribe?.(); } catch (e) { /* ignore */ }
    };
  }, [user?.vendor_id]);

  // Keep the open/closed buckets in sync whenever `chats` changes (from subscription or parent)
  useEffect(() => {
    setOpenChats(chats.filter((c) => c.status === 'active').sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
    setClosedChats(chats.filter((c) => c.status === 'closed').sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));
  }, [chats]);

  // Fetch real names for all unique senders in the selected chat
  useEffect(() => {
    if (!selectedChat?.messages?.length) return;
    const emails = [...new Set(selectedChat.messages.map((m) => m.sender_email).filter(Boolean))];
    const missing = emails.filter((e) => !userNamesCache[e]);
    if (missing.length === 0) return;
    User.filter({ email: { $in: missing } }).then((users) => {
      const updates = {};
      users.forEach((u) => {
        updates[u.email] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.full_name || u.email;
      });
      setUserNamesCache((prev) => ({ ...prev, ...updates }));
    }).catch(() => {});
  }, [selectedChat?.id]);

  const getSenderName = (msg) => {
    if (userNamesCache[msg.sender_email]) return userNamesCache[msg.sender_email];
    return msg.sender_email;
  };

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

      const leadUserIds = staffLinks.map((link) => link.staff_user_id);
      const leadUsers = await User.filter({ id: { $in: leadUserIds } });

      const userMap = leadUsers.reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});

      const leadMap = {};
      staffLinks.forEach((link) => {
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
    setViewingOrder((prev) => prev ? { ...prev, ...updatedOrder } : null);
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
        const vendorData = vendors.find((v) => v.id === order.vendor_id);
        const householdData = households.find((h) => h.id === order.household_id);
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
        const vendorData = vendors.find((v) => v.id === order.vendor_id);
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
          setViewingOrder((prev) => ({ ...prev, status: "delivery" }));
        }
        try {
          await sendOrderSMS({ orderId: orderId, messageType: 'order_shipped', recipientType: 'customer' });
        } catch (smsError) {
          console.warn('Failed to send SMS notification:', smsError);
        }

        const itemsNotFulfilled = orderToUpdate.items.filter((item) => {
          const actualQuantity = item.actual_quantity;
          return actualQuantity === 0 || actualQuantity === null || actualQuantity === undefined;
        });
        if (itemsNotFulfilled.length > 0) {
          const followUpOrderNumber = generateOrderNumber(orderToUpdate.vendor_id, orderToUpdate.household_id);
          const newTotal = itemsNotFulfilled.reduce((total, item) => total + item.price * item.quantity, 0);
          const followUpOrder = {
            order_number: followUpOrderNumber,
            user_email: orderToUpdate.user_email,
            vendor_id: orderToUpdate.vendor_id,
            household_id: orderToUpdate.household_id,
            items: itemsNotFulfilled.map((item) => ({
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
        read: false
      };

      const updatedMessages = [...(selectedChat.messages || []), messageData];
      const updatedChat = await Chat.update(selectedChat.id, {
        messages: updatedMessages,
        last_message_at: new Date().toISOString()
      });

      setSelectedChat(updatedChat);
      setNewMessage("");
      if (onChatUpdate) {
        onChatUpdate();
      }

      try {
        const chatVendor = vendors.find((v) => v.id === selectedChat.vendor_id);
        const vendorName = chatVendor?.name || 'Vendor';

        await Notification.create({
          user_email: selectedChat.customer_email,
          title: t('notifications.newMessageFromVendorTitle', { vendorName }),
          message: text || (imageUrl ? t('notifications.sentAnImage') : voiceUrl ? t('notifications.sentAVoiceMessage') : t('notifications.newMessage')),
          type: 'new_message',
          chat_id: selectedChat.id,
          vendor_id: selectedChat.vendor_id || null, // Ensure vendor_id is explicitly null if not present
          order_id: selectedChat.order_id || null, // Ensure order_id is explicitly null if not present
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
          messageText: notificationText
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

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' });
        setVoiceFile(audioFile);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
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

  const _orchestrateAndSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile && !voiceFile || !selectedChat || !user) return;
    setIsSending(true);
    let imageUrl = null;
    let voiceUrl = null;
    let finalVoiceDuration = null;
    try {
      if (selectedFile) {
        setIsUploading(true);
        const { file_url } = await UploadFile({ file: selectedFile });
        imageUrl = file_url;
      }
      if (voiceFile) {
        setIsUploading(true);
        const { file_url } = await UploadFile({ file: voiceFile });
        voiceUrl = file_url;
        finalVoiceDuration = recordingTime;
      }
      await handleSendMessage(newMessage, imageUrl, voiceUrl, finalVoiceDuration);
      setNewMessage("");setSelectedFile(null);setVoiceFile(null);setRecordingTime(0);
    } catch (error) {
      console.error("Error in send flow:", error);
    } finally {
      setIsSending(false);setIsUploading(false);
    }
  };

  const onFinalSendMessage = () => _orchestrateAndSendMessage();

  // Filter households by current season
  const seasonHouseholds = households.filter((h) => {
    if (!activeSeason) return true;
    return h.season === activeSeason || h.household_code && h.household_code.endsWith(activeSeason);
  });

  const filteredNewChatHouseholds = seasonHouseholds.filter((h) => {
    const search = newChatSearch.toLowerCase();
    if (!search) return true;
    return (
      h.name?.toLowerCase().includes(search) ||
      h.name_hebrew?.toLowerCase().includes(search) ||
      (h.household_code || '').slice(0, 4).includes(search));

  });

  const handleCreateNewChat = async (household) => {
    if (!user) return;
    setIsCreatingChat(household.id);
    try {
      // Find vendor for this user
      const vendorData = vendors.find((v) => v.id === user.vendor_id);

      // Check if a household_vendor_chat already exists
      const existing = chats.find((c) =>
      c.chat_type === 'household_vendor_chat' &&
      c.household_id === household.id &&
      c.vendor_id === user.vendor_id
      );

      if (existing) {
        setSelectedChat(existing);
        setShowNewChatModal(false);
        return;
      }

      // Create new chat
      const newChat = await Chat.create({
        chat_type: 'household_vendor_chat',
        customer_email: user.email,
        vendor_id: user.vendor_id,
        vendor_name: vendorData?.name || '',
        vendor_name_hebrew: vendorData?.name_hebrew || '',
        household_id: household.id,
        household_name: household.name,
        household_name_hebrew: household.name_hebrew || '',
        household_code: household.household_code || '',
        messages: [],
        status: 'active',
        last_message_at: new Date().toISOString()
      });

      setSelectedChat(newChat);
      setShowNewChatModal(false);
      if (onChatUpdate) onChatUpdate();
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Failed to create chat. Please try again.');
    } finally {
      setIsCreatingChat(null);
    }
  };

  const NewChatModal = () => (
    <AnimatePresence>
      {showNewChatModal && (
        <motion.div
          key="new-chat-page"
          className="fixed inset-0 z-50 bg-white flex flex-col"
          style={{ top: 79 }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
            <button
              onClick={() => setShowNewChatModal(false)}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold flex-1">New Chat</h2>
            {activeSeason && (
              <span className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">Season: {activeSeason}</span>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                placeholder="Search households..."
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredNewChatHouseholds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <MessageCircle className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm">No households found</p>
              </div>
            ) : (
              filteredNewChatHouseholds.map((h) => (
                <button
                  key={h.id}
                  className="w-full text-left px-4 py-3.5 hover:bg-green-50 flex items-center justify-between gap-3 transition-colors"
                  onClick={() => handleCreateNewChat(h)}
                  disabled={!!isCreatingChat}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Home className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{language === 'Hebrew' ? h.name_hebrew || h.name : h.name}</p>
                      {h.name_hebrew && language !== 'Hebrew' && <p className="text-xs text-gray-400">{h.name_hebrew}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">#{(h.household_code || '').slice(0, 4)}</span>
                    {isCreatingChat === h.id
                      ? <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                      : <ChevronRight className="w-4 h-4 text-gray-300" />
                    }
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );


  const getChatTitle = (chat) => {
    const householdName = chat.household_name ?
    language === 'Hebrew' ? chat.household_name_hebrew || chat.household_name : chat.household_name :
    t('common.unknownHousehold');

    const householdCode = (chat.household_code || '').slice(0, 4) || 'N/A';

    // Dynamically get vendor name - first try chat object, then lookup from vendors list
    let displayVendorName = t('common.unknownVendor', 'Unknown Vendor');
    if (chat.vendor_name) {
      displayVendorName = language === 'Hebrew' ? chat.vendor_name_hebrew || chat.vendor_name : chat.vendor_name;
    } else if (chat.vendor_id && vendors.length > 0) {
      const vendor = vendors.find((v) => v.id === chat.vendor_id);
      if (vendor) {
        displayVendorName = language === 'Hebrew' ? vendor.name_hebrew || vendor.name : vendor.name;
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

  const getUnreadCount = (chat) => {
    if (!chat?.messages?.length) return 0;
    return chat.messages.filter((m) => m.sender_type !== 'vendor' && m.read === false).length;
  };

  const renderChatList = (chatList) => {
    if (chatList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>{activeTab === 'open' ? t('vendor.chat.noActiveChats') : t('vendor.chat.noClosedChats')}</p>
        </div>);

    }

    return (
      <div className="space-y-2">
        {chatList.map((chat) =>
        <div
          key={chat.id}
          onClick={() => setSelectedChat(chat)}
          className={`p-3 rounded-lg cursor-pointer transition-colors border-2 ${
          selectedChat?.id === chat.id ?
          "bg-blue-50 border-blue-200" :
          "bg-green-50 border-transparent hover:border-green-200"}`
          }>
          
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    {getChatIcon(chat)}
                    <p className="font-medium text-sm">{getChatTitle(chat)}</p>
                    {getUnreadCount(chat) > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center">
                        {getUnreadCount(chat)}
                      </span>
                    )}
                </div>
                {chat.status === 'active' &&
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseChat(chat.id);
              }}
              disabled={isClosingChat}
              title={t('vendor.chat.closeChat')}>
              
                        <X className="w-4 h-4" />
                    </Button>
            }
                {chat.status === 'closed' &&
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            }
            </div>

            {householdLeads[chat.household_id] &&
          <div className="mt-2 text-xs text-gray-600 space-y-1 pl-1 border-l-2 border-gray-200 ml-1">
                    <div className="flex items-center gap-2 pl-2">
                        <UserIcon className="w-3 h-3 text-gray-500" />
                        <span>{householdLeads[chat.household_id].name || t('common.notAvailable')}</span>
                    </div>
                    {householdLeads[chat.household_id].phone &&
            <div className="flex items-center gap-2 pl-2">
                        <Phone className="w-3 h-3 text-gray-500" />
                        <span>{householdLeads[chat.household_id].phone}</span>
                        </div>
            }
                </div>
          }

            {chat.order_id &&
          <div className="mt-2 flex justify-end">
                <Button
              variant="outline"
              size="sm"
              className="text-xs h-6 px-2 text-blue-600 border-blue-300 hover:bg-blue-50"
              disabled={viewingOrderId === chat.order_id}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenOrderDetails(chat.order_id);
              }}>
              
                  {viewingOrderId === chat.order_id ?
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> :

              <Package className="w-3 h-3 mr-1" />
              }
                  {t('vendor.chat.viewOrder')}
                </Button>
              </div>
          }

            <p className="text-xs text-gray-400 mt-2">
              {formatDate(new Date(chat.last_message_at), 'MMM d, HH:mm', language)}
            </p>
          </div>
        )}
      </div>);

  };

  const isMobile = window.innerWidth < 768;

  // On mobile: if a chat is selected, show only the detail view; otherwise show the list
  if (isMobile) {
    return (
      <div className="relative overflow-hidden">
        <NewChatModal />
        {/* List view — always rendered underneath */}
        <div className="px-3 py-0">
          <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5" /> {t('vendor.chat.title')}
          </h1>
          {(activeSeasonProp || activeSeason) && onToggleAllSeasons && (
            <div className="mb-3">
              <Button
                variant="outline"
                size="sm"
                className={showAllChatSeasons ? '' : 'border-blue-400 text-blue-700 bg-blue-50'}
                onClick={onToggleAllSeasons}
              >
                {showAllChatSeasons
                  ? (language === 'Hebrew' ? `כל העונות (${totalChatsCount || 0})` : `All Seasons (${totalChatsCount || 0})`)
                  : `${language === 'Hebrew' ? 'עונה' : 'Season'}: ${activeSeasonProp || activeSeason}`}
              </Button>
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3 h-11">
              <TabsTrigger value="open" className="flex items-center justify-center gap-2 h-full">
                <span>Open</span> <span className="bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{openChats.length}</span>
              </TabsTrigger>
              <TabsTrigger value="closed" className="flex items-center justify-center gap-2 h-full">
                <span>Closed</span> <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{closedChats.length}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="open">{renderChatList(openChats)}</TabsContent>
            <TabsContent value="closed">{renderChatList(closedChats)}</TabsContent>
          </Tabs>
        </div>
        {/* Floating new chat button - mobile */}
        <button
          onClick={() => {setNewChatSearch('');setShowNewChatModal(true);}}
          className="fixed bottom-24 right-5 z-40 bg-green-600 hover:bg-green-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg">
          
          <Plus className="w-6 h-6" />
        </button>

        {/* Detail view — slides over the list */}
        <AnimatePresence>
          {selectedChat &&
          <motion.div
            key={selectedChat.id}
            className="fixed left-0 right-0 bottom-0 bg-white flex flex-col z-50"
            style={{ top: 79 }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}>
            
              <div
                className="flex-1 overflow-y-auto p-3 space-y-4"
                style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
                {selectedChat.messages.map((msg, index) =>
              <div key={index} className={`flex flex-col gap-1 ${msg.sender_type === 'vendor' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${msg.sender_type === 'vendor' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
                      {msg.message && <p className="text-sm">{msg.message}</p>}
                      {msg.image_url &&
                  <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.image_url} alt="Chat attachment" className="mt-2 rounded-lg max-w-[200px] cursor-pointer" />
                        </a>
                  }
                      {msg.voice_url &&
                  <div className="mt-2 flex items-center gap-2 bg-black/10 rounded-lg p-2">
                          <Button size="sm" variant="ghost" onClick={() => playVoiceMessage(msg.voice_url, index)} className="h-8 w-8 p-0">
                            {playingVoice === index ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <span className="text-xs">{msg.voice_duration ? formatTime(msg.voice_duration) : t('vendor.chat.voice')}</span>
                        </div>
                  }
                    </div>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      {msg.sender_type === 'vendor' ? <Store className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                      <span className="font-medium">{getSenderName(msg)}</span>
                      <span>· {formatRelativeTime(new Date(msg.timestamp), language)}</span>
                    </span>
                  </div>
              )}
                <div ref={messagesEndRef} />
              </div>
              {selectedChat.status === 'active' ?
            <div className="border-t bg-gray-50 pt-3 pb-3">
                  <div className="flex items-center gap-1">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
                    {(selectedFile || voiceFile) &&
                    <div className="mb-2 flex items-center gap-2 p-2 bg-blue-100 rounded-md">
                        {selectedFile &&
                    <>
                            <Paperclip className="w-4 h-4 text-blue-700" />
                            <span className="text-sm text-blue-800 truncate">{selectedFile.name}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => setSelectedFile(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                    }
                        {voiceFile &&
                    <>
                            <Mic className="w-4 h-4 text-blue-700" />
                            <span className="text-sm text-blue-800">Voice ({formatTime(recordingTime)})</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => {setVoiceFile(null);setRecordingTime(0);}}>  
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                    }
                      </div>
                    }
                    <div className="flex items-center gap-0">
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                      <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
                      <Button variant="ghost" size="icon" onClick={handleUploadClick} disabled={isUploading || isSending || isRecording || !!selectedFile || !!voiceFile}>
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={handleCameraClick} disabled={isUploading || isSending || isRecording || !!selectedFile || !!voiceFile} className="h-9 w-5">
                        <Camera className="w-5 h-5" />
                      </Button>
                      {!isRecording ?
                    <Button variant="ghost" size="icon" onClick={startRecording} disabled={isUploading || isSending || !!selectedFile || !!voiceFile} className="gap-1">
                          <Mic className="w-5 h-5" />
                        </Button> :
                    <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={stopRecording} className="text-red-600">
                            <Square className="w-5 h-5" />
                          </Button>
                          <span className="text-sm text-red-600">{formatTime(recordingTime)}</span>
                        </div>
                    }
                      <textarea
                    placeholder={t('vendor.chat.typeMessage')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && !isRecording && (e.preventDefault(), onFinalSendMessage())}
                    disabled={isSending || isUploading || isRecording}
                    className="flex-1 border border-gray-300 rounded-md py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 px-2 mr-1"
                    style={{
                      minHeight: '40px',
                      maxHeight: '120px',
                      height: 'auto',
                      overflow: 'hidden'
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                      }
                    }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }} />
                      <Button onClick={onFinalSendMessage} disabled={isSending || isUploading || isRecording || !newMessage.trim() && !selectedFile && !voiceFile} size="icon" className="rounded-full flex-shrink-0 ml-1 mr-2">
                        {isSending || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                </div> :
            <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-500">{t('vendor.chat.chatClosed')}</div>
            }
              <OrderDetailsModal
              order={viewingOrder}
              isOpen={!!viewingOrder}
              onClose={() => setViewingOrder(null)}
              onOrderUpdate={handleModalOrderUpdate}
              onMarkAsReady={() => viewingOrder && handleMarkAsReady(viewingOrder.id)}
              onMarkAsShipped={() => viewingOrder && handleMarkAsShipped(viewingOrder.id)}
              onChatOpen={() => {setViewingOrder(null);}} />
            </motion.div>
          }
        </AnimatePresence>

        <OrderDetailsModal
          order={viewingOrder}
          isOpen={!!viewingOrder && !selectedChat}
          onClose={() => setViewingOrder(null)}
          onOrderUpdate={handleModalOrderUpdate}
          onMarkAsReady={() => viewingOrder && handleMarkAsReady(viewingOrder.id)}
          onMarkAsShipped={() => viewingOrder && handleMarkAsShipped(viewingOrder.id)}
          onChatOpen={() => {setViewingOrder(null);}} />
      </div>);

  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      <NewChatModal />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                {t('vendor.chat.title')}
              </span>
              <div className="flex items-center gap-2">
                {(activeSeasonProp || activeSeason) && onToggleAllSeasons && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={showAllChatSeasons ? 'h-8 text-xs' : 'h-8 text-xs border-blue-400 text-blue-700 bg-blue-50'}
                    onClick={onToggleAllSeasons}
                  >
                    {showAllChatSeasons
                      ? (language === 'Hebrew' ? `כל העונות (${totalChatsCount || 0})` : `All Seasons (${totalChatsCount || 0})`)
                      : `${language === 'Hebrew' ? 'עונה' : 'Season'}: ${activeSeasonProp || activeSeason}`}
                  </Button>
                )}
                <button
                  onClick={() => {setNewChatSearch('');setShowNewChatModal(true);}}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow"
                  title="New Chat">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
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
        <Card className="lg:col-span-2 flex flex-col max-h-[90vh] overflow-hidden">
          <CardContent className="flex-grow flex flex-col p-0 max-h-[90vh]">
            <AnimatePresence mode="wait">
            {selectedChat ?
              <motion.div
                key={selectedChat.id}
                className="flex flex-col flex-grow overflow-hidden"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "tween", duration: 0.5, ease: "easeInOut" }}>
                
                <div className="p-4 border-b flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold">{getChatTitle(selectedChat)}</h3>
                        <p className="text-sm text-gray-500">{selectedChat.customer_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {householdLeads[selectedChat.household_id]?.phone && (
                        <a href={`tel:${householdLeads[selectedChat.household_id].phone}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50">
                            <Phone className="w-4 h-4 mr-2" />
                            {t('common.call', 'Call')}
                          </Button>
                        </a>
                      )}
                      {selectedChat.status === 'active' &&
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloseChat(selectedChat.id)}
                        disabled={isClosingChat}
                        className="text-red-600 border-red-300 hover:bg-red-50">
                        <X className="w-4 h-4 mr-2" />
                        {isClosingChat ? t('common.closing') : t('vendor.chat.closeChat')}
                      </Button>
                      }
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                  {selectedChat.messages.map((msg, index) =>
                  <div
                    key={index}
                    className={`flex flex-col gap-1 ${
                    msg.sender_type === 'vendor' ? 'items-end' : 'items-start'}`
                    }>
                  
                      <div
                      className={`max-w-md p-3 rounded-lg ${
                      msg.sender_type === 'vendor' ?
                      'bg-green-600 text-white' :
                      'bg-gray-200 text-gray-900'}`
                      }>
                    
                        {msg.message && <p className="text-sm">{msg.message}</p>}
                        {msg.image_url &&
                      <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                            <img src={msg.image_url} alt="Chat attachment" className="mt-2 rounded-lg max-w-[200px] cursor-pointer" />
                          </a>
                      }
                        {msg.voice_url &&
                      <div className="mt-2 flex items-center gap-2 bg-black/10 rounded-lg p-2">
                            <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => playVoiceMessage(msg.voice_url, index)}
                          className="h-8 w-8 p-0">
                        
                              {playingVoice === index ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                            <span className="text-xs">
                              {msg.voice_duration ? formatTime(msg.voice_duration) : t('vendor.chat.voice')}
                            </span>
                          </div>
                      }
                      </div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        {msg.sender_type === 'vendor' ? <Store className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        <span className="font-medium mr-1">{getSenderName(msg)}</span>
                        <span>· {formatRelativeTime(new Date(msg.timestamp), language)}</span>
                      </span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {selectedChat.status === 'active' ?
                <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                      <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />

                      {(selectedFile || voiceFile) &&
                      <div className="mb-2 flex items-center gap-2 p-2 bg-blue-100 rounded-md">
                           {selectedFile &&
                      <>
                               <Paperclip className="w-4 h-4 text-blue-700" />
                               <span className="text-sm text-blue-800">{selectedFile.name}</span>
                               <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => setSelectedFile(null)}>
                                 <X className="w-4 h-4" />
                               </Button>
                             </>
                      }
                           {voiceFile &&
                      <>
                               <Mic className="w-4 h-4 text-blue-700" />
                               <span className="text-sm text-blue-800">Voice message ({formatTime(recordingTime)})</span>
                               <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => {setVoiceFile(null);setRecordingTime(0);}}>  
                                 <X className="w-4 h-4" />
                               </Button>
                             </>
                      }
                         </div>
                      }
                      <div className="flex items-center gap-0.5 w-full">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />

                        <Button variant="ghost" size="icon" onClick={handleUploadClick} disabled={isUploading || isSending || isRecording || !!selectedFile || !!voiceFile}>
                          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                        </Button>

                        <Button variant="ghost" size="icon" onClick={handleCameraClick} disabled={isUploading || isSending || isRecording || !!selectedFile || !!voiceFile}>
                          <Camera className="w-5 h-5" />
                        </Button>

                        {!isRecording ?
                      <Button variant="ghost" size="icon" onClick={startRecording} disabled={isUploading || isSending || !!selectedFile || !!voiceFile}>
                            <Mic className="w-5 h-5" />
                          </Button> :

                      <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={stopRecording} className="text-red-600">
                              <Square className="w-5 h-5" />
                            </Button>
                            <span className="text-sm text-red-600">{formatTime(recordingTime)}</span>
                          </div>
                      }

                        <textarea
                      placeholder={t('vendor.chat.typeMessage')}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && !isRecording && (e.preventDefault(), onFinalSendMessage())}
                      disabled={isSending || isUploading || isRecording}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      style={{
                        minHeight: '40px',
                        maxHeight: '120px',
                        height: 'auto',
                        overflow: 'hidden'
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                        }
                      }}
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }} />

                      <Button onClick={onFinalSendMessage} disabled={isSending || isUploading || isRecording || !newMessage.trim() && !selectedFile && !voiceFile}>
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </Button>
                      </div>
                    </div>
                  </div> :

                <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-500">
                    {t('vendor.chat.chatClosed')}
                  </div>
                }
              </motion.div> :

              <motion.div
                key="empty"
                className="flex items-center justify-center h-full text-center text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}>
                
                <div>
                  <MessageCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p>{t('vendor.chat.selectChat')}</p>
                </div>
              </motion.div>
              }
            </AnimatePresence>
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
            const chatForOrder = chats.find((c) => c.order_id === viewingOrder.id);
            if (chatForOrder) {
              setSelectedChat(chatForOrder);
            }
            setViewingOrder(null);
          }
        }} />
      
    </div>);

}