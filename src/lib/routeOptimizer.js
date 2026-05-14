/**
 * Route optimization utilities.
 *
 * Two-step approach:
 *  1) Geocode each stop's address using the OpenStreetMap Nominatim service
 *     (free, no API key). Results are cached in localStorage by address string.
 *  2) Order stops using a nearest-neighbor heuristic starting either from a
 *     provided origin (e.g. driver's current GPS) or from the first stop.
 *
 * This is good enough for small routes (typically < 30 stops). For larger fleets
 * a proper TSP solver / mapping API should be used.
 */

const CACHE_KEY = "zoozz_geocode_cache_v1";

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}

function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore quota */ }
}

function addressKey(order) {
  return [order.neighborhood, order.street, order.building_number].filter(Boolean).join(", ").trim().toLowerCase();
}

async function geocodeOne(addressString) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressString)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

/**
 * Geocode a list of orders. Returns { coordsByOrderId, missing } where:
 *   coordsByOrderId: { [orderId]: { lat, lon } }
 *   missing: orderId[] for which no coordinates could be found
 *
 * Respects Nominatim's 1 req/sec policy by spacing calls.
 */
export async function geocodeOrders(orders) {
  const cache = loadCache();
  const coordsByOrderId = {};
  const missing = [];

  for (const order of orders) {
    const key = addressKey(order);
    if (!key) { missing.push(order.id); continue; }

    if (cache[key]) {
      coordsByOrderId[order.id] = cache[key];
      continue;
    }

    try {
      const coords = await geocodeOne(key);
      if (coords) {
        cache[key] = coords;
        coordsByOrderId[order.id] = coords;
      } else {
        missing.push(order.id);
      }
      // Be polite to Nominatim (≤ 1 req/sec)
      await new Promise((r) => setTimeout(r, 1100));
    } catch (err) {
      console.warn("[routeOptimizer] geocode error:", err.message);
      missing.push(order.id);
    }
  }

  saveCache(cache);
  return { coordsByOrderId, missing };
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Nearest-neighbor TSP heuristic.
 *  - orders: orders to sequence
 *  - coordsByOrderId: lookup from geocodeOrders
 *  - origin: optional { lat, lon } — the route's starting point (e.g. driver GPS)
 *
 * Orders without coords keep their relative order and are appended at the end.
 */
export function optimizeRoute(orders, coordsByOrderId, origin = null) {
  const withCoords = orders.filter((o) => coordsByOrderId[o.id]);
  const withoutCoords = orders.filter((o) => !coordsByOrderId[o.id]);

  if (withCoords.length === 0) return orders;

  const remaining = [...withCoords];
  const ordered = [];

  // Pick starting point
  let current;
  if (origin) {
    current = { lat: origin.lat, lon: origin.lon };
  } else {
    // Use first stop as anchor
    const first = remaining.shift();
    ordered.push(first);
    current = coordsByOrderId[first.id];
  }

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = coordsByOrderId[remaining[i].id];
      const d = haversineKm(current, c);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = coordsByOrderId[next.id];
  }

  return [...ordered, ...withoutCoords];
}

/**
 * Get the user's current position. Returns null on error / denial.
 */
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}