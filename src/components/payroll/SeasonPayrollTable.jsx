import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Save, RefreshCw } from 'lucide-react';

const POSITIONS = ['Chef', 'Sous Chef', 'Cook', 'House Manager', 'Waiter', 'HK', 'Bartender', 'Security', 'Logistics', 'Driver', 'Other'];

const COL_WIDTHS = {
  position: 130,
  name: 160,
  referred_by: 130,
  hours: 90,
  per_hour: 90,
  gross_total: 110,
  expenses_ap_tip: 110,
  kcs_cash_downpayment: 110,
  paid_by_avi: 100,
  paid_by_avrumi_dad: 110,
  final_balance: 110,
  confirmed_by_staff: 80,
  paid: 90,
  approved: 110,
  hour_profit: 110,
};

const HEADERS = [
  { key: 'position', label: 'Position' },
  { key: 'name', label: 'Name' },
  { key: 'referred_by', label: 'Referred by' },
  { key: 'hours', label: 'Hours', calc: true },
  { key: 'per_hour', label: 'Per Hour' },
  { key: 'gross_total', label: 'Gross Total', calc: true },
  { key: 'expenses_ap_tip', label: 'Expenses AP+Tip' },
  { key: 'kcs_cash_downpayment', label: 'KCS Cash' },
  { key: 'paid_by_avi', label: 'Paid by Avi' },
  { key: 'paid_by_avrumi_dad', label: 'Paid by Avrumi Dad' },
  { key: 'final_balance', label: 'Final Balance', calc: true },
  { key: 'confirmed_by_staff', label: 'Confirmed' },
  { key: 'paid', label: 'Paid' },
  { key: 'approved', label: 'Approved' },
  { key: 'hour_profit', label: 'KCS Hr Profit', calc: true },
];

function calcRow(row, timeLogs) {
  // Hours: sum from time logs for this staff name
  const hours = timeLogs
    .filter(l => l.name && row.name && l.name.trim().toLowerCase() === row.name.trim().toLowerCase())
    .reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);

  const per_hour = parseFloat(row.per_hour) || 0;
  const gross_total = parseFloat((hours * per_hour).toFixed(2));
  const expenses_ap_tip = parseFloat(row.expenses_ap_tip) || 0;
  const kcs_cash_downpayment = parseFloat(row.kcs_cash_downpayment) || 0;
  const paid_by_avi = parseFloat(row.paid_by_avi) || 0;
  const paid_by_avrumi_dad = parseFloat(row.paid_by_avrumi_dad) || 0;
  const final_balance = parseFloat((gross_total + expenses_ap_tip - kcs_cash_downpayment - paid_by_avi - paid_by_avrumi_dad).toFixed(2));

  // KCS hour profit: we don't have a billing rate per row here, but hour_profit can be stored manually or left as stored
  // If it's stored, show it; if not, we leave it to manual entry (billing rate not on this entity)
  const hour_profit = row.hour_profit !== undefined && row.hour_profit !== null ? parseFloat(row.hour_profit) || 0 : 0;

  return { ...row, hours, gross_total, final_balance };
}

