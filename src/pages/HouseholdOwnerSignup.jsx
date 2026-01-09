import React, { useEffect, useState } from 'react';
import { loginWithZoozzRedirect } from '../components/auth/AuthHelper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Rocket } from 'lucide-react';
import { useLanguage } from '../components/i18n/LanguageContext';

export default function HouseholdOwnerSignupPage() {
    const { t } = useLanguage();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        const initiateSignup = async () => {
            if (!isRedirecting) {
                setIsRedirecting(true);
                // Set a flag in session storage to identify this signup flow
                sessionStorage.setItem('signupType', 'household_owner');
                
                // Use the standard Google login flow
                await loginWithZoozzRedirect();
            }
        };

        initiateSignup();
    }, [isRedirecting]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <Rocket className="h-8 w-8 text-green-600 animate-pulse" />
                    </div>
                    <CardTitle>{t('householdSignup.title')}</CardTitle>
                    <CardDescription>
                        {t('householdSignup.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        <p className="ml-4 text-gray-600">{t('householdSignup.redirecting')}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}