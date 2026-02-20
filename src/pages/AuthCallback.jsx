import React, { useEffect, useState, useCallback } from 'react';
import { User } from '@/entities/User';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Rocket, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sendNewUserNotification } from "@/functions/sendNewUserNotification";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  const processAuth = useCallback(async (attempt = 1) => {
    try {
      // Clear any previous routing flags to ensure fresh navigation
      sessionStorage.removeItem('entryRoutedV2');
      
      // Check if this is a specific signup type
      const signupType = sessionStorage.getItem('signupType');
      
      // Attempt to get the current user
      let currentUser = await User.me();
      
      if (currentUser) {
        const isNewUser = !currentUser.user_type; // A user is new if they don't have a user_type yet.

        // Handle different signup types and update user type accordingly
        if (signupType && isNewUser) {
          let userType;
          switch (signupType) {
            case 'household_owner':
              userType = 'household owner';
              break;
            case 'vendor':
              userType = 'vendor';
              break;
            case 'kcs_staff':
              userType = 'kcs staff';
              break;
            default:
              userType = null;
          }

          if (userType) {
            const updatedUser = await User.updateMyUserData({ user_type: userType });
            currentUser = updatedUser; // Use the updated user object for the rest of the logic
          }
          // Clear the flag after processing
          sessionStorage.removeItem('signupType');
        }
        
        // --- Centralized New User Notification Logic ---
        // Send notification ONLY if the user was truly new AND the notification hasn't been sent yet for this session.
        const notificationSentFlag = sessionStorage.getItem('newUserNotificationSent');
        if (isNewUser && !notificationSentFlag) {
            try {
                // Use the currentUser object which now has the potentially updated user_type
                await sendNewUserNotification({ user: currentUser });
                sessionStorage.setItem('newUserNotificationSent', 'true'); // Set flag to prevent future duplicates in this session
            } catch (emailError) {
                console.error("Failed to send admin notification for new user:", emailError);
            }
        }
        // --- End Centralized New User Notification Logic ---
        
        setStatus('success');
        
        // Small delay to show success message
        setTimeout(() => {
          // Determine where to redirect based on the user type
          const finalUserType = currentUser.user_type;

          if (finalUserType === 'vendor') {
            navigate(createPageUrl('VendorSetup'), { replace: true });
          } else if (finalUserType === 'kcs staff') {
            navigate(createPageUrl('KCSProfileSetup'), { replace: true });
          } else if (finalUserType === 'picker') {
            navigate(createPageUrl('VendorDashboard'), { replace: true });
          } else if (finalUserType === 'admin' || finalUserType === 'chief of staff') {
            navigate(createPageUrl('AdminDashboard'), { replace: true });
          } else if (finalUserType === 'household owner') {
            // Check if household owner has a household assigned
            if (currentUser.household_id) {
              navigate(createPageUrl('Home'), { replace: true });
            } else {
              navigate(createPageUrl('HouseholdPendingApproval'), { replace: true });
            }
          } else {
            // For new users without a type, or existing regular customers, send to UserSetup to get customer role.
             navigate(createPageUrl('UserSetup'), { replace: true });
          }
        }, 1000);
      } else {
        throw new Error('Authentication successful but user data not available');
      }
    } catch (error) {
      console.error(`Auth attempt ${attempt} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        // Retry after delay
        setTimeout(() => {
          setRetryCount(attempt);
          processAuth(attempt + 1);
        }, RETRY_DELAY * attempt); // Progressive delay
      } else {
        // All retries failed
        setStatus('error');
        setErrorMessage(error.message || 'Authentication failed after multiple attempts');
      }
    }
  }, [navigate]);

  useEffect(() => {
    // Start the authentication process
    processAuth();
  }, [processAuth]);

  const handleRetry = () => {
    setStatus('processing');
    setRetryCount(0);
    setErrorMessage('');
    processAuth();
  };

  const handleBackToLogin = () => {
    // Clear any auth-related storage
    sessionStorage.removeItem('entryRoutedV2');
    sessionStorage.removeItem('signupType');
    sessionStorage.removeItem('newUserNotificationSent');
    navigate(createPageUrl('Home'), { replace: true });
  };

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Rocket className="w-16 h-16 text-green-600 mx-auto mb-6 animate-pulse" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Zoozz!</h2>
            <p className="text-gray-600 mb-6">
              We're setting up your account...
              {retryCount > 0 && (
                <span className="block text-sm text-orange-600 mt-2">
                  Retry attempt {retryCount} of {MAX_RETRIES}
                </span>
              )}
            </p>
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-sm text-gray-500">Please wait...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Rocket className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Login Successful!</h2>
            <p className="text-gray-600 mb-6">
              Welcome back! Redirecting you now...
            </p>
            <div className="animate-pulse">
              <div className="h-2 bg-green-200 rounded-full">
                <div className="h-2 bg-green-600 rounded-full animate-[width_1s_ease-in-out]" style={{width: '100%'}}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Login Issue</h2>
          <p className="text-gray-600 mb-2">
            We encountered a problem while signing you in.
          </p>
          {errorMessage && (
            <p className="text-sm text-red-600 mb-6 bg-red-50 p-3 rounded-lg">
              {errorMessage}
            </p>
          )}
          <div className="space-y-3">
            <Button 
              onClick={handleRetry}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={handleBackToLogin}
              variant="outline"
              className="w-full"
            >
              Back to Home
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            If this problem persists, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}