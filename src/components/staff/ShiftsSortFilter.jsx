import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp, Filter } from "lucide-react";

export default function ShiftsSortFilter({ sort, setSort, filter, setFilter, language }) {
  const isHebrew = language === "Hebrew";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-1.5">
        <ArrowDownUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">{isHebrew ? "תאריך (חדש ביותר)" : "Date (newest)"}</SelectItem>
            <SelectItem value="date_asc">{isHebrew ? "תאריך (ישן ביותר)" : "Date (oldest)"}</SelectItem>
            <SelectItem value="household_asc">{isHebrew ? "לקוח (א-ת)" : "Household (A–Z)"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 flex items-center gap-1.5">
        <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isHebrew ? "הכל" : "All"}</SelectItem>
            <SelectItem value="approved">{isHebrew ? "מאושר" : "Approved"}</SelectItem>
            <SelectItem value="pending">{isHebrew ? "ממתין" : "Pending"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}