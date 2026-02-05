import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from "../i18n/dateUtils";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, Download, FileText, Filter, Store, Home, ArrowUp, ArrowDown, RefreshCw, Loader2, Edit, Save, X, Calculator } from 'lucide-react';
import { Order, Household, User, Vendor, Product } from '@/entities/all';
import { format, getMonth, getYear, subMonths, parseISO, addMonths } from 'date-fns';
// The original file had these, but the new PDF generation uses HTML generation + html2canvas + jspdf.
// Keeping them commented in case they're used elsewhere or for future reference.
// import { exportBillingOrdersPDF } from '@/functions/exportBillingOrdersPDF';
// import { exportBillingSummaryPDF } from '@/functions/exportBillingSummaryPDF';
import { exportBillingOrdersHTML } from '@/functions/exportBillingOrdersHTML';
import { exportBillingSummaryHTML } from '@/functions/exportBillingSummaryHTML';
// The original file had generateInvoicePDF, but the new PDF generation uses HTML generation + html2canvas + jspdf.
// Keeping it commented in case it's used elsewhere or for future reference.
import { generateInvoicePDF } from '@/functions/generateInvoicePDF'; // This is the backend function
import { generateInvoiceHTML } from '@/functions/generateInvoiceHTML';
import { generateReturnInvoiceHTML } from '@/functions/generateReturnInvoiceHTML';
import { useLanguage } from '../i18n/LanguageContext';
import ReturnItemsModal from './ReturnItemsModal';
import { base44 } from '@/api/base44Client';
import OrderDetailsModal from './OrderDetailsModal';

