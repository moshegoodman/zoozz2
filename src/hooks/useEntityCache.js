import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCachedRecords,
  putRecords,
  replaceAllRecords,
  getLastSync,
  setLastSync,
  shouldDoFullSync,
  setLastFullSync,
} from '@/lib/entityCache';

/**
 * Generic entity cache hook.
 *
 * Cache-first display + background sync:
 *   1. On mount, instantly displays records from the IndexedDB cache.
 *   2. In the background:
 *        - If no cache OR last full sync > intervalMs ago → full pull (reconciles deletions).
 *        - Otherwise → incremental pull of records with `updated_date > lastSync`.
 *   3. Updates the cache and returned state.
 *
 * @param {string} entityName - IndexedDB store name (must match an entry in entityCache STORES).
 * @param {object} entityRef  - Base44 SDK entity reference (e.g. base44.entities.Order).
 * @param {object} [options]
 * @param {number} [options.limit=5000]            - Max records per fetch.
 * @param {string} [options.sortField='-updated_date'] - Sort param passed to .list / .filter.
 * @param {number} [options.intervalMs]            - Override full-sync interval (default: 5 minutes).
 *
 * @returns {{ records: any[], isLoading: boolean, isSyncing: boolean, refresh: () => Promise<void> }}
 */
export default function useEntityCache(entityName, entityRef, options = {}) {
  const { limit = 5000, sortField = '-updated_date', intervalMs } = options;

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const mountedRef = useRef(true);

  const sync = useCallback(async (forceFull = false) => {
    if (!entityRef) return;
    setIsSyncing(true);
    try {
      const lastSync = getLastSync(entityName);
      const doFull = forceFull || !lastSync || shouldDoFullSync(entityName, intervalMs);

      if (doFull) {
        // Full pull — reconciles deletions by replacing the entire cache.
        const fresh = await entityRef.list(sortField, limit);
        await replaceAllRecords(entityName, fresh);
        setLastFullSync(entityName, Date.now());
        const newest = fresh[0]?.updated_date;
        if (newest) setLastSync(entityName, newest);
        if (mountedRef.current) setRecords(fresh);
      } else {
        // Incremental — only records updated since the last sync.
        const updated = await entityRef.filter(
          { updated_date: { $gt: lastSync } },
          sortField,
          limit,
        );
        if (updated.length > 0) {
          await putRecords(entityName, updated);
          const newest = updated[0]?.updated_date;
          if (newest) setLastSync(entityName, newest);
          const all = await getCachedRecords(entityName);
          if (mountedRef.current) setRecords(all);
        }
      }
    } catch (e) {
      console.warn(`Entity cache sync failed for ${entityName}:`, e);
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [entityName, entityRef, sortField, limit, intervalMs]);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      // 1. Show cached data immediately.
      const cached = await getCachedRecords(entityName);
      if (mountedRef.current) {
        setRecords(cached);
        setIsLoading(false);
      }
      // 2. Sync with the server in the background.
      await sync(false);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [sync, entityName]);

  const refresh = useCallback(() => sync(true), [sync]);

  return { records, isLoading, isSyncing, refresh };
}