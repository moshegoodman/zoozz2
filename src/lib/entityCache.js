// Generic IndexedDB cache for Base44 entities.
//
// Strategy (per entity):
//  - Incremental sync using `updated_date > lastSync` for fast updates.
//  - Periodic full sync to reconcile deletions (every FULL_SYNC_INTERVAL_MS).
//  - All operations are best-effort: if IndexedDB fails, we silently fall back
//    to no-cache behavior so the app never breaks.
//
// Adding a new cached entity:
//   1. Add its store name to STORES below.
//   2. Bump DB_VERSION by 1.
//   3. Call useEntityCache('<storeName>', <EntityRef>) from a component.

const DB_NAME = 'zoozz_cache';
// Bump this whenever STORES changes so IndexedDB upgrades and creates new stores.
const DB_VERSION = 2;

// All entity stores we cache. Order of entries doesn't matter.
export const STORES = [
  'orders',
  'vendors',
  'households',
  'householdStaffs',
  'chats',
];

const lastSyncKey = (entity) => `entityCache:${entity}:lastSync`;
const lastFullSyncKey = (entity) => `entityCache:${entity}:lastFullSync`;

// Default interval for periodic full reconcile (deletion detection).
export const FULL_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function getCachedRecords(entity) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(entity, 'readonly');
      const req = tx.objectStore(entity).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return [];
  }
}

export async function putRecords(entity, records) {
  if (!records?.length) return;
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(entity, 'readwrite');
      const store = tx.objectStore(entity);
      for (const r of records) {
        if (r?.id) store.put(r);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // best-effort
  }
}

export async function replaceAllRecords(entity, records) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(entity, 'readwrite');
      const store = tx.objectStore(entity);
      store.clear();
      for (const r of records || []) {
        if (r?.id) store.put(r);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // best-effort
  }
}

export async function clearAllEntityCaches() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, 'readwrite');
      for (const s of STORES) tx.objectStore(s).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* ignore */ }
  try {
    for (const entity of STORES) {
      localStorage.removeItem(lastSyncKey(entity));
      localStorage.removeItem(lastFullSyncKey(entity));
    }
    // Also clear ad-hoc caches that don't live in IndexedDB.
    localStorage.removeItem('entityCache:users:list');
    localStorage.removeItem('entityCache:users:lastFullSync');
  } catch (e) { /* ignore */ }
}

export function getLastSync(entity) {
  try { return localStorage.getItem(lastSyncKey(entity)) || null; } catch { return null; }
}

export function setLastSync(entity, iso) {
  try { if (iso) localStorage.setItem(lastSyncKey(entity), iso); } catch { /* ignore */ }
}

export function getLastFullSync(entity) {
  try {
    const v = localStorage.getItem(lastFullSyncKey(entity));
    return v ? parseInt(v, 10) : 0;
  } catch { return 0; }
}

export function setLastFullSync(entity, ts) {
  try { localStorage.setItem(lastFullSyncKey(entity), String(ts)); } catch { /* ignore */ }
}

export function shouldDoFullSync(entity, intervalMs = FULL_SYNC_INTERVAL_MS) {
  return (Date.now() - getLastFullSync(entity)) > intervalMs;
}