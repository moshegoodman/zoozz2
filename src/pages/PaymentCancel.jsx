import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { XCircle, ShoppingCart, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '../components/i18n/LanguageContext';

export default function PaymentCancelPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600">
            {t('payment.cancelTitle', 'Payment Cancelled')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">
            {t('payment.cancelMessage', 'Your payment was cancelled. No charges have been made to your account.')}
          </p>
          <div className="space-y-3">
            <Button 
              onClick={() => navigate(createPageUrl('Cart'))}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('payment.backToCart', 'Back to Cart')}
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate(createPageUrl('Home'))}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              {t('payment.backToHome', 'Back to Home')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}