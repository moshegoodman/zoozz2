
import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chat, User, Household, Vendor, Notification, HouseholdStaff, Order } from "@/entities/all"; 
import { MessageCircle, Send, Paperclip, Loader2, User as UserIcon, Store, Shield, Camera, Mic, Play, Pause, Square, Home, Package, Phone, X, CheckCircle2 } from "lucide-react"; 
import { format } from "date-fns";
import { UploadFile } from "@/integrations/Core";
import { useLanguage } from "../i18n/LanguageContext";
import OrderDetailsModal from "../vendor/OrderDetailsModal";
import { notifyOnNewChatMessage } from '@/functions/notifyOnNewChatMessage';

export default function AdminChat({ chats, onChatUpdate }) {
  const { t, language } = useLanguage();
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [householdLeads, setHouseholdLeads] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(0); // Renamed to isRecording to avoid confusion with recordingTime
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]); // Directly use a ref for mutable array
  const [households, setHouseholds] = useState([]);
  const [vendors, setVendors] = useState([]); // Added vendors state
  const [isClosingChat, setIsClosingChat] = useState(false);
  const [viewingOrderId, setViewingOrderId] = useState(null);
  const isRTL = language === 'Hebrew';
  // Add state for order modal
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  
  // Filter states
  const [activeTab, setActiveTab] = useState('active');
  const [selectedHousehold, setSelectedHousehold] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState('all');

  useEffect(() => {
    User.me().then(setUser).catch(() => setUser(null));
    loadHouseholdLeads();
    loadHouseholdsAndVendors();
  }, []);

  const handleOpenOrderDetails = async (orderId) => {
    if (!orderId) return;
    try {
      setViewingOrderId(orderId);
      const order = await Order.get(orderId);
      if (!order) {
        alert(t('vendor.chat.orderNotFound'));
        return;
      }
      
      // Set the order and open the modal
      setViewingOrder(order);
      setIsOrderModalOpen(true);
      
    } catch (error) {
      console.error("Failed to fetch order details:", error);
      alert(t('vendor.chat.fetchOrderError'));
    } finally {
      setViewingOrderId(null);
    }
  };

  const handleModalOrderUpdate = (updatedOrder) => {
    // Close the modal after update
    setIsOrderModalOpen(false);
    setViewingOrder(null);
    
    // Optionally refresh chats if needed
    if (onChatUpdate) {
      onChatUpdate();
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

  const loadHouseholdsAndVendors = async () => {
    try {
      const [householdsData, vendorsData] = await Promise.all([
        Household.list(),
        Vendor.list()
      ]);
      setHouseholds(householdsData);
      setVendors(vendorsData);
    } catch (error) {
      console.error("Error loading households and vendors:", error);
    }
  };

  const handleViewChat = (chat) => {
    setSelectedChat(chat);
  };

  const handleSendMessage = async (text, imageUrl = null, voiceUrl = null, voiceDuration = null) => {
    if ((!text || !text.trim()) && !imageUrl && !voiceUrl) return;
    if (!selectedChat || !user) return;

    setIsSending(true);
    try {
      const messageData = {
        sender_email: user.email,
        sender_type: "admin",
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
      setNewMessage("");
      onChatUpdate();

      // Send notification to customer
      try {
        await Notification.create({
          user_email: selectedChat.customer_email,
          title: t('notifications.newMessageFromSupport', 'New message from Support'),
          message: text || (imageUrl ? t('notifications.sentAnImage', 'Sent an image') : voiceUrl ? t('notifications.sentAVoiceMessage', 'Sent a voice message') : t('notifications.newMessage', 'New message')),
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

      } catch (notificationError) {
        console.error("Failed to send chat notification:", notificationError);
      }

      // NEW: Send SMS notification
      try {
          const notificationText = text || (imageUrl ? '[Image]' : voiceUrl ? '[Voice Message]' : 'New message');
          await notifyOnNewChatMessage({
              chatId: selectedChat.id,
              senderType: 'admin',
              messageText: notificationText,
          });
      } catch (smsError) {
          console.warn("SMS notification failed to send:", smsError);
      }

    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Helper function to format dates
  const formatDate = (date, formatStr) => { 
    return format(date, formatStr);
  };

  // Filter chats based on selected filters
  const getFilteredChats = () => {
    return chats.filter(chat => {
      // Status filter
      if (activeTab === 'active' && chat.status !== 'active') return false;
      if (activeTab === 'closed' && chat.status !== 'closed') return false;
      
      // Household filter
      if (selectedHousehold !== 'all' && chat.household_id !== selectedHousehold) return false;
      
      // Vendor filter  
      if (selectedVendor !== 'all' && chat.vendor_id !== selectedVendor) return false;
      
      return true;
    });
  };

const renderChatList = () => { 
    const filteredChats = getFilteredChats();
    
    if (filteredChats.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>{activeTab === 'active' ? t('admin.chat.noActiveChats') : t('admin.chat.noClosedChats')}</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {filteredChats.map((chat) => ( 
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
              {formatDate(new Date(chat.last_message_at), 'MMM d, HH:mm')}
            </p>
          </div>
        ))}
      </div>
    );
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
      alert("Failed to upload image. Please try again.");
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
          alert("Failed to upload voice message. Please try again.");
        } finally {
          setIsUploading(false);
        }
        
        // Clean up
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
    handleSendMessage(newMessage, null);
  };

  const closeChat = async (chatId) => {
    if (confirm(t('admin.chat.closeChatConfirm'))) {
      try {
        await Chat.update(chatId, { status: "closed" });
        onChatUpdate();
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
        }
      } catch (error) {
        console.error("Error closing chat:", error);
      }
    }
  };

  const getSenderIcon = (senderType) => {
    switch (senderType) {
      case 'customer': return <UserIcon className="w-3 h-3"/>;
      case 'vendor': return <Store className="w-3 h-3"/>;
      case 'admin': return <Shield className="w-3 h-3"/>;
      default: return null;
    }
  };

  const getChatTitle = (chat) => {
    const householdName = chat.household_name
      ? (language === 'Hebrew' ? (chat.household_name_hebrew || chat.household_name) : chat.household_name)
      : t('common.unknownHousehold');

    const householdCode = chat.household_code || 'N/A';
    
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

  const getChatSubtitle = (chat) => {
    if (chat.chat_type === "household_vendor_chat") {
      return t('admin.chat.generalInquiry');
    } else {
      return t('admin.chat.orderChat');
    }
  };

  const getChatIcon = (chat) => {
    if (chat.chat_type === "household_vendor_chat") {
      return <Home className="w-4 h-4 text-purple-500" />;
    } else {
      return <Package className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Chat List */}
        <Card className="max-h-[90vh]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              {t('admin.chat.title')}
            </CardTitle>
            
            {/* Filters Section */}
            <div className="space-y-4 pt-4">
              {/* Status Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="active">{t('admin.chat.activeChats')}</TabsTrigger>
                  <TabsTrigger value="closed">{t('admin.chat.closedChats')}</TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* Filter Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select value={selectedHousehold} onValueChange={setSelectedHousehold}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.chat.filterHousehold')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.chat.allHouseholds')}</SelectItem>
                    {households.map(household => (
                      <SelectItem key={household.id} value={household.id}>
                        {household.name} ({household.household_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.chat.filterVendor')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.chat.allVendors')}</SelectItem>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-hidden">
             {renderChatList()}
          </CardContent>
        </Card>

        {/* Chat Detail */}
        <Card className="flex flex-col max-h-[90vh]">
          <CardHeader>
            <CardTitle>
              {selectedChat ? getChatTitle(selectedChat) : t('admin.chat.selectAChat')}
            </CardTitle>
          </CardHeader>
          {selectedChat ? (
            <>
              <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">
                {selectedChat.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col gap-1 ${
                      msg.sender_type === 'admin' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-md p-3 rounded-lg ${
                        msg.sender_type === 'admin'
                          ? 'bg-blue-600 text-white'
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
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      {getSenderIcon(msg.sender_type)}
                      {msg.sender_email}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </CardContent>
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
                    placeholder={t('admin.chat.messagePlaceholder')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isRecording && onFinalSendMessage()}
                    disabled={isSending || isUploading || isRecording}
                  />
                  <Button onClick={onFinalSendMessage} disabled={isSending || isUploading || isRecording}>
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex items-center justify-center text-center text-gray-500">
               <div>
                  <MessageCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p>{t('admin.chat.selectAChatDesc')}</p>
                </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Order Details Modal */}
      {isOrderModalOpen && viewingOrder && (
        <OrderDetailsModal
          order={viewingOrder}
          isOpen={isOrderModalOpen}
          onClose={() => {
            setIsOrderModalOpen(false);
            setViewingOrder(null);
          }}
          onUpdate={handleModalOrderUpdate}
          vendorId={viewingOrder.vendor_id}
          userType={user?.user_type || 'admin'}
        />
      )}
    </>
  );
}
