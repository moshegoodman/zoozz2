import React, { useState, useMemo, useRef, useEffect } from "react";
import { Order, Product, Chat, Vendor } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight, Package, Loader2, CheckCheck,
  RefreshCw, Minus, Plus, Trash2, Shuffle, QrCode, MessageCircle,
  XCircle, Check, Info, X, Phone, MapPin, User, Calendar, Hash, Share2
} from "lucide-react";
import VendorChatDialog from "../chat/VendorChatDialog";
import OrderItemEditDialog from "./OrderItemEditDialog";
import AddItemToOrderModal from "./AddItemToOrderModal";

import { format } from "date-fns";
import { useLanguage } from "../i18n/LanguageContext";
import { generatePurchaseOrderPDF } from "@/functions/generatePurchaseOrderPDF";

export default function PickingSystem({ orders, vendorId, user, onRefresh }) {
  const { language } = useLanguage();
  const isHebrew = language === 'Hebrew';
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sortBy, setSortBy] = useState("date_desc");
  const [chatOrder, setChatOrder] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [editDialogItem, setEditDialogItem] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  // itemStates: { [product_id]: { actual_quantity, available } }
  const [itemStates, setItemStates] = useState({});
  const [productData, setProductData] = useState({});
  const [vendorCountry, setVendorCountry] = useState(null);
  const [itemSortMode, setItemSortMode] = useState('default');
  const [activeIdx, setActiveIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [detailsModalOrder, setDetailsModalOrder] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [slideAnim, setSlideAnim] = useState(null); // 'left' | 'right' | null
  const thumbnailRef = useRef(null);
  const orderStripRef = useRef(null);

  const pickableOrders = useMemo(() => {
    const filtered = orders.filter(o => ["pending", "confirmed", "shopping"].includes(o.status));
    const STATUS_ORDER = { shopping: 0, confirmed: 1, pending: 2 };
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "date_asc": return new Date(a.created_date) - new Date(b.created_date);
        case "date_desc": return new Date(b.created_date) - new Date(a.created_date);
        case "delivery_asc": return new Date(a.delivery_time || 0) - new Date(b.delivery_time || 0);
        case "delivery_desc": return new Date(b.delivery_time || 0) - new Date(a.delivery_time || 0);
        case "items_asc": return (a.items?.length || 0) - (b.items?.length || 0);
        case "items_desc": return (b.items?.length || 0) - (a.items?.length || 0);
        case "name_asc": return (a.household_name || a.user_email || "").localeCompare(b.household_name || b.user_email || "");
        case "name_desc": return (b.household_name || b.user_email || "").localeCompare(a.household_name || a.user_email || "");
        case "client_id_asc": return (a.household_code || "").localeCompare(b.household_code || "");
        case "client_id_desc": return (b.household_code || "").localeCompare(a.household_code || "");
        case "last_name_asc": {
          const la = (a.household_name || a.user_email || "").split(" ").pop() || "";
          const lb = (b.household_name || b.user_email || "").split(" ").pop() || "";
          return la.localeCompare(lb);
        }
        case "last_name_desc": {
          const la = (a.household_name || a.user_email || "").split(" ").pop() || "";
          const lb = (b.household_name || b.user_email || "").split(" ").pop() || "";
          return lb.localeCompare(la);
        }
        case "lead_name_asc": return (a.household_lead_name || "").localeCompare(b.household_lead_name || "");
        case "lead_name_desc": return (b.household_lead_name || "").localeCompare(a.household_lead_name || "");
        case "status": return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        default: return 0;
      }
    });
  }, [orders, sortBy]);

  // Auto-open first order on mount
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (!hasAutoOpened.current && pickableOrders.length > 0) {
      hasAutoOpened.current = true;
      openOrder(pickableOrders[0]);
    }
  }, [pickableOrders]);

  const handleOpenChat = async (order) => {
    const effectiveVendorId = vendorId || order.vendor_id;
    try {
      const chats = await Chat.filter({ vendor_id: effectiveVendorId, order_id: order.id });
      if (chats.length > 0) {
        setChatData(chats[0]);
      } else {
        const householdChats = order.household_id
          ? await Chat.filter({ vendor_id: effectiveVendorId, household_id: order.household_id })
          : [];
        if (householdChats.length > 0) {
          setChatData(householdChats[0]);
        } else {
          // Create a new chat for this order
          const newChat = await Chat.create({
            order_id: order.id,
            customer_email: order.user_email,
            vendor_id: effectiveVendorId,
            household_id: order.household_id || null,
            household_name: order.household_name || null,
            household_name_hebrew: order.household_name_hebrew || null,
            household_code: order.household_code || null,
            chat_type: "order_chat",
            messages: [],
            status: "active",
          });
          setChatData(newChat);
        }
      }
      setChatOrder(order);
    } catch (e) {
      console.error("Failed to load chat", e);
      setChatOrder(order);
      setChatData(null);
    }
  };

  const openOrder = async (order) => {
    const initial = {};
    (order.items || []).forEach(item => {
      initial[item.product_id] = {
        actual_quantity: item.actual_quantity ?? item.quantity,
        available: item.available !== false,
      };
    });
    setItemStates(initial);
    setActiveIdx(0);
    setItemSortMode('default');
    setSelectedOrder(order);

    // Fetch full product data (image, aisle, shelf, subcategory)
    try {
      const effectiveVendorId = vendorId || order.vendor_id;
      const products = effectiveVendorId ? await Product.filter({ vendor_id: effectiveVendorId }) : [];
      const data = {};
      products.forEach(p => {
        data[p.id] = { image_url: p.image_url, store_aisle: p.store_aisle, store_shelf: p.store_shelf, subcategory: p.subcategory };
      });
      setProductData(data);
    } catch (e) {
      console.error("Failed to load product data", e);
    }
  };

  const updateItem = (productId, patch) => {
    setItemStates(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch },
    }));
  };

  const rawItems = selectedOrder?.items || [];
  const items = useMemo(() => {
    if (itemSortMode === 'default') return rawItems;
    if (itemSortMode === 'category') {
      return [...rawItems].sort((a, b) => {
        const ca = productData[a.product_id]?.subcategory || a.subcategory || '';
        const cb = productData[b.product_id]?.subcategory || b.subcategory || '';
        return ca.localeCompare(cb);
      });
    }
    if (itemSortMode === 'aisle') {
      return [...rawItems].sort((a, b) => {
        const aa = productData[a.product_id]?.store_aisle || '';
        const ab = productData[b.product_id]?.store_aisle || '';
        const sa = productData[a.product_id]?.store_shelf || '';
        const sb = productData[b.product_id]?.store_shelf || '';
        return aa.localeCompare(ab) || sa.localeCompare(sb);
      });
    }
    return rawItems;
  }, [rawItems, itemSortMode, productData]);

  const activeItem = items[activeIdx];
  const activeState = activeItem ? (itemStates[activeItem.product_id] || { actual_quantity: activeItem.quantity, available: true }) : null;

  const scrollThumbnail = (idx) => {
    setActiveIdx(idx);
    const el = thumbnailRef.current?.children[idx];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    };

    const touchStartX = useRef(null);
    const [dragX, setDragX] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      setIsAnimating(false);
    };

    const handleTouchMove = (e) => {
      if (touchStartX.current === null || isAnimating) return;
      const delta = e.touches[0].clientX - touchStartX.current;
      setDragX(delta);
    };

    const handleTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      const threshold = 50;

      if (Math.abs(delta) > threshold) {
        const nextIdx = delta > 0 ? activeIdx - 1 : activeIdx + 1;
        if (nextIdx >= 0 && nextIdx < items.length) {
          setIsAnimating(true);
          const finalX = delta > 0 ? 400 : -400;
          setDragX(finalX);
          setTimeout(() => {
            scrollThumbnail(nextIdx);
            setDragX(0);
            setIsAnimating(false);
          }, 300);
        } else {
          setIsAnimating(true);
          setDragX(0);
          setTimeout(() => setIsAnimating(false), 300);
        }
      } else {
        setIsAnimating(true);
        setDragX(0);
        setTimeout(() => setIsAnimating(false), 200);
      }
      touchStartX.current = null;
    };

  const handleMarkReady = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      const updatedItems = selectedOrder.items.map(item => {
        const s = itemStates[item.product_id] || {};
        return {
          ...item,
          actual_quantity: s.actual_quantity ?? item.quantity,
          available: s.available !== false,
          shopped: true,
        };
      });
      await Order.update(selectedOrder.id, {
        items: updatedItems,
        status: "ready_for_shipping",
        picker_id: user?.id,
        picker_name: user?.full_name,
      });
      if (onRefresh) await onRefresh();
      setSelectedOrder(null);
      setItemStates({});
    } finally {
      setIsSaving(false);
    }
  };



  const handleSharePO = async (order) => {
    setIsSharing(true);
    try {
      // Use Hebrew for Israeli vendors (IL country code or if app is in Hebrew mode)
      const shareLanguage = (order.vendor_country === 'IL' || order.vendor_country === 'Israel' || isHebrew) ? 'Hebrew' : language;

      const response = await generatePurchaseOrderPDF({ order, language: shareLanguage });
      if (!response.data?.success || !response.data?.pdfBase64) {
        throw new Error(response.data?.error || 'PDF generation failed');
      }

      const binaryString = atob(response.data.pdfBase64.replace(/\s/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });

      const orderName = order.household_name || order.user_email || order.order_number;
      const shareTitle = shareLanguage === 'Hebrew'
        ? `הזמנת רכש עבור ${orderName} - #${order.order_number}`
        : `Purchase Order for ${orderName} - #${order.order_number}`;

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `PO-${order.order_number}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: shareTitle, files: [file] });
        } else {
          await navigator.share({ title: shareTitle, text: shareTitle });
        }
      } else {
        // Desktop fallback: download the PDF
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO-${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Share failed", e);
      alert(isHebrew ? 'שגיאה ביצירת PDF' : 'Failed to generate PDF');
    } finally {
      setIsSharing(false);
    }
  };

  const switchOrder = async (order) => {
    if (order.id === selectedOrder?.id) return;
    await openOrder(order);
  };

  const STATUS_LABELS = {
    pending: isHebrew ? "ממתין" : "Pending",
    confirmed: isHebrew ? "אושר" : "Confirmed",
    shopping: isHebrew ? "בליקוט" : "Picking",
  };
  const STATUS_COLORS = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    shopping: "bg-orange-100 text-orange-800",
  };

  // ── Order list view ──────────────────────────────────────────────
  if (!selectedOrder) {
    return (
      <div className="max-w-lg mx-auto px-2 pb-6" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {isHebrew ? `הזמנות לליקוט (${pickableOrders.length})` : `Orders to Pick (${pickableOrders.length})`}
          </h2>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="mb-4">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-ring w-full"
          >
            <option value="date_desc">{isHebrew ? "תאריך הזמנה: חדש ראשון" : "Order Date: Newest first"}</option>
            <option value="date_asc">{isHebrew ? "תאריך הזמנה: ישן ראשון" : "Order Date: Oldest first"}</option>
            <option value="delivery_asc">{isHebrew ? "תאריך משלוח: מוקדם ראשון" : "Delivery Date: Earliest first"}</option>
            <option value="delivery_desc">{isHebrew ? "תאריך משלוח: מאוחר ראשון" : "Delivery Date: Latest first"}</option>
            <option value="name_asc">{isHebrew ? "שם: א → ת" : "Name: A → Z"}</option>
            <option value="name_desc">{isHebrew ? "שם: ת → א" : "Name: Z → A"}</option>
            <option value="last_name_asc">{isHebrew ? "שם משפחה: א → ת" : "Last Name: A → Z"}</option>
            <option value="last_name_desc">{isHebrew ? "שם משפחה: ת → א" : "Last Name: Z → A"}</option>
            <option value="client_id_asc">{isHebrew ? "מזהה לקוח: עולה" : "Client ID: A → Z"}</option>
            <option value="client_id_desc">{isHebrew ? "מזהה לקוח: יורד" : "Client ID: Z → A"}</option>
            <option value="lead_name_asc">{isHebrew ? "שם ליד: א → ת" : "Lead Name: A → Z"}</option>
            <option value="lead_name_desc">{isHebrew ? "שם ליד: ת → א" : "Lead Name: Z → A"}</option>
            <option value="status">{isHebrew ? "סטטוס" : "Status"}</option>
            <option value="items_asc">{isHebrew ? "פריטים: מעט ראשון" : "Items: Fewest first"}</option>
            <option value="items_desc">{isHebrew ? "פריטים: הרבה ראשון" : "Items: Most first"}</option>
          </select>
        </div>

        {pickableOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CheckCheck className="w-14 h-14 mb-3" />
            <p className="font-semibold text-base">{isHebrew ? "הכל עדכני!" : "All caught up!"}</p>
            <p className="text-sm mt-1">{isHebrew ? "אין הזמנות הממתינות לליקוט." : "No orders waiting to be picked."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pickableOrders.map(order => {
              const picked = (order.items || []).filter(i => i.shopped).length;
              const total = (order.items || []).length;
              const pct = total ? Math.round((picked / total) * 100) : 0;

              return (
                <button
                  key={order.id}
                  onClick={() => openOrder(order)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-4 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm truncate">
                          {(isHebrew ? order.household_name_hebrew : null) || order.household_name || order.user_email}
                        </span>
                        <Badge className={`text-xs ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        #{order.order_number?.slice(-8)} · {total} {isHebrew ? "פריטים" : "items"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailsModalOrder(order); }}
                        className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-gray-400 mt-0.5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{picked}/{total} {isHebrew ? "נלקטו" : "picked"}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-orange-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Item picking view ────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto flex flex-col pb-20" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-3 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-bold text-gray-900 text-base flex-1">{isHebrew ? `הזמנות (${pickableOrders.length})` : `Orders (${pickableOrders.length})`}</h2>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="date_desc">{isHebrew ? "חדש ראשון" : "Newest"}</option>
            <option value="date_asc">{isHebrew ? "ישן ראשון" : "Oldest"}</option>
            <option value="delivery_asc">{isHebrew ? "משלוח ↑" : "Delivery ↑"}</option>
            <option value="delivery_desc">{isHebrew ? "משלוח ↓" : "Delivery ↓"}</option>
            <option value="name_asc">{isHebrew ? "שם א→ת" : "Name A→Z"}</option>
            <option value="name_desc">{isHebrew ? "שם ת→א" : "Name Z→A"}</option>
            <option value="last_name_asc">{isHebrew ? "שם משפחה א→ת" : "Last Name A→Z"}</option>
            <option value="last_name_desc">{isHebrew ? "שם משפחה ת→א" : "Last Name Z→A"}</option>
            <option value="client_id_asc">{isHebrew ? "מזהה לקוח ↑" : "Client ID ↑"}</option>
            <option value="client_id_desc">{isHebrew ? "מזהה לקוח ↓" : "Client ID ↓"}</option>
            <option value="lead_name_asc">{isHebrew ? "ליד א→ת" : "Lead A→Z"}</option>
            <option value="lead_name_desc">{isHebrew ? "ליד ת→א" : "Lead Z→A"}</option>
            <option value="status">{isHebrew ? "סטטוס" : "Status"}</option>
            <option value="items_asc">{isHebrew ? "פחות פריטים" : "Fewest items"}</option>
            <option value="items_desc">{isHebrew ? "יותר פריטים" : "Most items"}</option>
          </select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Horizontal scrollable order list */}
        <div ref={orderStripRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2">
          {pickableOrders.map(order => {
            const isSelected = order.id === selectedOrder?.id;
            const picked = (order.items || []).filter(i => i.shopped).length;
            const total = (order.items || []).length;
            return (
              <div
                key={order.id}
                className={`flex-shrink-0 text-left rounded-xl border-2 px-3 py-2 transition-all relative ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                style={{ minWidth: 160 }}
              >
                <button onClick={() => switchOrder(order)} className="w-full text-left">
                  <p className="text-xs text-gray-400 mb-0.5">{isHebrew ? "לקוח" : "Customer"}</p>
                  <p className="text-sm font-bold text-gray-900 truncate leading-tight pr-5">
                    {(isHebrew ? order.household_name_hebrew : null) || order.household_name || order.user_email}
                  </p>
                  <span className={`inline-block mt-1 mb-1 px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <p className="text-xs text-gray-400 mb-0.5">{isHebrew ? "תאריך משלוח" : "Delivery Date"}</p>
                  <p className="text-xs font-semibold text-gray-700 truncate">{order.delivery_time || "—"}</p>
                  <p className="text-xs text-gray-400 mt-1">{picked}/{total} {isHebrew ? "נלקטו" : "picked"}</p>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailsModalOrder(order); }}
                  className="absolute top-2 right-2 p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Item sort pills */}
        <div className="flex gap-1.5 mb-2">
          {[
            { mode: 'default', label: isHebrew ? 'ברירת מחדל' : 'Default' },
            { mode: 'category', label: isHebrew ? 'קטגוריה' : 'Category' },
            { mode: 'aisle', label: isHebrew ? 'מעבר' : 'Aisle' },
          ].map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => { setItemSortMode(mode); setActiveIdx(0); }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                itemSortMode === mode
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Thumbnail strip */}
        <div ref={thumbnailRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {items.map((item, idx) => {
            const s = itemStates[item.product_id] || {};
            const isActive = idx === activeIdx;
            const isFulfilled = s.available !== false && (s.actual_quantity ?? item.quantity) >= item.quantity;
            const isUnavailable = s.available === false;
            const isSubstituted = !!s.substitute_product_name;
            return (
              <button
                  key={item.product_id}
                  onClick={() => scrollThumbnail(idx)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    isActive ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                    : isUnavailable ? "border-red-400 bg-red-50"
                    : isSubstituted ? "border-orange-400 bg-orange-50"
                    : isFulfilled ? "border-green-400 bg-green-50"
                    : "border-gray-200 bg-white"
                  }`}
                style={{ minWidth: 64 }}
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                  {productData[item.product_id]?.image_url
                    ? <img src={productData[item.product_id].image_url} alt="" className="w-full h-full object-cover" />
                    : <Package className="w-5 h-5 text-gray-300" />}
                </div>
                <span className="text-xs font-bold text-gray-700">×{s.actual_quantity ?? item.quantity}</span>
                <span className="text-xs text-gray-500 leading-tight text-center max-w-[60px] truncate">
                  {item.product_name_hebrew || item.product_name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active item card */}
      {activeItem && activeState && (
        <div className="flex-1 px-3 pt-3 space-y-3">
          <div
          className={`bg-white rounded-2xl border-2 p-5 shadow-sm ${activeState.available === false ? "border-red-200 opacity-60" : "border-gray-100"}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateX(${dragX}px)`,
            transition: isAnimating ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            userSelect: 'none'
          }}
        >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1">
                {activeState.substitute_product_name ? (
                  <>
                    <h3 className="text-xl font-bold text-gray-400 line-through leading-tight">
                      {activeItem.product_name_hebrew || activeItem.product_name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Shuffle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <h3 className="text-xl font-bold text-orange-700 leading-tight">
                        {activeState.substitute_product_name}
                      </h3>
                    </div>
                  </>
                ) : (
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">
                    {activeItem.product_name_hebrew || activeItem.product_name}
                  </h3>
                )}
                {activeItem.subcategory && (
                  <p className="text-sm text-gray-500 mt-0.5">{activeItem.subcategory_hebrew || activeItem.subcategory}</p>
                )}
                {(productData[activeItem.product_id]?.store_aisle || productData[activeItem.product_id]?.store_shelf) && (
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    {isHebrew ? 'מעבר' : 'Aisle'}: {productData[activeItem.product_id]?.store_aisle || '—'}
                    {productData[activeItem.product_id]?.store_shelf && ` · ${isHebrew ? 'מדף' : 'Shelf'}: ${productData[activeItem.product_id].store_shelf}`}
                  </p>
                )}
              </div>
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {productData[activeItem.product_id]?.image_url
                  ? <img src={productData[activeItem.product_id].image_url} alt="" className="w-full h-full object-cover" />
                  : <Package className="w-7 h-7 text-gray-300" />}
              </div>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center justify-center gap-6 mb-2">
              <button
                onClick={() => updateItem(activeItem.product_id, { actual_quantity: Math.max(0, (activeState.actual_quantity || 0) - 1) })}
                className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Minus className="w-5 h-5 text-gray-700" />
              </button>
              <span className="text-5xl font-bold text-gray-900 w-16 text-center">
                {activeState.actual_quantity ?? activeItem.quantity}
              </span>
              <button
                onClick={() => updateItem(activeItem.product_id, { actual_quantity: (activeState.actual_quantity || 0) + 1 })}
                className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            <p className="text-center text-sm text-gray-500 mb-3">{isHebrew ? `הוזמן: ${activeItem.quantity} יחידות` : `Ordered: ${activeItem.quantity} units`}</p>

            {/* Price */}
            <p className="text-2xl font-bold text-green-600 mb-4">
              ₪{((activeState.actual_quantity ?? activeItem.quantity) * activeItem.price).toFixed(2)}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setEditDialogItem(activeItem)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors"
              >
                <Shuffle className="w-4 h-4" /> {isHebrew ? "הוסף תחליף" : "Add Substitute"}
              </button>
              <button
                onClick={() => updateItem(activeItem.product_id, { available: false, actual_quantity: 0 })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> {isHebrew ? "אזל מהמלאי" : "Out of Stock"}
              </button>
            </div>
          </div>


        </div>
      )}



      {/* Footer */}
      <div className="px-4 pt-4 pb-2 text-center border-t border-gray-100 mt-2">
        <p className="text-gray-400 text-xs">© {new Date().getFullYear()} Zoozz. All rights reserved.</p>
        <a href="/TermsOfService" className="text-xs text-gray-400 hover:text-green-600">Terms of Service</a>
      </div>

      {editDialogItem && (
        <OrderItemEditDialog
          isOpen={!!editDialogItem}
          onCancel={() => setEditDialogItem(null)}
          item={editDialogItem}
          onSave={(updatedItem) => {
            updateItem(updatedItem.product_id, updatedItem);
            setEditDialogItem(null);
          }}
          order={selectedOrder}
          vendorId={vendorId || selectedOrder?.vendor_id}
        />
      )}

      {showAddItem && (
        <AddItemToOrderModal
          isOpen={showAddItem}
          onClose={() => setShowAddItem(false)}
          vendorId={vendorId || selectedOrder?.vendor_id}
          onItemAdded={async (newItem) => {
            const updatedItems = [...(selectedOrder.items || []), newItem];
            const updatedOrder = await Order.update(selectedOrder.id, { items: updatedItems });
            setSelectedOrder({ ...selectedOrder, items: updatedItems });
            setItemStates(prev => ({
              ...prev,
              [newItem.product_id]: { actual_quantity: newItem.quantity, available: true }
            }));
            setShowAddItem(false);
            if (onRefresh) await onRefresh();
          }}
        />
      )}

      {detailsModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setDetailsModalOrder(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-3 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 80px)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 text-base">{isHebrew ? "פרטי הזמנה" : "Order Details"}</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSharePO(detailsModalOrder)}
                  disabled={isSharing}
                  className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  title={isHebrew ? "שתף הזמנת רכש" : "Share Purchase Order"}
                >
                  {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setDetailsModalOrder(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-semibold">{(isHebrew ? detailsModalOrder.household_name_hebrew : null) || detailsModalOrder.household_name || detailsModalOrder.user_email}</span>
              </div>
              {detailsModalOrder.household_code && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{detailsModalOrder.household_code?.slice(0, 4)}</span>
                </div>
              )}
              {detailsModalOrder.household_lead_name && (
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{detailsModalOrder.household_lead_name}</span>
                </div>
              )}
              {detailsModalOrder.household_lead_phone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`tel:${detailsModalOrder.household_lead_phone}`} className="text-blue-600 underline">{detailsModalOrder.household_lead_phone}</a>
                </div>
              )}
              {detailsModalOrder.delivery_time && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{detailsModalOrder.delivery_time}</span>
                </div>
              )}
              {(detailsModalOrder.street || detailsModalOrder.building_number) && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{[detailsModalOrder.street, detailsModalOrder.building_number, detailsModalOrder.neighborhood].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {chatOrder && (
        <VendorChatDialog
          isOpen={!!chatOrder}
          onClose={() => { setChatOrder(null); setChatData(null); }}
          chat={chatData}
          chatId={chatData ? undefined : undefined}
          user={user}
        />
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-3 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <div className="max-w-lg mx-auto flex gap-2 items-center">
          <button
            onClick={() => setShowAddItem(true)}
            className="flex flex-col items-center justify-center gap-0.5 w-12 flex-shrink-0 text-green-600 hover:text-green-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs">{isHebrew ? "הוסף" : "Add"}</span>
          </button>
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to CANCEL this order? This cannot be undone.\n\nהאם אתה בטוח שברצונך לבטל הזמנה זו? פעולה זו אינה ניתנת לביטול.")) {
                setIsSaving(true);
                try {
                  await Order.update(selectedOrder.id, { status: "cancelled" });
                  if (onRefresh) await onRefresh();
                  setSelectedOrder(null);
                  setItemStates({});
                } finally {
                  setIsSaving(false);
                }
              }
            }}
            disabled={isSaving}
            className="flex flex-col items-center justify-center gap-0.5 w-12 flex-shrink-0 text-gray-500 hover:text-red-500 transition-colors"
          >
            <XCircle className="w-5 h-5" />
            <span className="text-xs">{isHebrew ? "בטל" : "Cancel"}</span>
          </button>
          <button
            onClick={() => handleOpenChat(selectedOrder)}
            className="flex flex-col items-center justify-center gap-0.5 w-12 flex-shrink-0 text-blue-500 hover:text-blue-700 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs">{isHebrew ? "צ'אט" : "Chat"}</span>
          </button>
          <button
            onClick={handleMarkReady}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors disabled:opacity-50"
          >
            {isSaving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <>{isHebrew ? "מוכן למשלוח ✓" : "Mark Ready for Shipping"}</>

            }
          </button>
        </div>
      </div>
    </div>
  );
}