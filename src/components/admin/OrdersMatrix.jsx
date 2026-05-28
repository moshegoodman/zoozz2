import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "../i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  shopping: "bg-purple-100 text-purple-800",
  ready_for_shipping: "bg-indigo-100 text-indigo-800",
  delivery: "bg-cyan-100 text-cyan-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  follow_up: "bg-orange-100 text-orange-800"
};

const formatCurrency = (amount, currency) => {
  const symbol = currency === "USD" ? "$" : "₪";
  return `${symbol}${(amount || 0).toFixed(0)}`;
};

// Effective order total = total_amount minus value of returned items
const getEffectiveOrderTotal = (order) => {
  const base = order.total_amount || 0;
  if (!order.items || !Array.isArray(order.items)) return base;
  const returned = order.items.reduce((sum, item) => {
    const qty = Number(item.amount_returned) || 0;
    if (qty <= 0) return sum;
    const price = Number(item.price) || 0;
    return sum + qty * price;
  }, 0);
  return base - returned;
};

export default function OrdersMatrix({ orders, vendors, households, activeSeason }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedCell, setSelectedCell] = useState(null); // { household, vendor, orders }

  const openCellDetails = (household, vendor) => {
    const cellOrders = orders.filter(
      (o) => o.household_id === household.id && o.vendor_id === vendor.id && o.status !== 'cancelled'
    );
    if (cellOrders.length === 0) return;
    setSelectedCell({ household, vendor, orders: cellOrders });
  };

  const escapeCsv = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportCSV = () => {
    const vendorCols = activeVendors.map((v) => getVendorName(v));
    const header = [
      "Household",
      "Code",
      "Lead",
      ...vendorCols.flatMap((n) => [`${n} - Orders`, `${n} - Total`, `${n} - Status`]),
      "Row Orders",
      "Row Total"
    ];

    const rows = activeHouseholds.map((h) => {
      const row = matrix[h.id] || {};
      const cells = activeVendors.flatMap((v) => {
        const c = row[v.id];
        if (!c) return ["", "", ""];
        const topStatus = Object.entries(c.statuses).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
        return [c.count, c.total.toFixed(2), topStatus];
      });
      const rowCount = Object.values(row).reduce((acc, c) => acc + c.count, 0);
      const rowTotal = Object.values(row).reduce((acc, c) => acc + c.total, 0);
      return [
        getHouseholdName(h),
        h.household_code || "",
        h.lead_name || "",
        ...cells,
        rowCount,
        rowTotal.toFixed(2)
      ];
    });

    const vendorTotalsRow = [
      "Vendor Total",
      "",
      "",
      ...activeVendors.flatMap((v) => {
        const vendorCount = Object.values(matrix).reduce((acc, r) => acc + (r[v.id]?.count || 0), 0);
        const vendorTotal = Object.values(matrix).reduce((acc, r) => acc + (r[v.id]?.total || 0), 0);
        return [vendorCount, vendorTotal.toFixed(2), ""];
      }),
      "",
      ""
    ];

    const csv = [header, ...rows, vendorTotalsRow]
      .map((r) => r.map(escapeCsv).join(","))
      .join("\n");

    const bom = "\uFEFF"; // for Excel UTF-8 compatibility
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `orders-matrix${activeSeason ? `-${activeSeason}` : ""}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter households to those belonging to the active season (case-insensitive)
  const seasonHouseholds = useMemo(() => {
    if (!activeSeason) return households;
    const target = (activeSeason || '').trim().toUpperCase();
    return households.filter(
      (h) =>
        (h.season || '').trim().toUpperCase() === target ||
        (h.household_code && h.household_code.slice(-3).toUpperCase() === target)
    );
  }, [households, activeSeason]);

  // Build matrix: { [householdId]: { [vendorId]: { count, total, currency, statuses } } }
  const matrix = useMemo(() => {
    const m = {};
    for (const order of orders) {
      if (!order.household_id || !order.vendor_id) continue;
      if (order.status === 'cancelled') continue;
      if (!m[order.household_id]) m[order.household_id] = {};
      if (!m[order.household_id][order.vendor_id]) {
        m[order.household_id][order.vendor_id] = {
          count: 0,
          total: 0,
          currency: order.order_currency || "ILS",
          statuses: {}
        };
      }
      const cell = m[order.household_id][order.vendor_id];
      cell.count += 1;
      cell.total += getEffectiveOrderTotal(order);
      cell.statuses[order.status] = (cell.statuses[order.status] || 0) + 1;
    }
    return m;
  }, [orders]);

  // Show ALL households assigned to the active season (even with no orders)
  const activeHouseholds = useMemo(() => {
    return seasonHouseholds
      .filter((h) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (h.name || "").toLowerCase().includes(q) ||
          (h.name_hebrew || "").toLowerCase().includes(q) ||
          (h.household_code || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [seasonHouseholds, search]);

  const activeVendors = useMemo(() => {
    const ids = new Set();
    Object.values(matrix).forEach((row) => {
      Object.keys(row).forEach((vid) => ids.add(vid));
    });
    return vendors
      .filter((v) => ids.has(v.id))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [vendors, matrix]);

  const getVendorName = (v) =>
    language === "Hebrew" && v.name_hebrew ? v.name_hebrew : v.name;
  const getHouseholdName = (h) =>
    language === "Hebrew" && h.name_hebrew ? h.name_hebrew : h.name;

  if (activeHouseholds.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No households found{activeSeason ? ` for season ${activeSeason}` : ""}.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search households..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {activeHouseholds.length} households × {activeVendors.length} vendors
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="whitespace-nowrap"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="text-left p-3 border-b border-r bg-gray-50 sticky left-0 z-20 min-w-[180px]">
                  Household
                </th>
                {activeVendors.map((v) => (
                  <th
                    key={v.id}
                    className="text-left p-3 border-b border-r text-xs font-medium text-gray-700 min-w-[140px]"
                  >
                    {getVendorName(v)}
                  </th>
                ))}
                <th className="text-left p-3 border-b text-xs font-medium text-gray-700 bg-gray-100 min-w-[120px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {activeHouseholds.map((h) => {
                const row = matrix[h.id] || {};
                const rowTotal = Object.values(row).reduce(
                  (acc, c) => acc + c.total,
                  0
                );
                const rowCount = Object.values(row).reduce(
                  (acc, c) => acc + c.count,
                  0
                );
                const rowCurrency =
                  Object.values(row)[0]?.currency || "ILS";

                return (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="p-3 border-b border-r bg-white sticky left-0 z-10">
                      <div className="font-medium text-gray-900 text-sm">
                        {getHouseholdName(h)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {h.household_code}
                      </div>
                      {h.lead_name && (
                        <div className="text-xs text-blue-600 mt-1">
                          {h.lead_name}
                        </div>
                      )}
                    </td>
                    {activeVendors.map((v) => {
                      const cell = row[v.id];
                      if (!cell) {
                        return (
                          <td
                            key={v.id}
                            className="p-2 border-b border-r text-center text-gray-300 text-xs"
                          >
                            —
                          </td>
                        );
                      }
                      const topStatus = Object.entries(cell.statuses).sort(
                        (a, b) => b[1] - a[1]
                      )[0]?.[0];
                      return (
                        <td
                          key={v.id}
                          className="p-2 border-b border-r align-top"
                        >
                          <button
                            type="button"
                            onClick={() => openCellDetails(h, v)}
                            className="w-full text-left bg-blue-50 border border-blue-200 rounded-md p-2 hover:bg-blue-100 hover:border-blue-400 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-sm text-blue-900">
                                {cell.count}
                              </span>
                              <span className="text-xs font-semibold text-gray-700">
                                {formatCurrency(cell.total, cell.currency)}
                              </span>
                            </div>
                            {topStatus && (
                              <span
                                className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                                  STATUS_COLORS[topStatus] ||
                                  "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {topStatus.replace(/_/g, " ")}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-3 border-b bg-gray-50">
                      <div className="font-bold text-sm text-gray-900">
                        {formatCurrency(rowTotal, rowCurrency)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {rowCount} orders
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 font-semibold">
                <td className="p-3 border-t-2 border-r-2 border-gray-400 bg-gray-100 sticky left-0 z-10">
                  <div className="text-gray-900">Vendor Total</div>
                </td>
                {activeVendors.map((v) => {
                  const vendorTotal = Object.values(matrix).reduce(
                    (acc, row) => acc + (row[v.id]?.total || 0),
                    0
                  );
                  const vendorCount = Object.values(matrix).reduce(
                    (acc, row) => acc + (row[v.id]?.count || 0),
                    0
                  );
                  const vendorCurrency =
                    Object.values(matrix).find((row) => row[v.id])?.[v.id]
                      ?.currency || "ILS";

                  return (
                    <td
                      key={v.id}
                      className="p-2 border-t-2 border-r-2 border-gray-400 text-center"
                    >
                      <div className="text-sm font-bold text-gray-900">
                        {vendorCount}
                      </div>
                      <div className="text-xs text-gray-700">
                        {formatCurrency(vendorTotal, vendorCurrency)}
                      </div>
                    </td>
                  );
                })}
                <td className="p-3 border-t-2 border-gray-400 bg-gray-100">
                  <div className="font-bold text-gray-900">
                    {formatCurrency(
                      Object.values(matrix).reduce((acc, row) => {
                        return (
                          acc +
                          Object.values(row).reduce(
                            (sum, cell) => sum + cell.total,
                            0
                          )
                        );
                      }, 0),
                      "ILS"
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCell && (
                <>
                  {getHouseholdName(selectedCell.household)}
                  <span className="text-gray-400 mx-2">×</span>
                  {getVendorName(selectedCell.vendor)}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                {selectedCell.orders.length} order{selectedCell.orders.length !== 1 ? "s" : ""}
              </div>
              {selectedCell.orders
                .slice()
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                .map((order) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-3 bg-white hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-sm text-gray-900">
                          #{order.order_number || order.id?.slice(0, 8)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.created_date
                            ? new Date(order.created_date).toLocaleString()
                            : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-gray-900">
                          {formatCurrency(order.total_amount, order.order_currency)}
                        </div>
                        <Badge
                          className={`text-[10px] mt-1 ${
                            STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {(order.status || "").replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    {(() => {
                      const deliveredItems = (order.items || []).filter(item => {
                        if (item.available === false) return false;
                        if (item.actual_quantity === 0) return false;
                        const qty = Number(item.quantity) || 0;
                        const returned = Number(item.amount_returned) || 0;
                        if (qty > 0 && returned >= qty) return false;
                        return true;
                      });
                      if (deliveredItems.length === 0) return null;
                      return (
                      <div className="mt-2 border-t pt-2">
                        <div className="text-xs font-medium text-gray-700 mb-1">
                          Items ({deliveredItems.length}) — delivered:
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {deliveredItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs text-gray-600"
                            >
                              <span className="truncate flex-1">
                                {language === "Hebrew" && item.product_name_hebrew
                                  ? item.product_name_hebrew
                                  : item.product_name}
                                <span className="text-gray-400 ml-1">
                                  × {item.quantity}
                                </span>
                              </span>
                              <span className="font-medium text-gray-700 ml-2">
                                {formatCurrency(
                                  (item.price || 0) * (item.quantity || 0),
                                  order.order_currency
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      );
                    })()}
                    {(() => {
                      const items = order.items || [];
                      const itemsSubtotal = items.reduce(
                        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
                        0
                      );
                      const returnedValue = items.reduce((sum, item) => {
                        const qty = Number(item.amount_returned) || 0;
                        if (qty <= 0) return sum;
                        return sum + qty * (Number(item.price) || 0);
                      }, 0);
                      const deliveryFee = Number(order.delivery_price) || 0;
                      const total = Number(order.total_amount) || 0;
                      const effective = total - returnedValue;
                      // VAT inferred from total - (items + delivery), if positive
                      const vatAmount = Math.max(0, total - itemsSubtotal - deliveryFee);
                      const currency = order.order_currency;
                      return (
                        <div className="mt-2 border-t pt-2 space-y-0.5 text-xs">
                          <div className="flex justify-between text-gray-600">
                            <span>Items subtotal</span>
                            <span>{formatCurrency(itemsSubtotal, currency)}</span>
                          </div>
                          {deliveryFee > 0 && (
                            <div className="flex justify-between text-gray-600">
                              <span>Delivery</span>
                              <span>{formatCurrency(deliveryFee, currency)}</span>
                            </div>
                          )}
                          {vatAmount > 0.5 && (
                            <div className="flex justify-between text-gray-600">
                              <span>VAT{order.vat_rate ? ` (${Math.round(order.vat_rate * 100)}%)` : ''}</span>
                              <span>{formatCurrency(vatAmount, currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-700 font-medium pt-0.5">
                            <span>Order total</span>
                            <span>{formatCurrency(total, currency)}</span>
                          </div>
                          {returnedValue > 0 && (
                            <>
                              <div className="flex justify-between text-red-600">
                                <span>Returned items</span>
                                <span>− {formatCurrency(returnedValue, currency)}</span>
                              </div>
                              <div className="flex justify-between text-gray-900 font-bold pt-0.5 border-t mt-0.5">
                                <span>Net total</span>
                                <span>{formatCurrency(effective, currency)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}