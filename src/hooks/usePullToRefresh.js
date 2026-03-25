import { useState, useCallback, useRef } from 'react';

/**
 * usePullToRefresh – hook for implementing pull-to-refresh on mobile
 * 
 * Returns: { isPulling, pullDistance, isRefreshing, bindPullToRefresh }
 * 
 * Usage:
 *   const { isPulling, pullDistance, isRefreshing, bindPullToRefresh } = usePullToRefresh(async () => {
 *     await fetchData();
 *   });
 *   
 *   return (
 *     <div {...bindPullToRefresh()}>
 *       <PullToRefreshIndicator isPulling={isPulling} pullDistance={pullDistance} isRefreshing={isRefreshing} />
 *       {children}
 *     </div>
 *   );
 */
export default function usePullToRefresh(onRefresh) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    // Only pull if at the very top of the page
    if (window.scrollY === 0 && containerRef.current) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === null || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;

    if (delta > 0 && window.scrollY === 0) {
      e.preventDefault();
      setPullDistance(Math.min(delta, 120)); // Cap at 120px
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance < 60) {
      // Not enough pull
      setPullDistance(0);
      setIsPulling(false);
      touchStartY.current = null;
      return;
    }

    // Trigger refresh
    touchStartY.current = null;
    setIsPulling(false);
    setIsRefreshing(true);
    setPullDistance(0);

    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [pullDistance, onRefresh]);

  const bindPullToRefresh = useCallback(() => ({
    ref: containerRef,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }), [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    bindPullToRefresh,
  };
}