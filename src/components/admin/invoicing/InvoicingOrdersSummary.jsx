import React, { useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Package, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const isClientCC = (order) => order.payment_method === "clientCC";

const paymentStatusOptions = ["client", "kcs", "denied", "none"];
const paymentMethodOptions = ["kcs_cash", "aviCC", "meirCC", "chaimCC", "clientCC", "kcsBankTransfer", "none"];

export default function InvoicingOrdersSummary({ household, orders, vendors, onRefresh }) {
  const [optimisticOrders, setOptimisticOrders] = useState(null);

  const householdOrders = useMemo(() => {
    const source = optimisticOrders || orders;
    if (!source || !Array.isArray(source)) return [];
    return source.filter(o => o.household_id === household?.id);
  }, [optimisticOrders, orders, household?.id]);

  const vendorMap = useMemo(() => {
    const map = {};
    (vendors || []).forEach(v => { map[v.id] = v.name; });
    return map;
  }, [vendors]);

  const billableTotal = useMemo(
    () => householdOrders.filter(o => (o.status === 'delivery' || o.status === 'delivered') && o.added_to_bill === true).reduce((s, o) => s + (o.total_amount || 0), 0),
    [householdOrders]
  );
  const clientCCTotal = useMemo(
    () => householdOrders.filter(o => isClientCC(o)).reduce((s, o) => s + (o.total_amount || 0), 0),
    [householdOrders]
  );

  // Optimistic update with database sync
  const updateOrder = useCallback(async (orderId, patch) => {
    // Optimistic update
    setOptimisticOrders(prev => {
      const base = prev || orders || [];
      return base.map(o => o.id === orderId ? { ...o, ...patch } : o);
    });
    
    try {
      await base44.entities.Order.update(orderId, patch);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to update order:', error);
      setOptimisticOrders(null); // Revert on error
    }
  }, [orders, onRefresh]);

  const handleBillCCC = useCallback((orderId, val) => {
    updateOrder(orderId, { added_to_bill: val === 'bill' });
  }, [updateOrder]);

  const handleTogglePaid = useCallback((orderId, current) => {
    updateOrder(orderId, { is_paid: !current });
  }, [updateOrder]);

  const handlePaymentStatus = useCallback((orderId, val) => {
    updateOrder(orderId, { payment_status: val === 'none' ? null : val });
  }, [updateOrder]);

  const handlePaymentMethod = useCallback((orderId, val) => {
    updateOrder(orderId, { payment_method: val === 'none' ? null : val });
  }, [updateOrder]);

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
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Amount</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Payment Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Bill/CCC</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Paid</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Payment Method</th>
              </tr>
            </thead>
            <tbody>
              {householdOrders.map(order => {
                const curr = order.order_currency === "USD" ? "$" : "₪";
                const isShippable = order.status === 'delivery' || order.status === 'delivered';
                return (
                  <tr key={order.id} className={`border-b hover:bg-gray-50 ${!isShippable ? 'bg-gray-50 opacity-70' : ''}`}>
                    <td className="px-3 py-2 font-mono">
                      {order.drive_invoice_url ? (
                        <a href={order.drive_invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 font-medium">
                          {order.order_number || order.id?.slice(-6)}
                        </a>
                      ) : (
                        <span className="text-gray-700">{order.order_number || order.id?.slice(-6)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{vendorMap[order.vendor_id] || "—"}</td>
                    <td className="px-3 py-2 font-semibold">{curr}{(order.total_amount || 0).toFixed(2)}</td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        isShippable ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1).replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td className="px-3 py-2">
                      {isShippable ? (
                        <Select
                          value={order.payment_status || 'none'}
                          onValueChange={val => handlePaymentStatus(order.id, val)}
                        >
                          <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {paymentStatusOptions.map(o => (
                              <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          N/A
                        </div>
                      )}
                    </td>

                    {/* Bill / CCC - Bill === added_to_bill true, CCC === added_to_bill false */}
                    <td className="px-3 py-2">
                      {isShippable ? (
                        <Select
                          key={`${order.id}-${order.added_to_bill}`}
                          value={order.added_to_bill === true ? 'bill' : 'ccc'}
                          onValueChange={val => handleBillCCC(order.id, val)}
                        >
                          <SelectTrigger className="w-[80px] h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bill">Bill (true)</SelectItem>
                            <SelectItem value="ccc">CCC (false)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-xs text-gray-500">—</div>
                      )}
                    </td>

                    {/* Paid toggle */}
                    <td className="px-3 py-2">
                      {isShippable ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!order.is_paid}
                            onCheckedChange={() => handleTogglePaid(order.id, order.is_paid)}
                          />
                          <Label className="text-xs">{order.is_paid ? 'Yes' : 'No'}</Label>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">—</div>
                      )}
                    </td>

                    {/* Payment Method */}
                    <td className="px-3 py-2">
                      {isShippable ? (
                        <Select
                          value={order.payment_method || 'none'}
                          onValueChange={val => handlePaymentMethod(order.id, val)}
                        >
                          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {paymentMethodOptions.map(o => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-xs text-gray-500">—</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
             <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
               <td className="px-3 py-2 text-blue-800" colSpan={2}>Billable Total (non-Client CC)</td>
               <td className="px-3 py-2 text-blue-800">₪{billableTotal.toFixed(2)}</td>
               <td colSpan={5} />
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