import React, { useState, useEffect } from "react";
import { Chat, Vendor, Household } from "@/entities/all";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MessageCircle, Send, Paperclip, Loader2, Camera, Mic, Play, Pause, Square,
  Store, User as UserIcon
} from "lucide-react";
import { UploadFile } from "@/integrations/Core";
import { useLanguage } from "../i18n/LanguageContext";
import { formatRelativeTime } from "../i18n/dateUtils";

export default function VendorChatDialog({ isOpen, onClose, chatId, user }) {
  const { t, language } = useLanguage();
  const [chat, setChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [household, setHousehold] = useState(null);

  const fileInputRef = React.useRef(null);
  const cameraInputRef = React.useRef(null);
  const mediaRecorderRef = React.useRef(null);
  const recordingIntervalRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const messagesEndRef = React.useRef(null);

  useEffect(() => {
    if (isOpen && chatId) {
      loadChat();
    }
  }, [isOpen, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  const loadChat = async () => {
    setIsLoading(true);
    try {
      const chatData = await Chat.get(chatId);
      setChat(chatData);

      // Load vendor and household data
      if (chatData.vendor_id) {
        const vendorData = await Vendor.get(chatData.vendor_id);
        setVendor(vendorData);
      }
      if (chatData.household_id) {
        const householdData = await Household.get(chatData.household_id);
        setHousehold(householdData);
      }
    } catch (error) {
      console.error("Error loading chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (text, imageUrl = null, voiceUrl = null, voiceDuration = null) => {
    if ((!text || !text.trim()) && !imageUrl && !voiceUrl) return;
    if (!chat || !user) return;

    setIsSending(true);
    try {
      const messageData = {
        sender_email: user.email,
        sender_type: "vendor",
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
    } catch (error) {
      console.error("Error sending message:", error);
      alert(t('vendor.chat.sendMessageError', 'Failed to send message'));
    } finally {
      setIsSending(false);
    }
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
      alert(t('common.uploadError', 'Failed to upload file'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
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
          alert(t('common.uploadError', 'Failed to upload voice message'));
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
      alert(t('common.mediaError', 'Failed to access microphone'));
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
      alert(t('common.mediaError', 'Failed to play audio'));
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getChatTitle = () => {
    if (!chat) return "";
    
    const householdName = household?.name || chat.household_name || t('common.unknownHousehold', 'Unknown Household');
    const householdCode = household?.household_code || chat.household_code || 'N/A';
    
    return `${householdName} (#${householdCode})`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {getChatTitle()}
          </DialogTitle>
          {chat?.customer_email && (
            <p className="text-sm text-gray-500">{chat.customer_email}</p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-lg">
              {chat?.messages?.map((msg, index) => (
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
                        : 'bg-white text-gray-900 border'
                    }`}
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
                          {playingVoice === index ? 
                            <Pause className="w-4 h-4" /> : 
                            <Play className="w-4 h-4" />
                          }
                        </Button>
                        <span className="text-xs">
                          {msg.voice_duration ? formatTime(msg.voice_duration) : t('vendor.chat.voice', 'Voice')}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    {msg.sender_type === 'vendor' ? 
                      <Store className="w-3 h-3" /> : 
                      <UserIcon className="w-3 h-3" />
                    }
                    <span className="mr-2">{msg.sender_email}</span>
                    <span>{formatRelativeTime(new Date(msg.timestamp), language)}</span>
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t bg-white">
              <div className="flex items-center gap-2">
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
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading || isSending || isRecording}
                >
                  {isUploading ? 
                    <Loader2 className="w-5 h-5 animate-spin" /> : 
                    <Paperclip className="w-5 h-5" />
                  }
                </Button>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => cameraInputRef.current?.click()} 
                  disabled={isUploading || isSending || isRecording}
                >
                  <Camera className="w-5 h-5" />
                </Button>

                {!isRecording ? (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={startRecording} 
                    disabled={isUploading || isSending}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
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
                  placeholder={t('vendor.chat.typeMessage', 'Type a message...')}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !isRecording && handleSendMessage(newMessage)}
                  disabled={isSending || isUploading || isRecording}
                  className="flex-1"
                />
                
                <Button 
                  onClick={() => handleSendMessage(newMessage)} 
                  disabled={isSending || isUploading || isRecording || !newMessage.trim()}
                >
                  {isSending ? 
                    <Loader2 className="w-5 h-5 animate-spin" /> : 
                    <Send className="w-5 h-5" />
                  }
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}