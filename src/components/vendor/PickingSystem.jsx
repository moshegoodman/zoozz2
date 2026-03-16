import React, { useState, useMemo, useRef } from "react";
import { Order, Product } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ChevronRight, Package, Loader2, CheckCheck,
  RefreshCw, Minus, Plus, Trash2, Shuffle, QrCode, MessageCircle,
  XCircle, Check
} from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800" },
  shopping: { label: "Picking", color: "bg-orange-100 text-orange-800" },
};

export default function PickingSystem({ orders, vendorId, user, onRefresh, onOpenChat }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sortBy, setSortBy] = useState("date_asc"); // "date_asc", "date_desc", "items_asc", "items_desc", "name_asc", "name_desc"
  // itemStates: { [product_id]: { actual_quantity, available } }
  const [itemStates, setItemStates] = useState({});
  const [productImages, setProductImages] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const thumbnailRef = useRef(null);

  const pickableOrders = useMemo(() => {
    const filtered = orders.filter(o => ["pending", "confirmed", "shopping"].includes(o.status));
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "date_asc": return new Date(a.created_date) - new Date(b.created_date);
        case "date_desc": return new Date(b.created_date) - new Date(a.created_date);
        case "items_asc": return (a.items?.length || 0) - (b.items?.length || 0);
        case "items_desc": return (b.items?.length || 0) - (a.items?.length || 0);
        case "name_asc": return (a.household_name || a.user_email || "").localeCompare(b.household_name || b.user_email || "");
        case "name_desc": return (b.household_name || b.user_email || "").localeCompare(a.household_name || a.user_email || "");
        default: return 0;
      }
    });
  }, [orders, sortBy]);

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
    setSelectedOrder(order);

    // Fetch product images
    const productIds = (order.items || []).map(i => i.product_id).filter(Boolean);
    if (productIds.length > 0) {
      try {
        const products = await Product.filter({ vendor_id: vendorId });
        const images = {};
        products.forEach(p => { images[p.id] = p.image_url; });
        setProductImages(images);
      } catch (e) {
        console.error("Failed to load product images", e);
      }
    }
  };

  const updateItem = (productId, patch) => {
    setItemStates(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch },
    }));
  };

  const items = selectedOrder?.items || [];
  const activeItem = items[activeIdx];
  const activeState = activeItem ? (itemStates[activeItem.product_id] || { actual_quantity: activeItem.quantity, available: true }) : null;

  const scrollThumbnail = (idx) => {
    setActiveIdx(idx);
    const el = thumbnailRef.current?.children[idx];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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

  const handleSaveProgress = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      const updatedItems = selectedOrder.items.map(item => {
        const s = itemStates[item.product_id] || {};
        return {
          ...item,
          actual_quantity: s.actual_quantity ?? item.quantity,
          available: s.available !== false,
          shopped: s.available !== false,
        };
      });
      await Order.update(selectedOrder.id, { items: updatedItems, status: "shopping" });
      if (onRefresh) await onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  // ── Order list view ──────────────────────────────────────────────
  if (!selectedOrder) {
    return (
      <div className="max-w-lg mx-auto px-2 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Orders to Pick ({pickableOrders.length})
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
            <option value="date_asc">Date: Oldest first</option>
            <option value="date_desc">Date: Newest first</option>
            <option value="name_asc">Name: A → Z</option>
            <option value="name_desc">Name: Z → A</option>
            <option value="items_asc">Items: Fewest first</option>
            <option value="items_desc">Items: Most first</option>
          </select>
        </div>

        {pickableOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CheckCheck className="w-14 h-14 mb-3" />
            <p className="font-semibold text-base">All caught up!</p>
            <p className="text-sm mt-1">No orders waiting to be picked.</p>
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
                          {order.household_name || order.user_email}
                        </span>
                        <Badge className={`text-xs ${STATUS_CONFIG[order.status]?.color || "bg-gray-100 text-gray-700"}`}>
                          {STATUS_CONFIG[order.status]?.label || order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        #{order.order_number?.slice(-8)} · {total} items
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{picked}/{total} picked</span>
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
    <div className="max-w-lg mx-auto flex flex-col pb-28" style={{ minHeight: "80vh" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-3 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-bold text-gray-900 text-base flex-1">Order Details</h2>
        </div>

        {/* Order info grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-400">Customer</p>
            <p className="text-sm font-bold text-gray-900 truncate">{selectedOrder.household_name || selectedOrder.user_email}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-400">Delivery Date</p>
            <p className="text-sm font-bold text-gray-900">
              {selectedOrder.delivery_time || "—"}
            </p>
          </div>
        </div>

        {/* Thumbnail strip */}
        <div ref={thumbnailRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {items.map((item, idx) => {
            const s = itemStates[item.product_id] || {};
            const isActive = idx === activeIdx;
            const isFulfilled = s.available !== false && (s.actual_quantity ?? item.quantity) >= item.quantity;
            const isUnavailable = s.available === false;
            return (
              <button
                key={item.product_id}
                onClick={() => scrollThumbnail(idx)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                  isActive ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                  : isFulfilled ? "border-green-400 bg-green-50"
                  : "border-gray-200 bg-white"
                } ${isUnavailable ? "opacity-40" : ""}`}
                style={{ minWidth: 64 }}
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                  {productImages[item.product_id]
                    ? <img src={productImages[item.product_id]} alt="" className="w-full h-full object-cover" />
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
          <div className={`bg-white rounded-2xl border-2 p-5 shadow-sm ${activeState.available === false ? "border-red-200 opacity-60" : "border-gray-100"}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                  {activeItem.product_name_hebrew || activeItem.product_name}
                </h3>
                {activeItem.subcategory && (
                  <p className="text-sm text-gray-500 mt-0.5">{activeItem.subcategory_hebrew || activeItem.subcategory}</p>
                )}
              </div>
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {productImages[activeItem.product_id]
                  ? <img src={productImages[activeItem.product_id]} alt="" className="w-full h-full object-cover" />
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
            <p className="text-center text-sm text-gray-500 mb-3">Ordered: {activeItem.quantity} units</p>

            {/* Price */}
            <p className="text-2xl font-bold text-green-600 mb-4">
              ₪{((activeState.actual_quantity ?? activeItem.quantity) * activeItem.price).toFixed(2)}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => updateItem(activeItem.product_id, { available: true, actual_quantity: activeItem.quantity })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors"
              >
                <Shuffle className="w-4 h-4" /> Add Substitute
              </button>
              <button
                onClick={() => updateItem(activeItem.product_id, { available: false, actual_quantity: 0 })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Out of Stock
              </button>
            </div>
          </div>


        </div>
      )}

      {/* Barcode scan button */}
      <div className="px-4 mt-4">
        <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-gray-300 text-gray-700 font-semibold text-sm bg-white hover:bg-gray-50 transition-colors">
          <QrCode className="w-5 h-5" /> Scan Barcode
        </button>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
        <div className="max-w-lg mx-auto flex gap-2">
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to cancel this order?")) {
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
            className="flex flex-col items-center justify-center gap-0.5 w-14 flex-shrink-0 text-gray-500 hover:text-red-500 transition-colors"
          >
            <XCircle className="w-6 h-6" />
            <span className="text-xs">Cancel</span>
          </button>
          <button
            onClick={() => onOpenChat && onOpenChat(selectedOrder)}
            className="flex flex-col items-center justify-center gap-0.5 w-14 flex-shrink-0 text-blue-500 hover:text-blue-700 transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs">Chat</span>
          </button>
          <button
            onClick={handleMarkReady}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-base transition-colors disabled:opacity-50"
          >
            {isSaving
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><Check className="w-5 h-5" /> Complete Order</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}