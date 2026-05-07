import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Mail } from "lucide-react";

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          to={createPageUrl("VendorDashboard")}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <img
              src="https://media.base44.com/images/public/68741e1ee947984fac63c8cf/c8712cabe_bluewithwhitebackground.png"
              alt="Zoozz"
              className="w-10 h-10 object-contain"
            />
            <h1 className="text-2xl font-bold text-gray-900">About Zoozz</h1>
          </div>

          <p className="text-gray-600 leading-relaxed mb-4">
            Zoozz is a smart shopping platform built for families and institutions,
            connecting households with trusted vendors for seamless ordering and delivery.
          </p>

          <p className="text-gray-600 leading-relaxed mb-8">
            Our mission is to make household procurement simple, transparent, and efficient —
            from placing an order to doorstep delivery.
          </p>

          <div className="border-t pt-6">
            <h2 className="font-semibold text-gray-900 mb-3">Contact</h2>
            <a
              href="mailto:support@zoozz.com"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium"
            >
              <Mail className="w-4 h-4" />
              support@zoozz.com
            </a>
          </div>

          <div className="border-t mt-6 pt-6">
            <Link
              to={createPageUrl("TermsOfService")}
              className="text-sm text-gray-500 hover:text-green-600 transition-colors"
            >
              Terms of Service →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}