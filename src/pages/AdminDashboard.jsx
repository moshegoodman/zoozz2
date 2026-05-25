import React, { useState, useEffect, useCallback, useRef } from "react";
import { User, Vendor, Order, Chat, Household, HouseholdStaff } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Store, Package, MessageCircle, AlertCircle, Home, Upload, Briefcase, DollarSign, Settings, Bell, Wrench, Tag, FileArchive, TestTube2,
  Mail, Loader2, List, Zap, TrendingUp, Phone, Calendar, Clock, ChevronDown, MapPin, Truck, Grid3x3 } from
"lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Use the new custom SendGrid function instead of the generic one.
import { sendGridEmail } from "@/functions/sendGridEmail";
import { testGoogleIntegrations } from "@/functions/testGoogleIntegrations";
import UserManagement from "../components/admin/UserManagement";
import VendorManagement from "../components/admin/VendorManagement";
import AdminChat from "../components/chat/AdminChat";
import HouseholdManagement from "../components/admin/HouseholdManagement";
import KashrutManagement from "../components/admin/KashrutManagement";
import FontManagement from '../components/admin/FontManagement';
import StaffManagement from "../components/admin/StaffManagement";
import AdminOrderManagement from "../components/admin/AdminOrderManagement";
import AdminNotifications from "../components/admin/AdminNotifications";
import BillingManagement from "../components/vendor/BillingManagement";
import TestSMS from "../components/admin/TestSMS";
import TestWhatsApp from "../components/admin/TestWhatsApp";
import LocalDevLogin from '../components/admin/LocalDevLogin';
import AdminDeliveryScheduleManagement from '../components/admin/AdminDeliveryScheduleManagement';
import ShoppingList from "../components/vendor/ShoppingList";
import QuickOrderForm from "../components/vendor/QuickOrderForm";
import PickingSystem from "../components/vendor/PickingSystem";
import POSTerminal from "../components/vendor/POSTerminal";
import VendorHouseholdBilling from '../components/admin/VendorHouseholdBilling'; // Added new component import
import PayrollManagement from '../components/admin/PayrollManagement';
import ClientInvoicing from '../components/admin/invoicing/ClientInvoicing';
import OrdersMatrix from '../components/admin/OrdersMatrix';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";
import MaintenanceModeToggle from '../components/admin/MaintenanceModeToggle';
import SeasonSettings from '../components/admin/SeasonSettings';
import RoleRatesSettings from '../components/admin/RoleRatesSettings';
import TestPushNotification from '../components/admin/TestPushNotification';
import PriorityAPISettings from '../components/admin/PriorityAPISettings';
import EmailLogViewer from '../components/admin/EmailLogViewer';
import PaidByOptionsSettings from '../components/admin/PaidByOptionsSettings';
import CollapsibleCard from '../components/admin/CollapsibleCard';
import { AppSettings } from "@/entities/AppSettings";
import { listUsers } from "@/functions/listUsers";
import useEntityCache from "@/hooks/useEntityCache";
import useListUsersCache from "@/hooks/useListUsersCache";

const correctGmailAddress = (email) => {
  if (email && email.endsWith('@google.com')) {
    return email.replace('@google.com', '@gmail.com');
  }
  return email;
};

// Normalize user_type to handle all variants of "chief of staff"
const normalizeUserType = (userType) => {
  if (!userType) return '';
  const cleaned = userType.toString().trim().toLowerCase().replace(/[_\s]+/g, ' ');
  // Map all "chief*staff" variants to canonical form
  if (cleaned.replace(/\s/g, '') === 'chiefofstaff' || cleaned === 'chief of staff' || cleaned === 'chief_of_staff') {
    return 'chief of staff';
  }
  return cleaned;
};

