import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushNotificationButton({ className = '' }) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button
        variant={isSubscribed ? 'default' : 'outline'}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
        className={isSubscribed ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
        title={isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSubscribed ? (
          <><Bell className="w-4 h-4 mr-2" /> Enabled</>
        ) : (
          <><BellOff className="w-4 h-4 mr-2" /> Disabled</>
        )}
      </Button>
      <span className={`text-xs font-medium flex items-center gap-1 ${isSubscribed ? 'text-green-600' : 'text-gray-400'}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${isSubscribed ? 'bg-green-500' : 'bg-gray-300'}`} />
        {isSubscribed ? 'Push notifications are on' : 'Push notifications are off'}
      </span>
    </div>
  );
}