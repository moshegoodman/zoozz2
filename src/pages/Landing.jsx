import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, Home, Mail, Loader2 } from 'lucide-react';
import { sendGridEmail } from '@/functions/sendGridEmail';

export default function LandingPage() {
  const [showContact, setShowContact] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!form.email || !form.message) return;
    setIsSending(true);
    try {
      await sendGridEmail({
        to: 'support@zoozz.com',
        subject: form.subject || 'Contact from Landing Page',
        body: `<p><strong>From:</strong> ${form.name} &lt;${form.email}&gt;</p><p><strong>Message:</strong></p><p>${form.message.replace(/\n/g, '<br/>')}</p>`
      });
      setSent(true);
    } catch (e) {
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setShowContact(false);
    setSent(false);
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-3xl mx-auto py-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-4 py-1.5 rounded-full mb-8">
          <Home className="w-4 h-4" />
          <span>All-in-One Operations Management</span>
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
          Run Your Entire Operation.
          <br />Effortlessly.
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Zoozz helps you manage households, staff, vendors, picking, warehouse
          operations, payroll, invoicing, and more — all in one reliable platform.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base rounded-lg shadow-md"
            onClick={() => setShowContact(true)}
          >
            <Mail className="mr-2 w-4 h-4" />
            Contact Us
          </Button>
          <Button variant="ghost" size="lg" className="text-gray-700 hover:bg-gray-100 text-base px-6 py-3">
            <Play className="mr-2 w-4 h-4 fill-gray-700" />
            Watch Demo
            <span className="block text-xs text-gray-400 ml-1">See how it works</span>
          </Button>
        </div>
      </div>

      {/* Contact Modal */}
      <Dialog open={showContact} onOpenChange={handleClose}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Contact Us</DialogTitle>
          </DialogHeader>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Message Sent!</h3>
              <p className="text-gray-500 mb-6">We'll get back to you as soon as possible.</p>
              <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">Close</Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="Your name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="What's this about?" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea id="message" placeholder="Write your message here..." rows={5} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleSend}
                disabled={isSending || !form.email || !form.message}
              >
                {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : 'Send Message'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}