import { loadDriveTrackState, persistDriveTrackState } from './core/drive-track-persistence.js';

// Repairs completed native trips that were imported by older web builds before
// their GPS geometry was copied into the JS/account store. The Android service
// intentionally keeps its completed-trip queue, so a richer native copy can be
// merged back into an existing trip without fabricating any route points.

const recovering = new Set();

function point(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.lon ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const at = Number(raw.at ?? raw.time ?? raw.timestamp);
  const accuracy = Number(raw.accuracy ?? raw.accuracyM);
  const speedKmh = Number(raw.speedKmh ?? raw.speed);
  return {
    lat,
    lng,
    ...(Number.isFinite(at) && at > 0 ? { at:Math.round(at) } : {}),
    ...(Number.isFinite(accuracy) && accuracy > 0 ? { accuracy } : {}),
    ...(Number.isFinite(speedKmh) && speedKmh > 0 ? { speedKmh } : {})
  };
}

function route(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(point).filter(Boolean).slice(0, 1200);
}

function text(value) {
  return String(value || '').trim().slice(0, 160);
}

async function repairTrip(nativeTrip) {
  if (!nativeTrip || typeof nativeTrip !== 'object') return false;
  const nativeId = String(nativeTrip.nativeId || nativeTrip.routeTripId || nativeTrip.tripId || nativeTrip.id || '').trim();
  if (!nativeId || recovering.has(nativeId)) return false;

  const nativeRoute = route(nativeTrip.routePoints || nativeTrip.points || nativeTrip.route);
  const nativeStart = point(nativeTrip.startPoint || nativeTrip.startCoordinate || nativeTrip.startCoords || nativeTrip.start);
  const nativeEnd = point(nativeTrip.endPoint || nativeTrip.endCoordinate || nativeTrip.endCoords || nativeTrip.end);
  const nativeStartName = text(nativeTrip.startName || nativeTrip.startLabel || nativeTrip.startLocation);
  const nativeEndName = text(nativeTrip.endName || nativeTrip.endLabel || nativeTrip.endLocation);

  // Nothing useful to recover. Never draw a fake line from aggregate distance.
  if (nativeRoute.length < 2 && !nativeStart && !nativeEnd && !nativeStartName && !nativeEndName) return false;

  recovering.add(nativeId);
  try {
    const state = await loadDriveTrackState();
    const store = state?.store;
    if (!store || !Array.isArray(store.trips)) return false;

    const index = store.trips.findIndex(row => String(row?.nativeId || '').trim() === nativeId);
    if (index < 0) return false; // The normal importer owns first-time inserts.

    const existing = store.trips[index] || {};
    const existingRoute = route(existing.routePoints || existing.points || existing.route);
    let changed = false;
    const merged = { ...existing };

    if (nativeRoute.length > existingRoute.length) {
      merged.routePoints = nativeRoute;
      changed = true;
    }
    if (!point(existing.startPoint) && nativeStart) {
      merged.startPoint = nativeStart;
      changed = true;
    }
    if (!point(existing.endPoint) && nativeEnd) {
      merged.endPoint = nativeEnd;
      changed = true;
    }
    if (!text(existing.startName || existing.startLabel) && nativeStartName) {
      merged.startName = nativeStartName;
      changed = true;
    }
    if (!text(existing.endName || existing.endLabel) && nativeEndName) {
      merged.endName = nativeEndName;
      changed = true;
    }

    if (!changed) return false;
    store.trips[index] = merged;
    await persistDriveTrackState(store);
    window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
    return true;
  } finally {
    recovering.delete(nativeId);
  }
}

async function recover(detail) {
  const queue = Array.isArray(detail?.completedTrips)
    ? detail.completedTrips
    : detail?.completedTrip ? [detail.completedTrip] : [];
  for (const trip of queue) {
    try { await repairTrip(trip); }
    catch (error) { console.warn('[NexusNova Drive] route recovery deferred:', error); }
  }
}

window.addEventListener('nexusnova:native-drive', event => {
  recover(event?.detail).catch(() => {});
});

window.NexusNovaDriveRouteRecovery = Object.freeze({ recover });
