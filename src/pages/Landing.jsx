import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Home } from 'lucide-react';

export default function LandingPage() {
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
          <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base rounded-lg shadow-md">
            Start Free Trial <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button variant="ghost" size="lg" className="text-gray-700 hover:bg-gray-100 text-base px-6 py-3">
            <Play className="mr-2 w-4 h-4 fill-gray-700" />
            Watch Demo
            <span className="block text-xs text-gray-400 ml-1">See how it works</span>
          </Button>
        </div>
      </div>
    </div>
  );
}