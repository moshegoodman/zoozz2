import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

/**
 * Generic Excel-like table component.
 * Props:
 *   columns: [{ key, label, render?, width?, numeric? }]
 *   data: array of row objects
 *   getRowKey: fn(row) => string
 *   footerRow?: object with same keys as columns (rendered as totals row)
 *   onDeleteRow?: fn(row)
 */
export default function ExcelTable({ columns, data, getRowKey, footerRow, onDeleteRow }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [colFilters, setColFilters] = useState({});

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const setFilter = (key, value) => {
    setColFilters(f => ({ ...f, [key]: value }));
  };

  const filtered = useMemo(() => {
    return data.filter(row => {
      return columns.every(col => {
        const filterVal = colFilters[col.key]?.toLowerCase();
        if (!filterVal) return true;
        const cellVal = col.render ? col.rawValue?.(row) : row[col.key];
        return String(cellVal ?? "").toLowerCase().includes(filterVal);
      });
    });
  }, [data, colFilters, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const col = columns.find(c => c.key === sortKey);
      const av = col?.rawValue ? col.rawValue(a) : a[sortKey];
      const bv = col?.rawValue ? col.rawValue(b) : b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = col?.numeric
        ? parseFloat(av) - parseFloat(bv)
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" />
      : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />;
  };

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-md">
      <table className="w-full text-xs border-collapse" style={{ minWidth: 600 }}>
        {/* Column header row */}
        <thead>
          <tr className="bg-[#217346] text-white">
            {columns.map(col => (
              <th
                key={col.key}
                className="border border-[#1a5c38] px-2 py-1.5 text-left font-semibold cursor-pointer select-none whitespace-nowrap"
                style={{ width: col.width }}
                onClick={() => handleSort(col.key)}
              >
                {col.label}<SortIcon colKey={col.key} />
              </th>
            ))}
            {onDeleteRow && <th className="border border-[#1a5c38] px-2 py-1.5 w-8" />}
          </tr>
          {/* Filter row */}
          <tr className="bg-[#e2efda]">
            {columns.map(col => (
              <th key={col.key} className="border border-gray-300 px-1 py-0.5">
                <input
                  type="text"
                  placeholder="🔍"
                  value={colFilters[col.key] || ""}
                  onChange={e => setFilter(col.key, e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-1 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-400"
                />
              </th>
            ))}
            {onDeleteRow && <th className="border border-gray-300" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={getRowKey(row)}
              className={i % 2 === 0 ? "bg-white hover:bg-[#e8f5e9]" : "bg-[#f9fafb] hover:bg-[#e8f5e9]"}
            >
              {columns.map(col => (
                <td key={col.key} className="border border-gray-200 px-2 py-1 whitespace-nowrap">
                  {col.render ? col.render(row) : (row[col.key] ?? "—")}
                </td>
              ))}
              {onDeleteRow && (
                <td className="border border-gray-200 px-1 py-1 text-center">
                  <button
                    onClick={() => onDeleteRow(row)}
                    className="text-red-400 hover:text-red-600 text-xs"
                    title="Delete"
                  >✕</button>
                </td>
              )}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length + (onDeleteRow ? 1 : 0)} className="py-8 text-center text-gray-400 border border-gray-200">
                No data
              </td>
            </tr>
          )}
        </tbody>
        {footerRow && (
          <tfoot>
            <tr className="bg-[#c6efce] font-semibold text-[#276221]">
              {columns.map(col => (
                <td key={col.key} className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">
                  {footerRow[col.key] ?? ""}
                </td>
              ))}
              {onDeleteRow && <td className="border border-gray-300" />}
            </tr>
          </tfoot>
        )}
      </table>
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-1 text-xs text-gray-500">
        {sorted.length} row{sorted.length !== 1 ? "s" : ""}
        {sorted.length !== data.length && ` (filtered from ${data.length})`}
      </div>
    </div>
  );
}