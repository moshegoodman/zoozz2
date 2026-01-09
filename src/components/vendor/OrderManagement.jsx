
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Order, Household, HouseholdStaff, User, Chat } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Package,
  MessageCircle,
  ArrowUp,
  ArrowDown,
  Truck,
  PackageCheck,
  Download,
  FileText,
  Loader2, // Import Loader2 for spinner
  Edit, // Import for actions dropdown
  UserCheck,
  XCircle, // Added XCircle icon for cancel button
  Calendar as CalendarIcon, // Add calendar icon for date picker
  CheckCircle // New import for "Mark as Delivered" button
} from "lucide-react";


import { formatDate } from "../i18n/dateUtils";
import { format, startOfDay } from 'date-fns';
import { generatePurchaseOrderPDF } from "@/functions/generatePurchaseOrderPDF";
import { debugPurchaseOrder } from "@/functions/debugPurchaseOrder";
import { generatePurchaseOrderHTML } from "@/functions/generatePurchaseOrderHTML";
import { generateDeliveryHTML } from "@/functions/generateDeliveryHTML";
import { generateDeliveryPDF } from "@/functions/generateDeliveryPDF"; // New import
import { useLanguage } from "../i18n/LanguageContext";
import OrderDetailsModal from "./OrderDetailsModal";
import { generateOrderNumber } from "@/components/OrderUtils";
import { sendOrderSMS } from "@/functions/sendOrderSMS";
import ChatDialog from "../chat/ChatDialog"; // New import
import { sendShippingNotificationEmail } from "@/functions/sendShippingNotificationEmail"; // New import for email notification
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ALL_POSSIBLE_STATUSES = ['pending', 'follow_up', 'shopping', 'ready_for_shipping', 'delivery', 'delivered', 'cancelled'];

export default function OrderManagement({ orders, onOrderUpdate, vendorId, user, handleOpenChat, onRefresh }) {
  const { t, language, isRTL } = useLanguage();
  const [filter, setFilter] = useState("all");
  // Renamed selectedStatuses to statusFilter to align with outline, and updated default
  const [statusFilter, setStatusFilter] = useState(new Set(['pending', 'follow_up', 'shopping', 'ready_for_shipping']));
  const [viewingOrder, setViewingOrder] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'descending' });
  const [columnFilters, setColumnFilters] = useState({
    order_number: '',
    display_name: '',
    household_name: '',
    picker_name: '',
    neighborhood: ''
  });
  const [dateRange, setDateRange] = useState(undefined); // State for date range filter
  const [households, setHouseholds] = useState([]);
  const [householdLeads, setHouseholdLeads] = useState({});
  const [users, setUsers] = useState([]);
  const [downloadingPOId, setDownloadingPOId] = useState(null);
  const [viewingDeliveryHTMLId, setViewingDeliveryHTMLId] = useState(null);

  const [showChatDialog, setShowChatDialog] = useState(false); // New state for chat dialog visibility
  const [dialogChatId, setDialogChatId] = useState(null); // New state for chat dialog ID
  const [generatingPdfId, setGeneratingPdfId] = useState(null);
  const [generatingDeliveryPdfId, setGeneratingDeliveryPdfId] = useState(null);

  // State for expanded delivery notes
  const [expandedNotes, setExpandedNotes] = useState(new Set());

  // New states for delivery date editing
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(null);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [isDateEditModalOpen, setIsDateEditModalOpen] = useState(false);


  useEffect(() => {
    const fetchAuxiliaryData = async () => {
      if (!orders || orders.length === 0) {
        setHouseholds([]);
        setHouseholdLeads({});
        setUsers([]);
        return;
      }
      try {
        const householdIds = [...new Set(orders.map(o => o.household_id).filter(Boolean))];
        const userEmails = [...new Set(orders.map(o => o.user_email).filter(Boolean))];

        const promises = [];

        if (householdIds.length > 0) {
          promises.push(
            Household.filter({ id: { $in: householdIds } }),
            HouseholdStaff.filter({ household_id: { $in: householdIds }, is_lead: true })
          );
        } else {
          promises.push(Promise.resolve([]), Promise.resolve([]));
        }

        if (userEmails.length > 0) {
          promises.push(User.filter({ email: { $in: userEmails } }));
        } else {
          promises.push(Promise.resolve([]));
        }

        const [householdsData, staffLinks, usersData] = await Promise.all(promises);

        setHouseholds(householdsData);
        setUsers(usersData);

        const staffUserIds = staffLinks.map(link => link.staff_user_id);
        if (staffUserIds.length > 0) {
          const staffUsers = await User.filter({ id: { $in: staffUserIds } });
          const userMap = staffUsers.reduce((map, user) => {
            map[user.id] = user;
            return map;
          }, {});

          const leadMap = {};
          staffLinks.forEach(link => {
            const user = userMap[link.staff_user_id];
            if (user) {
              const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.full_name || 'Name not set';
              leadMap[link.household_id] = {
                name: fullName,
                phone: user.phone || 'N/A'
              };
            }
          });
          setHouseholdLeads(leadMap);
        } else {
          setHouseholdLeads({});
        }
      } catch (error) {
        console.error("Failed to fetch households and leads:", error);
      }
    };
    fetchAuxiliaryData();
  }, [orders]);

  const formatDeliveryTime = useCallback((deliveryTime, lang) => {
    // Move convertToMilitaryTime inside formatDeliveryTime
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
    // End of moved function

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
  }, []); // Removed language dependency since lang is passed as parameter


  const handleViewDeliveryHTML = useCallback(async (orderId) => {
    setViewingDeliveryHTMLId(orderId);
    try {
      const order = await Order.get(orderId);

      if (order) {
        const { Vendor } = await import("@/entities/all");
        const vendor = await Vendor.get(order.vendor_id);

        const response = await generateDeliveryHTML({ order, vendor, language });

        const htmlContent = response.data;
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (newWindow) {
            newWindow.document.open();
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        } else {
            alert(t('common.popupBlocked', 'Please allow pop-ups to view the content.'));
        }
      } else {
        alert(t('vendor.orderManagement.alerts.orderNotFound', 'Order could not be found. It might have been deleted.'));
      }
    } catch (error) {
      console.error("Error viewing Delivery Note HTML:", error);
      alert(`Failed to view Delivery Note: ${error.message || 'Unknown error'}`);
    } finally {
      setViewingDeliveryHTMLId(null);
    }
  }, [language, t]); // 'language' is used in generateDeliveryHTML, 't' for alerts. setViewingDeliveryHTMLId is a stable setter, can be omitted.


  const handleViewPOHTML = useCallback(async (orderId, lang) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const { Vendor, Household } = await import("@/entities/all");
        const vendor = await Vendor.get(order.vendor_id);

        let household = null;
        if (order.household_id) {
            household = await Household.get(order.household_id);
        }

        const response = await generatePurchaseOrderHTML({
          order,
          vendor,
          household,
          language: lang,
        });

        const htmlContent = response.data;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `PO-${order.order_number}.html`;
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
            URL.revokeObjectURL(url);
          } else {
            alert("Please allow popups to view the HTML preview");
          }
        }
      }
    } catch (error) {
      console.error("Error viewing Purchase Order HTML:", error);
      alert("Failed to generate Purchase Order HTML for viewing.");
    }
  }, [orders]);

  const handleTestHTML = useCallback(async (orderId) => {
    alert(t("vendor.orderManagement.alerts.testHtml", "Attempting to generate test HTML. A new browser tab should open."));
    try {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const { Vendor, Household } = await import("@/entities/all");
        const vendor = await Vendor.get(order.vendor_id);
        let household = order.household_id ? await Household.get(order.household_id) : null;

        const response = await debugPurchaseOrder({
          order,
          vendor,
          household,
          language,
          testType: 'html',
        });

        const htmlContent = response.data;
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          alert(t("common.popupBlocked", "Please allow pop-ups to view the test HTML."));
        }
      }
    } catch (error) {
      console.error("Error testing HTML generation:", error);
      alert(t("vendor.orderManagement.alerts.testHtmlFailed", `Failed to generate test HTML. Error: ${error.message}`));
    }
  }, [orders, language, t]);

