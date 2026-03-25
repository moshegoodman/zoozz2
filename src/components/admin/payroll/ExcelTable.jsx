import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Filter, X, Check } from "lucide-react";

/**
 * Generic Excel-like table component with Google Sheets-style column filters.
 * Props:
 *   columns: [{ key, label, render?, width?, numeric?, rawValue? }]
 *   data: array of row objects
 *   getRowKey: fn(row) => string
 *   footerRow?: object with same keys as columns (rendered as totals row)
 *   onDeleteRow?: fn(row)
 */

function ColumnFilterDropdown({ col, data, activeFilter, onApply, onClose }) {
  const ref = useRef(null);

  // Derive unique values for this column
  const uniqueValues = useMemo(() => {
    const vals = new Set();
    data.forEach(row => {
      const v = col.rawValue ? col.rawValue(row) : row[col.key];
      vals.add(v == null ? "" : String(v));
    });
    return ["", ...Array.from(vals).filter(v => v !== "").sort((a, b) => {
      if (col.numeric) return parseFloat(a) - parseFloat(b);
      return a.localeCompare(b);
    })];
  }, [data, col]);

  const [searchText, setSearchText] = useState("");
  // selected = set of string values to SHOW (whitelist mode)
  const [selected, setSelected] = useState(() => {
    if (activeFilter?.type === "values") return new Set(activeFilter.values);
    return new Set(uniqueValues); // all selected by default
  });

  const [sortOverride, setSortOverride] = useState(activeFilter?.sort || null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!searchText) return uniqueValues;
    return uniqueValues.filter(v => v.toLowerCase().includes(searchText.toLowerCase()));
  }, [uniqueValues, searchText]);

  const allFilteredSelected = filtered.every(v => selected.has(v));

  const toggleValue = (v) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(v => next.delete(v)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(v => next.add(v)); return next; });
    }
  };

  const handleOK = () => {
    // If all values are selected and no sort, clear filter
    const allSelected = uniqueValues.every(v => selected.has(v));
    onApply({
      type: "values",
      values: Array.from(selected),
      allSelected,
      sort: sortOverride,
    });
    onClose();
  };

  const handleClear = () => {
    onApply(null);
    onClose();
  };

  const isBlankLabel = (v) => v === "" ? "(Blanks)" : v;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-lg shadow-xl w-56 text-xs"
      style={{ minWidth: 200 }}
    >
      {/* Filter by values */}
      <div className="px-2 py-1.5 border-b border-gray-100">
        <p className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold mb-1">Filter by values</p>
        <div className="relative mb-1.5">
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 pr-6"
            autoFocus
          />
          {searchText && (
            <button onClick={() => setSearchText("")} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Select all / Clear */}
        <div className="flex gap-2 text-[10px] mb-1">
          <button onClick={toggleAll} className="text-blue-600 hover:underline">
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={handleClear} className="text-blue-600 hover:underline">Clear</button>
        </div>

        {/* Value checkboxes */}
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filtered.map(v => (
            <label key={v} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
              <div
                onClick={() => toggleValue(v)}
                className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selected.has(v) ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}
              >
                {selected.has(v) && <Check className="w-2 h-2 text-white" />}
              </div>
              <span className="truncate text-gray-700">{isBlankLabel(v)}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="text-gray-400 text-center py-2">No matches</p>}
        </div>
      </div>

      {/* OK / Cancel */}
      <div className="flex gap-2 px-2 py-1.5 justify-end">
        <button onClick={onClose} className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleOK} className="px-3 py-1 rounded bg-[#217346] text-white hover:bg-[#1a5c38]">OK</button>
      </div>
    </div>
  );
}

export default function ExcelTable({ columns, data, getRowKey, footerRow, onDeleteRow }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  // colFilters[key] = { type: "values", values: [...], allSelected: bool, sort: "asc"|"desc"|null } | null
  const [colFilters, setColFilters] = useState({});
  const [openFilterCol, setOpenFilterCol] = useState(null);

  const setFilter = (key, filterObj) => {
    setColFilters(f => ({ ...f, [key]: filterObj }));
    // Apply sort from filter if set
    if (filterObj?.sort) {
      setSortKey(key);
      setSortDir(filterObj.sort);
    } else if (colFilters[key]?.sort && !filterObj?.sort) {
      // Sort was cleared
      if (sortKey === key) { setSortKey(null); }
    }
  };

  const filtered = useMemo(() => {
    return data.filter(row => {
      return columns.every(col => {
        const f = colFilters[col.key];
        if (!f || f.allSelected) return true;
        const cellVal = col.rawValue ? col.rawValue(row) : row[col.key];
        const strVal = cellVal == null ? "" : String(cellVal);
        return f.values.includes(strVal);
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

  const isFiltered = (key) => {
    const f = colFilters[key];
    return f && !f.allSelected;
  };

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-md">
      <table className="w-full text-xs border-collapse" style={{ minWidth: 600 }}>
        <thead>
          <tr className="bg-[#217346] text-white">
            {columns.map(col => (
              <th
                key={col.key}
                className="border border-[#1a5c38] px-2 py-1.5 text-left font-semibold whitespace-nowrap select-none"
                style={{ width: col.width }}
              >
                <div className="flex items-center gap-1">
                  {/* Sort on label click */}
                  <span
                    className="cursor-pointer flex-1 flex items-center"
                    onClick={() => {
                      if (sortKey === col.key) setSortDir(d => d === "asc" ? "desc" : "asc");
                      else { setSortKey(col.key); setSortDir("asc"); }
                    }}
                  >
                    {col.label}
                    {sortKey === col.key
                      ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline" /> : <ChevronDown className="w-3 h-3 ml-1 inline" />)
                      : <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1 inline" />}
                  </span>
                  {/* Filter button */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenFilterCol(openFilterCol === col.key ? null : col.key); }}
                      className={`rounded p-0.5 transition-colors ${isFiltered(col.key) ? "bg-yellow-300 text-gray-800" : "hover:bg-[#1a5c38] text-white/70 hover:text-white"}`}
                      title="Filter"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                    {openFilterCol === col.key && (
                      <ColumnFilterDropdown
                        col={col}
                        data={data}
                        activeFilter={colFilters[col.key]}
                        onApply={(f) => setFilter(col.key, f)}
                        onClose={() => setOpenFilterCol(null)}
                      />
                    )}
                  </div>
                </div>
              </th>
            ))}
            {onDeleteRow && <th className="border border-[#1a5c38] px-2 py-1.5 w-8" />}
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
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-1 text-xs text-gray-500 flex items-center gap-2">
        <span>{sorted.length} row{sorted.length !== 1 ? "s" : ""}{sorted.length !== data.length && ` (filtered from ${data.length})`}</span>
        {Object.values(colFilters).some(f => f && !f.allSelected) && (
          <button
            onClick={() => setColFilters({})}
            className="text-blue-600 hover:underline flex items-center gap-0.5"
          >
            <X className="w-3 h-3" />Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}