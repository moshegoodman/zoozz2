import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushNotificationButton({ className = '' }) {
  const { isSupported, isSubscribed, isLoading, permissionDenied, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  if (permissionDenied) {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    let steps = '';
    if (isIOS && isSafari) {
      steps = 'Go to iPhone Settings → Safari → Notifications → find this site and set to Allow.';
    } else if (isAndroid) {
      steps = 'Tap the lock icon in your browser address bar → Notifications → Allow, then reload.';
    } else {
      steps = 'Click the lock icon in your browser address bar → Notifications → Allow, then reload the page.';
    }

    return (
      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <BellOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">Notifications are blocked by your browser</p>
          <p className="text-xs mt-1">{steps}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs underline text-amber-700 hover:text-amber-900"
          >
            Reload after allowing →
          </button>
        </div>
      </div>
    );
  }

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