import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, RefreshCw, AlertCircle, MapPin, CheckCircle2, Package, Sparkles, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageContext";
import DeliveryCard from "@/components/delivery/DeliveryCard";
import DriverLocationTracker from "@/components/delivery/DriverLocationTracker";
import { geocodeOrders, optimizeRoute, getCurrentPosition } from "@/lib/routeOptimizer";

export default function DeliveryDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === "Hebrew";
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [optimizing, setOptimizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
      const userType = me?.user_type?.trim();
      const isAdmin = userType === "admin" || userType === "chief of staff";
      const isDriver = userType === "driver";

      // Admins see ALL delivery orders/routes across vendors.
      // Vendors/pickers/drivers are scoped to their vendor.
      if (!isAdmin && !me?.vendor_id) {
        setLoading(false);
        return;
      }

      const orderQuery = isAdmin ? {} : { vendor_id: me.vendor_id };
      const routeQuery = isAdmin ? {} : { vendor_id: me.vendor_id };

      const [allOrders, allRoutes] = await Promise.all([
        base44.entities.Order.filter(orderQuery, "-created_date", 1000),
        base44.entities.DeliveryRoute.filter(routeQuery, "-delivery_date", 200),
      ]);

      // Drivers see only orders assigned to them. Admin/vendor see all.
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

  // Driver-side: optimize the currently-selected route using GPS as origin
  const handleOptimizeMyRoute = async () => {
    const pendingOrders = orders.filter(
      (o) => o.status === "delivery" && (selectedRoute === "all" || o.delivery_route_id === selectedRoute)
    );
    if (pendingOrders.length < 2) {
      alert(isHebrew ? "אין מספיק עצירות לאופטימיזציה" : "Not enough stops to optimize");
      return;
    }
    setOptimizing(true);
    try {
      const origin = await getCurrentPosition();
      const { coordsByOrderId, missing } = await geocodeOrders(pendingOrders);
      const optimized = optimizeRoute(pendingOrders, coordsByOrderId, origin);
      // Persist sequence
      await Promise.all(
        optimized.map((o, idx) => base44.entities.Order.update(o.id, { delivery_sequence: idx + 1 }))
      );
      setOrders((prev) => {
        const seqMap = Object.fromEntries(optimized.map((o, idx) => [o.id, idx + 1]));
        return prev.map((o) => (seqMap[o.id] != null ? { ...o, delivery_sequence: seqMap[o.id] } : o));
      });
      if (missing.length > 0) {
        alert(
          isHebrew
            ? `המסלול עודכן. לא ניתן היה לאתר ${missing.length} כתובות.`
            : `Route optimized. Couldn't geocode ${missing.length} address(es).`
        );
      }
    } catch (err) {
      console.error("Optimize failed:", err);
      alert(isHebrew ? "האופטימיזציה נכשלה" : "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const userTypeNow = user?.user_type?.trim();
  const isAdminUser = userTypeNow === "admin" || userTypeNow === "chief of staff";
  if (!user?.vendor_id && !isAdminUser) {
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

  const sortBySequence = (a, b) => {
    const sa = a.delivery_sequence ?? Number.MAX_SAFE_INTEGER;
    const sb = b.delivery_sequence ?? Number.MAX_SAFE_INTEGER;
    return sa - sb;
  };
  const pending = orders.filter((o) => isOutForDelivery(o) && matchesRoute(o)).sort(sortBySequence);
  const completed = orders.filter((o) => isDelivered(o) && matchesRoute(o) && isToday(o));
  const isDriver = user?.user_type?.trim() === "driver";

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

        {/* Driver-only: location consent + route optimization */}
        {isDriver && (
          <>
            <DriverLocationTracker isHebrew={isHebrew} hasActiveDeliveries={pending.length > 0} />
            {pending.length >= 2 && (
              <Button
                onClick={handleOptimizeMyRoute}
                disabled={optimizing}
                variant="outline"
                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {optimizing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isHebrew ? "מחשב מסלול מיטבי..." : "Optimizing route..."}</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />{isHebrew ? "מטב לפי המיקום שלי" : "Optimize from my location"}</>
                )}
              </Button>
            )}
          </>
        )}

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