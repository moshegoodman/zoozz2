import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, DollarSign } from "lucide-react";

const isClientCC = (order) => order.payment_method === "clientCC";

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

  const billableTotal = useMemo(
    () => householdOrders.filter(o => !isClientCC(o)).reduce((s, o) => s + (o.total_amount || 0), 0),
    [householdOrders]
  );
  const clientCCTotal = useMemo(
    () => householdOrders.filter(o => isClientCC(o)).reduce((s, o) => s + (o.total_amount || 0), 0),
    [householdOrders]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold">{householdOrders.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Billable to Client</p>
          <p className="text-2xl font-bold text-blue-700">₪{billableTotal.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-gray-500">Client CC (not billed)</p>
          <p className="text-2xl font-bold text-gray-400">₪{clientCCTotal.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      {householdOrders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Order #</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Vendor</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Payment</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600">Billing</th>
              </tr>
            </thead>
            <tbody>
              {householdOrders.map(order => {
                const clientCC = isClientCC(order);
                const curr = order.order_currency === "USD" ? "$" : "₪";
                return (
                  <tr key={order.id} className={`border-b hover:bg-gray-50 ${clientCC ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 font-mono text-gray-700">{order.order_number || order.id?.slice(-6)}</td>
                    <td className="px-3 py-2">{vendorMap[order.vendor_id] || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${clientCC ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                        {order.payment_method || "—"}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${clientCC ? "text-gray-400 line-through" : ""}`}>
                      {curr}{(order.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {clientCC ? (
                        <span className="text-xs text-blue-600 font-medium">Client CC</span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">✓ Bill</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                <td className="px-3 py-2 text-blue-800" colSpan={4}>Billable Total (non-Client CC)</td>
                <td className="px-3 py-2 text-right text-blue-800">₪{billableTotal.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {householdOrders.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No orders found for this household.</p>
        </div>
      )}
    </div>
  );
}