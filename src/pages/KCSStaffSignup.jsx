import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Shield, Globe, ArrowRight } from 'lucide-react';
import { useLanguage } from '../components/i18n/LanguageContext';
import { loginWithZoozzRedirect } from '../components/auth/AuthHelper';

export default function KCSStaffSignupPage() {
  const { t, language, toggleLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleStaffSignup = async () => {
    setIsLoading(true);
    try {
      // Set the signup type in session storage so AuthCallback knows this is a staff signup
      sessionStorage.setItem('signupType', 'kcs_staff');
      
      // Redirect to authentication
      await loginWithZoozzRedirect();
    } catch (error) {
      console.error('Staff signup error:', error);
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
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-4">
            <Users className="h-8 w-8 text-purple-600" />
          </div>
          <CardTitle className="text-2xl">{t('staffSignup.title', 'Join as KCS Staff')}</CardTitle>
          <CardDescription className="pt-2">
            {t('staffSignup.description', 'Help manage household orders and provide excellent service to our community.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              <Users className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">
                  {t('staffSignup.benefit1Title', 'Manage household orders')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('staffSignup.benefit1Description', 'Help households place orders and coordinate deliveries')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">
                  {t('staffSignup.benefit2Title', 'Access staff tools')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('staffSignup.benefit2Description', 'Use specialized tools designed for efficient household management')}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleStaffSignup}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('common.processing', 'Processing...')}
              </>
            ) : (
              <>
                {t('staffSignup.getStarted', 'Get Started as Staff')}
                <ArrowRight className="w-4 h-4 ml-2 rtl:mr-2 rtl:ml-0" />
              </>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            {t('staffSignup.terms', 'By signing up, you agree to our terms of service and will be assigned to households by an administrator.')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}