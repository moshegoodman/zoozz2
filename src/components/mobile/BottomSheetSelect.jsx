import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import MobileBottomSheet from './MobileBottomSheet';

/**
 * BottomSheetSelect – mobile-first select field using BottomSheet
 * 
 * Props:
 *   value       – currently selected value
 *   onChange    – (value: string) => void
 *   options     – Array<{ value: string; label: string }>
 *   placeholder – string shown when nothing is selected
 *   label       – optional label above the trigger
 *   disabled    – boolean
 *   required    – boolean
 *   className   – extra classes for trigger
 */
export default function BottomSheetSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  label,
  disabled,
  required,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        className={cn(
          'flex items-center justify-between w-full min-h-[44px] px-3 py-2.5',
          'border border-input rounded-lg bg-background text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          className
        )}
      >
        <span className={selected ? 'text-foreground font-medium' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Bottom sheet */}
      <MobileBottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={placeholder}
      >
        <div className="space-y-1">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={cn(
                'w-full min-h-[44px] flex items-center justify-between px-4 py-3',
                'rounded-lg text-left text-sm transition-colors',
                'hover:bg-muted',
                value === opt.value && 'bg-muted/80 font-semibold'
              )}
            >
              <span className="text-foreground">{opt.label}</span>
              {value === opt.value && (
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </MobileBottomSheet>
    </>
  );
}