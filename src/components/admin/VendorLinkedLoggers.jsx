import React, { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, UserPlus, Search } from "lucide-react";

/**
 * VendorLinkedLoggers
 * Lets admin pick users authorized to log shifts/expenses on behalf of a vendor.
 *
 * Props:
 * - users: full user list
 * - value: array of user IDs (linked_logger_user_ids)
 * - onChange: (newIds: string[]) => void
 */
export default function VendorLinkedLoggers({ users = [], value = [], onChange }) {
  const [query, setQuery] = useState("");

  const linkedUsers = useMemo(
    () => value.map(id => users.find(u => u.id === id)).filter(Boolean),
    [users, value]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return users
      .filter(u => !value.includes(u.id))
      .filter(u =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [users, value, query]);

  const addUser = (userId) => {
    if (value.includes(userId)) return;
    onChange([...value, userId]);
    setQuery("");
  };

  const removeUser = (userId) => {
    onChange(value.filter(id => id !== userId));
  };

  return (
    <div>
      <Label className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-blue-600" />
        Linked Loggers ({linkedUsers.length})
      </Label>
      <p className="text-xs text-gray-500 mb-2">
        Users authorized to log shifts and expenses on behalf of this vendor.
        They'll see this vendor in their Bill To options in the Staff Portal.
      </p>

      <div className="relative mb-2">
        <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-8"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => addUser(u.id)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
              >
                <div className="text-sm font-medium">{u.full_name || "(no name)"}</div>
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="truncate">{u.email}</span>
                  {u.user_type && (
                    <Badge variant="outline" className="text-[10px] capitalize">{u.user_type}</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {linkedUsers.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No linked loggers yet.</p>
        ) : (
          linkedUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-100 gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{u.full_name || "(no name)"}</span>
                  {u.user_type && (
                    <Badge variant="outline" className="text-xs capitalize">{u.user_type}</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 truncate">{u.email}</p>
              </div>
              <button
                type="button"
                onClick={() => removeUser(u.id)}
                className="rounded-full hover:bg-blue-100 p-1 transition-colors"
                aria-label="Remove logger"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}