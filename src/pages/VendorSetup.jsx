import React, { useState, useEffect } from "react";
import { User } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Globe, Clock, CheckCircle } from "lucide-react";
import { useLanguage } from "../components/i18n/LanguageContext";
import { createPageUrl } from "@/utils";

export default function VendorSetup() {
  const { t, language, toggleLanguage } = useLanguage();
  const isRTL = language === 'Hebrew';
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Check if vendor is already set up
      if (currentUser.user_type === 'vendor') {
        if (currentUser.vendor_id && currentUser.role === 'admin') {
          // Vendor already has a store, redirect to dashboard
          window.location.href = createPageUrl("VendorDashboard");
          return;
        } 
        if (currentUser.vendor_id && currentUser.role === 'user') {
          // Vendor type is set but no vendor_id, redirect to pending approval
          window.location.href = createPageUrl("VendorPendingApproval");
          return;
        }
      }

      // If user is not a vendor type, redirect to home
      if (currentUser.user_type && currentUser.user_type !== 'vendor') {
        window.location.href = createPageUrl("Home");
        return;
      }
    } catch (error) {
      console.error("Error loading user:", error);
      window.location.href = createPageUrl("Home");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <Button variant="outline" onClick={toggleLanguage}>
          <Globe className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {language === 'English' ? 'עברית' : 'English'}
        </Button>
      </div>
      
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">
            {t('vendor.setup.title', 'Welcome, Future Vendor!')}
          </CardTitle>
          <p className="text-gray-600 mt-2">
            {t('vendor.setup.adminWillSetup', 'An administrator will set up your vendor account for you.')}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>{t('vendorPending.registrationSubmitted', 'Registration submitted')}</span>
          </div>
          
          <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{t('vendorPending.awaitingApproval', 'Awaiting admin setup')}</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">
              {t('vendor.setup.whatHappensNext', 'What happens next?')}
            </h4>
            <div className="text-blue-800 text-sm space-y-2">
              <p>• {t('vendor.setup.adminReview', 'An administrator will review your vendor application')}</p>
              <p>• {t('vendor.setup.storeCreation', 'Your store will be created and configured for you')}</p>
              <p>• {t('vendor.setup.notification', 'You will receive a notification when your store is ready')}</p>
              <p>• {t('vendor.setup.dashboard', 'Once ready, you can access your vendor dashboard to manage products and orders')}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              {t('vendorPending.contactSupport', 'If you have any questions, please contact support.')}
            </p>
            
            <Button
              onClick={() => window.location.href = createPageUrl("Home")}
              variant="outline"
              className="w-full"
            >
              {t('vendorPending.button', 'Go to Homepage')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}