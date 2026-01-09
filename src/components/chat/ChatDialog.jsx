
import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chat, User, Order } from "@/entities/all";
import { Send, Paperclip, Camera, Mic, Play, Pause, Square, Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { UploadFile } from "@/integrations/Core";
import { useLanguage } from "../i18n/LanguageContext";
import { notifyOnNewChatMessage } from '@/functions/notifyOnNewChatMessage'; // Updated import path

export default function ChatDialog({
  isOpen,
  onClose,
  chatId,
  onChatUpdate
}) {
  const { t, language, isRTL } = useLanguage();
  const [chat, setChat] = useState(null);
  const [order, setOrder] = useState(null); // Add order state
  const [user, setUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);

  const loadUser = React.useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  }, []);

  const loadChat = React.useCallback(async () => {
    if (!chatId) return;

    setIsLoading(true);
    try {
      const chatData = await Chat.get(chatId);
      setChat(chatData);

      // Load order data if this is an order chat
      if (chatData?.order_id) {
        try {
          const orderData = await Order.get(chatData.order_id);
          setOrder(orderData);
        } catch (error) {
          console.error("Error loading order:", error);
        }
      }
    } catch (error) {
      console.error("Error loading chat:", error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (isOpen) {
        if (chatId && !chat) {
            loadChat();
        }
        if (!user) {
            loadUser();
        }
    }
  }, [isOpen, chatId, chat, user, loadChat, loadUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  const handleSendMessage = async (text, imageUrl = null, voiceUrl = null, voiceDuration = null) => {
    if ((!text || !text.trim()) && !imageUrl && !voiceUrl) return;
    if (!chat || !user) return; // Kept 'chat' instead of 'selectedChat' as per component state

    setIsSending(true);
    try {
      const messageData = {
        sender_email: user.email,
        sender_type: user.user_type === 'admin' || user.user_type === 'chief of staff' ? 'admin' : 'customer', // Simplified sender_type as per outline
        message: text,
        image_url: imageUrl,
        voice_url: voiceUrl,
        voice_duration: voiceDuration,
        timestamp: new Date().toISOString(),
        read: false,
      };

      const updatedMessages = [...(chat.messages || []), messageData];
      const updatedChat = await Chat.update(chat.id, {
        messages: updatedMessages,
        last_message_at: new Date().toISOString(),
      });

      setChat(updatedChat);
      setNewMessage("");
      if (onChatUpdate) {
        onChatUpdate(); // No parameter passed as per outline
      }

      // Send SMS notification - This block replaces the entire previous notification logic (both Notification.create and old SMS)
      try {
        const notificationText = text || (imageUrl ? '[תמונה]' : voiceUrl ? '[הודעה קולית]' : 'הודעה חדשה');
        await notifyOnNewChatMessage({
          chatId: chat.id,
          senderType: user.user_type === 'admin' || user.user_type === 'chief of staff' ? 'admin' : 'customer', // Simplified senderType for SMS as per outline
          messageText: notificationText,
        });
      } catch (smsError) {
        console.warn("SMS notification failed to send:", smsError);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      alert(t('chat.sendMessageError', 'Failed to send message. Please try again.')); // Retained original descriptive alert
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

  const getSenderIcon = (senderType) => {
    switch (senderType) {
      case 'customer': return "👤";
      case 'vendor': return "🏪";
      case 'admin': return "🛡️";
      default: return "💬";
    }
  };

  const getChatTitle = () => {
    if (!chat) return t('chat.dialog.title', 'Chat');

    // Show order number if available
    if (order?.order_number) {
      return `${t('chat.dialog.orderChat', 'Order Chat')}: ${order.order_number}`;
    }

    if (chat.chat_type === "order_chat") {
      return t('chat.dialog.orderChatGeneric', 'Order Chat');
    }

    return t('chat.dialog.generalChat', 'Chat');
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`max-w-2xl max-h-[80vh] ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className={`${isRTL ? 'mr-2' : 'ml-2'}`}>{t('common.loading', 'Loading...')}</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!chat) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`max-w-2xl max-h-[80vh] ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="text-center p-8">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">{t('chat.dialog.chatNotFound', 'Chat not found')}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-2xl max-h-[80vh] flex flex-col p-0 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className={`p-4 pb-2 border-b ${isRTL ? 'text-right' : 'text-left'}`}>
          <DialogTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <MessageSquare className="w-5 h-5" />
            <span>{getChatTitle()}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          {chat.messages && chat.messages.length > 0 ? (
            chat.messages.map((msg, index) => {
              const isOwnMessage = msg.sender_email === user?.email;
              return (
                <div
                  key={index}
                  className={`flex flex-col gap-1 ${
                    isRTL
                      ? (isOwnMessage ? 'items-start' : 'items-end')
                      : (isOwnMessage ? 'items-end' : 'items-start')
                  }`}
                >
                  <div
                    className={`max-w-md p-3 rounded-lg ${
                      isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                  >
                    {msg.message && <p className="text-sm">{msg.message}</p>}
                    {msg.image_url && (
                      <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={msg.image_url}
                          alt="Chat attachment"
                          className="mt-2 rounded-lg max-w-[200px] cursor-pointer"
                        />
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
                  <span className={`text-xs text-gray-500 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span>{getSenderIcon(msg.sender_type)}</span>
                    <span>{msg.sender_email}</span>
                    <span>•</span>
                    <span>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>{t('chat.dialog.noMessages', 'No messages yet')}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Area - Restyled to be integrated */}
        <div className="bg-gray-50 p-3 border-t">
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
              capture="environment"
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleUploadClick}
              disabled={isUploading || isSending || isRecording}
              className="text-gray-500 hover:text-gray-700"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCameraClick}
              disabled={isUploading || isSending || isRecording}
              className="text-gray-500 hover:text-gray-700"
            >
              <Camera className="w-5 h-5" />
            </Button>

            {!isRecording ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={startRecording}
                disabled={isUploading || isSending}
                className="text-gray-500 hover:text-gray-700"
              >
                <Mic className="w-5 h-5" />
              </Button>
            ) : (
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopRecording}
                  className="text-red-600"
                >
                  <Square className="w-5 h-5" />
                </Button>
                <span className="text-sm text-red-600">{formatTime(recordingTime)}</span>
              </div>
            )}

            <Input
              placeholder={t('chat.dialog.messagePlaceholder', 'Type a message...')}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isRecording && handleSendMessage(newMessage)}
              disabled={isSending || isUploading || isRecording}
              className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />

            <Button
              onClick={() => handleSendMessage(newMessage)}
              disabled={isSending || isUploading || isRecording || !newMessage.trim()}
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
