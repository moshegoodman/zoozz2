// IndexedDB cache for Order entities.
// Strategy (Option A):
//  - Incremental sync using `updated_date > lastSync` for fast updates.
//  - Periodic full sync to reconcile deletions (every FULL_SYNC_INTERVAL_MS).
//  - All reads are best-effort: if IndexedDB fails for any reason, we silently
//    fall back to no-cache behavior so the app never breaks.

const DB_NAME = 'zoozz_cache';
const STORE = 'orders';
const VERSION = 1;

const LAST_SYNC_KEY = 'orderCache:lastSync';           // ISO timestamp of newest updated_date seen
const LAST_FULL_SYNC_KEY = 'orderCache:lastFullSync';  // epoch ms of last full reconcile
const FULL_SYNC_INTERVAL_MS = 5 * 60 * 1000;            // 5 minutes — full sweep for deletions

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedOrders() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return [];
  }
}

export async function putOrders(orders) {
  if (!orders?.length) return;
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const order of orders) {
        if (order?.id) store.put(order);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // best-effort
  }
}

export async function replaceAllOrders(orders) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear();
      for (const order of orders || []) {
        if (order?.id) store.put(order);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // best-effort
  }
}

export async function clearOrderCache() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* ignore */ }
  try {
    localStorage.removeItem(LAST_SYNC_KEY);
    localStorage.removeItem(LAST_FULL_SYNC_KEY);
  } catch (e) { /* ignore */ }
}

export function getLastSync() {
  try { return localStorage.getItem(LAST_SYNC_KEY) || null; } catch { return null; }
}

export function setLastSync(iso) {
  try { if (iso) localStorage.setItem(LAST_SYNC_KEY, iso); } catch { /* ignore */ }
}

export function getLastFullSync() {
  try {
    const v = localStorage.getItem(LAST_FULL_SYNC_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch { return 0; }
}

export function setLastFullSync(ts) {
  try { localStorage.setItem(LAST_FULL_SYNC_KEY, String(ts)); } catch { /* ignore */ }
}

export function shouldDoFullSync() {
  return (Date.now() - getLastFullSync()) > FULL_SYNC_INTERVAL_MS;
}