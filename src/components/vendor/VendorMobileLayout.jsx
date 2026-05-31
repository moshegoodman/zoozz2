import React, { useState, useEffect } from "react";
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
  LayoutDashboard,
  Truck,
  LogOut } from
"lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import NotificationCenter from "../notifications/NotificationCenter";
import { User } from "@/entities/all";
import VendorSwitcher from "./VendorSwitcher";

const FOOTER_TABS = [
{ value: "overview", label: "Overview", labelHe: "סקירה", icon: LayoutDashboard },
{ value: "inventory", label: "Inventory", labelHe: "מלאי", icon: ShoppingBag },
{ value: "picking", label: "Picking", labelHe: "ליקוט", icon: Archive },
{ value: "pos", label: "POS", labelHe: "קופה", icon: Monitor },
{ value: "chats", label: "Chat", labelHe: "צ'אט", icon: MessageCircle }];


const HAMBURGER_ITEMS = [
{ value: "orders", label: "Orders (List)", labelHe: "הזמנות (רשימה)", icon: List },
{ value: "orders-cal", label: "Orders (Calendar)", labelHe: "הזמנות (לוח)", icon: CalendarDays },
{ value: "shopping-list", label: "Shopping List", labelHe: "רשימת קניות", icon: List },
{ value: "shopping", label: "Shop for Household", labelHe: "קניות עבור משפחה", icon: ShoppingBag },
{ value: "store", label: "Store", labelHe: "חנות", icon: Globe },
{ value: "billing", label: "Billing", labelHe: "חיוב", icon: DollarSign },
{ value: "delivery", label: "Delivery", labelHe: "משלוחים", icon: Truck },
{ value: "profile", label: "Profile", labelHe: "פרופיל", icon: UserIcon },
{ value: "language", label: null, labelHe: null, icon: Globe }, // dynamic label
{ value: "divider", label: null, labelHe: null, icon: null }, // divider
{ value: "pickers", label: "Pickers", labelHe: "ליקטנים", icon: Users },
{ value: "products", label: "Product Management", labelHe: "ניהול מוצרים", icon: Package },
{ value: "settings", label: "Settings", labelHe: "הגדרות", icon: Settings },
{ value: "about", label: "About Us", labelHe: "אודותינו", icon: UserIcon },
{ value: "terms", label: "Terms of Service", labelHe: "תנאי שירות", icon: Settings }];


const SETTINGS_ITEMS = [
{ value: "pickers", label: "Pickers", labelHe: "ליקטנים", icon: Users },
{ value: "products", label: "Product Management", labelHe: "ניהול מוצרים", icon: Package },
{ value: "settings", label: "Settings", labelHe: "הגדרות", icon: Settings },
{ value: "about", label: "About Us", labelHe: "אודותינו", icon: UserIcon },
{ value: "terms", label: "Terms of Service", labelHe: "תנאי שירות", icon: Settings }];


