import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../i18n/LanguageContext";
import NotificationCenter from "../notifications/NotificationCenter";
import { Menu, X, Package, List, DollarSign, Globe, User as UserIcon, LogOut, CalendarDays } from "lucide-react";
import { User } from "@/entities/all";

const MENU_ITEMS = [
  { value: "orders",      label: "Orders",           labelHe: "הזמנות",          icon: List },
  { value: "orders-cal",  label: "Orders (Calendar)", labelHe: "הזמנות (לוח)",   icon: CalendarDays },
  { value: "billing",     label: "Billing",           labelHe: "חיוב",            icon: DollarSign },
  { value: "profile",     label: "Profile",           labelHe: "פרופיל",          icon: UserIcon },
  { value: "language",    label: null,                labelHe: null,              icon: Globe },
];

export default function VendorMobileHeader({ vendorName }) {
  const { language, toggleLanguage } = useLanguage();
  const isHebrew = language === "Hebrew";
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleItem = (val) => {
    setMenuOpen(false);
    if (val === "language") { toggleLanguage(); return; }
    if (val === "profile") { navigate(createPageUrl("Profile")); return; }
    // Navigate to VendorDashboard with tab param
    const tab = val === "orders-cal" ? "orders" : val;
    const extra = val === "orders-cal" ? "&view=calendar" : "";
    navigate(createPageUrl("VendorDashboard") + `?tab=${tab}${extra}`);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await User.logout();
    window.location.href = createPageUrl("Stores");
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 bg-white border-b shadow-sm h-[49px] md:hidden">
        {/* Left: hamburger */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="p-1.5 rounded-md text-gray-700 hover:bg-gray-100"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

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

      {/* Drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="w-64 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <span className="font-semibold text-gray-900">Menu</span>
              <button onClick={() => setMenuOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {MENU_ITEMS.map(item => {
                const label = item.value === "language"
                  ? (isHebrew ? "English" : "עברית")
                  : (isHebrew ? item.labelHe : item.label);
                return (
                  <button
                    key={item.value}
                    onClick={() => handleItem(item.value)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 text-left"
                  >
                    <item.icon className="w-4 h-4 text-gray-500" />
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="border-t p-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                <LogOut className="w-4 h-4" />
                {isHebrew ? "התנתקות" : "Sign out"}
              </button>
            </div>
          </div>
          {/* Dim overlay */}
          <div className="flex-1 bg-black/30" />
        </div>
      )}
    </>
  );
}