// PDF specific imports (These are still needed for other PDF exports via generatePdfFromHtml)
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function BillingManagement({ vendor, vendorId, userType, onRefresh }) {
  const { t, language, isRTL } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAllMonths, setShowAllMonths] = useState(true);
  const [selectedHouseholdFilter, setSelectedHouseholdFilter] = useState('all');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
  const [households, setHouseholds] = useState([]);
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const ORDERS_PER_PAGE = 100;
  const [isExporting, setIsExporting] = useState(false); // Used for general exports (CSV, HTML preview)

  // New PDF generation states
  const [isGeneratingOrdersPdf, setIsGeneratingOrdersPdf] = useState(false);
  const [isGeneratingSummaryPdf, setIsGeneratingSummaryPdf] = useState(false);
  const [isGeneratingVendorSummaryPdf, setIsGeneratingVendorSummaryPdf] = useState(false);
  // Combined PDF generation status for individual invoices/returns (existing)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(null);
  // NEW state for the new individual invoice download buttons
  const [generatingSingleInvoice, setGeneratingSingleInvoice] = useState(null);
  const [isGeneratingAllPDFs, setIsGeneratingAllPDFs] = useState(false);
  const [isGeneratingAllConvertedPDFs, setIsGeneratingAllConvertedPDFs] = useState(false);
  const [isGeneratingShoppedOnlyPDFs, setIsGeneratingShoppedOnlyPDFs] = useState(false);
  const [isGeneratingShoppedOnlyConvertedPDFs, setIsGeneratingShoppedOnlyConvertedPDFs] = useState(false);
  // NEW state for Return Note generation
  const [generatingReturnNote, setGeneratingReturnNote] = useState(null);

  const [returnOrder, setReturnOrder] = useState(null);

  // New states for combined household invoices
  const [selectedHouseholdForCombined, setSelectedHouseholdForCombined] = useState('');
  const [selectedVendorForCombined, setSelectedVendorForCombined] = useState('all');
  const [isGeneratingCombinedPDF, setIsGeneratingCombinedPDF] = useState(false);
  const [isGeneratingCombinedConvertedPDF, setIsGeneratingCombinedConvertedPDF] = useState(false);

  // SKU search states
  const [skuSearch, setSkuSearch] = useState('');
  const [skuSearchResults, setSkuSearchResults] = useState([]);
  const [viewingOrder, setViewingOrder] = useState(null);

  // States for inline editing
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editFormData, setEditFormData] = useState({ payment_status: '', payment_method: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // New states for price editing
  const [editingPricesOrder, setEditingPricesOrder] = useState(null);
  const [editedPrices, setEditedPrices] = useState({});
  const [editedDeliveryPrice, setEditedDeliveryPrice] = useState(0); // New: for editing delivery cost
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  // New state for bulk/single price update - now can hold a boolean for bulk or an order ID for single
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Updated filter states
  const [filters, setFilters] = useState({
    orderNumber: '',
    date: '',
    vendor: '', // Vendor name for admin filter
    household: '', // Household name/code for filter
    status: 'all', // Order status
    payment_status: 'all', // New: payment_status
    is_billed: 'all', // New: if order has been added to bill
    is_paid: 'all', // New: if order has been paid
    payment_method: 'all', // New: payment_method
  });
  const [summaryFilters, setSummaryFilters] = useState({
    household_name: ''
  });

  // New states for bulk update filters
  const [bulkUpdateFilters, setBulkUpdateFilters] = useState({
    vendor: 'all',
    household: 'all'
  });
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);

  // New sort config states
  const [orderSortConfig, setOrderSortConfig] = useState({ key: 'created_date', direction: 'desc' });
  const [summarySortConfig, setSummarySortConfig] = useState({ key: 'name', direction: 'asc' });
  // Removed: showAddedToBill
  const [showTotalsDialog, setShowTotalsDialog] = useState(false);
  const [calculatedTotals, setCalculatedTotals] = useState(null);
  const [showShoppedTotalsDialog, setShowShoppedTotalsDialog] = useState(false);
  const [calculatedShoppedTotals, setCalculatedShoppedTotals] = useState(null);

  // Define the enum values from the Order entity
  const paymentStatusOptions = ["client", "kcs", "denied", "none"];
  const paymentMethodOptions = ["kcs_cash", "aviCC", "meirCC", "chaimCC", "clientCC", "kcsBankTransfer", "none"];

  const ILS_TO_USD_RATE = 3.24; // Conversion rate

  // Alias for the vendor prop to match outline's function definitions
  const vendorDetails = vendor;

  // Helper function to get currency symbol
  const getCurrencySymbol = useCallback((order) => {
    const currency = order?.order_currency || 'ILS';
    return currency === 'USD' ? '$' : '₪';
  }, []);

  // Load orders on mount and when filters change
  useEffect(() => {
    loadOrders(true);
  }, [selectedMonth, showAllMonths, selectedHouseholdFilter, selectedVendorFilter, vendorId]);

  const loadOrders = async (resetPage = false) => {
    setIsLoadingOrders(true);
    try {
      const page = resetPage ? 1 : currentPage;
      const skip = (page - 1) * ORDERS_PER_PAGE;

      // Build filter for orders
      const orderFilter = { status: { $in: ['delivery', 'delivered'] } };
      if (vendorId) {
        orderFilter.vendor_id = vendorId;
      } else if (selectedVendorFilter !== 'all') {
        orderFilter.vendor_id = selectedVendorFilter;
      }

      if (selectedHouseholdFilter !== 'all') {
        orderFilter.household_id = selectedHouseholdFilter;
      }

      // Add date filter if not showing all months
      if (!showAllMonths) {
        const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
        orderFilter.updated_date = { $gte: startOfMonth.toISOString(), $lte: endOfMonth.toISOString() };
      }

      const ordersData = await Order.filter(orderFilter, '-updated_date', ORDERS_PER_PAGE, skip);
      
      if (resetPage) {
        setOrders(ordersData);
        setCurrentPage(1);
      } else {
        setOrders(prev => [...prev, ...ordersData]);
      }
      
      setHasMoreOrders(ordersData.length === ORDERS_PER_PAGE);

      // Load auxiliary data
      const householdIds = [...new Set(ordersData.map(o => o.household_id).filter(Boolean))];
      const userEmails = [...new Set(ordersData.map(o => o.user_email).filter(Boolean))];

      const promises = [];
      if (householdIds.length > 0) promises.push(Household.filter({ id: { $in: householdIds } }));
      else promises.push(Promise.resolve([]));

      if (userEmails.length > 0) promises.push(User.filter({ email: { $in: userEmails } }));
      else promises.push(Promise.resolve([]));

      const [householdsData, usersData] = await Promise.all(promises);
      setHouseholds(prev => {
        const combined = [...prev, ...householdsData];
        return Array.from(new Map(combined.map(h => [h.id, h])).values());
      });
      setUsers(prev => {
        const combined = [...prev, ...usersData];
        return Array.from(new Map(combined.map(u => [u.email, u])).values());
      });
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const loadMoreOrders = () => {
    setCurrentPage(prev => prev + 1);
    loadOrders(false);
  };

  // Load vendors for admin view
  useEffect(() => {
    const loadVendors = async () => {
      if (userType === 'admin'||userType === "chief of staff") {
        try {
          const vendorsList = await Vendor.list();
          setVendors(vendorsList);
        } catch (error) {
          console.error('Error loading vendors:', error);
        }
      }
    };
    loadVendors();
  }, [userType]);

  // Define helper functions first, before they're used in useMemo or handlers
  const getCustomerName = useCallback((order) => {
    if (order.household_id) {
      return households.find(h => h.id === order.household_id)?.name || t('common.household');
    }
    const user = users.find(u => u.email === order.user_email);
    return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.full_name : order.user_email;
  }, [households, users, t]);

  const getVendorName = useCallback((orderVendorId) => {
    // If the component is specific to a single vendor (e.g., vendor dashboard)
    // and the orderVendorId matches the component's vendor prop
    if (vendorDetails && vendorDetails.id === orderVendorId) {
      return vendorDetails.name;
    }
    // If in admin view, try to find the vendor from the loaded list
    if ((userType === 'admin'||userType === "chief of staff") && vendors.length > 0) {
      const foundVendor = vendors.find(v => v.id === orderVendorId);
      return foundVendor ? foundVendor.name : t('common.unknownVendor');
    }
    // Fallback for cases where vendor data might not be available or not admin
    return t('common.unknownVendor');
  }, [vendorDetails, userType, vendors, t]);

  const getHouseholdName = (householdId) => {
    const household = households.find(h => h.id === householdId);
    if (!household) return t('common.na');
    return (language === 'Hebrew' && household.name_hebrew) || household.name || '';
  };

  // New helper function to get household display name including code
  const getHouseholdDisplayName = useCallback((householdId) => {
    const household = households.find(h => h.id === householdId);
    if (!household) return t('common.na');
    const name = (language === 'Hebrew' && household.name_hebrew) || household.name || '';
    return household.household_code ? `${name} (#${household.household_code})` : name;
  }, [households, language, t]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'delivery': return 'bg-yellow-100 text-yellow-800';
      case 'ready_for_shipping': return 'bg-blue-100 text-blue-800';
      case 'return_processed': return 'bg-orange-100 text-orange-800'; // New status for virtual returns
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    // Replaces all underscores with spaces and capitalizes the first letter
    const key = `vendor.billing.statusLabels.${status.toLowerCase()}`;
    const fallback = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    // Provide a specific fallback for the new virtual status
    if (status === 'return_processed') {
        return t('vendor.billing.statusLabels.return_processed', 'Return Processed');
    }
    return t(key, fallback);
  };

  // Orders considered for billing (shipped, delivered, or ready to be)
  const billableOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(order => ['delivery', 'delivered'].includes(order.status));
  }, [orders]);

  // Orders filtered by the selected month or all months
  const localOrders = useMemo(() => {
    if (showAllMonths) {
      return billableOrders;
    }

    const year = getYear(selectedMonth);
    const month = getMonth(selectedMonth);

    return billableOrders.filter(order => {
      // Use updated_date for filtering, as it better reflects when the order became billable.
      const orderDate = new Date(order.updated_date);
      const orderYear = getYear(orderDate);
      const orderMonth = getMonth(orderDate);

      return orderYear === year && orderMonth === month;
    });
  }, [billableOrders, selectedMonth, showAllMonths]);

  // Billing summary data for the current view
  const billingData = useMemo(() => {
    const totalRevenue = localOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalOrders = localOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalRevenue, totalOrders, avgOrderValue };
  }, [localOrders]);

  // Summary for the current vendor (or all vendors if admin)
  const displayedVendorSummary = useMemo(() => {
    let ordersToSummarize = [];

    if (userType === 'admin'||userType === "chief of staff") {
        // Admin can see all vendors or a filtered subset
        ordersToSummarize = localOrders;
        if (selectedVendorFilter !== 'all') {
            ordersToSummarize = ordersToSummarize.filter(order => order.vendor_id === selectedVendorFilter);
        }
    } else {
        // Non-admin (specific vendor)
        ordersToSummarize = localOrders.filter(order => order.vendor_id === vendorId);
    }

    const grouped = ordersToSummarize.reduce((acc, order) => {
        const currentVendorId = order.vendor_id;
        if (!acc[currentVendorId]) {
            const vendorName = getVendorName(currentVendorId);
            acc[currentVendorId] = {
                id: currentVendorId,
                name: vendorName,
                totalOrders: 0,
                paidOrders: 0,
                unpaidOrders: 0,
                totalAmount: 0,
                paidAmount: 0,
                unpaidAmount: 0,
            };
        }
        acc[currentVendorId].totalOrders++;
        acc[currentVendorId].totalAmount += order.total_amount || 0;
        if (order.is_paid) {
            acc[currentVendorId].paidOrders++;
            acc[currentVendorId].paidAmount += order.total_amount || 0;
        } else {
            acc[currentVendorId].unpaidOrders++;
            acc[currentVendorId].unpaidAmount += order.total_amount || 0;
        }
        return acc;
    }, {});

    return Object.values(grouped);
  }, [localOrders, vendorId, userType, selectedVendorFilter, getVendorName]);

  // Calculate grand totals for vendor summary (new useMemo)
  const vendorSummaryTotals = useMemo(() => {
    let totalOrders = 0;
    let totalAmount = 0;
    let paidOrders = 0;
    let unpaidOrders = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    displayedVendorSummary.forEach(vendorData => {
      totalOrders += vendorData.totalOrders;
      totalAmount += vendorData.totalAmount;
      paidOrders += vendorData.paidOrders;
      unpaidOrders += vendorData.unpaidOrders;
      paidAmount += vendorData.paidAmount;
      unpaidAmount += vendorData.unpaidAmount;
    });

    return {
      totalOrders,
      totalAmount,
      paidOrders,
      unpaidOrders,
      paidAmount,
      unpaidAmount
    };
  }, [displayedVendorSummary]);

  // Processed orders for the table, including filtering and sorting
  const processedOrders = useMemo(() => {
    // Initial filtering based on household and vendor
    let filtered = localOrders;

    // Expand orders with returns into separate virtual orders
    const expandedOrders = filtered.flatMap(order => {
        const baseOrder = {
          ...order,
          customer_name: getCustomerName(order),
          vendor_name: getVendorName(order.vendor_id),
          household_name: getHouseholdDisplayName(order.household_id)
        };

        const result = [baseOrder]; // Always include the original order

        // If the order has returns, create a virtual return order
        if (order.has_returned_item) {
            const returnedItems = order.items.filter(item => item.is_returned && item.amount_returned > 0);

            if (returnedItems.length > 0) {
                const returnValue = returnedItems.reduce((sum, item) => {
                    return sum + (item.price * (item.amount_returned || 0));
                }, 0);

                const returnOrder = {
                    ...baseOrder, // Inherit details from the base order
                    id: `${order.id}-return`, // Unique key for React
                    order_number: `${order.id}-R`, // Visually distinct order number
                    total_amount: -returnValue, // Negative value for credit
                    status: 'return_processed',
                    is_paid: null,
                    paid_by: null,
                    added_to_bill: null,
                };
                result.push(returnOrder);
            }
        }

        return result;
    });

    // Final filtering on the expanded list
    let finalFiltered = expandedOrders.filter(order => {
        if (selectedHouseholdFilter !== 'all' && order.household_id !== selectedHouseholdFilter) return false;
        if ((userType === 'admin'||userType === "chief of staff" )&& selectedVendorFilter !== 'all' && order.vendor_id !== selectedVendorFilter) return false;

        // Apply new filters
        if (filters.orderNumber && !order.order_number.toLowerCase().includes(filters.orderNumber.toLowerCase())) return false;
        if (filters.date) {
            const orderDate = order.created_date ? format(parseISO(order.created_date), 'yyyy-MM-dd') : '';
            if (!orderDate.startsWith(filters.date)) return false;
        }
        if ((userType === 'admin'||userType === "chief of staff") && filters.vendor && !order.vendor_name.toLowerCase().includes(filters.vendor.toLowerCase())) return false;

        const orderHouseholdDisplayName = getHouseholdDisplayName(order.household_id);
        const household = households.find(h => h.id === order.household_id);
        const householdCode = household?.household_code || '';
        if (filters.household && !(orderHouseholdDisplayName.toLowerCase().includes(filters.household.toLowerCase()) || householdCode.includes(filters.household))) return false;

        if (filters.status !== 'all' && order.status !== filters.status) return false;

        if (filters.payment_status !== 'all' && order.payment_status !== filters.payment_status) return false;
        if (filters.payment_method !== 'all' && order.payment_method !== filters.payment_method) return false;

        if (filters.is_billed !== 'all' && !order.id.toString().endsWith('-return')) { // Apply only to non-return orders
          const isBilledBool = filters.is_billed === 'yes';
          if (!!order.added_to_bill !== isBilledBool) return false;
        }

        if (filters.is_paid !== 'all' && !order.id.toString().endsWith('-return')) { // Apply only to non-return orders
          const isPaidBool = filters.is_paid === 'yes';
          if (!!order.is_paid !== isPaidBool) return false;
        }

        return true;
    });

    // Sorting logic
    if (orderSortConfig.key) {
      finalFiltered.sort((a, b) => {
        // Group virtual returns with their parent orders
        const originalAId = a.id.toString().replace('-return', ''); // Convert to string before replace for safety
        const originalBId = b.id.toString().replace('-return', ''); // Convert to string before replace for safety

        if (originalAId < originalBId) return orderSortConfig.direction === 'asc' ? -1 : 1;
        if (originalAId > originalBId) return orderSortConfig.direction === 'asc' ? 1 : -1;

        // If they are from the same original order, ensure original comes before return
        if (a.id.toString().endsWith('-return') && !b.id.toString().endsWith('-return')) return 1;
        if (!a.id.toString().endsWith('-return') && b.id.toString().endsWith('-return')) return -1;

        // If they are the same type (both original or both virtual from same parent),
        // then apply the actual chosen sort key.
        const aValue = a[orderSortConfig.key];
        const bValue = b[orderSortConfig.key];

        if (typeof aValue === 'string') {
          return orderSortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return orderSortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    return finalFiltered;
  }, [localOrders, selectedHouseholdFilter, selectedVendorFilter, filters, orderSortConfig, getCustomerName, getVendorName, getHouseholdDisplayName, userType, households]);

  // handleExportOrderComparison from outline
  const handleSearchBySKU = useCallback(() => {
    if (!skuSearch.trim()) {
      alert(t('billing.enterSKU', 'Please enter a SKU'));
      return;
    }

    const ordersWithProduct = processedOrders.filter(order => {
      if (order.id.toString().endsWith('-return')) return false;
      return (order.items || []).some(item => 
        item.sku && item.sku.toLowerCase().includes(skuSearch.toLowerCase())
      );
    }).map(order => ({
      order_number: order.order_number,
      date: order.created_date,
      household_name: order.household_name,
      status: order.status,
      item: (order.items || []).find(item => 
        item.sku && item.sku.toLowerCase().includes(skuSearch.toLowerCase())
      )
    }));

    setSkuSearchResults(ordersWithProduct);
  }, [skuSearch, processedOrders, t]);

  const handleExportProductAggregation = useCallback(() => {
    const ordersToExport = processedOrders.filter(o => !o.id.toString().endsWith('-return'));

    if (ordersToExport.length === 0) {
      alert(t('billing.noOrdersToExport', 'No orders to export'));
      return;
    }

    // Aggregate products
    const productMap = new Map();

    ordersToExport.forEach(order => {
      (order.items || []).forEach(item => {
        const productId = item.product_id;
        const productName = (language === 'Hebrew' && item.product_name_hebrew) ? item.product_name_hebrew : item.product_name;
        
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            name: productName,
            nameHebrew: item.product_name_hebrew || '',
            sku: item.sku || '',
            totalOrdered: 0,
            totalSupplied: 0,
            totalOrderedWithZeroSupplied: 0,
            totalOrderedWithNullSupplied: 0,
            price: item.price,
            orderCount: new Set()
          });
        }

        const product = productMap.get(productId);
        product.totalOrdered += item.quantity || 0;
        
        const actualQty = item.actual_quantity;
        
        // Calculate total supplied (0 if null/undefined, otherwise use actual value)
        const suppliedQty = (actualQty !== null && actualQty !== undefined) ? actualQty : 0;
        product.totalSupplied += suppliedQty;
        
        // Track orders where actual_quantity === 0 (explicitly zero)
        if (actualQty === 0) {
          product.totalOrderedWithZeroSupplied += item.quantity || 0;
        }
        
        // Track orders where actual_quantity is null/undefined (not filled in)
        if (actualQty === null || actualQty === undefined) {
          product.totalOrderedWithNullSupplied += item.quantity || 0;
        }
        
        product.orderCount.add(order.id);
      });
    });

    // Convert to array and format
    const headers = [
      t('billing.productName', 'Product Name'),
      t('billing.productNameHebrew', 'Product Name (Hebrew)'),
      t('billing.sku', 'SKU'),
      t('billing.quantityOrdered', 'Quantity Ordered'),
      t('billing.quantitySupplied', 'Quantity Supplied'),
      t('billing.orderedWithZeroSupplied', 'Ordered - Supplied 0 (Explicit)'),
      t('billing.orderedWithNullSupplied', 'Ordered - Not Yet Filled'),
      t('billing.price', 'Price'),
      t('billing.numberOfOrders', 'Number of Orders')
    ];

    const rows = Array.from(productMap.values()).map(product => [
      product.name,
      product.nameHebrew,
      product.sku,
      product.totalOrdered.toFixed(2),
      product.totalSupplied.toFixed(2),
      product.totalOrderedWithZeroSupplied.toFixed(2),
      product.totalOrderedWithNullSupplied.toFixed(2),
      `₪${product.price.toFixed(2)}`,
      product.orderCount.size
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const monthYear = showAllMonths ? 'All' : format(selectedMonth, 'yyyy-MM');
    const vendorNameForFile = (userType === 'admin' || userType === 'chief of staff')
      ? (selectedVendorFilter !== 'all' ? (vendors.find(v => v.id === selectedVendorFilter)?.name || 'FilteredVendor') : 'All-Vendors')
      : (vendorDetails?.name || 'Vendor').replace(/\s+/g, '-');
    
    link.download = `Product-Aggregation-${vendorNameForFile.replace(/\s+/g, '-')}-${monthYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [processedOrders, selectedMonth, showAllMonths, userType, selectedVendorFilter, vendors, vendorDetails, t, language]);

  const handleExportOrderComparison = useCallback(() => {
    const ordersToExport = processedOrders;

    if (ordersToExport.length === 0) {
      alert(t('billing.noOrdersToExport', 'No orders to export'));
      return;
    }

    const headers = [
      t('billing.orderNumber', 'Order Number'),
      t('billing.date', 'Date'),
      t('billing.customer', 'Customer'),
      t('billing.invoiceTotal', 'Invoice Total') + ' (₪)',
      t('billing.shoppedOnlyTotal', 'Shopped Only Total') + ' (₪)',
      t('billing.difference', 'Difference') + ' (₪)',
      t('billing.invoiceTotal', 'Invoice Total') + ' ($)',
      t('billing.shoppedOnlyTotal', 'Shopped Only Total') + ' ($)'
    ];

    const rows = ordersToExport.map(order => {
      const orderDate = order.created_date ? new Date(order.created_date).toLocaleDateString() : 'N/A';
      const customerName = order.household_name || order.user_email || 'N/A';
      
      const invoiceSubtotal = (order.items || []).reduce((total, item) => {
        const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) 
          ? item.actual_quantity 
          : (item.quantity || 0);
        return total + (quantity * (item.price || 0));
      }, 0);
      
      const shoppedSubtotal = (order.items || []).reduce((total, item) => {
        const wasShoppedAndAvailable = item.shopped && item.available;
        const hasActualQuantity = item.actual_quantity !== null && 
                                 item.actual_quantity !== undefined && 
                                 item.actual_quantity > 0;
        
        if (wasShoppedAndAvailable || hasActualQuantity) {
          const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) 
            ? item.actual_quantity 
            : (item.quantity || 0);
          return total + (quantity * (item.price || 0));
        }
        return total;
      }, 0);

      const deliveryFee = order.delivery_price || 0;
      const invoiceTotal = invoiceSubtotal + deliveryFee;
      const shoppedTotal = shoppedSubtotal + deliveryFee;
      const difference = invoiceTotal - shoppedTotal;

      // Convert to USD
      const invoiceTotalUSD = invoiceTotal / ILS_TO_USD_RATE;
      const shoppedTotalUSD = shoppedTotal / ILS_TO_USD_RATE;

      return [
        order.order_number || 'N/A',
        orderDate,
        customerName,
        `₪${invoiceTotal.toFixed(2)}`,
        `₪${shoppedTotal.toFixed(2)}`,
        `₪${difference.toFixed(2)}`,
        `$${invoiceTotalUSD.toFixed(2)}`,
        `$${shoppedTotalUSD.toFixed(2)}`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Fix: Use selectedMonth and showAllMonths instead of selectedDateRange
    const monthYear = showAllMonths
      ? 'All'
      : `${format(selectedMonth, 'yyyy-MM')}`;
    
    // Fix: Use selectedVendorFilter instead of selectedVendor
    const vendorNameForFile = (userType === 'admin' || userType === 'chief of staff')
      ? (selectedVendorFilter !== 'all' ? (vendors.find(v => v.id === selectedVendorFilter)?.name || 'FilteredVendor') : 'All-Vendors')
      : (vendorDetails?.name || 'Vendor').replace(/\s+/g, '-');
    
    link.download = `Order-Comparison-${vendorNameForFile.replace(/\s+/g, '-')}-${monthYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [processedOrders, selectedMonth, showAllMonths, userType, selectedVendorFilter, vendors, vendorDetails, t, ILS_TO_USD_RATE]);

  const convertToMilitaryTime = (timeString) => {
    if (!timeString) return '';

    // Handle time ranges like "9:00 AM - 5:00 PM" or "9:00-17:00"
    // Regex for: HH:MM AM/PM - HH:MM AM/PM OR HH:MM-HH:MM
    const timeRangeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(-)\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
    // Regex for single time like "9:00 AM" or "17:00"
    const singleTimeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;

    const convertTimePartTo24Hour = (hour, minute, period) => {
      let h = parseInt(hour, 10);
      const m = parseInt(minute, 10);

      if (period) { // If AM/PM is present, convert from 12-hour to 24-hour
        if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period.toUpperCase() === 'AM' && h === 12) h = 0;
      }
      // If no period, assume it's already 24-hour or needs no conversion (e.g., 9:00 is 09:00)

      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const rangeMatch = timeString.match(timeRangeRegex);
    if (rangeMatch) {
      const [, startHour, startMin, startPeriod, separator, endHour, endMin, endPeriod] = rangeMatch;
      const startTime = convertTimePartTo24Hour(startHour, startMin, startPeriod);
      const endTime = convertTimePartTo24Hour(endHour, endMin, endPeriod);
      return `${startTime}${separator}${endTime}`;
    }

    const singleMatch = timeString.match(singleTimeRegex);
    if (singleMatch) {
      const [, hour, minute, period] = singleMatch;
      return convertTimePartTo24Hour(hour, minute, period);
    }

    // If no specific time or range format matched, return original string
    return timeString;
  };

  const formatDeliveryTime = (deliveryTime, lang) => {
    if (!deliveryTime) return '';

    let datePartForDisplay = '';
    let timeStringForConversion = deliveryTime;

    // 1. Try to match YYYY-MM-DD date format
    const yyyyMmDdRegex = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/;
    const yyyyMmDdMatch = yyyyMmDdRegex.exec(deliveryTime);

    if (yyyyMmDdMatch) {
      const dateStr = yyyyMmDdMatch[1];
      timeStringForConversion = yyyyMmDdMatch[2].trim();
      try {
        const parts = dateStr.split('-').map(Number);
        const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        if (!isNaN(utcDate.getTime())) {
          // Use Hebrew month format when language is Hebrew
          const dateFormat = lang === 'Hebrew' ? 'd MMM' : 'MMM d';
          datePartForDisplay = formatDate(utcDate, dateFormat, lang);
        }
      } catch (e) {
        console.warn("Failed to parse YYYY-MM-DD date part:", e);
      }
    } else {
      // 2. If YYYY-MM-DD fails, try to match MMM DD date format
      const mmmDdRegex = /^([A-Za-z]{3})\s+(\d{1,2}),?\s*(.*)$/;
      const mmmDdMatch = mmmDdRegex.exec(deliveryTime);

      if (mmmDdMatch) {
        const monthStr = mmmDdMatch[1];
        const dayStr = mmmDdMatch[2];
        timeStringForConversion = mmmDdMatch[3].trim();

        // Convert English month to Hebrew if needed
        if (lang === 'Hebrew') {
          const monthMap = {
            'Jan': 'ינו', 'Feb': 'פבר', 'Mar': 'מרץ', 'Apr': 'אפר',
            'May': 'מאי', 'Jun': 'יונ', 'Jul': 'יול', 'Aug': 'אוג',
            'Sep': 'ספט', 'Oct': 'אוק', 'Nov': 'נוב', 'Dec': 'דצמ'
          };
          const hebrewMonth = monthMap[monthStr] || monthStr;
          datePartForDisplay = `${dayStr} ${hebrewMonth}`;
        } else {
          datePartForDisplay = `${monthStr} ${dayStr}`;
        }
      }
    }

    const militaryTime = convertToMilitaryTime(timeStringForConversion);
    const tzSuffix = '';

    // Combine date and time parts for the final display
    if (datePartForDisplay && militaryTime) {
      return `${datePartForDisplay}, ${militaryTime}${tzSuffix}`;
    } else if (datePartForDisplay) {
      return datePartForDisplay;
    } else if (militaryTime && deliveryTime === timeStringForConversion) {
      // This covers cases where the original string was purely a time (e.g., "09:00 AM")
      // and no date part was extracted by either regex.
      return `${militaryTime}${tzSuffix}`;
    }

    // Fallback: If no recognized format, return original string
    return deliveryTime;
  };

  // Processed household summary for the table, including filtering and sorting
  const processedHouseholdSummary = useMemo(() => {
    let summary = households.filter(household => {
      if (summaryFilters.household_name) {
        const query = summaryFilters.household_name.toLowerCase();
        const displayName = getHouseholdDisplayName(household.id).toLowerCase();
        if (!displayName.includes(query)) return false;
      }
      return true;
    }).map(household => {
      const householdOrders = localOrders.filter(o => o.household_id === household.id);

      // Calculate returns data
      const ordersWithReturns = householdOrders.filter(o => o.has_returned_item);
      const totalReturns = householdOrders.reduce((sum, order) => {
        if (!order.items) return sum;
        const returnAmount = order.items
          .filter(item => item.is_returned && item.amount_returned > 0)
          .reduce((itemSum, item) => itemSum + (item.price * (item.amount_returned || 0)), 0);
        return sum + returnAmount;
      }, 0);

      const totalPurchases = householdOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const netPurchases = totalPurchases - totalReturns;
      const totalPaid = householdOrders.filter(o => o.is_paid).reduce((sum, o) => sum + (o.total_amount || 0), 0);
      // FIX: Changed totalUnpaid calculation to correctly account for returns
      const totalUnpaid = netPurchases - totalPaid;

      return {
        ...household,
        display_name: getHouseholdDisplayName(household.id),
        totalOrders: householdOrders.length,
        ordersWithReturns: ordersWithReturns.length,
        totalPurchases: totalPurchases,
        totalReturns: totalReturns,
        netPurchases: netPurchases,
        totalPaid: totalPaid,
        totalUnpaid: totalUnpaid
      };
    });

    if (summarySortConfig.key) {
      summary.sort((a, b) => {
        const sortKey = summarySortConfig.key === 'name' ? 'display_name' : summarySortConfig.key;
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        if (typeof aValue === 'string') {
          return summarySortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return summarySortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    return summary;
  }, [households, localOrders, summaryFilters, summarySortConfig, getHouseholdDisplayName]);

  const handleMonthChange = (direction) => {
    if (showAllMonths) return; // Disable month change if all months are shown
    if (direction === 'prev') {
      setSelectedMonth(subMonths(selectedMonth, 1));
    } else {
      setSelectedMonth(addMonths(selectedMonth, 1));
    }
  };

  // New filter handler for order table
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSummaryFilterChange = (key, value) => {
    setSummaryFilters(prev => ({ ...prev, [key]: value }));
  };

  // Handler for inline editing
  const handleEditClick = (order) => {
    setEditingOrderId(order.id);
    // Use 'none' for null/undefined values to correctly select the default in the Select component
    setEditFormData({
      payment_status: order.payment_status || 'none',
      payment_method: order.payment_method || 'none',
    });
  };

  const handleCancelEdit = () => {
    setEditingOrderId(null);
    setEditFormData({ payment_status: '', payment_method: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingOrderId) return;
    setIsSavingEdit(true);
    try {
      // Convert 'none' back to null for database storage
      const updatedPaymentStatus = editFormData.payment_status === 'none' ? null : editFormData.payment_status;
      const updatedPaymentMethod = editFormData.payment_method === 'none' ? null : editFormData.payment_method;

      await Order.update(editingOrderId, {
        payment_status: updatedPaymentStatus,
        payment_method: updatedPaymentMethod,
      });
      if (onRefresh) {
        onRefresh(); // Trigger a data refresh from the parent component
      }
      setEditingOrderId(null);
    } catch (error) {
      console.error("Error updating order:", error);
      alert(t('common.updateError'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Replaced handlePaymentToggle
  const handleTogglePaid = useCallback(async (orderId, currentValue) => {
    try {
      await Order.update(orderId, { is_paid: !currentValue });
      if (onRefresh) {
          onRefresh();
      }
    } catch (error) {
      console.error("Failed to update payment status:", error);
      alert(t('common.updateError'));
    }
  }, [onRefresh, t]);

  // New function for toggling is_billed
  const handleToggleBilled = useCallback(async (orderId, currentValue) => {
    try {
      await Order.update(orderId, { added_to_bill: !currentValue }); // Mapping is_billed to added_to_bill
      if (onRefresh) {
          onRefresh();
      }
    } catch (error) {
      console.error("Failed to update billed status:", error);
      alert(t('common.updateError'));
    }
  }, [onRefresh, t]);

  // Removed: handlePaymentToggle (logic moved to filters if needed, but not directly in table anymore)
  // Removed: handleAddedToBillToggle (replaced by handleToggleBilled)

  const handleOpenPriceEditor = (order) => {
    setEditingPricesOrder(order);
    // Initialize edited prices with current prices
    const initialPrices = {};
    order.items.forEach(item => {
      initialPrices[item.product_id] = item.price;
    });
    setEditedPrices(initialPrices);
    setEditedDeliveryPrice(order.delivery_price || 0); // Initialize delivery price
  };

  const handlePriceChange = (productId, newPrice) => {
    setEditedPrices(prev => ({
      ...prev,
      [productId]: parseFloat(newPrice) || 0
    }));
  };

  const handleDeliveryPriceChange = (newPrice) => {
    setEditedDeliveryPrice(parseFloat(newPrice) || 0);
  };

  const handleSavePrices = async () => {
    if (!editingPricesOrder) return;

    setIsSavingPrices(true);
    try {
      // Update the order items with new prices
      const updatedItems = editingPricesOrder.items.map(item => ({
        ...item,
        price: editedPrices[item.product_id] || item.price
      }));

      // Recalculate total amount
      const newTotal = updatedItems.reduce((sum, item) => {
        const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
          ? item.actual_quantity
          : item.quantity;
        return sum + (item.price * quantity);
      }, 0);

      // Add the edited delivery price
      const finalTotal = newTotal + editedDeliveryPrice;

      // Update the order in the database
      await Order.update(editingPricesOrder.id, {
        items: updatedItems,
        delivery_price: editedDeliveryPrice,
        total_amount: finalTotal
      });

      // Refresh the data
      if (onRefresh) {
        await onRefresh();
      }

      // Close the modal
      setEditingPricesOrder(null);
      setEditedPrices({});
      setEditedDeliveryPrice(0);

      alert(t('vendor.billing.pricesUpdatedSuccess', 'Prices updated successfully!'));
    } catch (error) {
      console.error("Error updating prices:", error);
      alert(t('vendor.billing.pricesUpdateFailed', 'Failed to update prices.'));
    } finally {
      setIsSavingPrices(false);
    }
  };

  // New handler for HTML Invoice preview
  const handleViewInvoiceHTML = async (order) => {
    try {
      let household = null;
      if (order.household_id) {
          household = households.find(h => h.id === order.household_id);
      }
      const languageCode = language === 'Hebrew' ? 'he' : 'en';
      const response = await generateInvoiceHTML({
        order,
        vendor: vendors.find(v => v.id === order.vendor_id) || vendorDetails, // Use the correct vendor from the list if admin, else default
        household,
        language: languageCode
      });
      const htmlContent = response.data;

      // Create a blob URL for the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // For mobile devices, create a download link instead of opening new window
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Create a temporary download link for mobile
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${order.order_number}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // For desktop, open in new window
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          alert(t('vendor.billing.popupBlocked'));
        }
      }
    } catch (error) {
      console.error("Failed to generate invoice HTML:", error);
      alert(t('vendor.billing.failedToGenerateInvoiceHTML'));
    }
  };

  const handleViewReturnNoteHTML = async (returnOrder) => { // Renamed from handleViewReturnCreditInvoice
    try {
      let household = null;
      if (returnOrder.household_id) {
          household = households.find(h => h.id === returnOrder.household_id);
      }
      const languageCode = language === 'Hebrew' ? 'he' : 'en';

      // For return orders, we want to generate a credit note/return invoice
      const response = await generateReturnInvoiceHTML({
        order: returnOrder,
        vendor: vendors.find(v => v.id === returnOrder.vendor_id) || vendorDetails,
        household,
        language: languageCode
      });
      const htmlContent = response.data;

      // Create a blob URL for the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // For mobile devices, create a download link instead of opening new window
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Create a temporary download link for mobile
        const a = document.createElement('a');
        a.href = url;
        a.download = `return-note-${returnOrder.order_number}.html`; // Renamed download file
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // For desktop, open in new window
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          alert(t('vendor.billing.popupBlocked'));
        }
      }
    } catch (error) {
      console.error("Failed to generate return note HTML:", error);
      alert(t('vendor.billing.failedToGenerateReturnInvoice', 'Failed to generate return note. Please try again.'));
    }
  };

  const handleSaveReturns = async (updatedItems) => {
    if (!returnOrder) return;

    // Recalculate the order's total amount based on delivered minus returned items
    const newTotalAmount = updatedItems.reduce((total, item) => {
        const deliveredQty = item.actual_quantity || 0;
        const returnedQty = item.is_returned ? (item.amount_returned || 0) : 0;
        const effectiveQty = deliveredQty - returnedQty;
        return total + (item.price * effectiveQty);
    }, 0);

    // Check if there are any returned items to set the flag
    const hasReturnedItem = updatedItems.some(item => item.is_returned && item.amount_returned > 0);

    try {
        await Order.update(returnOrder.id, {
            items: updatedItems,
            // i intentionally kept the total the same as the original cause i want the original order to look the same and i only want to show
            // as if there was a new order this way there is no confusion for the users that stuff seem to change on them
            // total_amount: newTotalAmount,
            has_returned_item: hasReturnedItem, // Update the new flag
        });

        // If a refresh function is provided by the parent, call it to update the data
        if (onRefresh) {
            onRefresh();
        }

    } catch (error) {
        console.error("Failed to save returns:", error);
        alert(t('vendor.returns.saveFailed', 'Failed to save returns. Please try again.'));
    } finally {
        setReturnOrder(null); // Close the modal
    }
  };

  const handleExportOrdersCSV = () => {
    if (processedOrders.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }

    const headers = [
      t('vendor.billing.orderId'),
      t('vendor.billing.date'),
     ( userType === 'admin'||userType === "chief of staff" )? t('vendor.billing.vendor') : null,
      t('vendor.billing.household'), // This will display the header for household display name
      t('vendor.billing.total'),
      (userType === 'admin' ||userType === "chief of staff")? t('vendor.billing.status') : null,
      t('vendor.billing.paymentStatusColumn'), // New
      t('vendor.billing.isBilledColumn'), // New
      t('vendor.billing.isPayedColumn'), // New
      t('vendor.billing.paymentMethodColumn'), // New
    ].filter(Boolean);

    const csvData = processedOrders.map(order => {
      const row = [
        order.order_number,
        order.created_date ? format(parseISO(order.created_date), 'yyyy-MM-dd HH:mm') : t('common.na'),
        (userType === 'admin'||userType === "chief of staff" )? order.vendor_name : null, // Use order.vendor_name which is already resolved
        order.household_name, // This already contains the display name with code
        `${getCurrencySymbol(order)}${(order.total_amount || 0).toFixed(2)}`,
        (userType === 'admin' ||userType === "chief of staff")? getStatusLabel(order.status) : null,
        order.id.toString().endsWith('-return') ? '-' : (order.payment_status ? t(`vendor.billing.paymentStatuses.${order.payment_status}`) : 'N/A'), // New
        order.id.toString().endsWith('-return') ? '-' : (order.added_to_bill ? t('vendor.billing.yes') : t('vendor.billing.no')), // New: is_billed
        order.id.toString().endsWith('-return') ? '-' : (order.is_paid ? t('vendor.billing.yes') : t('vendor.billing.no')), // New: is_paid
        order.id.toString().endsWith('-return') ? '-' : (order.payment_method ? t(`vendor.billing.paymentMethods.${order.payment_method}`) : 'N/A'), // New: payment_method
      ];
      return row.filter(cell => cell !== null).map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `billing-orders-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // New handler for HTML Orders preview
  const handleExportOrdersHTML = async () => {
    setIsExporting(true);
    try {
      const dataToExport = processedOrders.map(o => ({
        ...o,
        customer_name: getCustomerName(o),
      }));
      const response = await exportBillingOrdersHTML({
        orders: dataToExport,
        vendorName: vendorDetails?.name, // This will be the main vendor name for the context, not all vendors
        month: showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy'),
        language,
      });
      const htmlContent = response.data;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `billing-orders-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const newWindow = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          alert(t('vendor.billing.popupBlocked'));
        }
      }
    } catch (error) {
      console.error("Failed to export orders HTML:", error);
      alert(t('vendor.billing.failedToGenerateOrdersHTML'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSummaryCSV = () => {
    if (processedHouseholdSummary.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }

    const headers = [
      t('vendor.billing.household'),
      t('vendor.billing.totalOrders'),
      t('vendor.billing.ordersWithReturns'),
      t('vendor.billing.totalPurchases'),
      t('vendor.billing.totalReturns'),
      t('vendor.billing.netPurchases'),
      t('vendor.billing.amountPaid'),
      t('vendor.billing.amountDue'),
      t('vendor.billing.paymentStatus'),
    ];

    const csvData = processedHouseholdSummary.map(summary => {
      const row = [
        summary.display_name, // This already contains the display name with code
        summary.totalOrders,
        summary.ordersWithReturns,
        `₪${summary.totalPurchases.toFixed(2)}`,
        `₪${summary.totalReturns.toFixed(2)}`,
        `₪${summary.netPurchases.toFixed(2)}`,
        `₪${summary.totalPaid.toFixed(2)}`,
        `₪${summary.totalUnpaid.toFixed(2)}`,
        summary.totalUnpaid === 0 ? t('vendor.billing.fullyPaid') : t('vendor.billing.due', { amount: summary.totalUnpaid.toFixed(2) })
      ];
      return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `billing-summary-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  // New handler for HTML Summary preview
  const handleExportSummaryHTML = async () => {
    setIsExporting(true);
    try {
      const response = await exportBillingSummaryHTML({
        summary: processedHouseholdSummary,
        vendorName: vendorDetails?.name,
        month: showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy'),
        language,
      });
      const htmlContent = response.data;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `billing-summary-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const newWindow = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          alert(t('vendor.billing.popupBlocked'));
        }
      }
    } catch (error) {
      console.error("Failed to export summary HTML:", error);
      alert(t('vendor.billing.failedToGenerateSummaryHTML'));
    } finally {
      setIsExporting(false);
    }
  };

  // New function to export vendor summary as CSV
  const handleExportVendorSummaryCSV = () => {
    if (displayedVendorSummary.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }

    const headers = [
      t('vendor.billing.vendor'),
      t('vendor.billing.totalOrders'),
      t('vendor.billing.totalAmount'),
      t('vendor.billing.paidOrders'),
      t('vendor.billing.unpaidOrders'),
      t('vendor.billing.paidAmount'),
      t('vendor.billing.outstandingAmount'),
      t('vendor.billing.paymentRate')
    ].filter(Boolean);

    const csvData = displayedVendorSummary.map(vendorData => {
      const paymentRate = vendorData.totalAmount > 0 ? (vendorData.paidAmount / vendorData.totalAmount) * 100 : 0;
      return [
        vendorData.name,
        vendorData.totalOrders,
        `₪${vendorData.totalAmount.toFixed(2)}`,
        vendorData.paidOrders,
        vendorData.unpaidOrders,
        `₪${vendorData.paidAmount.toFixed(2)}`,
        `₪${vendorData.unpaidAmount.toFixed(2)}`,
        `${paymentRate.toFixed(2)}%`
      ];
    });

    const totalsRow = [
      t('vendor.billing.totals'),
      vendorSummaryTotals.totalOrders,
      `₪${vendorSummaryTotals.totalAmount.toFixed(2)}`,
      vendorSummaryTotals.paidOrders,
      vendorSummaryTotals.unpaidOrders,
      `₪${vendorSummaryTotals.paidAmount.toFixed(2)}`,
      `₪${vendorSummaryTotals.unpaidAmount.toFixed(2)}`,
      vendorSummaryTotals.totalAmount > 0 ? `${((vendorSummaryTotals.paidAmount / vendorSummaryTotals.totalAmount) * 100).toFixed(2)}%` : '0%'
    ];

    const csvContent = [
      headers.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      totalsRow.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vendor-summary-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // New function to export vendor summary as HTML
  const handleExportVendorSummaryHTML = async () => {
    setIsExporting(true);
    try {
      const vendorNameForExport = vendorDetails ? vendorDetails.name : t('common.allVendors');

      const isRTLHtml = language === 'Hebrew';
      const grandTotals = vendorSummaryTotals;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="${isRTLHtml ? 'rtl' : 'ltr'}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${vendorNameForExport} - ${t('vendor.billing.vendorSummary')} - ${showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy')}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    direction: ${isRTLHtml ? 'rtl' : 'ltr'};
                    margin: 20px;
                    font-size: 12px;
                }
                h1 {
                    text-align: center;
                    color: #333;
                    margin-bottom: 30px;
                    font-size: 24px;
                }
                .summary-stats {
                    display: flex;
                    justify-content: space-around;
                    margin-bottom: 30px;
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    flex-wrap: wrap;
                }
                .stat-item {
                    text-align: center;
                    min-width: 120px;
                    margin: 10px;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #28a745;
                }
                .stat-label {
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 12px 8px;
                    text-align: ${isRTLHtml ? 'right' : 'left'};
                    vertical-align: top;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                    font-size: 11px;
                }
                .amount { font-weight: bold; color: #28a745; }
                .unpaid-amount { color: #dc3545; }
                .total-row {
                    font-weight: bold;
                    background-color: #e9ecef;
                    border-top: 2px solid #333;
                }
                .center { text-align: center; }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 10px;
                }
                .progress-bar-container {
                    width: 80px;
                    background-color: #e0e0e0;
                    border-radius: 5px;
                    overflow: hidden;
                    margin: 0 auto;
                }
                .progress-bar {
                    height: 10px;
                    background-color: #4CAF50;
                    width: 0%;
                }
            </style>
        </head>
        <body>
            <h1>${vendorNameForExport} - ${t('vendor.billing.vendorSummary')}</h1>
            <p style="text-align: center; font-size: 16px; margin-bottom: 30px;">
                <strong>${showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy')}</strong>
            </p>

            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-value">${grandTotals.totalOrders}</div>
                    <div class="stat-label">${t('vendor.billing.totalOrders')}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₪${grandTotals.totalAmount.toFixed(2)}</div>
                    <div class="stat-label">${t('vendor.billing.totalRevenue')}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₪${grandTotals.paidAmount.toFixed(2)}</div>
                    <div class="stat-label">${t('vendor.billing.amountPaid')}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₪${grandTotals.unpaidAmount.toFixed(2)}</div>
                    <div class="stat-label">${t('vendor.billing.outstandingAmount')}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>${t('vendor.billing.vendor')}</th>
                        <th class="center">${t('vendor.billing.totalOrders')}</th>
                        <th class="center">${t('vendor.billing.totalAmount')}</th>
                        <th class="center">${t('vendor.billing.paidOrders')}</th>
                        <th class="center">${t('vendor.billing.unpaidOrders')}</th>
                        <th class="center">${t('vendor.billing.paidAmount')}</th>
                        <th class="center">${t('vendor.billing.outstandingAmount')}</th>
                        <th class="center">${t('vendor.billing.paymentRate')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayedVendorSummary.map(item => {
                        const paymentRate = item.totalAmount > 0 ? (item.paidAmount / item.totalAmount) * 100 : 0;
                        return `
                        <tr>
                            <td><strong>${item.name}</strong></td>
                            <td class="center">${item.totalOrders}</td>
                            <td class="center amount">₪${item.totalAmount.toFixed(2)}</td>
                            <td class="center">${item.paidOrders}</td>
                            <td class="center">${item.unpaidOrders}</td>
                            <td class="center amount">₪${item.paidAmount.toFixed(2)}</td>
                            <td class="center unpaid-amount">₪${item.unpaidAmount.toFixed(2)}</td>
                            <td class="center">
                                <div class="progress-bar-container">
                                    <div class="progress-bar" style="width: ${paymentRate.toFixed(0)}%;"></div>
                                </div>
                                ${paymentRate.toFixed(2)}%
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td><strong>${t('vendor.billing.totals')}</strong></td>
                        <td class="center"><strong>${grandTotals.totalOrders}</strong></td>
                        <td class="center amount"><strong>₪${grandTotals.totalAmount.toFixed(2)}</strong></td>
                        <td class="center"><strong>${grandTotals.paidOrders}</strong></td>
                        <td class="center"><strong>${grandTotals.unpaidOrders}</strong></td>
                        <td class="center amount"><strong>₪${grandTotals.paidAmount.toFixed(2)}</strong></td>
                        <td class="center unpaid-amount"><strong>₪${grandTotals.unpaidAmount.toFixed(2)}</strong></td>
                        <td class="center"><strong>${grandTotals.totalAmount > 0 ? `${((grandTotals.paidAmount / grandTotals.totalAmount) * 100).toFixed(2)}%` : '0%'}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <div class="footer">
                ${t('common.generatedOn')} ${formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss', language)}
            </div>
        </body>
        </html>
      `;
      await generatePdfFromHtml(htmlContent, `vendor-summary-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.html`);
    } catch (error) {
      console.error("Failed to export vendor summary HTML:", error);
      alert(t('vendor.billing.failedToGenerateSummaryHTML'));
    } finally {
      setIsExporting(false);
    }
  };

  // --- NEW PDF Generation Logic ---

  const generatePdfFromHtml = useCallback(async (htmlContent, filename = 'document.pdf') => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      // Apply RTL if language is Hebrew for PDF generation
      if (language === 'Hebrew') {
        tempDiv.style.direction = 'rtl';
      }

      // Important styles for print layout
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '210mm'; // A4 width
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.padding = '20mm'; // Some margin for A4
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.fontSize = '12px'; // Base font size
      document.body.appendChild(tempDiv);

      // Give some time for rendering, though html2canvas typically waits
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(tempDiv, {
        scale: 2, // Higher scale for better quality PDF
        useCORS: true,
        logging: false,
        backgroundColor: 'white',
        allowTaint: true, // Allow tainting for external images if any
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdf.internal.pageSize.getHeight(); // Move up for next page
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(filename);
      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(t('common.failedToGeneratePdf', 'Failed to generate PDF.'));
      throw error;
    }
  }, [language, t]); // Depend on language for RTL setting and t for alerts

  const handleExportOrdersPDF = async () => {
    if (processedOrders.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }
    setIsGeneratingOrdersPdf(true);
    try {
      console.log('📄 Starting Orders PDF generation...');

      // Step 1: Generate HTML content
      const dataToExport = processedOrders.map(o => ({
        ...o,
        customer_name: getCustomerName(o),
      }));

      const htmlResponse = await exportBillingOrdersHTML({
        orders: dataToExport,
        vendorName: vendorDetails?.name,
        month: showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy'),
        language,
      });

      if (!htmlResponse || !htmlResponse.data) {
        throw new Error('Failed to generate orders HTML');
      }

      const htmlContent = htmlResponse.data;
      console.log('✅ HTML content generated, length:', htmlContent.length);

      // Step 2: Convert HTML to PDF using my_html2pdf
      console.log('📄 Converting HTML to PDF using my_html2pdf...');
      const pdfResponse = await base44.functions.invoke('my_html2pdf', {
        htmlContent: htmlContent,
        filename: `billing-orders-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.pdf`,
        options: {
          format: 'A4',
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
          printBackground: true,
          displayHeaderFooter: false
        }
      });

      console.log('📄 my_html2pdf response received:', {
        hasData: !!pdfResponse?.data,
        dataType: typeof pdfResponse?.data
      });

      if (!pdfResponse || !pdfResponse.data) {
        throw new Error('PDF generation returned no data');
      }

      let pdfBase64;
      const data = pdfResponse.data;

      // Handle different response formats
      if (typeof data === 'string') {
        pdfBase64 = data;
      } else if (data.pdfBase64) {
        pdfBase64 = data.pdfBase64;
      } else {
        throw new Error('Unexpected PDF response format');
      }

      // Clean the base64 string
      pdfBase64 = pdfBase64.replace(/\s/g, '');

      console.log('✅ PDF base64 received, length:', pdfBase64.length);

      // Step 3: Download the PDF
      const pdfBlob = base64ToBlob(pdfBase64, 'application/pdf');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `billing-orders-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ Orders PDF downloaded successfully');

    } catch (error) {
      console.error('❌ Error generating orders PDF:', error);
      alert(t('vendor.billing.failedToGenerateOrdersPDF', 'Failed to generate orders PDF.'));
    } finally {
      setIsGeneratingOrdersPdf(false);
    }
  };

  const handleExportHouseholdSummaryPDF = async () => {
    if (processedHouseholdSummary.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }

    setIsGeneratingSummaryPdf(true);
    try {
      console.log('📄 Starting Summary PDF generation...');

      // Step 1: Generate HTML content
      const htmlResponse = await exportBillingSummaryHTML({
        summary: processedHouseholdSummary,
        vendorName: vendorDetails?.name,
        month: showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy'),
        language,
      });

      if (!htmlResponse || !htmlResponse.data) {
        throw new Error('Failed to generate summary HTML');
      }

      const htmlContent = htmlResponse.data;
      console.log('✅ HTML content generated, length:', htmlContent.length);

      // Step 2: Convert HTML to PDF using my_html2pdf
      console.log('📄 Converting HTML to PDF using my_html2pdf...');
      const pdfResponse = await base44.functions.invoke('my_html2pdf', {
        htmlContent: htmlContent,
        filename: `billing-summary-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.pdf`,
        options: {
          format: 'A4',
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
          printBackground: true,
          displayHeaderFooter: false
        }
      });

      console.log('📄 my_html2pdf response received:', {
        hasData: !!pdfResponse?.data,
        dataType: typeof pdfResponse?.data
      });

      if (!pdfResponse || !pdfResponse.data) {
        throw new Error('PDF generation returned no data');
      }

      let pdfBase64;
      const data = pdfResponse.data;

      // Handle different response formats
      if (typeof data === 'string') {
        pdfBase64 = data;
      } else if (data.pdfBase64) {
        pdfBase64 = data.pdfBase64;
      } else {
        throw new Error('Unexpected PDF response format');
      }

      // Clean the base64 string
      pdfBase64 = pdfBase64.replace(/\s/g, '');

      console.log('✅ PDF base64 received, length:', pdfBase64.length);

      // Step 3: Download the PDF
      const pdfBlob = base64ToBlob(pdfBase64, 'application/pdf');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `billing-summary-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ Summary PDF downloaded successfully');

    } catch (error) {
      console.error('❌ Error generating summary PDF:', error);
      alert(t('vendor.billing.pdfExportError') || 'Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingSummaryPdf(false);
    }
  };

  const handleExportVendorSummaryPDF = async () => {
    if (displayedVendorSummary.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }
    setIsGeneratingVendorSummaryPdf(true);
    try {
      const vendorNameForExport = vendorDetails ? vendorDetails.name : t('common.allVendors');
      const isRTLHtml = language === 'Hebrew';
      const grandTotals = vendorSummaryTotals;

      // Re-use the HTML generation logic from handleExportVendorSummaryHTML
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="${isRTLHtml ? 'rtl' : 'ltr'}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${vendorNameForExport} - ${t('vendor.billing.vendorSummary')} - ${showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy')}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    direction: ${isRTLHtml ? 'rtl' : 'ltr'};
                    margin: 20px;
                    font-size: 12px;
                }
                h1 {
                    text-align: center;
                    color: #333;
                    margin-bottom: 30px;
                    font-size: 24px;
                }
                .summary-stats {
                    display: flex;
                    justify-content: space-around;
                    margin-bottom: 30px;
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    flex-wrap: wrap;
                }
                .stat-item {
                    text-align: center;
                    min-width: 120px;
                    margin: 10px;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #28a745;
                }
                .stat-label {
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 12px 8px;
                    text-align: ${isRTLHtml ? 'right' : 'left'};
                    vertical-align: top;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                    font-size: 11px;
                }
                .amount { font-weight: bold; color: #28a745; }
                .unpaid-amount { color: #dc3545; }
                .total-row {
                    font-weight: bold;
                    background-color: #e9ecef;
                    border-top: 2px solid #333;
                }
                .center { text-align: center; }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 10px;
                }
                .progress-bar-container {
                    width: 80px;
                    background-color: #e0e0e0;
                    border-radius: 5px;
                    overflow: hidden;
                    margin: 0 auto;
                }
                .progress-bar {
                    height: 10px;
                    background-color: #4CAF50;
                    width: 0%;
                }
            </style>
        </head>
        <body>
            <h1>${vendorNameForExport} - ${t('vendor.billing.vendorSummary')}</h1>
            <p style="text-align: center; font-size: 16px; margin-bottom: 30px;">
                <strong>${showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy')}</strong>
            </p>

            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-value">${grandTotals.totalOrders}</div>
                    <div class="stat-label">${t('vendor.billing.totalOrders')}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₪${grandTotals.totalAmount.toFixed(2)}</div>
                    <div class="stat-label">${t('vendor.billing.totalRevenue')}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₪${grandTotals.paidAmount.toFixed(2)}</div>
                    <div class="stat-label">${t('vendor.billing.amountPaid')}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₪${grandTotals.unpaidAmount.toFixed(2)}</div>
                    <div class="stat-label">${t('vendor.billing.outstandingAmount')}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>${t('vendor.billing.vendor')}</th>
                        <th class="center">${t('vendor.billing.totalOrders')}</th>
                        <th class="center">${t('vendor.billing.totalAmount')}</th>
                        <th class="center">${t('vendor.billing.paidOrders')}</th>
                        <th class="center">${t('vendor.billing.unpaidOrders')}</th>
                        <th class="center">${t('vendor.billing.paidAmount')}</th>
                        <th class="center">${t('vendor.billing.outstandingAmount')}</th>
                        <th class="center">${t('vendor.billing.paymentRate')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayedVendorSummary.map(item => {
                        const paymentRate = item.totalAmount > 0 ? (item.paidAmount / item.totalAmount) * 100 : 0;
                        return `
                        <tr>
                            <td><strong>${item.name}</strong></td>
                            <td class="center">${item.totalOrders}</td>
                            <td class="center amount">₪${item.totalAmount.toFixed(2)}</td>
                            <td class="center">${item.paidOrders}</td>
                            <td class="center">${item.unpaidOrders}</td>
                            <td class="center amount">₪${item.paidAmount.toFixed(2)}</td>
                            <td class="center unpaid-amount">₪${item.unpaidAmount.toFixed(2)}</td>
                            <td class="center">
                                <div class="progress-bar-container">
                                    <div class="progress-bar" style="width: ${paymentRate.toFixed(0)}%;"></div>
                                </div>
                                ${paymentRate.toFixed(2)}%
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td><strong>${t('vendor.billing.totals')}</strong></td>
                        <td class="center"><strong>${grandTotals.totalOrders}</strong></td>
                        <td class="center amount"><strong>₪${grandTotals.totalAmount.toFixed(2)}</strong></td>
                        <td class="center"><strong>${grandTotals.paidOrders}</strong></td>
                        <td class="center"><strong>${grandTotals.unpaidOrders}</strong></td>
                        <td class="center amount"><strong>₪${grandTotals.paidAmount.toFixed(2)}</strong></td>
                        <td class="center unpaid-amount"><strong>₪${grandTotals.unpaidAmount.toFixed(2)}</strong></td>
                        <td class="center"><strong>${grandTotals.totalAmount > 0 ? `${((grandTotals.paidAmount / grandTotals.totalAmount) * 100).toFixed(2)}%` : '0%'}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <div class="footer">
                ${t('common.generatedOn')} ${formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss', language)}
            </div>
        </body>
        </html>
      `;
      await generatePdfFromHtml(htmlContent, `vendor-summary-${showAllMonths ? 'all-time' : format(selectedMonth, 'yyyy-MM')}.pdf`);
    } catch (error) {
      console.error("Failed to export vendor summary PDF:", error);
      alert(t('vendor.billing.failedToGenerateVendorSummaryPDF', 'Failed to generate vendor summary PDF.'));
    } finally {
      setIsGeneratingVendorSummaryPdf(false);
    }
  };

  const handleDownloadInvoicePDF = async (order) => {
    if (isGeneratingPDF === order.id) return;
    setIsGeneratingPDF(order.id);
    try {
      let household = null;
      if (order.household_id) {
          household = households.find(h => h.id === order.household_id);
      }
      const languageCode = language === 'Hebrew' ? 'he' : 'en';

      // Call backend function to generate PDF
      const response = await generateInvoicePDF({
        order,
        vendor: vendors.find(v => v.id === order.vendor_id) || vendorDetails,
        household,
        language: languageCode,
      });

      console.log('PDF Response raw:', response);
      console.log('PDF Response data type:', typeof response.data);

      // Parse the response data if it's a string - handle multiple levels of stringification
      let responseData = response.data;

      // Keep parsing while it's a string
      while (typeof responseData === 'string') {
        try {
          console.log('Attempting to parse response data...');
          const parsed = JSON.parse(responseData);
          responseData = parsed;
        } catch (e) {
          console.log('Could not parse further, breaking out of parse loop');
          break;
        }
      }

      console.log('Final parsed response data:', responseData);
      console.log('Response data type after parsing:', typeof responseData);

      if (responseData && responseData.success && responseData.pdfBase64) {
        let cleanBase64 = responseData.pdfBase64;

        console.log('Initial pdfBase64 type:', typeof cleanBase64);
        console.log('Initial pdfBase64 first 200 chars:', cleanBase64.substring(0, Math.min(cleanBase64.length, 200)));

        // If pdfBase64 is still a string that needs parsing, parse it
        while (typeof cleanBase64 === 'string' && cleanBase64.includes('{')) {
          try {
            const parsedClean = JSON.parse(cleanBase64);
            if (parsedClean.pdfBase64) {
              cleanBase64 = parsedClean.pdfBase64;
            } else {
              cleanBase64 = parsedClean; // If it was just wrapped JSON but no nested pdfBase64 key
            }
          } catch (e) {
            console.log('Could not parse cleanBase64 further, breaking out of cleanBase64 parse loop');
            break;
          }
        }

        // AGGRESSIVE CLEANING: Extract only valid base64 characters
        // Base64 alphabet: A-Z, a-z, 0-9, +, /, =
        const base64Regex = /[A-Za-z0-9+/=]+/g;
        const matches = String(cleanBase64).match(base64Regex);

        if (matches && matches.length > 0) {
          // Find the longest match (the actual base64 string)
          cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        } else {
            throw new Error('No valid base64 characters found after aggressive cleaning.');
        }

        // Remove any data URI scheme if present (e.g., "data:application/pdf;base64,")
        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }

        // Remove any whitespace or newlines
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        console.log('After aggressive cleaning - base64 length:', cleanBase64.length);
        console.log('After aggressive cleaning - first 50 chars:', cleanBase64.substring(0, Math.min(cleanBase64.length, 50)));
        console.log('After aggressive cleaning - last 50 chars:', cleanBase64.substring(Math.max(0, cleanBase64.length - 50)));

        // Validate it's proper base64 (length should be multiple of 4 after removing padding)
        const base64WithoutPadding = cleanBase64.replace(/=/g, '');
        if (base64WithoutPadding.length % 4 !== 0) {
          console.warn('Base64 string length is not a multiple of 4 (after removing padding). Length:', base64WithoutPadding.length);
          // If the length is not a multiple of 4, it might be truncated or malformed.
          // Consider adding padding if it's consistently missing or throwing an error.
          // For now, proceed, but it's a potential issue.
        }

        // Convert base64 to blob and download
        const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Invoice-${order.order_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error(responseData?.error || 'Failed to generate PDF - no valid response or pdfBase64 field found');
      }
    } catch (error) {
      console.error(`Failed to generate invoice PDF for order ${order.order_number}:`, error);
      alert(t('vendor.billing.failedToGenerateInvoicePDF', `Failed to generate invoice PDF for order ${order.order_number}.`));
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  const handleDownloadReturnNotePDF = async (order) => { // Renamed from handleDownloadReturnCreditInvoicePDF
    if (isGeneratingPDF === order.id) return;
    setIsGeneratingPDF(order.id);
    try {
      let household = null;
      if (order.household_id) {
          household = households.find(h => h.id === order.household_id);
      }
      const languageCode = language === 'Hebrew' ? 'he' : 'en';
      const response = await generateReturnInvoiceHTML({
        order,
        vendor: vendors.find(v => v.id === order.vendor_id) || vendorDetails,
        household,
        language: languageCode,
      });
      const htmlContent = response.data;
      await generatePdfFromHtml(htmlContent, `Return-Note-${order.order_number}.pdf`); // Renamed file
    } catch (error) {
      console.error(`Failed to generate return note PDF for order ${order.order_number}:`, error);
      alert(t('vendor.billing.failedToGenerateReturnInvoicePDF', `Failed to generate return note PDF for order ${order.order_number}.`));
    } finally {
      setIsGeneratingPDF(null);
    }
  };
  // --- End NEW PDF Generation Logic ---

  const handleDownloadInvoice = useCallback(async (order) => {
    setGeneratingSingleInvoice(order.id);
    try {
      let household = null;
      if (order.household_id) {
        household = households.find(h => h.id === order.household_id);
      }

      const orderVendor = (userType === 'admin' || userType === 'chief of staff')
        ? vendors.find(v => v.id === order.vendor_id)
        : vendorDetails;

      if (!orderVendor) {
        alert(t('vendor.billing.vendorNotFound'));
        return;
      }

      const response = await generateInvoicePDF({
        order,
        vendor: orderVendor,
        household,
        language: language === 'Hebrew' ? 'he' : 'en',
      });

      let responseData = response.data;
      while (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          break;
        }
      }

      if (responseData && responseData.success && responseData.pdfBase64) {
        let cleanBase64 = responseData.pdfBase64;

        const base64Regex = /[A-Za-z0-9+/=]+/g;
        const matches = String(cleanBase64).match(base64Regex);
        if (matches && matches.length > 0) {
          cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        }

        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
        link.download = `Invoice-${householdName}-${order.order_number}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(t('vendor.billing.invoiceGenerationFailed'));
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert(t('vendor.billing.invoiceGenerationError'));
    } finally {
      setGeneratingSingleInvoice(null);
    }
  }, [households, vendorDetails, vendors, userType, t, language]);

  const handleDownloadShoppedOnlyInvoice = useCallback(async (order) => {
    setGeneratingSingleInvoice(order.id);
    try {
      // Filter items to only include shopped/supplied items
      const shoppedItems = (order.items || []).filter(item => {
        const wasShoppedAndAvailable = item.shopped && item.available;
        const hasActualQuantity = item.actual_quantity !== null && item.actual_quantity !== undefined && item.actual_quantity > 0;

        return wasShoppedAndAvailable || hasActualQuantity;
      });

      if (shoppedItems.length === 0) {
        alert(t('billing.noShoppedItems', 'No shopped items in this order'));
        setGeneratingSingleInvoice(null);
        return;
      }

      // Create modified order with only shopped items
      const modifiedOrder = {
        ...order,
        items: shoppedItems
      };

      // Recalculate total based on shopped items only
      const subtotal = shoppedItems.reduce((acc, item) => {
        const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
          ? item.actual_quantity
          : (item.quantity || 0);
        return acc + (quantity * (item.price || 0));
      }, 0);

      const deliveryFee = order.delivery_price || 0;
      modifiedOrder.total_amount = subtotal + deliveryFee;

      let household = null;
      if (order.household_id) {
        household = households.find(h => h.id === order.household_id);
      }

      const orderVendor = (userType === 'admin' || userType === 'chief of staff')
        ? vendors.find(v => v.id === order.vendor_id)
        : vendorDetails;

      if (!orderVendor) {
        alert(t('vendor.billing.vendorNotFound'));
        return;
      }

      const response = await generateInvoicePDF({
        order: modifiedOrder,
        vendor: orderVendor,
        household,
        language: language === 'Hebrew' ? 'he' : 'en',
      });

      let responseData = response.data;
      while (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          break;
        }
      }

      if (responseData && responseData.success && responseData.pdfBase64) {
        let cleanBase64 = responseData.pdfBase64;

        const base64Regex = /[A-Za-z0-9+/=]+/g;
        const matches = String(cleanBase64).match(base64Regex);
        if (matches && matches.length > 0) {
          cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        }

        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
        link.download = `Invoice-${householdName}-${order.order_number}-ShoppedOnly.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(t('vendor.billing.invoiceGenerationFailed'));
      }
    } catch (error) {
      console.error('Error generating shopped-only invoice:', error);
      alert(t('vendor.billing.invoiceGenerationError'));
    } finally {
      setGeneratingSingleInvoice(null);
    }
  }, [households, vendorDetails, vendors, userType, t, language]);

  const handleDownloadShoppedOnlyConvertedInvoice = useCallback(async (order) => {
    setGeneratingSingleInvoice(order.id);
    try {
      // Filter items to only include shopped/supplied items
      const shoppedItems = (order.items || []).filter(item => {
        const wasShoppedAndAvailable = item.shopped && item.available;
        const hasActualQuantity = item.actual_quantity !== null &&
                                 item.actual_quantity !== undefined &&
                                 item.actual_quantity > 0;

        return wasShoppedAndAvailable || hasActualQuantity;
      });

      if (shoppedItems.length === 0) {
        alert(t('billing.noShoppedItems', 'No shopped items in this order'));
        setGeneratingSingleInvoice(null);
        return;
      }

      // Determine if we need to convert currency
      const originalCurrency = order.order_currency || 'ILS';
      const targetCurrency = originalCurrency === 'ILS' ? 'USD' : 'ILS';

      // Convert prices for shopped items
      const convertedShoppedItems = shoppedItems.map(item => {
        let convertedPrice = item.price;
        if (originalCurrency === 'ILS') {
          convertedPrice = item.price / ILS_TO_USD_RATE;
        } else {
          convertedPrice = item.price * ILS_TO_USD_RATE;
        }

        return {
          ...item,
          price: convertedPrice
        };
      });

      // Create modified order with converted shopped items
      const modifiedOrder = {
        ...order,
        items: convertedShoppedItems,
        order_currency: targetCurrency
      };

      // Recalculate total based on converted shopped items
      const subtotal = convertedShoppedItems.reduce((acc, item) => {
        const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
          ? item.actual_quantity
          : (item.quantity || 0);
        return acc + (quantity * (item.price || 0));
      }, 0);

      let deliveryFee = order.delivery_price || 0;
      if (originalCurrency === 'ILS') {
        deliveryFee = deliveryFee / ILS_TO_USD_RATE;
      } else {
        deliveryFee = deliveryFee * ILS_TO_USD_RATE;
      }

      modifiedOrder.delivery_price = deliveryFee;
      modifiedOrder.total_amount = subtotal + deliveryFee;

      let household = null;
      if (order.household_id) {
        household = households.find(h => h.id === order.household_id);
      }

      const orderVendor = (userType === 'admin' || userType === 'chief of staff')
        ? vendors.find(v => v.id === order.vendor_id)
        : vendorDetails;

      if (!orderVendor) {
        alert(t('vendor.billing.vendorNotFound'));
        return;
      }

      const response = await generateInvoicePDF({
        order: modifiedOrder,
        vendor: orderVendor,
        household,
        language: language === 'Hebrew' ? 'he' : 'en',
      });

      let responseData = response.data;
      while (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          break;
        }
      }

      if (responseData && responseData.success && responseData.pdfBase64) {
        let cleanBase64 = responseData.pdfBase64;

        const base64Regex = /[A-Za-z0-9+/=]+/g;
        const matches = String(cleanBase64).match(base64Regex);
        if (matches && matches.length > 0) {
          cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        }

        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
        link.download = `Invoice-${householdName}-${order.order_number}-ShoppedOnly-${targetCurrency}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(t('vendor.billing.invoiceGenerationFailed'));
      }
    } catch (error) {
      console.error('Error generating shopped-only converted invoice:', error);
      alert(t('vendor.billing.invoiceGenerationError'));
    } finally {
      setGeneratingSingleInvoice(null);
    }
  }, [households, vendorDetails, vendors, userType, ILS_TO_USD_RATE, t, language]);

  const handleBulkUpdatePricesToBase = async () => {
    // Build filter description for confirmation message
    let filterDescription = [];
    if (bulkUpdateFilters.vendor !== 'all') {
      const vendorName = vendors.find(v => v.id === bulkUpdateFilters.vendor)?.name || '';
      filterDescription.push(`${t('vendor.billing.vendor')}: ${vendorName}`);
    }
    if (bulkUpdateFilters.household !== 'all') {
      const householdName = getHouseholdDisplayName(bulkUpdateFilters.household);
      filterDescription.push(`${t('vendor.billing.household')}: ${householdName}`);
    }

    const filterText = filterDescription.length > 0
      ? `\n\n${t('vendor.billing.filters')}: ${filterDescription.join(', ')}`
      : '';

    if (!window.confirm(t('vendor.billing.confirmBulkPriceUpdate', 'This will update ALL order item prices AND delivery fees to match the current product base prices and vendor delivery fee. This action cannot be undone. Continue?') + filterText)) {
      return;
    }

    setIsUpdatingPrices(true); // Set to true for bulk operation
    setShowBulkUpdateDialog(false);

    try {
      let updatedCount = 0;
      let errorCount = 0;

      // Get all products for price lookup
      const allProducts = await Product.list();
      const productMap = new Map(allProducts.map(p => [p.id, p]));

      // Get all vendors for delivery fee lookup (optimization for bulk)
      const allVendors = await Vendor.list();
      const vendorMap = new Map(allVendors.map(v => [v.id, v]));

      // Filter orders based on bulk update filters
      let ordersToUpdate = localOrders.filter(order => {
        // Skip virtual return orders, as their prices are calculated differently
        if (order.id.toString().endsWith('-return')) return false; // Use toString() for safety

        if (bulkUpdateFilters.vendor !== 'all' && order.vendor_id !== bulkUpdateFilters.vendor) {
          return false;
        }

        if (bulkUpdateFilters.household !== 'all' && order.household_id !== bulkUpdateFilters.household) {
          return false;
        }

        return true;
      });

      // Process orders in batches
      for (const order of ordersToUpdate) {
        try {
          let hasChanges = false;

          // Update item prices
          const updatedItems = order.items.map(item => {
            const product = productMap.get(item.product_id);
            if (product && product.price_base && product.price_base !== item.price) {
              hasChanges = true;
              return { ...item, price: product.price_base };
            }
            return item;
          });

          // Update delivery price
          const orderVendor = vendorMap.get(order.vendor_id);
          const newDeliveryPrice = orderVendor?.delivery_fee || 0;
          if (newDeliveryPrice !== order.delivery_price) {
            hasChanges = true;
          }

          if (hasChanges) {
            // Recalculate total
            const newTotal = updatedItems.reduce((sum, item) => { // Corrected syntax here
              const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
                ? item.actual_quantity
                : item.quantity;
              return sum + (item.price * quantity);
            }, 0);

            const finalTotal = newTotal + newDeliveryPrice;

            await Order.update(order.id, {
              items: updatedItems,
              delivery_price: newDeliveryPrice,
              total_amount: finalTotal
            });
            updatedCount++;
          }
        } catch (error) {
          console.error(`Error updating order ${order.order_number}:`, error);
          errorCount++;
        }
      }

      if (onRefresh) {
        await onRefresh();
      }

      alert(t('vendor.billing.bulkPriceUpdateSuccess', `Successfully updated ${updatedCount} orders. ${errorCount > 0 ? `Failed: ${errorCount}` : ''}`));
    } catch (error) {
      console.error("Error during bulk price update:", error);
      alert(t('vendor.billing.bulkPriceUpdateFailed', 'Failed to update prices. Please try again.'));
    } finally {
      setIsUpdatingPrices(false); // Reset to false after bulk operation
    }
  };

  const handleUpdateSingleOrderPrices = async (order) => {
    if (!window.confirm(t('vendor.billing.confirmSinglePriceUpdate', `Update prices and delivery fee for order #${order.order_number} to match base prices?`))) {
      return;
    }

    setIsUpdatingPrices(order.id); // Set to order ID for single operation
    try {
      // Get all products for price lookup
      const allProducts = await Product.list();
      const productMap = new Map(allProducts.map(p => [p.id, p]));

      // Get vendor for delivery fee
      const orderVendor = await Vendor.get(order.vendor_id);
      const newDeliveryPrice = orderVendor?.delivery_fee || 0;

      let hasChanges = false;
      const updatedItems = order.items.map(item => {
        const product = productMap.get(item.product_id);
        if (product && product.price_base && product.price_base !== item.price) {
          hasChanges = true;
          return { ...item, price: product.price_base };
        }
        return item;
      });

      // Check if delivery price changed
      if (newDeliveryPrice !== order.delivery_price) {
        hasChanges = true;
      }

      if (hasChanges) {
        // Recalculate total
        const newTotal = updatedItems.reduce((sum, item) => { // Corrected syntax here
          const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
            ? item.actual_quantity
            : item.quantity;
          return sum + (item.price * quantity);
        }, 0);

        const finalTotal = newTotal + newDeliveryPrice;

        await Order.update(order.id, {
          items: updatedItems,
          delivery_price: newDeliveryPrice,
          total_amount: finalTotal
        });

        if (onRefresh) {
          await onRefresh();
        }

        alert(t('vendor.billing.singlePriceUpdateSuccess', 'Order prices and delivery fee updated successfully!'));
      } else {
        alert(t('vendor.billing.noPriceChanges', 'No price changes needed - all prices already match base prices.'));
      }
    } catch (error) {
      console.error(`Error updating order ${order.order_number}:`, error);
      alert(t('vendor.billing.singlePriceUpdateFailed', 'Failed to update order prices. Please try again.'));
    } finally {
      setIsUpdatingPrices(false); // Reset to false after single operation
    }
  };

  const handleViewOppositeCurrency = useCallback(async (order) => {
    const originalCurrency = order.order_currency || 'ILS';
    const targetCurrency = originalCurrency === 'USD' ? 'ILS' : 'USD';

    if (isGeneratingPDF === order.id) return;
    setIsGeneratingPDF(order.id);

    try {
      // Create a converted order object
      const convertedOrder = {
        ...order,
        order_currency: targetCurrency,
        items: order.items.map(item => ({
          ...item,
          price: originalCurrency === 'USD'
            ? item.price * ILS_TO_USD_RATE // USD to ILS
            : item.price / ILS_TO_USD_RATE // ILS to USD
        })),
        total_amount: originalCurrency === 'USD'
          ? order.total_amount * ILS_TO_USD_RATE
          : order.total_amount / ILS_TO_USD_RATE,
        delivery_price: originalCurrency === 'USD'
          ? (order.delivery_price || 0) * ILS_TO_USD_RATE
          : (order.delivery_price || 0) / ILS_TO_USD_RATE
      };

      let household = null;
      if (order.household_id) {
          household = households.find(h => h.id === order.household_id);
      }

      // IMPORTANT: Language must match target currency
      // USD = English, ILS = Hebrew
      const invoiceLanguage = targetCurrency === 'USD' ? 'en' : 'he';

      // Call backend function to generate PDF
      const response = await generateInvoicePDF({
        order: convertedOrder,
        vendor: vendors.find(v => v.id === order.vendor_id) || vendorDetails,
        household,
        language: invoiceLanguage,
      });

      let responseData = response.data;
      while (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          break;
        }
      }

      if (responseData && responseData.success && responseData.pdfBase64) {
        let cleanBase64 = responseData.pdfBase64;

        const base64Regex = /[A-Za-z0-9+/=]+/g;
        const matches = String(cleanBase64).match(base64Regex);
        if (matches && matches.length > 0) {
          cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        }

        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Invoice-${order.order_number}-${targetCurrency}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error(responseData?.error || 'Failed to generate converted PDF - no valid response or pdfBase64 field found');
      }
    } catch (error) {
      console.error('Error generating converted invoice PDF:', error);
      alert(t('vendor.billing.failedToGenerateInvoicePDF', 'Failed to generate converted invoice PDF. Please try again.'));
    } finally {
      setIsGeneratingPDF(null);
    }
  }, [ILS_TO_USD_RATE, vendorDetails, vendors, households, t, isGeneratingPDF]);


  const SortableHeader = ({ sortKey, config, setConfig, children }) => {
    const isSorted = config.key === sortKey;
    const direction = config.direction;

    const handleSort = () => {
      setConfig({
        key: sortKey,
        direction: isSorted && direction === 'asc' ? 'desc' : 'asc'
      });
    };

    return (
      <button onClick={handleSort} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900">
        {children}
        {isSorted && (direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    );
  };

  const handleDownloadAllInvoices = useCallback(async () => {
    if (processedOrders.length === 0) {
      alert(t('vendor.billing.noOrdersToExport', 'No orders to export'));
      return;
    }

    const confirmMessage = t('vendor.billing.confirmDownloadAll', `This will download ${processedOrders.length} invoices. Continue?`);
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsGeneratingAllPDFs(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < processedOrders.length; i++) {
        const order = processedOrders[i];

        // Skip virtual return orders as they are credit notes, not invoices
        if (order.id.toString().endsWith('-return')) { // Use toString() for safety
          console.log(`Skipping virtual return order ${order.order_number} for bulk invoice download.`);
          continue;
        }

        try {
          let household = null;
          if (order.household_id) {
            household = households.find(h => h.id === order.household_id);
          }

          const orderVendor = (userType === 'admin' || userType === 'chief of staff')
            ? vendors.find(v => v.id === order.vendor_id)
            : vendorDetails; // Assuming 'vendorDetails' prop is available and is the current vendor object

          if (!orderVendor) {
            console.error(`Vendor not found for order ${order.order_number}`);
            failCount++;
            continue;
          }

          const response = await generateInvoicePDF({
            order: order,
            vendor: orderVendor,
            household,
            language: language === 'Hebrew' ? 'he' : 'en', // Use component's language context
          });

          let responseData = response.data;
          while (typeof responseData === 'string') {
            try {
              responseData = JSON.parse(responseData);
            } catch (e) {
              break;
            }
          }

          if (responseData && responseData.success && responseData.pdfBase64) {
            let cleanBase64 = responseData.pdfBase64;

            const base64Regex = /[A-Za-z0-9+/=]+/g;
            const matches = String(cleanBase64).match(base64Regex);
            if (matches && matches.length > 0) {
              cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
            }

            if (cleanBase64.includes(',')) {
              cleanBase64 = cleanBase64.split(',')[1];
            }
            cleanBase64 = cleanBase64.replace(/\s/g, '');

            const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;

            // Create filename with household name and order number
            const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
            link.download = `Invoice-${householdName}-${order.order_number}.pdf`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            successCount++;

            // Small delay between downloads to prevent overwhelming the browser
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.error(`Failed to generate PDF for order ${order.order_number}`);
            failCount++;
          }
        } catch (error) {
          console.error(`Error generating invoice for order ${order.order_number}:`, error);
          failCount++;
        }
      }

      const message = t('vendor.billing.downloadAllComplete', `Downloaded ${successCount} invoices successfully. ${failCount} failed.`) || `Downloaded ${successCount} invoices successfully. ${failCount} failed.`;
      alert(message);

    } catch (error) {
      console.error('Error in bulk invoice download:', error);
      alert(t('vendor.billing.bulkDownloadError', 'An error occurred during bulk download'));
    } finally {
      setIsGeneratingAllPDFs(false);
    }
  }, [processedOrders, households, vendorDetails, vendors, userType, t, language]);

  const handleDownloadAllConvertedInvoices = useCallback(async () => {
    if (processedOrders.length === 0) {
      alert(t('vendor.billing.noOrdersToExport', 'No orders to export'));
      return;
    }

    const confirmMessage = t('vendor.billing.confirmDownloadAllConverted', `This will download ${processedOrders.length} invoices in converted currency. Continue?`);
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsGeneratingAllConvertedPDFs(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < processedOrders.length; i++) {
        const order = processedOrders[i];

        // Skip virtual return orders as they are credit notes, not invoices
        if (order.id.toString().endsWith('-return')) {
          console.log(`Skipping virtual return order ${order.order_number} for bulk converted invoice download.`);
          continue;
        }

        try {
          const originalCurrency = order.order_currency || 'ILS';
          const targetCurrency = originalCurrency === 'USD' ? 'ILS' : 'USD';

          // Create a converted order object
          const convertedOrder = {
            ...order,
            order_currency: targetCurrency,
            items: order.items.map(item => ({
              ...item,
              price: originalCurrency === 'USD'
                ? item.price * ILS_TO_USD_RATE
                : item.price / ILS_TO_USD_RATE
            })),
            total_amount: originalCurrency === 'USD'
              ? order.total_amount * ILS_TO_USD_RATE
              : order.total_amount / ILS_TO_USD_RATE,
            delivery_price: originalCurrency === 'USD'
              ? (order.delivery_price || 0) * ILS_TO_USD_RATE
              : (order.delivery_price || 0) / ILS_TO_USD_RATE
          };

          let household = null;
          if (order.household_id) {
            household = households.find(h => h.id === order.household_id);
          }

          const orderVendor = (userType === 'admin' || userType === 'chief of staff')
            ? vendors.find(v => v.id === order.vendor_id)
            : vendorDetails;

          if (!orderVendor) {
            console.error(`Vendor not found for order ${order.order_number}`);
            failCount++;
            continue;
          }

          // Language must match target currency
          const invoiceLanguage = targetCurrency === 'USD' ? 'en' : 'he';

          const response = await generateInvoicePDF({
            order: convertedOrder,
            vendor: orderVendor,
            household,
            language: invoiceLanguage,
          });

          let responseData = response.data;
          while (typeof responseData === 'string') {
            try {
              responseData = JSON.parse(responseData);
            } catch (e) {
              break;
            }
          }

          if (responseData && responseData.success && responseData.pdfBase64) {
            let cleanBase64 = responseData.pdfBase64;

            const base64Regex = /[A-Za-z0-9+/=]+/g;
            const matches = String(cleanBase64).match(base64Regex);
            if (matches && matches.length > 0) {
              cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
            }

            if (cleanBase64.includes(',')) {
              cleanBase64 = cleanBase64.split(',')[1];
            }
            cleanBase64 = cleanBase64.replace(/\s/g, '');

            const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;

            const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
            link.download = `Invoice-${householdName}-${order.order_number}-${targetCurrency}.pdf`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            successCount++;

            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.error(`Failed to generate converted PDF for order ${order.order_number}`);
            failCount++;
          }
        } catch (error) {
          console.error(`Error generating converted invoice for order ${order.order_number}:`, error);
          failCount++;
        }
      }

      const message = t('vendor.billing.downloadAllComplete', `Downloaded ${successCount} invoices successfully. ${failCount} failed.`) || `Downloaded ${successCount} invoices successfully. ${failCount} failed.`;
      alert(message);

    } catch (error) {
      console.error('Error in bulk converted invoice download:', error);
      alert(t('vendor.billing.bulkDownloadError', 'An error occurred during bulk download'));
    } finally {
      setIsGeneratingAllConvertedPDFs(false);
    }
  }, [processedOrders, households, vendorDetails, vendors, userType, ILS_TO_USD_RATE, t]);

  const handleDownloadShoppedOnlyInvoices = useCallback(async () => {
    if (processedOrders.length === 0) {
      alert(t('billing.noOrdersToExport', 'No orders to export'));
      return;
    }

    const confirmMessage = t('billing.confirmDownloadShoppedOnly', `This will download invoices with only supplied items. Continue?`) || `This will download invoices with only supplied items. Continue?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsGeneratingShoppedOnlyPDFs(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < processedOrders.length; i++) {
        const order = processedOrders[i];

        // Skip virtual return orders as they are credit notes, not invoices
        if (order.id.toString().endsWith('-return')) {
          console.log(`Skipping virtual return order ${order.order_number} for bulk shopped-only invoice download.`);
          continue;
        }

        try {
          // Filter items to only include shopped/supplied items
          const shoppedItems = (order.items || []).filter(item => {
            const wasShoppedAndAvailable = item.shopped && item.available;
            const hasActualQuantity = item.actual_quantity !== null && item.actual_quantity !== undefined && item.actual_quantity > 0;

            // Include item if either:
            // 1. It was marked as shopped AND available
            // 2. It has an actual_quantity > 0 (meaning it was delivered)
            return wasShoppedAndAvailable || hasActualQuantity;
          });

          // Skip orders with no shopped items
          if (shoppedItems.length === 0) {
            console.log(`Skipping order ${order.order_number} - no shopped items`);
            continue;
          }

          // Create modified order with only shopped items
          const modifiedOrder = {
            ...order,
            items: shoppedItems
          };

          // Recalculate total based on shopped items only
          const subtotal = shoppedItems.reduce((acc, item) => {
            const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
              ? item.actual_quantity
              : (item.quantity || 0);
            return acc + (quantity * (item.price || 0));
          }, 0);

          const deliveryFee = order.delivery_price || 0;
          modifiedOrder.total_amount = subtotal + deliveryFee;

          let household = null;
          if (order.household_id) {
            household = households.find(h => h.id === order.household_id);
          }

          const orderVendor = (userType === 'admin' || userType === 'chief of staff')
            ? vendors.find(v => v.id === order.vendor_id)
            : vendorDetails; // Using the 'vendorDetails' prop directly for non-admin

          if (!orderVendor) {
            console.error(`Vendor not found for order ${order.order_number}`);
            failCount++;
            continue;
          }

          // Language for the invoice
          const invoiceLanguage = language === 'Hebrew' ? 'he' : 'en';

          const response = await generateInvoicePDF({
            order: modifiedOrder,
            vendor: orderVendor,
            household,
            language: invoiceLanguage,
          });

          let responseData = response.data;
          while (typeof responseData === 'string') {
            try {
              responseData = JSON.parse(responseData);
            } catch (e) {
              break;
            }
          }

          if (responseData && responseData.success && responseData.pdfBase64) {
            let cleanBase64 = responseData.pdfBase64;

            const base64Regex = /[A-Za-z0-9+/=]+/g;
            const matches = String(cleanBase64).match(base64Regex);
            if (matches && matches.length > 0) {
              cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
            }

            if (cleanBase64.includes(',')) {
              cleanBase64 = cleanBase64.split(',')[1];
            }
            cleanBase64 = cleanBase64.replace(/\s/g, '');

            const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;

            const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
            link.download = `Invoice-${householdName}-${order.order_number}-ShoppedOnly.pdf`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            successCount++;

            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.error(`Failed to generate PDF for order ${order.order_number}`);
            failCount++;
          }
        } catch (error) {
          console.error(`Error generating invoice for order ${order.order_number}:`, error);
          failCount++;
        }
      }

      const message = t('billing.downloadAllComplete', `Downloaded ${successCount} invoices successfully. ${failCount} failed.`) || `Downloaded ${successCount} invoices successfully. ${failCount} failed.`;
      alert(message);

    } catch (error) {
      console.error('Error in bulk shopped-only invoice download:', error);
      alert(t('billing.bulkDownloadError', 'An error occurred during bulk download'));
    } finally {
      setIsGeneratingShoppedOnlyPDFs(false);
    }
  }, [processedOrders, households, vendorDetails, vendors, userType, t, language]);

  const handleDownloadShoppedOnlyConvertedInvoices = useCallback(async () => {
    if (processedOrders.length === 0) {
      alert(t('billing.noOrdersToExport', 'No orders to export'));
      return;
    }

    const confirmMessage = t('billing.confirmDownloadShoppedOnlyConverted', `This will download ${processedOrders.length} invoices with only supplied items in converted currency. Continue?`) || `This will download ${processedOrders.length} invoices with only supplied items in converted currency. Continue?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsGeneratingShoppedOnlyConvertedPDFs(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < processedOrders.length; i++) {
        const order = processedOrders[i];

        // Skip virtual return orders as they are credit notes, not invoices
        if (order.id.toString().endsWith('-return')) {
          console.log(`Skipping virtual return order ${order.order_number} for bulk shopped-only converted invoice download.`);
          continue;
        }

        try {
          // Filter items to only include shopped/supplied items
          const shoppedItems = (order.items || []).filter(item => {
            const wasShoppedAndAvailable = item.shopped && item.available;
            const hasActualQuantity = item.actual_quantity !== null && item.actual_quantity !== undefined && item.actual_quantity > 0;

            return wasShoppedAndAvailable || hasActualQuantity;
          });

          // Skip orders with no shopped items
          if (shoppedItems.length === 0) {
            console.log(`Skipping order ${order.order_number} - no shopped items`);
            continue;
          }

          // Determine if we need to convert currency
          const originalCurrency = order.order_currency || 'ILS';
          const targetCurrency = originalCurrency === 'ILS' ? 'USD' : 'ILS';

          // Convert prices for shopped items
          const convertedShoppedItems = shoppedItems.map(item => {
            let convertedPrice = item.price;
            if (originalCurrency === 'ILS') {
              convertedPrice = item.price / ILS_TO_USD_RATE;
            } else {
              convertedPrice = item.price * ILS_TO_USD_RATE;
            }

            return {
              ...item,
              price: convertedPrice
            };
          });

          // Create modified order with converted shopped items
          const modifiedOrder = {
            ...order,
            items: convertedShoppedItems,
            order_currency: targetCurrency
          };

          // Recalculate total based on converted shopped items
          const subtotal = convertedShoppedItems.reduce((acc, item) => {
            const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
              ? item.actual_quantity
              : (item.quantity || 0);
            return acc + (quantity * (item.price || 0));
          }, 0);

          let deliveryFee = order.delivery_price || 0;
          if (originalCurrency === 'ILS') {
            deliveryFee = deliveryFee / ILS_TO_USD_RATE;
          } else {
            deliveryFee = deliveryFee * ILS_TO_USD_RATE;
          }

          modifiedOrder.delivery_price = deliveryFee;
          modifiedOrder.total_amount = subtotal + deliveryFee;

          let household = null;
          if (order.household_id) {
            household = households.find(h => h.id === order.household_id);
          }

          const orderVendor = (userType === 'admin' || userType === 'chief of staff')
            ? vendors.find(v => v.id === order.vendor_id)
            : vendorDetails; // Use the 'vendorDetails' prop directly for non-admin

          if (!orderVendor) {
            console.error(`Vendor not found for order ${order.order_number}`);
            failCount++;
            continue;
          }

          // Language must match target currency
          const invoiceLanguage = targetCurrency === 'USD' ? 'en' : 'he';

          const response = await generateInvoicePDF({
            order: modifiedOrder,
            vendor: orderVendor,
            household,
            language: invoiceLanguage,
          });

          let responseData = response.data;
          while (typeof responseData === 'string') {
            try {
              responseData = JSON.parse(responseData);
            } catch (e) {
              break;
            }
          }

          if (responseData && responseData.success && responseData.pdfBase64) {
            let cleanBase64 = responseData.pdfBase64;

            const base64Regex = /[A-Za-z0-9+/=]+/g;
            const matches = String(cleanBase64).match(base64Regex);
            if (matches && matches.length > 0) {
              cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
            }

            if (cleanBase64.includes(',')) {
              cleanBase64 = cleanBase64.split(',')[1];
            }
            cleanBase64 = cleanBase64.replace(/\s/g, '');

            const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;

            const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Customer';
            link.download = `Invoice-${householdName}-${order.order_number}-ShoppedOnly-${targetCurrency}.pdf`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            successCount++;

            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.error(`Failed to generate PDF for order ${order.order_number}`);
            failCount++;
          }
        } catch (error) {
          console.error(`Error generating invoice for order ${order.order_number}:`, error);
          failCount++;
        }
      }

      const message = t('billing.downloadAllComplete', `Downloaded ${successCount} invoices successfully. ${failCount} failed.`) || `Downloaded ${successCount} invoices successfully. ${failCount} failed.`;
      alert(message);

    } catch (error) {
      console.error('Error in bulk shopped-only converted invoice download:', error);
      alert(t('billing.bulkDownloadError', 'An error occurred during bulk download'));
    } finally {
      setIsGeneratingShoppedOnlyConvertedPDFs(false);
    }
  }, [processedOrders, households, vendorDetails, vendors, userType, ILS_TO_USD_RATE, t]);

  const handleDownloadReturnNote = useCallback(async (order) => {
    // Check if order has any returned items
    const hasReturnedItems = (order.items || []).some(item =>
      item.is_returned === true &&
      item.amount_returned !== null &&
      item.amount_returned !== undefined &&
      item.amount_returned > 0
    );

    if (!hasReturnedItems) {
      alert(t('billing.noReturnedItems', 'This order has no returned items'));
      return;
    }

    setGeneratingReturnNote(order.id);
    try {
      let household = null;
      if (order.household_id) {
        household = households.find(h => h.id === order.household_id);
      }

      const orderVendor = (userType === 'admin' || userType === 'chief of staff')
        ? vendors.find(v => v.id === order.vendor_id)
        : vendorDetails;

      if (!orderVendor) {
        alert(t('vendor.billing.vendorNotFound'));
        return;
      }

      const response = await generateReturnInvoiceHTML({
        order,
        vendor: orderVendor,
        household,
        language: language === 'Hebrew' ? 'he' : 'en', // Use component's language context
      });

      const htmlContent = response.data;

      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      } else {
        alert(t('common.popupBlocked', 'Popup blocked! Please allow popups for this site.'));
      }
    } catch (error) {
      console.error('Error generating return note:', error);
      alert(t('vendor.billing.returnNoteGenerationError', 'Failed to generate return note. Please try again.'));
    } finally {
      setGeneratingReturnNote(null);
    }
  }, [households, vendorDetails, vendors, userType, t, language]);

  const handleDownloadCombinedHouseholdInvoices = useCallback(async () => {
    if (!selectedHouseholdForCombined) {
      alert(t('billing.selectHousehold', 'Please select a household'));
      return;
    }

    setIsGeneratingCombinedPDF(true);
    try {
      const response = await base44.functions.invoke('generateCombinedHouseholdInvoices', {
        householdId: selectedHouseholdForCombined,
        vendorId: selectedVendorForCombined !== 'all' ? selectedVendorForCombined : null,
        language: language === 'Hebrew' ? 'he' : 'en'
      });

      let responseData = response.data;
      while (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          break;
        }
      }

      if (responseData && responseData.success && responseData.pdfBase64) {
        let cleanBase64 = responseData.pdfBase64;

        const base64Regex = /[A-Za-z0-9+/=]+/g;
        const matches = String(cleanBase64).match(base64Regex);
        if (matches && matches.length > 0) {
          cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        }

        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const household = households.find(h => h.id === selectedHouseholdForCombined);
        const householdName = household ? (household.name || 'Household').replace(/[^a-zA-Z0-9]/g, '_') : 'Household';
        link.download = `Combined-Invoices-${householdName}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(t('billing.combinedInvoiceGenerationFailed', 'Failed to generate combined invoices'));
      }
    } catch (error) {
      console.error('Error generating combined household invoices:', error);
      alert(t('billing.combinedInvoiceError', 'Error generating combined invoices'));
    } finally {
      setIsGeneratingCombinedPDF(false);
    }
  }, [selectedHouseholdForCombined, selectedVendorForCombined, households, t, language]);

  const handleDownloadCombinedHouseholdInvoicesConverted = useCallback(async () => {
    if (!selectedHouseholdForCombined) {
      alert(t('billing.selectHousehold', 'Please select a household'));
      return;
    }

    setIsGeneratingCombinedConvertedPDF(true);
    try {
      const response = await base44.functions.invoke('generateCombinedHouseholdInvoices', {
        householdId: selectedHouseholdForCombined,
        vendorId: selectedVendorForCombined !== 'all' ? selectedVendorForCombined : null,
        convertToUSD: true,
        language: 'en' // Always English for USD invoices
      });

      let responseData = response.data;
      while (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          break;
        }
      }

      if (responseData && responseData.success && responseData.pdfBase64) {
        let cleanBase64 = responseData.pdfBase64;

        const base64Regex = /[A-Za-z0-9+/=]+/g;
        const matches = String(cleanBase64).match(base64Regex);
        if (matches && matches.length > 0) {
          cleanBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        }

        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }
        cleanBase64 = cleanBase64.replace(/\s/g, '');

        const pdfBlob = base64ToBlob(cleanBase64, 'application/pdf');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        const household = households.find(h => h.id === selectedHouseholdForCombined);
        const householdName = household ? (household.name || 'Household').replace(/[^a-zA-Z0-9]/g, '_') : 'Household';
        link.download = `Combined-Invoices-${householdName}-USD.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(t('billing.combinedInvoiceGenerationFailed', 'Failed to generate combined invoices'));
      }
    } catch (error) {
      console.error('Error generating combined household invoices (converted):', error);
      alert(t('billing.combinedInvoiceError', 'Error generating combined invoices'));
    } finally {
      setIsGeneratingCombinedConvertedPDF(false);
    }
  }, [selectedHouseholdForCombined, selectedVendorForCombined, households, t]);

  const handleDownloadReturnNoteConverted = useCallback(async (order) => {
    // Check if order has any returned items
    const hasReturnedItems = (order.items || []).some(item =>
      item.is_returned === true &&
      item.amount_returned !== null &&
      item.amount_returned !== undefined &&
      item.amount_returned > 0
    );

    if (!hasReturnedItems) {
      alert(t('billing.noReturnedItems', 'This order has no returned items'));
      return;
    }

    setGeneratingReturnNote(order.id);
    try {
      // Determine if we need to convert currency
      const originalCurrency = order.order_currency || 'ILS';
      const targetCurrency = originalCurrency === 'ILS' ? 'USD' : 'ILS';

      // Convert prices for all items
      const convertedItems = (order.items || []).map(item => {
        let convertedPrice = item.price;
        if (originalCurrency === 'ILS') {
          convertedPrice = item.price / ILS_TO_USD_RATE;
        } else {
          convertedPrice = item.price * ILS_TO_USD_RATE;
        }

        return {
          ...item,
          price: convertedPrice
        };
      });

      // Create modified order with converted items and currency
      const modifiedOrder = {
        ...order,
        items: convertedItems,
        order_currency: targetCurrency
      };

      // Convert delivery fee
      let deliveryFee = order.delivery_price || 0;
      if (originalCurrency === 'ILS') {
        deliveryFee = deliveryFee / ILS_TO_USD_RATE;
      } else {
        deliveryFee = deliveryFee * ILS_TO_USD_RATE;
      }
      modifiedOrder.delivery_price = deliveryFee;

      let household = null;
      if (order.household_id) {
        household = households.find(h => h.id === order.household_id);
      }

      const orderVendor = (userType === 'admin' || userType === 'chief of staff')
        ? vendors.find(v => v.id === order.vendor_id)
        : vendorDetails;

      if (!orderVendor) {
        alert(t('vendor.billing.vendorNotFound'));
        return;
      }

      // Generate HTML first
      const htmlResponse = await generateReturnInvoiceHTML({
        order: modifiedOrder,
        vendor: orderVendor,
        household,
        language: language === 'Hebrew' ? 'he' : 'en',
      });

      const htmlContent = htmlResponse.data;

      // Convert HTML to PDF
      await generatePdfFromHtml(htmlContent, `Return-Note-${order.order_number}-${targetCurrency}.pdf`);
    } catch (error) {
      console.error('Error generating converted return note PDF:', error);
      alert(t('vendor.billing.returnNoteGenerationError', 'Failed to generate converted return note PDF. Please try again.'));
    } finally {
      setGeneratingReturnNote(null);
    }
  }, [households, vendorDetails, vendors, userType, ILS_TO_USD_RATE, t, language, generatePdfFromHtml]);


  const handleCalculateTotals = useCallback(() => {
    if (processedOrders.length === 0) {
      alert(t('billing.noOrdersToCalculate', 'No orders to calculate'));
      return;
    }

    // Initialize totals
    let totalILS = 0;
    let totalUSD = 0;
    let ordersByOriginalCurrency = {
      ILS: { count: 0, total: 0 },
      USD: { count: 0, total: 0 }
    };

    // Calculate totals - MATCHING INVOICE LOGIC EXACTLY
    processedOrders.forEach(order => {
      const currency = order.order_currency || 'ILS';

      // Calculate subtotal from items - SAME AS INVOICE
      const subtotal = (order.items || []).reduce((acc, item) => {
        // Use actual_quantity if available, otherwise quantity - SAME AS INVOICE
        const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
          ? item.actual_quantity
          : (item.quantity || 0);
        return acc + (quantity * (item.price || 0));
      }, 0);

      // Add delivery fee - SAME AS INVOICE
      const deliveryFee = order.delivery_price || 0;

      // Grand total = subtotal + delivery - SAME AS INVOICE
      const grandTotal = subtotal + deliveryFee;

      // Note: VAT is already included in the prices, so grandTotal is the final amount
      // This matches the invoice where grandTotal = total (prices are VAT inclusive)

      // Track by original currency
      ordersByOriginalCurrency[currency].count++;
      ordersByOriginalCurrency[currency].total += grandTotal;

      // Convert everything to both currencies
      if (currency === 'USD') {
        totalUSD += grandTotal;
        totalILS += grandTotal * ILS_TO_USD_RATE;
      } else {
        totalILS += grandTotal;
        totalUSD += grandTotal / ILS_TO_USD_RATE;
      }
    });

    setCalculatedTotals({
      totalOrders: processedOrders.length,
      totalILS,
      totalUSD,
      ilsOrders: ordersByOriginalCurrency.ILS,
      usdOrders: ordersByOriginalCurrency.USD
    });
    setShowTotalsDialog(true);
  }, [processedOrders, ILS_TO_USD_RATE, t]);

  const handleCalculateShoppedTotals = useCallback(() => {
    if (processedOrders.length === 0) {
      alert(t('billing.noOrdersToCalculate', 'No orders to calculate'));
      return;
    }

    // Initialize totals
    let totalILS = 0;
    let totalUSD = 0;
    let ordersByOriginalCurrency = {
      ILS: { count: 0, total: 0, itemsCount: 0 },
      USD: { count: 0, total: 0, itemsCount: 0 }
    };

    // Calculate totals - ONLY FOR SHOPPED ITEMS
    processedOrders.forEach(order => {
      const currency = order.order_currency || 'ILS';

      // Calculate subtotal from items - ONLY SHOPPED/AVAILABLE ITEMS
      let orderSubtotal = 0;
      let shoppedItemsCount = 0;

      (order.items || []).forEach(item => {
        // Only include items that were actually shopped and available
        const wasShoppedAndAvailable = item.shopped && item.available;
        const hasActualQuantity = item.actual_quantity !== null && item.actual_quantity !== undefined && item.actual_quantity > 0;

        // Include item if either:
        // 1. It was marked as shopped AND available
        // 2. It has an actual_quantity > 0 (meaning it was delivered)
        if (wasShoppedAndAvailable || hasActualQuantity) {
          const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
            ? item.actual_quantity
            : (item.quantity || 0);

          if (quantity > 0) {
            orderSubtotal += quantity * (item.price || 0);
            shoppedItemsCount++;
          }
        }
      });

      // Only count orders that have at least one shopped item
      if (shoppedItemsCount > 0) {
        // Add delivery fee only if there were shopped items
        const deliveryFee = order.delivery_price || 0;

        // Grand total = subtotal + delivery
        const grandTotal = orderSubtotal + deliveryFee;

        // Track by original currency
        ordersByOriginalCurrency[currency].count++;
        ordersByOriginalCurrency[currency].total += grandTotal;
        ordersByOriginalCurrency[currency].itemsCount += shoppedItemsCount;

        // Convert everything to both currencies
        if (currency === 'USD') {
          totalUSD += grandTotal;
          totalILS += grandTotal * ILS_TO_USD_RATE;
        } else {
          totalILS += grandTotal;
          totalUSD += grandTotal / ILS_TO_USD_RATE;
        }
      }
    });

    setCalculatedShoppedTotals({
      totalOrders: ordersByOriginalCurrency.ILS.count + ordersByOriginalCurrency.USD.count,
      totalILS,
      totalUSD,
      ilsOrders: ordersByOriginalCurrency.ILS,
      usdOrders: ordersByOriginalCurrency.USD
    });
    setShowShoppedTotalsDialog(true);
  }, [processedOrders, ILS_TO_USD_RATE, t]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('vendor.billing.title')}</h2>
          <p className="text-sm text-gray-600">{t('vendor.billing.description')}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {(userType === 'admin') && (
            <Button
              onClick={() => setShowBulkUpdateDialog(true)}
              disabled={isUpdatingPrices !== false} // Disable if any update (bulk or single) is active
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isUpdatingPrices === true ? ( // Check explicitly for bulk operation
                <>
                  <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t('vendor.billing.updatingPrices', 'Updating...')}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  {t('vendor.billing.updatePricesToBase', 'Update All Prices to Base')}
                </>
              )}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-50"/>
            <Select value={selectedHouseholdFilter} onValueChange={setSelectedHouseholdFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('vendor.billing.filterByHousehold')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('vendor.billing.allHouseholds')}</SelectItem>
                {households.map(h => (
                  <SelectItem key={h.id} value={h.id}>{getHouseholdDisplayName(h.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(userType === 'admin'||userType === "chief of staff") && ( // New: Vendor filter for admin
            <div className="flex items-center gap-2">
              <Select value={selectedVendorFilter} onValueChange={setSelectedVendorFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('vendor.billing.filterByVendor')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('vendor.billing.allVendors')}</SelectItem>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleMonthChange('prev')} disabled={showAllMonths}>
              ←
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {showAllMonths ? t('vendor.billing.allTime') : format(selectedMonth, 'MMMM yyyy')}
            </span>
            <Button variant="outline" onClick={() => handleMonthChange('next')} disabled={showAllMonths}>
              →
            </Button>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
             <Switch
                id="show-all-months"
                checked={showAllMonths}
                onCheckedChange={setShowAllMonths}
              />
              <Label htmlFor="show-all-months" className="text-sm font-normal">{t('vendor.billing.showAllMonths')}</Label>
          </div>
        </div>
      </div>

      {/* Bulk Update Dialog */}
      <Dialog open={showBulkUpdateDialog} onOpenChange={setShowBulkUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('vendor.billing.bulkUpdateFilters', 'Bulk Price Update Filters')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              {t('vendor.billing.bulkUpdateDescription', 'Select which orders to update. Leave as "All" to update all orders.')}
            </p>

            {(userType === 'admin' || userType === 'chief of staff') && (
              <div>
                <Label>{t('vendor.billing.filterByVendor')}</Label>
                <Select
                  value={bulkUpdateFilters.vendor}
                  onValueChange={(value) => setBulkUpdateFilters(prev => ({ ...prev, vendor: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('vendor.billing.allVendors')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('vendor.billing.allVendors')}</SelectItem>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>{t('vendor.billing.filterByHousehold')}</Label>
              <Select
                value={bulkUpdateFilters.household}
                onValueChange={(value) => setBulkUpdateFilters(prev => ({ ...prev, household: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('vendor.billing.allHouseholds')} />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('vendor.billing.allHouseholds')}</SelectItem>
                  {households.map(h => (
                    <SelectItem key={h.id} value={h.id}>{getHouseholdDisplayName(h.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <p className="font-semibold">{t('common.warning', 'Warning')}:</p>
              <p>{t('vendor.billing.bulkUpdateWarning', 'This will update prices and delivery fees for all matching orders. This cannot be undone.')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkUpdateDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleBulkUpdatePricesToBase}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={isUpdatingPrices !== false}
            >
              {t('vendor.billing.updatePrices', 'Update Prices')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Combined Household Invoices Card */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Home className="w-5 h-5" />
            {t('billing.combinedHouseholdInvoices', 'Combined Household Invoices')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Select value={selectedHouseholdForCombined} onValueChange={setSelectedHouseholdForCombined}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('billing.selectHousehold', 'Select a household')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('billing.allHouseholds', 'All Households')}</SelectItem>
                  {households.map(h => (
                    <SelectItem key={h.id} value={h.id}>
                      {getHouseholdDisplayName(h.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedVendorForCombined} onValueChange={setSelectedVendorForCombined}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('billing.selectVendor', 'Select vendor')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('billing.allVendors', 'All Vendors')}</SelectItem>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {language === 'Hebrew' && v.name_hebrew ? v.name_hebrew : v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleDownloadCombinedHouseholdInvoices}
                disabled={!selectedHouseholdForCombined || isGeneratingCombinedPDF || isGeneratingCombinedConvertedPDF}
                className="bg-green-600 hover:bg-green-700"
              >
                {isGeneratingCombinedPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t('common.generating', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                    {t('billing.downloadCombined', 'Download Combined PDF')}
                  </>
                )}
              </Button>
              <Button 
                onClick={handleDownloadCombinedHouseholdInvoicesConverted}
                disabled={!selectedHouseholdForCombined || isGeneratingCombinedPDF || isGeneratingCombinedConvertedPDF}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGeneratingCombinedConvertedPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t('common.generating', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                    {t('billing.downloadCombinedConverted', 'Download Combined ($)')}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {t('billing.combinedInvoiceDescription', 'Downloads all shopped-only invoices for selected household with summary page')}
              <br />
              {t('billing.filterOptional', 'Filters are optional - select "All" to include all households/vendors')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SKU Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <FileText className="w-5 h-5" />
            {t('billing.searchBySKU', 'Search Orders by SKU')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder={t('billing.enterSKU', 'Enter SKU')}
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchBySKU()}
              className="flex-1"
            />
            <Button onClick={handleSearchBySKU} className="bg-blue-600 hover:bg-blue-700">
              {t('common.search', 'Search')}
            </Button>
          </div>

          {skuSearchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {skuSearchResults.map((result, index) => {
                const fullOrder = processedOrders.find(o => o.order_number === result.order_number);
                return (
                  <div 
                    key={index} 
                    className="p-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => fullOrder && setViewingOrder(fullOrder)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-blue-600">{result.order_number}</p>
                        <p className="text-sm text-gray-600">{result.household_name}</p>
                        <p className="text-xs text-gray-500">
                          {result.item && `${language === 'Hebrew' && result.item.product_name_hebrew ? result.item.product_name_hebrew : result.item.product_name} - ${t('billing.quantity', 'Qty')}: ${result.item.quantity}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(result.status)}>
                          {getStatusLabel(result.status)}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(new Date(result.date), "MMM d", language)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {skuSearchResults.length === 0 && skuSearch && (
            <p className="text-sm text-gray-500 text-center py-4">
              {t('billing.noOrdersFoundForSKU', 'No orders found for this SKU')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Status Overview */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">{t('vendor.billing.deliveredOrders')}</h4>
              <p className="text-2xl font-bold text-green-600">
                {localOrders?.filter(o => o.status === 'delivered').length || 0}
              </p>
              <p className="text-sm text-green-600">
                ₪{(localOrders?.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">{t('vendor.billing.inTransit')}</h4>
              <p className="text-2xl font-bold text-yellow-600">
                {localOrders?.filter(o => o.status === 'delivery').length || 0}
              </p>
              <p className="text-sm text-yellow-600">
                ₪{(localOrders?.filter(o => o.status === 'delivery').reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">{t('vendor.billing.totalShippedRevenue')}</h4>
              <p className="text-2xl font-bold text-blue-600">
                {(localOrders?.filter(o => o.status === 'delivery' || o.status === 'delivered').length || 0)}
              </p>
              <p className="text-sm text-blue-600">
                ₪{(localOrders?.filter(o => o.status === 'delivery' || o.status === 'delivered').reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0).toFixed(2)}
              </p>
            </div>
          </div>


      {/* Orders Table with Tabs */}
      <Card>
        <CardHeader>
          <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <DollarSign className="w-5 h-5" />
              {t('vendor.billing.ordersAndSummary')}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap"> {/* Added flex for buttons */}
             {/*
              <Button
                onClick={handleCalculateTotals}
                disabled={processedOrders.length === 0}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <Calculator className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                {t('billing.calculateTotals', 'Calculate All Totals')}
              </Button>
              */}
                <Button
                  onClick={handleCalculateShoppedTotals}
                  disabled={processedOrders.length === 0}
                  variant="outline"
                  // Shows a small browser tooltip after hovering for a second
                  title={t('billing.hoverText', 'Click to sum up only items marked as shopped')} 
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Calculator className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  {t('billing.calculateShoppedTotals', 'Calculate Shopped Only')}
                </Button>
                 <Button
                variant="outline"
                size="sm"
                onClick={handleExportProductAggregation}
                disabled={processedOrders.length === 0}
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('billing.exportProductAggregation', 'Product Aggregation')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportOrderComparison}
                disabled={processedOrders.length === 0}
                className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
              >
                <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('billing.exportOrderComparison', 'Order Comparison')}
              </Button>
              {/*
              <Button
                onClick={handleDownloadAllInvoices}
                disabled={isGeneratingAllPDFs || isGeneratingAllConvertedPDFs || isGeneratingShoppedOnlyPDFs || isGeneratingShoppedOnlyConvertedPDFs || processedOrders.filter(o => !o.id.toString().endsWith('-return')).length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGeneratingAllPDFs ? (
                  <>
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t('billing.generatingAll', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                    {t('billing.downloadAllInvoices', 'Download All')} ({processedOrders.filter(o => !o.id.toString().endsWith('-return')).length})
                  </>
                )}
              </Button>
              <Button
                onClick={handleDownloadAllConvertedInvoices}
                disabled={isGeneratingAllPDFs || isGeneratingAllConvertedPDFs || isGeneratingShoppedOnlyPDFs || isGeneratingShoppedOnlyConvertedPDFs || processedOrders.filter(o => !o.id.toString().endsWith('-return')).length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGeneratingAllConvertedPDFs ? (
                  <>
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t('billing.generatingAll', 'Generating...')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                    {t('billing.downloadAllConverted', 'Download All (Converted)')} ({processedOrders.filter(o => !o.id.toString().endsWith('-return')).length})
                  </>
                )}
              </Button>
              */}
              <Button
                onClick={handleDownloadShoppedOnlyInvoices}
                disabled={isGeneratingAllPDFs || isGeneratingAllConvertedPDFs || isGeneratingShoppedOnlyPDFs || isGeneratingShoppedOnlyConvertedPDFs || processedOrders.length === 0}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isGeneratingShoppedOnlyPDFs ? (
                  <>
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t('billing.generatingAll', 'Generating...')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                    {t('billing.downloadShoppedOnly', 'Shopped Only')} ({processedOrders.length})
                  </>
                )}
              </Button>
              <Button
                onClick={handleDownloadShoppedOnlyConvertedInvoices}
                disabled={isGeneratingAllPDFs || isGeneratingAllConvertedPDFs || isGeneratingShoppedOnlyPDFs || isGeneratingShoppedOnlyConvertedPDFs || processedOrders.length === 0}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isGeneratingShoppedOnlyConvertedPDFs ? (
                  <>
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t('billing.generatingAll', 'Generating...')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                    {t('billing.downloadShoppedOnlyConverted', 'Shopped Only ($)')} ({processedOrders.length})
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600">
                {t('vendor.billing.showingOrders', {count: processedOrders.length, total: billableOrders.length})}
              </span>
              {isLoadingOrders && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
              {hasMoreOrders && !isLoadingOrders && (
                <Button onClick={loadMoreOrders} variant="outline" size="sm">
                  {t('common.loadMore', 'Load More')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {(userType === 'admin'||userType === "chief of staff") && <TabsTrigger value="vendor summary">{t('vendor.billing.vendorSummary')}</TabsTrigger>}
              <TabsTrigger value="orders">{t('vendor.billing.allOrders')}</TabsTrigger>
              <TabsTrigger value="households">{t('vendor.billing.householdSummary')}</TabsTrigger>
            </TabsList>
             {(userType === 'admin'||userType === "chief of staff") && (
                <TabsContent value="vendor summary" className="mt-4">
                  <Card>
                    <CardHeader>
                      <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                        <div>
                          <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <TrendingUp className="w-5 h-5" />
                            {t('vendor.billing.vendorSummary')}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            {t('vendor.billing.vendorSummaryDescription', 'Breakdown by household for this vendorDetails')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportVendorSummaryCSV}
                            disabled={isExporting}
                          >
                            <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            {t('vendor.billing.exportCSV')}
                          </Button>
                        {userType==='admin'&&  <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportVendorSummaryHTML}
                            disabled={isExporting}
                          >
                            <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            HTML
                          </Button>}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportVendorSummaryPDF}
                            disabled={isGeneratingVendorSummaryPdf}
                          >
                            {isGeneratingVendorSummaryPdf ? (
                              <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            )}
                            {t('vendor.billing.exportPDF')}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="name" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.vendor')}</SortableHeader></th>
                              <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="totalOrders" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.totalOrders')}</SortableHeader></th>
                              <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="totalAmount" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.totalAmount')}</SortableHeader></th>
                              <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="paidAmount" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.amountPaid')}</SortableHeader></th>
                              <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="unpaidAmount" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.outstandingAmount')}</SortableHeader></th>
                              <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="paymentRate" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.paymentRate')}</SortableHeader></th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedVendorSummary.length > 0 ? displayedVendorSummary.map((vendorData, index) => (
                              <tr key={vendorData.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-medium text-gray-900`}>{vendorData.name}</td>
                                <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm text-gray-600`}>
                                  {vendorData.totalOrders}
                                  <span className="text-xs text-gray-500 ltr:ml-1 rtl:mr-1">
                                    ({vendorData.paidOrders} {t('vendor.billing.paid')}, {vendorData.unpaidOrders} {t('vendor.billing.unpaid')})
                                  </span>
                                </td>
                                <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-semibold text-gray-900`}>
                                  ₪{vendorData.totalAmount.toFixed(2)}
                                </td>
                                <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm text-green-600 font-medium`}>
                                  ₪{vendorData.paidAmount.toFixed(2)}
                                </td>
                                <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-medium`}>
                                  <span className={vendorData.unpaidAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                                    ₪{vendorData.unpaidAmount.toFixed(2)}
                                  </span>
                               </td>
                                <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm`}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-green-500 h-2 rounded-full"
                                        style={{ width: `${vendorData.totalAmount > 0 ? (vendorData.paidAmount / vendorData.totalAmount) * 100 : 0}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-600">
                                      {vendorData.totalAmount > 0 ? Math.round((vendorData.paidAmount / vendorData.totalAmount) * 100) : 0}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-500">
                                  {t('vendor.billing.noVendorData')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            <TabsContent value="orders" className="mt-4">
              <div className="flex justify-end gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={handleExportOrdersCSV} disabled={isExporting}>
                  <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  {t('vendor.billing.exportCSV')}
                </Button>
                {/*
                {userType==='admin'&&<Button variant="outline" size="sm" onClick={handleExportOrdersHTML} disabled={isExporting}>
                  <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  HTML
                </Button>}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportOrdersPDF}
                  disabled={isGeneratingOrdersPdf}
                >
                  {isGeneratingOrdersPdf ? (
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  )}
                  {t('vendor.billing.exportPDF')}
                </Button>
                */}
              </div>
              <div className="overflow-x-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="order_number" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.orderId')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="created_date" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.date')}</SortableHeader></th>
                      {(userType === 'admin' ||userType === "chief of staff")&& <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="vendor_name" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.vendor')}</SortableHeader></th>}
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="household_name" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.household')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="total_amount" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.total')}</SortableHeader></th>
                      {(userType === 'admin' || userType === "chief of staff")&& <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="status" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.status')}</SortableHeader></th>}
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="payment_status" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.paymentStatusColumn')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="added_to_bill" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.isBilledColumn')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="is_paid" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.isPayedColumn')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="payment_method" config={orderSortConfig} setConfig={setOrderSortConfig}>{t('vendor.billing.paymentMethodColumn')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 font-semibold text-gray-700`}>{t('vendor.billing.actions')}</th>
                    </tr>
                    <tr className="bg-gray-100">
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}><Input placeholder={t('common.filter')} value={filters.orderNumber} onChange={e => handleFilterChange('orderNumber', e.target.value)} className="h-8" /></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}><Input type="date" value={filters.date} onChange={e => handleFilterChange('date', e.target.value)} className="h-8" /></td>
                        {(userType === 'admin' ||userType === "chief of staff")&& <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}><Input placeholder={t('common.filter')} value={filters.vendor} onChange={e => handleFilterChange('vendor', e.target.value)} className="h-8" /></td>}
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}><Input placeholder={t('common.filter')} value={filters.household} onChange={e => handleFilterChange('household', e.target.value)} className="h-8" /></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        {(userType === 'admin'||userType === "chief of staff" )&& (
                          <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}>
                            <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">{t('common.all')}</SelectItem>
                                <SelectItem value="ready_for_shipping">{t('vendor.billing.statusFilter.ready_for_shipping')}</SelectItem>
                                <SelectItem value="delivery">{t('vendor.billing.statusFilter.delivery')}</SelectItem>
                                <SelectItem value="delivered">{t('vendor.billing.statusFilter.delivered')}</SelectItem>
                                <SelectItem value="return_processed">{t('vendor.billing.statusLabels.return_processed')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}>
                            <Select value={filters.payment_status} onValueChange={(v) => handleFilterChange('payment_status', v)}>
                                <SelectTrigger className="h-8"><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('common.all')}</SelectItem>
                                    {paymentStatusOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {t(`vendor.billing.paymentStatuses.${option}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}>
                            <Select value={filters.is_billed} onValueChange={(v) => handleFilterChange('is_billed', v)}>
                                <SelectTrigger className="h-8"><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('common.all')}</SelectItem>
                                    <SelectItem value="yes">{t('common.yes')}</SelectItem>
                                    <SelectItem value="no">{t('common.no')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}>
                            <Select value={filters.is_paid} onValueChange={(v) => handleFilterChange('is_paid', v)}>
                                <SelectTrigger className="h-8"><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('common.all')}</SelectItem>
                                    <SelectItem value="yes">{t('common.yes')}</SelectItem>
                                    <SelectItem value="no">{t('common.no')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}>
                            <Select value={filters.payment_method} onValueChange={(v) => handleFilterChange('payment_method', v)}>
                                <SelectTrigger className="h-8"><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('common.all')}</SelectItem>
                                    {paymentMethodOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {t(`vendor.billing.paymentMethods.${option}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </td>
                        <td className="p-2"></td>
                    </tr>
                  </thead>
                  <tbody>
                    {processedOrders.length > 0 ? processedOrders.map((order, index) => {
                      const isReturn = order.id.toString().endsWith('-return'); // Use toString() for safety
                      const isEditing = editingOrderId === order.id;
                      const hasReturnedItems = (order.items || []).some(item =>
                        item.is_returned === true &&
                        item.amount_returned !== null &&
                        item.amount_returned !== undefined &&
                        item.amount_returned > 0
                      );
                      return (
                      <tr key={order.id} className={isReturn ? 'bg-orange-50 hover:bg-orange-100' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-medium ${isReturn ? 'text-orange-700' : 'text-blue-600'}`}>{order.order_number}</td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm text-gray-600`}>{order.created_date ?formatDate(new Date(order.created_date), "MMM d, h:mm a", language) : t('common.na')}</td>
                        {(userType === 'admin' ||userType === "chief of staff")&& (
                          <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm text-gray-600`}>
                            <div className="flex items-center gap-1.5">
                              <Store className="w-4 h-4 text-green-600" />
                              {order.vendor_name}
                            </div>
                          </td>
                        )}
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm text-gray-600`}>{order.household_name}</td>
                        <td dir={'ltr'} className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-semibold ${order.total_amount < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {getCurrencySymbol(order)}{(order.total_amount || 0).toFixed(2)}
                        </td>
                        {(userType === 'admin' || userType === "chief of staff") && (
                          <td className="py-3 px-4 text-sm">
                            <Badge className={`${getStatusColor(order.status)} border text-xs`}>
                              {getStatusLabel(order.status)}
                            </Badge>
                          </td>
                        )}
                        <td className="py-3 px-4">
                            {isReturn ? <span className="text-gray-400">-</span> : (
                                isEditing ? (
                                    <Select
                                        value={editFormData.payment_status}
                                        onValueChange={(value) => setEditFormData(prev => ({ ...prev, payment_status: value }))}
                                    >
                                        <SelectTrigger className="w-[120px] h-8">
                                            <SelectValue placeholder={t('vendor.billing.paymentStatuses.none')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentStatusOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {t(`vendor.billing.paymentStatuses.${option}`)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    t(`vendor.billing.paymentStatuses.${order.payment_status || 'none'}`)
                                )
                            )}
                        </td>
                        <td className="py-3 px-4">
                            {isReturn ? <span className="text-gray-400">-</span> : (
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <Switch
                                        id={`billed-${order.id}`}
                                        checked={!!order.added_to_bill}
                                        onCheckedChange={() => handleToggleBilled(order.id, order.added_to_bill)}
                                        disabled={userType !== 'admin' && userType !== 'chief of staff'}
                                    />
                                    <Label htmlFor={`billed-${order.id}`} className="text-sm">
                                        {order.added_to_bill ? t('vendor.billing.yes') : t('vendor.billing.no')}
                                    </Label>
                                </div>
                            )}
                        </td>
                        <td className="py-3 px-4">
                            {isReturn ? <span className="text-gray-400">-</span> : (
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <Switch
                                        id={`paid-${order.id}`}
                                        checked={!!order.is_paid}
                                        onCheckedChange={() => handleTogglePaid(order.id, order.is_paid)}
                                        disabled={userType !== 'admin' && userType !== 'chief of staff'}
                                    />
                                    <Label htmlFor={`paid-${order.id}`} className="text-sm">
                                        {order.is_paid ? t('vendor.billing.yes') : t('vendor.billing.no')}
                                    </Label>
                                </div>
                            )}
                        </td>
                        <td className="py-3 px-4">
                            {isReturn ? <span className="text-gray-400">-</span> : (
                                isEditing ? (
                                    <Select
                                        value={editFormData.payment_method}
                                        onValueChange={(value) => setEditFormData(prev => ({ ...prev, payment_method: value }))}
                                    >
                                        <SelectTrigger className="w-[150px] h-8">
                                            <SelectValue placeholder={t('vendor.billing.paymentMethods.none')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentMethodOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {t(`vendor.billing.paymentMethods.${option}`)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    t(`vendor.billing.paymentMethods.${order.payment_method || 'none'}`)
                                )
                            )}
                        </td>
                        <td className="py-3 px-4">
                          {!isReturn ? (
                            <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                                <>
                                  <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit}>
                                    {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin ltr:mr-1 rtl:ml-1" /> : <Save className="w-4 h-4 ltr:mr-1 rtl:ml-1" />}
                                    {t('common.save')}
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                            ) : (
                                <>
                                  {(userType === 'admin' || userType === 'chief of staff') && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleUpdateSingleOrderPrices(order)}
                                        disabled={isUpdatingPrices === true || isUpdatingPrices === order.id} // Disable if bulk or THIS order is updating
                                        className="text-green-600 border-green-300 hover:bg-green-50"
                                      >
                                        {isUpdatingPrices === order.id ? ( // Check if THIS order is updating
                                          <Loader2 className="w-4 h-4 ltr:mr-1 rtl:ml-1 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                        )}
                                        {t('vendor.billing.updateToBase', 'Update to Base')}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenPriceEditor(order)}
                                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                      >
                                        <Edit className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                        {t('vendor.billing.editPrices', 'Edit Prices')}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEditClick(order)}
                                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                      >
                                        <Edit className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                        {t('vendor.billing.editStatus', 'Edit Status')}
                                      </Button>
                                      {/*
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewOppositeCurrency(order)}
                                        disabled={isGeneratingPDF === order.id} // Disable if this order's PDF is being generated
                                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                      >
                                        {order.order_currency === 'USD' ? '₪' : '$'}
                                      </Button>
                                      */}
                                    </>
                                  )}
                                  {/*
                                   {userType==='admin'&&<Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewInvoiceHTML(order)}
                                    className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                                  >
                                    <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                  </Button>}

                                  {/* NEW INDIVIDUAL INVOICE BUTTONS */}
                                  {/*
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadInvoice(order)}
                                    disabled={generatingSingleInvoice === order.id}
                                    className="text-green-600 border-green-600 hover:bg-green-50"
                                  >
                                    {generatingSingleInvoice === order.id ? (
                                      <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                                    ) : (
                                      <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                    )}
                                    {t('vendor.billing.invoice')}
                                  </Button>    
                                   */}

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadShoppedOnlyInvoice(order)}
                                    disabled={generatingSingleInvoice === order.id}
                                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                                  >
                                    {generatingSingleInvoice === order.id ? (
                                      <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                                    ) : (
                                      <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                    )}
                                    {t('billing.invoiceShoppedOnly', 'Shopped Only')}
                                  </Button>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadShoppedOnlyConvertedInvoice(order)}
                                    disabled={generatingSingleInvoice === order.id}
                                    className="text-teal-600 border-teal-600 hover:bg-teal-50"
                                  >
                                    {generatingSingleInvoice === order.id ? (
                                      <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                    )}
                                    {t('billing.invoiceShoppedOnlyConverted', 'Shopped Only ($)')}
                                  </Button>
                                  {/* END NEW INDIVIDUAL INVOICE BUTTONS */}

                                  {hasReturnedItems && ( // Condition to show these buttons
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadReturnNote(order)}
                                        disabled={generatingReturnNote === order.id}
                                        className="text-red-600 border-red-600 hover:bg-red-50"
                                      >
                                        {generatingReturnNote === order.id ? (
                                          <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                                        ) : (
                                          <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                        )}
                                        {t('vendor.billing.returnNote', 'Return Note')}
                                      </Button>

                                      <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => handleDownloadReturnNoteConverted(order)}
                                       disabled={generatingReturnNote === order.id}
                                       className="text-pink-600 border-pink-600 hover:bg-pink-50"
                                      >
                                       {generatingReturnNote === order.id ? (
                                         <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                                       ) : (
                                         <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                       )}
                                       {t('billing.returnNoteConvertedPDF', 'Return PDF ($)')}
                                      </Button>
                                    </>
                                  )}

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReturnOrder(order)}
                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                  >
                                    <RefreshCw className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                    {t('vendor.billing.returns', 'Returns')}
                                  </Button>
                                </>
                            )}
                            </div>
                          ) : (
                           <div className="flex flex-wrap gap-2">
                          {userType==='admin'&& <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleViewReturnNoteHTML(order)} // Changed to handleViewReturnNoteHTML
                             className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                           >
                             <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                             {t('vendor.billing.creditNote', 'Credit Note')}
                           </Button>}
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleDownloadReturnNotePDF(order)} // Changed to handleDownloadReturnNotePDF
                             disabled={isGeneratingPDF === order.id}
                             className="text-blue-600 border-blue-300 hover:bg-blue-50"
                           >
                             {isGeneratingPDF === order.id ? (
                               <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                             ) : (
                               <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                             )}
                             {t('common.pdf')}
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleDownloadReturnNoteConverted(order)}
                             disabled={generatingReturnNote === order.id}
                             className="text-pink-600 border-pink-600 hover:bg-pink-50"
                           >
                             {generatingReturnNote === order.id ? (
                               <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                             ) : (
                               <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                             )}
                             {t('billing.returnNoteConvertedPDF', 'Return PDF ($)')}
                           </Button>
                           </div>
                          )}
                        </td>
                      </tr>
                    );
                    }) : (
                      <tr>
                        <td colSpan={(userType === 'admin'||userType === "chief of staff") ? 11 : 9} className="text-center py-8 text-gray-500">
                          {t('vendor.billing.noOrdersFound')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="households" className="mt-4">
              <div className="flex justify-end gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={handleExportSummaryCSV} disabled={isExporting}>
                  <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  {t('vendor.billing.exportCSV')}
                </Button>

              {userType==='admin'&&  <Button variant="outline" size="sm" onClick={handleExportSummaryHTML} disabled={isExporting}>
                  <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  HTML
                </Button>}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportHouseholdSummaryPDF}
                  disabled={isGeneratingSummaryPdf}
                >
                  {isGeneratingSummaryPdf ? (
                    <Loader2 className="w-4 h-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  )}
                  {t('vendor.billing.exportPDF')}
                </Button>
              </div>
              <div className="overflow-x-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="name" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.household')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="totalOrders" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.totalOrders')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="ordersWithReturns" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.ordersWithReturns')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="totalPurchases" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.totalPurchases')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="totalReturns" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.totalReturns')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="netPurchases" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.netPurchases')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="totalPaid" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.amountPaid')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="totalUnpaid" config={summarySortConfig} setConfig={setSummarySortConfig}>{t('vendor.billing.amountDue')}</SortableHeader></th>
                      <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 font-semibold text-gray-700`}>{t('vendor.billing.paymentStatus')}</th>
                    </tr>
                     <tr className="bg-gray-100">
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}><Input placeholder={t('common.filter')} value={summaryFilters.household_name} onChange={e => handleSummaryFilterChange('household_name', e.target.value)} className="h-8" /></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        <td className={`p-2 border-gray-200 ${isRTL ? 'border-l' : 'border-r'}`}></td>
                        <td className="p-2"></td>
                    </tr>
                  </thead>
                  <tbody>
                    {processedHouseholdSummary.length > 0 ? processedHouseholdSummary.map((household, index) => (
                      <tr key={household.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-medium text-gray-900`}>
                          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Home className="w-4 h-4 text-blue-500" />
                            {household.display_name}
                          </div>
                        </td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm text-gray-600`}>{household.totalOrders}</td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm ${household.ordersWithReturns > 0 ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                          {household.ordersWithReturns}
                        </td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-semibold text-blue-600`}>₪{household.totalPurchases.toFixed(2)}</td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm ${household.totalReturns > 0 ? 'font-semibold text-orange-600' : 'text-gray-400'}`}>
                          {household.totalReturns > 0 ? `-₪${household.totalReturns.toFixed(2)}` : '₪0.00'}
                        </td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-bold text-green-600`}>₪{household.netPurchases.toFixed(2)}</td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-semibold text-green-600`}>₪{household.totalPaid.toFixed(2)}</td>
                        <td className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4 text-sm font-semibold text-red-600`}>₪{household.totalUnpaid.toFixed(2)}</td>
                        <td className="py-3 px-4 text-sm">
                          {household.totalUnpaid === 0 ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              {t('vendor.billing.fullyPaid')}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              {t('vendor.billing.due', {amount: household.totalUnpaid.toFixed(2)})}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-gray-500">
                          {t('vendor.billing.noHouseholdData')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Price Editor Modal */}
      <Dialog open={!!editingPricesOrder} onOpenChange={(open) => !open && setEditingPricesOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('vendor.billing.editItemPrices', 'Edit Item Prices')} - {editingPricesOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {editingPricesOrder && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                <p><strong>{t('vendor.billing.household', 'Household')}:</strong> {editingPricesOrder.household_name}</p>
                <p><strong>{t('vendor.billing.deliveryDate', 'Delivery Date')}:</strong> {editingPricesOrder.delivery_time ? formatDeliveryTime(editingPricesOrder.delivery_time, language) : t('common.notSet')}</p>
              </div>

              <div className="border rounded-lg divide-y">
                {editingPricesOrder.items.map((item, index) => {
                  const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
                    ? item.actual_quantity
                    : item.quantity;
                  const currentPrice = editedPrices[item.product_id] !== undefined ? editedPrices[item.product_id] : item.price;
                  const itemTotal = currentPrice * quantity;

                  return (
                    <div key={index} className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <p className="font-semibold">{language === 'Hebrew' && item.product_name_hebrew ? item.product_name_hebrew : item.product_name}</p>
                          <p className="text-sm text-gray-600">
                            {t('vendor.billing.quantity', 'Quantity')}: {quantity} {item.unit}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div>
                            <Label htmlFor={`price-${item.product_id}`} className="text-xs text-gray-600">
                              {t('vendor.billing.pricePerUnit', 'Price/Unit')}
                            </Label>
                            <div className="flex items-center gap-1">
                              <span className="text-sm">₪</span>
                              <Input
                                id={`price-${item.product_id}`}
                                type="number"
                                step="0.01"
                                value={currentPrice}
                                onChange={(e) => handlePriceChange(item.product_id, e.target.value)}
                                className="w-24"
                              />
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-gray-600">{t('vendor.billing.total', 'Total')}</p>
                            <p className="font-semibold text-green-600">₪{itemTotal.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* New: Delivery Cost Editor */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="delivery-price" className="text-sm font-semibold text-gray-700">
                      {t('vendor.billing.deliveryCost', 'Delivery Cost')}
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('vendor.billing.deliveryCostDescription', 'Adjust the delivery fee for this order')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold">₪</span>
                    <Input
                      id="delivery-price"
                      type="number"
                      step="0.01"
                      value={editedDeliveryPrice}
                      onChange={(e) => handleDeliveryPriceChange(e.target.value)}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>

              {/* Order Total Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('vendor.billing.itemsTotal', 'Items Total')}:</span>
                  <span className="font-semibold">
                    ₪{editingPricesOrder.items.reduce((sum, item) => {
                      const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
                        ? item.actual_quantity
                        : item.quantity;
                      const price = editedPrices[item.product_id] !== undefined ? editedPrices[item.product_id] : item.price;
                      return sum + (price * quantity);
                    }, 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>{t('vendor.billing.deliveryFee', 'Delivery Fee')}:</span>
                  <span className="font-semibold">₪{editedDeliveryPrice.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>{t('vendor.billing.newTotal', 'New Total')}:</span>
                  <span className="text-green-600">
                    ₪{(editingPricesOrder.items.reduce((sum, item) => {
                      const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
                        ? item.actual_quantity
                        : item.quantity;
                      const price = editedPrices[item.product_id] !== undefined ? editedPrices[item.product_id] : item.price;
                      return sum + (price * quantity);
                    }, 0) + editedDeliveryPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {setEditingPricesOrder(null); setEditedPrices({}); setEditedDeliveryPrice(0);}}
              disabled={isSavingPrices}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSavePrices}
              disabled={isSavingPrices}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSavingPrices ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2"></div>
                  {t('common.saving', 'Saving...')}
                </>
              ) : (
                t('common.save', 'Save Changes')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReturnItemsModal
        isOpen={!!returnOrder}
        order={returnOrder}
        onClose={() => setReturnOrder(null)}
        onSave={handleSaveReturns}
      />
      
      <OrderDetailsModal
        order={viewingOrder}
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        onOrderUpdate={(updatedOrder) => {
          if (onRefresh) onRefresh();
          setViewingOrder(null);
        }}
        userType={userType}
      />
      {/* Totals Dialog */}
      <Dialog open={showTotalsDialog} onOpenChange={setShowTotalsDialog}>
        <DialogContent className={`sm:max-w-md ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-green-600" />
              {t('billing.totalsTitle', 'Order Totals Summary')}
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-2">
              {t('billing.allItemsIncluded', 'All items included (ordered and not ordered)')}
            </p>
          </DialogHeader>

          {calculatedTotals && (
            <div className="space-y-4">
              {/* Total Orders */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">
                  {t('billing.totalOrders', 'Total Orders')}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {calculatedTotals.totalOrders}
                </div>
              </div>

              {/* Breakdown by Original Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs text-blue-600 font-medium mb-1">
                    {t('billing.ilsOrders', 'ILS Orders')}
                  </div>
                  <div className="text-lg font-bold text-blue-900">
                    {calculatedTotals.ilsOrders.count}
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    ₪{calculatedTotals.ilsOrders.total.toFixed(2)}
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-600 font-medium mb-1">
                    {t('billing.usdOrders', 'USD Orders')}
                  </div>
                  <div className="text-lg font-bold text-green-900">
                    {calculatedTotals.usdOrders.count}
                  </div>
                  <div className="text-sm text-green-700 mt-1">
                    ${calculatedTotals.usdOrders.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Combined Totals */}
              <div className="border-t pt-4 space-y-3">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  {t('billing.combinedTotals', 'Combined Totals (All Orders Converted)')}
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-purple-700 font-medium">
                      {t('billing.totalInILS', 'Total in ILS')}
                    </div>
                    <div className="text-xl font-bold text-purple-900">
                      ₪{calculatedTotals.totalILS.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-green-700 font-medium">
                      {t('billing.totalInUSD', 'Total in USD')}
                    </div>
                    <div className="text-xl font-bold text-green-900">
                      ${calculatedTotals.totalUSD.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversion Rate Note */}
              <div className="text-xs text-gray-500 text-center pt-2 border-t">
                {t('billing.conversionNote', 'Conversion rate:')} 1 USD = {ILS_TO_USD_RATE} ILS
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowTotalsDialog(false)} variant="outline">
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shopped Items Totals Dialog */}
      <Dialog open={showShoppedTotalsDialog} onOpenChange={setShowShoppedTotalsDialog}>
        <DialogContent className={`sm:max-w-md ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              {t('billing.shoppedTotalsTitle', 'Shopped Items Totals')}
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-2">
              {t('billing.onlyShoppedItemsIncluded', 'Only items that were actually supplied/shopped')}
            </p>
          </DialogHeader>

          {calculatedShoppedTotals && (
            <div className="space-y-4">
              {/* Total Orders with Shopped Items */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-600 mb-1">
                  {t('billing.ordersWithShoppedItems', 'Orders with Shopped Items')}
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {calculatedShoppedTotals.totalOrders}
                </div>
              </div>

              {/* Breakdown by Original Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs text-blue-600 font-medium mb-1">
                    {t('billing.ilsOrders', 'ILS Orders')}
                  </div>
                  <div className="text-lg font-bold text-blue-900">
                    {calculatedShoppedTotals.ilsOrders.count}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {calculatedShoppedTotals.ilsOrders.itemsCount} {t('common.items', 'items')}
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    ₪{calculatedShoppedTotals.ilsOrders.total.toFixed(2)}
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-600 font-medium mb-1">
                    {t('billing.usdOrders', 'USD Orders')}
                  </div>
                  <div className="text-lg font-bold text-green-900">
                    {calculatedShoppedTotals.usdOrders.count}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {calculatedShoppedTotals.usdOrders.itemsCount} {t('common.items', 'items')}
                  </div>
                  <div className="text-sm text-green-700 mt-1">
                    ${calculatedShoppedTotals.usdOrders.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Combined Totals */}
              <div className="border-t pt-4 space-y-3">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  {t('billing.combinedTotals', 'Combined Totals (All Orders Converted)')}
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-purple-700 font-medium">
                      {t('billing.totalInILS', 'Total in ILS')}
                    </div>
                    <div className="text-xl font-bold text-purple-900">
                      ₪{calculatedShoppedTotals.totalILS.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-green-700 font-medium">
                      {t('billing.totalInUSD', 'Total in USD')}
                    </div>
                    <div className="text-xl font-bold text-green-900">
                      ${calculatedShoppedTotals.totalUSD.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversion Rate Note */}
              <div className="text-xs text-gray-500 text-center pt-2 border-t">
                {t('billing.conversionNote', 'Conversion rate:')} 1 USD = {ILS_TO_USD_RATE} ILS
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowShoppedTotalsDialog(false)} variant="outline">
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add helper function at the end before export
function base64ToBlob(base64, contentType = '') {
  try {
    // Validate base64 string
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Invalid base64 string provided');
    }

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  } catch (error) {
    console.error('Error converting base64 to blob:', error);
    console.error('Base64 string (first 100 chars):', base64?.substring(0, Math.min(base64.length, 100)));
    throw new Error(`Failed to decode base64: ${error.message}`);
  }
}