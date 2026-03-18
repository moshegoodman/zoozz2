import React from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';

/**
 * PullToRefreshIndicator – visual feedback for pull-to-refresh.
 * Place at the very top of a page, above all content.
 */
export default function PullToRefreshIndicator({ isPulling, pullDistance, isRefreshing }) {
  if (!isPulling && !isRefreshing && pullDistance === 0) return null;

  const opacity  = Math.min(1, pullDistance / 72);
  const rotation = Math.min(180, (pullDistance / 72) * 180);
  const size     = Math.min(48, 16 + pullDistance * 0.35);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-end justify-center pointer-events-none"
      style={{
        height: isRefreshing ? '52px' : `${Math.max(0, pullDistance)}px`,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        transition: isRefreshing ? 'height 0.2s ease' : 'none',
      }}
    >
      <div
        className="mb-2 w-8 h-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center"
        style={{ opacity }}
      >
        {isRefreshing ? (
          <RefreshCw className="w-4 h-4 text-green-600 animate-spin" />
        ) : (
          <ArrowDown
            className="w-4 h-4 text-green-600 transition-transform"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        )}
      </div>
    </div>
  );
}