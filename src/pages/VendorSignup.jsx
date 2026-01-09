import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Store, Globe, ArrowRight } from 'lucide-react';
import { useLanguage } from '../components/i18n/LanguageContext';
import { loginWithZoozzRedirect } from '../components/auth/AuthHelper';

export default function VendorSignupPage() {
  const { t, language, toggleLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleVendorSignup = async () => {
    setIsLoading(true);
    try {
      // Set the signup type in session storage so AuthCallback knows this is a vendor signup
      sessionStorage.setItem('signupType', 'vendor');
      
      // Redirect to authentication
      await loginWithZoozzRedirect();
    } catch (error) {
      console.error('Vendor signup error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <Button variant="outline" onClick={toggleLanguage}>
          <Globe className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {language === 'English' ? 'עברית' : 'English'}
        </Button>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <Store className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">{t('vendorSignup.title', 'Join as a Vendor')}</CardTitle>
          <CardDescription className="pt-2">
            {t('vendorSignup.description', 'Start selling your products on our platform and reach more customers.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              <Building className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">
                  {t('vendorSignup.benefit1Title', 'Set up your online store')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('vendorSignup.benefit1Description', 'Create your vendor profile and showcase your products')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              <Store className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">
                  {t('vendorSignup.benefit2Title', 'Manage orders and inventory')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('vendorSignup.benefit2Description', 'Use our vendor dashboard to track orders and manage your products')}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleVendorSignup}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('common.processing', 'Processing...')}
              </>
            ) : (
              <>
                {t('vendorSignup.getStarted', 'Get Started as Vendor')}
                <ArrowRight className="w-4 h-4 ml-2 rtl:mr-2 rtl:ml-0" />
              </>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            {t('vendorSignup.terms', 'By signing up, you agree to our terms of service and will need admin approval to start selling.')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}