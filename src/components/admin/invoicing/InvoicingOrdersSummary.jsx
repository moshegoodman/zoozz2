import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Clock } from "lucide-react";

export default function InvoicingOrdersSummary({ household, orders, vendors }) {
  const householdOrders = useMemo(
    () => (orders || []).filter(o => o.household_id === household?.id),
    [orders, household?.id]
  );

  const vendorMap = useMemo(() => {
    const map = {};
    (vendors || []).forEach(v => { map[v.id] = v.name; });
    return map;
  }, [vendors]);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-800 text-sm">Coming Soon</p>
          <p className="text-blue-700 text-sm mt-1">
            Orders summary for client invoicing will be implemented here.
            This tab will allow you to include or exclude specific orders from the client invoice.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-orange-400" />
            <div>
              <p className="text-xs text-gray-500">Orders for this household</p>
              <p className="text-2xl font-bold">{householdOrders.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {householdOrders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Order #</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Vendor</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {householdOrders.map(order => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-700">{order.order_number || order.id?.slice(-6)}</td>
                  <td className="px-3 py-2">{vendorMap[order.vendor_id] || order.vendor_id || "—"}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {order.order_currency === "USD" ? "$" : "₪"}{(order.total_amount || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}