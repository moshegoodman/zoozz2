import React, { useState, useEffect, useCallback } from "react";
import { Order, User, Product, Chat, Vendor, DataLoadFailure, Household, AppSettings } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package, MessageCircle, AlertCircle, Briefcase, Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";

import OrderManagement from "../components/vendor/OrderManagement";
import ProductManagement from "../components/vendor/ProductManagement";
import InventoryManagement from "../components/vendor/InventoryManagement";
import VendorChat from "../components/chat/VendorChat";
import ShoppingList from "../components/vendor/ShoppingList";
import DeliverySchedule from "../components/vendor/DeliverySchedule";
import SubcategoryManagement from "../components/vendor/SubcategoryManagement";
import HouseholdSelectorModal from "../components/vendor/HouseholdSelectorModal";
import BillingManagement from "../components/vendor/BillingManagement";
import CustomerDayCalendar from "../components/vendor/CustomerDayCalendar";
import OrderDetailsModal from "../components/vendor/OrderDetailsModal";
import QuickOrderForm from "../components/vendor/QuickOrderForm";

// This is a mock/placeholder function for exporting vendor orders.
// In a real application, this would typically be an API call to your backend.
// You should replace this with your actual API integration.
const exportVendorOrders = async ({ vendorId, startDate, endDate }) => {
  console.log(`Mock: Exporting orders for vendor ${vendorId} from ${startDate} to ${endDate}`);
  // Simulate an API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Return some dummy CSV data. Include Hebrew characters to test encoding.
  return {
    data: "Order ID,Customer Name,Total,Status\n" +
          "1,John Doe,100.00,Completed\n" +
          "2,Jane Smith,75.50,Pending\n" +
          "3,בנג'מין פרנקלין,120.30,Completed\n" +
          "4,אברהם לינקולן,50.00,Pending"
  };
};

const availableTabs = [
  { value: 'orders', labelKey: 'vendor.dashboard.tabs.orders', roles: ['vendor', 'picker', 'admin', 'chief of staff'] },
  { value: 'quick_order', labelKey: 'vendor.dashboard.tabs.quickOrder', roles: ['vendor', 'admin', 'chief of staff'] },
  { value: 'calendar', labelKey: 'vendor.dashboard.tabs.calendar', roles: ['vendor', 'admin', 'chief of staff'] },
  { value: 'products', labelKey: 'vendor.dashboard.tabs.products', roles: ['vendor', 'admin', 'chief of staff'] },
  { value: 'inventory', labelKey: 'vendor.dashboard.tabs.inventory', roles: ['vendor', 'admin', 'chief of staff'] },
  { value: 'shopping-list', labelKey: 'vendor.dashboard.tabs.shoppingList', roles: ['vendor', 'admin', 'chief of staff','picker'] },
  { value: 'chats', labelKey: 'vendor.dashboard.tabs.chats', roles: ['vendor', 'picker', 'admin', 'chief of staff'] },
  { value: 'billing', labelKey: 'vendor.dashboard.tabs.billing', roles: ['vendor', 'admin', 'chief of staff'] },
  { value: 'pickers', labelKey: 'vendor.dashboard.tabs.pickers', roles: ['vendor', 'admin', 'chief of staff'] },
  { value: 'settings', labelKey: 'vendor.dashboard.tabs.settings', roles: ['vendor', 'admin', 'chief of staff'] },
];

const setupTabs = ['products', 'settings'];

