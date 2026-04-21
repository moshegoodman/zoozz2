import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import KCSHome from '../components/home/KCSHome';
import { useLanguage } from '../components/i18n/LanguageContext';

export default function StoresPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loadingSession', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return <KCSHome />;
}