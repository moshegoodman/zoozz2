import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronDown, ChevronUp, FileDown } from "lucide-react";
import { format } from "date-fns";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CLIENT_CC_LIKE = ["client cc", "clientcc", "client"];
function isClientCC(paid_by) {
  const lower = (paid_by || "").toLowerCase();
  return CLIENT_CC_LIKE.some(v => lower.includes(v));
}

// Detect currency from household country field
function detectCurrency(household) {
  const country = (household.country || "").toLowerCase();
  const israelKeywords = ["israel", "il", "ישראל"];
  if (israelKeywords.some(k => country.includes(k))) return "ILS";
  return "USD";
}

const CURRENCY_SYMBOL = { ILS: "₪", USD: "$" };

export default function SpendingReport({ households, orders }) {
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingRow, setExportingRow] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  // currency overrides: { [household_id]: "ILS" | "USD" }
  const [currencyOverrides, setCurrencyOverrides] = useState({});

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      base44.entities.Expense.list(),
      base44.entities.Vendor.list(),
    ]).then(([e, v]) => {
      setExpenses(e.filter(x => x.is_active !== false && x.is_approved && isClientCC(x.paid_by)));
      setVendors(v);
    }).finally(() => setIsLoading(false));
  }, []);

  const vendorMap = useMemo(() => {
    const m = {};
    vendors.forEach(v => { m[v.id] = v.name; });
    return m;
  }, [vendors]);

  const reportRows = useMemo(() => {
    return households.map(h => {
      const hExpenses = expenses.filter(e => e.household_id === h.id);
      const hOrders = (orders || []).filter(o => o.household_id === h.id && !o.for_billing && o.status !== "cancelled");
      const expenseTotal = hExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const ordersTotal = hOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const grandTotal = expenseTotal + ordersTotal;
      return { household: h, expenseTotal, ordersTotal, grandTotal, hExpenses, hOrders };
    }).filter(r => r.grandTotal > 0).sort((a, b) => b.grandTotal - a.grandTotal);
  }, [households, expenses, orders]);

  const totals = useMemo(() => reportRows.reduce((acc, r) => ({
    expense: acc.expense + r.expenseTotal,
    orders: acc.orders + r.ordersTotal,
    grand: acc.grand + r.grandTotal,
  }), { expense: 0, orders: 0, grand: 0 }), [reportRows]);

  const getCurrency = (householdId) => {
    const h = households.find(x => x.id === householdId);
    return currencyOverrides[householdId] || (h ? detectCurrency(h) : "USD");
  };

  const getSym = (householdId) => CURRENCY_SYMBOL[getCurrency(householdId)];

  const toggleCurrency = (householdId, e) => {
    e.stopPropagation();
    const current = getCurrency(householdId);
    setCurrencyOverrides(prev => ({ ...prev, [householdId]: current === "ILS" ? "USD" : "ILS" }));
  };

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const buildPdfHtml = (rows, title) => {
    const tableRows = rows.map(r => {
      const sym = CURRENCY_SYMBOL[getCurrency(r.household.id)];
      return `
        <tr>
          <td style="font-weight:600">${r.household.name}${r.household.name_hebrew ? ` / ${r.household.name_hebrew}` : ""}${r.household.season ? ` <span style="color:#888;font-size:11px;">(${r.household.season})</span>` : ""}</td>
          <td class="num">${sym}${fmt(r.expenseTotal)}</td>
          <td class="num">${sym}${fmt(r.ordersTotal)}</td>
          <td class="num" style="font-weight:700;color:#1a1a1a;">${sym}${fmt(r.grandTotal)}</td>
        </tr>
      `;
    }).join("");

    const expTotal = rows.reduce((s, r) => s + r.expenseTotal, 0);
    const ordTotal = rows.reduce((s, r) => s + r.ordersTotal, 0);
    const gTotal = rows.reduce((s, r) => s + r.grandTotal, 0);
    // For the grand total row use mixed or single symbol
    const allSameCurrency = rows.every(r => getCurrency(r.household.id) === getCurrency(rows[0].household.id));
    const grandSym = allSameCurrency ? CURRENCY_SYMBOL[getCurrency(rows[0].household.id)] : "";

    const detailSections = rows.map(r => {
      const sym = CURRENCY_SYMBOL[getCurrency(r.household.id)];
      const expRows = r.hExpenses.map(e => `<tr>
        <td>${e.date ? format(new Date(e.date), "MMM d, yyyy") : "—"}</td>
        <td>${e.description || "—"}</td>
        <td>${e.paid_by || "—"}</td>
        <td class="num">${sym}${fmt(e.amount)}</td>
      </tr>`).join("");

      const orderRows = r.hOrders.map(o => `<tr>
        <td>${vendorMap[o.vendor_id] || "—"}</td>
        <td>${o.created_date ? format(new Date(o.created_date), "MMM d, yyyy") : "—"}</td>
        <td>${(o.items || []).length} items</td>
        <td class="num">${sym}${fmt(o.total_amount)}</td>
      </tr>`).join("");

      return `
        <div class="section-header">${r.household.name}${r.household.season ? ` (${r.household.season})` : ""}</div>
        ${r.hExpenses.length > 0 ? `
          <div class="sub-header">A/P — Client Credit Card</div>
          <table><thead><tr><th>Date</th><th>Description</th><th>Paid By</th><th class="num">Amount</th></tr></thead>
          <tbody>${expRows}</tbody>
          <tfoot><tr><td colspan="3">A/P Total</td><td class="num">${sym}${fmt(r.expenseTotal)}</td></tr></tfoot></table>` : ""}
        ${r.hOrders.length > 0 ? `
          <div class="sub-header">Orders (Client Paid)</div>
          <table><thead><tr><th>Vendor</th><th>Date</th><th>Items</th><th class="num">Total</th></tr></thead>
          <tbody>${orderRows}</tbody>
          <tfoot><tr><td colspan="3">Orders Total</td><td class="num">${sym}${fmt(r.ordersTotal)}</td></tr></tfoot></table>` : ""}
        <div class="household-total">Client Total: <strong>${sym}${fmt(r.grandTotal)}</strong></div>
      `;
    }).join('<div class="page-break"></div>');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      body { font-family: Arial, sans-serif; padding: 40px 48px; color: #1a1a1a; font-size: 13px; }
      .letterhead { display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid #c9a84c; padding-bottom: 18px; margin-bottom: 24px; }
      .company { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
      .report-title { font-size: 24px; font-weight: bold; text-align: right; }
      .report-date { font-size: 11px; color: #888; text-align: right; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      thead tr { background: #1a1a1a; color: #fff; }
      th { padding: 8px 12px; text-align: left; font-size: 11px; letter-spacing: 0.5px; }
      td { padding: 7px 12px; border-bottom: 1px solid #eee; }
      tbody tr:nth-child(even) { background: #fafaf7; }
      tfoot td { background: #f5f0e8; font-weight: 700; border-top: 2px solid #c9a84c; }
      .num { text-align: right; }
      .grand-row { background: #1a1a1a !important; color: #c9a84c; font-weight: bold; font-size: 14px; }
      .section-header { font-size: 16px; font-weight: bold; background: #f5f0e8; border-left: 4px solid #c9a84c; padding: 8px 12px; margin: 24px 0 8px; }
      .sub-header { font-size: 12px; font-weight: bold; color: #7a6020; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 4px; border-bottom: 1px solid #e8e0cc; padding-bottom: 3px; }
      .household-total { text-align: right; padding: 8px 12px; background: #fdfaf3; border: 1px solid #c9a84c; border-radius: 4px; margin-top: 8px; font-size: 14px; }
      .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
      .page-break { page-break-before: always; margin-top: 40px; }
    </style></head><body>
      <div class="letterhead">
        <div>
          <img src="https://media.base44.com/images/public/68741e1ee947984fac63c8cf/9c73cd871_Picture1.png" style="height:60px;object-fit:contain;" alt="KCS" />
          <div class="company">Kosher Chef Services</div>
        </div>
        <div>
          <div class="report-title">${title}</div>
          <div class="report-date">Generated: ${format(new Date(), "MMMM d, yyyy")}</div>
        </div>
      </div>
      <h2 style="font-size:15px;margin-bottom:12px;color:#444;">Summary — Client Self-Paid Spending</h2>
      <table>
        <thead><tr><th>Client / Household</th><th class="num">A/P (Client CC)</th><th class="num">Orders (Client Paid)</th><th class="num">Total</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr class="grand-row">
            <td>TOTAL</td>
            <td class="num">${grandSym}${fmt(expTotal)}</td>
            <td class="num">${grandSym}${fmt(ordTotal)}</td>
            <td class="num">${grandSym}${fmt(gTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="page-break"></div>
      <h2 style="font-size:15px;margin-bottom:4px;color:#444;">Detailed Breakdown</h2>
      ${detailSections}
      <div class="footer">Kosher Chef Services &nbsp;|&nbsp; info@koshercs.com</div>
    </body></html>`;
  };

  const downloadPdf = async (htmlContent, filename) => {
    const res = await base44.functions.invoke("my_html2pdf", {
      htmlContent,
      filename,
      options: { format: "A4", margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" }, printBackground: true }
    });
    let data = res?.data;
    while (typeof data === "string") { try { data = JSON.parse(data); } catch { break; } }
    const b64 = (data?.pdfBase64 || data || "").replace(/\s/g, "");
    const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const html = buildPdfHtml(reportRows, "Client Spending Report");
      await downloadPdf(html, `Spending-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportRowPDF = async (r, e) => {
    e.stopPropagation();
    setExportingRow(r.household.id);
    try {
      const safeName = r.household.name.replace(/[^a-zA-Z0-9]/g, "-");
      const html = buildPdfHtml([r], `Spending Report — ${r.household.name}`);
      await downloadPdf(html, `Spending-${safeName}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setExportingRow(null);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Client Spending Report</h2>
          <p className="text-sm text-gray-500 mt-0.5">Client self-paid spending: A/P expenses paid by client CC + orders not billed to KCS</p>
        </div>
        <Button onClick={handleExportPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? "Generating PDF..." : "Download PDF"}
        </Button>
      </div>

      {reportRows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No spending data found (no approved expenses, shifts or billable orders).</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Client / Household</th>
                <th className="px-4 py-3 text-right">A/P (Client CC)</th>
                <th className="px-4 py-3 text-right">Orders (Client Paid)</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-3 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map(r => {
                const sym = getSym(r.household.id);
                const currency = getCurrency(r.household.id);
                return (
                  <React.Fragment key={r.household.id}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRow(r.household.id)}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {r.household.name}
                        {r.household.name_hebrew && <span className="font-normal text-gray-500 mr-2"> / {r.household.name_hebrew}</span>}
                        {r.household.season && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{r.household.season}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{sym}{fmt(r.expenseTotal)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{sym}{fmt(r.ordersTotal)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{sym}{fmt(r.grandTotal)}</td>
                      <td className="px-3 py-3 text-gray-400">
                        <div className="flex items-center gap-1">
                          {/* Currency toggle button */}
                          <button
                            onClick={(e) => toggleCurrency(r.household.id, e)}
                            className="px-1.5 py-0.5 rounded text-xs font-bold border border-gray-300 hover:border-blue-400 hover:text-blue-600 transition-colors bg-white"
                            title={`Switch to ${currency === "ILS" ? "USD ($)" : "ILS (₪)"}`}
                          >
                            {sym}
                          </button>
                          <button
                            onClick={(e) => handleExportRowPDF(r, e)}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
                            title="Download PDF for this client"
                          >
                            {exportingRow === r.household.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <FileDown className="w-3.5 h-3.5" />}
                          </button>
                          {expandedRows[r.household.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </td>
                    </tr>
                    {expandedRows[r.household.id] && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-6 py-4 border-b">
                          <div className="space-y-4">
                            {r.hExpenses.length > 0 && (
                              <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">A/P — Client Credit Card ({r.hExpenses.length} items)</div>
                                <table className="w-full text-xs border-collapse">
                                  <thead><tr className="bg-gray-200 text-gray-600">
                                    <th className="px-3 py-1.5 text-left">Date</th>
                                    <th className="px-3 py-1.5 text-left">Description</th>
                                    <th className="px-3 py-1.5 text-left">Paid By</th>
                                    <th className="px-3 py-1.5 text-right">Amount</th>
                                  </tr></thead>
                                  <tbody>
                                    {r.hExpenses.map(e => (
                                      <tr key={e.id} className="border-b border-gray-200">
                                        <td className="px-3 py-1.5">{e.date ? format(new Date(e.date), "MMM d, yyyy") : "—"}</td>
                                        <td className="px-3 py-1.5">{e.description || "—"}</td>
                                        <td className="px-3 py-1.5 text-gray-500">{e.paid_by || "—"}</td>
                                        <td className="px-3 py-1.5 text-right font-medium">{sym}{fmt(e.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot><tr className="bg-blue-50">
                                    <td colSpan={3} className="px-3 py-1.5 font-semibold text-blue-800">A/P Total</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-blue-800">{sym}{fmt(r.expenseTotal)}</td>
                                  </tr></tfoot>
                                </table>
                              </div>
                            )}

                            {r.hOrders.length > 0 && (
                              <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-green-700 mb-2">Orders — Client Paid ({r.hOrders.length})</div>
                                <table className="w-full text-xs border-collapse">
                                  <thead><tr className="bg-gray-200 text-gray-600">
                                    <th className="px-3 py-1.5 text-left">Vendor</th>
                                    <th className="px-3 py-1.5 text-left">Date</th>
                                    <th className="px-3 py-1.5 text-right">Items</th>
                                    <th className="px-3 py-1.5 text-right">Total</th>
                                  </tr></thead>
                                  <tbody>
                                    {r.hOrders.map(o => (
                                      <tr key={o.id} className="border-b border-gray-200">
                                        <td className="px-3 py-1.5">{vendorMap[o.vendor_id] || "—"}</td>
                                        <td className="px-3 py-1.5">{o.created_date ? format(new Date(o.created_date), "MMM d, yyyy") : "—"}</td>
                                        <td className="px-3 py-1.5 text-right">{(o.items || []).length}</td>
                                        <td className="px-3 py-1.5 text-right font-medium">{sym}{fmt(o.total_amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot><tr className="bg-green-50">
                                    <td colSpan={3} className="px-3 py-1.5 font-semibold text-green-800">Orders Total</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-green-800">{sym}{fmt(r.ordersTotal)}</td>
                                  </tr></tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-900 text-white font-bold text-sm">
                <td className="px-4 py-3">TOTAL — ALL CLIENTS</td>
                <td className="px-4 py-3 text-right">{fmt(totals.expense)}</td>
                <td className="px-4 py-3 text-right">{fmt(totals.orders)}</td>
                <td className="px-4 py-3 text-right text-yellow-300">{fmt(totals.grand)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}