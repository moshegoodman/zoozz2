import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";

const USA_VALS = ["america", "usa"];
const isUSA = (c) => USA_VALS.includes((c || "").toLowerCase().trim());
const CLIENT_CC_LIKE = ["client cc", "clientcc", "client"];
const isClientCC = (paid_by) => {
  const lower = (paid_by || "").toLowerCase();
  return CLIENT_CC_LIKE.some(v => lower.includes(v));
};
const calcHours = (start, end) => {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
};
const fmt = (n, curr = "₪") => `${curr}${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const LABOR_ROLES = {
  chef: ["chef"],
  sous_chef: ["sous chef"],
  cook: ["cook"],
  house_manager: ["house manager", "householdmanager"],
  waiter: ["waiter"],
  housekeeper: ["cleaner", "housekeeping", "housekeeper"],
};

function matchRole(job, roleKeys) {
  const j = (job || "").toLowerCase().trim();
  return roleKeys.some(k => j.includes(k));
}

export default function InvoicingOverview({ households, orders }) {
  const [shifts, setShifts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [arRecords, setArRecords] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonFilter, setSeasonFilter] = useState("");

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      base44.entities.Shift.list(),
      base44.entities.Expense.list(),
      base44.entities.AR.list(),
      base44.entities.AppSettings.list(),
    ]).then(([s, e, ar, settings]) => {
      setShifts(s);
      setExpenses(e);
      setArRecords(ar);
      setAppSettings(settings?.[0] || null);
    }).finally(() => setIsLoading(false));
  }, []);

  const seasons = useMemo(() => {
    const s = new Set(households.map(h => h.season).filter(Boolean));
    return [...s].sort();
  }, [households]);

  const filteredHouseholds = useMemo(() => {
    if (!seasonFilter) return households;
    return households.filter(h => h.season === seasonFilter);
  }, [households, seasonFilter]);

  const roleRates = appSettings?.role_rates || [];

  const rows = useMemo(() => {
    return filteredHouseholds.map(h => {
      const curr = isUSA(h.country) ? "$" : "₪";
      const hShifts = shifts.filter(s => s.household_id === h.id && s.is_active !== false && s.is_approved);
      const hExpenses = expenses.filter(e => e.household_id === h.id && e.is_approved);
      const hAR = arRecords.filter(ar => ar.household_id === h.id);
      const hOrders = (orders || []).filter(o => o.household_id === h.id);

      const defaultVat = h.vat_rate != null ? h.vat_rate : 0.18;

      // Labor by role group
      const laborFor = (roleKeys) => {
        const matched = hShifts.filter(s => matchRole(s.job, roleKeys));
        return matched.reduce((sum, s) => {
          const isDaily = s.payment_type === "daily" || s.payment_type === "contract";
          const chargeRate = isDaily ? (s.charge_per_day || 0) : (s.charge_per_hour || 0);
          const hours = isDaily ? 0 : calcHours(s.start_date_time, s.done_date_time);
          return sum + (isDaily ? chargeRate : hours * chargeRate);
        }, 0);
      };

      const chefs = laborFor(LABOR_ROLES.chef);
      const sousChef = laborFor(LABOR_ROLES.sous_chef);
      const cooks = laborFor(LABOR_ROLES.cook);
      const houseManagers = laborFor(LABOR_ROLES.house_manager);
      const waiters = laborFor(LABOR_ROLES.waiter);
      const housekeepers = laborFor(LABOR_ROLES.housekeeper);

      const laborSubtotal = chefs + sousChef + cooks + houseManagers + waiters + housekeepers;
      const vat = laborSubtotal * defaultVat;

      // A/P (KCS paid expenses)
      const ap = hExpenses.filter(e => !isClientCC(e.paid_by)).reduce((s, e) => s + (e.amount || 0), 0);
      // Put on CCC (client credit card)
      const putOnCCC = hExpenses.filter(e => isClientCC(e.paid_by)).reduce((s, e) => s + (e.amount || 0), 0);
      // Orders (billable)
      const ordersTotal = hOrders.filter(o => o.for_billing === true).reduce((s, o) => s + (o.total_amount || 0), 0);

      const total = laborSubtotal + vat + ap + ordersTotal;

      // AR — total received from client
      const totalReceivables = hAR.reduce((s, ar) => s + (ar.amount || 0), 0);
      const afterReceivables = total - totalReceivables;

      // Down payment requested: check if any AR with description/reference mentioning "down" or flag
      const downPaymentRequested = hAR.some(ar =>
        (ar.description || "").toLowerCase().includes("down") ||
        (ar.payment_method || "").toLowerCase().includes("down")
      );

      return {
        h,
        curr,
        chefs,
        sousChef,
        cooks,
        houseManagers,
        waiters,
        housekeepers,
        ap,
        ordersTotal,
        putOnCCC,
        vat,
        total,
        totalReceivables,
        afterReceivables,
        downPaymentRequested,
      };
    });
  }, [filteredHouseholds, shifts, expenses, arRecords, orders, appSettings]);

  // Column totals
  const totals = useMemo(() => ({
    chefs: rows.reduce((s, r) => s + r.chefs, 0),
    sousChef: rows.reduce((s, r) => s + r.sousChef, 0),
    cooks: rows.reduce((s, r) => s + r.cooks, 0),
    houseManagers: rows.reduce((s, r) => s + r.houseManagers, 0),
    waiters: rows.reduce((s, r) => s + r.waiters, 0),
    housekeepers: rows.reduce((s, r) => s + r.housekeepers, 0),
    ap: rows.reduce((s, r) => s + r.ap, 0),
    ordersTotal: rows.reduce((s, r) => s + r.ordersTotal, 0),
    putOnCCC: rows.reduce((s, r) => s + r.putOnCCC, 0),
    vat: rows.reduce((s, r) => s + r.vat, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    totalReceivables: rows.reduce((s, r) => s + r.totalReceivables, 0),
    afterReceivables: rows.reduce((s, r) => s + r.afterReceivables, 0),
  }), [rows]);

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      {/* Season filter */}
      <div className="flex items-center gap-3 bg-white rounded-lg border shadow-sm px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">Season:</span>
        <select
          value={seasonFilter}
          onChange={e => setSeasonFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="">All Seasons</option>
          {seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{rows.length} households</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1400px]">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-gray-800 z-10 min-w-[60px]">Client #</th>
              <th className="px-3 py-2.5 text-left font-semibold sticky left-[60px] bg-gray-800 z-10 min-w-[160px]">Client Name</th>
              <th className="px-3 py-2.5 text-center font-semibold min-w-[90px]">Down Payment?</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[80px]">Chefs</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[80px]">Sous Chef</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[70px]">Cooks</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[100px]">House Mgrs</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[70px]">Waiters</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[90px]">Housekeepers</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[70px]">A/P</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[70px]">Orders</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[80px]">Put on CCC</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[60px]">VAT</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[90px] bg-blue-700">Total</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[100px]">Total Recv.</th>
              <th className="px-3 py-2.5 text-right font-semibold min-w-[100px] bg-green-700">After Recv.</th>
              <th className="px-3 py-2.5 text-center font-semibold min-w-[70px]">Season</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={17} className="px-4 py-8 text-center text-gray-400 italic">No households found.</td></tr>
            )}
            {rows.map((r, i) => {
              const code = (r.h.household_code || "").split("-")[0] || "—";
              return (
                <tr key={r.h.id} className={`border-b transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50`}>
                  <td className={`px-3 py-2 font-mono font-semibold text-gray-600 sticky left-0 z-10 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>{code}</td>
                  <td className={`px-3 py-2 font-medium text-gray-800 sticky left-[60px] z-10 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    {r.h.name}
                    {r.h.name_hebrew && <span className="text-gray-400 ml-1 text-xs">/ {r.h.name_hebrew}</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.downPaymentRequested
                      ? <span className="text-green-600 font-bold">✓</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.chefs > 0 ? fmt(r.chefs, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.sousChef > 0 ? fmt(r.sousChef, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.cooks > 0 ? fmt(r.cooks, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.houseManagers > 0 ? fmt(r.houseManagers, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.waiters > 0 ? fmt(r.waiters, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.housekeepers > 0 ? fmt(r.housekeepers, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.ap > 0 ? fmt(r.ap, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.ordersTotal > 0 ? fmt(r.ordersTotal, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-500 italic">{r.putOnCCC > 0 ? fmt(r.putOnCCC, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{r.vat > 0 ? fmt(r.vat, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50">{fmt(r.total, r.curr)}</td>
                  <td className="px-3 py-2 text-right text-purple-600">{r.totalReceivables > 0 ? fmt(r.totalReceivables, r.curr) : <span className="text-gray-300">—</span>}</td>
                  <td className={`px-3 py-2 text-right font-bold ${r.afterReceivables > 0 ? "text-red-600 bg-red-50" : r.afterReceivables < 0 ? "text-green-700 bg-green-50" : "text-gray-400"}`}>
                    {fmt(r.afterReceivables, r.curr)}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500">{r.h.season || "—"}</td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-900 text-white font-bold text-xs">
                <td className="px-3 py-2.5 sticky left-0 bg-gray-900 z-10" colSpan={2}>TOTALS</td>
                <td></td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.chefs)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.sousChef)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.cooks)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.houseManagers)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.waiters)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.housekeepers)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.ap)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.ordersTotal)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(totals.putOnCCC)}</td>
                <td className="px-3 py-2.5 text-right text-orange-300">{fmt(totals.vat)}</td>
                <td className="px-3 py-2.5 text-right text-blue-300 bg-blue-900">{fmt(totals.total)}</td>
                <td className="px-3 py-2.5 text-right text-purple-300">{fmt(totals.totalReceivables)}</td>
                <td className="px-3 py-2.5 text-right text-green-300 bg-green-900">{fmt(totals.afterReceivables)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}