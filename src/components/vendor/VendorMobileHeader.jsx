import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../i18n/LanguageContext";
import NotificationCenter from "../notifications/NotificationCenter";

export default function VendorMobileHeader({ vendorName }) {
  const { language } = useLanguage();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 bg-white border-b shadow-sm h-[49px] md:hidden">
      {/* Left placeholder for symmetry */}
      <div className="w-9" />

      {/* Center: logo + vendor name */}
      <button
        onClick={() => navigate(createPageUrl("VendorDashboard"))}
        className="flex items-center gap-1.5 min-w-0"
      >
        <img
          src="https://media.base44.com/images/public/68741e1ee947984fac63c8cf/c8712cabe_bluewithwhitebackground.png"
          alt="Zoozz"
          className="w-6 h-6 object-contain flex-shrink-0"
        />
        <span className="font-semibold text-gray-900 text-sm truncate max-w-[140px]">
          {vendorName}
        </span>
      </button>

      {/* Right: notifications */}
      <div className="flex items-center">
        <NotificationCenter />
      </div>
    </header>
  );
}