import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle, Package, Home, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useLanguage } from '../components/i18n/LanguageContext';
import { finalizeStripeOrder } from '@/functions/finalizeStripeOrder';
import { useCart } from '../components/cart/CartContext';

export default function PaymentSuccessPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();

  const [status, setStatus] = useState('processing'); // processing, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const sessionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('session_id');
  }, [location.search]);

  useEffect(() => {
    const processOrder = async () => {
      if (!sessionId) {
        setErrorMessage(t('payment.noSessionId', 'No payment session ID found.'));
        setStatus('error');
        return;
      }

      try {
        const response = await finalizeStripeOrder({ session_id: sessionId });
        if (response.data?.success) {
          // Clear the entire cart on successful order creation
          await clearCart(); 
          setStatus('success');
        } else {
          throw new Error(response.data?.error || 'Failed to finalize order.');
        }
      } catch (error) {
        console.error("Error finalizing order:", error);
        setErrorMessage(error.message || t('payment.finalizeError', 'There was a problem confirming your order.'));
        setStatus('error');
      }
    };

    processOrder();
  }, [sessionId, t, clearCart]);

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="space-y-6">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto" />
            <p className="text-gray-600">
              {t('payment.processing', 'Finalizing your order, please wait...')}
            </p>
          </div>
        );
      case 'success':
        return (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
             <CardTitle className="text-2xl font-bold text-green-600">
              {t('payment.successTitle', 'Payment Successful!')}
            </CardTitle>
            <p className="text-gray-600">
              {t('payment.successMessage', 'Your payment has been processed and your order is confirmed. Thank you for shopping with us!')}
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate(createPageUrl('Orders'))} className="w-full bg-green-600 hover:bg-green-700">
                <Package className="w-4 h-4 mr-2" />
                {t('payment.viewOrders', 'View My Orders')}
              </Button>
              <Button variant="outline" onClick={() => navigate(createPageUrl('Home'))} className="w-full">
                <Home className="w-4 h-4 mr-2" />
                {t('payment.backToHome', 'Back to Home')}
              </Button>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">
              {t('payment.orderErrorTitle', 'Order Confirmation Failed')}
            </CardTitle>
            <p className="text-gray-600">
              {t('payment.orderErrorMessage', 'While your payment may have been successful, we encountered an issue creating your order in our system.')}
            </p>
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-md">
              <strong>{t('common.error')}:</strong> {errorMessage}
            </div>
            <p className="text-sm text-gray-500">{t('payment.contactSupport', 'Please contact support with your payment details if the issue persists.')}</p>
            <Button variant="outline" onClick={() => navigate(createPageUrl('Home'))} className="w-full">
              <Home className="w-4 h-4 mr-2" />
              {t('payment.backToHome', 'Back to Home')}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}