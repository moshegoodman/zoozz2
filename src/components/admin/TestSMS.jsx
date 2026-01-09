import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, CheckCircle, XCircle } from 'lucide-react';
import { sendSMS } from "@/functions/sendSMS";
import { sendOrderSMS } from "@/functions/sendOrderSMS";

export default function TestSMS() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [messageType, setMessageType] = useState('order_confirmed');
  const [recipientType, setRecipientType] = useState('customer');
  const [testType, setTestType] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSendGeneralSMS = async () => {
    if (!phoneNumber || !message) {
      setResult({ success: false, error: 'Phone number and message are required' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendSMS({
        phoneNumber,
        message,
        messageType: 'test'
      });

      setResult(response.data);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOrderSMS = async () => {
    if (!orderId) {
      setResult({ success: false, error: 'Order ID is required' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendOrderSMS({
        orderId,
        messageType,
        recipientType
      });

      setResult(response.data);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            SMS Testing Center
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Test Type</label>
            <Select value={testType} onValueChange={setTestType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General SMS</SelectItem>
                <SelectItem value="order">Order SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {testType === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <Input
                  placeholder="+972501234567 or 0501234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <Textarea
                  placeholder="Enter your test message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleSendGeneralSMS} disabled={isLoading}>
                <Send className="w-4 h-4 mr-2" />
                {isLoading ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          )}

          {testType === 'order' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Order ID</label>
                <Input
                  placeholder="Enter existing order ID..."
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Message Type</label>
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order_confirmed">Order Confirmed</SelectItem>
                    <SelectItem value="order_ready">Order Ready</SelectItem>
                    <SelectItem value="order_shipped">Order Shipped</SelectItem>
                    <SelectItem value="order_delivered">Order Delivered</SelectItem>
                    <SelectItem value="new_order">New Order (Vendor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Recipient</label>
                <Select value={recipientType} onValueChange={setRecipientType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSendOrderSMS} disabled={isLoading}>
                <Send className="w-4 h-4 mr-2" />
                {isLoading ? 'Sending...' : 'Send Order SMS'}
              </Button>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? 'SMS Sent Successfully!' : 'SMS Failed'}
                </span>
              </div>
              {result.success && (
                <div className="text-sm text-green-700">
                  <p>Message SID: {result.messageSid}</p>
                  <p>Status: {result.status}</p>
                  {result.phoneNumber && <p>Sent to: {result.phoneNumber}</p>}
                </div>
              )}
              {!result.success && (
                <p className="text-sm text-red-700">{result.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}