import React, { useMemo } from "react";
import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Reusable season filter dropdown.
 * Derives available seasons from the provided households list (case-insensitive de-dupe).
 *
 * Props:
 *  - households: array of Household entities
 *  - value: currently selected season ("" = All Seasons)
 *  - onChange: (season) => void
 *  - label: optional label override
 */
export default function SeasonFilter({ households = [], value, onChange, label = "Season" }) {
  const seasons = useMemo(() => {
    const map = new Map(); // upperCaseKey -> originalLabel
    households.forEach((h) => {
      const s = (h?.season || "").trim();
      if (!s) return;
      const key = s.toUpperCase();
      if (!map.has(key)) map.set(key, s);
    });
    return Array.from(map.values()).sort();
  }, [households]);

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">{label}:</label>
      <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="w-44 h-9">
          <SelectValue placeholder="All seasons" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All seasons</SelectItem>
          {seasons.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}