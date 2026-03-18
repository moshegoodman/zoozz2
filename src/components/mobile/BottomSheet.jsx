import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BottomSheetSelect – drop-in replacement for native <select> / shadcn Select.
 * On all screen sizes it slides up a native-feeling bottom sheet.
 *
 * Props:
 *   value       – currently selected value
 *   onChange    – (value: string) => void
 *   options     – Array<{ value: string; label: string }>
 *   placeholder – string shown when nothing is selected
 *   className   – extra classes for the trigger button
 *   disabled    – boolean
 */
export function BottomSheetSelect({ value, onChange, options = [], placeholder = 'Select…', className, disabled }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          'flex items-center justify-between w-full min-h-[44px] px-3 py-2',
          'border border-input rounded-md bg-background text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in"
            onClick={() => setOpen(false)}
          />

          {/* Sheet panel */}
          <div
            className="relative w-full bg-background rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom flex flex-col"
            style={{
              maxHeight: '70vh',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
              <span className="font-semibold text-base text-foreground">{placeholder}</span>
              <button
                onClick={() => setOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options */}
            <div className="overflow-y-auto flex-1">
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn(
                    'w-full min-h-[44px] flex items-center justify-between px-4 py-3',
                    'hover:bg-muted transition-colors text-left',
                    value === opt.value && 'bg-muted/60'
                  )}
                >
                  <span className="text-sm text-foreground">{opt.label}</span>
                  {value === opt.value && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}