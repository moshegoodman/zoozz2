import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Inline combobox for use inside ExcelTable cells.
 * Props:
 *   value: currently selected value
 *   onChange: (newValue) => void
 *   options: array of { value, label, group? } OR groups: array of { label, options: [{ value, label }] }
 *   placeholder?: trigger placeholder
 *   searchPlaceholder?: search input placeholder
 *   triggerClassName?: extra classes for trigger
 *   highlight?: boolean — apply amber highlight (e.g. reimbursable)
 */
export default function InlineCombobox({
  value,
  onChange,
  options,
  groups,
  placeholder = "— select —",
  searchPlaceholder = "Search...",
  triggerClassName = "",
  highlight = false,
}) {
  const [open, setOpen] = useState(false);

  // Flatten for label lookup
  const allOptions = groups
    ? groups.flatMap(g => g.options)
    : (options || []);
  const selectedLabel = allOptions.find(o => o.value === value)?.label;

  const baseTrigger = "text-xs border rounded px-1.5 py-0.5 w-full text-left focus:outline-none focus:ring-1 focus:ring-ring flex items-center justify-between gap-1 truncate";
  const tone = highlight
    ? "bg-amber-50 border-amber-300 text-amber-800 font-semibold dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300"
    : "bg-white border-gray-200 text-gray-700 dark:bg-slate-900 dark:border-gray-700 dark:text-gray-200";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(baseTrigger, tone, triggerClassName)}>
          <span className="truncate">{selectedLabel || <span className="text-gray-400">{placeholder}</span>}</span>
          <ChevronsUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {groups
              ? groups.map((g, gi) => (
                  g.options.length > 0 && (
                    <React.Fragment key={g.label || gi}>
                      {gi > 0 && <CommandSeparator />}
                      <CommandGroup heading={g.label}>
                        {g.options.map(opt => (
                          <CommandItem
                            key={opt.value}
                            value={opt.label}
                            onSelect={() => { onChange(opt.value); setOpen(false); }}
                            className="text-xs"
                          >
                            <Check className={cn("mr-2 h-3 w-3", value === opt.value ? "opacity-100" : "opacity-0")} />
                            {opt.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </React.Fragment>
                  )
                ))
              : (
                <CommandGroup>
                  {(options || []).map(opt => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => { onChange(opt.value); setOpen(false); }}
                      className="text-xs"
                    >
                      <Check className={cn("mr-2 h-3 w-3", value === opt.value ? "opacity-100" : "opacity-0")} />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}