export default function AdminDashboard() {
  const { t, language } = useLanguage();
  const isRTL = language === 'Hebrew';
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [chats, setChats] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [householdStaff, setHouseholdStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isClearingBarcodes, setIsClearingBarcodes] = useState(false);
  const [activeTab, setActiveTab] = useState(activeTabFromStorage);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [selectedShoppingListVendor, setSelectedShoppingListVendor] = useState('all');
  const [isTestingIntegrations, setIsTestingIntegrations] = useState(false);
  const [integrationTestResults, setIntegrationTestResults] = useState(null);
  const [activeSeason, setActiveSeason] = useState(''); // '' means all seasons
  const [showAllSeasons, setShowAllSeasons] = useState(false); // admin override
  const [allOrders, setAllOrders] = useState([]); // unfiltered orders
  const [selectedPickingVendor, setSelectedPickingVendor] = useState('');
  const [selectedPOSVendor, setSelectedPOSVendor] = useState('');
  const [openGroup, setOpenGroup] = useState(null);
  const groupRefs = useRef({});

  // Load active tab from localStorage on mount, default to 'orders'
  const [activeTabFromStorage, setActiveTabFromStorage] = useState(() => {
    try {
      return localStorage.getItem('adminDashboard:activeTab') || 'orders';
    } catch { return 'orders'; }
  });

  // Admin entity caches: show cached data instantly from IndexedDB, sync with the server in the background.
  const { records: cachedOrders, refresh: refreshOrdersCache } = useEntityCache('orders', Order, { limit: 10000 });
  const { records: cachedVendors, refresh: refreshVendorsCache } = useEntityCache('vendors', Vendor, { limit: 1000 });
  const { records: cachedHouseholds, refresh: refreshHouseholdsCache } = useEntityCache('households', Household, { limit: 1000 });
  const { records: cachedHouseholdStaff, refresh: refreshHouseholdStaffCache } = useEntityCache('householdStaffs', HouseholdStaff, { limit: 1000 });
  const { records: cachedChats, refresh: refreshChatsCache } = useEntityCache('chats', Chat, { limit: 1000 });
  const { users: cachedUsers, refresh: refreshUsersCache } = useListUsersCache();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openGroup && groupRefs.current[openGroup] && !groupRefs.current[openGroup].contains(e.target)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openGroup]);

  // Persist active tab to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem('adminDashboard:activeTab', activeTab); } catch { /* ignore */ }
  }, [activeTab]);

  const TAB_GROUPS = [
  {
    label: 'Orders',
    icon: Package,
    tabs: ['orders', 'orders_matrix', 'quick_order', 'shopping_list', 'picking', 'pos']
  },
  {
    label: 'People',
    icon: Users,
    tabs: ['users', 'staff', 'households', 'staff_portal']
  },
  {
    label: 'Finance',
    icon: DollarSign,
    tabs: ['billing', 'vendor-household-billing', 'payroll', 'invoicing']
  },
  {
    label: 'Vendors',
    icon: Store,
    tabs: ['vendors', 'kashrut', 'delivery_settings']
  },
  {
    label: 'Comms',
    icon: MessageCircle,
    tabs: ['chat', 'notifications', 'sms', 'whatsapp']
  },
  {
    label: 'Settings',
    icon: Settings,
    tabs: ['settings', 'tools']
  }];


  const availableTabs = [
  { value: 'orders', labelKey: 'admin.dashboard.tabs.orders', roles: ['admin', 'chief of staff'] },
  { value: 'orders_matrix', labelKey: 'admin.dashboard.tabs.ordersMatrix', roles: ['admin', 'chief of staff'] },
  { value: 'quick_order', labelKey: 'admin.dashboard.tabs.quickOrder', roles: ['admin', 'chief of staff'] },
  { value: 'shopping_list', labelKey: 'admin.dashboard.tabs.shoppingList', roles: ['admin', 'chief of staff'] },
  { value: 'users', labelKey: 'admin.dashboard.tabs.users', roles: ['admin', 'chief of staff'] },
  { value: 'staff', labelKey: 'admin.dashboard.tabs.staff', roles: ['admin', 'chief of staff'] },
  { value: 'vendors', labelKey: 'admin.dashboard.tabs.vendors', roles: ['admin'] },
  { value: 'households', labelKey: 'admin.dashboard.tabs.households', roles: ['admin', 'chief of staff'] },
  { value: 'billing', labelKey: 'admin.dashboard.tabs.billing', roles: ['admin', 'chief of staff'] },
  { value: 'vendor-household-billing', labelKey: 'admin.dashboard.tabs.vendorHouseholdBilling', roles: ['admin', 'chief of staff'] }, // Added new tab
  { value: 'payroll', labelKey: 'admin.dashboard.tabs.payroll', roles: ['admin', 'chief of staff'] },
  { value: 'invoicing', labelKey: 'admin.dashboard.tabs.invoicing', roles: ['admin', 'chief of staff'] },
  { value: 'kashrut', labelKey: 'admin.dashboard.tabs.kashrut', roles: ['admin'] },
  { value: 'chat', labelKey: 'admin.dashboard.tabs.chat', roles: ['admin', 'chief of staff'] },
  { value: 'notifications', labelKey: 'admin.dashboard.tabs.notifications', roles: ['admin'] },
  { value: 'sms', labelKey: 'admin.dashboard.tabs.sms', roles: ['admin'] },
  { value: 'whatsapp', labelKey: 'admin.dashboard.tabs.whatsapp', roles: ['admin'] },
  { value: 'settings', labelKey: 'admin.dashboard.tabs.settings', roles: ['admin'] },
  { value: 'delivery_settings', labelKey: 'admin.dashboard.tabs.deliverySettings', roles: ['admin', 'chief of staff'] },
  { value: 'picking', labelKey: 'vendor.dashboard.tabs.picking', roles: ['admin', 'chief of staff'] },
  { value: 'pos', labelKey: 'vendor.dashboard.tabs.pos', roles: ['admin', 'chief of staff'] },
  { value: 'tools', labelKey: 'admin.dashboard.tabs.tools', roles: ['admin'] },
  { value: 'staff_portal', labelKey: 'admin.dashboard.tabs.staffPortal', roles: ['admin', 'chief of staff'] }];


  const tabsToDisplay = user ? availableTabs.filter((tab) => tab.roles.includes(normalizeUserType(user.user_type))) : [];

  const loadDashboardData = useCallback(async (attempt = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 700;
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const userType = normalizeUserType(currentUser?.user_type);

      const hasAccess =
      userType === 'admin' ||
      userType === 'chief of staff';

      if (!hasAccess) {
        // User data may not be fully loaded yet (user_type not yet propagated).
        // Retry a few times before giving up and showing access denied.
        if (attempt < MAX_RETRIES) {
          console.log(`AdminDashboard: missing permission, retrying (${attempt + 1}/${MAX_RETRIES})...`);
          setTimeout(() => loadDashboardData(attempt + 1), RETRY_DELAY_MS);
          return;
        }
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      // Only AppSettings is still fetched directly here — all entity data
      // comes from the entity-cache hooks (orders / vendors / households /
      // householdStaff / chats / users), wired via the useEffects below.
      const settingsList = await AppSettings.list();

      const currentActiveSeason = settingsList?.[0]?.activeSeason || '';
      setActiveSeason(currentActiveSeason);
      setShowAllSeasons(false); // reset on reload

      // Load last viewed tab from storage (if it was saved before)
      const savedTab = localStorage.getItem('adminDashboard:activeTab');
      if (savedTab) {
        setActiveTab(savedTab);
      }

      // Refresh ALL entity caches in the background so callers like QuickOrderForm /
      // PickingSystem / onRefresh trigger a re-sync of every relevant data set.
      refreshOrdersCache();
      refreshVendorsCache();
      refreshHouseholdsCache();
      refreshHouseholdStaffCache();
      refreshChatsCache();
      refreshUsersCache();
    } catch (error) {
      console.error("Error loading admin dashboard:", error);
      // Retry on transient errors before giving up.
      if (attempt < MAX_RETRIES) {
        console.log(`AdminDashboard: load failed, retrying (${attempt + 1}/${MAX_RETRIES})...`);
        setTimeout(() => loadDashboardData(attempt + 1), RETRY_DELAY_MS);
        return;
      }
      setAccessDenied(true);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
  }, [refreshOrdersCache, refreshVendorsCache, refreshHouseholdsCache, refreshHouseholdStaffCache, refreshChatsCache, refreshUsersCache]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Derive orders state from the IndexedDB-backed cache hook + the active season filter.
  // Re-sort by created_date desc to preserve the previous display ordering.
  useEffect(() => {
    if (!cachedOrders) return;
    const sorted = [...cachedOrders].sort((a, b) =>
      new Date(b.created_date || 0) - new Date(a.created_date || 0)
    );
    setAllOrders(sorted);

    if (activeSeason && households.length > 0) {
      const target = activeSeason.trim().toUpperCase();
      const seasonHouseholdIds = new Set(
        households.filter((h) =>
          (h.season || '').trim().toUpperCase() === target ||
          (h.household_code && h.household_code.slice(-3).toUpperCase() === target)
        ).map((h) => h.id)
      );
      setOrders(sorted.filter((o) => !o.household_id || seasonHouseholdIds.has(o.household_id)));
    } else {
      setOrders(sorted);
    }
  }, [cachedOrders, activeSeason, households]);

  // Sync entity caches → local state (preserves existing prop interfaces for child components).
  useEffect(() => { setUsers(cachedUsers || []); }, [cachedUsers]);
  useEffect(() => { setVendors(cachedVendors || []); }, [cachedVendors]);
  useEffect(() => { setHouseholds(cachedHouseholds || []); }, [cachedHouseholds]);
  useEffect(() => { setHouseholdStaff(cachedHouseholdStaff || []); }, [cachedHouseholdStaff]);
  useEffect(() => {
    if (!cachedChats) return;
    // Preserve newest-message-first ordering.
    const sorted = [...cachedChats].sort((a, b) =>
      new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
    );
    setChats(sorted);
  }, [cachedChats]);

  const refreshHouseholdStaff = () => {
    // Trigger a forced re-sync of the household-staff cache; the useEffect above updates state.
    refreshHouseholdStaffCache();
  };

  const handleClearBarcodes = async () => {
    if (!window.confirm(t('admin.dashboard.clearBarcodesConfirm'))) {
      return;
    }

    setIsClearingBarcodes(true);
    try {
      const { clearBarcodes } = await import("@/functions/clearBarcodes");
      const response = await clearBarcodes({});

      if (response.data.success) {
        alert(response.data.message);
      } else {
        alert(`Error: ${response.data.error}`);
      }
    } catch (error) {
      console.error("Error clearing barcodes:", error);
      alert("Failed to clear barcodes. Please try again.");
    } finally {
      setIsClearingBarcodes(false);
    }
  };

  const handleTestGoogleIntegrations = async () => {
    setIsTestingIntegrations(true);
    setIntegrationTestResults(null);
    try {
      const response = await testGoogleIntegrations({});

      if (response?.data?.success) {
        setIntegrationTestResults(response.data.results);
      } else {
        const errorMsg = response?.data?.error || response?.error || 'Unknown error';
        console.error('Integration test error:', response);
        alert(`Test failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error("Error testing Google integrations:", error);
      alert("Failed to test integrations. Check console for details.");
    } finally {
      setIsTestingIntegrations(false);
    }
  };

  const handleSendTestEmail = async () => {
    let emailToSend = testEmailAddress || user?.email;

    if (!emailToSend) {
      alert('Please enter an email address or make sure you are logged in.');
      return;
    }

    // Apply the correction before sending
    emailToSend = correctGmailAddress(emailToSend);

    setIsSendingTestEmail(true);
    try {
      console.log('Attempting to send test email to:', emailToSend);

      // Call the new sendGridEmail function
      const response = await sendGridEmail({
        to: emailToSend,
        subject: `Zoozz - Test Email`,
        body: `<h3>Test Email from Zoozz</h3><p>This is a test email sent at ${new Date().toLocaleString()}.</p><p>If you received this, your SendGrid integration is working!</p>`
      });

      console.log('SendGrid response:', response);

      if (response.data && response.data.success) {
        alert(`Test email sent successfully to ${emailToSend}! Please check your inbox (and spam folder).`);
        setTestEmailAddress(''); // Clear the input after successful send
      } else {
        throw new Error(response.data?.error || 'Unknown error from SendGrid function');
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      alert(`Failed to send test email to ${emailToSend}: ${error.message}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleOrderUpdate = (updatedOrder) => {
    if (updatedOrder && updatedOrder.id) {
      // Optimistic update for instant UI feedback.
      setOrders((prevOrders) =>
      prevOrders.map((o) => o.id === updatedOrder.id ? updatedOrder : o)
      );
      setAllOrders((prevOrders) =>
      prevOrders.map((o) => o.id === updatedOrder.id ? updatedOrder : o)
      );
      // Background re-sync of the order cache (picks up server-side updates too).
      refreshOrdersCache();
    } else {
      loadDashboardData();
    }
  };

  const handleOpenChat = (chatId) => {
    setActiveTab('chat');
    console.log(`Switched to chat tab, attempting to open chat ID: ${chatId}`);
  };

  const getTabIcon = (tabValue) => {
    switch (tabValue) {
      case 'orders':return <Package className="w-4 h-4 mr-2" />;
      case 'orders_matrix':return <Grid3x3 className="w-4 h-4 mr-2" />;
      case 'quick_order':return <Zap className="w-4 h-4 mr-2" />;
      case 'shopping_list':return <List className="w-4 h-4 mr-2" />;
      case 'users':return <Users className="w-4 h-4 mr-2" />;
      case 'staff':return <Briefcase className="w-4 h-4 mr-2" />;
      case 'vendors':return <Store className="w-4 h-4 mr-2" />;
      case 'households':return <Home className="w-4 h-4 mr-2" />;
      case 'billing':return <DollarSign className="w-4 h-4 mr-2" />;
      case 'vendor-household-billing':return <TrendingUp className="w-4 h-4 mr-2" />; // New icon for Vendor-Household Billing
      case 'payroll':return <Clock className="w-4 h-4 mr-2" />;
      case 'invoicing':return <FileArchive className="w-4 h-4 mr-2" />;
      case 'kashrut':return <Tag className="w-4 h-4 mr-2" />;
      case 'chat':return <MessageCircle className="w-4 h-4 mr-2" />;
      case 'notifications':return <Bell className="w-4 h-4 mr-2" />;
      case 'sms':return <Phone className="w-4 h-4 mr-2" />; // Updated icon
      case 'whatsapp':return <Phone className="w-4 h-4 mr-2" />; // Updated icon
      case 'settings':return <Settings className="w-4 h-4 mr-2" />;
      case 'delivery_settings':return <Calendar className="w-4 h-4 mr-2" />; // Updated icon
      case 'picking':return <Package className="w-4 h-4 mr-2" />;
      case 'pos':return <Store className="w-4 h-4 mr-2" />;
      case 'tools':return <Wrench className="w-4 h-4 mr-2" />;
      case 'staff_portal':return <Briefcase className="w-4 h-4 mr-2" />;
      default:return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.dashboard.loading')}</p>
        </div>
      </div>);

  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('admin.accessDenied.title')}</h2>
            <p className="text-gray-600 mb-6">
              {t('admin.accessDenied.description')}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {t('admin.accessDenied.permissionInfo')}
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>{t('admin.accessDenied.yourUserType')}: <strong>{user?.user_type || t('admin.accessDenied.unknown')}</strong></p>
              <p>{t('admin.accessDenied.yourEmail')}: <strong>{user?.email || t('admin.accessDenied.unknown')}</strong></p>
              <p>{t('admin.accessDenied.requiredUserType')}: <strong>{t('admin.accessDenied.adminOrChief')}</strong></p>
            </div>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mt-1 mb-3 ml-0 px-4 py-6 opacity-100 max-w-9xl sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {user?.user_type === 'admin' ? t('admin.dashboard.title') : t('admin.dashboard.managementTitle')}
            </h1>
            <p className="text-gray-600">{t('admin.dashboard.description')}</p>
            <p className="text-sm text-gray-500">{t('admin.dashboard.welcome').replace('{{name}}', user?.full_name || '')}</p>
          </div>

        </div>

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {user?.user_type === 'admin' &&
          <>
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center">
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                    <div className="ml-2 sm:ml-4">
                      <p className="text-xs sm:text-sm text-gray-600">{t('admin.dashboard.totalUsers')}</p>
                      <p className="text-xl sm:text-2xl font-bold">{users.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center">
                    <Store className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                    <div className="ml-2 sm:ml-4">
                      <p className="text-xs sm:text-sm text-gray-600">{t('admin.dashboard.totalVendors')}</p>
                      <p className="text-xl sm:text-2xl font-bold">{vendors.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          }

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">{t('admin.dashboard.totalOrders')}</p>
                  <p className="text-xl sm:text-2xl font-bold">{orders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={user?.user_type === 'admin' ? "col-span-1" : "col-span-2 sm:col-span-3"}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Home className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">{t('admin.dashboard.households')}</p>
                  <p className="text-xl sm:text-2xl font-bold">{households.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Grouped dropdown navigation */}
            <div className={`flex flex-wrap gap-2 bg-white rounded-lg shadow-sm p-2 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {TAB_GROUPS.map((group) => {
                const allowedTabValues = tabsToDisplay.map((t) => t.value);
                const groupTabs = group.tabs.
                filter((tv) => allowedTabValues.includes(tv)).
                map((tv) => tabsToDisplay.find((t) => t.value === tv)).
                filter(Boolean);
                if (groupTabs.length === 0) return null;
                const isActive = groupTabs.some((t) => t.value === activeTab);
                const isOpen = openGroup === group.label;
                return (
                  <div key={group.label} className="relative" ref={(el) => groupRefs.current[group.label] = el}>
                    <button
                      onClick={() => setOpenGroup(isOpen ? null : group.label)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive ?
                      'bg-green-600 text-white' :
                      'text-gray-700 hover:bg-gray-100'}`
                      }>
                      
                      <group.icon className="w-4 h-4" />
                      {group.label}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen &&
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] py-1">
                        {groupTabs.map((tab) =>
                      <button
                        key={tab.value}
                        onClick={() => {setActiveTab(tab.value);setOpenGroup(null);}}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                        activeTab === tab.value ? 'text-green-600 font-semibold bg-green-50' : 'text-gray-700'}`
                        }>
                        
                            {getTabIcon(tab.value)}
                            {t(tab.labelKey)}
                          </button>
                      )}
                      </div>
                    }
                  </div>);

              })}
            </div>

            <TabsContent value="orders">
              {activeSeason &&
              <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-800">
                    {showAllSeasons ?
                  <><strong>All seasons shown</strong> — season filter is off</> :
                  <>Showing orders for season <strong>{activeSeason}</strong> only</>
                  }
                  </span>
                  <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto text-blue-700 border-blue-300 hover:bg-blue-100 text-xs"
                  onClick={() => setShowAllSeasons((prev) => !prev)}>
                  
                    {showAllSeasons ? `Show ${activeSeason} only` : 'Show all seasons'}
                  </Button>
                </div>
              }
              <AdminOrderManagement
                orders={showAllSeasons ? allOrders : orders}
                vendors={vendors}
                onOrderUpdate={handleOrderUpdate}
                onChatOpen={handleOpenChat}
                user={user}
                onRefresh={loadDashboardData} />
              
            </TabsContent>
            
            <TabsContent value="orders_matrix">
              <OrdersMatrix
                orders={showAllSeasons ? allOrders : orders}
                vendors={vendors}
                households={households}
                activeSeason={showAllSeasons ? '' : activeSeason} />
            </TabsContent>

            <TabsContent value="quick_order">
              <QuickOrderForm
                userType={user?.user_type}
                onOrderCreated={loadDashboardData} />
              
            </TabsContent>

            <TabsContent value="shopping_list">
              <div className="space-y-4">
                {/* Vendor Filter Dropdown */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Label htmlFor="vendor-filter" className="whitespace-nowrap">
                        {t('admin.dashboard.filterByVendor', 'Filter by Vendor')}:
                      </Label>
                      <Select
                        value={selectedShoppingListVendor}
                        onValueChange={setSelectedShoppingListVendor}>
                        
                        <SelectTrigger id="vendor-filter" className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t('admin.dashboard.allVendors', 'All Vendors')}
                          </SelectItem>
                          {vendors.map((vendor) =>
                          <SelectItem key={vendor.id} value={vendor.id}>
                              {language === 'Hebrew' && vendor.name_hebrew ?
                            vendor.name_hebrew :
                            vendor.name}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Shopping List Component */}
                <ShoppingList
                  orders={selectedShoppingListVendor === 'all' ?
                  orders :
                  orders.filter((order) => order.vendor_id === selectedShoppingListVendor)
                  }
                  vendor={selectedShoppingListVendor === 'all' ?
                  null :
                  vendors.find((v) => v.id === selectedShoppingListVendor)
                  }
                  onUpdate={loadDashboardData} />
                
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UserManagement users={users} vendors={vendors} onUserUpdate={loadDashboardData} />
            </TabsContent>

            <TabsContent value="staff">
              <StaffManagement householdStaff={householdStaff} onStaffUpdate={refreshHouseholdStaff} users={users} households={households} />
            </TabsContent>

            <TabsContent value="vendors">
              <VendorManagement vendors={vendors} users={users} onVendorUpdate={loadDashboardData} user={user} />
            </TabsContent>

            <TabsContent value="households">
              <HouseholdManagement
                households={households}
                householdStaff={householdStaff}
                users={users}
                onDataUpdate={loadDashboardData}
                onStaffUpdate={refreshHouseholdStaff} />
              
            </TabsContent>

            <TabsContent value="billing">
              <BillingManagement
                vendorId={null}
                userType={user?.user_type}
                onRefresh={loadDashboardData} />
              
            </TabsContent>

            <TabsContent value="vendor-household-billing"> {/* New TabsContent */}
              <VendorHouseholdBilling />
            </TabsContent>

            <TabsContent value="payroll">
              <PayrollManagement />
            </TabsContent>

            <TabsContent value="invoicing">
              <ClientInvoicing
                households={households}
                orders={allOrders}
                users={users}
                vendors={vendors} />
              
            </TabsContent>

            <TabsContent value="kashrut">
              <KashrutManagement />
            </TabsContent>

            <TabsContent value="chat">
              <AdminChat chats={chats} onChatUpdate={loadDashboardData} />
            </TabsContent>

            <TabsContent value="notifications">
              <AdminNotifications />
            </TabsContent>

            <TabsContent value="sms">
              <TestSMS />
            </TabsContent>

            <TabsContent value="whatsapp">
              <TestWhatsApp />
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-4">
                {user?.user_type === 'admin' && (
                  <CollapsibleCard title="Test Push Notification" icon={Bell}>
                    <TestPushNotification />
                  </CollapsibleCard>
                )}
                {user?.user_type === 'admin' && (
                  <CollapsibleCard title="Season Settings" icon={Calendar}>
                    <SeasonSettings />
                  </CollapsibleCard>
                )}
                {user?.user_type === 'admin' && (
                  <CollapsibleCard title="Maintenance Mode" icon={Wrench}>
                    <MaintenanceModeToggle />
                  </CollapsibleCard>
                )}
                {user?.user_type === 'admin' && (
                  <CollapsibleCard title="Role Rates" icon={DollarSign}>
                    <RoleRatesSettings />
                  </CollapsibleCard>
                )}
                {user?.user_type === 'admin' && (
                  <CollapsibleCard title="Priority API" icon={Zap}>
                    <PriorityAPISettings />
                  </CollapsibleCard>
                )}
                {user?.user_type === 'admin' && (
                  <CollapsibleCard title="Payroll AP — Paid By Options" icon={DollarSign}>
                    <PaidByOptionsSettings />
                  </CollapsibleCard>
                )}
                <CollapsibleCard title={t('admin.dashboard.systemSettings')} icon={Settings}>
                  <FontManagement />
                  {user?.user_type === 'admin' && <LocalDevLogin />}
                </CollapsibleCard>
              </div>
            </TabsContent>

            <TabsContent value="delivery_settings">
              <AdminDeliveryScheduleManagement vendors={vendors} onVendorUpdate={loadDashboardData} />
            </TabsContent>

            <TabsContent value="picking">
              <PickingSystem
                orders={orders}
                vendorId={null}
                user={user}
                onRefresh={loadDashboardData} />
              
            </TabsContent>

            <TabsContent value="pos">
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Label className="whitespace-nowrap">Select Vendor:</Label>
                      <Select value={selectedPOSVendor} onValueChange={setSelectedPOSVendor}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select a vendor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((v) =>
                          <SelectItem key={v.id} value={v.id}>
                              {language === 'Hebrew' && v.name_hebrew ? v.name_hebrew : v.name}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                {selectedPOSVendor &&
                <POSTerminal
                  vendorId={selectedPOSVendor}
                  vendor={vendors.find((v) => v.id === selectedPOSVendor)}
                  user={user} />

                }
              </div>
            </TabsContent>

            <TabsContent value="staff_portal">
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Briefcase className="w-12 h-12 text-purple-500" />
                <h2 className="text-xl font-semibold text-gray-800">Staff Portal</h2>
                <p className="text-gray-500 text-sm">View and manage staff shifts, expenses, and payments.</p>
                <Link to={createPageUrl("StaffPortal")}>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    Open Staff Portal
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="tools">
              <div className="space-y-6">
                <EmailLogViewer />
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="w-5 h-5" />
                      {t('admin.dashboard.systemTools')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                        <Link to={createPageUrl("ImageMatcher")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <Upload className="w-4 h-4 mr-2" />
                            {t('admin.dashboard.imageMatcherTool')}
                          </Button>
                        </Link>
                        <Link to={createPageUrl("BulkImageUploader")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <Upload className="w-4 h-4 mr-2" />
                            {t('admin.dashboard.bulkImageUploader')}
                          </Button>
                        </Link>
                        <Link to={createPageUrl("ProcessImageZip")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <FileArchive className="w-4 h-4 mr-2" />
                            Scalable Image Processor
                          </Button>
                        </Link>
                        <Link to={createPageUrl("GeofenceManager")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <MapPin className="w-4 h-4 mr-2" />
                            Geofence Manager
                          </Button>
                        </Link>
                        <Link to={createPageUrl("DeliveryDashboard")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <Truck className="w-4 h-4 mr-2" />
                            Delivery Dashboard
                          </Button>
                        </Link>
                        <Link to={createPageUrl("MenuEngine")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <Package className="w-4 h-4 mr-2" />
                            Menu Engine
                          </Button>
                        </Link>
                        <Link to={createPageUrl("Debug")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <Wrench className="w-4 h-4 mr-2" />
                            {t('admin.dashboard.debugTools')}
                          </Button>
                        </Link>
                        <Link to={createPageUrl("PdfTest")}>
                          <Button variant="outline" className="w-full sm:w-auto">
                            <TestTube2 className="w-4 h-4 mr-2" />
                            HTML-to-PDF Tester
                          </Button>
                        </Link>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter email address (optional)"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                            className="w-64" />
                          
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleSendTestEmail}
                            disabled={isSendingTestEmail}>
                            
                            {isSendingTestEmail ?
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :

                            <Mail className="w-4 h-4 mr-2" />
                            }
                            {isSendingTestEmail ? 'Sending...' : 'Send Test Email'}
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={handleTestGoogleIntegrations}
                          disabled={isTestingIntegrations}>
                          
                          {isTestingIntegrations ?
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :

                          <TestTube2 className="w-4 h-4 mr-2" />
                          }
                          {isTestingIntegrations ? 'Testing...' : 'Test Google Drive & Sheets'}
                        </Button>
                      </div>
                      
                      {integrationTestResults &&
                      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                          <h4 className="font-semibold text-gray-900">Integration Test Results:</h4>
                          
                          <div className={`p-3 rounded ${integrationTestResults.drive.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-start gap-2">
                              {integrationTestResults.drive.success ?
                            <div className="text-green-600 font-semibold">✓ Google Drive:</div> :

                            <div className="text-red-600 font-semibold">✗ Google Drive:</div>
                            }
                              <div className="flex-1">
                                <p className="text-sm">{integrationTestResults.drive.message}</p>
                                {integrationTestResults.drive.details &&
                              <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-32">
                                    {typeof integrationTestResults.drive.details === 'object' ?
                                JSON.stringify(integrationTestResults.drive.details, null, 2) :
                                integrationTestResults.drive.details}
                                  </pre>
                              }
                              </div>
                            </div>
                          </div>

                          <div className={`p-3 rounded ${integrationTestResults.sheets.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-start gap-2">
                              {integrationTestResults.sheets.success ?
                            <div className="text-green-600 font-semibold">✓ Google Sheets:</div> :

                            <div className="text-red-600 font-semibold">✗ Google Sheets:</div>
                            }
                              <div className="flex-1">
                                <p className="text-sm">{integrationTestResults.sheets.message}</p>
                                {integrationTestResults.sheets.details &&
                              <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-32">
                                    {typeof integrationTestResults.sheets.details === 'object' ?
                                JSON.stringify(integrationTestResults.sheets.details, null, 2) :
                                integrationTestResults.sheets.details}
                                  </pre>
                              }
                              </div>
                            </div>
                          </div>
                        </div>
                      }
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-semibold text-yellow-800 mb-2">{t('admin.dashboard.dangerZone')}</h4>
                        <Button
                          onClick={handleClearBarcodes}
                          disabled={isClearingBarcodes}
                          variant="destructive"
                          size="sm">
                          
                          {isClearingBarcodes ? t('admin.dashboard.clearing') : t('admin.dashboard.clearBarcodes')}
                        </Button>
                        <p className="text-sm text-yellow-700 mt-2">
                          {t('admin.dashboard.clearBarcodesWarning')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>);

}