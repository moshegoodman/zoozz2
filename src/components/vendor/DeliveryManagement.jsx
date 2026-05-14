import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Truck, MapPin, User as UserIcon, ArrowRight, Trash2, Loader2, Package, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageContext";
import { geocodeOrders, optimizeRoute } from "@/lib/routeOptimizer";

export default function DeliveryManagement({ vendorId }) {
  const { language } = useLanguage();
  const isHebrew = language === "Hebrew";
  const [orders, setOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: "", delivery_date: "", delivery_time_window: "", driver_id: "" });
  const [moveTarget, setMoveTarget] = useState(null); // { orderId, currentRouteId }
  const [saving, setSaving] = useState(false);
  const [optimizingRouteId, setOptimizingRouteId] = useState(null);

  const load = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const [ordersData, routesData, driversData] = await Promise.all([
        base44.entities.Order.filter({ vendor_id: vendorId }, "-created_date", 500),
        base44.entities.DeliveryRoute.filter({ vendor_id: vendorId }, "-delivery_date", 100),
        base44.entities.User.filter({ vendor_id: vendorId, user_type: "driver" }).catch(() => []),
      ]);
      // Only show orders that are ready to ship or already out for delivery
      const deliverable = ordersData.filter((o) => ["ready_for_shipping", "delivery"].includes(o.status));
      setOrders(deliverable);
      setRoutes(routesData);
      setDrivers(driversData);
    } catch (err) {
      console.error("Failed to load delivery management:", err);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const handleCreateRoute = async () => {
    if (!newRoute.name.trim()) return;
    setSaving(true);
    try {
      const driver = drivers.find((d) => d.id === newRoute.driver_id);
      await base44.entities.DeliveryRoute.create({
        ...newRoute,
        vendor_id: vendorId,
        driver_name: driver ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || driver.full_name : "",
      });
      setNewRoute({ name: "", delivery_date: "", delivery_time_window: "", driver_id: "" });
      setShowNewRoute(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm(isHebrew ? "למחוק את המסלול? ההזמנות לא יימחקו." : "Delete this route? Orders will be unassigned.")) return;
    // Unassign orders first
    const toUnassign = orders.filter((o) => o.delivery_route_id === routeId);
    await Promise.all(toUnassign.map((o) =>
      base44.entities.Order.update(o.id, { delivery_route_id: null, driver_id: null, driver_name: null })
    ));
    await base44.entities.DeliveryRoute.delete(routeId);
    await load();
  };

  const handleAssignToRoute = async (orderId, routeId) => {
    const route = routes.find((r) => r.id === routeId);
    const updates = {
      delivery_route_id: routeId,
      driver_id: route?.driver_id || null,
      driver_name: route?.driver_name || null,
    };
    await base44.entities.Order.update(orderId, updates);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
    setMoveTarget(null);
  };

  const handleOptimizeRoute = async (routeId) => {
    const routeOrders = orders.filter((o) => o.delivery_route_id === routeId);
    if (routeOrders.length < 2) {
      alert(isHebrew ? "אין מספיק עצירות לאופטימיזציה" : "Not enough stops to optimize");
      return;
    }
    setOptimizingRouteId(routeId);
    try {
      const { coordsByOrderId, missing } = await geocodeOrders(routeOrders);
      const optimized = optimizeRoute(routeOrders, coordsByOrderId, null);
      await Promise.all(
        optimized.map((o, idx) => base44.entities.Order.update(o.id, { delivery_sequence: idx + 1 }))
      );
      const seqMap = Object.fromEntries(optimized.map((o, idx) => [o.id, idx + 1]));
      setOrders((prev) => prev.map((o) => (seqMap[o.id] != null ? { ...o, delivery_sequence: seqMap[o.id] } : o)));
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
      setOptimizingRouteId(null);
    }
  };

  const handleDispatchRoute = async (routeId) => {
    const routeOrders = orders.filter((o) => o.delivery_route_id === routeId && o.status === "ready_for_shipping");
    if (routeOrders.length === 0) {
      alert(isHebrew ? "אין הזמנות מוכנות במסלול זה" : "No ready orders in this route");
      return;
    }
    if (!window.confirm(isHebrew ? `לשלוח ${routeOrders.length} הזמנות?` : `Dispatch ${routeOrders.length} orders?`)) return;
    await Promise.all(routeOrders.map((o) => base44.entities.Order.update(o.id, { status: "delivery" })));
    await base44.entities.DeliveryRoute.update(routeId, { status: "in_progress" });
    await load();
  };

  // Group orders by route (and unassigned)
  const grouped = useMemo(() => {
    const result = { unassigned: [] };
    routes.forEach((r) => { result[r.id] = []; });
    orders.forEach((o) => {
    if (o.delivery_route_id && result[o.delivery_route_id]) {
      result[o.delivery_route_id].push(o);
    } else {
      result.unassigned.push(o);
    }
    });
    // Sort each route by delivery_sequence (unsequenced items go last)
    Object.keys(result).forEach((k) => {
    if (k === "unassigned") return;
    result[k].sort((a, b) => (a.delivery_sequence ?? 9999) - (b.delivery_sequence ?? 9999));
    });
    return result;
    }, [orders, routes]);

  // Auto-group unassigned by neighborhood + delivery_time
  const unassignedByNeighborhood = useMemo(() => {
    const groups = {};
    grouped.unassigned.forEach((o) => {
      const key = `${o.neighborhood || (isHebrew ? "ללא שכונה" : "No neighborhood")} · ${o.delivery_time || (isHebrew ? "ללא שעה" : "Any time")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return groups;
  }, [grouped.unassigned, isHebrew]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isHebrew ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            {isHebrew ? "ניהול משלוחים" : "Delivery Management"}
          </h2>
          <p className="text-sm text-gray-500">
            {isHebrew ? "ארגן הזמנות למסלולים והקצה לנהגים" : "Organize orders into routes and assign drivers"}
          </p>
        </div>
        <Button onClick={() => setShowNewRoute(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {isHebrew ? "מסלול חדש" : "New Route"}
        </Button>
      </div>

      {/* Unassigned orders grouped by neighborhood + delivery time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-5 h-5 text-orange-500" />
            {isHebrew ? `ללא הקצאה (${grouped.unassigned.length})` : `Unassigned (${grouped.unassigned.length})`}
          </CardTitle>
          <p className="text-xs text-gray-500">
            {isHebrew ? "מקובץ לפי שכונה ושעת משלוח" : "Grouped by neighborhood & delivery time"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(unassignedByNeighborhood).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {isHebrew ? "כל ההזמנות הוקצו" : "All orders are assigned"}
            </p>
          ) : (
            Object.entries(unassignedByNeighborhood).map(([groupKey, list]) => (
              <div key={groupKey} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-sm">{groupKey}</span>
                  <Badge variant="outline">{list.length}</Badge>
                </div>
                <div className="space-y-1">
                  {list.map((o) => (
                    <div key={o.id} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{o.household_name || o.user_email}</p>
                        <p className="text-xs text-gray-500 truncate">{o.street} {o.building_number}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setMoveTarget({ orderId: o.id, currentRouteId: null })}>
                        <ArrowRight className="w-3 h-3 mr-1" />
                        {isHebrew ? "הקצה" : "Assign"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Routes */}
      {routes.map((route) => {
        const routeOrders = grouped[route.id] || [];
        return (
          <Card key={route.id}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Truck className="w-5 h-5 text-blue-600" />
                    {route.name}
                    <Badge variant="outline">{routeOrders.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {route.delivery_date && <span>📅 {route.delivery_date}</span>}
                    {route.delivery_time_window && <span>🕐 {route.delivery_time_window}</span>}
                    {route.driver_name && <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{route.driver_name}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOptimizeRoute(route.id)}
                    disabled={optimizingRouteId === route.id}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {optimizingRouteId === route.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" />{isHebrew ? "מטב" : "Optimize"}</>
                    )}
                  </Button>
                  <Button size="sm" onClick={() => handleDispatchRoute(route.id)} className="bg-blue-600 hover:bg-blue-700">
                    {isHebrew ? "שלח מסלול" : "Dispatch"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteRoute(route.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {routeOrders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">{isHebrew ? "אין הזמנות במסלול" : "No orders in this route"}</p>
              ) : (
                routeOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      {o.delivery_sequence != null && (
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          {o.delivery_sequence}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{o.household_name || o.user_email}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {o.neighborhood && <span>{o.neighborhood} · </span>}
                        {o.street} {o.building_number}
                        {o.delivery_time && <span> · {o.delivery_time}</span>}
                      </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={o.status === "delivered" ? "bg-green-600" : o.status === "delivery" ? "bg-blue-600" : "bg-orange-500"}>
                        {o.status}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => setMoveTarget({ orderId: o.id, currentRouteId: route.id })}>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* New route dialog */}
      <Dialog open={showNewRoute} onOpenChange={setShowNewRoute}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isHebrew ? "מסלול חדש" : "New Delivery Route"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{isHebrew ? "שם" : "Name"}</label>
              <Input value={newRoute.name} onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })} placeholder={isHebrew ? "לדוגמה: מרכז העיר בוקר" : "e.g. Downtown Morning"} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">{isHebrew ? "תאריך" : "Date"}</label>
                <Input type="date" value={newRoute.delivery_date} onChange={(e) => setNewRoute({ ...newRoute, delivery_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">{isHebrew ? "חלון זמן" : "Time Window"}</label>
                <Input value={newRoute.delivery_time_window} onChange={(e) => setNewRoute({ ...newRoute, delivery_time_window: e.target.value })} placeholder="9:00-12:00" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{isHebrew ? "נהג" : "Driver"}</label>
              <Select value={newRoute.driver_id} onValueChange={(v) => setNewRoute({ ...newRoute, driver_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={isHebrew ? "בחר נהג" : "Select driver"} />
                </SelectTrigger>
                <SelectContent>
                  {drivers.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500">{isHebrew ? "אין נהגים. הוסף נהג בהגדרות משתמשים." : "No drivers. Add one in user settings."}</div>
                  ) : (
                    drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {`${d.first_name || ""} ${d.last_name || ""}`.trim() || d.full_name || d.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRoute(false)}>{isHebrew ? "בטל" : "Cancel"}</Button>
            <Button onClick={handleCreateRoute} disabled={saving || !newRoute.name.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isHebrew ? "צור" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move order dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isHebrew ? "בחר מסלול" : "Select Route"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {routes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-3">{isHebrew ? "צור מסלול קודם" : "Create a route first"}</p>
            )}
            {routes.map((r) => (
              <button
                key={r.id}
                onClick={() => handleAssignToRoute(moveTarget.orderId, r.id)}
                disabled={r.id === moveTarget?.currentRouteId}
                className={`w-full text-left border rounded-lg p-3 transition-colors ${
                  r.id === moveTarget?.currentRouteId ? "bg-gray-100 opacity-50" : "hover:bg-blue-50 hover:border-blue-300"
                }`}
              >
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-gray-500">
                  {r.delivery_date && `${r.delivery_date} · `}
                  {r.delivery_time_window || (isHebrew ? "ללא חלון זמן" : "no time window")}
                  {r.driver_name && ` · ${r.driver_name}`}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}