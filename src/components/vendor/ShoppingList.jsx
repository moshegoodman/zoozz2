
import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ListOrdered, Download, FileText, Eye, Package } from 'lucide-react';
import { Order, User, Product } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { exportShoppingListHTML } from '@/functions/exportShoppingListHTML';
import { format, startOfDay } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import OrderDetailsModal from "./OrderDetailsModal";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from 'lucide-react';

export default function ShoppingList({ orders, vendor, onUpdate }) {
  const { t, language } = useLanguage();
  const isRTL = language === 'Hebrew';
  const [isExporting, setIsExporting] = useState(false);
  const [products, setProducts] = useState([]);
  const [exportStatusFilter, setExportStatusFilter] = useState(['pending', 'shopping', 'ready_for_shipping', 'delivery']);

  // Add new state for the orders modal
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [selectedItemOrders, setSelectedItemOrders] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');

  // Add state for order details modal
  const [viewingOrderDetails, setViewingOrderDetails] = useState(null);

  // Add new state for shopping list status filter
  const [shoppingStatusFilter, setShoppingStatusFilter] = useState(new Set(['pending', 'follow_up', 'shopping', 'ready_for_shipping']));

  // Add state for date range filter
  const [dateRange, setDateRange] = useState(undefined);

  // Define all possible shopping statuses once, accessible for both logic and JSX
  const allPossibleShoppingStatuses = ['pending', 'follow_up', 'shopping', 'ready_for_shipping', 'delivery', 'delivered'];

  useEffect(() => {
    const fetchProducts = async () => {
      if (vendor?.id) {
        try {
          const vendorProducts = await Product.filter({ vendor_id: vendor.id });
          setProducts(vendorProducts);
        } catch (error) {
          console.error("Failed to fetch products for vendor:", error);
        }
      }
    };
    fetchProducts();
  }, [vendor]);

  const productMap = useMemo(() => {
    if (!products || products.length === 0) return new Map();
    return new Map(products.map(p => [p.id, p]));
  }, [products]);

  // Add helper to parse date from delivery_time
  const parseDateFromDeliveryTime = (deliveryTimeString) => {
    if (!deliveryTimeString) return null;

    // First, try to extract YYYY-MM-DD from the beginning of the string
    const yyyyMmDdRegex = /^(\d{4}-\d{2}-\d{2})/;
    const match = deliveryTimeString.match(yyyyMmDdRegex);

    if (match && match[1]) {
        try {
            // Create a Date object from the YYYY-MM-DD part.
            // new Date(year, monthIndex, day) creates a date in local time zone.
            const parts = match[1].split('-').map(Number);
            const date = new Date(parts[0], parts[1] - 1, parts[2]);
            if (!isNaN(date.getTime())) {
                return date;
            }
        } catch (e) {
            console.warn("Failed to parse YYYY-MM-DD date part for filtering:", e);
        }
    }
    // If YYYY-MM-DD format is not found or failed, try to parse the whole string
    try {
        const date = new Date(deliveryTimeString);
        if (!isNaN(date.getTime())) {
            return date;
        }
    } catch (e) {
        // Fallback to null if parsing fails
    }

    return null;
  };

  const shoppingList = useMemo(() => {
    // Ensure shoppingStatusFilter is defined
    if (!shoppingStatusFilter || !orders) return [];
    
    // First filter orders by selected statuses
    let filteredOrders = orders.filter(order => {
      if (shoppingStatusFilter.size === 0) return false; // If no statuses selected, return no orders
      return shoppingStatusFilter.has(order.status);
    });

    // Apply date range filter if set
    if (dateRange?.from) {
        const filterFromDate = startOfDay(dateRange.from);
        // If 'to' date is not set, assume it's the same day as 'from'
        const filterToDate = dateRange.to ? startOfDay(dateRange.to) : filterFromDate;

        filteredOrders = filteredOrders.filter(order => {
            const orderDeliveryDate = parseDateFromDeliveryTime(order.delivery_time);
            if (!orderDeliveryDate) return false;

            const orderDeliveryDay = startOfDay(orderDeliveryDate);
            return orderDeliveryDay >= filterFromDate && orderDeliveryDay <= filterToDate;
        });
    }
    
    const itemsToShop = {};
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const productInfo = productMap.get(item.product_id);
        const key = item.product_id;
        
        // Determine the quantity that was actually picked for this specific item in this order
        const actualPickedForThisItem = (item.actual_quantity !== null && item.actual_quantity !== undefined) 
          ? item.actual_quantity 
          : 0;

        // Calculate needed quantity for *this specific item in this order*:
        // total ordered quantity MINUS what was actually picked.
        // Ensure it's not negative.
        const neededForThisItemInOrder = Math.max(0, item.quantity - actualPickedForThisItem);

        if (itemsToShop[key]) {
          // Add to existing item
          itemsToShop[key].totalQuantity += item.quantity;
          itemsToShop[key].pickedQuantity += actualPickedForThisItem;
          itemsToShop[key].neededQuantity += neededForThisItemInOrder; // Use the new needed calculation
          itemsToShop[key].orders.add(order.id);
        } else {
          // Create new item entry
          itemsToShop[key] = {
            product_id: item.product_id,
            name: item.product_name,
            name_hebrew: item.product_name_hebrew,
            totalQuantity: item.quantity, // Total ordered for this item in this order
            pickedQuantity: actualPickedForThisItem, // Amount already picked for this item in this order
            neededQuantity: neededForThisItemInOrder, // Amount still needed for this item in this order
            unit: item.unit,
            orders: new Set([order.id]),
            sku: item.sku,
            subcategory: item.subcategory,
            subcategory_hebrew: productInfo?.subcategory_hebrew,
            barcode: productInfo?.barcode,
            quantity_in_unit: productInfo?.quantity_in_unit,
          };
        }
      });
    });
    
    // return all ordered products, sorted
    return Object.values(itemsToShop)
      .filter(item => item.totalQuantity > 0)
      .sort((a, b) => {
        const categoryA = a.subcategory || '';
        const categoryB = b.subcategory || '';
        if (categoryA !== categoryB) {
          return categoryA.localeCompare(categoryB, language);
        }
        const nameA = language === 'Hebrew' ? (a.name_hebrew || a.name) : a.name;
        const nameB = language === 'Hebrew' ? (b.name_hebrew || b.name) : b.name;
        return nameA.localeCompare(nameB, language);
      });
  }, [orders, productMap, shoppingStatusFilter, language, dateRange]);

  const markProductAsShopped = async (productId) => {
    const updatedOrders = new Map();
    
    try {
      const currentUser = await User.me();
      console.log("Current user marking product as shopped:", currentUser.full_name);

      // Process each order that contains this product
      orders.forEach(order => {
          let orderWasModified = false;
          const newItems = order.items.map(item => {
              // Only mark if actual_quantity is not already set
              if (item.product_id === productId && (item.actual_quantity === null || item.actual_quantity === undefined)) {
                  orderWasModified = true;
                  // Set actual_quantity to ordered quantity
                  const updatedItem = { 
                      ...item, 
                      actual_quantity: item.quantity
                  };
                  return updatedItem;
              }
              return item;
          });

          if (orderWasModified) {
              // Calculate new total based on actual quantities only
              const newTotalAmount = newItems.reduce((total, item) => {
                  const actualQuantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) 
                      ? item.actual_quantity 
                      : 0; // Use 0 if actual_quantity is not set
                  
                  const effectiveQuantity = parseFloat(actualQuantity) || 0;
                  const price = item.price || 0;
                  return total + (price * effectiveQuantity);
              }, 0);

              const updatedOrderData = { 
                  items: newItems,
                  total_amount: newTotalAmount,
                  status: "shopping" // Update status to shopping when items are being shopped
              };

              // Assign current user as picker if not already assigned
              if (!order.picker_id && currentUser) {
                  updatedOrderData.picker_id = currentUser.id;
                  updatedOrderData.picker_name = currentUser.full_name;
                  console.log("Assigning picker:", currentUser.full_name, "to order:", order.order_number);
              }

              updatedOrders.set(order.id, updatedOrderData);
          }
      });

      // Update all affected orders in the database
      const updatePromises = Array.from(updatedOrders.entries()).map(([orderId, orderData]) => {
        console.log("Updating order", orderId, "with data:", orderData);
        return Order.update(orderId, orderData);
      });
      
      await Promise.all(updatePromises);
      
      console.log(`Updated ${updatedOrders.size} orders after marking product as shopped`);
      await onUpdate(); // Refresh data in the dashboard
    } catch(err) {
        console.error("Failed to mark item as shopped", err);
        alert(t('common.updateError'));
    }
  };

  const handleExportByDate = () => {
    // Generate date range from September 26, 2025 to about a month from that date
    const startDate = new Date('2025-09-26');
    const endDate = new Date('2025-09-26');
    endDate.setMonth(endDate.getMonth() + 1); // One month from September 26
    
    const dateRange = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Filter orders by selected statuses
    const filteredOrders = orders.filter(order => exportStatusFilter.includes(order.status));

    // Group orders by delivery date
    const ordersByDate = {};
    filteredOrders.forEach(order => {
      if (order.delivery_time) {
        // Extract date from delivery_time (assuming format like "2025-01-15 09:00-17:00")
        const deliveryDate = order.delivery_time.split(' ')[0];
        if (dateRange.includes(deliveryDate)) {
          if (!ordersByDate[deliveryDate]) {
            ordersByDate[deliveryDate] = [];
          }
          ordersByDate[deliveryDate].push(order);
        }
      }
    });

    // Get all unique products from filtered orders
    const allProducts = new Map();
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const productKey = item.product_id;
        if (!allProducts.has(productKey)) {
          const productInfo = productMap.get(item.product_id);
          allProducts.set(productKey, {
            product_id: item.product_id,
            name: item.product_name,
            name_hebrew: item.product_name_hebrew,
            unit: item.unit,
            sku: item.sku,
            subcategory: item.subcategory || '',
            subcategory_hebrew: productInfo?.subcategory_hebrew || '',
            brand: productInfo?.brand || '',
            brand_hebrew: productInfo?.brand_hebrew || ''
          });
        }
      });
    });

    // Build the CSV matrix
    const headers = [
      'Product Name (EN)',
      'Product Name (HE)',
      'Subcategory',
      'Subcategory (HE)',
      'Brand Name',
      'Brand Name (Hebrew)',
      'SKU',
      'Unit',
      ...dateRange.map(date => format(new Date(date), 'MMM d'))
    ];

    const csvRows = [headers.join(',')];

    // For each product, calculate quantities for each date
    allProducts.forEach((product) => {
      const row = [
        `"${(product.name || '').replace(/"/g, '""')}"`,
        `"${(product.name_hebrew || '').replace(/"/g, '""')}"`,
        `"${(product.subcategory || '').replace(/"/g, '""')}"`,
        `"${(product.subcategory_hebrew || '').replace(/"/g, '""')}"`,
        `"${(product.brand || '').replace(/"/g, '""')}"`,
        `"${(product.brand_hebrew || '').replace(/"/g, '""')}"`,
        product.sku || '',
        product.unit || ''
      ];

      // For each date, calculate total quantity needed for this product
      dateRange.forEach(date => {
        let totalQuantity = 0;
        
        if (ordersByDate[date]) {
          ordersByDate[date].forEach(order => {
            order.items.forEach(item => {
              // Only count as needed if actual_quantity is NOT set
              if (item.product_id === product.product_id && (item.actual_quantity === null || item.actual_quantity === undefined)) {
                totalQuantity += item.quantity || 0;
              }
            });
          });
        }
        
        // Push empty string for 0, otherwise push the number
        row.push(totalQuantity === 0 ? '' : totalQuantity);
      });

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shopping-by-date-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportByDateDetailed = () => {
    // Generate date range from September 26, 2025 to about a month from that date
    const startDate = new Date('2025-09-26');
    const endDate = new Date('2025-09-26');
    endDate.setMonth(endDate.getMonth() + 1); // One month from September 26
    
    const dateRange = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Filter orders by selected statuses
    const filteredOrders = orders.filter(order => exportStatusFilter.includes(order.status));

    // Group orders by delivery date
    const ordersByDate = {};
    filteredOrders.forEach(order => {
      if (order.delivery_time) {
        const deliveryDate = order.delivery_time.split(' ')[0];
        if (dateRange.includes(deliveryDate)) {
          if (!ordersByDate[deliveryDate]) {
            ordersByDate[deliveryDate] = [];
          }
          ordersByDate[deliveryDate].push(order);
        }
      }
    });

    // Get all unique products from filtered orders
    const allProducts = new Map();
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const productKey = item.product_id;
        if (!allProducts.has(productKey)) {
          const productInfo = productMap.get(item.product_id);
          allProducts.set(productKey, {
            product_id: item.product_id,
            name: item.product_name,
            name_hebrew: item.product_name_hebrew,
            unit: item.unit,
            sku: item.sku,
            subcategory: item.subcategory || '',
            subcategory_hebrew: productInfo?.subcategory_hebrew || '',
            brand: productInfo?.brand || '',
            brand_hebrew: productInfo?.brand_hebrew || ''
          });
        }
      });
    });

    // Build the CSV matrix with 3 columns per date
    const headers = [
      t('vendor.shoppingList.productNameEn', 'Product Name (EN)'),
      t('vendor.shoppingList.productNameHe', 'Product Name (HE)'),
      t('vendor.shoppingList.subcategory', 'Subcategory'),
      t('vendor.shoppingList.subcategoryHe', 'Subcategory (HE)'),
      t('vendor.shoppingList.brandName', 'Brand Name'),
      t('vendor.shoppingList.brandNameHe', 'Brand Name (Hebrew)'),
      'SKU',
      t('vendor.shoppingList.unit', 'Unit')
    ];

    // Add 3 columns for each date: Need, Ordered, Picked
    dateRange.forEach(date => {
      const formattedDate = format(new Date(date), 'MMM d');
      headers.push(`${formattedDate} ${t('vendor.shoppingList.needed', 'Need')}`);
      headers.push(`${formattedDate} ${t('vendor.shoppingList.ordered', 'Ordered')}`);
      headers.push(`${formattedDate} ${t('vendor.shoppingList.picked', 'Picked')}`);
    });

    const csvRows = [headers.join(',')];

    // For each product, calculate quantities for each date
    allProducts.forEach((product) => {
      const row = [
        `"${(product.name || '').replace(/"/g, '""')}"`,
        `"${(product.name_hebrew || '').replace(/"/g, '""')}"`,
        `"${(product.subcategory || '').replace(/"/g, '""')}"`,
        `"${(product.subcategory_hebrew || '').replace(/"/g, '""')}"`,
        `"${(product.brand || '').replace(/"/g, '""')}"`,
        `"${(product.brand_hebrew || '').replace(/"/g, '""')}"`,
        product.sku || '',
        product.unit || ''
      ];

      // For each date, calculate Need, Ordered, and Picked quantities
      dateRange.forEach(date => {
        let totalOrdered = 0;
        let totalPicked = 0;
        
        if (ordersByDate[date]) {
          ordersByDate[date].forEach(order => {
            order.items.forEach(item => {
              if (item.product_id === product.product_id) {
                totalOrdered += item.quantity || 0;
                const actualPicked = (item.actual_quantity !== null && item.actual_quantity !== undefined) 
                  ? item.actual_quantity 
                  : 0;
                totalPicked += actualPicked;
              }
            });
          });
        }

        const totalNeed = Math.max(0, totalOrdered - totalPicked); // Ensure 'Need' is not negative
        
        // Push Need, Ordered, Picked for this date
        row.push(totalNeed === 0 ? '' : totalNeed);
        row.push(totalOrdered === 0 ? '' : totalOrdered);
        row.push(totalPicked === 0 ? '' : totalPicked);
      });

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shopping-detailed-by-date-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStatusFilterToggle = (status) => {
    setExportStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleShoppingStatusToggle = (status) => {
    setShoppingStatusFilter(prev => {
      const newSelected = new Set(prev); // Create new Set from previous

      if (status === 'all') {
        // If all possible statuses are currently selected, deselect all
        if (allPossibleShoppingStatuses.every(s => newSelected.has(s))) {
          newSelected.clear();
        } else {
          // Otherwise, select all
          newSelected.clear();
          allPossibleShoppingStatuses.forEach(s => newSelected.add(s));
        }
      } else {
        if (newSelected.has(status)) {
          newSelected.delete(status);
        } else {
          newSelected.add(status);
        }
      }
      
      return newSelected;
    });
  };

  const handleExportCSV = () => {
    const headers = [
        'Product Name (EN)',
        'Product Name (HE)',
        'Subcategory (EN)',
        'Subcategory (HE)',
        'SKU',
        'Barcode',
        'Total Quantity Ordered', // Updated header
        'Quantity Needed', // Added header
        'Quantity Picked', // Added header
        'Unit',
        'Quantity per Unit',
        'Number of Orders'
    ];
    const csvRows = [headers.join(',')];

    shoppingList.forEach(item => {
      const row = [
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${(item.name_hebrew || '').replace(/"/g, '""')}"`,
        `"${(item.subcategory || '').replace(/"/g, '""')}"`,
        `"${(item.subcategory_hebrew || '').replace(/"/g, '""')}"`,
        item.sku || '',
        item.barcode || '',
        item.totalQuantity, // Use new property
        item.neededQuantity, // Use new property
        item.pickedQuantity, // Use new property
        item.unit,
        item.quantity_in_unit || '',
        item.orders.size
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shopping-list-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = async () => {
    if (shoppingList.length === 0) {
      alert(t('common.listEmpty'));
      return;
    }
    try {
      const listForExport = shoppingList.map(item => ({
        ...item,
        ordersCount: item.orders.size
      }));
      
      const response = await exportShoppingListHTML({
        shoppingList: listForExport,
        vendorName: vendor?.name,
        language,
      });
      
      const htmlContent = response.data;
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `shopping-list-${format(new Date(), 'yyyy-MM-dd')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlContent);
          newWindow.document.close();
          // Revoke the URL after the new window has used it
          newWindow.addEventListener('unload', () => URL.revokeObjectURL(url));
        } else {
          alert(t('common.popupBlocked'));
        }
      }

    } catch (error) {
      console.error("Error exporting HTML:", error);
      alert(t('common.htmlExportError'));
    }
  };

  // Add function to show orders for a specific item
  const showItemOrders = (item) => {
    const itemOrders = orders.filter(order => item.orders.has(order.id));
    
    // Process orders to show relevant information
    const processedOrders = itemOrders.map(order => {
      const orderItem = order.items.find(orderItem => orderItem.product_id === item.product_id);
      
      // Extract date from delivery_time (remove time part)
      let deliveryDateOnly = '';
      if (order.delivery_time) {
        // Handle different date formats in delivery_time
        const dateMatch = order.delivery_time.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          deliveryDateOnly = dateMatch[1];
        } else {
          // Fallback for other potential formats, or just display as is
          deliveryDateOnly = order.delivery_time; // Keep full string if format doesn't match
        }
      }

      // Use actual_quantity as the primary indicator of what was picked
      const actualPickedForOrderItem = (orderItem?.actual_quantity !== null && orderItem?.actual_quantity !== undefined) 
        ? orderItem?.actual_quantity 
        : 0;

      return {
        order_number: order.order_number,
        household_name: order.household_name || t('common.notSet', 'N/A'),
        household_code: order.household_code || t('common.notSet', 'N/A'),
        quantity: orderItem?.quantity || 0, // Total ordered quantity for this specific item in this order
        pickedQuantity: actualPickedForOrderItem,
        delivery_date: deliveryDateOnly || t('common.notSet', 'Not set'),
        status: order.status,
        status_label: t(`vendor.orderManagement.statusLabels.${order.status}`, order.status),
        isShoppedItem: (orderItem?.actual_quantity !== null && orderItem?.actual_quantity !== undefined)
      };
    });

    setSelectedItemOrders(processedOrders);
    setSelectedItemName(language === 'Hebrew' && item.name_hebrew ? item.name_hebrew : item.name);
    setShowOrdersModal(true);
  };

  const handleShowOrderDetails = (orderNumber) => {
    const order = orders.find(o => o.order_number === orderNumber);
    if (order) {
      setViewingOrderDetails(order);
    }
  };

  const handleOrderUpdate = async (updatedOrder) => {
    // This component doesn't manage the top-level 'orders' state directly.
    // We signal the parent component to refresh its data.
    if (onUpdate) {
      await onUpdate(); // Trigger parent to refetch/update orders
    }
    // Close the details modal after an update to reflect potential changes
    setViewingOrderDetails(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'follow_up':
        return 'bg-orange-100 text-orange-800 border-orange-200'; // New color for follow_up
      case 'shopping':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready_for_shipping':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivery':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className={`flex flex-col gap-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex flex-col sm:flex-row justify-between items-start gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0">
                      <CardTitle className="flex items-center gap-2">
                          <ListOrdered className="w-5 h-5" />
                          {t('vendor.shoppingList.title')}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                          {t('vendor.shoppingList.description')}
                      </p>
                  </div>
              </div>
              
              <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'justify-start' : 'justify-start'}`}>
                  {/* Shopping Status Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs px-3 flex-shrink-0"
                      >
                        <Package className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                        <span className="hidden sm:inline">
                          {allPossibleShoppingStatuses.every(s => shoppingStatusFilter.has(s)) 
                            ? t('vendor.orderManagement.allOrders') 
                            : shoppingStatusFilter.size === 0 
                              ? t('common.noneSelected', 'None Selected')
                              : `${shoppingStatusFilter.size} ${t('common.selected')}`
                          }
                        </span>
                        <span className="sm:hidden">{shoppingStatusFilter.size}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <div className="space-y-2">
                        <div className="font-medium text-sm">{t('vendor.shoppingList.selectStatusesToInclude', 'Select order statuses to include in shopping list:')}</div>
                        {[
                          { value: 'all', label: t('vendor.orderManagement.allOrders') },
                          { value: 'pending', label: t('vendor.orderManagement.statusLabels.pending') },
                          { value: 'follow_up', label: t('vendor.orderManagement.statusLabels.follow_up', 'Follow-Up Order') },
                          { value: 'shopping', label: t('vendor.orderManagement.statusLabels.shopping') },
                          { value: 'ready_for_shipping', label: t('vendor.orderManagement.statusLabels.ready_for_shipping') },
                          { value: 'delivery', label: t('vendor.orderManagement.statusLabels.delivery') },
                          { value: 'delivered', label: t('vendor.orderManagement.statusLabels.delivered') }
                        ].map((status) => (
                          <label key={status.value} className={`flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-50 ${isRTL ? 'flex-row-reverse space-x-reverse' : ''}`}>
                            <input
                              type="checkbox"
                              checked={status.value === 'all' 
                                ? allPossibleShoppingStatuses.every(s => shoppingStatusFilter.has(s)) 
                                : shoppingStatusFilter.has(status.value)
                              }
                              onChange={() => handleShoppingStatusToggle(status.value)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{status.label}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Date Range Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant={"outline"}
                        className={`h-9 text-xs px-3 flex-shrink-0 ${!dateRange?.from && "text-muted-foreground"}`}
                      >
                        <CalendarIcon className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                        <span className="hidden md:inline">
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>{t('vendor.orderManagement.pickDeliveryDate', 'Pick date')}</span>
                          )}
                        </span>
                        <span className="md:hidden">📅</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>

                  <div className="w-px h-6 bg-gray-300 hidden sm:block"></div>

                  <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleExportCSV}
                      disabled={shoppingList.length === 0}
                      className="h-9 text-xs px-3 flex-shrink-0"
                  >
                      <Download className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      <span className="hidden sm:inline">{t('vendor.shoppingList.exportCSV')}</span>
                      <span className="sm:hidden">CSV</span>
                  </Button>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                          variant="outline" 
                          size="sm"
                          disabled={orders.length === 0}
                          className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 h-9 text-xs px-3 flex-shrink-0"
                      >
                          <Download className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                          <span className="hidden sm:inline">{t('vendor.shoppingList.exportByDate', 'By Date')}</span>
                          <span className="sm:hidden">Date</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="end">
                      <div className="space-y-3">
                        <div className="font-medium text-sm">
                          {t('vendor.shoppingList.selectOrderStatuses', 'Select Order Statuses to Include:')}
                        </div>
                        <div className="space-y-2">
                          {[
                            { value: 'pending', label: t('vendor.orderManagement.statusLabels.pending', 'Pending') },
                            { value: 'follow_up', label: t('vendor.orderManagement.statusLabels.follow_up', 'Follow-Up Order') },
                            { value: 'shopping', label: t('vendor.orderManagement.statusLabels.shopping', 'Shopping') },
                            { value: 'ready_for_shipping', label: t('vendor.orderManagement.statusLabels.ready_for_shipping', 'Ready for Shipping') },
                            { value: 'delivery', label: t('vendor.orderManagement.statusLabels.delivery', 'In Delivery') },
                            { value: 'delivered', label: t('vendor.orderManagement.statusLabels.delivered', 'Delivered') },
                            { value: 'cancelled', label: t('vendor.orderManagement.statusLabels.cancelled', 'Cancelled') }
                          ].map((status) => (
                            <label key={status.value} className={`flex items-center space-x-2 cursor-pointer ${isRTL ? 'flex-row-reverse space-x-reverse' : ''}`}>
                              <Checkbox
                                checked={exportStatusFilter.includes(status.value)}
                                onCheckedChange={() => handleStatusFilterToggle(status.value)}
                              />
                              <span className="text-sm">{status.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="pt-2 border-t">
                          <Button 
                            onClick={handleExportByDate}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            size="sm"
                            disabled={exportStatusFilter.length === 0}
                          >
                            {t('common.export', 'Export')} ({exportStatusFilter.length})
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                          variant="outline" 
                          size="sm"
                          disabled={orders.length === 0}
                          className="bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 h-9 text-xs px-3 flex-shrink-0"
                      >
                          <Download className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                          <span className="hidden sm:inline">{t('vendor.shoppingList.exportByDateDetailed', 'Detailed')}</span>
                          <span className="sm:hidden">Det</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="end">
                      <div className="space-y-3">
                        <div className="font-medium text-sm">
                          {t('vendor.shoppingList.selectOrderStatuses', 'Select Order Statuses to Include:')}
                        </div>
                        <div className="space-y-2">
                          {[
                            { value: 'pending', label: t('vendor.orderManagement.statusLabels.pending', 'Pending') },
                            { value: 'follow_up', label: t('vendor.orderManagement.statusLabels.follow_up', 'Follow-Up Order') },
                            { value: 'shopping', label: t('vendor.orderManagement.statusLabels.shopping', 'Shopping') },
                            { value: 'ready_for_shipping', label: t('vendor.orderManagement.statusLabels.ready_for_shipping', 'Ready for Shipping') },
                            { value: 'delivery', label: t('vendor.orderManagement.statusLabels.delivery', 'In Delivery') },
                            { value: 'delivered', label: t('vendor.orderManagement.statusLabels.delivered', 'Delivered') },
                            { value: 'cancelled', label: t('vendor.orderManagement.statusLabels.cancelled', 'Cancelled') }
                          ].map((status) => (
                            <label key={status.value} className={`flex items-center space-x-2 cursor-pointer ${isRTL ? 'flex-row-reverse space-x-reverse' : ''}`}>
                              <Checkbox
                                checked={exportStatusFilter.includes(status.value)}
                                onCheckedChange={() => handleStatusFilterToggle(status.value)}
                              />
                              <span className="text-sm">{status.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="pt-2 border-t">
                          <Button 
                            onClick={handleExportByDateDetailed}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            size="sm"
                            disabled={exportStatusFilter.length === 0}
                          >
                            {t('common.export', 'Export')} ({exportStatusFilter.length})
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleExportHTML}
                      disabled={shoppingList.length === 0}
                      className="h-9 text-xs px-3 flex-shrink-0"
                  >
                      <FileText className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      <span className="hidden sm:inline">{t('vendor.shoppingList.previewHTML')}</span>
                      <span className="sm:hidden">HTML</span>
                  </Button>
              </div>
          </div>
        </CardHeader>
        <CardContent dir={isRTL?'rtl':'ltr'}>
          {shoppingList.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {t('vendor.shoppingList.allItemsShopped')}
            </p>
          ) : (
            <div className="space-y-4">
              {shoppingList.map(item => (
                <div key={item.product_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-bold text-lg">{language === 'Hebrew' && item.name_hebrew ? item.name_hebrew : item.name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-gray-600">
                        {t('vendor.shoppingList.needed')}: <span className="font-semibold text-red-600">{item.neededQuantity}</span> {item.unit}
                      </p>
                      {item.pickedQuantity > 0 && (
                        <p className="text-gray-600">
                          {t('vendor.shoppingList.picked')}: <span className="font-semibold text-green-600">{item.pickedQuantity}</span> {item.unit}
                        </p>
                      )}
                      <p className="text-gray-600">
                        {t('vendor.shoppingList.totalOrdered')}: <span className="font-semibold">{item.totalQuantity}</span> {item.unit}
                      </p>
                      <p className="text-sm text-blue-600">
                        {language === 'Hebrew' 
                          ? `נמצא ב-${item.orders.size} ${item.orders.size === 1 ? 'הזמנה' : 'הזמנות'}`
                          : t('vendor.shoppingList.foundInOrders', { count: item.orders.size, plural: item.orders.size !== 1 ? 's' : '' })
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => showItemOrders(item)}
                      variant="outline"
                      className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Eye className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                      {t('vendor.shoppingList.showOrders', 'Show Orders')}
                    </Button>
                    <Button
                      onClick={() => markProductAsShopped(item.product_id)}
                      variant="outline"
                      className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                    >
                      {t('vendor.shoppingList.markAsShopped')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Modal */}
      <Dialog open={showOrdersModal} onOpenChange={setShowOrdersModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={isRTL ? 'text-right' : 'text-left'}>
              {t('vendor.shoppingList.ordersForItem', { itemName: selectedItemName })}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4" dir={isRTL?'rtl':'ltr'}>
            {selectedItemOrders.length > 0 ? (
              selectedItemOrders.map((orderInfo, index) => (
                <div key={index} className={`border rounded-lg p-4 ${orderInfo.isShoppedItem ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                  <div className={`flex flex-wrap items-center gap-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="link"
                        onClick={() => handleShowOrderDetails(orderInfo.order_number)}
                        className="p-0 h-auto font-medium text-blue-600 hover:text-blue-800 underline"
                      >
                        {t('common.orderDetails')}
                      </Button>
                      <span className="text-sm text-gray-600">{orderInfo.household_name} #{orderInfo.household_code}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{orderInfo.delivery_date}</span>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          {t('vendor.shoppingList.needed', 'Needed')}:
                        </span>
                        <span className="text-sm font-medium text-red-600">{orderInfo.quantity - orderInfo.pickedQuantity}</span>
                      </div>
                      
                      {orderInfo.pickedQuantity > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700">
                            {t('vendor.shoppingList.picked', 'Picked')}:
                          </span>
                          <span className="text-sm font-medium text-green-600">{orderInfo.pickedQuantity}</span>
                        </div>
                      )}
                      
                      <Badge variant="outline" className={`text-xs ${getStatusColor(orderInfo.status)}`}>
                        {orderInfo.status_label}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">
                {t('vendor.shoppingList.noOrdersFound', 'No orders found for this item')}
              </p>
            )}
          </div>
          
          <div className={`flex justify-end mt-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button variant="outline" onClick={() => setShowOrdersModal(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={viewingOrderDetails}
        isOpen={!!viewingOrderDetails}
        onClose={() => setViewingOrderDetails(null)}
        onOrderUpdate={handleOrderUpdate}
        onDownloadPO={() => {}} // Empty function since not needed in this context
        onViewPOHTML={() => {}} // Empty function since not needed in this context
        onViewDeliveryHTML={() => {}} // Empty function since not needed in this context
        onStartProcessing={() => {}} // Empty function since not needed in this context
        onMarkAsReady={() => {}} // Empty function since not needed in this context
        onMarkAsShipped={() => {}} // Empty function since not needed in this context
        onMarkAsDelivered={() => {}} // Empty function since not needed in this context
        onChatOpen={() => {}} // Empty function since not needed in this context
        onCancelOrder={() => {}} // Empty function since not needed in this context
        userType="vendor" // Set appropriate user type
      />
    </>
  );
}