// Remove the faulty generatePdfFromHtml function and replace it with a simple fallback
const generatePdfFromHtml = useCallback(async (htmlContent, filename = 'document.pdf') => {
  try {
    // Since we have backend PDF generation, we'll just show the HTML as fallback
    // This should not be called if backend PDF generation works correctly
    console.warn('generatePdfFromHtml fallback called - this should not happen if backend PDF works');

    // Create a new window with the HTML content for preview
    const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(htmlContent);
      newWindow.document.close();

      // Add a print button to the window
      const printButton = newWindow.document.createElement('button');
      printButton.textContent = 'Print/Save as PDF';
      printButton.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:10px;background:#007cba;color:white;border:none;border-radius:5px;cursor:pointer;';
      printButton.onclick = () => {
        newWindow.print();
      };
      newWindow.document.body.appendChild(printButton);
    } else {
      alert(t('common.popupBlocked', 'Please allow pop-ups to view the content.'));
    }
  } catch (error) {
    console.error("Error in generatePdfFromHtml fallback:", error);
    throw error;
  }
}, [t]);

const handleDownloadPOPDF = useCallback(async (orderId) => {
  setGeneratingPdfId(orderId);
  try {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      alert('Order not found');
      return;
    }

    // Try to use backend PDF generation function directly
    console.log('Generating PDF for order:', order.order_number);

    const response = await generatePurchaseOrderPDF({
      order,
      language: language,
    });

    console.log('PDF generation response:', response);

    // Check if we got a successful PDF response
    if (response.data && response.data.success && response.data.pdfBase64) {
      // Convert base64 to blob and download directly
      const binaryString = atob(response.data.pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO-${order.order_number}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('PDF downloaded successfully');
      return;
    }

    // If backend PDF generation didn't work, check if we got HTML content
    if (response.data && response.data.htmlContent) {
      console.log('Backend returned HTML content, using browser print');
      await generatePdfFromHtml(response.data.htmlContent, `PO-${order.order_number}.pdf`);
      return;
    }

    // If we get here, something went wrong
    console.error('Unexpected response from generatePurchaseOrderPDF:', response);
    alert('Failed to generate PDF. Please try again.');

  } catch (error) {
    console.error("Error generating Purchase Order PDF:", error);
    alert(`Failed to generate Purchase Order PDF: ${error.message || 'Unknown error'}`);
  } finally {
    setGeneratingPdfId(null);
  }
}, [orders, language, generatePdfFromHtml]);

