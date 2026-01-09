import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendWhatsApp } from '@/functions/sendWhatsApp';
import { useLanguage } from '../i18n/LanguageContext';

export default function TestWhatsApp() {
  const { t } = useLanguage();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [templateSid, setTemplateSid] = useState('');
  const [templateVariables, setTemplateVariables] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('session');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    let payload = { phoneNumber };

    if (activeTab === 'session') {
      payload.message = message;
    } else {
      payload.templateSid = templateSid;
      try {
        payload.templateVariables = templateVariables ? JSON.parse(templateVariables) : {};
      } catch (err) {
        setResult({ type: 'error', message: t('admin.testWhatsApp.invalidJsonError', 'Invalid JSON format for template variables.') });
        setIsLoading(false);
        return;
      }
    }

    try {
      const response = await sendWhatsApp(payload);
      if (response.data.success) {
        setResult({ type: 'success', message: `Message sent successfully! SID: ${response.data.messageSid}` });
        // Clear fields on success
        if (activeTab === 'session') setMessage('');
        else {
          setTemplateSid('');
          setTemplateVariables('');
        }
      } else {
        setResult({ type: 'error', message: `Error: ${response.data.error || 'An unknown error occurred.'}` });
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.error || error.message || 'An unexpected error occurred.';
      setResult({ type: 'error', message: `Failed to send message: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.testWhatsApp.title', 'Test WhatsApp Messaging')}</CardTitle>
        <CardDescription>{t('admin.testWhatsApp.description', 'Send a test WhatsApp message using the configured Twilio number.')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="whatsapp-phone">{t('admin.testWhatsApp.phoneNumber', 'Recipient Phone Number')}</Label>
            <Input
              id="whatsapp-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+972501234567"
              required
            />
            <p className="text-xs text-gray-500 mt-1">{t('admin.testWhatsApp.phoneFormat', 'Must be in E.164 format or a local number that will be converted.')}</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="session">{t('admin.testWhatsApp.sessionMessage', 'Session Message')}</TabsTrigger>
              <TabsTrigger value="template">{t('admin.testWhatsApp.templateMessage', 'Template Message')}</TabsTrigger>
            </TabsList>
            <TabsContent value="session" className="pt-4 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">{t('admin.testWhatsApp.sessionMessageHelp', 'Use for freeform replies within 24 hours of the user\'s last message.')}</p>
              </div>
              <div>
                <Label htmlFor="whatsapp-message">{t('admin.testWhatsApp.message', 'Message')}</Label>
                <Textarea
                  id="whatsapp-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('admin.testWhatsApp.messagePlaceholder', 'Enter your message here...')}
                  required={activeTab === 'session'}
                />
              </div>
            </TabsContent>
            <TabsContent value="template" className="pt-4 space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-yellow-700 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">{t('admin.testWhatsApp.templateMessageHelp', 'Use a pre-approved template to initiate a conversation or message after 24 hours.')}</p>
              </div>
              <div>
                <Label htmlFor="template-sid">{t('admin.testWhatsApp.templateSid', 'Template SID')}</Label>
                <Input
                  id="template-sid"
                  value={templateSid}
                  onChange={(e) => setTemplateSid(e.target.value)}
                  placeholder={t('admin.testWhatsApp.templateSidPlaceholder', 'e.g., HXXXXXXXXXXXXXXXXX')}
                  required={activeTab === 'template'}
                />
                <p className="text-xs text-gray-500 mt-1">{t('admin.testWhatsApp.templateSidHelp', 'Find this in your Twilio Console under Messaging > Senders > WhatsApp Templates.')}</p>
              </div>
              <div>
                <Label htmlFor="template-variables">{t('admin.testWhatsApp.templateVariables', 'Template Variables (JSON)')}</Label>
                <Textarea
                  id="template-variables"
                  value={templateVariables}
                  onChange={(e) => setTemplateVariables(e.target.value)}
                  placeholder={t('admin.testWhatsApp.templateVariablesPlaceholder', 'e.g., {"1": "John", "2": "your order #123"}')}
                  className="font-mono"
                />
                 <p className="text-xs text-gray-500 mt-1">{t('admin.testWhatsApp.templateVariablesHelp', 'Use numeric keys corresponding to the {{n}} placeholders in your template.')}</p>
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('admin.testWhatsApp.sendMessage', 'Send Message')}
          </Button>
        </form>
        {result && (
          <div className={`mt-4 p-4 rounded-md text-sm ${
            result.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}