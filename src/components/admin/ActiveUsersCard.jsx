import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Users, RefreshCw, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listUsers } from "@/functions/listUsers";

// Default window (used when no custom range is set): last N minutes.
const DEFAULT_WINDOW_MINUTES = 15;

const formatRelative = (iso) => {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(iso).toLocaleString();
};

// Format a Date as a "YYYY-MM-DDTHH:MM" string in the browser's local timezone
// (which is what <input type="datetime-local"> expects).
const toLocalInputValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ActiveUsersCard() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Custom range (both optional). When both empty, we fall back to the
  // rolling "last DEFAULT_WINDOW_MINUTES minutes" view.
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const { fromMs, toMs, hasCustomRange } = useMemo(() => {
    const fromDate = fromInput ? new Date(fromInput) : null;
    const toDate = toInput ? new Date(toInput) : null;
    const hasCustom = !!(fromDate || toDate);
    return {
      fromMs: fromDate && !isNaN(fromDate.getTime())
        ? fromDate.getTime()
        : hasCustom
          ? -Infinity
          : Date.now() - DEFAULT_WINDOW_MINUTES * 60 * 1000,
      toMs: toDate && !isNaN(toDate.getTime()) ? toDate.getTime() : Date.now(),
      hasCustomRange: hasCustom,
    };
  }, [fromInput, toInput]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listUsers({});
      const all = res?.data?.users || [];
      const filtered = all
        .filter((u) => {
          if (!u.last_active_at) return false;
          const t = new Date(u.last_active_at).getTime();
          if (isNaN(t)) return false;
          return t >= fromMs && t <= toMs;
        })
        .sort((a, b) => new Date(b.last_active_at) - new Date(a.last_active_at));
      setUsers(filtered);
    } catch (e) {
      console.error("Failed to load active users:", e);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [fromMs, toMs]);

  useEffect(() => {
    load();
    // Only auto-refresh when using the rolling default window; a custom range
    // is a snapshot and shouldn't quietly change under the admin's feet.
    if (hasCustomRange) return;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load, hasCustomRange]);

  const applyQuickRange = (minutes) => {
    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60 * 1000);
    setFromInput(toLocalInputValue(from));
    setToInput(toLocalInputValue(now));
  };

  const clearRange = () => {
    setFromInput("");
    setToInput("");
  };

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="active-from" className="text-xs">From</Label>
            <Input
              id="active-from"
              type="datetime-local"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="w-56"
            />
          </div>
          <div>
            <Label htmlFor="active-to" className="text-xs">To</Label>
            <Input
              id="active-to"
              type="datetime-local"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="w-56"
            />
          </div>
          {hasCustomRange && (
            <Button variant="outline" size="sm" onClick={clearRange}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Quick:</span>
          <Button variant="outline" size="sm" onClick={() => applyQuickRange(15)}>Last 15m</Button>
          <Button variant="outline" size="sm" onClick={() => applyQuickRange(60)}>Last 1h</Button>
          <Button variant="outline" size="sm" onClick={() => applyQuickRange(24 * 60)}>Last 24h</Button>
          <Button variant="outline" size="sm" onClick={() => applyQuickRange(7 * 24 * 60)}>Last 7d</Button>
        </div>

        <div className="text-sm text-gray-600">
          {hasCustomRange ? (
            <>
              Showing users active between{" "}
              <strong>{fromInput ? new Date(fromInput).toLocaleString() : "the beginning of time"}</strong>{" "}
              and{" "}
              <strong>{toInput ? new Date(toInput).toLocaleString() : "now"}</strong>.
            </>
          ) : (
            <>
              Users active in the last <strong>{DEFAULT_WINDOW_MINUTES} minutes</strong> (auto-refreshes).
            </>
          )}
        </div>
      </div>

      {isLoading && users.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
          <Users className="w-8 h-8 text-gray-300" />
          No users were active in the selected range.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.full_name || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{u.email || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">
                      {u.user_type || "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {hasCustomRange
                      ? new Date(u.last_active_at).toLocaleString()
                      : formatRelative(u.last_active_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
            {users.length} user{users.length === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}