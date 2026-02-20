import React, { useState, useEffect, useCallback } from "react";
import { User, Vendor, Order, Chat, Household, HouseholdStaff } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Store, Package, MessageCircle, AlertCircle, Home, Upload, Briefcase, DollarSign, Settings, Bell, Wrench, Tag, FileArchive, TestTube2,
  Mail, Loader2, List, Zap, TrendingUp, Phone, Calendar, Clock
} from "lucide-react";
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
import VendorHouseholdBilling from '../components/admin/VendorHouseholdBilling'; // Added new component import
import PayrollManagement from '../components/admin/PayrollManagement';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";
import MaintenanceModeToggle from '../components/admin/MaintenanceModeToggle';
import SeasonSettings from '../components/admin/SeasonSettings';
import { AppSettings } from "@/entities/AppSettings";

const correctGmailAddress = (email) => {
  if (email && email.endsWith('@google.com')) {
    // This is a specific fix for the observed issue where @google.com is used instead of @gmail.com for personal accounts.
    return email.replace('@google.com', '@gmail.com');
  }
  return email;
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
  const [activeTab, setActiveTab] = useState('orders');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [selectedShoppingListVendor, setSelectedShoppingListVendor] = useState('all');
  const [isTestingIntegrations, setIsTestingIntegrations] = useState(false);
  const [integrationTestResults, setIntegrationTestResults] = useState(null);
  const [activeSeason, setActiveSeason] = useState(''); // '' means all seasons
  const [showAllSeasons, setShowAllSeasons] = useState(false); // admin override
  const [allOrders, setAllOrders] = useState([]); // unfiltered orders

  const availableTabs = [
    { value: 'orders', labelKey: 'admin.dashboard.tabs.orders', roles: ['admin', 'chief of staff'] },
    { value: 'quick_order', labelKey: 'admin.dashboard.tabs.quickOrder', roles: ['admin', 'chief of staff'] },
    { value: 'shopping_list', labelKey: 'admin.dashboard.tabs.shoppingList', roles: ['admin', 'chief of staff'] },
    { value: 'users', labelKey: 'admin.dashboard.tabs.users', roles: ['admin'] },
    { value: 'staff', labelKey: 'admin.dashboard.tabs.staff', roles: ['admin', 'chief of staff'] },
    { value: 'vendors', labelKey: 'admin.dashboard.tabs.vendors', roles: ['admin'] },
    { value: 'households', labelKey: 'admin.dashboard.tabs.households', roles: ['admin', 'chief of staff'] },
    { value: 'billing', labelKey: 'admin.dashboard.tabs.billing', roles: ['admin', 'chief of staff'] },
    { value: 'vendor-household-billing', labelKey: 'admin.dashboard.tabs.vendorHouseholdBilling', roles: ['admin', 'chief of staff'] }, // Added new tab
    { value: 'payroll', labelKey: 'admin.dashboard.tabs.payroll', roles: ['admin', 'chief of staff'] },
    { value: 'kashrut', labelKey: 'admin.dashboard.tabs.kashrut', roles: ['admin'] },
    { value: 'chat', labelKey: 'admin.dashboard.tabs.chat', roles: ['admin', 'chief of staff'] },
    { value: 'notifications', labelKey: 'admin.dashboard.tabs.notifications', roles: ['admin'] },
    { value: 'sms', labelKey: 'admin.dashboard.tabs.sms', roles: ['admin'] },
    { value: 'whatsapp', labelKey: 'admin.dashboard.tabs.whatsapp', roles: ['admin'] },
    { value: 'settings', labelKey: 'admin.dashboard.tabs.settings', roles: ['admin'] },
    { value: 'delivery_settings', labelKey: 'admin.dashboard.tabs.deliverySettings', roles: ['admin','chief of staff'] },
    { value: 'tools', labelKey: 'admin.dashboard.tabs.tools', roles: ['admin'] }
  ];

  const tabsToDisplay = user ? availableTabs.filter(tab => tab.roles.includes(user.user_type?.trim().toLowerCase())) : [];

  const loadDashboardData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const userType = currentUser?.user_type?.toString()?.trim()?.toLowerCase();

      const hasAccess =
        userType === 'admin' ||
        userType === 'chief of staff';

      if (!hasAccess) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      const [usersData, vendorsData, ordersData, chatsData, householdsData, staffData, settingsList] = await Promise.all([
        User.list("-created_date", 1000),
        Vendor.list("-created_date", 1000),
        Order.list("-created_date", 10000),
        Chat.list("-last_message_at", 1000),
        Household.list("-created_date", 1000),
        HouseholdStaff.list("-created_date", 1000),
        AppSettings.list(),
      ]);

      const currentActiveSeason = settingsList?.[0]?.activeSeason || '';
      setActiveSeason(currentActiveSeason);
      setShowAllSeasons(false); // reset on reload

      setUsers(usersData);
      setVendors(vendorsData);
      setChats(chatsData);
      setHouseholdStaff(staffData);
      setHouseholds(householdsData);

      setAllOrders(ordersData);

      // Filter orders by season if activeSeason is set
      if (currentActiveSeason) {
        const seasonHouseholdIds = new Set(
          householdsData.filter(h => h.season === currentActiveSeason).map(h => h.id)
        );
        setOrders(ordersData.filter(o => !o.household_id || seasonHouseholdIds.has(o.household_id)));
      } else {
        setOrders(ordersData);
      }
    } catch (error) {
      console.error("Error loading admin dashboard:", error);
      setAccessDenied(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const refreshHouseholdStaff = async () => {
    try {
      const staffData = await HouseholdStaff.list("-created_date", 100);
      setHouseholdStaff(staffData);
    } catch (error) {
      console.error("Error refreshing household staff data:", error);
    }
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
      setOrders(prevOrders =>
        prevOrders.map(o => (o.id === updatedOrder.id ? updatedOrder : o))
      );
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
      case 'orders': return <Package className="w-4 h-4 mr-2" />;
      case 'quick_order': return <Zap className="w-4 h-4 mr-2" />;
      case 'shopping_list': return <List className="w-4 h-4 mr-2" />;
      case 'users': return <Users className="w-4 h-4 mr-2" />;
      case 'staff': return <Briefcase className="w-4 h-4 mr-2" />;
      case 'vendors': return <Store className="w-4 h-4 mr-2" />;
      case 'households': return <Home className="w-4 h-4 mr-2" />;
      case 'billing': return <DollarSign className="w-4 h-4 mr-2" />;
      case 'vendor-household-billing': return <TrendingUp className="w-4 h-4 mr-2" />; // New icon for Vendor-Household Billing
      case 'payroll': return <Clock className="w-4 h-4 mr-2" />;
      case 'kashrut': return <Tag className="w-4 h-4 mr-2" />;
      case 'chat': return <MessageCircle className="w-4 h-4 mr-2" />;
      case 'notifications': return <Bell className="w-4 h-4 mr-2" />;
      case 'sms': return <Phone className="w-4 h-4 mr-2" />; // Updated icon
      case 'whatsapp': return <Phone className="w-4 h-4 mr-2" />; // Updated icon
      case 'settings': return <Settings className="w-4 h-4 mr-2" />;
      case 'delivery_settings': return <Calendar className="w-4 h-4 mr-2" />; // Updated icon
      case 'tools': return <Wrench className="w-4 h-4 mr-2" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.dashboard.loading')}</p>
        </div>
      </div>
    );
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {user?.user_type === 'admin' ? t('admin.dashboard.title') : t('admin.dashboard.managementTitle')}
            </h1>
            <p className="text-gray-600">{t('admin.dashboard.description')}</p>
            <p className="text-sm text-gray-500">{t('admin.dashboard.welcome').replace('{{name}}', user?.full_name || '')}</p>
          </div>
          {user?.user_type === 'admin' && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={handleClearBarcodes}
                disabled={isClearingBarcodes}
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto"
              >
                {isClearingBarcodes ? t('admin.dashboard.clearing') : t('admin.dashboard.clearBarcodes')}
              </Button>
              <Link to={createPageUrl("BulkImageUploader")}>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Upload className="w-4 h-4 mr-2" />
                  {t('admin.dashboard.bulkImageUploader')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {user?.user_type === 'admin' && (
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
          )}

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

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                <div className="ml-2 sm:ml-4">
                  <p className="text-xs sm:text-sm text-gray-600">{t('admin.dashboard.activeChats')}</p>
                  <p className="text-xl sm:text-2xl font-bold">{chats.filter(c => c.status === 'active').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={user?.user_type === 'admin' ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-3"}>
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
        <div className="px-4 sm:px-6 lg:px-8 pb-8"> {/* Added wrapper div as per outline */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`flex flex-wrap h-auto justify-start gap-1 sm:gap-2 p-1 bg-white rounded-lg shadow-sm mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {tabsToDisplay.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm flex items-center">
                  {getTabIcon(tab.value)}
                  {t(tab.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="orders">
              {activeSeason && (
                <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-800">
                    {showAllSeasons
                      ? <><strong>All seasons shown</strong> — season filter is off</>
                      : <>Showing orders for season <strong>{activeSeason}</strong> only</>
                    }
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto text-blue-700 border-blue-300 hover:bg-blue-100 text-xs"
                    onClick={() => setShowAllSeasons(prev => !prev)}
                  >
                    {showAllSeasons ? `Show ${activeSeason} only` : 'Show all seasons'}
                  </Button>
                </div>
              )}
              <AdminOrderManagement
                orders={showAllSeasons ? allOrders : orders}
                onOrderUpdate={handleOrderUpdate}
                onChatOpen={handleOpenChat}
                user={user}
                onRefresh={loadDashboardData}
              />
            </TabsContent>
            
            <TabsContent value="quick_order">
              <QuickOrderForm
                userType={user?.user_type}
                onOrderCreated={loadDashboardData}
              />
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
                        onValueChange={setSelectedShoppingListVendor}
                      >
                        <SelectTrigger id="vendor-filter" className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t('admin.dashboard.allVendors', 'All Vendors')}
                          </SelectItem>
                          {vendors.map(vendor => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {language === 'Hebrew' && vendor.name_hebrew 
                                ? vendor.name_hebrew 
                                : vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Shopping List Component */}
                <ShoppingList 
                  orders={selectedShoppingListVendor === 'all' 
                    ? orders 
                    : orders.filter(order => order.vendor_id === selectedShoppingListVendor)
                  } 
                  vendor={selectedShoppingListVendor === 'all' 
                    ? null 
                    : vendors.find(v => v.id === selectedShoppingListVendor)
                  }
                  onUpdate={loadDashboardData}
                />
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
                onStaffUpdate={refreshHouseholdStaff}
              />
            </TabsContent>

            <TabsContent value="billing">
              <BillingManagement
                vendorId={null}
                userType={user?.user_type}
                onRefresh={loadDashboardData}
              />
            </TabsContent>

            <TabsContent value="vendor-household-billing"> {/* New TabsContent */}
              <VendorHouseholdBilling />
            </TabsContent>

            <TabsContent value="payroll">
              <PayrollManagement />
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
              <div className="space-y-6">
                {user?.user_type === 'admin' && <SeasonSettings />}
                {user?.user_type === 'admin' && <MaintenanceModeToggle />}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      {t('admin.dashboard.systemSettings')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FontManagement />
                    {user?.user_type === 'admin' && <LocalDevLogin />}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="delivery_settings">
              <AdminDeliveryScheduleManagement vendors={vendors} onVendorUpdate={loadDashboardData} />
            </TabsContent>

            <TabsContent value="tools">
              <div className="space-y-6">
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
                            className="w-64"
                          />
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleSendTestEmail}
                            disabled={isSendingTestEmail}
                          >
                            {isSendingTestEmail ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Mail className="w-4 h-4 mr-2" />
                            )}
                            {isSendingTestEmail ? 'Sending...' : 'Send Test Email'}
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={handleTestGoogleIntegrations}
                          disabled={isTestingIntegrations}
                        >
                          {isTestingIntegrations ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <TestTube2 className="w-4 h-4 mr-2" />
                          )}
                          {isTestingIntegrations ? 'Testing...' : 'Test Google Drive & Sheets'}
                        </Button>
                      </div>
                      
                      {integrationTestResults && (
                        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                          <h4 className="font-semibold text-gray-900">Integration Test Results:</h4>
                          
                          <div className={`p-3 rounded ${integrationTestResults.drive.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-start gap-2">
                              {integrationTestResults.drive.success ? (
                                <div className="text-green-600 font-semibold">✓ Google Drive:</div>
                              ) : (
                                <div className="text-red-600 font-semibold">✗ Google Drive:</div>
                              )}
                              <div className="flex-1">
                                <p className="text-sm">{integrationTestResults.drive.message}</p>
                                {integrationTestResults.drive.details && (
                                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-32">
                                    {typeof integrationTestResults.drive.details === 'object' 
                                      ? JSON.stringify(integrationTestResults.drive.details, null, 2)
                                      : integrationTestResults.drive.details}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className={`p-3 rounded ${integrationTestResults.sheets.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-start gap-2">
                              {integrationTestResults.sheets.success ? (
                                <div className="text-green-600 font-semibold">✓ Google Sheets:</div>
                              ) : (
                                <div className="text-red-600 font-semibold">✗ Google Sheets:</div>
                              )}
                              <div className="flex-1">
                                <p className="text-sm">{integrationTestResults.sheets.message}</p>
                                {integrationTestResults.sheets.details && (
                                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-32">
                                    {typeof integrationTestResults.sheets.details === 'object' 
                                      ? JSON.stringify(integrationTestResults.sheets.details, null, 2)
                                      : integrationTestResults.sheets.details}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-semibold text-yellow-800 mb-2">{t('admin.dashboard.dangerZone')}</h4>
                        <Button
                          onClick={handleClearBarcodes}
                          disabled={isClearingBarcodes}
                          variant="destructive"
                          size="sm"
                        >
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
    </div>
  );
}