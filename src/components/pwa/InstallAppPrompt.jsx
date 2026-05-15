import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Download, Share, Plus, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * InstallAppPrompt
 *
 * Shows a "Save to Home Screen" / "Install App" prompt:
 *  - On Android/Chrome/Edge: uses the native `beforeinstallprompt` event for a one-tap install.
 *  - On iOS Safari: shows visual instructions (Share → Add to Home Screen) since iOS has no programmatic API.
 *  - Hides itself if the app is already installed / running in standalone mode.
 */
export default function InstallAppPrompt() {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Detect if already installed (running in standalone PWA mode)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Capture install prompt for Android/Chrome/Edge
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  // Don't render if already installed as a PWA or user dismissed
  if (isStandalone || dismissed) return null;

  const isHebrew = language === 'Hebrew';
  // If no native prompt is available and we're not on iOS, fall back to showing
  // manual "Add to Home Screen" instructions so the prompt is always visible.
  const showManualInstructions = showIOSInstructions || (!deferredPrompt && !isIOS);

  return (
    <Card className="border-2 border-purple-200 bg-purple-50 relative">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 rtl:right-auto rtl:left-2 text-purple-400 hover:text-purple-700 p-1"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-purple-900 mb-1">
              {isHebrew ? 'הוסף לדף הבית' : 'Save to Home Screen'}
            </h4>
            <p className="text-sm text-purple-800 mb-3">
              {isHebrew
                ? 'התקן את Zoozz במכשיר שלך לגישה מהירה כמו אפליקציה.'
                : 'Install Zoozz on your device for quick, app-like access.'}
            </p>

            {!showManualInstructions && (
              <Button
                type="button"
                onClick={handleInstallClick}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
                {isHebrew ? 'התקן אפליקציה' : 'Install App'}
              </Button>
            )}

            {showManualInstructions && (
              <div className="mt-2 space-y-2 text-sm text-purple-900 bg-white rounded-md p-3 border border-purple-200">
                {isIOS ? (
                  <>
                    <p className="font-medium">
                      {isHebrew ? 'כדי להתקין ב-iPhone/iPad:' : 'To install on iPhone/iPad:'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">1.</span>
                      <Share className="w-4 h-4 text-blue-600" />
                      <span>
                        {isHebrew ? 'הקש על כפתור השיתוף בסאפארי' : 'Tap the Share button in Safari'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">2.</span>
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span>
                        {isHebrew ? 'בחר "הוסף למסך הבית"' : 'Choose "Add to Home Screen"'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">3.</span>
                      <span>
                        {isHebrew ? 'הקש על "הוסף" כדי לסיים' : 'Tap "Add" to finish'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-medium">
                      {isHebrew ? 'כדי להוסיף למסך הבית:' : 'To add to your Home Screen:'}
                    </p>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>
                        {isHebrew
                          ? 'פתח את תפריט הדפדפן (⋮ או ⋯)'
                          : 'Open your browser menu (⋮ or ⋯)'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <Plus className="w-4 h-4 text-blue-600 mt-0.5" />
                      <span>
                        {isHebrew
                          ? 'בחר "התקן אפליקציה" או "הוסף למסך הבית"'
                          : 'Tap "Install app" or "Add to Home Screen"'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>
                        {isHebrew ? 'אשר את ההתקנה' : 'Confirm to install'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}