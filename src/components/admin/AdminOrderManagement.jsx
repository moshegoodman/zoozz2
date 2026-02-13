import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Order, Household, HouseholdStaff, User, Chat } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "../i18n/dateUtils";
import ChatDialog from "../chat/ChatDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Package,
  MessageCircle,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Truck,
  PackageCheck,
  Download,
  FileText,
  Loader2,
  Edit,
  XCircle,
  Trash2,
  Calendar as CalendarIcon,
  RefreshCcw, // Added RefreshCcw for uncancel functionality
  UserCheck, // Added UserCheck for start processing functionality
  ChevronLeft // Added for pagination
} from "lucide-react";


import { format, startOfDay } from 'date-fns';
import { generatePurchaseOrderPDF } from "@/functions/generatePurchaseOrderPDF";
import { debugPurchaseOrder } from "@/functions/debugPurchaseOrder";
import { generatePurchaseOrderHTML } from "@/functions/generatePurchaseOrderHTML";
import { generateDeliveryHTML } from "@/functions/generateDeliveryHTML";
import { generateDeliveryPDF } from "@/functions/generateDeliveryPDF";
import { useLanguage } from "../i18n/LanguageContext";
import OrderDetailsModal from "../vendor/OrderDetailsModal";
import { generateOrderNumber } from "@/components/OrderUtils";
import { sendOrderSMS } from "@/functions/sendOrderSMS";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteOrder } from "@/functions/deleteOrder";
import { Label } from "@/components/ui/label";

