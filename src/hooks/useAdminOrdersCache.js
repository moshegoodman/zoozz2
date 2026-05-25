import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  getCachedOrders,
  putOrders,
  replaceAllOrders,
  getLastSync,
  setLastSync,
  shouldDoFullSync,
  setLastFullSync
} from '@/lib/orderCache';

/**
 * Admin Orders cache hook.
 *
 * On mount:
 *   1. Instantly displays orders from IndexedDB cache (fast load).
 *   2. In the background, syncs with the server:
 *        - If no cache or last full sync > 5 min ago → full pull (reconciles deletions).
 *        - Otherwise → incremental pull of orders with `updated_date > lastSync`.
 *   3. Updates the cache and returned state.
 *
 * Returns:
 *   - orders:     array of Order records (cache-first, then synced)
 *   - isLoading:  true only on the very first read from cache
 *   - isSyncing:  true while a background server sync is in progress
 *   - refresh():  force a full re-sync (also reconciles deletions)
 */
export default function useAdminOrdersCache() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const mountedRef = useRef(true);

  const sync = useCallback(async (forceFull = false) => {
    setIsSyncing(true);
    try {
      const lastSync = getLastSync();
      const doFull = forceFull || !lastSync || shouldDoFullSync();

      if (doFull) {
        // Full pull — reconciles deletions by replacing the entire cache.
        const fresh = await base44.entities.Order.list('-updated_date', 5000);
        await replaceAllOrders(fresh);
        setLastFullSync(Date.now());
        const newest = fresh[0]?.updated_date;
        if (newest) setLastSync(newest);
        if (mountedRef.current) setOrders(fresh);
      } else {
        // Incremental — only orders updated since the last sync.
        const updated = await base44.entities.Order.filter(
          { updated_date: { $gt: lastSync } },
          '-updated_date',
          5000
        );
        if (updated.length > 0) {
          await putOrders(updated);
          const newest = updated[0]?.updated_date;
          if (newest) setLastSync(newest);
          const all = await getCachedOrders();
          if (mountedRef.current) setOrders(all);
        }
      }
    } catch (e) {
      console.warn('Order cache sync failed:', e);
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      // 1. Show cached data immediately.
      const cached = await getCachedOrders();
      if (mountedRef.current) {
        setOrders(cached);
        setIsLoading(false);
      }
      // 2. Sync with server in the background.
      await sync(false);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [sync]);

  const refresh = useCallback(() => sync(true), [sync]);

  return { orders, isLoading, isSyncing, refresh };
}