export default function VendorMobileLayout({
  activeTab,
  onTabChange,
  onShopForHousehold,
  vendorName,
  vendorId,
  unreadChats = 0,
  topOffset = 0,
  pickingMode = false,
  onExitPicking,
  activeChatTitle = null,
  onClearChatHeader,
  children
}) {
  const { t, language, toggleLanguage } = useLanguage();
  const isHebrew = language === "Hebrew";
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  // Fetch current user so we can show the vendor switcher when applicable
  useEffect(() => {
    User.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const handleFooterTab = (val) => {
    onTabChange(val);
  };

  const closeMenu = () => {
    setMenuClosing(true);
    setTimeout(() => {setMenuOpen(false);setMenuClosing(false);}, 300);
  };

  const handleHamburgerItem = (val) => {
    if (val === "divider") return;
    closeMenu();
    if (val === "language") {
      toggleLanguage();
      return;
    }
    if (val === "profile") {
      navigate(createPageUrl("Profile"));
      return;
    }
    if (val === "delivery") {
      navigate(createPageUrl("DeliveryDashboard"));
      return;
    }
    if (val === "store") {
      if (vendorId) {
        navigate(`/Vendor?id=${vendorId}`);
      } else {
        navigate(createPageUrl("Stores"));
      }
      return;
    }
    if (val === "about") {
      navigate(createPageUrl("AboutUs"));
      return;
    }
    if (val === "terms") {
      navigate(createPageUrl("TermsOfService"));
      return;
    }
    if (val === "shopping") {
      onShopForHousehold();
      return;
    }
    if (val === "orders-cal") {
      onTabChange("orders", "calendar");
      return;
    }
    if (val === "orders") {
      onTabChange("orders", "list");
      return;
    }
    onTabChange(val);
  };



  const handleLogout = async () => {
    closeMenu();
    await User.logout();
    window.location.href = createPageUrl("Stores");
  };

  return (
    <div className="flex flex-col min-h-0 bg-gray-50">
      {/* ── Top header ── */}
      <header className="fixed left-0 right-0 z-40 flex items-center justify-between py-2 border-b shadow-sm px-3 bg-[hsl(var(--background))]" style={{ top: `${topOffset}px` }}>
        {activeChatTitle ? (
        /* Chat header mode */
        <>
            <button
            onClick={() => {if (onClearChatHeader) onClearChatHeader();}}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 text-sm font-medium flex-shrink-0">
            
              ← Back
            </button>
            <p className="flex-1 min-w-0 text-center font-semibold text-sm truncate px-2">{activeChatTitle}</p>
            <div className="w-16" />
          </>) :

        <>
            {/* Left: logo + vendor name (with switcher if multi-vendor) */}
            <div className="flex items-center gap-1.5 min-w-0">
              <img
              src="https://media.base44.com/images/public/68741e1ee947984fac63c8cf/c8712cabe_bluewithwhitebackground.png"
              alt="Zoozz"
              className="w-6 h-6 object-contain flex-shrink-0" />
              {currentUser ?
            <VendorSwitcher user={currentUser} isHebrew={isHebrew} variant="mobile" /> :

            <span className="font-semibold text-gray-900 text-sm truncate max-w-[120px]">
                  {vendorName}
                </span>
            }
            </div>

            {/* Right: notifications + settings + hamburger (or Exit in picking mode) */}
            <div className="flex items-center gap-1">
              {pickingMode ?
            <button
              onClick={onExitPicking}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-50 text-red-600 text-sm font-medium border border-red-200">
                  <X className="w-4 h-4" /> Exit
                </button> :

            <>
                   <NotificationCenter />
                   <button
                onClick={() => {if (menuOpen) closeMenu();else {setMenuOpen(true);}}}
                className="p-1.5 rounded-md text-gray-700 hover:bg-gray-100">
                     {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                   </button>
                 </>
            }
            </div>
          </>
        }
      </header>

      {/* ── Hamburger drawer ── */}
      {menuOpen &&
      <div className="fixed inset-x-0 z-40" style={{ top: `${topOffset}px`, bottom: 0 }} onClick={closeMenu}>
          {/* Full-screen overlay */}
          <div
          className="absolute inset-0 bg-black/40"
          style={{ animation: menuClosing ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.3s ease' }} />
        
          {/* Drawer */}
          <div
          className="absolute top-0 right-0 w-64 bg-white h-full shadow-2xl flex flex-col"
          style={{ animation: menuClosing ? 'slideOutRight 0.3s ease forwards' : 'slideInRight 0.3s ease' }}
          onClick={(e) => e.stopPropagation()}>
          
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <span className="font-semibold text-gray-900">Menu</span>
              <button onClick={closeMenu}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {HAMBURGER_ITEMS.map((item) => {
              if (item.value === "divider") {
                return <div key="divider" className="border-t my-2" />;
              }
              const label = item.value === "language" ?
              isHebrew ? "English" : "עברית" :
              isHebrew ? item.labelHe : item.label;
              return (
                <button
                  key={item.value}
                  onClick={() => handleHamburgerItem(item.value)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">

                     <item.icon className="w-4 h-4 text-gray-500" />
                     {label}
                   </button>);

            })}
             </div>
            <div className="border-t p-3">
              <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-md">
              
                <LogOut className="w-4 h-4" />
                {isHebrew ? "התנתקות" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      }

      {/* ── Main content area ── */}
      <main className={`overflow-y-auto ${activeTab === "pos" || pickingMode ? "" : "mx-3"}`} style={{ paddingTop: `${topOffset + 49}px`, paddingBottom: pickingMode ? "env(safe-area-inset-bottom, 0px)" : "calc(56px + env(safe-area-inset-bottom, 0px))" }}>
        {children}
      </main>

      {/* ── Bottom tab bar — fixed to bottom of viewport ── */}
      {!pickingMode && <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        
        <div className="flex">
          {FOOTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.value !== "shopping" && activeTab === tab.value;
            const label = isHebrew ? tab.labelHe : tab.label;
            const showBadge = tab.value === "chats" && unreadChats > 0;
            return (
              <button
                key={tab.value}
                onClick={() => handleFooterTab(tab.value)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors relative ${isActive ? "text-gray-900" : "text-gray-400"}`}>
                
                {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gray-900" />}
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? "text-gray-900" : "text-gray-400"}`} strokeWidth={isActive ? 2.5 : 1.75} />
                  {showBadge &&
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                      {unreadChats > 9 ? "9+" : unreadChats}
                    </span>
                  }
                </div>
                <span className={`text-[10px] leading-none ${isActive ? "font-bold text-gray-900" : "font-normal text-gray-400"}`}>
                  {label}
                </span>
              </button>);

          })}
        </div>
      </nav>}
    </div>);

}