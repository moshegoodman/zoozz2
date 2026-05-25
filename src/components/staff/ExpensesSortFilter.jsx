import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp, Filter, Building, CreditCard } from "lucide-react";

export default function ExpensesSortFilter({
  sort, setSort,
  statusFilter, setStatusFilter,
  billToFilter, setBillToFilter,
  paidByFilter, setPaidByFilter,
  billToOptions = [],
  paidByOptions = [],
  language
}) {
  const isHebrew = language === "Hebrew";
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-1.5">
        <ArrowDownUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">{isHebrew ? "תאריך (חדש ביותר)" : "Date (newest)"}</SelectItem>
            <SelectItem value="date_asc">{isHebrew ? "תאריך (ישן ביותר)" : "Date (oldest)"}</SelectItem>
            <SelectItem value="billto_asc">{isHebrew ? "חיוב ל (א-ת)" : "Bill-to (A–Z)"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isHebrew ? "כל הסטטוסים" : "All statuses"}</SelectItem>
            <SelectItem value="approved">{isHebrew ? "מאושר" : "Approved"}</SelectItem>
            <SelectItem value="pending">{isHebrew ? "ממתין" : "Pending"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Building className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <Select value={billToFilter} onValueChange={setBillToFilter}>
          <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isHebrew ? "כל החיובים" : "All bill-to"}</SelectItem>
            {billToOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
       <CreditCard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
       <Select value={paidByFilter} onValueChange={setPaidByFilter}>
         <SelectTrigger className="h-8 text-xs bg-gray-50 border-gray-200">
           <SelectValue />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="all">{isHebrew ? "כל התשלומים" : "All paid by"}</SelectItem>
           {paidByOptions.map((opt) => (
             <SelectItem key={opt} value={opt}>{opt}</SelectItem>
           ))}
         </SelectContent>
       </Select>
      </div>
      </div>
  );
}