import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus } from "lucide-react";
import ExcelTable from "@/components/admin/payroll/ExcelTable";
import { ShiftsModal, OrdersModal, ExpensesModal, ARModal } from "./OverviewDetailModals";
import { AREntryModal } from "./AREntryModal";

const isUSA = (c) => ["america", "usa"].includes((c || "").toLowerCase().trim());
const isClientCC = (paid_by) => ["client cc", "clientcc", "client"].some(v => (paid_by || "").toLowerCase().includes(v));

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 3600000;
};

const fmt = (n, curr = "₪") =>
  n == null || n === 0 ? "—" : `${curr}${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtNum = (n) => (n == null || n === 0 ? 0 : Number(n));

const LABOR_ROLES = {
  chef:          ["chef"],
  sous_chef:     ["sous chef"],
  cook:          ["cook"],
  house_manager: ["house manager", "householdmanager"],
  waiter:        ["waiter"],
  housekeeper:   ["cleaner", "housekeeping", "housekeeper"],
};

function matchRole(job, roleKeys) {
  const j = (job || "").toLowerCase().trim();
  return roleKeys.some(k => j.includes(k));
}

function calcLaborFor(hShifts, roleKeys) {
  return hShifts
    .filter(s => matchRole(s.job, roleKeys))
    .reduce((sum, s) => {
      const isDaily = s.payment_type === "daily" || s.payment_type === "contract";
      const rate = isDaily ? (s.charge_per_day || 0) : (s.charge_per_hour || 0);
      const hours = isDaily ? 0 : calcHours(s.start_date_time, s.done_date_time);
      return sum + (isDaily ? rate : hours * rate);
    }, 0);
}

export default function InvoicingOverview({ households, orders, vendors }) {
  const [shifts, setShifts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [arRecords, setArRecords] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonFilter, setSeasonFilter] = useState("");
  
  // Modal state
  const [modalState, setModalState] = useState({ type: null, householdId: null, data: null });
  const [showARModal, setShowARModal] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const loadData = async () => {
      try {
        // Load sequentially with small delays to avoid rate limits
        const s = await base44.entities.Shift.list();
        setShifts(s);
        await new Promise(r => setTimeout(r, 100));
        
        const e = await base44.entities.Expense.list();
        setExpenses(e);
        await new Promise(r => setTimeout(r, 100));
        
        const ar = await base44.entities.AR.list();
        setArRecords(ar);
        await new Promise(r => setTimeout(r, 100));
        
        const settings = await base44.entities.AppSettings.list();
        setAppSettings(settings?.[0] || null);
      } catch (err) {
        console.error("Error loading overview data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const seasons = useMemo(() => {
    const m = new Map();
    households.forEach(h => {
      const s = (h.season || '').trim();
      if (!s) return;
      const key = s.toUpperCase();
      if (!m.has(key)) m.set(key, s);
    });
    return Array.from(m.values()).sort();
  }, [households]);

  const filteredHouseholds = useMemo(() => {
    if (!seasonFilter) return households;
    const target = seasonFilter.trim().toUpperCase();
    return households.filter(h => (h.season || '').trim().toUpperCase() === target);
  }, [households, seasonFilter]);

  const vendorById = useMemo(() => {
    const m = {};
    (vendors || []).forEach(v => { m[v.id] = v; });
    return m;
  }, [vendors]);

  // Mirror OrdersModal/lib-orderTotals: when vendor.has_vat === false, the stored amount is net — add VAT on top.
  const orderChargedAmount = (o) => {
    const net = Number(o.total_amount || 0) - Number(o.total_returned_amount || 0);
    const vendor = vendorById[o.vendor_id];
    const vendorHasVat = vendor ? vendor.has_vat !== false : true;
    if (vendorHasVat) return net;
    const rate = (o.vat_rate != null) ? o.vat_rate : 0.18;
    return net * (1 + rate);
  };

  const rows = useMemo(() => {
    return filteredHouseholds.map((h, idx) => {
      const curr = isUSA(h.country) ? "$" : "₪";
      const hShifts = shifts.filter(s => s.household_id === h.id && s.is_active !== false && s.is_approved);
      const hExpenses = expenses.filter(e => e.charge_entity_id === h.id && (!e.charge_entity_type || e.charge_entity_type === 'household') && e.is_approved);
      const hAR = arRecords.filter(ar => ar.household_id === h.id);
      const _hAR = hAR; // Store AR records for modal
      const hOrders = (orders || []).filter(o => o.household_id === h.id && o.for_billing === true && o.status !== 'cancelled');

      const vatRate = h.vat_rate != null ? h.vat_rate : 0.18;

      const chefs = calcLaborFor(hShifts, LABOR_ROLES.chef);
      const sousChef = calcLaborFor(hShifts, LABOR_ROLES.sous_chef);
      const cooks = calcLaborFor(hShifts, LABOR_ROLES.cook);
      const houseManagers = calcLaborFor(hShifts, LABOR_ROLES.house_manager);
      const waiters = calcLaborFor(hShifts, LABOR_ROLES.waiter);
      const housekeepers = calcLaborFor(hShifts, LABOR_ROLES.housekeeper);

      const laborSubtotal = chefs + sousChef + cooks + houseManagers + waiters + housekeepers;
      const vat = laborSubtotal * vatRate;

      const apExpenses = hExpenses.filter(e => !isClientCC(e.paid_by));
      const cccExpenses = hExpenses.filter(e => isClientCC(e.paid_by));
      const ap = apExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const putOnCCC = cccExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const ordersTotal = hOrders.reduce((s, o) => s + orderChargedAmount(o), 0);

      const total = laborSubtotal + vat + ap + ordersTotal;
      const totalReceivables = hAR.reduce((s, ar) => s + (ar.amount || 0), 0);
      const afterReceivables = total - totalReceivables;

      const downPaymentRequested = hAR.some(ar =>
        (ar.description || "").toLowerCase().includes("down") ||
        (ar.payment_method || "").toLowerCase().includes("down")
      );

      const code = (h.household_code || "").split("-")[0] || "";

      return {
        _id: h.id,
        _curr: curr,
        _name: h.name,
        _chefShifts: hShifts.filter(s => matchRole(s.job, LABOR_ROLES.chef)),
        _sousChefShifts: hShifts.filter(s => matchRole(s.job, LABOR_ROLES.sous_chef)),
        _cookShifts: hShifts.filter(s => matchRole(s.job, LABOR_ROLES.cook)),
        _houseManagerShifts: hShifts.filter(s => matchRole(s.job, LABOR_ROLES.house_manager)),
        _waiterShifts: hShifts.filter(s => matchRole(s.job, LABOR_ROLES.waiter)),
        _housekeeperShifts: hShifts.filter(s => matchRole(s.job, LABOR_ROLES.housekeeper)),
        _orders: hOrders,
        _apExpenses: apExpenses,
        _cccExpenses: cccExpenses,
        _arRecords: _hAR,
        clientNum: code,
        clientName: h.name + (h.name_hebrew ? ` / ${h.name_hebrew}` : ""),
        downPayment: downPaymentRequested ? "Yes" : "No",
        chefs: fmtNum(chefs),
        sousChef: fmtNum(sousChef),
        cooks: fmtNum(cooks),
        houseManagers: fmtNum(houseManagers),
        waiters: fmtNum(waiters),
        housekeepers: fmtNum(housekeepers),
        ap: fmtNum(ap),
        orders: fmtNum(ordersTotal),
        putOnCCC: fmtNum(putOnCCC),
        vat: fmtNum(vat),
        total: fmtNum(total),
        totalReceivables: fmtNum(totalReceivables),
        afterReceivables: fmtNum(afterReceivables),
        season: h.season || "",
      };
    });
  }, [filteredHouseholds, shifts, expenses, arRecords, orders, vendorById]);

  const columns = [
    { key: "clientNum",        label: "Client #",          width: 70 },
    { key: "clientName",       label: "Client Name",        width: 200 },
    { key: "downPayment",      label: "Down Payment?",      width: 100 },
    { key: "chefs",            label: "Chefs",              width: 90,  numeric: true, render: r => <button onClick={() => setModalState({ type: "shifts", role: "Chefs", householdId: r._id, shifts: r._chefShifts })} className={`cursor-pointer hover:underline ${r.chefs ? "text-gray-800" : "text-gray-300"}`}>{r.chefs ? fmt(r.chefs, r._curr) : "—"}</button> },
    { key: "sousChef",         label: "Sous Chef",          width: 90,  numeric: true, render: r => <button onClick={() => setModalState({ type: "shifts", role: "Sous Chef", householdId: r._id, shifts: r._sousChefShifts })} className={`cursor-pointer hover:underline ${r.sousChef ? "text-gray-800" : "text-gray-300"}`}>{r.sousChef ? fmt(r.sousChef, r._curr) : "—"}</button> },
    { key: "cooks",            label: "Cooks",              width: 80,  numeric: true, render: r => <button onClick={() => setModalState({ type: "shifts", role: "Cooks", householdId: r._id, shifts: r._cookShifts })} className={`cursor-pointer hover:underline ${r.cooks ? "text-gray-800" : "text-gray-300"}`}>{r.cooks ? fmt(r.cooks, r._curr) : "—"}</button> },
    { key: "houseManagers",    label: "House Managers",     width: 110, numeric: true, render: r => <button onClick={() => setModalState({ type: "shifts", role: "House Managers", householdId: r._id, shifts: r._houseManagerShifts })} className={`cursor-pointer hover:underline ${r.houseManagers ? "text-gray-800" : "text-gray-300"}`}>{r.houseManagers ? fmt(r.houseManagers, r._curr) : "—"}</button> },
    { key: "waiters",          label: "Waiters",            width: 80,  numeric: true, render: r => <button onClick={() => setModalState({ type: "shifts", role: "Waiters", householdId: r._id, shifts: r._waiterShifts })} className={`cursor-pointer hover:underline ${r.waiters ? "text-gray-800" : "text-gray-300"}`}>{r.waiters ? fmt(r.waiters, r._curr) : "—"}</button> },
    { key: "housekeepers",     label: "Housekeepers",       width: 100, numeric: true, render: r => <button onClick={() => setModalState({ type: "shifts", role: "Housekeepers", householdId: r._id, shifts: r._housekeeperShifts })} className={`cursor-pointer hover:underline ${r.housekeepers ? "text-gray-800" : "text-gray-300"}`}>{r.housekeepers ? fmt(r.housekeepers, r._curr) : "—"}</button> },
    { key: "ap",               label: "A/P",                width: 80,  numeric: true, render: r => <button onClick={() => setModalState({ type: "expenses", title: "A/P", householdId: r._id, expenses: r._apExpenses })} className={`cursor-pointer hover:underline ${r.ap ? "text-gray-800" : "text-gray-300"}`}>{r.ap ? fmt(r.ap, r._curr) : "—"}</button> },
    { key: "orders",           label: "Orders",             width: 80,  numeric: true, render: r => <button onClick={() => setModalState({ type: "orders", householdId: r._id, orders: r._orders })} className={`cursor-pointer hover:underline ${r.orders ? "text-gray-800" : "text-gray-300"}`}>{r.orders ? fmt(r.orders, r._curr) : "—"}</button> },
    { key: "putOnCCC",         label: "Put on CCC",         width: 90,  numeric: true, render: r => <button onClick={() => setModalState({ type: "expenses", title: "Client CC", householdId: r._id, expenses: r._cccExpenses })} className={`cursor-pointer hover:underline ${r.putOnCCC ? "text-gray-500 italic" : "text-gray-300"}`}>{r.putOnCCC ? fmt(r.putOnCCC, r._curr) : "—"}</button> },
    { key: "vat",              label: "VAT",                width: 80,  numeric: true, render: r => <span className={r.vat ? "text-orange-600" : "text-gray-300"}>{r.vat ? fmt(r.vat, r._curr) : "—"}</span> },
    { key: "total",            label: "Total",              width: 100, numeric: true, render: r => <span className="font-bold text-blue-700">{fmt(r.total, r._curr)}</span> },
    { key: "totalReceivables", label: "Total Recv.",        width: 100, numeric: true, render: r => <button onClick={() => setModalState({ type: "ar", householdId: r._id, arRecords: r._arRecords })} className={`cursor-pointer hover:underline ${r.totalReceivables ? "text-purple-600" : "text-gray-300"}`}>{r.totalReceivables ? fmt(r.totalReceivables, r._curr) : "—"}</button> },
    { key: "afterReceivables", label: "After Recv.",        width: 100, numeric: true, render: r => <span className={`font-bold ${r.afterReceivables > 0 ? "text-red-600" : r.afterReceivables < 0 ? "text-green-700" : "text-gray-400"}`}>{fmt(r.afterReceivables, r._curr)}</span> },
    { key: "season",           label: "Season",             width: 70 },
  ];

  const getFooterRow = (visibleRows) => {
    const sum = (key) => visibleRows.reduce((s, r) => s + (r[key] || 0), 0);
    return {
      clientNum:        "TOTALS",
      clientName:       `${visibleRows.length} clients`,
      downPayment:      "",
      chefs:            fmt(sum("chefs")),
      sousChef:         fmt(sum("sousChef")),
      cooks:            fmt(sum("cooks")),
      houseManagers:    fmt(sum("houseManagers")),
      waiters:          fmt(sum("waiters")),
      housekeepers:     fmt(sum("housekeepers")),
      ap:               fmt(sum("ap")),
      orders:           fmt(sum("orders")),
      putOnCCC:         fmt(sum("putOnCCC")),
      vat:              fmt(sum("vat")),
      total:            fmt(sum("total")),
      totalReceivables: fmt(sum("totalReceivables")),
      afterReceivables: fmt(sum("afterReceivables")),
      season:           "",
    };
  };

  if (isLoading) return (
    <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  const getCurrentHousehold = () => rows.find(r => r._id === modalState.householdId);

  return (
    <div className="space-y-4">
      {/* Season filter + Add AR button */}
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
        <button
          onClick={() => setShowARModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Payment
        </button>
      </div>

      <ExcelTable
        columns={columns}
        data={rows}
        getRowKey={r => r._id}
        getFooterRow={getFooterRow}
      />

      {/* Modals */}
      {modalState.type === "shifts" && getCurrentHousehold() && (
        <ShiftsModal
          isOpen={true}
          onClose={() => setModalState({ type: null, householdId: null, data: null })}
          shifts={modalState.shifts || []}
          roleName={modalState.role}
          curr={getCurrentHousehold()._curr}
          householdName={getCurrentHousehold()._name}
        />
      )}

      {modalState.type === "orders" && getCurrentHousehold() && (
        <OrdersModal
          isOpen={true}
          onClose={() => setModalState({ type: null, householdId: null, data: null })}
          orders={modalState.orders || []}
          householdName={getCurrentHousehold()._name}
          vendors={vendors || []}
        />
      )}

      {modalState.type === "expenses" && getCurrentHousehold() && (
        <ExpensesModal
          isOpen={true}
          onClose={() => setModalState({ type: null, householdId: null, data: null })}
          expenses={modalState.expenses || []}
          title={modalState.title}
          householdName={getCurrentHousehold()._name}
        />
      )}

      {modalState.type === "ar" && getCurrentHousehold() && (
        <ARModal
          isOpen={true}
          onClose={() => setModalState({ type: null, householdId: null, data: null })}
          arRecords={modalState.arRecords || []}
          householdName={getCurrentHousehold()._name}
        />
      )}

      {/* AR Entry Modal */}
      <AREntryModal
        isOpen={showARModal}
        onClose={() => setShowARModal(false)}
        onSuccess={() => {
          // Reload AR records
          base44.entities.AR.list().then(ar => setArRecords(ar));
        }}
        households={households}
      />
    </div>
  );
}