
import React, { useState, useEffect, useCallback } from 'react';
import { Notification, Order, User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, X, MessageCircle, Package } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from '../i18n/LanguageContext';
import ChatDialog from '../chat/ChatDialog';
import VendorChatDialog from '../chat/VendorChatDialog';
import OrderDetailsModal from '../vendor/OrderDetailsModal';
import ViewOnlyOrderModal from '../chat/ViewOnlyOrderModal';

export default function NotificationCenter() {
  const { t, isRTL } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  
  // States for opening chat or order modals
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null); // This state seems unused, consider removing if not needed elsewhere
  const [selectedOrderForVendor, setSelectedOrderForVendor] = useState(null);
  const [selectedOrderForKCS, setSelectedOrderForKCS] = useState(null);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const notifs = await Notification.filter(
        { user_email: user.email },
        '-created_date',
        50
      );
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [user]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, loadNotifications]);

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      if (!notification.is_read) {
        await Notification.update(notification.id, { is_read: true });
        await loadNotifications();
      }

      // If there's a link_to, use it
      if (notification.link_to) {
        window.location.href = notification.link_to;
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const handleViewOrder = async (notification, e) => {
    e.stopPropagation();
    
    if (!notification.order_id) return;
    
    try {
      const order = await Order.get(notification.order_id);
      if (order) {
        // Mark notification as read
        if (!notification.is_read) {
          await Notification.update(notification.id, { is_read: true });
          await loadNotifications();
        }
        
        // Determine which modal to use based on user type
        if (user?.user_type === 'kcs staff') {
          setSelectedOrderForKCS(order);
        } else if (user?.user_type === 'vendor' || user?.user_type === 'picker' || 
            user?.user_type === 'admin' || user?.user_type === 'chief of staff') {
          setSelectedOrderForVendor(order);
        }
        
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error loading order:', error);
    }
  };

  const handleViewChat = async (notification, e) => {
    e.stopPropagation();
    
    if (!notification.chat_id) return;
    
    try {
      // Mark notification as read
      if (!notification.is_read) {
        await Notification.update(notification.id, { is_read: true });
        await loadNotifications();
      }
      
      setSelectedChatId(notification.chat_id);
      setIsOpen(false);
    } catch (error) {
      console.error('Error opening chat:', error);
    }
  };

  const handleDismiss = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await Notification.delete(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(n => Notification.update(n.id, { is_read: true }))
      );
      await loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_message':
        return <MessageCircle className="w-4 h-4 text-blue-600" />;
      case 'order_update':
        return <Package className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleOrderUpdate = async (updatedOrder) => {
    // This function is currently only used for Vendor Order Details Modal
    // If KCS staff modal needs order updates, a similar handler would be needed for selectedOrderForKCS
    setSelectedOrderForVendor(updatedOrder); 
  };

  const canViewOrder = (notification) => {
    return notification.order_id && 
           (user?.user_type === 'vendor' || user?.user_type === 'picker' || 
            user?.user_type === 'admin' || user?.user_type === 'chief of staff' ||
            user?.user_type === 'kcs staff');
  };

  const canViewChat = (notification) => {
    return notification.chat_id;
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0" 
          align={isRTL ? "start" : "end"}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">{t('notifications.title', 'Notifications')}</h3>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleMarkAllRead}
                className="text-xs"
              >
                {t('notifications.markAllRead', 'Mark all read')}
              </Button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>{t('notifications.noNotifications', 'No notifications')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.is_read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm text-gray-900">
                            {notification.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => handleDismiss(notification.id, e)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(notification.created_date).toLocaleString()}
                        </p>
                        
                        {/* Action buttons */}
                        <div className="flex gap-2 mt-3">
                          {canViewOrder(notification) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleViewOrder(notification, e)}
                              className="text-xs"
                            >
                              <Package className="w-3 h-3 mr-1" />
                              {t('notifications.viewOrder', 'View Order')}
                            </Button>
                          )}
                          {canViewChat(notification) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleViewChat(notification, e)}
                              className="text-xs"
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />
                              {t('notifications.viewChat', 'View Chat')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Chat Dialog - Used for customers and when opened from notification */}
      {selectedChatId && user?.user_type !== 'vendor' && user?.user_type !== 'picker' && (
        <ChatDialog
          isOpen={!!selectedChatId}
          onClose={() => setSelectedChatId(null)}
          chatId={selectedChatId}
        />
      )}

      {/* Vendor Chat Dialog - Used for vendors and pickers */}
      {selectedChatId && (user?.user_type === 'vendor' || user?.user_type === 'picker') && (
        <VendorChatDialog
          isOpen={!!selectedChatId}
          onClose={() => setSelectedChatId(null)}
          chatId={selectedChatId}
          user={user}
        />
      )}

      {/* Order Details Modal for vendor/picker/admin/chief of staff */}
      {selectedOrderForVendor && (
        <OrderDetailsModal
          order={selectedOrderForVendor}
          isOpen={!!selectedOrderForVendor}
          onClose={() => setSelectedOrderForVendor(null)}
          onOrderUpdate={handleOrderUpdate}
          userType={user?.user_type}
        />
      )}

      {/* View Only Order Modal for KCS staff */}
      {selectedOrderForKCS && (
        <ViewOnlyOrderModal
          order={selectedOrderForKCS}
          isOpen={!!selectedOrderForKCS}
          onClose={() => setSelectedOrderForKCS(null)}
        />
      )}
    </>
  );
}
