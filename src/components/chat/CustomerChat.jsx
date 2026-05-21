import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chat, Household, Vendor, Notification, Order, User } from "@/entities/all";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Paperclip, Send, MessageSquare, Loader2, Camera, Mic, Play, Pause, Square,
  Home, Package, MessageCircle, X, Plus, Search, ChevronLeft, ChevronRight,
  Store, User as UserIcon, CheckCircle2, Phone } from
"lucide-react";
import { UploadFile } from "@/integrations/Core";
import { base44 } from "@/api/base44Client";
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate, formatRelativeTime } from '../i18n/dateUtils';
import { notifyOnNewChatMessage } from '@/functions/notifyOnNewChatMessage';
import ViewOnlyOrderModal from "./ViewOnlyOrderModal";

export default function CustomerChat({ user, selectedHousehold, shoppingForHousehold }) {
  const { t, language } = useLanguage();

  // The household context this chat is operating under
  const householdContext = selectedHousehold || shoppingForHousehold || null;

  const [chats, setChats] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [closedChats, setClosedChats] = useState([]);
  const [activeTab, setActiveTab] = useState('open');
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [voiceFile, setVoiceFile] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [orderDataMap, setOrderDataMap] = useState(new Map());
  const [isClosingChat, setIsClosingChat] = useState(false);
  const [userNamesCache, setUserNamesCache] = useState({});
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastLoadTime = useRef(0);
  const loadingRef = useRef(false);
  const RATE_LIMIT_DELAY = 2000;
  const selectedChatRef = useRef(null);

  useEffect(() => {selectedChatRef.current = selectedChat;}, [selectedChat]);

  const loadHouseholdsAndVendors = useCallback(async () => {
    const now = Date.now();
    if (loadingRef.current || now - lastLoadTime.current < RATE_LIMIT_DELAY && lastLoadTime.current !== 0) return;
    loadingRef.current = true;
    try {
      const [householdsData, vendorsData] = await Promise.all([Household.list(), Vendor.list()]);
      setHouseholds(Array.isArray(householdsData) ? householdsData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
      lastLoadTime.current = now;
    } catch (error) {
      console.error("Error loading households and vendors:", error);
      setHouseholds([]);setVendors([]);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const loadChats = useCallback(async (forceReload = false) => {
    if (!user || !user.email) {setIsLoading(false);return;}
    const now = Date.now();
    if (!forceReload && (loadingRef.current || now - lastLoadTime.current < RATE_LIMIT_DELAY && lastLoadTime.current !== 0)) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      let userChats = [];
      if (householdContext) {
        userChats = await Chat.filter({ household_id: householdContext.id }, "-last_message_at");
      } else {
        userChats = await Chat.filter({ customer_email: user.email }, "-last_message_at");
      }
      if (!Array.isArray(userChats)) userChats = [];
      setChats(userChats);

      const orderIds = userChats.filter((c) => c && c.order_id).map((c) => c.order_id);
      if (orderIds.length > 0) {
        try {
          const orders = await Order.filter({ id: { $in: orderIds } });
          const newOrderMap = new Map();
          if (Array.isArray(orders)) {
            orders.forEach((o) => {if (o && o.id) newOrderMap.set(o.id, o);});
          }
          setOrderDataMap(newOrderMap);
        } catch (e) {
          console.error("Error loading order data:", e);
          setOrderDataMap(new Map());
        }
      } else {
        setOrderDataMap(new Map());
      }

      lastLoadTime.current = now;
    } catch (error) {
      console.error("Error loading chats:", error);
      setChats([]);
      setOrderDataMap(new Map());
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [user, householdContext]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!mounted) return;
      await loadHouseholdsAndVendors();
      if (!mounted) return;
      await loadChats(true);
    };
    init();
    return () => {mounted = false;};
  }, [user?.email, householdContext?.id, loadChats, loadHouseholdsAndVendors]);

  // Split chats into open / closed (sorted by last message)
  useEffect(() => {
    const sortByLast = (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at);
    setOpenChats(chats.filter((c) => c.status !== 'closed').sort(sortByLast));
    setClosedChats(chats.filter((c) => c.status === 'closed').sort(sortByLast));
  }, [chats]);

  // Real-time subscription: receive new chat messages instantly (no polling)
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = base44.entities.Chat.subscribe((event) => {
      const incoming = event?.data;
      if (!incoming && event?.type !== 'delete') return;

      // Filter: only chats relevant to the current household context (or customer)
      const isRelevant = householdContext ?
      incoming?.household_id === householdContext.id :
      incoming?.customer_email === user.email;

      if (event.type === 'delete') {
        setChats((prev) => prev.filter((c) => c.id !== event.id));
        setSelectedChat((prev) => prev?.id === event.id ? null : prev);
        return;
      }

      if (!isRelevant) return;

      setChats((prev) => {
        const exists = prev.some((c) => c.id === incoming.id);
        return exists ? prev.map((c) => c.id === incoming.id ? incoming : c) : [incoming, ...prev];
      });

      setSelectedChat((prev) => prev?.id === incoming.id ? incoming : prev);
    });

    return () => {
      try {unsubscribe?.();} catch (e) {/* ignore */}
    };
  }, [user?.email, householdContext?.id]);

  // Scroll-to-bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [selectedChat?.id, selectedChat?.messages?.length]);

  // Fetch real names for senders
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

  const getSenderName = (msg) => userNamesCache[msg.sender_email] || msg.sender_email;

  const handleCloseChat = async (chatId) => {
    if (!chatId || isClosingChat) return;
    setIsClosingChat(true);
    try {
      await Chat.update(chatId, { status: 'closed' });
      if (selectedChat?.id === chatId) setSelectedChat(null);
      await loadChats(true);
    } catch (error) {
      console.error('Error closing chat:', error);
      alert(t('vendor.chat.failedToCloseChat', 'Failed to close chat'));
    } finally {
      setIsClosingChat(false);
    }
  };

  const handleSendMessage = async (text, imageUrl = null, voiceUrl = null, voiceDuration = null) => {
    if ((!text || !text.trim()) && !imageUrl && !voiceUrl) return;
    if (!selectedChat || !user) return;
    try {
      const messageData = {
        sender_email: user.email,
        sender_type: "customer",
        message: text,
        image_url: imageUrl,
        voice_url: voiceUrl,
        voice_duration: voiceDuration,
        timestamp: new Date().toISOString(),
        read: false
      };
      const updatedMessages = [...(selectedChat.messages || []), messageData];
      const updatedChat = await Chat.update(selectedChat.id, {
        messages: updatedMessages,
        last_message_at: new Date().toISOString()
      });
      setSelectedChat(updatedChat);
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === updatedChat.id);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = updatedChat;
          return next;
        }
        return prev;
      });

      try {
        const chatVendor = vendors.find((v) => v && v.id === selectedChat.vendor_id);
        const vendorContactEmail = chatVendor?.contact_email;
        if (vendorContactEmail && Notification) {
          await Notification.create({
            user_email: vendorContactEmail,
            title: t('notifications.newMessageFromCustomer', 'New message from customer'),
            message: text || (imageUrl ? t('notifications.sentAnImage') : voiceUrl ? t('notifications.sentAVoiceMessage') : t('notifications.newMessage')),
            type: 'new_message',
            chat_id: selectedChat.id,
            vendor_id: selectedChat.vendor_id || null,
            order_id: selectedChat.order_id || null,
            is_read: false
          });
        }
      } catch (e) {
        console.error("Failed to create database notification:", e);
      }

      try {
        const notificationText = text || (imageUrl ? t('notifications.sentAnImage') : voiceUrl ? t('notifications.sentAVoiceMessage') : t('notifications.newMessage'));
        if (selectedChat.id && notifyOnNewChatMessage) {
          await notifyOnNewChatMessage({
            chatId: selectedChat.id,
            senderType: 'customer',
            messageText: notificationText
          });
        }
      } catch (e) {
        console.warn("SMS notification failed to send:", e);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert(t('customer.chat.sendMessageError', 'Failed to send message. Please try again.'));
      throw error;
    }
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

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleCameraClick = () => cameraInputRef.current?.click();
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
    if (playingVoice === messageIndex) {setPlayingVoice(null);return;}
    if (playingVoice !== null) setPlayingVoice(null);
    const audio = new Audio(voiceUrl);
    setPlayingVoice(messageIndex);
    audio.onended = () => setPlayingVoice(null);
    audio.play().catch(() => {setPlayingVoice(null);alert("Could not play voice message");});
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onFinalSendMessage = () => _orchestrateAndSendMessage();

  const getVendorDisplayName = (chat) => {
    if (chat.vendor_name) return language === 'Hebrew' ? chat.vendor_name_hebrew || chat.vendor_name : chat.vendor_name;
    const v = vendors.find((x) => x.id === chat.vendor_id);
    if (v) return language === 'Hebrew' ? v.name_hebrew || v.name : v.name;
    return t('common.unknownVendor', 'Unknown Vendor');
  };

  const getHouseholdDisplayName = (chat) => {
    if (chat.household_name) return language === 'Hebrew' ? chat.household_name_hebrew || chat.household_name : chat.household_name;
    const h = households.find((x) => x.id === chat.household_id);
    if (h) return language === 'Hebrew' ? h.name_hebrew || h.name : h.name;
    return t('common.unknownHousehold', 'Unknown Household');
  };

  const getChatTitle = (chat) => {
    if (!chat) return 'Unknown Chat';
    const householdName = getHouseholdDisplayName(chat);
    const householdCode = (chat.household_code || '').slice(0, 4) || 'N/A';
    const vendorName = getVendorDisplayName(chat);
    return `${householdName} (#${householdCode}), ${vendorName}`;
  };

  const getChatIcon = (chat) => {
    if (!chat) return null;
    if (chat.chat_type === "household_vendor_chat") return <Home className="w-4 h-4 text-purple-500" />;
    return <Package className="w-4 h-4 text-blue-500" />;
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending':return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed':return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shopping':return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ready_for_shipping':return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivery':return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'delivered':return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':return 'bg-red-100 text-red-800 border-red-200';
      default:return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOrderStatusLabel = (status) => t(`ordersPage.status.${status?.toLowerCase() || 'default'}`);

  const handleViewOrder = async (orderId) => {
    if (!orderId) return;
    try {
      const order = await Order.get(orderId);
      if (order) setViewingOrder(order);
    } catch (error) {
      console.error("Error loading order:", error);
      alert(t('chat.orderLoadError', 'Failed to load order details'));
    }
  };

  // ---- New chat: vendors allowed for current household ----
  const allowedVendorsForNewChat = React.useMemo(() => {
    if (!householdContext) return vendors;
    const allowed = householdContext.staff_orderable_vendors || householdContext.viewable_vendors || [];
    if (!allowed.length) return vendors;
    const allowedIds = allowed.map((v) => v.vendor_id);
    return vendors.filter((v) => allowedIds.includes(v.id));
  }, [vendors, householdContext]);

  const filteredNewChatVendors = allowedVendorsForNewChat.filter((v) => {
    const s = newChatSearch.toLowerCase();
    if (!s) return true;
    return v.name?.toLowerCase().includes(s) || v.name_hebrew?.toLowerCase().includes(s);
  });

  const handleCreateNewChat = async (vendor) => {
    if (!user || !householdContext) return;
    setIsCreatingChat(vendor.id);
    try {
      const existing = chats.find((c) =>
      c.chat_type === 'household_vendor_chat' &&
      c.household_id === householdContext.id &&
      c.vendor_id === vendor.id
      );
      if (existing) {
        setSelectedChat(existing);
        setShowNewChatModal(false);
        return;
      }
      const newChat = await Chat.create({
        chat_type: 'household_vendor_chat',
        customer_email: user.email,
        vendor_id: vendor.id,
        vendor_name: vendor.name || '',
        vendor_name_hebrew: vendor.name_hebrew || '',
        household_id: householdContext.id,
        household_name: householdContext.name,
        household_name_hebrew: householdContext.name_hebrew || '',
        household_code: householdContext.household_code || '',
        messages: [],
        status: 'active',
        last_message_at: new Date().toISOString()
      });
      setChats((prev) => [newChat, ...prev]);
      setSelectedChat(newChat);
      setShowNewChatModal(false);
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Failed to create chat. Please try again.');
    } finally {
      setIsCreatingChat(null);
    }
  };

  const NewChatModal = () =>
  <AnimatePresence>
      {showNewChatModal &&
    <motion.div
      key="new-chat-page"
      className="fixed inset-0 z-50 bg-white flex flex-col"
      style={{ top: 79 }}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}>
      
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
            <button onClick={() => setShowNewChatModal(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold flex-1">{t('chat.newChat', 'New Chat')}</h2>
          </div>
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
            autoFocus
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
            placeholder={t('chat.searchVendors', 'Search vendors...')}
            value={newChatSearch}
            onChange={(e) => setNewChatSearch(e.target.value)} />
          
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredNewChatVendors.length === 0 ?
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <MessageCircle className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm">{t('chat.noVendorsFound', 'No vendors found')}</p>
              </div> :

        filteredNewChatVendors.map((v) =>
        <button
          key={v.id}
          className="w-full text-left px-4 py-3.5 hover:bg-green-50 flex items-center justify-between gap-3 transition-colors"
          onClick={() => handleCreateNewChat(v)}
          disabled={!!isCreatingChat}>
          
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{language === 'Hebrew' ? v.name_hebrew || v.name : v.name}</p>
                      {v.name_hebrew && language !== 'Hebrew' && <p className="text-xs text-gray-400">{v.name_hebrew}</p>}
                    </div>
                  </div>
                  {isCreatingChat === v.id ?
          <Loader2 className="w-4 h-4 animate-spin text-green-600" /> :
          <ChevronRight className="w-4 h-4 text-gray-300" />
          }
                </button>
        )
        }
          </div>
        </motion.div>
    }
    </AnimatePresence>;


  const renderChatList = (chatList) => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) =>
          <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          )}
        </div>);

    }
    if (chatList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>{activeTab === 'open' ? t('vendor.chat.noActiveChats', 'No active chats') : t('vendor.chat.noClosedChats', 'No closed chats')}</p>
        </div>);

    }
    return (
      <div className="space-y-2">
        {chatList.map((chatItem) => {
          if (!chatItem) return null;
          const orderData = chatItem.order_id ? orderDataMap.get(chatItem.order_id) : null;
          return (
            <div
              key={chatItem.id}
              onClick={() => setSelectedChat(chatItem)}
              className={`p-3 rounded-lg cursor-pointer transition-colors border-2 ${
              selectedChat?.id === chatItem.id ?
              "bg-blue-50 border-blue-200" :
              "bg-green-50 border-transparent hover:border-green-200"}`
              }>
              
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {getChatIcon(chatItem)}
                  <p className="font-medium text-sm">{getChatTitle(chatItem)}</p>
                </div>
                {chatItem.status !== 'closed' ?
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  onClick={(e) => {e.stopPropagation();handleCloseChat(chatItem.id);}}
                  disabled={isClosingChat}
                  title={t('vendor.chat.closeChat', 'Close chat')}>
                  
                    <X className="w-4 h-4" />
                  </Button> :

                <CheckCircle2 className="w-4 h-4 text-gray-400" />
                }
              </div>

              {orderData && orderData.status &&
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={`${getOrderStatusColor(orderData.status)} border text-xs`}>
                    {getOrderStatusLabel(orderData.status)}
                  </Badge>
                  {orderData.items && orderData.items.length > 0 &&
                <span className="text-xs text-gray-600 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {orderData.items.length} {t('common.items', 'items')}
                    </span>
                }
                </div>
              }

              {chatItem.order_id &&
              <div className="mt-2 flex justify-end">
                  <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                  onClick={(e) => {e.stopPropagation();handleViewOrder(chatItem.order_id);}}>
                  
                    <Package className="w-3 h-3 mr-1" />
                    {t('chat.viewOrder', 'View Order')}
                  </Button>
                </div>
              }

              {chatItem.last_message_at &&
              <p className="text-xs text-gray-400 mt-2">
                  {formatDate(new Date(chatItem.last_message_at), 'MMM d, HH:mm', language)}
                </p>
              }
            </div>);

        })}
      </div>);

  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ---- Mobile view ----
  if (isMobile) {
    return (
      <>
        <div className="relative overflow-hidden">
          <NewChatModal />
          <div className="px-3 py-0">
            <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5" /> {t('chat.title', 'Chats')}
            </h1>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-3 h-11">
                <TabsTrigger value="open" className="flex items-center justify-center gap-2 h-full">
                  <span>{t('vendor.chat.open', 'Open')}</span>
                  <span className="bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{openChats.length}</span>
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex items-center justify-center gap-2 h-full">
                  <span>{t('vendor.chat.closed', 'Closed')}</span>
                  <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{closedChats.length}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="open">{renderChatList(openChats)}</TabsContent>
              <TabsContent value="closed">{renderChatList(closedChats)}</TabsContent>
            </Tabs>
          </div>

          {householdContext &&
          <button
            onClick={() => {setNewChatSearch('');setShowNewChatModal(true);}}
            className="fixed bottom-24 right-5 z-40 bg-green-600 hover:bg-green-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg">
            
              <Plus className="w-6 h-6" />
            </button>
          }

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
              
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-white">
                  <button onClick={() => setSelectedChat(null)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{getChatTitle(selectedChat)}</h3>
                  </div>
                  {selectedChat.vendor_id && vendors.find((v) => v.id === selectedChat.vendor_id)?.phone_number &&
                <a href={`tel:${vendors.find((v) => v.id === selectedChat.vendor_id).phone_number}`} className="flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                }
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {selectedChat.messages?.map((msg, index) =>
                <div key={index} className={`flex flex-col gap-1 ${msg.sender_email === user.email ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-[10px] ${msg.sender_email === user.email ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
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
                            <span className="text-xs">{msg.voice_duration ? formatTime(msg.voice_duration) : "Voice"}</span>
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

                {selectedChat.status !== 'closed' ?
              <div className="border-t bg-gray-50 pt-3 pb-3 pr-3">
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
                      <Input
                    placeholder={t('vendor.chat.typeMessage', 'Type a message...')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isRecording && onFinalSendMessage()}
                    disabled={isSending || isUploading || isRecording} className="mr-1 rounded-[28px]" />
                  
                      <Button onClick={onFinalSendMessage} disabled={isSending || isUploading || isRecording || !newMessage.trim() && !selectedFile && !voiceFile}>
                        {isSending || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div> :

              <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-500">{t('vendor.chat.chatClosed', 'Chat closed')}</div>
              }
              </motion.div>
            }
          </AnimatePresence>
        </div>
        {viewingOrder &&
        <ViewOnlyOrderModal order={viewingOrder} isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} />
        }
      </>);

  }

  // ---- Desktop view ----
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-64px)] relative">
        <NewChatModal />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <Card className="flex flex-col max-h-[80vh]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  {t('chat.title', 'Chats')}
                </span>
                {householdContext &&
                <button
                  onClick={() => {setNewChatSearch('');setShowNewChatModal(true);}}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow"
                  title={t('chat.newChat', 'New Chat')}>
                  
                    <Plus className="w-4 h-4" />
                  </button>
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-hidden flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-grow flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="open">{t('vendor.chat.openChats', 'Open')} ({openChats.length})</TabsTrigger>
                  <TabsTrigger value="closed">{t('vendor.chat.closedChats', 'Closed')} ({closedChats.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="open" className="p-4 overflow-y-auto flex-grow">{renderChatList(openChats)}</TabsContent>
                <TabsContent value="closed" className="p-4 overflow-y-auto flex-grow">{renderChatList(closedChats)}</TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 flex flex-col max-h-[80vh] overflow-hidden">
            <CardContent className="flex-grow flex flex-col p-0 max-h-[80vh]">
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
                        <h3 className="font-semibold flex items-center gap-2">{getChatIcon(selectedChat)} {getChatTitle(selectedChat)}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedChat.vendor_id && vendors.find((v) => v.id === selectedChat.vendor_id)?.phone_number &&
                      <a href={`tel:${vendors.find((v) => v.id === selectedChat.vendor_id).phone_number}`}>
                            <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50">
                          
                              <Phone className="w-4 h-4 mr-2" />
                              {t('common.call', 'Call')}
                            </Button>
                          </a>
                      }
                        {selectedChat.status !== 'closed' &&
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloseChat(selectedChat.id)}
                        disabled={isClosingChat}
                        className="text-red-600 border-red-300 hover:bg-red-50">
                        
                            <X className="w-4 h-4 mr-2" />
                            {isClosingChat ? t('common.closing', 'Closing...') : t('vendor.chat.closeChat', 'Close')}
                          </Button>
                      }
                      </div>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                      {selectedChat.messages?.map((msg, index) =>
                    <div key={index} className={`flex flex-col gap-1 ${msg.sender_email === user.email ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-md p-3 rounded-lg ${msg.sender_email === user.email ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
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
                                <span className="text-xs">{msg.voice_duration ? formatTime(msg.voice_duration) : "Voice"}</span>
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

                    {selectedChat.status !== 'closed' ?
                  <div className="p-4 border-t bg-gray-50">
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
                          <Input
                        placeholder={t('vendor.chat.typeMessage', 'Type a message...')}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isRecording && onFinalSendMessage()}
                        disabled={isSending || isUploading || isRecording} />
                      
                          <Button onClick={onFinalSendMessage} disabled={isSending || isUploading || isRecording || !newMessage.trim() && !selectedFile && !voiceFile}>
                            {isSending || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div> :

                  <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-500">{t('vendor.chat.chatClosed', 'Chat closed')}</div>
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
                      <p>{t('vendor.chat.selectChat', 'Select a chat to view messages')}</p>
                    </div>
                  </motion.div>
                }
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>

      {viewingOrder &&
      <ViewOnlyOrderModal order={viewingOrder} isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} />
      }
    </>);

}