
import React, { useState, useEffect } from 'react';
import { AdminNotification } from '@/entities/AdminNotification';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, X, CheckCircle, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

export default function AdminNotifications() {
    const { t } = useLanguage();
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        try {
            const data = await AdminNotification.filter({ is_dismissed: false }, '-created_date');
            setNotifications(data);
        } catch (error) {
            console.error("Error loading notifications:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await AdminNotification.update(notificationId, { is_read: true });
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const dismissNotification = async (notificationId) => {
        try {
            await AdminNotification.update(notificationId, { is_dismissed: true });
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error("Error dismissing notification:", error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'subcategory_added':
                return <Tag className="w-4 h-4 text-blue-500" />;
            default:
                return <Bell className="w-4 h-4 text-gray-500" />;
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Don't render anything if there are no notifications and not loading
    if (!isLoading && notifications.length === 0) {
        return null;
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    {t('admin.notifications.title')}
                    {unreadCount > 0 && (
                        <Badge className="bg-red-500 text-white">
                            {unreadCount}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                !notification.is_read
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <div className="mt-0.5">
                                {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className={`text-sm font-medium ${
                                            !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                                        }`}>
                                            {notification.title}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {format(new Date(notification.created_date), 'MMM d, HH:mm')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!notification.is_read && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => markAsRead(notification.id)}
                                                className="h-8 w-8 p-0"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => dismissNotification(notification.id)}
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
