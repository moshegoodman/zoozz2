import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Play, Home, Mail, Loader2, CheckCircle2, Users, Store, Package,
  BarChart3, MessageSquare, Wallet, Layers, ArrowRight } from
'lucide-react';
import { submitContactForm } from '@/functions/submitContactForm';

function ContactModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!form.email || !form.message || isSending) return;
    setIsSending(true);
    try {
      await submitContactForm({
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message
      });

      setSent(true);
    } catch (e) {
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {setSent(false);setForm({ name: '', email: '', subject: '', message: '' });}, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Contact Us</DialogTitle>
        </DialogHeader>
        {sent ?
        <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Message Sent!</h3>
            <p className="text-gray-500 mb-6">We'll get back to you as soon as possible.</p>
            <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">Close</Button>
          </div> :

        <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Your name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" placeholder="What's this about?" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="message">Message *</Label>
              <Textarea id="message" placeholder="Write your message here..." rows={5} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} />
            </div>
            <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleSend}
            disabled={isSending || !form.email || !form.message}>
            
              {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : 'Send Message'}
            </Button>
          </div>
        }
      </DialogContent>
    </Dialog>);

}

const buildItems = [
{ icon: Home, label: 'Household & Client Management' },
{ icon: Users, label: 'Staff & Role-Based Dashboards' },
{ icon: Store, label: 'Vendor & Supplier Systems' },
{ icon: Package, label: 'Warehouse & Picking Operations' },
{ icon: Layers, label: 'Order & Inventory Management' },
{ icon: Wallet, label: 'Payroll & Billing' },
{ icon: BarChart3, label: 'Custom Reports & Insights' },
{ icon: MessageSquare, label: 'Internal Communication Tools' }];


const steps = [
{ num: '01', title: 'Understand Your Business', desc: 'We dive deep into how your company actually operates — not how software thinks it should.' },
{ num: '02', title: 'Design Your System', desc: 'We map and design a system built specifically around your workflows.' },
{ num: '03', title: 'Build & Customize', desc: 'We develop your platform with precision, flexibility, and scalability in mind.' },
{ num: '04', title: 'Launch & Support', desc: 'We deploy your system and stay with you to refine, improve, and grow it over time.' }];


const whyItems = [
'Fully Custom Solutions — no one-size-fits-all limitations',
'Professional, Scalable Architecture',
'Clean, Intuitive Interfaces for Your Team',
'Fast Iteration & Continuous Improvement',
'Reliable Performance You Can Trust'];


export default function LandingPage() {
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center px-6 text-center py-24 bg-[#cfd5f0]">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-4 py-1.5 rounded-full mb-8">
            <Home className="w-4 h-4" />
            <span>Custom Operational Systems</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-4">
            From A to Zoozz.
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-gray-700 mb-6">
            Custom Systems Built for Your Business —<br className="hidden md:block" /> Not the Other Way Around.
          </p>
          <p className="text-lg text-gray-500 mb-4 max-w-2xl mx-auto">
            Every company runs differently. Your software should too.
          </p>
          <p className="text-base text-gray-500 mb-4 max-w-2xl mx-auto">
            We design and build fully customized operational systems tailored to your exact workflows — from household and staff management to vendors, warehouse operations, payroll, invoicing, and beyond.
          </p>
          <p className="text-base font-medium text-gray-700 mb-10">
            No templates. No limitations. Just software that fits your business perfectly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-base rounded-lg shadow-md" onClick={() => setShowContact(true)}>
              Get Your Custom System <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button variant="ghost" size="lg" className="text-gray-700 hover:bg-gray-100 text-base px-6 py-3">
              <Play className="mr-2 w-4 h-4 fill-gray-700" />
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* ── VALUE PROPOSITION ───────────────────────────────────── */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Software That Adapts to You — Not the Opposite
          </h2>
          <p className="text-gray-500 text-lg mb-10">
            Most platforms force you to adjust your business to their structure.<br />We do the opposite.
          </p>
          <p className="text-gray-700 font-medium mb-6">Zoozz builds systems around:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Your processes', 'Your team structure', 'Your operational flow', 'Your business goals'].map((item) =>
            <div key={item} className="bg-white border border-gray-200 rounded-xl px-4 py-5 text-sm font-semibold text-gray-800 shadow-sm">
                {item}
              </div>
            )}
          </div>
          <p className="text-gray-500 mt-8 text-base">
            So everything works naturally, efficiently, and at scale.
          </p>
        </div>
      </section>

      {/* ── WHAT WE BUILD ───────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-green-600 font-semibold uppercase tracking-wide text-sm mb-2">What We Build</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Complete Operational Systems — All in One Place
          </h2>
          <p className="text-gray-500 mb-12">We create integrated platforms that can include:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {buildItems.map(({ icon: Icon, label }) =>
            <div key={label} className="flex flex-col items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Icon className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-800 text-center">{label}</p>
              </div>
            )}
          </div>
          <p className="mt-10 text-gray-600 font-medium">Everything connected. Everything tailored.</p>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-green-600 font-semibold uppercase tracking-wide text-sm mb-2">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Four Simple Steps</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {steps.map(({ num, title, desc }) =>
            <div key={num} className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div className="text-4xl font-extrabold text-green-100 mb-3">{num}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── WHY ZOOZZ ───────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-green-600 font-semibold uppercase tracking-wide text-sm mb-2">Why Zoozz</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-10">
            Built for Complexity. Designed for Simplicity.
          </h2>
          <div className="space-y-4 text-left">
            {whyItems.map((item) =>
            <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-base">{item}</p>
              </div>
            )}
          </div>
          <p className="mt-10 text-gray-600 italic text-base">
            We don't just build software.<br />We build the system your business actually needs to run.
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="bg-[#3faf8f] py-20 px-6 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Your Business Deserves Software That Fits
          </h2>
          <p className="text-green-100 text-lg mb-4">
            Whether you're managing operations, logistics, staff, or growth —<br />we'll build a system that works exactly the way you do.
          </p>
          <p className="text-green-100 mb-8">
            For your very own system — built from the ground up:
          </p>
          <Button
            size="lg"
            className="bg-white text-green-700 hover:bg-green-50 px-10 py-3 text-base font-semibold rounded-lg shadow-md"
            onClick={() => setShowContact(true)}>
            
            <Mail className="mr-2 w-4 h-4" />
            Contact Us
          </Button>
        </div>
      </section>

      <ContactModal open={showContact} onClose={() => setShowContact(false)} />
    </div>);

}