export default function AdminOrderManagement({ orders, onOrderUpdate, onChatOpen, user, onRefresh }) {
  const { t, language, isRTL } = useLanguage();
  const [selectedStatuses, setSelectedStatuses] = useState(new Set(['pending', 'follow_up', 'shopping', 'ready_for_shipping', 'delivery', 'delivered']));
  const [viewingOrder, setViewingOrder] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'descending' });
  const [columnFilters, setColumnFilters] = useState({
    order_number: '',
    display_name: '',
    household_name: '',
    picker_name: '',
    neighborhood: '',
    vendor_name: ''
  });
  const [dateRange, setDateRange] = useState(undefined);
  const [households, setHouseholds] = useState([]);
  const [householdLeads, setHouseholdLeads] = useState({});
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [downloadingPOId, setDownloadingPOId] = useState(null);
  const [viewingDeliveryHTMLId, setViewingDeliveryHTMLId] = useState(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [dialogChatId, setDialogChatId] = useState(null);
  const [generatingPdfId, setGeneratingPdfId] = useState(null);
  const [generatingDeliveryPdfId, setGeneratingDeliveryPdfId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);

  // State for expanded delivery notes
  const [expandedNotes, setExpandedNotes] = useState(new Set());

  // New states for delivery date editing
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(null);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [isDateEditModalOpen, setIsDateEditModalOpen] = useState(false);

  // New state for direct status change
  const [editingStatusOrderId, setEditingStatusOrderId] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [isStatusEditModalOpen, setIsStatusEditModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(100);

  useEffect(() => {
    const fetchAuxiliaryData = async () => {
      if (!orders || orders.length === 0) {
        setHouseholds([]);
        setHouseholdLeads({});
        setUsers([]);
        setVendors([]);
        return;
      }
      
      try {
        const householdIds = [...new Set(orders.map(o => o.household_id).filter(Boolean))];
        const userEmails = [...new Set(orders.map(o => o.user_email).filter(Boolean))];
        const vendorIds = [...new Set(orders.map(o => o.vendor_id).filter(Boolean))];

        // Fetch data with Promise.allSettled to handle rejections gracefully
        const results = await Promise.allSettled([
          householdIds.length > 0 ? Household.filter({ id: { $in: householdIds } }).catch(() => []) : Promise.resolve([]),
          householdIds.length > 0 ? HouseholdStaff.filter({ household_id: { $in: householdIds }, is_lead: true }).catch(() => []) : Promise.resolve([]),
          userEmails.length > 0 ? User.filter({ email: { $in: userEmails } }).catch(() => []) : Promise.resolve([]),
          vendorIds.length > 0 ? (async () => {
            const { Vendor } = await import("@/entities/all");
            return Vendor.filter({ id: { $in: vendorIds } }).catch(() => []);
          })() : Promise.resolve([])
        ]);

        // Extract values with safe defaults
        const householdsData = results[0].status === 'fulfilled' ? (results[0].value || []) : [];
        const staffLinks = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
        const usersData = results[2].status === 'fulfilled' ? (results[2].value || []) : [];
        const vendorsData = results[3].status === 'fulfilled' ? (results[3].value || []) : [];

        setHouseholds(Array.isArray(householdsData) ? householdsData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
        setVendors(Array.isArray(vendorsData) ? vendorsData : []);

        if (!Array.isArray(staffLinks) || staffLinks.length === 0) {
          setHouseholdLeads({});
          return;
        }

        const staffUserIds = staffLinks.map(link => link?.staff_user_id).filter(Boolean);
        if (staffUserIds.length === 0) {
          setHouseholdLeads({});
          return;
        }

        const staffUsers = await User.filter({ id: { $in: staffUserIds } }).catch(() => []);
        if (!Array.isArray(staffUsers) || staffUsers.length === 0) {
          setHouseholdLeads({});
          return;
        }

        const userMap = {};
        staffUsers.forEach(user => {
          if (user && user.id) {
            userMap[user.id] = user;
          }
        });

        const leadMap = {};
        staffLinks.forEach(link => {
          if (link && link.staff_user_id && link.household_id) {
            const user = userMap[link.staff_user_id];
            if (user) {
              const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.full_name || 'Name not set';
              leadMap[link.household_id] = {
                name: fullName,
                phone: user.phone || 'N/A'
              };
            }
          }
        });
        
        setHouseholdLeads(leadMap);
      } catch (error) {
        console.error("Failed to fetch households and leads:", error);
        setHouseholds([]);
        setHouseholdLeads({});
        setUsers([]);
        setVendors([]);
      }
    };
    
    fetchAuxiliaryData();
  }, [orders]);

  const convertToMilitaryTime = (timeString) => {
    if (!timeString) return '';

    const timeRangeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(-)\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
    const singleTimeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;

    const convertTimePartTo24Hour = (hour, minute, period) => {
      let h = parseInt(hour, 10);
      const m = parseInt(minute, 10);

      if (period) {
        if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period.toUpperCase() === 'AM' && h === 12) h = 0;
      }

      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const rangeMatch = timeRangeRegex.exec(timeString);
    if (rangeMatch) {
      const [, startHour, startMin, startPeriod, separator, endHour, endMin, endPeriod] = rangeMatch;
      const startTime = convertTimePartTo24Hour(startHour, startMin, startPeriod);
      const endTime = convertTimePartTo24Hour(endHour, endMin, endPeriod);
      return `${startTime}${separator}${endTime}`;
    }

    const singleMatch = singleTimeRegex.exec(timeString);
    if (singleMatch) {
      const [, hour, minute, period] = singleMatch;
      return convertTimePartTo24Hour(hour, minute, period);
    }

    return timeString;
  };

  const formatDeliveryTime = useCallback((deliveryTime, lang) => {
    if (!deliveryTime) return '';

    let datePartForDisplay = '';
    let timeStringForConversion = deliveryTime;

    const yyyyMmDdRegex = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/;
    const yyyyMmDdMatch = yyyyMmDdRegex.exec(deliveryTime);

    if (yyyyMmDdMatch) {
      const dateStr = yyyyMmDdMatch[1];
      timeStringForConversion = yyyyMmDdMatch[2].trim();
      try {
        const parts = dateStr.split('-').map(Number);
        const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        if (!isNaN(utcDate.getTime())) {
          const dateFormat = lang === 'Hebrew' ? 'd MMM' : 'MMM d';
          datePartForDisplay = formatDate(utcDate, dateFormat, lang);
        }
      } catch (e) {
        console.warn("Failed to parse YYYY-MM-DD date part:", e);
      }
    } else {
      const mmmDdRegex = /^([A-Za-z]{3})\s+(\d{1,2}),?\s*(.*)$/;
      const mmmDdMatch = mmmDdRegex.exec(deliveryTime);

      if (mmmDdMatch) {
        const monthStr = mmmDdMatch[1];
        const dayStr = mmmDdMatch[2];
        timeStringForConversion = mmmDdMatch[3].trim();

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

    if (datePartForDisplay && militaryTime) {
      return `${datePartForDisplay}, ${militaryTime}${tzSuffix}`;
    } else if (datePartForDisplay) {
      return datePartForDisplay;
    } else if (militaryTime && deliveryTime === timeStringForConversion) {
      return `${militaryTime}${tzSuffix}`;
    }

    return deliveryTime;
  }, []);


  const parseDateFromDeliveryTime = (deliveryTimeString) => {
    if (!deliveryTimeString) return null;
    const yyyyMmDdRegex = /^(\d{4}-\d{2}-\d{2})/;
    const match = deliveryTimeString.match(yyyyMmDdRegex);
    if (match && match[1]) {
        try {
            const parts = match[1].split('-').map(Number);
            const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            if (!isNaN(utcDate.getTime())) {
                return utcDate;
            }
        } catch (e) {
            return null;
        }
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

  const handleDirectStatusChange = useCallback((order) => {
    setEditingStatusOrderId(order.id);
    setNewStatus(order.status);
    setIsStatusEditModalOpen(true);
  }, []);

  const handleSaveStatusChange = useCallback(async () => {
    if (!editingStatusOrderId || !newStatus) return;
    
    try {
      await Order.update(editingStatusOrderId, { status: newStatus });
      
      const updatedOrder = await Order.get(editingStatusOrderId);
      onOrderUpdate(updatedOrder);
      
      if (viewingOrder && viewingOrder.id === editingStatusOrderId) {
        setViewingOrder(updatedOrder);
      }
      
      setIsStatusEditModalOpen(false);
      setEditingStatusOrderId(null);
      setNewStatus('');
      
      alert(t('admin.orderManagement.alerts.statusUpdated', 'Order status updated successfully.'));
    } catch (error) {
      console.error("Error updating order status:", error);
      alert(t('admin.orderManagement.alerts.statusUpdateFailed', 'Failed to update order status.'));
    }
  }, [editingStatusOrderId, newStatus, onOrderUpdate, viewingOrder, t]);

  const handleCancelStatusChange = useCallback(() => {
    setIsStatusEditModalOpen(false);
    setEditingStatusOrderId(null);
    setNewStatus('');
  }, []);


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
  }, [language, t]);


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
            alert(t("admin.orderManagement.alerts.allowPopupsHtml", "Please allow popups to view the HTML preview"));
          }
        }
      }
    } catch (error) {
      console.error("Error viewing Purchase Order HTML:", error);
      alert("Failed to generate Purchase Order HTML for viewing.");
    }
  }, [orders, t, language]);

  const generatePdfFromHtml = useCallback(async (htmlContent, filename = 'document.pdf') => {
    try {
      // CRITICAL: Wait for fonts to load before rendering to canvas
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      // Add a small delay to ensure fonts are fully rendered after loading
      await new Promise(resolve => setTimeout(resolve, 100));

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      // Ensure the container respects the page's RTL direction
      if (isRTL) {
        tempDiv.style.direction = 'rtl';
      }

      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '210mm'; // A4 width for rendering
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.padding = '20px';
      tempDiv.style.boxSizing = 'border-box';
      document.body.appendChild(tempDiv);

      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: 'white',
        allowTaint: true,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
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
        position = heightLeft - pdf.internal.pageSize.getHeight(); // Corrected for accurate page breaking
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(filename);

      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }, [isRTL]);

  const handleDownloadPOPDF = useCallback(async (fetchedOrder) => {
        if (!fetchedOrder) {
            alert("Please fetch an order first before running the PDF test.");
            return;
        }

        setGeneratingPdfId(fetchedOrder.id);
        try {
            const response = await generatePurchaseOrderPDF({
                order: fetchedOrder,
                language: language
            });

            console.log("--- Purchase Order PDF Test Response ---", response);
            
            if (response.data && response.data.success && response.data.pdfBase64) {
                // Clean the base64 string - remove any whitespace, newlines, etc.
                const cleanBase64 = response.data.pdfBase64.replace(/\s/g, '');
                
                // Validate that it's actually base64
                if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
                    console.error("Invalid base64 string received:", cleanBase64.substring(0, 100));
                    alert("Error: Received invalid PDF data from server. Please try again.");
                    return;
                }
                
                try {
                    // Convert base64 to blob and download
                    const binaryString = atob(cleanBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `PO-${fetchedOrder.order_number}-test.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    console.log("PDF Test: Success! PDF downloaded.");
                } catch (decodeError) {
                    console.error("Error decoding base64:", decodeError);
                    console.error("First 100 chars of cleaned base64:", cleanBase64.substring(0, 100));
                    alert(`Failed to decode PDF data: ${decodeError.message}`);
                }
            } else if (response.data && !response.data.success) {
                alert(`PDF Test: Failed. ${response.data.error || 'Unknown error'}. Check console for details.`);
            } else {
                alert("PDF Test: Unexpected response format. Check console for details.");
            }

        } catch (error) {
            console.error("--- Error testing Purchase Order PDF ---", error);
            const errorDetails = error.response ? error.response.data : { message: error.message };
            console.error("Detailed Error Payload:", errorDetails);
            alert(`Failed to generate PDF. See the developer console for detailed error information.`);
        } finally {
            setGeneratingPdfId(null);
        }
    }, [language]);

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

      if (response.data && response.data.success && response.data.pdfBase64) {
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

      console.error('Unexpected response from generateDeliveryPDF:', response);
      alert(`Failed to generate Delivery PDF: ${response.data?.error || 'Unknown error'}`);

    } catch (error) {
      console.error("Error generating Delivery PDF:", error);
      alert(`Failed to generate Delivery PDF: ${error.message || 'Unknown error'}`);
    } finally {
      setGeneratingDeliveryPdfId(null);
    }
  }, [orders, language]);

  const handleTestHTML = useCallback(async (orderId) => {
    alert(t("admin.orderManagement.alerts.generatingTestHtml"));
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
          alert(t("admin.orderManagement.alerts.allowPopupsHtml"));
        }
      }
    } catch (error) {
      console.error("Error testing HTML generation:", error);
      alert(t("admin.orderManagement.alerts.failedTestHtml", { message: error.message }));
    }
  }, [orders, t, language]);

  const handleTestPDFMonkey = useCallback(async (orderId) => {
    alert(t("admin.orderManagement.alerts.sendingTestPdfMonkey"));
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
          testType: 'pdfmonkey',
        });

        console.log("PDFMonkey Test Response:", response.data);
        alert(t("admin.orderManagement.alerts.pdfMonkeyTestComplete"));
      }
    } catch (error) {
      console.error("Error testing PDFMonkey:", error);
      alert(t("admin.orderManagement.alerts.failedTestPdfMonkey", { message: error.message }));
    }
  }, [orders, t, language]);

  const handleStartProcessing = useCallback(async (orderId) => {
    try {
      const latestOrder = await Order.get(orderId);
      if (!latestOrder) {
        console.warn(`Order with ID ${orderId} not found for starting processing.`);
        return;
      }

      await Order.update(orderId, {
        ...latestOrder,
        status: "shopping"
      });
      
      const updatedOrder = { ...latestOrder, status: "shopping" };
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(updatedOrder);
      }
    } catch (error) {
      console.error("Error starting order processing:", error);
      alert(t('admin.orderManagement.alerts.startProcessingFailed', 'Failed to start processing order.'));
    }
  }, [onOrderUpdate, viewingOrder, t]);

  const handleMarkAsReady = useCallback(async (orderId) => {
    try {
      const latestOrder = await Order.get(orderId);
      if (!latestOrder) {
        console.warn(`Order with ID ${orderId} not found for marking as ready.`);
        return;
      }

      await Order.update(orderId, {
        ...latestOrder,
        status: "ready_for_shipping"
      });

      const updatedOrder = { ...latestOrder, status: "ready_for_shipping" };
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(updatedOrder);
      }
    } catch (error) {
      console.error("Error marking order as ready for shipping:", error);
    }
  }, [onOrderUpdate, setViewingOrder, viewingOrder]);

  const handleMarkAsShipped = useCallback(async (orderId) => {
    try {
      const orderToUpdate = await Order.get(orderId);
      if (!orderToUpdate) {
        console.warn(`Order with ID ${orderId} not found for marking as shipped.`);
        return;
      }

      await Order.update(orderId, {
        ...orderToUpdate,
        status: "delivery"
      });

      const updatedOrder = { ...orderToUpdate, status: "delivery" };
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(prev => ({ ...prev, status: "delivery" }));
      }

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
          household_code: orderToUpdate.household_code,
          items: itemsNotFulfilled.map(item => ({
            ...item,
            shopped: false,
            available: true,
            modified: false,
            actual_quantity: null,
            substitute_product_id: null,
            substitute_product_name: null,
            vendor_notes: `Follow-up order for unfulfilled item from ${orderToUpdate.order_number}`
          })),
          total_amount: newTotal,
          status: "follow_up",
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
  }, [onOrderUpdate, setViewingOrder, viewingOrder, onRefresh, t]);

  const handleCancelOrder = useCallback(async (orderId) => {
    if (!window.confirm(t('admin.orderManagement.confirmCancel', 'Are you sure you want to cancel this order? This action cannot be undone.'))) {
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
      alert(t('admin.orderManagement.alerts.cancelFailed', 'Failed to cancel order.'));
    }
  }, [onOrderUpdate, setViewingOrder, viewingOrder, t]);

  const handleUncancelOrder = useCallback(async (orderId) => {
    if (!window.confirm(t('admin.orderManagement.confirmUncancel', 'Are you sure you want to uncancel this order? This will change the status back to pending.'))) {
      return;
    }
    try {
      await Order.update(orderId, { status: "pending" });
      const updatedOrder = await Order.get(orderId);
      onOrderUpdate(updatedOrder);
      if (viewingOrder && viewingOrder.id === orderId) {
        setViewingOrder(prev => ({ ...prev, status: "pending" }));
      }
      alert(t('admin.orderManagement.alerts.uncancelSuccess', 'Order has been uncancelled and set back to pending status.'));
    } catch (error) {
      console.error("Error uncancelling order:", error);
      alert(t('admin.orderManagement.alerts.uncancelFailed', 'Failed to uncancel order.'));
    }
  }, [onOrderUpdate, setViewingOrder, viewingOrder, t]);

  const handleDeleteOrder = useCallback(async (orderId) => {
    if (!window.confirm(t('admin.orderManagement.deleteConfirm', 'Are you sure you want to delete this order? This action cannot be undone and will permanently remove the order from the database.'))) {
      return;
    }

    setIsDeleting(orderId);
    try {
        const response = await deleteOrder({ order_id: orderId });
        if (response.data.success) {
            alert(t('admin.orderManagement.deleteSuccess', 'Order deleted successfully.'));
            onRefresh();
        } else {
            throw new Error(response.data.error || 'Unknown error occurred.');
        }
    } catch (error) {
        console.error(`Failed to delete order ${orderId}:`, error);
        alert(t('admin.orderManagement.deleteFailed', { error: error.message || 'Unknown error' }, 'Failed to delete order: {{error}}'));
    } finally {
        setIsDeleting(null);
    }
  }, [onRefresh, t]);

  const handleChatOpen = useCallback(async (order) => {
    if (!order) {
      console.error("No order provided for chat");
      return;
    }

    try {
      const existingChats = await Chat.filter({
        order_id: order.id,
        vendor_id: order.vendor_id
      });

      let chat;
      if (existingChats.length > 0) {
        chat = existingChats[0];
      } else {
        const currentUser = await User.me();

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
          }
        }

        const chatData = {
          order_id: order.id,
          customer_email: order.user_email,
          vendor_id: order.vendor_id,
          chat_type: "order_chat",
          ...householdInfo,
          messages: [{
            sender_email: currentUser.email,
            sender_type: "admin",
            message: t('admin.chat.initialOrderMessage', 'Hi, we are here to help with your order.'),
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
      console.error("Error opening/creating chat:", error);
      alert(t('admin.chat.failedToOpenChat', 'Failed to open chat'));
    }
  }, [setShowChatDialog, setDialogChatId, t]);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case "pending": return "bg-blue-100 text-blue-800 border-blue-200";
      case "follow_up": return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "shopping": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "ready_for_shipping": return "bg-purple-100 text-purple-800 border-purple-200";
      case "delivery": return "bg-orange-100 text-orange-800 border-orange-200";
      case "delivered": return "bg-green-100 text-green-800 border-green-200";
      case "cancelled": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }, []);

  const getStatusLabel = useCallback((status) => {
    return t(`admin.orderManagement.statusLabels.${status}`, status);
  }, [t]);

  const getItemsSummary = useCallback((items) => {
    const totalItems = items?.length || 0;
    const itemsWithActualQuantity = items?.filter(item =>
      item.actual_quantity !== null &&
      item.actual_quantity !== undefined &&
      item.actual_quantity > 0
    ).length || 0;
    return `${itemsWithActualQuantity}/${totalItems}`;
  }, []);

  const calculateOrderTotal = useCallback((order) => {
    const itemsTotal = order.items?.reduce((sum, item) => {
        const quantity = typeof item.actual_quantity === 'number' ? item.actual_quantity : item.quantity;
        return sum + (item.price * quantity);
    }, 0) || 0;
    const deliveryCost = order.delivery_price ?? 0;
    return itemsTotal + deliveryCost;
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

  const handleStatusToggle = (status) => {
    setSelectedStatuses(prev => {
      const newSelected = new Set(prev || []);
      
      if (status === 'all') {
        const allPossibleStatuses = ['pending', 'follow_up', 'shopping', 'ready_for_shipping', 'delivery', 'delivered', 'cancelled'];
        if (allPossibleStatuses.every(s => newSelected.has(s))) {
          newSelected.clear();
        } else {
          newSelected.clear();
          allPossibleStatuses.forEach(s => newSelected.add(s));
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
      
      const householdName = order.household_name ? order.household_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Order';
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
    let sortableItems = [...(orders || [])].map(order => {
        const household = order.household_id ? households.find(h => h.id === order.household_id) : null;
        const householdName = household ? ((language === 'Hebrew' && household.name_hebrew) || household.name || '') : '';
        const leadInfo = householdLeads[order.household_id];
        const vendor = vendors.find(v => v.id === order.vendor_id);
        const vendorName = vendor ? ((language === 'Hebrew' && vendor.name_hebrew) || vendor.name || t('common.unknownVendor')) : t('common.unknownVendor');

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
            vendor_name: vendorName,
        };
    });

    if (!selectedStatuses || selectedStatuses.size === 0) {
      sortableItems = [];
    } else {
      const allPossibleStatuses = ['pending', 'follow_up', 'shopping', 'ready_for_shipping', 'delivery', 'delivered', 'cancelled'];
      const hasAll = allPossibleStatuses.every(s => selectedStatuses.has(s));
      
      if (!hasAll) {
        sortableItems = sortableItems.filter(order => selectedStatuses.has(order.status));
      }
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
          order.display_name,
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
    if (columnFilters.neighborhood) {
      sortableItems = sortableItems.filter(order =>
        order.neighborhood?.toLowerCase().includes(columnFilters.neighborhood.toLowerCase())
      );
    }
    if (columnFilters.vendor_name) {
      sortableItems = sortableItems.filter(order =>
        order.vendor_name?.toLowerCase().includes(columnFilters.vendor_name.toLowerCase())
      );
    }

    if (dateRange?.from) {
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? startOfDay(dateRange.to) : fromDate;

        sortableItems = sortableItems.filter(order => {
            const deliveryDate = parseDateFromDeliveryTime(order.delivery_time);
            if (!deliveryDate) return false;
            
            const normalizedDeliveryDate = startOfDay(deliveryDate);

            return normalizedDeliveryDate >= fromDate && normalizedDeliveryDate <= toDate;
        });
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
        if (sortConfig.key === 'vendor_name') {
            const nameA = a.vendor_name || '';
            const nameB = b.vendor_name || '';
            const comparison = nameA.localeCompare(nameB);
            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;

        let comparison = 0;
        if (sortConfig.key === 'total_amount') {
          // Use the new calculation for sorting totals
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
  }, [orders, selectedStatuses, columnFilters, sortConfig, households, householdLeads, users, vendors, language, t, calculateOrderTotal, dateRange, parseDateFromDeliveryTime]);

  // Pagination calculations
  const totalPages = Math.ceil((processedOrders?.length || 0) / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const paginatedOrders = (processedOrders || []).slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatuses, columnFilters, dateRange]);

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

  const exportToExcel = () => {
    const headers = [
      t('vendor.orderManagement.orderId'),
      t('vendor.orderManagement.date'),
      t('admin.orderManagement.vendor'),
      t('vendor.orderManagement.leadCustomer') + ' (' + t('common.name') + ' & ' + t('common.phone') + ')',
      t('vendor.dashboard.tabs.households'),
      t('vendor.orderManagement.address'),
      t('vendor.orderManagement.neighborhood'),
      t('vendor.orderManagement.deliveryDetails'),
      t('vendor.orderManagement.total'),
      t('vendor.orderManagement.picker'),
      t('vendor.orderManagement.items') + ' ' + t('common.count'),
      t('vendor.orderManagement.deliveryTime'),
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
        order.vendor_name,
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
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `admin-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToHTML = () => {
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
        <title>${t('admin.orderManagement.title')} - ${format(new Date(), 'yyyy-MM-dd')}</title>
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
            .status-follow_up { background-color: #e0f7fa; }
            .status-shopping { background-color: #fff3e0; }
            .status-ready_for_shipping { background-color: #f3e5f5; }
            .status-delivery { background-color: #fff8e1; }
            .status-delivered { background-color: #e8f5e8; }
            .status-cancelled { background-color: #ffebee; }
            .center { text-align: center; }
            .small-text { font-size: 10px; color: #666; }
        </style>
    </head>
    <body>
        <h1>${t('admin.orderManagement.title')} - ${format(new Date(), 'yyyy-MM-dd')}</h1>
        <p><strong>${t('admin.orderManagement.totalOrders')}:</strong> ${ordersForExport.length}</p>

        <table>
            <thead>
                <tr>
                    <th>${t('vendor.orderManagement.date')}</th>
                    <th>${t('vendor.orderManagement.orderId')}</th>
                    <th>${t('admin.orderManagement.vendor')}</th>
                    <th>${t('vendor.orderManagement.leadCustomer')}</th>
                    <th>${t('vendor.orderManagement.householdAddress')}</th>
                    <th>${t('admin.orderManagement.neighborhood')}</th>
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
                        <td>${order.vendor_name}</td>
                        <td>
                            <strong>${order.display_name}</strong><br>
                            <span class="small-text">${order.display_phone || 'N/A'}</span>
                        </td>
                        <td>
                            ${order.household_name ? `<strong>#${order.household_code}</strong><br><strong>${order.household_name}</strong><br>` : ''}
                            <span class="small-text">${order.delivery_address || 'N/A'}</span>
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
    link.setAttribute('download', `admin-orders-${formatDate(new Date(), 'yyyy-MM-dd', language)}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        header: () => <th className={`py-3 px-4 font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.orderManagement.actions')}</th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => (
          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
             <div className="flex flex-wrap gap-2">

              {(user?.user_type === 'admin' ) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPOPDF(order)}
                  disabled={generatingPdfId === order.id}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  title={t('admin.orderManagement.downloadPOPdf', 'Download Purchase Order as PDF')}
                >
                  {generatingPdfId === order.id ? (
                    <Loader2 className="w-4 h-4 ltr:mr-1 rtl:ml-1 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                  )}
                  PDF
                </Button>
              )}
              {(order.status === "ready_for_shipping" || order.status === "delivery" || order.status === "delivered")  && (
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
                    <Truck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                  )}
                  {t('vendor.orderManagement.deliverySlip', 'Slip')}
                </Button>
              )}

              <Button variant="outline" size="sm" title={t('admin.orderManagement.chat')} onClick={() => handleChatOpen(order)} className="text-green-600 border-green-300 hover:bg-green-50">
                <MessageCircle className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
              </Button>
              
              {(user?.user_type === 'admin' || user?.user_type === 'chief of staff') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDirectStatusChange(order)}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  title={t('admin.orderManagement.changeStatus', 'Change Status')}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              
              {(order.status === "pending" || order.status === "follow_up") && (
                <Button variant="outline" size="sm" title={t('admin.orderManagement.startProcessing', 'Start Processing')} onClick={() => handleStartProcessing(order.id)} className="text-blue-600 border-blue-300 hover:bg-blue-50">
                  <UserCheck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                </Button>
              )}
              {order.status === "shopping" && (
                <Button variant="outline" size="sm" title={t('admin.orderManagement.ready')} onClick={() => handleMarkAsReady(order.id)} className="text-purple-600 border-purple-300 hover:bg-purple-50">
                  <PackageCheck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                </Button>
              )}
              {order.status === "ready_for_shipping" && (
                <Button variant="outline" size="sm" title={t('admin.orderManagement.ship')} onClick={() => handleMarkAsShipped(order.id)} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                  <Truck className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                </Button>
              )}
            
              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <Button variant="outline" size="sm" onClick={() => handleCancelOrder(order.id)} className="text-red-600 border-red-300 hover:bg-red-50" title={t('common.cancel', 'Cancel Order')}>
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
              {order.status === 'cancelled' && (
                <Button variant="outline" size="sm" onClick={() => handleUncancelOrder(order.id)} className="text-blue-600 border-blue-300 hover:bg-blue-50" title={t('admin.orderManagement.uncancel', 'Uncancel Order')}>
                  <RefreshCcw className="w-4 h-4" />
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportOrderItemsCSV(order)}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                title={t('admin.orderManagement.exportOrderItems', 'Export Items CSV')}
              >
                <Download className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                {t('common.items')} CSV
              </Button>

              {(user?.user_type === 'admin' || user?.user_type === 'chief of staff') && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => handleDeleteOrder(order.id)}
                  disabled={isDeleting === order.id}
                  title={t('admin.orderManagement.deleteOrder', 'Delete Order')}
                >
                  {isDeleting === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </td>
        ),
      },
      {
        id: 'date',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="created_date" label={t('admin.orderManagement.date')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => <td className="py-3 px-4 text-sm text-gray-600">{formatDate(new Date(order.created_date), "MMM d, h:mm a", language)} </td>,
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
  },      },
      {
        id: 'vendor',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="vendor_name" label={t('admin.orderManagement.vendor')} /></th>,
        filter: () => <td className="p-2"><Input placeholder={t('admin.orderManagement.filterVendor')} className="h-8" value={columnFilters.vendor_name} onChange={e => handleColumnFilterChange('vendor_name', e.target.value)} /></td>,
        cell: (order) => <td className="py-3 px-4 text-sm text-gray-900 font-medium">{order.vendor_name}</td>,
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
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="neighborhood" label={t('admin.orderManagement.neighborhood')} /></th>,
        filter: () => <td className="p-2"><Input placeholder={t('admin.orderManagement.filterNeighborhood')} className="h-8" value={columnFilters.neighborhood} onChange={e => handleColumnFilterChange('neighborhood', e.target.value)} /></td>,
        cell: (order) => <td className="py-3 px-4 text-sm text-gray-600">
        {order.neighborhood || <span className="text-gray-400">N/A</span>}
                      {order.street && <div className="text-gray-600 text-xs"> {order.street}  {order.building_number}, {order.household_number}</div>}

        </td>,
      },
      {
        id: 'deliveryTime',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="delivery_time" label={t('admin.orderManagement.deliveryTime')} /></th>,
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
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="total_amount" label={t('admin.orderManagement.total')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => <td className="py-3 px-4 font-semibold text-green-600">₪{calculateOrderTotal(order).toFixed(2)}</td>,
      },
      {
        id: 'picker',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="picker_name" label={t('admin.orderManagement.picker')} /></th>,
        filter: () => <td className="p-2"><Input placeholder={t('vendor.orderManagement.filterPicker')} className={`h-8 ${isRTL ? 'text-right' : 'text-left'}`} style={{ direction: isRTL ? 'rtl' : 'ltr' }} value={columnFilters.picker_name} onChange={e => handleColumnFilterChange('picker_name', e.target.value)} /></td>,
        cell: (order) => <td className="py-3 px-4 text-sm text-gray-600">{order.picker_name || <span className="text-gray-400">N/A</span>}</td>,
      },
      {
        id: 'items',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="items" label={t('admin.orderManagement.items')} /></th>,
        filter: () => <td className="p-2"></td>,
        cell: (order) => <td className="py-3 px-4 text-sm text-gray-600">{getItemsSummary(order.items)}</td>,
      },
      {
        id: 'status',
        header: () => <th className={`${isRTL ? 'text-right' : 'text-left'} py-3 px-4`}><SortableHeader sortKey="status" label={t('admin.orderManagement.status')} /></th>,
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
    handleViewPOHTML,
    handleDownloadPOPDF,
    handleDownloadDeliveryPDF,
    handleChatOpen,
    handleStartProcessing,
    handleMarkAsReady,
    handleMarkAsShipped,
    handleViewDeliveryHTML,
    viewingDeliveryHTMLId,
    handleCancelOrder,
    handleUncancelOrder,
    handleDeleteOrder,
    isDeleting,
    formatDeliveryTime,
    handleEditDeliveryDate,
    expandedNotes,
    setExpandedNotes,   getStatusLabel,
    getItemsSummary,
    getStatusColor,
    calculateOrderTotal,
    columnFilters.vendor_name,
    columnFilters.display_name,
    columnFilters.household_name,
    columnFilters.neighborhood,
    columnFilters.picker_name,
    requestSort,
    sortConfig,
    handleDirectStatusChange,
    handleExportOrderItemsCSV
  ]);

  return (
    <>
      <Card>
        <CardHeader>
          <div dir={isRTL? 'rtl' : 'ltr'} className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4`}>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 ltr:mr-2 rtl:ml-2" />
              {t('admin.orderManagement.title')}
              <p className="text-sm p-2 text-green-800">{processedOrders.length}</p>
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
                    {selectedStatuses.size === 0 ? t('admin.orderManagement.noOrdersSelected') : processedOrders.length === orders.length ? t('admin.orderManagement.allOrders') : `${selectedStatuses.size} ${t('common.selected')}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-2">
                    <div className="font-medium text-sm">{t('admin.orderManagement.selectStatusesToShow')}:</div>
                    {[
                      { value: 'all', label: t('admin.orderManagement.allOrders') },
                      { value: 'pending', label: t('admin.orderManagement.statusLabels.pending') },
                      { value: 'follow_up', label: t('admin.orderManagement.statusLabels.follow_up') },
                      { value: 'shopping', label: t('admin.orderManagement.statusLabels.shopping') },
                      { value: 'ready_for_shipping', label: t('admin.orderManagement.statusLabels.ready_for_shipping') },
                      { value: 'delivery', label: t('admin.orderManagement.statusLabels.delivery') },
                      { value: 'delivered', label: t('admin.orderManagement.statusLabels.delivered') },
                      { value: 'cancelled', label: t('admin.orderManagement.statusLabels.cancelled') }
                    ].map((status) => (
                      <label key={status.value} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={status.value === 'all' 
                            ? ['pending', 'follow_up', 'shopping', 'ready_for_shipping', 'delivery', 'delivered', 'cancelled'].every(s => selectedStatuses.has(s))
                            : selectedStatuses.has(status.value)}
                          onChange={() => handleStatusToggle(status.value)}
                          className="rounded border-gray-300"
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
                    className={`w-auto sm:w-[240px] justify-start text-left font-normal h-8 text-xs px-2 sm:px-3 ${!dateRange && "text-muted-foreground"}`}
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
              className="flex items-center gap-2 text-teal-600 border-teal-500"
            >
                <Download className="w-2 h-4" />
                {t('common.exportExcel', 'Export Excel')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToHTML}
                className="flex items-center gap-2 text-blue-600 border-blue-300"
              >
                <FileText className="w-3 h-4" />
                {t('common.exportHtml', 'Export HTML')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Pagination Controls - Top */}
          {totalPages > 1 && (
            <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t('common.next', 'Next')}
                </Button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    {t('admin.orderManagement.showing', 'Showing')} <span className="font-medium">{startIndex + 1}</span> {t('admin.orderManagement.to', 'to')} <span className="font-medium">{Math.min(endIndex, processedOrders.length)}</span> {t('admin.orderManagement.of', 'of')}{' '}
                    <span className="font-medium">{processedOrders.length}</span> {t('admin.orderManagement.results', 'results')}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md"
                    >
                      <span className="sr-only">{t('common.previous', 'Previous')}</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md"
                    >
                      <span className="sr-only">{t('common.next', 'Next')}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                </div>
              </div>
            </div>
          )}

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {tableColumns.map(col => col.header())}
                </tr>
                <tr className="bg-gray-50 border-b">
                  {tableColumns.map(col => col.filter())}
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order) => {
                    return (
                      <tr
                        key={order.id}
                        className={`border-b hover:bg-gray-50 cursor-pointer ${
                          order.status === 'cancelled' ? 'bg-red-50 hover:bg-red-100' : ''
                        }`}
                        onClick={() => setViewingOrder(order)}
                      >
                       {tableColumns.map(col => col.cell(order))}
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={tableColumns.length} className="text-center py-8 text-gray-500">
                      {t('admin.orderManagement.noOrdersFound')}
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
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => {
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
                      
                          <div className={isRTL ? "text-right" : "text-left"}>
                            <strong className="text-gray-800">{t('common.vendor')} </strong>
                            <span className="text-gray-600">{order.vendor_name}</span>
                          </div>
                       
                        {order.neighborhood && (
                          <div className={isRTL ? "text-right" : "text-left"}>
                            <strong className="text-gray-800">{t('common.address')} </strong>
                            <span className="text-gray-600">{order.neighborhood} {order.street} {order.building_number}, {order.household_number}</span>
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
                      </div>

                      {/* Row 3: Action Buttons */}
                      <div className="flex gap-1 pt-2 border-t border-gray-100 flex-wrap justify-start mt-2" onClick={(e) => e.stopPropagation()}>

                    <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPOHTML(order.id, language)}
                          className="text-indigo-600 border-indigo-300 hover:bg-indigo-50 text-xs h-7 px-2"
                          title={t('vendor.orderManagement.viewPO', 'View Purchase Order')}
                        >
                          <FileText className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          {t('vendor.orderManagement.poShort', 'PO')}
                        </Button>

                        {(user?.user_type === 'admin' || user?.user_type === 'chief of staff') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPOPDF(order.id)}
                            disabled={generatingPdfId === order.id}
                            className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-7 px-2"
                            title={t('admin.orderManagement.downloadPOPdf', 'Download Purchase Order as PDF')}
                          >
                            {generatingPdfId === order.id ? (
                              <Loader2 className="w-3 h-3 ltr:mr-1 rtl:ml-1 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            )}
                            PDF
                          </Button>
                        )}
                        {(user?.user_type === 'admin' || user?.user_type === 'chief of staff') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDeliveryPDF(order.id)}
                            disabled={generatingDeliveryPdfId === order.id}
                            className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-7 px-2"
                            title={t('admin.orderManagement.downloadDeliveryPdf', 'Download Delivery Note as PDF')}
                          >
                            {generatingDeliveryPdfId === order.id ? (
                              <Loader2 className="w-3 h-3 ltr:mr-1 rtl:ml-1 animate-spin" />
                            ) : (
                              <Truck className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            )}
                            {t('vendor.orderManagement.deliverySlip', 'Slip')}
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleChatOpen(order)}
                          className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-7 px-2"
                        >
                          <MessageCircle className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          {t('vendor.orderManagement.chat')}
                        </Button>
                        
                        {(user?.user_type === 'admin' || user?.user_type === 'chief of staff') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDirectStatusChange(order)}
                                className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs h-7 px-2"
                                title={t('admin.orderManagement.changeStatus', 'Change Status')}
                            >
                                <Edit className="w-3 h-3" />
                            </Button>
                        )}

                        {(order.status === "pending" || order.status === "follow_up") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartProcessing(order.id)}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs h-7 px-2"
                          >
                            <UserCheck className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                            {t('admin.orderManagement.startProcessing', 'Process')}
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
                        {(order.status === "ready_for_shipping" || order.status === "delivery") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDeliveryHTML(order.id)}
                            disabled={viewingDeliveryHTMLId === order.id}
                            className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-7 px-2"
                            title={t('vendor.orderManagement.viewDeliveryNote', 'View Delivery Note')}
                          >
                            {viewingDeliveryHTMLId === order.id ? (
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
                                title={t('common.cancel', 'Cancel Order')}
                            >
                                <XCircle className="w-3 h-3"/>
                            </Button>
                        )}
                        {order.status === 'cancelled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUncancelOrder(order.id)}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs h-7 px-2"
                            title={t('admin.orderManagement.uncancel', 'Uncancel Order')}
                          >
                            <RefreshCcw className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportOrderItemsCSV(order)}
                          className="text-blue-600 border-blue-600 hover:bg-blue-50 text-xs h-7 px-2"
                          title={t('admin.orderManagement.exportOrderItems', 'Export Items CSV')}
                        >
                          <Download className="w-3 h-3 ltr:mr-1 rtl:ml-1" />
                          {t('common.items')} CSV
                        </Button>
                        {(user?.user_type === 'admin' || user?.user_type === 'chief of staff') && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-7 px-2"
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={isDeleting === order.id}
                            title={t('admin.orderManagement.deleteOrder', 'Delete Order')}
                          >
                            {isDeleting === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
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

          {/* Pagination Controls - Bottom */}
          {totalPages > 1 && (
            <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t('common.next', 'Next')}
                </Button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    {t('admin.orderManagement.showing', 'Showing')} <span className="font-medium">{startIndex + 1}</span> {t('admin.orderManagement.to', 'to')} <span className="font-medium">{Math.min(endIndex, processedOrders.length)}</span> {t('admin.orderManagement.of', 'of')}{' '}
                    <span className="font-medium">{processedOrders.length}</span> {t('admin.orderManagement.results', 'results')}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md"
                    >
                      <span className="sr-only">{t('common.previous', 'Previous')}</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md"
                    >
                      <span className="sr-only">{t('common.next', 'Next')}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <OrderDetailsModal
        order={viewingOrder}
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        onOrderUpdate={handleModalOrderUpdate}
        onViewPOHTML={(lang) => viewingOrder && handleViewPOHTML(viewingOrder.id, lang)}
        onDownloadPOPDF={() => viewingOrder && handleDownloadPOPDF(viewingOrder.id)}
        onDownloadDeliveryPDF={() => viewingOrder && handleDownloadDeliveryPDF(viewingOrder.id)}
        isGeneratingDeliveryPDF={generatingDeliveryPdfId === viewingOrder?.id}
        onViewDeliveryHTML={() => viewingOrder && handleViewDeliveryHTML(viewingOrder.id)}
        onStartProcessing={() => viewingOrder && handleStartProcessing(viewingOrder.id)}
        onMarkAsReady={() => viewingOrder && handleMarkAsReady(viewingOrder.id)}
        onMarkAsShipped={() => viewingOrder && handleMarkAsShipped(viewingOrder.id)}
        onChatOpen={() => {
          if (viewingOrder) {
            handleChatOpen(viewingOrder);
            setViewingOrder(null);
          }
        }}
        onCancelOrder={() => viewingOrder && handleCancelOrder(viewingOrder.id)}
        onUncancelOrder={() => viewingOrder && handleUncancelOrder(viewingOrder.id)}
        onDeleteOrder={() => viewingOrder && handleDeleteOrder(viewingOrder.id)}
        onChangeStatus={() => viewingOrder && handleDirectStatusChange(viewingOrder)}
        onExportOrderItemsCSV={() => viewingOrder && handleExportOrderItemsCSV(viewingOrder)}
        isDeleting={isDeleting === viewingOrder?.id}
        user={user}
      />
       <ChatDialog
        isOpen={showChatDialog}
        onClose={() => setShowChatDialog(false)}
        chatId={dialogChatId}
      />
       {/* Status Edit Modal */}
      <Dialog open={isStatusEditModalOpen} onOpenChange={setIsStatusEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('admin.orderManagement.changeOrderStatus', 'Change Order Status')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('admin.orderManagement.selectNewStatus', 'Select New Status')}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.orderManagement.chooseStatus', 'Choose status...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('admin.orderManagement.statusLabels.pending', 'Pending')}</SelectItem>
                  <SelectItem value="follow_up">{t('admin.orderManagement.statusLabels.follow_up', 'Follow Up')}</SelectItem>
                  <SelectItem value="shopping">{t('admin.orderManagement.statusLabels.shopping', 'Shopping')}</SelectItem>
                  <SelectItem value="ready_for_shipping">{t('admin.orderManagement.statusLabels.ready_for_shipping', 'Ready for Shipping')}</SelectItem>
                  <SelectItem value="delivery">{t('admin.orderManagement.statusLabels.delivery', 'In Delivery')}</SelectItem>
                  <SelectItem value="delivered">{t('admin.orderManagement.statusLabels.delivered', 'Delivered')}</SelectItem>
                  <SelectItem value="cancelled">{t('admin.orderManagement.statusLabels.cancelled', 'Cancelled')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                {t('admin.orderManagement.statusChangeWarning', 'This will change the status directly without sending notifications or triggering automations.')}
              </p>
            </div>
            <div className={`flex justify-end gap-2 pt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button variant="outline" onClick={handleCancelStatusChange}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveStatusChange}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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