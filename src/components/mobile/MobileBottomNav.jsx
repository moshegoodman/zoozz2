import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Package, ShoppingCart, User, Shield, MessageCircle,
  Calendar, Store, Users, Briefcase,
} from 'lucide-react';
import { useCart } from '@/components/cart/CartContext';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/i18n/LanguageContext';

/**
 * MobileBottomNav – fixed bottom tab bar, visible on mobile only (hidden md+).
 * Each tab is a direct <Link>, giving independent browser-history entries per tab.
 */
export default function MobileBottomNav({ user, selectedHousehold }) {
  const location   = useLocation();
  const { getTotalItemCount } = useCart();
  const { t }      = useLanguage();

  if (!user) return null;

  const userType = user.user_type?.trim();

  // Vendor / picker dashboards have their own nav; skip global bottom nav
  if (userType === 'vendor' || userType === 'picker') return null;

  const getItems = () => {
    switch (userType) {
      case 'admin':
      case 'chief of staff':
        return [
          { label: t('navigation.dashboard'), icon: Shield,        path: 'AdminDashboard' },
          { label: t('navigation.home'),      icon: Home,          path: 'Home' },
          { label: 'Profile',                 icon: User,          path: 'Profile' },
        ];

      case 'kcs staff':
        if (!selectedHousehold) return [];
        return [
          { label: t('navigation.home'),   icon: Home,           path: 'Home' },
          { label: t('navigation.orders'), icon: Package,        path: 'Orders' },
          { label: t('navigation.chat'),   icon: MessageCircle,  path: 'Chat' },
          { label: 'My Portal',            icon: Briefcase,      path: 'StaffPortal' },
          { label: 'Profile',              icon: User,           path: 'Profile' },
        ];

      case 'household owner':
        return [
          { label: t('navigation.home'), icon: Home,     path: 'Home' },
          { label: 'Calendar',           icon: Calendar, path: 'MealCalendar' },
          { label: 'Profile',            icon: User,     path: 'Profile' },
        ];

      default:
        return [
          { label: t('navigation.home'),     icon: Home,          path: 'Home' },
          { label: t('navigation.products'), icon: Package,       path: 'Products' },
          { label: 'Cart',                   icon: ShoppingCart,  path: 'Cart', badge: true },
          { label: 'Profile',                icon: User,          path: 'Profile' },
        ];
    }
  };

  const items     = getItems();
  const cartCount = getTotalItemCount();

  if (items.length === 0) return null;

  const isActive = (path) => {
    const href = `/${path}`;
    return location.pathname === href || (path === 'Home' && location.pathname === '/');
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40 flex items-stretch"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft:   'env(safe-area-inset-left, 0px)',
        paddingRight:  'env(safe-area-inset-right, 0px)',
      }}
    >
      {items.map(item => {
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={createPageUrl(item.path)}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2',
              'min-h-[56px] relative transition-colors',
              active ? 'text-green-600' : 'text-muted-foreground',
            ].join(' ')}
          >
            <div className="relative">
              <item.icon className="w-[22px] h-[22px]" />
              {item.badge && cartCount > 0 && (
                <span className="absolute -top-2 -right-2.5 w-4 h-4 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-600 rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}