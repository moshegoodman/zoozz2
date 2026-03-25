import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MobileBottomSheet – enhanced reusable bottom sheet for mobile-native UX
 * 
 * Props:
 *   isOpen      – boolean to control visibility
 *   onClose     – callback when closing
 *   title       – sheet header title
 *   children    – content to render inside
 *   className   – extra classes for the content container
 *   snapPoints  – array of snap heights, e.g. ['25vh', '50vh', '90vh']
 */
export default function MobileBottomSheet({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className,
  snapPoints = ['70vh']
}) {
  const [currentSnap, setCurrentSnap] = useState(0);
  const [dragStart, setDragStart] = useState(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleTouchStart = (e) => {
    setDragStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    if (dragStart === null) return;
    const delta = e.changedTouches[0].clientY - dragStart;
    if (delta > 80) onClose(); // Swipe down to close
    setDragStart(null);
  };

  if (!isOpen) return null;

  const sheetHeight = snapPoints[currentSnap];

  return (
    <div className="fixed inset-0 z-[200] flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className={cn(
          'relative w-full bg-background rounded-t-3xl shadow-2xl',
          'animate-in slide-in-from-bottom',
          'flex flex-col',
          className
        )}
        style={{
          height: sheetHeight,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
            <h2 className="font-semibold text-base text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}