import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import CustomerChat from '../components/chat/CustomerChat';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '../i18n/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [shoppingForHousehold, setShoppingForHousehold] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const loadSessionData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);

        if (currentUser) {
            if (currentUser.user_type === 'kcs staff') {
              const householdData = sessionStorage.getItem('selectedHousehold');
              if (householdData) {
                setSelectedHousehold(JSON.parse(householdData));
              }
            } else if (['vendor', 'picker', 'admin', 'chief of staff'].includes(currentUser.user_type)) {
              const shoppingData = sessionStorage.getItem('shoppingForHousehold');
              if (shoppingData) {
                setShoppingForHousehold(JSON.parse(shoppingData));
              }
            }
        }
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadSessionData();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-150px)]">
          <Skeleton className="h-full" />
          <Skeleton className="h-full lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
            <Card className="max-w-md mx-auto">
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('chat.signInTitle')}</h2>
                <p className="text-gray-600 mb-6">
                    {t('chat.signInToView')}
                </p>
              </CardContent>
            </Card>
        </div>
    );
  }
  
  if (user.user_type === 'kcs staff' && !selectedHousehold) {
    return (
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
            <Card className="max-w-md mx-auto">
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('chat.selectHouseholdTitle')}</h2>
                <p className="text-gray-600 mb-6">
                    {t('chat.selectHouseholdToView')}
                </p>
              </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <CustomerChat 
      user={user} 
      selectedHousehold={selectedHousehold}
      shoppingForHousehold={shoppingForHousehold}
    />
  );
}