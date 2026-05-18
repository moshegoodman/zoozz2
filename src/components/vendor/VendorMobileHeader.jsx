import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../i18n/LanguageContext";
import NotificationCenter from "../notifications/NotificationCenter";
import {
  Menu, X, Package, List, DollarSign, Globe, User as UserIcon,
  LogOut, CalendarDays, Settings, Users, ShoppingBag, LayoutDashboard, Truck
} from "lucide-react";
import { User } from "@/entities/all";

const HAMBURGER_ITEMS = [
  { value: "orders",         label: "Orders (List)",       labelHe: "הזמנות (רשימה)",  icon: List },
  { value: "orders-cal",     label: "Orders (Calendar)",   labelHe: "הזמנות (לוח)",    icon: CalendarDays },
  { value: "shopping-list",  label: "Shopping List",       labelHe: "רשימת קניות",      icon: List },
  { value: "shopping",       label: "Shop for Household",  labelHe: "קניות עבור משפחה", icon: ShoppingBag },
  { value: "billing",        label: "Billing",             labelHe: "חיוב",             icon: DollarSign },
  { value: "delivery",       label: "Delivery Dashboard",  labelHe: "לוח משלוחים",      icon: Truck },
  { value: "profile",        label: "Profile",             labelHe: "פרופיל",           icon: UserIcon },
  { value: "language",       label: null,                  labelHe: null,               icon: Globe },
  { value: "divider",        label: null,                  labelHe: null,               icon: null },
  { value: "pickers",        label: "Pickers",             labelHe: "ליקטנים",          icon: Users },
  { value: "products",       label: "Product Management",  labelHe: "ניהול מוצרים",     icon: Package },
  { value: "settings",       label: "Settings",            labelHe: "הגדרות",           icon: Settings },
  { value: "about",          label: "About Us",            labelHe: "אודותינו",         icon: UserIcon },
  { value: "terms",          label: "Terms of Service",    labelHe: "תנאי שירות",       icon: Settings },
];

export default function VendorMobileHeader({ vendorName, topOffset = 0 }) {
  const { language, toggleLanguage } = useLanguage();
  const isHebrew = language === "Hebrew";
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);

  const closeMenu = () => {
    setMenuClosing(true);
    setTimeout(() => { setMenuOpen(false); setMenuClosing(false); }, 300);
  };

  const handleHamburgerItem = (val) => {
    if (val === "divider") return;
    closeMenu();
    if (val === "language") { toggleLanguage(); return; }
    if (val === "profile") { navigate(createPageUrl("Profile")); return; }
    if (val === "delivery") { navigate(createPageUrl("DeliveryDashboard")); return; }
    if (val === "shopping") {
      // Navigate to VendorDashboard and trigger shopping mode
      navigate(createPageUrl("VendorDashboard") + "?action=shop");
      return;
    }
    if (val === "about") { navigate(createPageUrl("AboutUs")); return; }
    if (val === "terms") { navigate(createPageUrl("TermsOfService")); return; }
    if (val === "orders-cal") {
      navigate(createPageUrl("VendorDashboard") + "?tab=orders&view=calendar");
      return;
    }
    if (val === "orders") {
      navigate(createPageUrl("VendorDashboard") + "?tab=orders&view=list");
      return;
    }
    navigate(createPageUrl("VendorDashboard") + `?tab=${val}`);
  };

  const handleLogout = async () => {
    closeMenu();
    await User.logout();
    window.location.href = createPageUrl("Stores");
  };

  return (
    <>
      <header
        className="fixed left-0 right-0 z-40 flex items-center justify-between px-3 py-2 bg-white border-b shadow-sm h-[49px] md:hidden"
        style={{ top: `${topOffset}px` }}
      >
        {/* Left: logo + vendor name */}
        <button
          onClick={() => navigate(createPageUrl("VendorDashboard"))}
          className="flex items-center gap-1.5 min-w-0"
        >
          <img
            src="https://media.base44.com/images/public/68741e1ee947984fac63c8cf/c8712cabe_bluewithwhitebackground.png"
            alt="Zoozz"
            className="w-6 h-6 object-contain flex-shrink-0"
          />
          <span className="font-semibold text-gray-900 text-sm truncate max-w-[120px]">
            {vendorName}
          </span>
        </button>

        {/* Right: notifications + hamburger */}
        <div className="flex items-center gap-1">
          <NotificationCenter />

          {/* Hamburger */}
          <button
            onClick={() => { if (menuOpen) closeMenu(); else { setMenuOpen(true); } }}
            className="p-1.5 rounded-md text-gray-700 hover:bg-gray-100"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Hamburger drawer */}
      {menuOpen && (
        <div
          className="fixed inset-x-0 z-50 md:hidden"
          style={{ top: `${topOffset}px`, bottom: 0 }}
          onClick={closeMenu}
        >
          <div
            className="absolute inset-0 bg-black/40"
            style={{ animation: menuClosing ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.3s ease' }}
          />
          <div
            className="absolute top-0 right-0 w-64 bg-white h-full shadow-2xl flex flex-col"
            style={{ animation: menuClosing ? 'slideOutRight 0.3s ease forwards' : 'slideInRight 0.3s ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <span className="font-semibold text-gray-900">Menu</span>
              <button onClick={closeMenu}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {HAMBURGER_ITEMS.map(item => {
                if (item.value === "divider") {
                  return <div key="divider" className="border-t my-2" />;
                }
                const label = item.value === "language"
                  ? (isHebrew ? "English" : "עברית")
                  : (isHebrew ? item.labelHe : item.label);
                return (
                  <button
                    key={item.value}
                    onClick={() => handleHamburgerItem(item.value)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
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
        </div>
      )}
    </>
  );
}