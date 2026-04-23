import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushNotificationButton({ className = '' }) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading}
      className={className}
      title={isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubscribed ? (
        <><BellOff className="w-4 h-4 mr-2" /> Notifications On</>
      ) : (
        <><Bell className="w-4 h-4 mr-2" /> Enable Notifications</>
      )}
    </Button>
  );
}