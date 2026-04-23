import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Loader2, Send } from 'lucide-react';
import { sendPushNotification } from '@/functions/sendPushNotification';

export default function TestPushNotification() {
  const [title, setTitle] = useState('Test Notification');
  const [body, setBody] = useState('This is a test push notification from Zoozz admin.');
  const [targetEmail, setTargetEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    setIsSending(true);
    setResult(null);
    try {
      const res = await sendPushNotification({
        title,
        body,
        userEmail: targetEmail ? targetEmail.toLowerCase().trim() : undefined,
        url: '/',
        tag: 'test',
      });
      setResult({ success: true, sent: res?.data?.sent ?? 0, failed: res?.data?.failed ?? 0 });
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Test Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Message</Label>
          <Input value={body} onChange={e => setBody(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Target Email (leave empty to send to all subscribed users)</Label>
          <Input
            value={targetEmail}
            onChange={e => setTargetEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1"
          />
        </div>
        <Button onClick={handleSend} disabled={isSending || !title || !body}>
          {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {isSending ? 'Sending...' : 'Send Test Notification'}
        </Button>
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {result.success
              ? `✓ Sent to ${result.sent} device(s). ${result.failed > 0 ? `${result.failed} failed.` : ''}`
              : `✗ Error: ${result.error}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}