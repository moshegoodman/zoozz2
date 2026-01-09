import React, { useState, useEffect } from 'react';
import { WhatsAppConsent, WhatsAppTemplate } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, X, Plus, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

export default function WhatsAppConsentManagement() {
  const { t } = useLanguage();
  const [consents, setConsents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [consentsData, templatesData] = await Promise.all([
        WhatsAppConsent.list('-created_date'),
        WhatsAppTemplate.list()
      ]);
      setConsents(consentsData);
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading WhatsApp data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeConsent = async (consentId) => {
    if (!window.confirm('Are you sure you want to revoke this WhatsApp consent?')) return;
    
    try {
      await WhatsAppConsent.update(consentId, {
        consent_given: false,
        opt_out_date: new Date().toISOString()
      });
      loadData();
    } catch (error) {
      console.error('Error revoking consent:', error);
      alert('Failed to revoke consent');
    }
  };

  const filteredConsents = consents.filter(consent =>
    consent.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    consent.phone_number.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">WhatsApp Management</h2>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Template
        </Button>
      </div>

      <Tabs defaultValue="consents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consents">User Consents</TabsTrigger>
          <TabsTrigger value="templates">Message Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="consents">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp Consents ({consents.length})
                </CardTitle>
                <Input
                  placeholder="Search by email or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredConsents.map((consent) => (
                  <div key={consent.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold">{consent.user_email}</p>
                          <p className="text-gray-600">{consent.phone_number}</p>
                          <Badge className={consent.consent_given ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {consent.consent_given ? 'Active' : 'Revoked'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>Consent Date: {format(new Date(consent.created_date), 'MMM d, yyyy HH:mm')}</p>
                          <p>Source: {consent.consent_source || 'N/A'}</p>
                          <p>Message Types: {consent.message_types_consented?.join(', ') || 'None'}</p>
                          {consent.last_message_sent && (
                            <p>Last Message: {format(new Date(consent.last_message_sent), 'MMM d, yyyy HH:mm')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {consent.consent_given && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevokeConsent(consent.id)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredConsents.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No WhatsApp consents found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                WhatsApp Templates ({templates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold">{template.name}</p>
                          <Badge variant="outline">{template.template_type}</Badge>
                          <Badge className={template.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>Template SID: {template.template_sid}</p>
                          <p>Language: {template.language}</p>
                          <p>Description: {template.description || 'No description'}</p>
                          {template.required_variables && template.required_variables.length > 0 && (
                            <p>Variables: {template.required_variables.join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {templates.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No WhatsApp templates found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}