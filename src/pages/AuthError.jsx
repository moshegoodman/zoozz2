import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { loginWithZoozzRedirect } from '../components/auth/AuthHelper';

export default function AuthErrorPage() {
  const navigate = useNavigate();

  const handleTryAgain = async () => {
    await loginWithZoozzRedirect();
  };

  const handleBackToHome = () => {
    navigate(createPageUrl('Home'), { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Issue</h2>
          <p className="text-gray-600 mb-6">
            We encountered a problem during the sign-in process. This can happen for several reasons:
          </p>
          <div className="text-left bg-gray-50 p-4 rounded-lg mb-6 text-sm text-gray-700">
            <ul className="space-y-2">
              <li>• Network connectivity issues</li>
              <li>• Temporary service unavailability</li>
              <li>• Browser blocking the authentication process</li>
              <li>• Ad blockers or security extensions interfering</li>
            </ul>
          </div>
          <div className="space-y-3">
            <Button 
              onClick={handleTryAgain}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={handleBackToHome}
              variant="outline"
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> Try disabling ad blockers or using a different browser if the issue persists.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}