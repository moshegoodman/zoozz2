import React, { useMemo } from "react";
import { Package, MessageCircle, Clock, CheckCircle2, Truck, AlertCircle, ShoppingBag } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS_CONFIG = {
  pending:           { label: "Pending",          labelHe: "ממתין",        color: "bg-yellow-100 text-yellow-800" },
  confirmed:         { label: "Confirmed",         labelHe: "מאושר",        color: "bg-blue-100 text-blue-800" },
  shopping:          { label: "Shopping",          labelHe: "בקניות",       color: "bg-purple-100 text-purple-800" },
  ready_for_shipping:{ label: "Ready",             labelHe: "מוכן",         color: "bg-teal-100 text-teal-800" },
  delivery:          { label: "Delivery",          labelHe: "במשלוח",       color: "bg-orange-100 text-orange-800" },
  delivered:         { label: "Delivered",         labelHe: "נמסר",         color: "bg-green-100 text-green-800" },
  cancelled:         { label: "Cancelled",         labelHe: "בוטל",         color: "bg-red-100 text-red-800" },
};

export default function VendorOverview({ orders = [], chats = [], products = [], onTabChange }) {
  const { language } = useLanguage();
  const isHebrew = language === "Hebrew";

  const today = new Date().toDateString();

  const stats = useMemo(() => {
    const todayOrders = orders.filter(o => new Date(o.created_date).toDateString() === today);
    const pending = orders.filter(o => o.status === "pending").length;
    const active = orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;
    const unreadChats = chats.filter(c => {
      const last = c.messages?.[c.messages.length - 1];
      return last && last.sender_type !== "vendor" && !last.read;
    }).length;

    const byStatus = {};
    orders.forEach(o => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    return { todayOrders: todayOrders.length, pending, active, unreadChats, byStatus };
  }, [orders, chats]);

  const statCards = [
    { label: isHebrew ? "הזמנות היום" : "Today's Orders", value: stats.todayOrders, icon: Package, color: "text-blue-600", bg: "bg-blue-50", tab: "orders" },
    { label: isHebrew ? "ממתינות" : "Pending", value: stats.pending, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", tab: "picking" },
    { label: isHebrew ? "פעילות" : "Active", value: stats.active, icon: AlertCircle, color: "text-purple-600", bg: "bg-purple-50", tab: "orders" },
    { label: isHebrew ? "הודעות חדשות" : "Unread Chats", value: stats.unreadChats, icon: MessageCircle, color: "text-red-600", bg: "bg-red-50", tab: "chats" },
    { label: isHebrew ? "מוצרים" : "Products", value: products.length, icon: ShoppingBag, color: "text-green-600", bg: "bg-green-50", tab: "products" },
  ];

  return (
    <div className="p-4 space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(card => (
          <div
            key={card.label}
            onClick={() => onTabChange && onTabChange(card.tab)}
            className={`rounded-xl p-4 flex items-center gap-3 ${card.bg} ${onTabChange ? 'cursor-pointer active:opacity-70' : ''}`}
          >
            <card.icon className={`w-6 h-6 ${card.color} flex-shrink-0`} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Orders by Status */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {isHebrew ? "הזמנות לפי סטטוס" : "Orders by Status"}
        </h3>
        <div className="space-y-2">
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status] || { label: status, labelHe: status, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={status} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                  {isHebrew ? cfg.labelHe : cfg.label}
                </span>
                <span className="text-sm font-semibold text-gray-800">{count}</span>
              </div>
            );
          })}
          {Object.keys(stats.byStatus).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">{isHebrew ? "אין הזמנות" : "No orders"}</p>
          )}
        </div>
      </div>
    </div>
  );
}