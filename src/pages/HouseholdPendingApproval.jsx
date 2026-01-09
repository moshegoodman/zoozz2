import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MailCheck } from 'lucide-react';
import { User } from '@/entities/User';
import { useLanguage } from '../components/i18n/LanguageContext';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function HouseholdPendingPage() {
    const { t } = useLanguage();
    const navigate = useNavigate();

    useEffect(() => {
        const checkHouseholdAssignment = async () => {
            try {
                const currentUser = await User.me();
                if (currentUser && currentUser.user_type === 'household owner' && currentUser.household_id) {
                    // User is now assigned to a household, redirect to home
                    navigate(createPageUrl("Home"), { replace: true });
                }
            } catch (error) {
                console.error("Error checking household assignment status:", error);
                // Stay on the pending page if there's an error
            }
        };

        checkHouseholdAssignment();
    }, [navigate]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <MailCheck className="h-8 w-8 text-green-600" />
                    </div>
                    <CardTitle>{t('householdPending.title', "Thank You for Signing Up!")}</CardTitle>
                    <CardDescription className="pt-2 text-base">
                        {t('householdPending.description', "Your account has been created successfully.")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-6 px-4">
                        {t('householdPending.info', "An administrator has been notified. We will assign you to your household shortly. You will receive a notification once your account is ready.")}
                    </p>
                    
                </CardContent>
            </Card>
        </div>
    );
}