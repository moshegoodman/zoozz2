import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

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

export default function OrdersMatrix({ orders, vendors, households, activeSeason }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState("");

  // Filter households to those belonging to the active season (if specified)
  const seasonHouseholds = useMemo(() => {
    if (!activeSeason) return households;
    return households.filter(
      (h) =>
        h.season === activeSeason ||
        (h.household_code && h.household_code.slice(-3) === activeSeason)
    );
  }, [households, activeSeason]);

  // Build matrix: { [householdId]: { [vendorId]: { count, total, currency, statuses } } }
  const matrix = useMemo(() => {
    const m = {};
    for (const order of orders) {
      if (!order.household_id || !order.vendor_id) continue;
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
      cell.total += order.total_amount || 0;
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
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 hover:bg-blue-100 transition-colors">
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
                          </div>
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
    </div>
  );
}