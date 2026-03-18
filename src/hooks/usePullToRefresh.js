import { useState, useEffect, useRef } from 'react';

/**
 * usePullToRefresh – attach to any scrollable page to get pull-to-refresh.
 *
 * @param {() => Promise<void>} onRefresh  Called when the user pulls past the threshold.
 * @param {{ threshold?: number }} options
 * @returns {{ isPulling: boolean, pullDistance: number, isRefreshing: boolean }}
 *
 * Usage:
 *   const { isPulling, pullDistance, isRefreshing } = usePullToRefresh(myRefreshFn);
 */
export function usePullToRefresh(onRefresh, { threshold = 72 } = {}) {
  const [state, setState] = useState({ isPulling: false, pullDistance: 0, isRefreshing: false });

  const startYRef     = useRef(null);
  const isPullingRef  = useRef(false);
  const onRefreshRef  = useRef(onRefresh);

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const getScrollTop = () =>
      document.documentElement.scrollTop || document.body.scrollTop || 0;

    const onTouchStart = (e) => {
      if (getScrollTop() === 0) {
        startYRef.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) return;
      const dist    = Math.min(dy, threshold * 1.8);
      const pulling = dy > threshold;
      isPullingRef.current = pulling;
      setState(s => ({ ...s, isPulling: pulling, pullDistance: dist }));
    };

    const onTouchEnd = async () => {
      if (!isPullingRef.current) {
        startYRef.current    = null;
        isPullingRef.current = false;
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
        return;
      }
      startYRef.current    = null;
      isPullingRef.current = false;
      setState({ isPulling: false, pullDistance: 0, isRefreshing: true });
      try {
        await onRefreshRef.current?.();
      } finally {
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove',  onTouchMove,  { passive: true });
    window.addEventListener('touchend',   onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('touchend',   onTouchEnd);
    };
  }, [threshold]);

  return state;
}