const handleDownloadDeliveryPDF = useCallback(async (orderId) => {
  setGeneratingDeliveryPdfId(orderId);
  try {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      alert('Order not found');
      return;
    }

    console.log('Generating Delivery PDF for order:', order.order_number);

    const response = await generateDeliveryPDF({
      order,
      language: language,
    });

    console.log('Delivery PDF generation response:', response);

    // Check if we got a successful PDF response
    if (response.data && response.data.success && response.data.pdfBase64) {
      // Convert base64 to blob and download directly
      const binaryString = atob(response.data.pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Delivery-${order.order_number}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('Delivery PDF downloaded successfully');
      return;
    }

    // If backend PDF generation didn't work, check if we got HTML content
    if (response.data && response.data.htmlContent) {
      console.log('Backend returned HTML content, using browser print');
      await generatePdfFromHtml(response.data.htmlContent, `Delivery-${order.order_number}.pdf`);
      return;
    }

    // If we get here, something went wrong
    console.error('Unexpected response from generateDeliveryPDF:', response);
    alert('Failed to generate Delivery PDF. Please try again.');

  } catch (error) {
    console.error("Error generating Delivery PDF:", error);
    alert(`Failed to generate Delivery PDF: ${error.message || 'Unknown error'}`);
  } finally {
    setGeneratingDeliveryPdfId(null);
  }
}, [orders, language, generatePdfFromHtml]);


  const handleStartProcessing = useCallback(async (orderId) => {
    try {
      // Fetch the latest order state directly from the database
      const latestOrder = await Order.get(orderId);
      if (!latestOrder) {
        console.warn(`Order with ID ${orderId} not found for starting processing.`);
        return;
      }

      // Ensure user prop is available and has required fields
      if (!user || !user.id || !user.full_name) {
        console.error("Current user information is missing for assigning picker.");
        alert(t('vendor.orderManagement.alerts.userMissingForPicker', 'Cannot assign picker: current user information is incomplete.'));
        return;
      }

      // Update the order status to shopping (processing) and assign picker
      await Order.update(orderId, {
        ...latestOrder,
        status: "shopping",
        picker_id: user.id, // Assign current user as picker
        picker_name: user.full_name // Assign current user's name as picker name
      });

      // Update the UI with the new status
      const updatedOrder = { ...latestOrder, status: "shopping", picker_id: user.id, picker_name: user.full_name };
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(updatedOrder);
      }

      // Send SMS notification to household lead
      try {
        await sendOrderSMS({
          orderId: orderId,
          messageType: 'order_processing_started',
          recipientType: 'household_lead'
        });
        console.log('SMS notification sent to household lead for order processing started');
      } catch (smsError) {
        console.warn('Failed to send SMS notification to household lead:', smsError);
      }

    } catch (error) {
      console.error("Error starting order processing:", error);
      alert(t('vendor.orderManagement.alerts.startProcessingFailed', 'Failed to start processing order.'));
    }
  }, [onOrderUpdate, viewingOrder, t, user]);

  const handleMarkAsReady = useCallback(async (orderId) => {
    try {
      // Fetch the latest order state directly from the database
      // This ensures we have all recent changes including those made in modals
      const latestOrder = await Order.get(orderId);
      if (!latestOrder) {
        console.warn(`Order with ID ${orderId} not found for marking as ready.`);
        return;
      }

      // Update the order with the fresh data AND the new status
      await Order.update(orderId, {
        ...latestOrder, // Use the fresh data from database
        status: "ready_for_shipping" // Update the status
      });

      // Update the UI with the new status
      const updatedOrder = { ...latestOrder, status: "ready_for_shipping" };
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(updatedOrder);
      }
    } catch (error) {
      console.error("Error marking order as ready for shipping:", error);
      alert(t('vendor.orderManagement.alerts.markReadyFailed', 'Failed to mark order as ready for shipping.'));
    }
  }, [onOrderUpdate, viewingOrder, t]); // Removed setViewingOrder as it's a state setter.

  const handleMarkAsShipped = useCallback(async (orderId) => {
    try {
      // Fetch the latest order state directly from the database
      const orderToUpdate = await Order.get(orderId);
      if (!orderToUpdate) {
        console.warn(`Order with ID ${orderId} not found for marking as shipped.`);
        return;
      }

      await Order.update(orderId, {
        ...orderToUpdate, // Use fresh data from database
        status: "delivery"
      });

      // Update UI with fresh data and new status
      const updatedOrder = { ...orderToUpdate, status: "delivery" };
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(prev => ({ ...prev, status: "delivery" }));
      }

      // Send SMS notification to customer
      try {
        await sendOrderSMS({
          orderId: orderId,
          messageType: 'order_shipped',
          recipientType: 'customer'
        });
        console.log('SMS notification sent for order shipped');
      } catch (smsError) {
        console.warn('Failed to send SMS notification:', smsError);
      }

      // Send email notification with delivery slip PDF
      try {
        await sendShippingNotificationEmail({ orderId: orderId });
        console.log('Email notification with delivery slip sent');
      } catch (emailError) {
        console.warn('Failed to send email notification:', emailError);
      }

      // Only include items that have actual_quantity of 0 or null/undefined
      const itemsNotFulfilled = orderToUpdate.items.filter(item => {
        const actualQuantity = item.actual_quantity;
        return actualQuantity === 0 || actualQuantity === null || actualQuantity === undefined;
      });

      if (itemsNotFulfilled.length > 0) {
        const followUpOrderNumber = generateOrderNumber(orderToUpdate.vendor_id, orderToUpdate.household_id);
        const newTotal = itemsNotFulfilled.reduce((total, item) => {
          return total + (item.price * item.quantity);
        }, 0);

        const followUpOrder = {
          order_number: followUpOrderNumber,
          user_email: orderToUpdate.user_email,
          vendor_id: orderToUpdate.vendor_id,
          household_id: orderToUpdate.household_id,
          household_code: orderToUpdate.household_code, // Add household_code from original order
          household_name: orderToUpdate.household_name,
          household_name_hebrew: orderToUpdate.household_name_hebrew,
          household_lead_name: orderToUpdate.household_lead_name,
          household_lead_phone: orderToUpdate.household_lead_phone,
          items: itemsNotFulfilled.map(item => ({
            ...item,
            shopped: false,
            available: true,
            modified: false,
            actual_quantity: null,
            substitute_product_id: null,
            substitute_product_name: null

          })),
          total_amount: newTotal,
          status: "follow_up", // Changed to "follow_up" status
          street: orderToUpdate.street,
          building_number: orderToUpdate.building_number,
          neighborhood: orderToUpdate.neighborhood,
          household_number: orderToUpdate.household_number,
          entrance_code: orderToUpdate.entrance_code,
          delivery_address: orderToUpdate.delivery_address,
          delivery_time: orderToUpdate.delivery_time,
          phone: orderToUpdate.phone,
          delivery_notes: `Follow-up order for items not fulfilled in ${orderToUpdate.order_number}`
        };

        console.log('Creating follow-up order with number:', followUpOrderNumber);
        await Order.create(followUpOrder);

        if (onRefresh) {
            await onRefresh();
        }

        alert(t('vendor.orderManagement.alerts.shipSuccessWithFollowUp', {
          followUpOrderNumber,
          itemCount: itemsNotFulfilled.length,
        }));
      } else {
        alert(t('vendor.orderManagement.alerts.shipSuccess'));
      }
    } catch (error) {
      console.error("Error marking order as shipped:", error);
      alert(t('vendor.orderManagement.alerts.shipFailed'));
    }
  }, [onOrderUpdate, viewingOrder, t, onRefresh]); // Removed setViewingOrder as it's a state setter.

  const handleMarkAsDelivered = useCallback(async (orderId) => {
    try {
      // Fetch the latest order state directly from the database
      const orderToUpdate = await Order.get(orderId);
      if (!orderToUpdate) {
        console.warn(`Order with ID ${orderId} not found for marking as delivered.`);
        return;
      }

      await Order.update(orderId, {
        ...orderToUpdate,
        status: "delivered"
      });

      // Update UI with fresh data and new status
      const updatedOrder = { ...orderToUpdate, status: "delivered" };
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(prev => ({ ...prev, status: "delivered" }));
      }

      // Send SMS notification to customer
      try {
        await sendOrderSMS({
          orderId: orderId,
          messageType: 'order_delivered',
          recipientType: 'customer'
        });
        console.log('SMS notification sent for order delivered');
      } catch (smsError) {
        console.warn('Failed to send SMS notification:', smsError);
      }

      alert(t('vendor.orderManagement.alerts.deliveredSuccess', 'Order successfully marked as delivered.'));
    } catch (error) {
      console.error("Error marking order as delivered:", error);
      alert(t('vendor.orderManagement.alerts.deliveredFailed', 'Failed to mark order as delivered.'));
    }
  }, [onOrderUpdate, viewingOrder, t]);

  const handleCancelOrder = useCallback(async (orderId) => {
    if (!window.confirm(t('vendor.orderManagement.confirmCancel', 'Are you sure you want to cancel this order? This action cannot be undone.'))) {
      return;
    }
    try {
      await Order.update(orderId, { status: "cancelled" });
      const updatedOrder = await Order.get(orderId);
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(prev => ({ ...prev, status: "cancelled" }));
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert(t('vendor.orderManagement.alerts.cancelFailed', 'Failed to cancel order.'));
    }
  }, [onOrderUpdate, viewingOrder, t]); // Removed setViewingOrder as it's a state setter.

  const handleOpenChatDialog = useCallback(async (order) => {
    if (!order) {
      console.error("No order provided for chat");
      return;
    }

    try {
      const { Vendor } = await import("@/entities/all");
      let vendor = null;
      if (order.vendor_id) {
        try {
          vendor = await Vendor.get(order.vendor_id);
        } catch (error) {
          console.warn("Could not fetch vendor for chat:", error);
        }
      }

      // Check if there's already a chat for this order
      const existingChats = await Chat.filter({
        order_id: order.id,
        vendor_id: order.vendor_id
      });

      let chat;
      if (existingChats.length > 0) {
        // Use existing chat
        chat = existingChats[0];
      } else {
        // Use the 'user' prop directly for sender_email
        if (!user || !user.email) {
          console.error("Current user not available for chat creation.");
          alert(t('vendor.chat.failedToOpenChatNoUser', 'Failed to open chat: user information missing.'));
          return;
        }

        // Fetch household information if order has household_id
        let householdInfo = {};
        if (order.household_id) {
          try {
            const household = await Household.get(order.household_id);
            if (household) {
              householdInfo = {
                household_id: household.id,
                household_name: household.name,
                household_name_hebrew: household.name_hebrew,
                household_code: household.household_code
              };
            }
          } catch (error) {
            console.error("Error fetching household for chat:", error);
            // Even if household fetch fails, proceed with chat creation if other info is available
          }
        }

        const chatData = {
          order_id: order.id,
          customer_email: order.user_email,
          customer_name: order.display_name, // Added customer_name
          vendor_id: order.vendor_id, // Explicitly pass vendor_id
          vendor_name: vendor?.name || '',
          vendor_name_hebrew: vendor?.name_hebrew || '',
          chat_type: "order_chat",
          ...householdInfo, // Spread household information
          messages: [{
            sender_email: user.email, // Use email from 'user' prop
            sender_type: "vendor",
            message: t('vendor.chat.initialOrderMessage', 'Hi, we are here to help with your order.'),
            timestamp: new Date().toISOString(),
            read: false
          }],
          status: "active",
          last_message_at: new Date().toISOString()
        };

        chat = await Chat.create(chatData);
      }

      setDialogChatId(chat.id);
      setShowChatDialog(true);

    } catch (error) {
      console.error("Error opening or creating chat:", error);
      alert(t('vendor.chat.failedToOpenChat'));
    }
  }, [user, t]);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case "pending": return "bg-blue-100 text-blue-800 border-blue-200";
      case "follow_up": return "bg-cyan-100 text-cyan-800 border-cyan-200"; // Added 'follow_up' status color
      case "shopping": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "ready_for_shipping": return "bg-purple-100 text-purple-800 border-purple-200";
      case "delivery": return "bg-orange-100 text-orange-800 border-orange-200";
      case "delivered": return "bg-green-100 text-green-800 border-green-200";
      case "cancelled": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }, []);

  const getStatusLabel = useCallback((status) => {
    return t(`vendor.orderManagement.statusLabels.${status}`, status);
  }, [t]);

  const calculateOrderTotal = useCallback((order) => {
    if (!order || !order.items) return 0;

    const itemsTotal = order.items.reduce((sum, item) => {
      // Use actual_quantity if it exists and is a number, otherwise use original quantity
      const quantity = typeof item.actual_quantity === 'number' ? item.actual_quantity : item.quantity;
      return sum + (item.price * quantity);
    }, 0);

    // Use delivery_price field
    const deliveryPrice = order.delivery_price ?? 0;
    return itemsTotal + deliveryPrice;
  }, []); // Only depends on 'order' which is passed as an argument.

  const getItemsSummary = useCallback((items) => {
    const totalItems = items?.length || 0;
    const itemsWithActualQuantity = items?.filter(item =>
      item.actual_quantity !== null &&
      item.actual_quantity !== undefined &&
      item.actual_quantity > 0
    ).length || 0;
    return `${itemsWithActualQuantity}/${totalItems}`;
  }, []);

  const requestSort = useCallback((key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const handleColumnFilterChange = (key, value) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

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
    // This might catch formats like "Jan 1, 2023" but might be less reliable if `delivery_time` is very free-form.
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

  const handleEditDeliveryDate = useCallback((order) => {
    setEditingDeliveryDate(order);
    setNewDeliveryDate(order.delivery_time || '');
    setIsDateEditModalOpen(true);
  }, []);

  const handleSaveDeliveryDate = useCallback(async () => {
    if (!editingDeliveryDate) return;
    
    try {
      // Update the order with new delivery date
      await Order.update(editingDeliveryDate.id, {
        delivery_time: newDeliveryDate
      });

      // Update UI with the new delivery date
      const updatedOrder = { ...editingDeliveryDate, delivery_time: newDeliveryDate };
      onOrderUpdate(updatedOrder);
      
      // Send SMS notification to customer about delivery date change
      try {
        await sendOrderSMS({
          orderId: editingDeliveryDate.id,
          messageType: 'delivery_date_updated',
          recipientType: 'customer'
        });
        console.log('SMS notification sent for delivery date change');
      } catch (smsError) {
        console.warn('Failed to send SMS notification for delivery date change:', smsError);
      }

      // Close modal and reset state
      setIsDateEditModalOpen(false);
      setEditingDeliveryDate(null);
      setNewDeliveryDate('');
      
      alert(t('vendor.orderManagement.alerts.deliveryDateUpdated', 'Delivery date updated successfully.'));
    } catch (error) {
      console.error("Error updating delivery date:", error);
      alert(t('vendor.orderManagement.alerts.deliveryDateUpdateFailed', 'Failed to update delivery date.'));
    }
  }, [editingDeliveryDate, newDeliveryDate, onOrderUpdate, t]);

  const handleCancelEditDeliveryDate = useCallback(() => {
    setIsDateEditModalOpen(false);
    setEditingDeliveryDate(null);
    setNewDeliveryDate('');
  }, []);

  const handleExportOrderItemsCSV = useCallback((order) => {
    try {
      // Define CSV headers
      const headers = [
        'SKU',
        'Product Name (EN)',
        'Product Name (HE)',
        'Subcategory (EN)',
        'Subcategory (HE)',
        'Quantity Ordered',
        'Actual Quantity',
        'Unit',
        'Quantity per Unit',
        'Price per Unit',
        'Total Price',
        'Shopped',
        'Available',
        'Modified',
        'Returned',
        'Amount Returned',
        'Vendor Notes'
      ];

      // Build CSV rows from order items
      const rows = (order.items || []).map(item => {
        const quantityOrdered = item.quantity || 0;
        const actualQuantity = item.actual_quantity !== null && item.actual_quantity !== undefined 
          ? item.actual_quantity 
          : '';
        const pricePerUnit = item.price || 0;
        const totalPrice = (actualQuantity !== '' ? actualQuantity : quantityOrdered) * pricePerUnit;

        return [
          item.sku || '',
          `"${(item.product_name || '').replace(/"/g, '""')}"`,
          `"${(item.product_name_hebrew || '').replace(/"/g, '""')}"`,
          `"${(item.subcategory || '').replace(/"/g, '""')}"`,
          `"${(item.subcategory_hebrew || '').replace(/"/g, '""')}"`,
          quantityOrdered,
          actualQuantity,
          item.unit || '',
          item.quantity_per_unit || '',
          pricePerUnit.toFixed(2),
          totalPrice.toFixed(2),
          item.shopped ? 'Yes' : 'No',
          item.available ? 'Yes' : 'No',
          item.modified ? 'Yes' : 'No',
          item.is_returned ? 'Yes' : 'No',
          item.amount_returned || '',
          `"${(item.vendor_notes || '').replace(/"/g, '""')}"`
        ].join(',');
      });

      // Combine headers and rows
      const csvContent = [headers.join(','), ...rows].join('\n');

      // Create and download the file
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9א-ת]/g, '_') : 'Order';
      link.setAttribute('download', `Order-Items-${householdName}-${order.order_number}.csv`);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting order items CSV:', error);
      alert(t('common.exportError', 'Failed to export order items'));
    }
  }, [t]);

  const processedOrders = useMemo(() => {
    if (!orders) return [];

    let sortableItems = [...orders].map(order => {
        const household = order.household_id ? households.find(h => h.id === order.household_id) : null;
        const householdName = household ? ((language === 'Hebrew' && household.name_hebrew) || household.name || '') : '';
        const leadInfo = householdLeads[order.household_id];

        let displayName = order.user_email;
        let displayPhone = order.phone;

        if (leadInfo) {
          displayName = leadInfo.name;
          displayPhone = leadInfo.phone;
        } else {
          const user = users.find(u => u.email === order.user_email);
          if (user) {
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
            if (fullName) {
              displayName = fullName;
            } else if (user.full_name) {
              displayName = user.full_name;
            }
            displayPhone = user.phone || order.phone;
          }
        }

        return {
            ...order,
            household_name: householdName,
            display_name: displayName,
            display_phone: displayPhone,
        };
    });

    // Apply status filter logic
    if (statusFilter.size === 0) {
      sortableItems = []; // If no statuses are selected, show no orders
    } else {
      const areAllStatusesSelected = ALL_POSSIBLE_STATUSES.every(s => statusFilter.has(s));
      if (!areAllStatusesSelected) {
        // If not all statuses are selected, filter by the ones in the set
        sortableItems = sortableItems.filter(order => statusFilter.has(order.status));
      }
      // If all are selected, no filtering needed, all orders remain
    }

    if (dateRange?.from) {
        // Ensure both 'from' and 'to' are treated as start of day for comparison
        const filterFromDate = startOfDay(dateRange.from);
        // If 'to' is not set, we're filtering for a single day
        // Otherwise, set 'to' to the start of the selected 'to' day
        const filterToDate = dateRange.to ? startOfDay(dateRange.to) : filterFromDate;

        sortableItems = sortableItems.filter(order => {
            const orderDeliveryDate = parseDateFromDeliveryTime(order.delivery_time);
            if (!orderDeliveryDate) return false;

            // Treat the order's delivery date also as start of day for accurate comparison
            const orderDeliveryDay = startOfDay(orderDeliveryDate);

            return orderDeliveryDay >= filterFromDate && orderDeliveryDay <= filterToDate;
        });
    }

    if (columnFilters.order_number) {
      sortableItems = sortableItems.filter(order =>
        order.order_number.toLowerCase().includes(columnFilters.order_number.toLowerCase())
      );
    }
    if (columnFilters.display_name) {
      sortableItems = sortableItems.filter(order =>
        (order.display_name?.toLowerCase().includes(columnFilters.display_name.toLowerCase())) ||
        (order.display_phone?.toLowerCase().includes(columnFilters.display_name.toLowerCase()))
      );
    }
    if (columnFilters.household_name) {
      const searchTerm = columnFilters.household_name.toLowerCase();
      sortableItems = sortableItems.filter(order => {
        // Search in multiple fields for comprehensive mobile search
        const searchableFields = [
          order.household_name,
          order.delivery_address,
          order.neighborhood,
          order.household_code,
          order.street,
          order.building_number,
          order.household_number,
          order.entrance_code,
          order.delivery_notes,
          order.phone,
          order.display_name, // Include display_name and display_phone for mobile search
          order.display_phone
        ];

        return searchableFields.some(field =>
          field && field.toString().toLowerCase().includes(searchTerm)
        );
      });
    }
    if (columnFilters.picker_name) {
      sortableItems = sortableItems.filter(order =>
        order.picker_name?.toLowerCase().includes(columnFilters.picker_name.toLowerCase())
      );
    }
    if (columnFilters.neighborhood) { // Added neighborhood filter
      sortableItems = sortableItems.filter(order =>
        order.neighborhood?.toLowerCase().includes(columnFilters.neighborhood.toLowerCase())
      );
    }

    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'household_id' || sortConfig.key === 'household_name') {
          const nameA = a.household_name || '';
          const nameB = b.household_name || '';
          let comparison = nameA.localeCompare(nameB);
          if (comparison === 0) {
            const addressA = a.delivery_address || '';
            const addressB = b.delivery_address || '';
            comparison = addressA.localeCompare(addressB);
          }
          return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }
        if (sortConfig.key === 'display_name') {
            const nameA = a.display_name;
            const nameB = b.display_name;
            const comparison = nameA.localeCompare(nameB);
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;

        let comparison = 0;
        if (sortConfig.key === 'total_amount') {
          const totalA = calculateOrderTotal(a);
          const totalB = calculateOrderTotal(b);
          comparison = totalA - totalB;
        } else if (sortConfig.key === 'created_date') {
          comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (sortConfig.key === 'items') {
          comparison = (a.items?.length || 0) - (b.items?.length || 0);
        } else {
          if (aValue < bValue) comparison = -1;
          if (aValue > bValue) comparison = 1;
        }
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }

    return sortableItems;
  }, [orders, statusFilter, columnFilters, households, householdLeads, users, language, sortConfig, calculateOrderTotal, dateRange]);

  const handleStatusToggle = (status) => {
    setStatusFilter(prev => {
      const newFilter = new Set(prev);
      
      if (status === 'all') {
        const currentlyAllSelected = ALL_POSSIBLE_STATUSES.every(s => newFilter.has(s));
        if (currentlyAllSelected) {
          newFilter.clear(); // If all are selected, clear to select none
        } else {
          newFilter.clear(); // If not all are selected, clear and add all individual statuses
          ALL_POSSIBLE_STATUSES.forEach(s => newFilter.add(s));
        }
      } else {
        if (newFilter.has(status)) {
          newFilter.delete(status);
        } else {
          newFilter.add(status);
        }
      }
      return newFilter;
    });
  };

  const exportToExcel = useCallback(() => {
    const headers = [
      t('vendor.orderManagement.orderId'),
      t('vendor.orderManagement.date'),
      t('vendor.orderManagement.leadCustomer') + ' (' + t('common.name') + ' & ' + t('common.phone') + ')',
      t('admin.dashboard.tabs.households'),
      t('vendor.orderManagement.address'),
      t('vendor.orderManagement.neighborhood'),
      t('vendor.orderManagement.deliveryDetails'),
      t('vendor.orderManagement.total'),
      t('vendor.orderManagement.picker'),
      t('vendor.orderManagement.items') + ' ' + t('common.count'),
      t('vendor.orderManagement.deliveryDetails'),
      t('vendor.orderManagement.status')
    ];

    const csvData = processedOrders.map(order => {
      const deliveryDetails = [
        order.delivery_time ? `Time: ${formatDeliveryTime(order.delivery_time, language)}` : '',
        order.delivery_notes ? `Notes: ${order.delivery_notes}` : '',
        order.entrance_code ? `Code: ${order.entrance_code}` : ''
      ].filter(Boolean).join(' | ');

      return [
        order.order_number,
        format(new Date(order.created_date), "yyyy-MM-dd HH:mm"),
        `${order.display_name} (${order.display_phone || 'N/A'})`,
        order.household_name,
        order.delivery_address || '',
        order.neighborhood || '',
        deliveryDetails,
        `₪${calculateOrderTotal(order).toFixed(2)}`,
        order.picker_name || '',
        order.items?.length || 0,
        order.delivery_time ? formatDeliveryTime(order.delivery_time, language) : '',
        getStatusLabel(order.status)
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`.replace(/\n/g, '\\n')).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vendor-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [processedOrders, t, calculateOrderTotal, formatDeliveryTime, getStatusLabel, language]);

  const exportToHTML = useCallback(() => {
    const ordersForExport = processedOrders.map(order => ({
      ...order,
      created_date_formatted: format(new Date(order.created_date), "MMM d, h:mm a"),
      total_amount_formatted: `₪${calculateOrderTotal(order).toFixed(2)}`,
      items_summary: getItemsSummary(order.items),
      status_label: getStatusLabel(order.status),
      deliveryDetails: [
        order.delivery_time ? `Time: ${order.delivery_time}` : '',
        order.delivery_notes ? `Notes: ${order.delivery_notes}` : ''
      ].filter(Boolean).join(' | ')
    }));

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="${isRTL ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('vendor.orderManagement.title')} - ${format(new Date(), 'yyyy-MM-dd')}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                direction: ${isRTL ? 'rtl' : 'ltr'};
                margin: 20px;
                font-size: 12px;
            }
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 30px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: ${isRTL ? 'right' : 'left'};
                vertical-align: top;
            }
            th {
                background-color: #f2f2f2;
                font-weight: bold;
            }
            .status-pending { background-color: #e3f2fd; }
            .status-follow_up { background-color: #e0f7fa; } /* Added follow_up styling */
            .status-shopping { background-color: #fff3e0; }
            .status-ready_for_shipping { background-color: #f3e5f5; }
            .status-delivery { background-color: #fff8e1; }
            .status-delivered { background-color: #e8f5e8; }
            .status-cancelled { background-color: #ffebee; }
            .total-row {
                font-weight: bold;
                background-color: #f0f0f0;
                border-top: 2px solid #333;
            }
            .center { text-align: center; }
            .small-text { font-size: 10px; color: #666; }
        </style>
    </head>
    <body>
        <h1>${t('vendor.orderManagement.title')} - ${format(new Date(), 'yyyy-MM-dd')}</h1>
        <p><strong>${t('vendor.orderManagement.totalOrders')}:</strong> ${ordersForExport.length}</p>

        <table>
            <thead>
                <tr>
                    <th>${t('vendor.orderManagement.date')}</th>
                    <th>${t('vendor.orderManagement.orderId')}</th>
                    <th>${t('vendor.orderManagement.leadCustomer')}</th>
                    <th>${t('vendor.orderManagement.householdAddress')}</th>
                    <th>${t('vendor.orderManagement.neighborhood')}</th>
                    <th>${t('vendor.orderManagement.deliveryTime')}</th>
                    <th>${t('vendor.orderManagement.total')}</th>
                    <th>${t('vendor.orderManagement.picker')}</th>
                    <th>${t('vendor.orderManagement.items')}</th>
                    <th>${t('vendor.orderManagement.status')}</th>
                </tr>
            </thead>
            <tbody>
                ${ordersForExport.map(order => `
                    <tr class="status-${order.status}">
                        <td>${order.created_date_formatted}</td>
                        <td><strong>${order.order_number}</strong></td>
                        <td>
                            <strong>${order.display_name}</strong><br>
                            <span class="small-text">${order.display_phone || 'N/A'}</span>
                        </td>
                        <td>
                            ${order.household_name ? `<strong>#${order.household_code}</strong><br><strong>${order.household_name}</strong><br>` : ''}
                            <span class="small-text">${order.delivery_address}</span>
                        </td>
                        <td>${order.neighborhood || 'N/A'}</td>
                        <td>
                            ${order.delivery_time ? `🕒 ${formatDeliveryTime(order.delivery_time, language)}<br>` : ''}
                            ${order.street ? `${order.street} ${order.building_number}, ${order.household_number}<br>` : ''}
                            ${order.entrance_code ? `🔑 ${order.entrance_code}` : ''}
                        </td>
                        <td><strong>${order.total_amount_formatted}</strong></td>
                        <td>${order.picker_name || 'N/A'}</td>
                        <td class="center">${order.items_summary}</td>
                        <td class="center">${order.status_label}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 30px; text-align: center; color: #666; font-size: 10px;">
            Generated on ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
        </div>
    </body>
    </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vendor-orders-${format(new Date(), 'yyyy-MM-dd')}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [processedOrders, isRTL, t, language, calculateOrderTotal, formatDeliveryTime, getItemsSummary, getStatusLabel]);

  const handleModalOrderUpdate = (updatedOrder) => {
    onOrderUpdate(updatedOrder);
    setViewingOrder(prev => prev ? { ...prev, ...updatedOrder } : null);
  };

  const tableColumns = useMemo(() => {
    const SortableHeader = ({ sortKey, label }) => {
      const isSorted = sortConfig.key === sortKey;
      const direction = sortConfig.direction;
      return (
        <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900">
          {label}
          {isSorted && (direction === 'ascending' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
        </button>
      );
    };

    const columns = [
      {
        id: 'actions',
        header: () => <th className={`py-3 px-4 font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>{t('vendor.orderManagement.actions')}</th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => (
          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
             <div className="flex flex-wrap gap-2">
             
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPOPDF(order.id)}
                  disabled={generatingPdfId === order.id}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  title={t('admin.orderManagement.downloadPOPdf', 'Download Purchase Order as PDF')}
                >
                  {generatingPdfId === order.id ? (
                    <Loader2 className="w-4 h-4 ltr:mr-1 rtl:ml-1 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                  )}
                  {t('vendor.orderManagement.poShort', 'PO')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportOrderItemsCSV(order)}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                title={t('vendor.orderManagement.exportOrderItems', 'Export Items CSV')}
              >
                <Download className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                {t('vendor.orderManagement.items', 'Items')}
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChatDialog(order)}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  title={t('vendor.orderManagement.chat')}
              >
                <MessageCircle className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
              </Button>
              {(order.status === "pending" || order.status === "follow_up") && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  title={t('vendor.orderManagement.startProcessing')} 
                  onClick={() => handleStartProcessing(order.id)} 
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <UserCheck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                 
                </Button>
              )}
              {order.status === "shopping" && (
                <Button variant="outline" size="sm" title={t('vendor.orderManagement.ready')} onClick={() => handleMarkAsReady(order.id)} className="text-purple-600 border-purple-300 hover:bg-purple-50">
                  <PackageCheck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                </Button>
              )}
              {order.status === "ready_for_shipping" && (
                <Button variant="outline" size="sm" title={t('vendor.orderManagement.ship')} onClick={() => handleMarkAsShipped(order.id)} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                  <Truck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                </Button>
              )}
              {order.status === "delivery" && (
                  <Button variant="outline" size="sm" title={t('vendor.orderManagement.markAsDelivered', 'Mark as Delivered')} onClick={() => handleMarkAsDelivered(order.id)} className="text-green-600 border-green-300 hover:bg-green-50">
                    <CheckCircle className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                    {t('vendor.orderManagement.delivered', 'Delivered')}
                  </Button>
                )}
              {(order.status === "ready_for_shipping" || order.status === "delivery"||order.status === "delivered") && (

                 <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadDeliveryPDF(order.id)}
                  disabled={generatingDeliveryPdfId === order.id}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  title={t('admin.orderManagement.downloadDeliveryPdf', 'Download Delivery Note as PDF')}
                >
                  {generatingDeliveryPdfId === order.id ? (
                    <Loader2 className="w-4 h-4 ltr:mr-1 rtl:ml-1 animate-spin" />
                  ) : (
                    <PackageCheck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                  )}
                  {t('vendor.orderManagement.deliverySlip', 'Slip')}
                </Button>
              )}



              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <Button variant="outline" size="sm" onClick={() => handleCancelOrder(order.id)} className="text-red-600 border-red-300 hover:bg-red-50" title={t('common.cancel', 'Cancel Order')}>
                  <XCircle className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('common.cancel')}
                </Button>
              )}
            </div>
          </td>
        ),
      },
      {
        id: 'date',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="created_date" label={t('vendor.orderManagement.date')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => (
          <td className="py-3 px-4 text-sm text-gray-600" >
            <div className="space-y-1">
              <div>{formatDate(new Date(order.created_date), "MMM d, h:mm a", language)}</div>
            </div>
          </td>
        ),
      },
     {
    id: 'delivery_notes',
    header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="created_date" label={t('vendor.orderManagement.deliveryNotes')} /></th>,
    filter: () => <td className="p-2"></td>,
    cell: (order) => {
    const maxLength = 20;
    const isLong = order.delivery_notes && order.delivery_notes.length > maxLength;
    const isExpanded = expandedNotes.has(order.id);

    const toggleExpanded = () => {
      const newExpanded = new Set(expandedNotes);
      if (isExpanded) {
        newExpanded.delete(order.id);
      } else {
        newExpanded.add(order.id);
      }
      setExpandedNotes(newExpanded);
    };

    const displayText = isLong && !isExpanded
      ? order.delivery_notes.substring(0, maxLength) + '...'
      : order.delivery_notes;

    return (
      <td onClick={(e) =>isLong? e.stopPropagation():e} className="py-3 px-4 text-sm text-gray-600">
        <div onClick={(e) => e.stopPropagation()}>
        <div  onClick={toggleExpanded}>
          {displayText}
         
          </div>
          </div>
      </td>
    );
  },
     },
      {
        id: 'leadCustomer',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="display_name" label={t('vendor.orderManagement.leadCustomer')} /></th>,
        filter: () => <td className="p-2"><Input placeholder={t('vendor.orderManagement.filterLeadCustomer')} className={`h-8 ${isRTL ? 'text-right' : 'text-left'}`} style={{ direction: isRTL ? 'rtl' : 'ltr' }} value={columnFilters.display_name} onChange={e => handleColumnFilterChange('display_name', e.target.value)} /></td>,
        cell: (order) => (
          <td className="py-3 px-4">
            <div className="text-sm">
              <div className="font-medium text-gray-900">{order.display_name}</div>
              <div className="text-gray-600 text-xs">{order.display_phone}</div>
            </div>
          </td>
        ),
      },
      {
        id: 'householdAddress',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="household_id" label={t('vendor.orderManagement.householdAddress')} /></th>,
        filter: () => <td className="p-2"><Input placeholder={t('vendor.orderManagement.filterHouseholdAddress')} className={`h-8 ${isRTL ? 'text-right' : 'text-left'}`} style={{ direction: isRTL ? 'rtl' : 'ltr' }} value={columnFilters.household_name} onChange={e => handleColumnFilterChange('household_name', e.target.value)} /></td>,
        cell: (order) => (
          <td className="py-3 px-4 text-sm max-w-xs">
            {order.household_name ? (
              <div>
                <div className="font-medium text-gray-900"> #{order.household_code}</div>
                <div className="font-medium text-gray-900">{order.household_name}</div>
                <div className="text-gray-600 text-xs mt-1 leading-tight">{order.delivery_address}</div>
              </div>
            ) : (
              <div className="text-gray-600 text-xs leading-tight">{order.delivery_address}</div>
            )}
          </td>
        ),
      },
      {
        id: 'neighborhood',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="neighborhood" label={t('vendor.orderManagement.neighborhood')} /></th>,
        filter: () => <td className="p-2"><Input placeholder={t('vendor.orderManagement.filterNeighborhood')} className={`h-8 ${isRTL ? 'text-right' : 'text-left'}`} style={{ direction: isRTL ? 'rtl' : 'ltr' }} value={columnFilters.neighborhood} onChange={e => handleColumnFilterChange('neighborhood', e.target.value)} /></td>,
        cell: (order) => (
          <td className="py-3 px-4 text-sm text-gray-600">
            {order.neighborhood || <span className="text-gray-400">N/A</span>}
            {order.street && <div className="text-gray-600 text-xs"> {order.street}  {order.building_number}, {order.household_number}</div>}
          </td>
        ),
      },
      {
        id: 'deliveryTime',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="delivery_time" label={t('vendor.orderManagement.deliveryTime')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => (
          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs" >
            <div className="space-y-1">
              {order.delivery_time && (
                <div className="flex items-center gap-1">
                  <div className="text-gray-900 font-medium text-xs">🕒 {formatDeliveryTime(order.delivery_time, language)}</div>
                  {(user?.user_type === 'admin' || user?.user_type === 'chief of staff' || user?.user_type === 'vendor') && (
                    <div onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditDeliveryDate(order)}
                      className="h-5 w-5 p-0 text-blue-500 hover:text-blue-700"
                      title={t('vendor.orderManagement.editDeliveryDate', 'Edit delivery date')}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    </div>
                  )}
                </div>
              )}
              {!order.delivery_time && (user?.user_type === 'admin' || user?.user_type === 'chief of staff' || user?.user_type === 'vendor') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditDeliveryDate(order)}
                  className="h-6 text-xs text-blue-500 hover:text-blue-700 p-1"
                  title={t('vendor.orderManagement.addDeliveryDate', 'Add delivery date')}
                >
                  + {t('vendor.orderManagement.addDelivery', 'Add delivery')}
                </Button>
              )}
            </div>
          </td>
        ),
      },
      {
        id: 'total',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="total_amount" label={t('vendor.orderManagement.total')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => <td className="py-3 px-4 font-semibold text-green-600">₪{calculateOrderTotal(order).toFixed(2)}</td>,
      },
      {
        id: 'picker',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="picker_name" label={t('vendor.orderManagement.picker')} /></th>,
        filter: () => <td className="p-2"><Input placeholder={t('vendor.orderManagement.filterPicker')} className={`h-8 ${isRTL ? 'text-right' : 'text-left'}`} style={{ direction: isRTL ? 'rtl' : 'ltr' }} value={columnFilters.picker_name} onChange={e => handleColumnFilterChange('picker_name', e.target.value)} /></td>,
        cell: (order) => <td className="py-3 px-4 text-sm text-gray-600">{order.picker_name || <span className="text-gray-400">N/A</span>}</td>,
      },
      {
        id: 'items',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="items" label={t('vendor.orderManagement.items')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => <td className="py-3 px-4 text-sm text-gray-600">{getItemsSummary(order.items)}</td>,
      },
      {
        id: 'status',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="status" label={t('vendor.orderManagement.status')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => (
          <td className="py-3 px-4">
            <Badge className={`${getStatusColor(order.status)} border text-xs`}>{getStatusLabel(order.status)}</Badge>
          </td>
        ),
      },
    ];

    if (isRTL) {
      return columns.reverse();
    }
    return columns;
  }, [
    isRTL,
    t,
    language,
    user?.user_type,
    generatingPdfId,
    generatingDeliveryPdfId,
    handleDownloadPOPDF,
    handleDownloadDeliveryPDF,
    handleExportOrderItemsCSV, // Added here
    handleOpenChatDialog,
    handleStartProcessing,
    handleMarkAsReady,
    handleMarkAsShipped,
    handleMarkAsDelivered,
    handleCancelOrder,
    getStatusLabel,
    getStatusColor,
    getItemsSummary,
    formatDeliveryTime,
    handleEditDeliveryDate,
    expandedNotes,
    setExpandedNotes,
    sortConfig,
    requestSort,
    columnFilters.display_name,
    columnFilters.household_name,
    columnFilters.neighborhood,
    columnFilters.picker_name,
    calculateOrderTotal
  ]);
  
  const isAllStatusesSelected = ALL_POSSIBLE_STATUSES.every(s => statusFilter.has(s));

  return (
    <>
      <Card>
        <CardHeader>
          <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 ltr:mr-2 rtl:ml-2" />
              {t('vendor.orderManagement.title')}
              <p className="text-sm text-green-800 ltr:ml-2 rtl:mr-2">{processedOrders.length}</p>
            </CardTitle>
            <div className={`flex flex-wrap items-center gap-1 sm:gap-2 ${isRTL ? 'justify-start lg:justify-start' : 'justify-start lg:justify-end'}`}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-2 sm:px-3"
                  >
                    <Package className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                    {isAllStatusesSelected ? t('vendor.orderManagement.allOrders') : `${statusFilter.size} ${t('common.selected')}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-2">
                    <div className="font-medium text-sm">{t('vendor.orderManagement.selectStatusesToShow')}:</div>
                    {[
                      { value: 'all', label: t('vendor.orderManagement.allOrders') },
                      { value: 'pending', label: t('vendor.orderManagement.statusLabels.pending') },
                      { value: 'follow_up', label: t('vendor.orderManagement.statusLabels.follow_up', 'Follow-Up Order') }, // Added 'follow_up' to the filter options
                      { value: 'shopping', label: t('vendor.orderManagement.statusLabels.shopping') },
                      { value: 'ready_for_shipping', label: t('vendor.orderManagement.statusLabels.ready_for_shipping') },
                      { value: 'delivery', label: t('vendor.orderManagement.statusLabels.delivery') },
                      { value: 'delivered', label: t('vendor.orderManagement.statusLabels.delivered') },
                      { value: 'cancelled', label: t('vendor.orderManagement.statusLabels.cancelled') }
                    ].map((status) => (
                      <label key={status.value} className={`flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-50 ${isRTL ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={status.value === 'all' ? isAllStatusesSelected : statusFilter.has(status.value)}
                          onChange={() => handleStatusToggle(status.value)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{status.label}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={`w-auto sm:w-[240px] justify-start text-left font-normal h-8 text-xs px-2 sm:px-3 ${!dateRange?.from && "text-muted-foreground"}`}
                  >
                    <CalendarIcon className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>{t('vendor.orderManagement.pickDeliveryDate', 'Pick delivery date')}</span>
                    )}
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

              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="flex items-center text-teal-600 border-teal-500 text-xs px-2 h-8"
              >
                <Download className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                <span className="hidden sm:inline">{t('vendor.orderManagement.exportCSV')}</span>
                <span className="sm:hidden">CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToHTML}
                className="flex items-center text-blue-600 border-blue-300 text-xs h-8"
              >
                <FileText className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                <span className="hidden sm:inline">{t('vendor.orderManagement.exportHTML')}</span>
                <span className="sm:hidden">HTML</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {tableColumns.map(col => <React.Fragment key={col.id}>{col.header()}</React.Fragment>)}
                </tr>
                <tr className="bg-gray-50 border-b">
                  {tableColumns.map(col => <React.Fragment key={col.id}>{col.filter()}</React.Fragment>)}
                </tr>
              </thead>
              <tbody>
                {processedOrders.length > 0 ? (
                  processedOrders.map((order) => {
                    return (
                      <tr
                        key={order.id}
                        className={`border-b hover:bg-gray-50 cursor-pointer ${
                          order.status === 'cancelled' ? 'bg-red-50 hover:bg-red-100' : ''
                        }`}
                        onClick={() => setViewingOrder(order)}
                      >
                       {tableColumns.map(col => <React.Fragment key={col.id}>{col.cell(order)}</React.Fragment>)}
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={tableColumns.length} className="text-center py-8 text-gray-500">
                      {t('vendor.orderManagement.noOrdersFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            <div className="p-2 bg-gray-50/80 border-b">
              <Input
                 placeholder={t('vendor.orderManagement.searchOrders', 'Search orders, household, address, neighborhood, customer name, phone...')}
                 className={`h-9 ${isRTL ? 'text-right' : 'text-left'}`}
                 style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                 value={columnFilters.household_name}
                 onChange={e => handleColumnFilterChange('household_name', e.target.value)}
              />
            </div>

            <div className="divide-y divide-gray-100">
              {processedOrders.length > 0 ? (
                processedOrders.map((order) => {
                  return (
                    <div
                      key={order.id}
                      className={`p-3 cursor-pointer hover:bg-gray-50 ${isRTL ? 'text-right' : 'text-left'} ${
                        order.status === 'cancelled' ? 'bg-red-50 hover:bg-red-100' : ''
                      }`}
                      onClick={() => setViewingOrder(order)}
                    >
                      {/* Row 1: Order ID, Date, Status */}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs text-gray-500">{formatDate(new Date(order.created_date), "MMM d, h:mm a", language)}</p>
                        </div>
                        <Badge className={`${getStatusColor(order.status)} border text-xs flex-shrink-0`}>{getStatusLabel(order.status)}</Badge>
                      </div>

                      {/* Main content grid */}
                      <div className={`grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-2 ${isRTL ? 'grid-flow-col-dense' : ''}`}>
                        {/* Left Column (or Right in RTL) */}
                        <div className={`space-y-2 ${isRTL ? 'col-start-2' : ''}`}>
                          <div>
                            <strong className="text-gray-800 block text-xs">{t('vendor.orderManagement.leadCustomer')}</strong>
                            <p className="font-medium truncate text-gray-700">{order.display_name}</p>
                            <p className="text-xs text-gray-500 truncate">{order.display_phone}</p>
                          </div>
                          <div>
                            <strong className="text-gray-800 block text-xs">{t('vendor.orderManagement.household')}</strong>
                            <p className="font-medium truncate text-gray-700">
                                {order.household_name ? `${order.household_name} (#${order.household_code})` : t('common.notAvailable')}
                            </p>
                          </div>
                        </div>

                        {/* Right Column (or Left in RTL) */}
                        <div className={`space-y-2 ${isRTL ? 'col-start-1 text-right' : 'text-left'}`}>
                          <div>
                            <strong className="text-gray-800 block text-xs">{t('vendor.orderManagement.total')}</strong>
                            <p className="font-semibold text-green-600">₪{calculateOrderTotal(order).toFixed(2)}</p>
                          </div>
                          <div>
                            <strong className="text-gray-800 block text-xs">{t('vendor.orderManagement.items')}</strong>
                            <p className="text-gray-600">{getItemsSummary(order.items)}</p>
                          </div>
                          <div>
                            <strong className="text-gray-800 block text-xs">{t('vendor.orderManagement.picker')}</strong>
                            <p className="text-gray-600">{order.picker_name || t('common.notAvailable')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Address and Delivery Info below the grid */}
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs space-y-1">
                        {order.neighborhood && (
                          <div className={isRTL ? "text-right" : "text-left"}>
                            <strong className="text-gray-800">{t('common.address')} </strong>
                            <span className="text-gray-600">{order.neighborhood} {order.street} {order.building_number}, {order.household_number})</span>
                          </div>
                        )}
                        {order.delivery_time && (
                          <div className={isRTL ? "text-right" : "text-left"}>
                            {isRTL ? (
                              <>
                                <span className="text-gray-600" dir="ltr">{formatDeliveryTime(order.delivery_time, language)}</span>
                                <strong className="text-gray-800"> {t('vendor.orderManagement.deliveryTime')}</strong>
                              </>
                            ) : (
                              <>
                                <strong className="text-gray-800">{t('vendor.orderManagement.deliveryTime')}</strong>
                                <span className="text-gray-600">{formatDeliveryTime(order.delivery_time, language)}</span>
                              </>
                            )}
                            {(user?.user_type === 'admin' || user?.user_type === 'chief of staff' || user?.user_type === 'vendor') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleEditDeliveryDate(order); }}
                                className="h-5 w-5 p-0 text-blue-500 hover:text-blue-700 ltr:ml-1 rtl:mr-1"
                                title={t('vendor.orderManagement.editDeliveryDate', 'Edit delivery date')}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        )}
                        {!order.delivery_time && (user?.user_type === 'admin' || user?.user_type === 'chief of staff' || user?.user_type === 'vendor') && (
                           <div className={isRTL ? "text-right" : "text-left"}>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={(e) => { e.stopPropagation(); handleEditDeliveryDate(order); }}
                               className="h-6 text-xs text-blue-500 hover:text-blue-700 p-1"
                               title={t('vendor.orderManagement.addDeliveryDate', 'Add delivery date')}
                             >
                               + {t('vendor.orderManagement.addDelivery', 'Add delivery')}
                             </Button>
                           </div>
                         )}
                        {order.entrance_code && (
                          <div className={isRTL ? "text-right" : "text-left"}>
                            {isRTL ? (
                              <>
                                <span className="text-gray-600" dir="ltr">{order.entrance_code}</span>
                                <strong className="text-gray-800"> {t('vendor.orderManagement.entranceCode')}</strong>
                              </>
                            ) : (
                              <>
                                <strong className="text-gray-800">{t('vendor.orderManagement.entranceCode')}</strong>
                                <span className="text-gray-600">{order.entrance_code}</span>
                              </>
                            )}
                          </div>
                        )}
{order.delivery_notes && (
  <div className={isRTL ? "text-right" : "text-left"}>
    <strong className="text-gray-800">
      {t('vendor.orderManagement.notes')}
    </strong>
    <span
      className="text-gray-600 ltr:ml-1 rtl:mr-1 break-words whitespace-normal"
      title={order.delivery_notes}
    >
      {order.delivery_notes}
    </span>
  </div>
)}

                      </div>

                      {/* Row 3: Action Buttons */}
                      <div className="flex gap-1 pt-2 border-t border-gray-100 flex-wrap justify-start mt-2" onClick={(e) => e.stopPropagation()}>
                        {(user?.user_type === 'admin' || user?.user_type === 'chief of staff') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingOrder(order)}
                            className="text-yellow-600 border-yellow-300 hover:bg-yellow-50 text-xs h-7 px-2"
                          >
                            <Edit className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            {t('common.edit')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPOPDF(order.id)}
                          disabled={generatingPdfId === order.id}
                          className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-7 px-2"
                          title={t('vendor.orderManagement.viewPO', 'View Purchase Order')}
                        >
                          {generatingPdfId === order.id ? (
                            <Loader2 className="w-3 h-3 ltr:mr-1 rtl:ml-1 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          )}
                          {t('vendor.orderManagement.poShort', 'PO')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportOrderItemsCSV(order)}
                          className="text-blue-600 border-blue-600 hover:bg-blue-50 text-xs h-7 px-2"
                          title={t('vendor.orderManagement.exportOrderItems', 'Export Items CSV')}
                        >
                          <Download className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          {t('vendor.orderManagement.items', 'Items')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenChatDialog(order)}
                          className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-7 px-2"
                        >
                          <MessageCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          {t('vendor.orderManagement.chat')}
                        </Button>
                        {(order.status === "pending" || order.status === "follow_up") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartProcessing(order.id)}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs h-7 px-2"
                          >
                            <UserCheck className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            {t('vendor.orderManagement.process', 'Process')}
                          </Button>
                        )}
                        {order.status === "shopping" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsReady(order.id)}
                            className="text-purple-600 border-purple-300 hover:bg-purple-50 text-xs h-7 px-2"
                          >
                            <PackageCheck className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            {t('vendor.orderManagement.ready')}
                          </Button>
                        )}
                        {order.status === "ready_for_shipping" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsShipped(order.id)}
                            className="text-orange-600 border-orange-300 hover:bg-orange-50 text-xs h-7 px-2"
                          >
                            <Truck className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            {t('vendor.orderManagement.ship')}
                          </Button>
                        )}
                        {order.status === "delivery" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsDelivered(order.id)}
                            className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-7 px-2"
                          >
                            <CheckCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            {t('vendor.orderManagement.delivered', 'Delivered')}
                          </Button>
                        )}
                        {(order.status === "ready_for_shipping" || order.status === "delivery") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDeliveryPDF(order.id)}
                            disabled={generatingDeliveryPdfId === order.id}
                            className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-7 px-2"
                            title={t('vendor.orderManagement.viewDeliveryNote', 'View Delivery Note')}
                          >
                            {generatingDeliveryPdfId === order.id ? (
                                <Loader2 className="w-3 h-3 ltr:mr-1 rtl:ml-1 animate-spin" />
                            ) : (
                                <PackageCheck className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            )}
                            {t('vendor.orderManagement.deliverySlip', 'Slip')}
                          </Button>
                        )}
                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelOrder(order.id)}
                            className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-7 px-2"
                          >
                            <XCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            {t('common.cancel')}
                          </Button>
                        )}


                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {t('vendor.orderManagement.noOrdersFound')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <OrderDetailsModal
        order={viewingOrder}
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        onOrderUpdate={handleModalOrderUpdate}
        onDownloadPO={(lang) => viewingOrder && handleDownloadPOPDF(viewingOrder.id)}
        onViewPOHTML={(lang) => viewingOrder && handleViewPOHTML(viewingOrder.id, lang)}
        onViewDeliveryHTML={() => viewingOrder && handleViewDeliveryHTML(viewingOrder.id)}
        onStartProcessing={() => viewingOrder && handleStartProcessing(viewingOrder.id)} // Add this prop
        onMarkAsReady={() => viewingOrder && handleMarkAsReady(viewingOrder.id)}
        onMarkAsShipped={() => viewingOrder && handleMarkAsShipped(viewingOrder.id)}
        onMarkAsDelivered={() => viewingOrder && handleMarkAsDelivered(viewingOrder.id)} // New prop
        onChatOpen={() => {
          if (viewingOrder) {
            handleOpenChatDialog(viewingOrder);
            setViewingOrder(null);
          }
        }}
        onCancelOrder={() => viewingOrder && handleCancelOrder(viewingOrder.id)}
        userType={user?.user_type}
      />
      {/* New ChatDialog Component */}
      <ChatDialog
        isOpen={showChatDialog}
        onClose={() => setShowChatDialog(false)}
        chatId={dialogChatId}
      />
      {/* Delivery Date Edit Modal */}
      <Dialog open={isDateEditModalOpen} onOpenChange={setIsDateEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('vendor.orderManagement.editDeliveryDate', 'Edit Delivery Date')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col space-y-4">
              <Calendar
                mode="single"
                selected={newDeliveryDate ? new Date(newDeliveryDate.split(' ')[0]) : undefined}
                onSelect={(date) => {
                  if (date) {
                    const timepart = newDeliveryDate && newDeliveryDate.includes(' ') 
                      ? newDeliveryDate.split(' ').slice(1).join(' ') 
                      : '09:00-17:00';
                    // Use format from date-fns to avoid timezone issues
                    const formattedDate = format(date, 'yyyy-MM-dd');
                    setNewDeliveryDate(`${formattedDate} ${timepart}`);
                  }
                }}
                className="rounded-md border"
              />
              <Input
                value={newDeliveryDate}
                onChange={(e) => setNewDeliveryDate(e.target.value)}
                placeholder="2025-01-15 09:00-17:00"
                className="w-full"
              />
            </div>
            <div className={`flex justify-end gap-2 pt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button variant="outline" onClick={handleCancelEditDeliveryDate}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveDeliveryDate}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
