import React, { useState, useMemo } from "react";
import { Order } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckCircle2, Circle, Package, User, ChevronRight,
  Loader2, CheckCheck, AlertCircle, RefreshCw
} from "lucide-react";

const STATUS_CONFIG = {
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800" },
  shopping: { label: "Picking", color: "bg-orange-100 text-orange-800" },
  ready_for_shipping: { label: "Ready", color: "bg-green-100 text-green-800" },
};

export default function PickingSystem({ orders, vendorId, user, onRefresh }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickedItems, setPickedItems] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Orders eligible for picking
  const pickableOrders = useMemo(() =>
    orders.filter(o => ["confirmed", "shopping"].includes(o.status))
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date)),
    [orders]
  );

  const openOrder = (order) => {
    setSelectedOrder(order);
    // Pre-populate already-picked items
    const initial = {};
    (order.items || []).forEach(item => {
      if (item.shopped) initial[item.product_id] = true;
    });
    setPickedItems(initial);
  };

  const toggleItem = (productId) => {
    setPickedItems(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const pickedCount = selectedOrder
    ? Object.values(pickedItems).filter(Boolean).length
    : 0;
  const totalItems = selectedOrder?.items?.length || 0;
  const allPicked = pickedCount === totalItems && totalItems > 0;

  const handleSaveProgress = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      const updatedItems = selectedOrder.items.map(item => ({
        ...item,
        shopped: !!pickedItems[item.product_id],
      }));
      await Order.update(selectedOrder.id, {
        items: updatedItems,
        status: "shopping",
      });
      if (onRefresh) await onRefresh();
      // Refresh local order
      setSelectedOrder(prev => ({ ...prev, items: updatedItems, status: "shopping" }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkReady = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      const updatedItems = selectedOrder.items.map(item => ({
        ...item,
        shopped: true,
      }));
      await Order.update(selectedOrder.id, {
        items: updatedItems,
        status: "ready_for_shipping",
        picker_id: user?.id,
        picker_name: user?.full_name,
      });
      if (onRefresh) await onRefresh();
      setSelectedOrder(null);
      setPickedItems({});
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

                  {/* Progress bar */}
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
    <div className="max-w-lg mx-auto pb-32">
      {/* Sticky header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-2 pt-2 pb-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(null); setPickedItems({}); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">
              {selectedOrder.household_name || selectedOrder.user_email}
            </p>
            <p className="text-xs text-gray-500">#{selectedOrder.order_number?.slice(-8)}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-gray-900">{pickedCount}/{totalItems}</p>
            <p className="text-xs text-gray-500">picked</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${allPicked ? "bg-green-500" : "bg-orange-400"}`}
            style={{ width: totalItems ? `${(pickedCount / totalItems) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="px-2 space-y-2">
        {(selectedOrder.items || []).map((item, idx) => {
          const isPicked = !!pickedItems[item.product_id];
          return (
            <button
              key={item.product_id || idx}
              onClick={() => toggleItem(item.product_id)}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                isPicked
                  ? "border-green-400 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isPicked ? "bg-green-500" : "bg-gray-100"
                }`}>
                  {isPicked
                    ? <CheckCircle2 className="w-5 h-5 text-white" />
                    : <Circle className="w-5 h-5 text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm leading-tight ${isPicked ? "text-green-800 line-through" : "text-gray-900"}`}>
                    {item.product_name_hebrew || item.product_name}
                  </p>
                  {item.product_name_hebrew && item.product_name && (
                    <p className={`text-xs mt-0.5 ${isPicked ? "text-green-600" : "text-gray-500"}`}>
                      {item.product_name}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-bold ${isPicked ? "text-green-700" : "text-gray-700"}`}>
                      × {item.quantity}
                    </span>
                    {item.quantity_per_unit && (
                      <span className={`text-xs ${isPicked ? "text-green-600" : "text-gray-500"}`}>
                        {item.quantity_per_unit}
                      </span>
                    )}
                    {item.subcategory && (
                      <span className={`text-xs ${isPicked ? "text-green-600" : "text-gray-400"}`}>
                        · {item.subcategory}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sticky bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2 z-20 safe-area-pb">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSaveProgress}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Progress"}
        </Button>
        <Button
          className={`flex-1 font-bold ${allPicked ? "bg-green-600 hover:bg-green-700" : "bg-gray-300 text-gray-500"} text-white`}
          onClick={handleMarkReady}
          disabled={!allPicked || isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <><CheckCheck className="w-4 h-4 mr-1" /> Mark Ready</>
          )}
        </Button>
      </div>
    </div>
  );
}