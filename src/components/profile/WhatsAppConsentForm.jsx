import React, { useState } from 'react';
import { WhatsAppConsent } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageCircle, Phone } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function WhatsAppConsentForm({ userEmail, existingConsent = null }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState(existingConsent?.phone_number || '');
  const [messageTypes, setMessageTypes] = useState(existingConsent?.message_types_consented || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasConsent, setHasConsent] = useState(!!existingConsent?.consent_given);

  const availableMessageTypes = [
    { id: 'order_updates', label: 'Order status updates' },
    { id: 'delivery_notifications', label: 'Delivery notifications' },
    { id: 'customer_support', label: 'Customer support messages' },
    { id: 'promotional', label: 'Promotional messages' }
  ];

  const handleMessageTypeChange = (typeId, checked) => {
    setMessageTypes(prev => 
      checked 
        ? [...prev, typeId]
        : prev.filter(id => id !== typeId)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim() || messageTypes.length === 0) {
      alert('Please enter your phone number and select at least one message type');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+972${phone.replace(/^0/, '')}`;
      
      const consentData = {
        user_email: userEmail,
        phone_number: formattedPhone,
        consent_given: true,
        consent_date: new Date().toISOString(),
        consent_source: 'profile_settings',
        message_types_consented: messageTypes
      };

      if (existingConsent) {
        await WhatsAppConsent.update(existingConsent.id, consentData);
      } else {
        await WhatsAppConsent.create(consentData);
      }

      setHasConsent(true);
      alert('WhatsApp preferences saved successfully!');
    } catch (error) {
      console.error('Error saving WhatsApp consent:', error);
      alert('Failed to save WhatsApp preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeConsent = async () => {
    if (!window.confirm('Are you sure you want to stop receiving WhatsApp messages?')) return;

    setIsLoading(true);
    try {
      await WhatsAppConsent.update(existingConsent.id, {
        consent_given: false,
        opt_out_date: new Date().toISOString()
      });
      setHasConsent(false);
      alert('WhatsApp consent revoked successfully');
    } catch (error) {
      console.error('Error revoking consent:', error);
      alert('Failed to revoke consent');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600" />
          WhatsApp Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasConsent && existingConsent ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ You're subscribed to receive WhatsApp messages at {existingConsent.phone_number}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Message types: {existingConsent.message_types_consented?.join(', ')}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setHasConsent(false)}>
                Edit Preferences
              </Button>
              <Button variant="destructive" onClick={handleRevokeConsent} disabled={isLoading}>
                Stop WhatsApp Messages
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              <Input
                type="tel"
                placeholder="+972-50-123-4567 or 050-123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                We'll use this number to send you WhatsApp messages about your orders
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                What types of messages would you like to receive?
              </label>
              <div className="space-y-3">
                {availableMessageTypes.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.id}
                      checked={messageTypes.includes(type.id)}
                      onCheckedChange={(checked) => handleMessageTypeChange(type.id, checked)}
                    />
                    <label htmlFor={type.id} className="text-sm">
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">Important:</p>
              <p>By providing consent, you agree to receive WhatsApp messages from Zoozz. You can withdraw consent at any time.</p>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700">
              {isLoading ? 'Saving...' : 'Save WhatsApp Preferences'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}