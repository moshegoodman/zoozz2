import React, { useRef, useState } from "react";

/**
 * A bottom sheet with a drag handle that supports swipe-down to close.
 * Used inside PickingFilters mobile drawer.
 */
export default function SwipeableBottomSheet({ onClose, children, className = "" }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);
  const scrollAtStart = useRef(0);
  const sheetRef = useRef(null);

  const getScrollContainer = () => sheetRef.current;

  const handleTouchStart = (e) => {
    const container = getScrollContainer();
    scrollAtStart.current = container ? container.scrollTop : 0;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (startY.current === null) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;
    // Only allow dragging down, and only when the inner content is scrolled to the top
    if (delta > 0 && scrollAtStart.current <= 0) {
      setDragY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 120) {
      onClose();
    }
    setDragY(0);
    startY.current = null;
  };

  return (
    <div
      ref={sheetRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={className}
      style={{
        transform: `translateY(${dragY}px)`,
        transition: dragY === 0 ? "transform 0.25s ease-out" : "none",
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10 rounded-t-2xl">
        <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
      </div>
      {children}
    </div>
  );
}