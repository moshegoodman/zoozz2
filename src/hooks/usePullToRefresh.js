import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * usePullToRefresh – hook for implementing pull-to-refresh on mobile.
 * Uses native touch listeners (passive: false) so preventDefault works.
 *
 * Usage:
 *   const { isPulling, pullDistance, isRefreshing, containerRef } = usePullToRefresh(async () => {
 *     await fetchData();
 *   });
 *
 *   return (
 *     <div ref={containerRef}>
 *       <PullToRefreshIndicator ... />
 *       {children}
 *     </div>
 *   );
 *
 * For backward compat, bindPullToRefresh() still works but only passes ref.
 */
export default function usePullToRefresh(onRefresh) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const containerRef = useRef(null);
  const touchStartY = useRef(null);
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const currentPull = useRef(0);

  useEffect(() => {
    const el = containerRef.current || window;

    const onTouchStart = (e) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current || touchStartY.current === null || refreshing.current) return;

      const delta = e.touches[0].clientY - touchStartY.current;

      if (delta > 0 && window.scrollY === 0) {
        e.preventDefault(); // works because passive: false
        const capped = Math.min(delta, 120);
        currentPull.current = capped;
        setPullDistance(capped);
        setIsPulling(true);
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      touchStartY.current = null;

      const dist = currentPull.current;
      currentPull.current = 0;

      if (dist < 60) {
        setPullDistance(0);
        setIsPulling(false);
        return;
      }

      setIsPulling(false);
      setPullDistance(0);
      setIsRefreshing(true);
      refreshing.current = true;

      try {
        await onRefresh();
      } catch (err) {
        console.error('Pull-to-refresh failed:', err);
      } finally {
        setIsRefreshing(false);
        refreshing.current = false;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh]);

  // Backward-compat shim so existing code using bindPullToRefresh() doesn't break
  const bindPullToRefresh = useCallback(() => ({ ref: containerRef }), []);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    containerRef,
    bindPullToRefresh,
  };
}