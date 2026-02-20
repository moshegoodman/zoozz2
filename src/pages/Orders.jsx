import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Order, User, Vendor, Chat, Household, AppSettings } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Package, Clock, CheckCircle, XCircle, Truck, MessageCircle, Home, Users, Eye, ArrowUpDown, Filter, Store, Calendar, ChevronLeft, ChevronRight, RefreshCcw, Download, Loader2 } from "lucide-react";
import { format, eachDayOfInterval, isSameDay, startOfWeek, addWeeks, subWeeks } from "date-fns";
import ChatDialog from "../components/chat/ChatDialog";
import ViewOnlyOrderModal from "../components/chat/ViewOnlyOrderModal";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";
import { generateDeliveryPDF } from '@/functions/generateDeliveryPDF';

export default function OrdersPage() {
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(null);
  
  const [view, setView] = useState('my_orders');
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [sortBy, setSortBy] = useState('date-newest');
  const [selectedStatuses, setSelectedStatuses] = useState(['pending', 'shopping', 'ready_for_shipping', 'delivery', 'delivered', 'cancelled', 'follow_up']);

  const [calendarView, setCalendarView] = useState('list');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [calendarDates, setCalendarDates] = useState([]);

  const [downloadingDeliveryId, setDownloadingDeliveryId] = useState(null); 

  const statusOptions = [
    { value: 'pending', label: t('ordersPage.status.pending', 'Pending') },
    { value: 'follow_up', label: t('ordersPage.status.follow_up', 'Follow-Up Order') },
    { value: 'shopping', label: t('ordersPage.status.shopping', 'Shopping') },
    { value: 'ready_for_shipping', label: t('ordersPage.status.ready_for_shipping', 'Ready for Shipping') },
    { value: 'delivery', label: t('ordersPage.status.delivery', 'Out for Delivery') },
    { value: 'delivered', label: t('ordersPage.status.delivered', 'Delivered') },
    { value: 'cancelled', label: t('ordersPage.status.cancelled', 'Cancelled') },
  ];

  // Helper function to format price based on order's original currency
  const formatOrderPrice = useCallback((amount, order) => {
    if (amount === null || amount === undefined) return '0.00';
    
    const currency = order?.order_currency || 'ILS';
    const currencySymbol = currency === 'USD' ? '$' : '₪';
    
    return `${currencySymbol}${amount.toFixed(2)}`;
  }, []);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      let fetchedOrders = [];
      
      if (currentUser.user_type === 'kcs staff') {
        const householdData = sessionStorage.getItem('selectedHousehold');
        const household = householdData ? JSON.parse(householdData) : null;
        setSelectedHousehold(household);
        
        if (view === 'household_orders' && household) {
          const householdOrders = await Order.filter({ household_id: household.id }, "-created_date");
          fetchedOrders = householdOrders || [];
        } else {
          const myOrders = await Order.filter({ user_email: currentUser.email }, "-created_date");
          fetchedOrders = myOrders || [];
        }
      } else {
        const userOrders = await Order.filter({ user_email: currentUser.email }, "-created_date");
        fetchedOrders = userOrders || [];
      }
      
      setOrders(fetchedOrders);
      
      const allVendors = await Vendor.list();
      setVendors(allVendors);

    } catch (error) {
      console.error("Error loading orders:", error);
      setOrders([]);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (calendarView === 'calendar') {
      const start = currentWeekStart;
      const end = addWeeks(start, 1);
      const dates = eachDayOfInterval({ start, end: new Date(end.getTime() - 1) });
      setCalendarDates(dates);
    }
  }, [currentWeekStart, calendarView]);

  const getWeeksFromDates = () => {
    const weeks = [];
    let currentWeek = [];
    
    calendarDates.forEach((date) => {
      currentWeek.push(date);
      
      if (currentWeek.length === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  const handleOpenChat = async (order) => {
    try {
      if (!user) {
        console.error("User not loaded, cannot open chat.");
        alert(t('orders.chat.failedToOpen', 'Failed to open chat: User not identified.'));
        return;
      }
      const existingChats = await Chat.filter({
        order_id: order.id,
        customer_email: user.email
      });

      let chat;
      if (existingChats.length > 0) {
        chat = existingChats[0];
      } else {
        const chatData = {
          order_id: order.id,
          customer_email: user.email,
          vendor_id: order.vendor_id,
          chat_type: "order_chat",
          messages: [{
            sender_email: user.email,
            sender_type: "customer",
            message: t('orders.chat.initialMessage', 'Hi, I have a question about my order.'),
            timestamp: new Date().toISOString(),
            read: false
          }],
          status: "active",
          last_message_at: new Date().toISOString()
        };

        if (order.household_id) {
          chatData.household_id = order.household_id;
          chatData.household_name = order.household_name;
          chatData.household_name_hebrew = order.household_name_hebrew;
          chatData.household_code = order.household_code;
        }
        const vendor = vendors.find(v => v.id === order.vendor_id);
        if (vendor) {
          chatData.vendor_name = vendor.name;
          chatData.vendor_name_hebrew = vendor.name_hebrew;
        }

        chat = await Chat.create(chatData);
      }

      setSelectedChatId(chat.id);
      setShowChatDialog(true);
    } catch (error) {
      console.error("Error opening chat:", error);
      alert(t('orders.chat.failedToOpen', 'Failed to open chat'));
    }
  };

  const handleDownloadDeliverySlip = async (order) => {
    setDownloadingDeliveryId(order.id);
    try {
      const vendor = vendors.find(v => v.id === order.vendor_id);
      
      const response = await generateDeliveryPDF({
        order,
        vendor,
        language: language
      });

      if (response.data && response.data.success && response.data.pdfBase64) {
        const blob = new Blob(
          [new Uint8Array(atob(response.data.pdfBase64).split('').map(c => c.charCodeAt(0)))], 
          { type: 'application/pdf' }
        );
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Delivery-${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error("Failed to generate delivery PDF:", response.data?.error || "Unknown error");
        alert(t('ordersPage.deliverySlipError', 'Failed to generate delivery slip'));
      }
    } catch (error) {
      console.error("Error downloading delivery slip:", error);
      alert(t('ordersPage.deliverySlipError', 'Failed to download delivery slip'));
    } finally {
      setDownloadingDeliveryId(null);
    }
  };

  const handleStatusToggle = (status) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const handleSelectAllStatuses = () => {
    setSelectedStatuses(['pending', 'shopping', 'ready_for_shipping', 'delivery', 'delivered', 'cancelled', 'follow_up']);
  };

  const handleClearAllStatuses = () => {
    setSelectedStatuses([]);
  };

  const displayedOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    
    let filtered = [...orders];

    if (!selectedStatuses || selectedStatuses.length === 0) {
      filtered = [];
    } else {
      filtered = filtered.filter(order => selectedStatuses.includes(order.status?.toLowerCase()));
    }

    switch (sortBy) {
      case 'date-newest':
        return filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      
      case 'date-oldest':
        return filtered.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
      case 'household-az':
        return filtered.sort((a, b) => {
          const nameA = language === 'Hebrew' 
            ? (a.household_name_hebrew || a.household_name || '') 
            : (a.household_name || '');
          const nameB = language === 'Hebrew' 
            ? (b.household_name_hebrew || b.household_name || '') 
            : (b.household_name || '');
          return nameA.localeCompare(nameB, language === 'Hebrew' ? 'he' : 'en');
        });
      
      case 'household-za':
        return filtered.sort((a, b) => {
          const nameA = language === 'Hebrew' 
            ? (a.household_name_hebrew || a.household_name || '') 
            : (a.household_name || '');
          const nameB = language === 'Hebrew' 
            ? (b.household_name_hebrew || b.household_name || '') 
            : (b.household_name || '');
          return nameB.localeCompare(nameA, language === 'Hebrew' ? 'he' : 'en');
        });
      
      case 'delivery-time':
        return filtered.sort((a, b) => {
          if (!a.delivery_time && !b.delivery_time) return 0;
          if (!a.delivery_time) return 1;
          if (!b.delivery_time) return -1;
          return a.delivery_time.localeCompare(b.delivery_time);
        });
      
      case 'status':
        const statusOrder = {
          'pending': 1,
          'follow_up': 2,
          'shopping': 3,
          'ready_for_shipping': 4,
          'delivery': 5,
          'delivered': 6,
          'cancelled': 7
        };
        return filtered.sort((a, b) => {
          const statusA = statusOrder[a.status?.toLowerCase()] || 99;
          const statusB = statusOrder[b.status?.toLowerCase()] || 99;
          return statusA - statusB;
        });
      
      default:
        return filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
  }, [orders, sortBy, selectedStatuses, language]);

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "follow_up":
        return <RefreshCcw className="w-4 h-4" />;
      case "confirmed":
        return <CheckCircle className="w-4 h-4" />;
      case "shopping":
        return <Package className="w-4 h-4" />;
      case "ready_for_shipping":
        return <Package className="w-4 h-4" />;
      case "delivery":
        return <Truck className="w-4 h-4" />;
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status) => {
    return t(`ordersPage.status.${status?.toLowerCase() || 'default'}`);
  };

  const getStatusColor = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "follow_up":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "confirmed":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "shopping":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "ready_for_shipping":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "delivery":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }, []);

  const getVendorName = (order) => {
    if (language === 'Hebrew' && order.vendor_name_hebrew) {
      return order.vendor_name_hebrew;
    }
    if (order.vendor_name) {
      return order.vendor_name;
    }
    
    const vendor = vendors.find(v => v.id === order.vendor_id);
    if (vendor) {
      return language === 'Hebrew' && vendor.name_hebrew ? vendor.name_hebrew : vendor.name;
    }
    
    return t('ordersPage.unknownVendor', 'Unknown Vendor');
  };

  const getVendorsWithOrders = useCallback(() => {
    const vendorMap = new Map();
    const filteredForCalendarOrders = (!selectedStatuses || selectedStatuses.length === 0)
      ? []
      : orders.filter(order => selectedStatuses.includes(order.status?.toLowerCase()));

    const currentWeekDatesStrings = new Set(calendarDates.map(d => format(d, 'yyyy-MM-dd')));
    const ordersInCurrentWeek = filteredForCalendarOrders.filter(order => 
      currentWeekDatesStrings.has(format(new Date(order.created_date), 'yyyy-MM-dd'))
    );

    ordersInCurrentWeek.forEach(order => {
      if (order.vendor_id && !vendorMap.has(order.vendor_id)) {
        const vendor = vendors.find(v => v.id === order.vendor_id);
        if (vendor) {
           vendorMap.set(vendor.id, {
             id: vendor.id,
             name: language === 'Hebrew' && vendor.name_hebrew ? vendor.name_hebrew : vendor.name,
             name_hebrew: vendor.name_hebrew,
           });
        } else {
           vendorMap.set(order.vendor_id, {
             id: order.vendor_id,
             name: language === 'Hebrew' && order.vendor_name_hebrew ? order.vendor_name_hebrew : order.vendor_name,
             name_hebrew: order.vendor_name_hebrew
           });
        }
      }
    });
    return Array.from(vendorMap.values()).sort((a, b) => a.name.localeCompare(b.name, language === 'Hebrew' ? 'he' : 'en'));
  }, [orders, vendors, selectedStatuses, language, calendarDates]);

  const getOrdersForVendorAndDay = useCallback((vendorId, date) => {
    const filteredForCalendarOrders = (!selectedStatuses || selectedStatuses.length === 0)
      ? []
      : orders.filter(order => selectedStatuses.includes(order.status?.toLowerCase()));

    return filteredForCalendarOrders.filter(order => {
      if (order.vendor_id !== vendorId) return false;
      const orderDate = new Date(order.created_date);
      return isSameDay(orderDate, date);
    }).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  }, [orders, selectedStatuses]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {Array(5).fill(0).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('ordersPage.title')}</h1>
        
        {user?.user_type === 'kcs staff' && (
          <Tabs value={view} onValueChange={setView} className="mb-8">
            <TabsList>
              <TabsTrigger value="my_orders">{t('ordersPage.myOrdersTab')}</TabsTrigger>
              <TabsTrigger value="household_orders">{t('ordersPage.householdOrdersTab')}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {user?.user_type === 'kcs staff' && view === 'household_orders' && !selectedHousehold ? (
          <Card>
            <CardContent className="text-center py-12">
              <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('ordersPage.noHouseholdSelectedTitle')}</h3>
              <p className="text-gray-600 mb-6">{t('ordersPage.noHouseholdSelectedDescription')}</p>
              <Link to={createPageUrl("HouseholdSelector")}>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Users className="w-4 h-4 mr-2" />
                  {t('ordersPage.selectHouseholdButton')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {user?.user_type === 'kcs staff' && view === 'household_orders' && selectedHousehold && (
              <div className="mb-6">
                <Tabs value={calendarView} onValueChange={setCalendarView}>
                  <TabsList>
                    <TabsTrigger value="list">
                      <Package className="w-4 h-4 mr-2" />
                      {t('ordersPage.listView', 'List View')}
                    </TabsTrigger>
                    <TabsTrigger value="calendar">
                      <Calendar className="w-4 h-4 mr-2" />
                      {t('ordersPage.calendarView', 'Calendar View')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {calendarView === 'list' ? (
              <>
                {orders.length > 0 && (
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-5 h-5 text-gray-500" />
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder={t('ordersPage.sortBy', 'Sort by')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date-newest">{t('ordersPage.sortDateNewest', 'Date (Newest First)')}</SelectItem>
                          <SelectItem value="date-oldest">{t('ordersPage.sortDateOldest', 'Date (Oldest First)')}</SelectItem>
                          {user?.user_type === 'kcs staff' && view === 'household_orders' && selectedHousehold && (
                            <>
                              <SelectItem value="household-az">{t('ordersPage.sortHouseholdAZ', 'Household (A-Z)')}</SelectItem>
                              <SelectItem value="household-za">{t('ordersPage.sortHouseholdZA', 'Household (Z-A)')}</SelectItem>
                            </>
                          )}
                          <SelectItem value="delivery-time">{t('ordersPage.sortDeliveryTime', 'Delivery Time')}</SelectItem>
                          <SelectItem value="status">{t('ordersPage.sortStatus', 'Status')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Filter className="w-4 h-4" />
                          {t('ordersPage.filterStatus', 'Filter Status')}
                          {selectedStatuses.length > 0 && selectedStatuses.length < statusOptions.length && ( 
                            <Badge variant="secondary" className="ml-1">
                              {selectedStatuses.length}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="start">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm">{t('ordersPage.filterByStatus', 'Filter by Status')}</h4>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleSelectAllStatuses}
                                className="h-6 text-xs px-2"
                              >
                                {t('common.all', 'All')}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleClearAllStatuses}
                                className="h-6 text-xs px-2"
                              >
                                {t('common.clear', 'Clear')}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {statusOptions.map((status) => (
                              <div key={status.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`status-${status.value}`}
                                  checked={selectedStatuses.includes(status.value)}
                                  onCheckedChange={() => handleStatusToggle(status.value)}
                                />
                                <label
                                  htmlFor={`status-${status.value}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {status.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <span className="text-sm text-gray-500">
                      {selectedStatuses.length === 0 
                        ? t('ordersPage.noFiltersSelected', 'No filters selected - select statuses to view orders')
                        : displayedOrders.length === orders.length
                        ? t('ordersPage.showingAllResults', 'Showing all {{count}} orders', { count: displayedOrders.length })
                        : t('ordersPage.showingResults', 'Showing {{count}} of {{total}} orders', { count: displayedOrders.length, total: orders.length })
                      }
                    </span>
                  </div>
                )}

                {displayedOrders.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {selectedStatuses.length === 0 
                          ? t('ordersPage.selectStatusToViewOrders', 'Select status filters to view orders')
                          : t('ordersPage.noMatchingOrders', 'No matching orders')
                        }
                      </h3>
                      <p className="text-gray-600">
                        {selectedStatuses.length === 0
                          ? t('ordersPage.useFilterAbove', 'Use the filter above to select which order statuses you want to see')
                          : t('ordersPage.tryDifferentFilters', 'Try adjusting your filters to see more orders')
                        }
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {displayedOrders.map((order) => (
                      <Card key={order.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{order.order_number}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Store className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  {getVendorName(order)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">
                                {t('ordersPage.placedOn', { date: format(new Date(order.created_date), "MMM d, yyyy 'at' h:mm a") })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${getStatusColor(order.status)} border`}>
                                {getStatusIcon(order.status)}
                                <span className="ml-1 capitalize">{getStatusLabel(order.status)}</span>
                              </Badge>
                              <Button
                                variant="outline" 
                                size="sm"
                                onClick={() => setViewingOrder(order)}
                                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {t('ordersPage.viewDetails', 'View Details')}
                              </Button>
                              
                              {(order.status === 'delivery' || order.status === 'delivered') && (
                                <Button
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDownloadDeliverySlip(order)}
                                  disabled={downloadingDeliveryId === order.id}
                                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                  title={t('ordersPage.downloadDeliverySlip', 'Download Delivery Slip')}
                                >
                                  {downloadingDeliveryId === order.id ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4 mr-1" />
                                  )}
                                  {t('ordersPage.deliverySlip', 'Delivery Slip')}
                                </Button>
                              )}
                              
                              {(user?.user_type === 'kcs staff' || user?.user_type === 'customer') && (
                                <Button
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleOpenChat(order)}
                                  className="text-green-600 border-green-300 hover:bg-green-50"
                                >
                                  <MessageCircle className="w-4 h-4 mr-1" />
                                  {t('orders.chat.button', 'Chat')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {user?.user_type === 'kcs staff' && order.household_id && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <Home className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-medium text-purple-800">
                                  {t('ordersPage.orderFor', { householdName: language === 'Hebrew' ? (order.household_name_hebrew || order.household_name) : order.household_name })}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">{t('ordersPage.deliveryDetails')}</h4>
                              <p className="text-sm text-gray-600">{order.delivery_address}</p>
                              <p className="text-sm text-gray-600">{t('ordersPage.phone')} {order.phone}</p>
                              <p className="text-sm text-gray-600">{t('ordersPage.time')} {order.delivery_time}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">{t('ordersPage.orderSummary')}</h4>
                              <p className="text-sm text-gray-600">{t('ordersPage.itemsCount', { count: (order.items || []).length })}</p>
                              {user?.user_type !== 'kcs staff' && user?.user_type !== 'household owner' && (
                                <>
                                  <p className="text-sm text-gray-600">
                                    {t('ordersPage.delivery')} {formatOrderPrice(order.delivery_price, order)}
                                  </p>
                                  <p className="font-semibold">
                                    {t('ordersPage.total')} {formatOrderPrice(order.total_amount, order)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <Card dir='ltr'>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                        className="gap-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {t('ordersPage.previous', 'Previous')}
                      </Button>
                      
                      <h2 className="text-2xl font-bold text-gray-900">
                        {format(currentWeekStart, 'MMMM yyyy')} 
                      </h2>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                        className="gap-2"
                      >
                        {t('ordersPage.next', 'Next')}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {getWeeksFromDates().map((weekDates, weekIndex) => (
                  <Card key={weekIndex} className="overflow-hidden">
                    <CardHeader className="bg-gray-50 border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-gray-600">
                          {format(weekDates[0], 'MMM d')} - {format(weekDates[weekDates.length - 1], 'MMM d, yyyy')}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {getVendorsWithOrders().length} {t('ordersPage.vendors', 'Vendors')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-8 border-b bg-white">
                        <div className="p-3 font-semibold text-sm text-gray-700 border-r bg-gray-50">
                          {t('ordersPage.vendor', 'Vendor')}
                        </div>
                        {weekDates.map(date => (
                          <div 
                            key={date.toISOString()} 
                            className={`p-3 text-center border-r last:border-r-0 ${isSameDay(date, new Date()) ? 'bg-blue-50' : ''}`}
                          >
                            <div className={`text-xs text-gray-500 font-medium`}>
                              {format(date, 'EEE')}
                            </div>
                            <div className={`text-lg font-bold text-gray-900 mt-1`}>
                              {format(date, 'd')}
                            </div>
                          </div>
                        ))}
                      </div>

                      {getVendorsWithOrders().length > 0 ? (
                        getVendorsWithOrders().map((vendor, vendorIndex) => (
                          <div 
                            key={vendor.id} 
                            className={`grid grid-cols-8 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                              vendorIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <div className="p-3 font-medium text-sm text-gray-900 border-r flex items-center gap-2">
                              <Store className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{vendor.name}</span>
                            </div>

                            {weekDates.map(date => {
                              const dayOrders = getOrdersForVendorAndDay(vendor.id, date);
                              return (
                                <div 
                                  key={`${vendor.id}-${date.toISOString()}`} 
                                  className="p-2 border-r last:border-r-0 min-h-[80px]"
                                >
                                  {dayOrders.length > 0 ? (
                                    <div className="space-y-1">
                                      {dayOrders.map(order => (
                                        <button
                                          key={order.id}
                                          onClick={() => setViewingOrder(order)}
                                          className="w-full text-left p-2 rounded-md hover:shadow-md transition-all duration-200 border"
                                          style={{
                                            backgroundColor: getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('green') ? '#f0fdf4' :
                                              getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('blue') ? '#eff6ff' :
                                              getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('yellow') ? '#fefce8' :
                                              getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('orange') ? '#fff7ed' :
                                              getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('purple') ? '#faf5ff' :
                                              getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('sky') ? '#f0f9ff' :
                                              getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('cyan') ? '#e0f7fa' :
                                              getStatusColor(order.status).split(' ')[0].replace('bg-', '').includes('red') ? '#fef2f2' : '#f9fafb',
                                            borderColor: getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('green') ? '#bbf7d0' :
                                              getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('blue') ? '#bfdbfe' :
                                              getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('yellow') ? '#fef08a' :
                                              getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('orange') ? '#fed7aa' :
                                              getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('purple') ? '#e9d5ff' :
                                              getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('sky') ? '#bae6fd' :
                                              getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('cyan') ? '#a5f3fc' :
                                              getStatusColor(order.status).split(' ')[2].replace('border-', '').includes('red') ? '#fecaca' : '#e5e7eb'
                                          }}
                                        >
                                          <div className="flex items-center justify-between gap-1">
                                            {getStatusIcon(order.status)}
                                            <Badge 
                                              className={`${getStatusColor(order.status)} text-[9px] px-1 py-0 h-4`}
                                            >
                                              {getStatusLabel(order.status)}
                                            </Badge>
                                          </div>
                                          {order.delivery_time && (
                                            <div className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              {order.delivery_time}
                                            </div>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="h-full flex items-center justify-center text-gray-300">
                                      <span className="text-xl">·</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                        <div className="p-12 text-center text-gray-500">
                          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p>{t('ordersPage.noOrdersThisWeek', 'No orders found for this week')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {getWeeksFromDates().length === 0 && (
                  <Card>
                    <CardContent className="p-12 text-center text-gray-500">
                      <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        {t('ordersPage.noOrdersThisWeek', 'No orders found for this week')}
                      </h3>
                      <p className="text-sm">
                        {t('ordersPage.tryDifferentWeek', 'Try navigating to a different week')}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ChatDialog
        isOpen={showChatDialog}
        onClose={() => {
          setShowChatDialog(false);
          setSelectedChatId(null);
        }}
        chatId={selectedChatId}
      />

      {viewingOrder && (
        <ViewOnlyOrderModal
          order={viewingOrder}
          isOpen={!!viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </div>
  );
}