import React, { useEffect, useState, useCallback } from "react";
import { Users, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listUsers } from "@/functions/listUsers";

// Show users whose last_active_at is within this window (minutes).
const ACTIVE_WINDOW_MINUTES = 15;

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

export default function ActiveUsersCard() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listUsers({});
      const all = res?.data?.users || [];
      const cutoff = Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000;
      const active = all
        .filter((u) => u.last_active_at && new Date(u.last_active_at).getTime() >= cutoff)
        .sort((a, b) => new Date(b.last_active_at) - new Date(a.last_active_at));
      setUsers(active);
    } catch (e) {
      console.error("Failed to load active users:", e);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          Users active in the last <strong>{ACTIVE_WINDOW_MINUTES} minutes</strong>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {isLoading && users.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
          <Users className="w-8 h-8 text-gray-300" />
          No users have been active in the last {ACTIVE_WINDOW_MINUTES} minutes.
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
                  <td className="px-3 py-2 text-gray-600">{formatRelative(u.last_active_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}