export default function SeasonPayrollTable({ season }) {
  const [rows, setRows] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirtyIds, setDirtyIds] = useState(new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [payrollData, logData] = await Promise.all([
        season
          ? base44.entities.SeasonPayroll.filter({ season })
          : base44.entities.SeasonPayroll.list(),
        season
          ? base44.entities.TimeLog.filter({ season })
          : base44.entities.TimeLog.list(),
      ]);
      setTimeLogs(logData);
      setRows(payrollData.map(r => calcRow(r, logData)));
    } finally {
      setIsLoading(false);
    }
  }, [season]);

  useEffect(() => { load(); }, [load]);

  const updateCell = (rowId, field, value) => {
    setRows(prev => {
      const updated = prev.map(r => {
        if (r.id !== rowId) return r;
        const next = { ...r, [field]: value };
        return calcRow(next, timeLogs);
      });
      return updated;
    });
    setDirtyIds(prev => new Set(prev).add(rowId));
  };

  const addRow = async () => {
    const newRec = await base44.entities.SeasonPayroll.create({
      position: 'Chef',
      name: '',
      hours: 0,
      per_hour: 0,
      season: season || '',
    });
    setRows(prev => [...prev, calcRow(newRec, timeLogs)]);
  };

  const deleteRow = async (rowId) => {
    if (!window.confirm('Delete this row?')) return;
    await base44.entities.SeasonPayroll.delete(rowId);
    setRows(prev => prev.filter(r => r.id !== rowId));
    setDirtyIds(prev => { const s = new Set(prev); s.delete(rowId); return s; });
  };

  const saveAll = async () => {
    if (dirtyIds.size === 0) return;
    setIsSaving(true);
    try {
      const toSave = rows.filter(r => dirtyIds.has(r.id));
      await Promise.all(toSave.map(r =>
        base44.entities.SeasonPayroll.update(r.id, {
          position: r.position,
          name: r.name,
          referred_by: r.referred_by,
          per_hour: r.per_hour,
          expenses_ap_tip: r.expenses_ap_tip,
          kcs_cash_downpayment: r.kcs_cash_downpayment,
          paid_by_avi: r.paid_by_avi,
          paid_by_avrumi_dad: r.paid_by_avrumi_dad,
          confirmed_by_staff: r.confirmed_by_staff,
          paid: r.paid,
          approved: r.approved,
          hour_profit: r.hour_profit,
          season: r.season,
        })
      ));
      setDirtyIds(new Set());
    } finally {
      setIsSaving(false);
    }
  };

  // Totals
  const totals = rows.reduce((acc, r) => {
    acc.hours += r.hours || 0;
    acc.gross_total += r.gross_total || 0;
    acc.expenses_ap_tip += parseFloat(r.expenses_ap_tip) || 0;
    acc.kcs_cash_downpayment += parseFloat(r.kcs_cash_downpayment) || 0;
    acc.paid_by_avi += parseFloat(r.paid_by_avi) || 0;
    acc.paid_by_avrumi_dad += parseFloat(r.paid_by_avrumi_dad) || 0;
    acc.final_balance += r.final_balance || 0;
    acc.hour_profit += parseFloat(r.hour_profit) || 0;
    return acc;
  }, { hours: 0, gross_total: 0, expenses_ap_tip: 0, kcs_cash_downpayment: 0, paid_by_avi: 0, paid_by_avrumi_dad: 0, final_balance: 0, hour_profit: 0 });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const cellBase = "h-8 px-1 text-xs border-0 rounded-none focus:ring-1 focus:ring-blue-400 bg-transparent";
  const calcCell = "bg-blue-50 text-blue-900 font-medium text-xs text-right px-2 flex items-center justify-end h-8";
  const thStyle = (key) => ({
    minWidth: COL_WIDTHS[key],
    width: COL_WIDTHS[key],
    fontSize: 11,
    whiteSpace: 'nowrap',
    background: '#1e3a5f',
    color: '#fff',
    fontWeight: 600,
    padding: '0 8px',
    height: 36,
    borderRight: '1px solid #2d5382',
    userSelect: 'none',
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex gap-2">
          <Button size="sm" onClick={addRow} className="bg-green-600 hover:bg-green-700 h-8 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Add Row
          </Button>
          <Button size="sm" variant="outline" onClick={load} className="h-8 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </div>
        <Button
          size="sm"
          onClick={saveAll}
          disabled={isSaving || dirtyIds.size === 0}
          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Save {dirtyIds.size > 0 ? `(${dirtyIds.size})` : ''}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded-md" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              {HEADERS.map(h => (
                <th key={h.key} style={thStyle(h.key)}>
                  <span>{h.label}</span>
                  {h.calc && <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>auto</span>}
                </th>
              ))}
              <th style={{ ...thStyle('del'), minWidth: 40, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
              >
                {/* Position */}
                <td style={{ width: COL_WIDTHS.position, borderRight: '1px solid #e2e8f0' }}>
                  <select
                    value={row.position || ''}
                    onChange={e => updateCell(row.id, 'position', e.target.value)}
                    style={{ width: '100%', height: 32, fontSize: 12, border: 'none', background: 'transparent', padding: '0 4px', outline: 'none' }}
                  >
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                {/* Name */}
                <td style={{ width: COL_WIDTHS.name, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    value={row.name || ''}
                    onChange={e => updateCell(row.id, 'name', e.target.value)}
                    className={cellBase}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* Referred by */}
                <td style={{ width: COL_WIDTHS.referred_by, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    value={row.referred_by || ''}
                    onChange={e => updateCell(row.id, 'referred_by', e.target.value)}
                    className={cellBase}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* Hours - AUTO */}
                <td style={{ width: COL_WIDTHS.hours, borderRight: '1px solid #e2e8f0', background: '#eff6ff' }}>
                  <div className={calcCell}>{(row.hours || 0).toFixed(2)}</div>
                </td>
                {/* Per Hour */}
                <td style={{ width: COL_WIDTHS.per_hour, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    type="number"
                    value={row.per_hour ?? ''}
                    onChange={e => updateCell(row.id, 'per_hour', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={cellBase + ' text-right'}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* Gross Total - AUTO */}
                <td style={{ width: COL_WIDTHS.gross_total, borderRight: '1px solid #e2e8f0', background: '#eff6ff' }}>
                  <div className={calcCell}>₪{(row.gross_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </td>
                {/* Expenses AP+Tip */}
                <td style={{ width: COL_WIDTHS.expenses_ap_tip, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    type="number"
                    value={row.expenses_ap_tip ?? ''}
                    onChange={e => updateCell(row.id, 'expenses_ap_tip', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={cellBase + ' text-right'}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* KCS Cash */}
                <td style={{ width: COL_WIDTHS.kcs_cash_downpayment, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    type="number"
                    value={row.kcs_cash_downpayment ?? ''}
                    onChange={e => updateCell(row.id, 'kcs_cash_downpayment', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={cellBase + ' text-right'}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* Paid by Avi */}
                <td style={{ width: COL_WIDTHS.paid_by_avi, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    type="number"
                    value={row.paid_by_avi ?? ''}
                    onChange={e => updateCell(row.id, 'paid_by_avi', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={cellBase + ' text-right'}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* Paid by Avrumi Dad */}
                <td style={{ width: COL_WIDTHS.paid_by_avrumi_dad, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    type="number"
                    value={row.paid_by_avrumi_dad ?? ''}
                    onChange={e => updateCell(row.id, 'paid_by_avrumi_dad', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={cellBase + ' text-right'}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* Final Balance - AUTO */}
                <td style={{ width: COL_WIDTHS.final_balance, borderRight: '1px solid #e2e8f0', background: '#eff6ff' }}>
                  <div className={calcCell + (row.final_balance < 0 ? ' text-red-700' : '')}>
                    ₪{(row.final_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </td>
                {/* Confirmed by Staff */}
                <td style={{ width: COL_WIDTHS.confirmed_by_staff, borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!row.confirmed_by_staff}
                    onChange={e => updateCell(row.id, 'confirmed_by_staff', e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                </td>
                {/* Paid */}
                <td style={{ width: COL_WIDTHS.paid, borderRight: '1px solid #e2e8f0' }}>
                  <select
                    value={row.paid || ''}
                    onChange={e => updateCell(row.id, 'paid', e.target.value)}
                    style={{ width: '100%', height: 32, fontSize: 12, border: 'none', background: 'transparent', padding: '0 4px', outline: 'none' }}
                  >
                    <option value="">-</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Partial">Partial</option>
                  </select>
                </td>
                {/* Approved */}
                <td style={{ width: COL_WIDTHS.approved, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    value={row.approved || ''}
                    onChange={e => updateCell(row.id, 'approved', e.target.value)}
                    className={cellBase}
                    style={{ width: '100%' }}
                  />
                </td>
                {/* Hour Profit (manual) */}
                <td style={{ width: COL_WIDTHS.hour_profit, borderRight: '1px solid #e2e8f0' }}>
                  <Input
                    type="number"
                    value={row.hour_profit ?? ''}
                    onChange={e => updateCell(row.id, 'hour_profit', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={cellBase + ' text-right'}
                    style={{ width: '100%' }}
                    placeholder="0"
                  />
                </td>
                {/* Delete */}
                <td style={{ width: 40, textAlign: 'center' }}>
                  <button
                    onClick={() => deleteRow(row.id)}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    title="Delete row"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            {rows.length > 0 && (
              <tr style={{ background: '#1e3a5f', color: '#fff', fontWeight: 700, fontSize: 12, position: 'sticky', bottom: 0 }}>
                <td colSpan={3} style={{ padding: '6px 10px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>TOTALS</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>{totals.hours.toFixed(2)}</td>
                <td style={{ borderRight: '1px solid #2d5382' }}></td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>₪{totals.gross_total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>₪{totals.expenses_ap_tip.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>₪{totals.kcs_cash_downpayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>₪{totals.paid_by_avi.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>₪{totals.paid_by_avrumi_dad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>₪{totals.final_balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td colSpan={3} style={{ borderRight: '1px solid #2d5382' }}></td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #2d5382' }}>₪{totals.hour_profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No payroll records yet. Click "Add Row" to get started.
          </div>
        )}
      </div>
    </div>
  );
}