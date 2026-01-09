
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chat, Household, Vendor, Notification, Order } from "@/entities/all"; // Ensure Notification and Order are imported
import { format } from "date-fns";
import { Paperclip, Send, MessageSquare, Loader2, Camera, Mic, Play, Pause, Square, Home, Package, MessageCircle, X } from "lucide-react";
import { UploadFile } from "@/integrations/Core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../i18n/LanguageContext';
import { notifyOnNewChatMessage } from '@/functions/notifyOnNewChatMessage';
import ViewOnlyOrderModal from "./ViewOnlyOrderModal"; // Changed import from OrderDetailsModal to ViewOnlyOrderModal
import { Badge } from "@/components/ui/badge"; // Added Badge import

export default function CustomerChat({ user, selectedHousehold, shoppingForHousehold }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // This will now indicate file upload within handleSendMessage
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null); // New state for staged file
  const [voiceFile, setVoiceFile] = useState(null);     // New state for staged voice recording
  const [viewingOrder, setViewingOrder] = useState(null); // New state for order details modal
  const [orderDataMap, setOrderDataMap] = useState(new Map()); // New state for order data

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Add refs to prevent excessive API calls
  const lastLoadTime = useRef(0);
  const loadingRef = useRef(false); // Indicates if any data loading is in progress
  const RATE_LIMIT_DELAY = 2000; // 2 seconds between calls

  const { t } = useLanguage();

  // Add a ref to hold the current selectedChat value to avoid stale closures in useCallback
  const selectedChatRef = useRef(null); // Initialize with null
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const loadHouseholdsAndVendors = useCallback(async () => {
    const now = Date.now();
    // Keep original robust rate-limiting condition for first call safety
    if (loadingRef.current || (now - lastLoadTime.current < RATE_LIMIT_DELAY && lastLoadTime.current !== 0)) {
      console.log("Skipping loadHouseholdsAndVendors due to rate limit or ongoing load.");
      return;
    }
    
    loadingRef.current = true;
    try {
      const [householdsData, vendorsData] = await Promise.all([
        Household.list(),
        Vendor.list()
      ]);
      setHouseholds(Array.isArray(householdsData) ? householdsData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
      lastLoadTime.current = now;
    } catch (error) {
      console.error("Error loading households and vendors:", error);
      setHouseholds([]); // Ensure state is an array even on error
      setVendors([]);     // Ensure state is an array even on error
      if (error.response?.status === 429) {
        console.log("Rate limited on households/vendors, will retry later.");
        setTimeout(() => {
          loadingRef.current = false;
          loadHouseholdsAndVendors();
        }, 5000); // Retry after 5 seconds
        return;
      }
    } finally {
      loadingRef.current = false;
    }
  }, []); // Removed all dependencies to prevent excessive calls

  const loadChats = useCallback(async (forceReload = false) => {
    if (!user || !user.email) {
      setIsLoading(false);
      return;
    }
    
    const now = Date.now();
    // Keep original robust rate-limiting condition for first call safety
    if (!forceReload && (loadingRef.current || (now - lastLoadTime.current < RATE_LIMIT_DELAY && lastLoadTime.current !== 0))) {
      console.log("Skipping loadChats due to rate limit or ongoing load.");
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    
    try {
      let userChats = [];
      if (user.user_type === 'kcs staff' && selectedHousehold) {
        userChats = await Chat.filter({ household_id: selectedHousehold.id }, "-last_message_at");
      } else if (['vendor', 'picker', 'admin', 'chief of staff'].includes(user.user_type) && shoppingForHousehold) {
        userChats = await Chat.filter({ household_id: shoppingForHousehold.id }, "-last_message_at");
      } else {
        userChats = await Chat.filter({ customer_email: user.email }, "-last_message_at");
      }
      
      // Ensure userChats is always an array
      if (!Array.isArray(userChats)) {
        userChats = [];
      }
      
      setChats(userChats);

      // Load order data for order chats
      const orderIds = userChats
        .filter(chat => chat && chat.order_id)
        .map(chat => chat.order_id);
      
      if (orderIds.length > 0) {
        try {
          const orders = await Order.filter({ id: { $in: orderIds } });
          const newOrderMap = new Map();
          
          // Ensure orders is an array before iterating
          if (Array.isArray(orders) && orders.length > 0) {
            orders.forEach(order => {
              if (order && order.id) {
                newOrderMap.set(order.id, order);
              }
            });
          }
          
          setOrderDataMap(newOrderMap);
        } catch (orderError) {
          console.error("Error loading order data:", orderError);
          // Continue without order data if it fails
          setOrderDataMap(new Map());
        }
      } else {
        setOrderDataMap(new Map());
      }
      
      // Only auto-select if no chat is currently selected, using the ref for current state
      if (!selectedChatRef.current && userChats.length > 0) {
        setSelectedChat(userChats[0]);
      }
      
      lastLoadTime.current = now;
    } catch (error) {
      console.error("Error loading chats:", error);
      setChats([]); // Ensure chats state is an array even on error
      setOrderDataMap(new Map()); // Ensure orderDataMap is reset on error
      if (error.response?.status === 429) {
        console.log("Rate limited on chats, will retry later.");
        setTimeout(() => {
          loadingRef.current = false;
          loadChats(true); // Force reload after delay
        }, 5000); // Retry after 5 seconds
        return;
      }
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [user, selectedHousehold, shoppingForHousehold]); // Dependencies are now correct

  // Load data only once on mount or when essential dependencies change
  useEffect(() => {
    let mounted = true;
    
    const initializeData = async () => {
      if (!mounted) return;
      
      // Load households and vendors first (less critical)
      await loadHouseholdsAndVendors();
      
      if (!mounted) return;
      
      // Then load chats (more critical for UI)
      await loadChats(true); // Force reload for initial data fetch
    };
    
    initializeData();
    
    return () => {
      mounted = false;
    };
  }, [user?.email, selectedHousehold?.id, shoppingForHousehold?.id, loadChats, loadHouseholdsAndVendors]);

  // Scroll to messages end when selectedChat changes or new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChat?.id, selectedChat?.messages?.length]);

  // This is the new handleSendMessage as per the outline, now specifically for database write and notifications
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
        read: false,
      };

      const updatedMessages = [...(selectedChat.messages || []), messageData];
      const updatedChat = await Chat.update(selectedChat.id, {
        messages: updatedMessages,
        last_message_at: new Date().toISOString(),
      });
      
      setSelectedChat(updatedChat);

      setChats(prevChats => {
        const index = prevChats.findIndex(c => c.id === updatedChat.id);
        if (index > -1) {
          const newChats = [...prevChats];
          newChats[index] = updatedChat;
          return newChats.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
        }
        return prevChats;
      });

      // Send database notification - preserved from original code
      try {
        const chatVendor = vendors.find(v => v && v.id === selectedChat.vendor_id);
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

          console.log('Created notification with:', {
            chat_id: selectedChat.id,
            vendor_id: selectedChat.vendor_id,
            order_id: selectedChat.order_id
          });
        }
      } catch (notificationError) {
        console.error("Failed to create database notification:", notificationError);
        // Continue - notification failure shouldn't break the message sending
      }
      
      // Send SMS notification - as per outline, using t() for localization and 'text' argument
      try {
          const notificationText = text || (imageUrl ? t('notifications.sentAnImage') : voiceUrl ? t('notifications.sentAVoiceMessage') : t('notifications.newMessage'));
          const currentChatId = selectedChat.id; 

          if (currentChatId && notifyOnNewChatMessage) {
            await notifyOnNewChatMessage({
                chatId: currentChatId,
                senderType: 'customer',
                messageText: notificationText,
            });
          }
      } catch (smsError) {
          console.warn("SMS notification failed to send:", smsError);
          // Continue - SMS failure shouldn't break the message sending
      }

    } catch (error) {
      console.error("Error sending message:", error);
      // Use the original alert message
      alert(t('customer.chat.sendMessageError', 'Failed to send message. Please try again.'));
      throw error; // Re-throw to be caught by the orchestrator
    }
  };

  // This function orchestrates the file uploads and then calls the core handleSendMessage
  const _orchestrateAndSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile && !voiceFile) || !selectedChat || !user) {
        return;
    }

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

      // Call the new handleSendMessage (from outline) with gathered data
      await handleSendMessage(newMessage, imageUrl, voiceUrl, finalVoiceDuration);

      // Clear states only after successful message send
      setNewMessage("");
      setSelectedFile(null);
      setVoiceFile(null);
      setRecordingTime(0);

    } catch (error) {
      console.error("Error in orchestrating message send flow:", error);
      // The inner handleSendMessage already displays an alert if there was a DB/notification error.
      // File upload errors would be caught here and potentially re-alerted if handleSendMessage didn't handle them.
    } finally {
      setIsSending(false);
      setIsUploading(false); // Ensure this is reset even if an error occurs mid-upload
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

    setSelectedFile(file); // Stage the file
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear file input
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ""; // Clear camera input
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

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' });
        
        setVoiceFile(audioFile); // Stage the audio file
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const playVoiceMessage = (voiceUrl, messageIndex) => {
    if (playingVoice === messageIndex) {
      setPlayingVoice(null);
      return;
    }

    if (playingVoice !== null) {
      setPlayingVoice(null); 
    }

    const audio = new Audio(voiceUrl);
    setPlayingVoice(messageIndex);
    
    audio.onended = () => {
      setPlayingVoice(null);
    };
    
    audio.play().catch(() => {
      setPlayingVoice(null);
      alert("Could not play voice message");
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onFinalSendMessage = () => {
    _orchestrateAndSendMessage(); // Call the unified send message handler
  };

  const getChatTitle = (chat) => {
    if (!chat) return 'Unknown Chat';
    
    if (chat.chat_type === "household_vendor_chat") {
      const vendor = vendors.find(v => v && v.id === chat.vendor_id);
      const household = households.find(h => h && h.id === chat.household_id);
      return `${vendor?.name || 'Unknown Vendor'} - ${household?.name || 'Unknown Household'}`;
    } else {
      const vendor = vendors.find(v => v && v.id === chat.vendor_id);
      const household = households.find(h => h && h.id === chat.household_id);
      return `${household?.name || 'Unknown Household'} - ${vendor?.name || 'Unknown Vendor'}`;
    }
  };

  const getChatSubtitle = (chat) => {
    if (!chat) return '';
    
    if (chat.chat_type === "household_vendor_chat") {
      return "General inquiry";
    } else {
      return "Order chat";
    }
  };

  const getChatIcon = (chat) => {
    if (!chat) return null;
    
    if (chat.chat_type === "household_vendor_chat") {
      return <Home className="w-4 h-4 text-purple-500" />;
    } else {
      return <Package className="w-4 h-4 text-blue-500" />;
    }
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shopping': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ready_for_shipping': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivery': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOrderStatusLabel = (status) => {
    return t(`ordersPage.status.${status?.toLowerCase() || 'default'}`);
  };

  const handleViewOrder = async (orderId) => {
    if (!orderId) return;
    try {
      const order = await Order.get(orderId);
      if (order) {
        setViewingOrder(order);
      }
    } catch (error) {
      console.error("Error loading order:", error);
      alert(t('chat.orderLoadError', 'Failed to load order details'));
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-64px)]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <Card className="flex flex-col max-h-[80vh]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Your Chats
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto">
              {isLoading ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No chats yet</p>
                  <p className="text-sm">Start shopping to chat with vendors</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chats.map((chatItem) => {
                    // Ensure chatItem is not null/undefined before accessing its properties
                    if (!chatItem) return null;

                    const orderData = chatItem.order_id ? orderDataMap.get(chatItem.order_id) : null;
                    
                    return (
                      <div
                        key={chatItem.id}
                        onClick={() => setSelectedChat(chatItem)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedChat?.id === chatItem.id
                            ? 'bg-blue-50 border-2 border-blue-200'
                            : 'hover:bg-gray-50 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getChatIcon(chatItem)}
                          <p className="font-medium text-sm">{getChatTitle(chatItem)}</p>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{getChatSubtitle(chatItem)}</p>
                        
                        {/* Display order status if this is an an order chat */}
                        {orderData && orderData.status && (
                           <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${getOrderStatusColor(orderData.status)} border text-xs mb-2`}>
                            {getOrderStatusLabel(orderData.status)}
                          </Badge>
                            {orderData.items && orderData.items.length > 0 && (
                              <p className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                <span className="font-medium">{orderData.items.length} {t('common.items', 'items')}</span>
                              </p>
                            )}
                        </div>
                        )}
                        
                        {/* Display order dates and item count if this is an order chat */}
                        {orderData && orderData.created_date && (
                          <div className="text-xs text-gray-600 space-y-0.5 mb-2">
                            <p className="flex items-center gap-1">
                              <span className="font-medium">{t('common.orderDate', 'Order')}:</span>
                              {format(new Date(orderData.created_date), 'MMM d, yyyy')}
                            </p>
                            {orderData.delivery_time && (
                              <p className="flex items-center gap-1">
                                <span className="font-medium">{t('common.deliveryDate', 'Delivery')}:</span>
                                {orderData.delivery_time}
                              </p>
                            )}
                           
                          </div>
                        )}
                        
                        {chatItem.order_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs h-6 px-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewOrder(chatItem.order_id);
                            }}
                          >
                            <Package className="w-3 h-3 mr-1" />
                            {t('chat.viewOrder', 'View Order')}
                          </Button>
                        )}
                        {chatItem.last_message_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(chatItem.last_message_at), 'MMM d, HH:mm')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 flex flex-col max-h-[80vh]">
            {selectedChat ? (
              <>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    {getChatIcon(selectedChat)}
                    Chat: {getChatTitle(selectedChat)}
                  </CardTitle>
                  <p className="text-sm text-gray-500">{getChatSubtitle(selectedChat)}</p>
                </CardHeader>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                  {selectedChat.messages?.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex flex-col gap-1 ${
                        msg.sender_email === user.email ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs p-3 rounded-lg ${
                          msg.sender_email === user.email
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
                              {msg.voice_duration ? formatTime(msg.voice_duration) : "Voice"}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {msg.sender_email} at {format(new Date(msg.timestamp), "HH:mm")}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t bg-gray-50">
                  {(selectedFile || voiceFile) && (
                      <div className="mb-2 flex items-center gap-2 p-2 bg-blue-100 rounded-md">
                          {selectedFile && (
                              <>
                                  <Paperclip className="w-4 h-4 text-blue-700" />
                                  <span className="text-sm text-blue-800">{selectedFile.name}</span>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => setSelectedFile(null)}>
                                      <X className="w-4 h-4" />
                                  </Button>
                              </>
                          )}
                          {voiceFile && (
                              <>
                                  <Mic className="w-4 h-4 text-blue-700" />
                                  <span className="text-sm text-blue-800">Voice message ({formatTime(recordingTime)})</span>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => { setVoiceFile(null); setRecordingTime(0); }}>
                                      <X className="w-4 h-4" />
                                  </Button>
                              </>
                          )}
                      </div>
                  )}
                  <div className="flex items-center gap-2 w-full">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <input type="file" ref={cameraInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
                    
                    <Button variant="ghost" size="icon" onClick={handleUploadClick} disabled={isUploading || isSending || isRecording || !!selectedFile || !!voiceFile}>
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                    </Button>
                    
                    <Button variant="ghost" size="icon" onClick={handleCameraClick} disabled={isUploading || isSending || isRecording || !!selectedFile || !!voiceFile}>
                      <Camera className="w-5 h-5" />
                    </Button>
                    
                    {!isRecording ? (
                      <Button variant="ghost" size="icon" onClick={startRecording} disabled={isUploading || isSending || !!selectedFile || !!voiceFile}>
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
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isRecording && onFinalSendMessage()}
                      disabled={isSending || isUploading || isRecording}
                    />
                    <Button onClick={onFinalSendMessage} disabled={isSending || isUploading || isRecording || (!newMessage.trim() && !selectedFile && !voiceFile)}>
                      {isSending || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <MessageSquare className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a chat to view messages</p>
                <p className="text-sm">Your active conversations will appear here.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* View-Only Order Details Modal */}
      {viewingOrder && (
        <ViewOnlyOrderModal
          order={viewingOrder}
          isOpen={!!viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </>
  );
}
