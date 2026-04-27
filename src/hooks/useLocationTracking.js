/**
 * useLocationTracking — Battery-efficient adaptive GPS hook.
 *
 * Strategy:
 *  - STATIONARY: poll every 60s (low battery)
 *  - IN_TRANSIT: poll every 10s (active tracking)
 *  - Geofence dwell time: 30s minimum before emitting enter/exit event
 *  - Accuracy gate: < 25m only
 *  - Offline queue: stores events in localStorage, syncs on reconnect
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { logLocation } from '@/functions/logLocation';

const ACCURACY_THRESHOLD = 25;       // meters
const STATIONARY_INTERVAL = 60000;   // 60s
const TRANSIT_INTERVAL = 10000;      // 10s
const SPEED_TRANSIT_THRESHOLD = 0.5; // m/s — above this = in-transit
const GEOFENCE_DWELL_MS = 30000;     // 30s dwell before emitting geofence event
const OFFLINE_QUEUE_KEY = 'zoozz_location_queue';

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function saveQueue(q) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

export function useLocationTracking({ enabled = false, geofences = [] } = {}) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const intervalRef = useRef(null);
  const geofenceDwellRef = useRef({}); // { geofence_id: { state, enteredAt } }
  const offlineQueueRef = useRef(loadQueue());

  // Online/offline listeners
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const flushOfflineQueue = useCallback(async () => {
    const queue = loadQueue();
    if (!queue.length) return;
    try {
      await logLocation({ events: queue }); // batch sync
      offlineQueueRef.current = [];
      saveQueue([]);
      console.log('[LocationTracking] Flushed', queue.length, 'offline events');
    } catch (err) {
      console.warn('[LocationTracking] Offline flush failed:', err.message);
    }
  }, []);

  const sendEvent = useCallback(async (eventData) => {
    if (!isOnline) {
      // Queue for later
      const q = [...offlineQueueRef.current, eventData];
      offlineQueueRef.current = q;
      saveQueue(q);
      return;
    }
    await logLocation(eventData);
  }, [isOnline]);

  const checkGeofences = useCallback((lat, long, timestamp) => {
    const now = Date.now();
    for (const gf of geofences) {
      const dist = haversineMeters(lat, long, gf.lat, gf.long);
      const inside = dist <= gf.radius;
      const dwellState = geofenceDwellRef.current[gf.id] || { state: null, enteredAt: null };

      if (inside && dwellState.state !== 'inside') {
        if (!dwellState.enteredAt) {
          // Start dwell timer
          geofenceDwellRef.current[gf.id] = { state: 'pending_enter', enteredAt: now };
        } else if (now - dwellState.enteredAt >= GEOFENCE_DWELL_MS) {
          // Dwell confirmed — emit enter
          geofenceDwellRef.current[gf.id] = { state: 'inside', enteredAt: now };
          sendEvent({ lat, long, accuracy: 0, timestamp, event_type: 'geofence_enter', geofence_id: gf.id });
        }
      } else if (!inside && dwellState.state === 'inside') {
        if (!dwellState.exitAt) {
          geofenceDwellRef.current[gf.id] = { ...dwellState, exitAt: now };
        } else if (now - dwellState.exitAt >= GEOFENCE_DWELL_MS) {
          // Dwell confirmed — emit exit
          geofenceDwellRef.current[gf.id] = { state: 'outside', enteredAt: null, exitAt: null };
          sendEvent({ lat, long, accuracy: 0, timestamp, event_type: 'geofence_exit', geofence_id: gf.id });
        }
      } else if (inside && dwellState.state === 'inside') {
        // Still inside, clear any pending exit
        if (dwellState.exitAt) {
          geofenceDwellRef.current[gf.id] = { state: 'inside', enteredAt: dwellState.enteredAt };
        }
      } else if (!inside) {
        // Reset pending enter if they left before dwell
        if (dwellState.state === 'pending_enter') {
          geofenceDwellRef.current[gf.id] = { state: null, enteredAt: null };
        }
      }
    }
  }, [geofences, sendEvent]);

  const pollPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: long, accuracy, speed } = pos.coords;
        const timestamp = new Date(pos.timestamp).toISOString();

        // Accuracy gate
        if (accuracy > ACCURACY_THRESHOLD) return;

        const eventData = {
          lat, long, accuracy,
          speed: speed ?? 0,
          timestamp,
          event_type: 'location_update',
          status_metadata: {
            battery: navigator.getBattery ? 'pending' : undefined,
            network: navigator.connection?.effectiveType || undefined,
          },
        };

        setLastPosition({ lat, long, accuracy, speed, timestamp });
        sendEvent(eventData);
        checkGeofences(lat, long, timestamp);

        // Adaptive interval
        const isMoving = (speed ?? 0) > SPEED_TRANSIT_THRESHOLD;
        const desiredInterval = isMoving ? TRANSIT_INTERVAL : STATIONARY_INTERVAL;
        if (intervalRef.current?._interval !== desiredInterval) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(pollPosition, desiredInterval);
          intervalRef.current._interval = desiredInterval;
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [sendEvent, checkGeofences]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setIsTracking(true);
    setError(null);
    pollPosition();
    intervalRef.current = setInterval(pollPosition, STATIONARY_INTERVAL);
    intervalRef.current._interval = STATIONARY_INTERVAL;
  }, [pollPosition]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (enabled) startTracking();
    return () => clearInterval(intervalRef.current);
  }, [enabled]);

  return { isTracking, lastPosition, error, isOnline, startTracking, stopTracking };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}