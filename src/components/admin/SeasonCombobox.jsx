import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SeasonCombobox({ value, onChange, households, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Extract unique seasons from households
  const seasons = useMemo(() => {
    const uniqueSeasons = new Set(
      households
        .map(h => h.season)
        .filter(Boolean)
        .map(s => s.toUpperCase())
    );
    return Array.from(uniqueSeasons).sort();
  }, [households]);

  const displayValue = value ? value.toUpperCase() : "Select season...";
  const normalizedSearch = search.trim().toUpperCase();
  const showCreateOption = normalizedSearch && !seasons.includes(normalizedSearch);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search or type new season..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {normalizedSearch ? (
                <button
                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    onChange(normalizedSearch);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  Create "<span className="font-semibold">{normalizedSearch}</span>"
                </button>
              ) : (
                "No seasons found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {showCreateOption && (
                <CommandItem
                  value={`__create__${normalizedSearch}`}
                  onSelect={() => {
                    onChange(normalizedSearch);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <span className="text-blue-600">+ Create "{normalizedSearch}"</span>
                </CommandItem>
              )}
              {seasons.map(season => (
                <CommandItem
                  key={season}
                  value={season}
                  onSelect={(currentValue) => {
                    onChange(currentValue.toUpperCase() === (value || "").toUpperCase() ? "" : currentValue.toUpperCase());
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      (value || "").toUpperCase() === season ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {season}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}