import React, { useState, useEffect } from "react";
import { ShoppingBag, Monitor, Archive, MessageCircle, LayoutDashboard, Package, ShoppingCart } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../i18n/LanguageContext";
import { useCart } from "../cart/CartContext";

const FOOTER_TABS = [
  { value: "overview",  label: "Overview",  labelHe: "סקירה", icon: LayoutDashboard },
  { value: "inventory", label: "Inventory", labelHe: "מלאי",  icon: Package },
  { value: "picking",   label: "Picking",   labelHe: "ליקוט", icon: Archive },
  { value: "pos",       label: "POS",       labelHe: "קופה",  icon: Monitor },
  { value: "chats",     label: "Chat",      labelHe: "צ'אט",  icon: MessageCircle },
];

export default function VendorBottomNav({ unreadChats = 0 }) {
  const { language } = useLanguage();
  const isHebrew = language === "Hebrew";
  const navigate = useNavigate();
  const { getTotalItemCount } = useCart();
  const [shoppingForHousehold, setShoppingForHousehold] = useState(() => {
    const d = sessionStorage.getItem('shoppingForHousehold');
    return d ? JSON.parse(d) : null;
  });

  useEffect(() => {
    const handler = () => {
      const d = sessionStorage.getItem('shoppingForHousehold');
      setShoppingForHousehold(d ? JSON.parse(d) : null);
    };
    window.addEventListener('shoppingModeChanged', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('shoppingModeChanged', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const currentPath = window.location.pathname;
  const isVendorDashboard = currentPath.includes("VendorDashboard") || currentPath === "/VendorDashboard";

  const handleTab = (val) => {
    if (isVendorDashboard) {
      window.dispatchEvent(new CustomEvent("vendorTabChange", { detail: { tab: val } }));
    } else {
      navigate(createPageUrl("VendorDashboard") + `?tab=${val}`);
    }
  };

  // Get cart count for the current shopping context
  const cartCount = shoppingForHousehold ? getTotalItemCount() : 0;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-[0_-2px_8px_rgba(0,0,0,0.08)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex">
        {FOOTER_TABS.map(tab => {
          const Icon = tab.icon;
          const label = isHebrew ? tab.labelHe : tab.label;
          const showBadge = tab.value === "chats" && unreadChats > 0;
          return (
            <button
              key={tab.value}
              onClick={() => handleTab(tab.value)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                    {unreadChats > 9 ? "9+" : unreadChats}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}

        {/* Cart button — only visible when shopping for a household */}
        {shoppingForHousehold && (
          <Link
            to={createPageUrl("Cart")}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-purple-600 hover:text-purple-800 transition-colors"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-purple-600 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{isHebrew ? "עגלה" : "Cart"}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}