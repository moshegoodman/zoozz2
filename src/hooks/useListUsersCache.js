import { useState, useEffect, useCallback, useRef } from 'react';
import { listUsers } from '@/functions/listUsers';

// Users come from a backend function (uses asServiceRole), so we can't do incremental
// updated_date-based sync. Instead: cache the full list in localStorage and refresh
// periodically. The cache also clears on logout (via clearAllEntityCaches).

const CACHE_KEY = 'entityCache:users:list';
const LAST_SYNC_KEY = 'entityCache:users:lastFullSync';
const FULL_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCached(users) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(users || [])); } catch { /* ignore */ }
}

function shouldRefresh() {
  try {
    const v = localStorage.getItem(LAST_SYNC_KEY);
    return !v || (Date.now() - parseInt(v, 10)) > FULL_SYNC_INTERVAL_MS;
  } catch { return true; }
}

/**
 * Cached version of the listUsers backend function.
 *
 * Cache-first display + periodic background refresh.
 *
 * @returns {{ users: any[], isLoading: boolean, isSyncing: boolean, refresh: () => Promise<void> }}
 */
export default function useListUsersCache() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const mountedRef = useRef(true);

  const sync = useCallback(async (force = false) => {
    if (!force && !shouldRefresh()) return;
    setIsSyncing(true);
    try {
      const res = await listUsers({});
      const fresh = res?.data?.users || [];
      saveCached(fresh);
      try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch { /* ignore */ }
      if (mountedRef.current) setUsers(fresh);
    } catch (e) {
      console.warn('User list cache sync failed:', e);
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // 1. Instant display from cache.
    const cached = loadCached();
    setUsers(cached);
    setIsLoading(false);
    // 2. Background refresh if stale.
    sync(false);
    return () => {
      mountedRef.current = false;
    };
  }, [sync]);

  const refresh = useCallback(() => sync(true), [sync]);

  return { users, isLoading, isSyncing, refresh };
}