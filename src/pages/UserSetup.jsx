import React, { useEffect, useState } from "react";
import { User } from "@/entities/User";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function UserSetupPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error

  useEffect(() => {
    const setupCustomerAccount = async () => {
      try {
        const currentUser = await User.me();
        
        // If user already has a type, they shouldn't be here. Redirect home.
        if (currentUser && currentUser.user_type && currentUser.user_type !== 'customerApp') {
          navigate(createPageUrl("Home"), { replace: true });
          return;
        }

        // If they are already a customer, just redirect.
        if (currentUser && currentUser.user_type === 'customerApp') {
          setStatus('success');
          setTimeout(() => navigate(createPageUrl("Home"), { replace: true }), 1000);
          return;
        }

        // Assign the default customer role if they don't have one
        await User.updateMyUserData({ user_type: 'customerApp' });

        // The notification is now sent from AuthCallback.js to prevent duplicates.
        
        setStatus('success');
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          navigate(createPageUrl("Home"), { replace: true });
        }, 1500);

      } catch (error) {
        console.error("Error setting up customer account:", error);
        setStatus('error');
      }
    };
    
    setupCustomerAccount();
  }, [navigate]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
        <h1 className="text-2xl font-bold text-gray-800">{t('userSetup.processingTitle', 'Setting Up Your Account...')}</h1>
        <p className="text-gray-600">{t('userSetup.processingDescription', 'Please wait a moment.')}</p>
      </div>
    );
  }

  if (status === 'success') {
     return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-4">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800">{t('userSetup.successTitle', 'Welcome to Zoozz!')}</h1>
        <p className="text-gray-600">{t('userSetup.successDescription', 'Redirecting you to the home page...')}</p>
      </div>
    );
  }
  
  if (status === 'error') {
     return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800">{t('userSetup.errorTitle', 'Setup Failed')}</h1>
        <p className="text-gray-600">{t('userSetup.errorDescription', 'Something went wrong. Please try signing in again.')}</p>
      </div>
    );
  }

  return null; // Should be redirected
}