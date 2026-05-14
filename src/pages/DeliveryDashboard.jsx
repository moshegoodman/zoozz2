import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, RefreshCw, AlertCircle, MapPin, CheckCircle2, Package } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageContext";
import DeliveryCard from "@/components/delivery/DeliveryCard";

export default function DeliveryDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === "Hebrew";
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [selectedRoute, setSelectedRoute] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (!me?.vendor_id) {
        setLoading(false);
        return;
      }
      // All orders for this vendor that are out for delivery OR already delivered
      const [allOrders, allRoutes] = await Promise.all([
        base44.entities.Order.filter({ vendor_id: me.vendor_id }, "-created_date", 500),
        base44.entities.DeliveryRoute.filter({ vendor_id: me.vendor_id }, "-delivery_date", 100),
      ]);

      // Drivers see only orders assigned to them. Admin/vendor see all.
      const userType = me.user_type?.trim();
      const isDriver = userType === "driver";
      const filtered = isDriver
        ? allOrders.filter((o) => o.driver_id === me.id && ["delivery", "delivered"].includes(o.status))
        : allOrders.filter((o) => ["delivery", "delivered"].includes(o.status));

      setOrders(filtered);
      setRoutes(allRoutes);
    } catch (err) {
      console.error("Failed to load delivery dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOrderUpdate = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user?.vendor_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">{isHebrew ? "אין גישה" : "No Access"}</h2>
            <p className="text-gray-600">
              {isHebrew ? "חשבון זה אינו משויך לחנות." : "This account is not assigned to a store."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter by tab + route
  const today = new Date().toDateString();
  const isOutForDelivery = (o) => o.status === "delivery";
  const isDelivered = (o) => o.status === "delivered";
  const matchesRoute = (o) => selectedRoute === "all" || o.delivery_route_id === selectedRoute;
  const isToday = (o) => !o.delivered_at || new Date(o.delivered_at).toDateString() === today;

  const pending = orders.filter((o) => isOutForDelivery(o) && matchesRoute(o));
  const completed = orders.filter((o) => isDelivered(o) && matchesRoute(o) && isToday(o));

  // Group by neighborhood for the active list
  const groupByNeighborhood = (list) => {
    const groups = {};
    list.forEach((o) => {
      const key = o.neighborhood || (isHebrew ? "ללא שכונה" : "No Neighborhood");
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return groups;
  };

  const pendingGroups = groupByNeighborhood(pending);

  return (
    <div className="min-h-screen bg-gray-50 pb-24" dir={isHebrew ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-600" />
              {isHebrew ? "ניהול משלוחים" : "Delivery Management"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isHebrew ? "המשלוחים שלך להיום" : "Your deliveries for today"}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-xs text-gray-500">{isHebrew ? "בדרך" : "Pending"}</p>
                <p className="text-2xl font-bold">{pending.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-xs text-gray-500">{isHebrew ? "נמסרו היום" : "Delivered Today"}</p>
                <p className="text-2xl font-bold">{completed.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Route filter */}
        {routes.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedRoute("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedRoute === "all" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-700"
              }`}
            >
              {isHebrew ? "הכל" : "All Routes"}
            </button>
            {routes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoute(r.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                  selectedRoute === r.id ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-700"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="today">
              {isHebrew ? `בדרך (${pending.length})` : `Pending (${pending.length})`}
            </TabsTrigger>
            <TabsTrigger value="completed">
              {isHebrew ? `הושלמו (${completed.length})` : `Completed (${completed.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4 mt-4">
            {pending.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>{isHebrew ? "אין משלוחים ממתינים" : "No pending deliveries"}</p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(pendingGroups).map(([neighborhood, list]) => (
                <div key={neighborhood} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-700">{neighborhood}</h3>
                    <Badge variant="outline">{list.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {list.map((o) => (
                      <DeliveryCard key={o.id} order={o} onUpdate={handleOrderUpdate} isHebrew={isHebrew} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-2 mt-4">
            {completed.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <p>{isHebrew ? "אין משלוחים שהושלמו היום" : "No deliveries completed today"}</p>
                </CardContent>
              </Card>
            ) : (
              completed.map((o) => (
                <DeliveryCard key={o.id} order={o} onUpdate={handleOrderUpdate} isHebrew={isHebrew} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}