export default function VendorDashboard() {
  const { t, language } = useLanguage();
  const isRTL = language === 'Hebrew';
  const [user, setUser] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [chats, setChats] = useState([]);
  const [pickers, setPickers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHouseholdSelector, setShowHouseholdSelector] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [orderToChat, setOrderToChat] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [targetVendorId, setTargetVendorId] = useState(null);
  const [setupMode, setSetupMode] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [calendarModalOrder, setCalendarModalOrder] = useState(null);
  const navigate = useNavigate();

  const [isExporting, setIsExporting] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(null);
  const [exportEndDate, setExportEndDate] = useState(null);

  const userTabs = user ? availableTabs
    .filter(tab => tab.roles.includes(user.user_type))
    .filter(tab => !setupMode || setupTabs.includes(tab.value))
    : [];

  const handleVendorUpdate = (updatedData) => {
    setVendor(prevVendor => ({ ...prevVendor, ...updatedData }));
  };

  const handleOrderUpdate = (updatedOrder) => {
    setOrders(currentOrders =>
      currentOrders.map(o => (o.id === updatedOrder.id ? updatedOrder : o))
    );
  };

  const refreshOrders = useCallback(async () => {
    if (!targetVendorId) return;
    try {
      const ordersData = await Order.filter({ vendor_id: targetVendorId }, "-created_date");
      setOrders(ordersData);
    } catch (error) {
      console.error("Error refreshing orders:", error);
    }
  }, [targetVendorId]);

  const refreshChats = useCallback(async () => {
    if (!targetVendorId) return;
    try {
      const chatsData = await Chat.filter({ vendor_id: targetVendorId }, "-last_message_at", 1000);
      setChats(chatsData);
    } catch (error) {
      console.error("Failed to refresh chats:", error);
    }
  }, [targetVendorId]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setAccessDenied(false);
    setDataError(null);

    try {
      const currentUser = await User.me();
      setUser(currentUser);

      if (['vendor', 'picker'].includes(currentUser.user_type) && (!currentUser.vendor_id || !currentUser.vendor_id.match(/^[a-f0-9]{24}$/i))) {
        const errorMessage = t('vendor.accessDenied.invalidVendorIdOnProfile', { vendorId: `"${currentUser.vendor_id}"` });
        setDataError(errorMessage);
        await DataLoadFailure.create({
          page_name: "VendorDashboard",
          user_email: currentUser.email,
          failure_type: "error",
          data_source: "User.vendor_id",
          error_message: `User's associated vendor_id is invalid: "${currentUser.vendor_id}"`,
          user_type: currentUser.user_type,
          additional_context: {
            user_vendor_id: currentUser.vendor_id,
          },
          browser_info: navigator.userAgent
        }).catch(e => console.warn("Failed to log data load failure:", e));
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const urlVendorId = urlParams.get('vendorId');
      const urlSetupMode = urlParams.get('setupMode') === 'true';

      console.log('🔍 VendorDashboard Debug:', {
        userType: currentUser.user_type,
        userVendorId: currentUser.vendor_id,
        urlVendorId: urlVendorId,
        setupMode: urlSetupMode
      });

      setSetupMode(urlSetupMode);
      setActiveTab(urlSetupMode ? 'products' : 'orders');

      let effectiveVendorId = null;
      let hasPermission = false;

      if (['admin', 'chief of staff'].includes(currentUser.user_type)) {
        effectiveVendorId = urlVendorId;
        if (effectiveVendorId) {
          hasPermission = true;
        } else {
            navigate(createPageUrl("AdminDashboard"));
            return;
        }
      } else if (['vendor', 'picker'].includes(currentUser.user_type)) {
        effectiveVendorId = currentUser.vendor_id;
        if (!urlVendorId || urlVendorId === currentUser.vendor_id) {
            hasPermission = true;
        }
      }

      console.log('🎯 Final vendor selection:', {
        effectiveVendorId,
        hasPermission,
        vendorIdType: typeof effectiveVendorId,
        vendorIdLength: effectiveVendorId?.length
      });

      if (effectiveVendorId && (!effectiveVendorId.match(/^[a-f0-9]{24}$/i) || effectiveVendorId.length < 10)) {
        console.error('❌ Invalid vendor ID format:', effectiveVendorId);
        
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      if (!hasPermission || !effectiveVendorId) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }
      
      setTargetVendorId(effectiveVendorId);

      let userVendor;
      const vendorFetchStart = performance.now();
      
      try {
        console.log('🚀 Attempting to fetch vendor:', effectiveVendorId);
        userVendor = await Vendor.get(effectiveVendorId);
        console.log('✅ Vendor fetch successful:', userVendor?.name);
      } catch (vendorError) {
        const vendorFetchTime = performance.now() - vendorFetchStart;
        console.error(`❌ Failed to fetch vendor with ID: ${effectiveVendorId}`, vendorError);
        
        try {
          await DataLoadFailure.create({
            page_name: "VendorDashboard",
            user_email: currentUser.email,
            failure_type: "error",
            data_source: "Vendor.get",
            error_message: vendorError.message || `Failed to fetch vendor: ${effectiveVendorId}`,
            load_time_ms: vendorFetchTime,
            user_type: currentUser.user_type,
            additional_context: {
              vendor_id: effectiveVendorId,
              url_vendor_id: urlVendorId,
              user_vendor_id: currentUser.vendor_id,
              error_status: vendorError.response?.status,
              error_type: vendorError.response?.data?.error_type
            },
            browser_info: navigator.userAgent,
            stack_trace: vendorError.stack
          });
        } catch (logError) {
          console.warn('Failed to log data load failure:', logError);
        }
        
        userVendor = null;
      }

      if (!userVendor) {
        console.error("Vendor not found for vendor_id:", effectiveVendorId);
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      setVendor(userVendor);
      
      const userFilter = { vendor_id: effectiveVendorId };
      const [ordersData, chatsData, productsData, vendorUsers] = await Promise.all([
        urlSetupMode ? Promise.resolve([]) : Order.filter({ vendor_id: effectiveVendorId }, "-created_date"),
        urlSetupMode ? Promise.resolve([]) : Chat.filter({ vendor_id: effectiveVendorId }, "-last_message_at", 1000),
        urlSetupMode ? Promise.resolve([]) : Product.filter({ vendor_id: effectiveVendorId }, "-sort"),
        (['vendor', 'admin', 'chief of staff'].includes(currentUser.user_type)) 
            ? User.filter(userFilter) 
            : Promise.resolve([])
      ]);

      const pickersData = vendorUsers.filter(u => u.user_type === 'picker');

      setOrders(ordersData);
      setChats(chatsData);
      setProducts(productsData);
      setPickers(pickersData);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      
      try {
        await DataLoadFailure.create({
          page_name: "VendorDashboard",
          user_email: user?.email || 'unknown',
          failure_type: "error",
          data_source: "VendorDashboard.loadData",
          error_message: error.message || 'Unknown dashboard loading error',
          user_type: user?.user_type || 'unknown',
          additional_context: {
            url_params: Object.fromEntries(new URLSearchParams(window.location.search)),
            current_url: window.location.href
          },
          browser_info: navigator.userAgent,
          stack_trace: error.stack
        });
      } catch (logError) {
        console.warn('Failed to log dashboard failure:', logError);
      }
      
      if (error && typeof error.message === 'string' && error.message.includes('coroutine')) {
          console.error("Encountered a known backend issue with user data fetching. The workaround may not have caught this instance.");
      }
      setAccessDenied(true);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, t, user?.email, user?.user_type]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleOpenChat = async (order, existingChat = null) => {
    if (existingChat) {
      setOrderToChat({ ...order, chat: existingChat });
    } else {
      setOrderToChat(order);
    }
    setActiveTab("chats");
  };

  const getOrderStats = () => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.created_date).toDateString() === today);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    return { todayOrders: todayOrders.length, pendingOrders };
  };

  const handleStartShopping = (household) => {
    if (user?.vendor_id) {
      sessionStorage.setItem('shoppingForHousehold', JSON.stringify(household));
      window.dispatchEvent(new Event('shoppingModeChanged'));
      navigate(createPageUrl(`Vendor?id=${user.vendor_id}`));
    } else {
      console.warn("Cannot start shopping: User is not associated with a vendor or is an admin viewing another vendor.");
    }
  };

  const handleExport = async () => {
    if (!targetVendorId) {
      console.error("Vendor ID is not available for export.");
      return;
    }
    setIsExporting(true);
    try {
      const { data } = await exportVendorOrders({ vendorId: targetVendorId, startDate: exportStartDate, endDate: exportEndDate });
      const blob = new Blob(['\uFEFF' + data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendor_orders_${targetVendorId}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting orders:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCalendarOrderClick = (order) => {
    setCalendarModalOrder(order);
  };

  const handleCloseCalendarModal = () => {
    setCalendarModalOrder(null);
  };

  const handleCalendarOrderUpdate = (updatedOrder) => {
    setOrders(currentOrders =>
      currentOrders.map(o => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    setCalendarModalOrder(updatedOrder);
  };

  const handleCalendarMarkAsReady = async () => {
    if (!calendarModalOrder) return;
    
    try {
      await Order.update(calendarModalOrder.id, { status: "ready_for_shipping" });
      await refreshOrders();
      const updatedOrder = await Order.get(calendarModalOrder.id);
      setCalendarModalOrder(updatedOrder);
    } catch (error) {
      console.error("Failed to mark order as ready:", error);
      throw error;
    }
  };

  const handleCalendarMarkAsShipped = async () => {
    if (!calendarModalOrder) return;
    
    try {
      await Order.update(calendarModalOrder.id, { status: "delivery" });
      await refreshOrders();
      const updatedOrder = await Order.get(calendarModalOrder.id);
      setCalendarModalOrder(updatedOrder);
    } catch (error) {
      console.error("Failed to mark order as shipped:", error);
      throw error;
    }
  };

  const handleCalendarCancelOrder = async () => {
    if (!calendarModalOrder) return;
    
    if (confirm(t('vendor.orderManagement.confirmCancel'))) {
      try {
        await Order.update(calendarModalOrder.id, { status: "cancelled" });
        await refreshOrders();
        setCalendarModalOrder(null);
      } catch (error) {
        console.error("Failed to cancel order:", error);
        alert(t('common.updateError'));
      }
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('vendor.dashboard.loading')}</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('vendor.accessDenied.title')}</h2>
            
            {dataError ? (
                <p className="text-red-600 bg-red-50 p-3 rounded-md mb-6">{dataError}</p>
            ) : (
                <p className="text-gray-600 mb-6">
                  {t('vendor.accessDenied.description')}
                </p>
            )}

            <p className="text-sm text-gray-500 mb-4">
              {t('vendor.accessDenied.permissionInfo')}
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>{t('vendor.accessDenied.yourUserType')} <strong>{user?.user_type || t('vendor.accessDenied.unknown')}</strong></p>
              <p>{t('vendor.accessDenied.required')} <strong>{t('vendor.accessDenied.vendorOrPicker')}</strong> or <strong>{t('userRoles.admin')}</strong> {t('vendor.accessDenied.withVendorId')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = getOrderStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {setupMode ? t('vendor.dashboard.setupTitle') 
                  : user?.user_type === 'picker' ? t('vendor.dashboard.pickerTitle') 
                  : (user?.user_type === 'admin' || user?.user_type === 'chief of staff') ? t('vendor.dashboard.adminViewTitle')
                  : t('vendor.dashboard.title')}
              </h1>
              <p className="text-gray-600">{t('vendor.dashboard.welcome').replace('{{name}}', user?.first_name ? `${user.first_name} ${user.last_name}` : user?.full_name || '')}</p>
              {vendor && (
                <p className="text-sm text-gray-500">
                    {(user?.user_type === 'admin' || user?.user_type === 'chief of staff' || setupMode) 
                        ? t('vendor.dashboard.managingStore').replace('{{storeName}}', language === 'Hebrew' ? (vendor.name_hebrew || vendor.name) : vendor.name)
                        : t('vendor.dashboard.store').replace('{{storeName}}', language === 'Hebrew' ? (vendor.name_hebrew || vendor.name) : vendor.name)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {setupMode && (
                <Button
                  onClick={() => window.open(createPageUrl(`Vendor?id=${targetVendorId}`), '_blank')}
                  variant="outline"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {t('vendor.dashboard.previewStore')}
                </Button>
              )}
              {(!setupMode && (user?.user_type === 'vendor' || user?.user_type === 'picker' || user?.user_type === 'admin' || user?.user_type === 'chief of staff')) && (
                <>
                  <Button
                    onClick={() => setShowHouseholdSelector(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Briefcase className="w-4 h-4 mr-2" />
                    {t('vendor.dashboard.shopForHousehold')}
                  </Button>
                
                </>
              )}
            </div>
          </div>
        </div>
        
       

        {(!setupMode && (user?.user_type === 'vendor' || user?.user_type === 'picker' || user?.user_type === 'admin' || user?.user_type === 'chief of staff')) && (
          <div className="grid grid-cols-3 md:grid-cols-3 gap-6 mb-8">
            <Card >
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Package className="w-8 h-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">{t('vendor.dashboard.todayOrders')}</p>
                    <p className="text-2xl font-bold">{stats.todayOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Package className="w-8 h-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">{t('vendor.dashboard.pendingOrders')}</p>
                    <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <MessageCircle className="w-8 h-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">{t('vendor.dashboard.activeChats')}</p>
                    <p className="text-2xl font-bold">{chats.filter(c => c.status === 'active').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`flex flex-wrap h-auto justify-start gap-1 sm:gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {userTabs.map((tab) => (
              <TabsTrigger 
                key={tab.value} 
                value={tab.value} 
                className={`flex-grow sm:flex-grow-0 ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          {!setupMode && (
            <TabsContent value="orders">
              <OrderManagement
                orders={orders}
                onOrderUpdate={handleOrderUpdate}
                vendorId={targetVendorId}
                user={user}
                onRefresh={refreshOrders}
              />
            </TabsContent>
          )}

          {!setupMode && (
            <TabsContent value="quick_order" className="space-y-6">
              <QuickOrderForm
                preSelectedVendorId={vendor?.id}
                userType={user?.user_type}
                onOrderCreated={loadDashboardData}
              />
            </TabsContent>
          )}

          {!setupMode && (
            <TabsContent value="calendar">
              <CustomerDayCalendar
                orders={orders}
                onOrderClick={handleCalendarOrderClick}
              />
            </TabsContent>
          )}

          <TabsContent value="products">
            <ProductManagement
              vendor={vendor}
              vendorId={targetVendorId}
              userType={user?.user_type}
            />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryManagement vendorId={targetVendorId} />
          </TabsContent>

          {!setupMode && (
            <TabsContent value="shopping-list">
              <ShoppingList 
                orders={orders} 
                vendor={vendor} 
                onUpdate={refreshOrders} 
              />
            </TabsContent>
          )}

          {!setupMode && (
            <TabsContent value="chats">
              <VendorChat
                chats={chats}
                vendorId={targetVendorId}
                onChatUpdate={refreshChats}
                orderToChat={orderToChat}
                onChatOpened={() => setOrderToChat(null)}
                onOrderUpdate={handleOrderUpdate}
              />
            </TabsContent>
          )}

          {!setupMode && (
            <TabsContent value="billing">
              <BillingManagement vendor={vendor} vendorId={targetVendorId} orders={orders} userType={user?.user_type} onRefresh={loadDashboardData} />
            </TabsContent>
          )}

          {!setupMode && (
            <TabsContent value="pickers">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {t('vendor.pickers.title')} ({pickers.length})
                  </CardTitle>
                  <p className="text-gray-600">{t('vendor.pickers.description')}</p>
                </CardHeader>
                <CardContent>
                  {pickers.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('vendor.pickers.noPickersAssigned')}</h3>
                      <p className="text-gray-600">{t('vendor.pickers.noPickerAccountsCreated')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pickers.map((picker) => (
                        <div key={picker.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{picker.full_name}</p>
                              <p className="text-sm text-gray-600">{picker.email}</p>
                              {picker.phone && (
                                <p className="text-sm text-gray-500">{t('vendor.pickers.phone')}: {picker.phone}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={picker.is_active
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-red-100 text-red-800 border-red-200"
                              }
                            >
                              {picker.is_active ? t('vendor.pickers.active') : t('vendor.pickers.inactive')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="settings">
            <div className="grid md:grid-cols-2 gap-6">
              <DeliverySchedule vendor={vendor} onUpdate={handleVendorUpdate} />
              <SubcategoryManagement vendor={vendor} onUpdate={handleVendorUpdate} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {calendarModalOrder && (
        <OrderDetailsModal
          order={calendarModalOrder}
          isOpen={!!calendarModalOrder}
          onClose={handleCloseCalendarModal}
          onOrderUpdate={handleCalendarOrderUpdate}
          onMarkAsReady={handleCalendarMarkAsReady}
          onMarkAsShipped={handleCalendarMarkAsShipped}
          onChatOpen={handleOpenChat}
          onCancelOrder={handleCalendarCancelOrder}
          userType={user?.user_type}
        />
      )}

      <HouseholdSelectorModal
        isOpen={showHouseholdSelector}
        onClose={() => setShowHouseholdSelector(false)}
        onSelect={handleStartShopping}
      />
    </div>
  );
}