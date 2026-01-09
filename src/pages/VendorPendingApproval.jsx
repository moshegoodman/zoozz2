import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '../components/i18n/LanguageContext';
import { User } from '@/entities/User';

export default function VendorPendingApproval() {
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const checkApprovalStatus = async () => {
      try {
        const currentUser = await User.me();
        if (currentUser  && currentUser.role==='admin' && 
            (currentUser.user_type === 'vendor' || currentUser.user_type === 'picker') && 
            currentUser.vendor_id) {
          // Vendor is now approved, redirect to dashboard
          navigate(createPageUrl("VendorDashboard"), { replace: true });
        }
      } catch (error) {
        console.error("Error checking vendor approval status:", error);
        // If there's an error getting user data, stay on the pending page
      }
    };

    // Check status when page loads
    checkApprovalStatus();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <Button variant="outline" onClick={toggleLanguage}>
          <Globe className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {language === 'English' ? 'עברית' : 'English'}
        </Button>
      </div>

      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-10 h-10 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">{t('vendorPending.title')}</CardTitle>
          <CardDescription className="text-lg">
            {t('vendorPending.description')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>{t('vendorPending.registrationSubmitted')}</span>
          </div>
          
          <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{t('vendorPending.awaitingApproval')}</span>
          </div>

        
          <p className="text-sm text-gray-500">
            {t('vendorPending.contactSupport')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}