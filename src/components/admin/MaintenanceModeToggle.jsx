import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/entities/AppSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Wrench, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function MaintenanceModeToggle() {
    const { t } = useLanguage();
    const [settings, setSettings] = useState(null);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const settingsList = await AppSettings.list();
            if (settingsList.length > 0) {
                const appSettings = settingsList[0];
                setSettings(appSettings);
                setMaintenanceMode(appSettings.maintenanceMode || false);
                setMaintenanceMessage(appSettings.maintenanceMessage || '');
            } else {
                // Create initial settings
                const newSettings = await AppSettings.create({
                    maintenanceMode: false,
                    maintenanceMessage: ''
                });
                setSettings(newSettings);
                setMaintenanceMode(false);
                setMaintenanceMessage('');
            }
        } catch (error) {
            console.error("Error loading app settings:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (settings) {
                const updatedSettings = await AppSettings.update(settings.id, {
                    maintenanceMode,
                    maintenanceMessage
                });
                setSettings(updatedSettings);
                alert(t('admin.maintenance.saved', 'Maintenance mode settings saved successfully!'));
            } else {
                const newSettings = await AppSettings.create({
                    maintenanceMode,
                    maintenanceMessage
                });
                setSettings(newSettings);
                alert(t('admin.maintenance.saved', 'Maintenance mode settings saved successfully!'));
            }
        } catch (error) {
            console.error('Error saving maintenance settings:', error);
            alert(t('admin.maintenance.saveFailed', 'Failed to save settings. Please try again.'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    {t('admin.maintenance.title', 'Maintenance Mode')}
                </CardTitle>
                <CardDescription>
                    {t('admin.maintenance.description', 'Block site access for all users except admins. Users will see a maintenance message.')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <div>
                            <Label htmlFor="maintenance-toggle" className="text-base font-semibold">
                                {t('admin.maintenance.enable', 'Enable Maintenance Mode')}
                            </Label>
                            <p className="text-sm text-gray-600">
                                {maintenanceMode 
                                    ? t('admin.maintenance.activeWarning', 'Site is currently in maintenance mode')
                                    : t('admin.maintenance.inactive', 'Site is accessible to all users')}
                            </p>
                        </div>
                    </div>
                    <Switch
                        id="maintenance-toggle"
                        checked={maintenanceMode}
                        onCheckedChange={setMaintenanceMode}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="maintenance-message">
                        {t('admin.maintenance.customMessage', 'Custom Maintenance Message (Optional)')}
                    </Label>
                    <Textarea
                        id="maintenance-message"
                        placeholder={t('admin.maintenance.messagePlaceholder', 'Enter a custom message to display during maintenance...')}
                        value={maintenanceMessage}
                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                        rows={4}
                    />
                    <p className="text-xs text-gray-500">
                        {t('admin.maintenance.messageHint', 'If left empty, a default message will be displayed.')}
                    </p>
                </div>

                <Button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-green-600 hover:bg-green-700"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('admin.maintenance.saving', 'Saving...')}
                        </>
                    ) : (
                        t('admin.maintenance.saveChanges', 'Save Changes')
                    )}
                </Button>

                {maintenanceMode && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                            <strong>{t('admin.maintenance.reminder', 'Reminder:')}</strong> {t('admin.maintenance.reminderText', 'Only admins can access the site while maintenance mode is active. All other users will see the maintenance page.')}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}