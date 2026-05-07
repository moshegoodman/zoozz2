import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Monitor,
  Archive,
  MessageCircle,
  Menu,
  X,
  Globe,
  User as UserIcon,
  DollarSign,
  List,
  CalendarDays,
  Settings,
  Users,
  ShoppingBag,
  LogOut,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import NotificationCenter from "../notifications/NotificationCenter";
import { User } from "@/entities/all";

const FOOTER_TABS = [
  { value: "picking",   label: "Picking",    labelHe: "ליקוט",       icon: Package },
  { value: "pos",       label: "POS",        labelHe: "קופה",        icon: Monitor },
  { value: "shopping",  label: "Shopping",   labelHe: "קניות",       icon: ShoppingBag },
  { value: "inventory", label: "Inventory",  labelHe: "מלאי",        icon: Archive },
  { value: "chats",     label: "Chat",       labelHe: "צ'אט",        icon: MessageCircle },
];

const HAMBURGER_ITEMS = [
  { value: "orders",        label: "Orders (List)",    labelHe: "הזמנות (רשימה)",  icon: List },
  { value: "orders-cal",    label: "Orders (Calendar)",labelHe: "הזמנות (לוח)",   icon: CalendarDays },
  { value: "shopping-list", label: "Shopping List",    labelHe: "רשימת קניות",    icon: List },
  { value: "billing",       label: "Billing",          labelHe: "חיוב",            icon: DollarSign },
  { value: "profile",       label: "Profile",          labelHe: "פרופיל",          icon: UserIcon },
  { value: "language",      label: null,               labelHe: null,              icon: Globe }, // dynamic label
];

const SETTINGS_ITEMS = [
  { value: "pickers",   label: "Pickers",             labelHe: "ליקטנים",         icon: Users },
  { value: "products",  label: "Product Management",  labelHe: "ניהול מוצרים",   icon: Package },
  { value: "settings",  label: "Settings",            labelHe: "הגדרות",          icon: Settings },
];

export default function VendorMobileLayout({
  activeTab,
  onTabChange,
  onShopForHousehold,
  vendorName,
  unreadChats = 0,
  children,
}) {
  const { t, language, toggleLanguage } = useLanguage();
  const isHebrew = language === "Hebrew";
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();

  const handleFooterTab = (val) => {
    if (val === "shopping") {
      onShopForHousehold();
      return;
    }
    onTabChange(val);
  };

  const handleHamburgerItem = (val) => {
    setMenuOpen(false);
    if (val === "language") {
      toggleLanguage();
      return;
    }
    if (val === "profile") {
      navigate(createPageUrl("Profile"));
      return;
    }
    if (val === "orders-cal") {
      onTabChange("orders", "calendar");
      return;
    }
    onTabChange(val);
  };

  const handleSettingsItem = (val) => {
    setSettingsOpen(false);
    onTabChange(val);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await User.logout();
    window.location.href = createPageUrl("Stores");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* ── Top header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-white border-b shadow-sm">
        {/* Left: Settings (gear-like) dropdown */}
        <div className="relative">
          <button
            onClick={() => { setSettingsOpen(v => !v); setMenuOpen(false); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 text-sm font-medium"
          >
            <Settings className="w-5 h-5" />
          </button>
          {settingsOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[190px] py-1">
              {SETTINGS_ITEMS.map(item => (
                <button
                  key={item.value}
                  onClick={() => handleSettingsItem(item.value)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                >
                  <item.icon className="w-4 h-4 text-gray-500" />
                  {isHebrew ? item.labelHe : item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: vendor name */}
        <span className="font-semibold text-gray-900 text-sm truncate max-w-[140px]">
          {vendorName}
        </span>

        {/* Right: notifications + hamburger */}
        <div className="flex items-center gap-1">
          <NotificationCenter />
          <button
            onClick={() => { setMenuOpen(v => !v); setSettingsOpen(false); }}
            className="p-1.5 rounded-md text-gray-700 hover:bg-gray-100"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── Hamburger drawer ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setMenuOpen(false)}>
          {/* Overlay */}
          <div className="flex-1 bg-black/30" />
          {/* Drawer */}
          <div
            className="w-64 bg-white h-full shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <span className="font-semibold text-gray-900">Menu</span>
              <button onClick={() => setMenuOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {HAMBURGER_ITEMS.map(item => {
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

      {/* ── Main content area ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* ── Bottom tab bar ── */}
      <nav className="flex-shrink-0 bg-white border-t shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex">
          {FOOTER_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.value !== "shopping" && activeTab === tab.value;
            const label = isHebrew ? tab.labelHe : tab.label;
            const showBadge = tab.value === "chats" && unreadChats > 0;
            return (
              <button
                key={tab.value}
                onClick={() => handleFooterTab(tab.value)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors
                  ${isActive ? "text-green-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? "text-green-600" : ""}`} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                      {unreadChats > 9 ? "9+" : unreadChats}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium leading-none ${isActive ? "text-green-600" : ""}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}