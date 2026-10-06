import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firestoreDb, waitForFirebaseUser } from './firebase-backend.js';

const CLOUD_VERSION = 3;
const lastSyncedSignature = new Map();
const syncInFlight = new Map();

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function isoOrNow(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'bicycle' ? 'bicycle' : mode === 'motor' ? 'motor' : 'unknown';
}

function normalizePoint(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.lon ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const at = Number(raw.at ?? raw.time ?? raw.timestamp);
  const accuracy = finiteNonNegative(raw.accuracy ?? raw.accuracyM);
  const speedKmh = finiteNonNegative(raw.speedKmh ?? raw.speed);
  return {
    lat,
    lng,
    ...(Number.isFinite(at) && at > 0 ? { at:Math.round(at) } : {}),
    ...(accuracy > 0 ? { accuracy } : {}),
    ...(speedKmh > 0 ? { speedKmh } : {})
  };
}

function normalizeRoutePoints(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePoint).filter(Boolean).slice(0, 1200);
}

function shortText(value, limit = 160) {
  return String(value || '').trim().slice(0, limit);
}

function tripKey(trip) {
  const nativeId = String(trip?.nativeId || '').trim();
  if (nativeId) return `native:${nativeId}`;
  return [trip?.at, trip?.endedAt, Math.round(finiteNonNegative(trip?.distanceM)), Math.round(finiteNonNegative(trip?.durationMs))].join('|');
}

function normalizeTrip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const at = isoOrNow(raw.at ?? raw.startedAt ?? raw.startTime);
  const endedAt = isoOrNow(raw.endedAt ?? raw.endTime ?? raw.at ?? raw.startedAt ?? raw.startTime);
  const nativeId = String(raw.nativeId ?? raw.routeTripId ?? raw.tripId ?? raw.id ?? '').trim().slice(0, 180);
  const distanceM = finiteNonNegative(raw.distanceM ?? (Number(raw.distanceKm) * 1000));
  const movingMs = Math.round(finiteNonNegative(raw.movingMs ?? (Number(raw.movingSeconds ?? raw.durationSeconds) * 1000)));
  const durationMs = Math.round(finiteNonNegative(raw.durationMs ?? (Number(raw.durationSeconds) * 1000) ?? movingMs));
  const avgKmh = movingMs > 0 ? (distanceM / (movingMs / 1000)) * 3.6 : finiteNonNegative(raw.avgKmh ?? raw.avgSpeedKmh);
  const routePoints = normalizeRoutePoints(raw.routePoints || raw.points || raw.route);
  const startPoint = normalizePoint(raw.startPoint || raw.startCoordinate || raw.startCoords || raw.start);
  const endPoint = normalizePoint(raw.endPoint || raw.endCoordinate || raw.endCoords || raw.end);
  const startName = shortText(raw.startName || raw.startLabel || raw.startLocation);
  const endName = shortText(raw.endName || raw.endLabel || raw.endLocation);
  return {
    ...(nativeId ? { nativeId } : {}),
    at,
    endedAt,
    distanceM,
    movingMs,
    durationMs,
    topKmh: finiteNonNegative(raw.topKmh ?? raw.topSpeedKmh),
    avgKmh: finiteNonNegative(avgKmh),
    mode: normalizeMode(raw.mode),
    ...(routePoints.length ? { routePoints } : {}),
    ...(startPoint ? { startPoint } : {}),
    ...(endPoint ? { endPoint } : {}),
    ...(startName ? { startName } : {}),
    ...(endName ? { endName } : {})
  };
}

function normalizeDays(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = Object.entries(raw)
    .filter(([key, value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && value && typeof value === 'object')
    .sort(([a], [b]) => b.localeCompare(a));
  return Object.fromEntries(entries.map(([key, value]) => [key, {
    distanceM: finiteNonNegative(value.distanceM),
    movingMs: Math.round(finiteNonNegative(value.movingMs)),
    trips: Math.round(finiteNonNegative(value.trips))
  }]));
}

export function normalizeDriveStore(raw) {
  const trips = (Array.isArray(raw?.trips) ? raw.trips : [])
    .map(normalizeTrip)
    .filter(Boolean)
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
  return { version:CLOUD_VERSION, days:normalizeDays(raw?.days), trips };
}

function signature(store) {
  return JSON.stringify(normalizeDriveStore(store));
}

function aggregateTrips(trips) {
  const days = {};
  trips.forEach(trip => {
    const key = dayKey(trip.at);
    if (!key) return;
    const row = days[key] || { distanceM:0, movingMs:0, trips:0 };
    row.distanceM += finiteNonNegative(trip.distanceM);
    row.movingMs += Math.round(finiteNonNegative(trip.movingMs));
    row.trips += 1;
    days[key] = row;
  });
  return days;
}

function mergeDayMaps(localDays, remoteDays, tripDays) {
  const result = {};
  const keys = new Set([...Object.keys(localDays), ...Object.keys(remoteDays), ...Object.keys(tripDays)]);
  [...keys].sort((a, b) => b.localeCompare(a)).forEach(key => {
    const local = localDays[key] || {};
    const remote = remoteDays[key] || {};
    const trips = tripDays[key] || {};
    result[key] = {
      distanceM: Math.max(finiteNonNegative(local.distanceM), finiteNonNegative(remote.distanceM), finiteNonNegative(trips.distanceM)),
      movingMs: Math.max(Math.round(finiteNonNegative(local.movingMs)), Math.round(finiteNonNegative(remote.movingMs)), Math.round(finiteNonNegative(trips.movingMs))),
      trips: Math.max(Math.round(finiteNonNegative(local.trips)), Math.round(finiteNonNegative(remote.trips)), Math.round(finiteNonNegative(trips.trips)))
    };
  });
  return result;
}

function mergeTripRecords(previous, incoming) {
  if (!previous) return incoming;
  const previousAt = new Date(previous.endedAt).getTime();
  const incomingAt = new Date(incoming.endedAt).getTime();
  const primary = incomingAt >= previousAt ? incoming : previous;
  const secondary = primary === incoming ? previous : incoming;
  const primaryRoute = normalizeRoutePoints(primary.routePoints);
  const secondaryRoute = normalizeRoutePoints(secondary.routePoints);
  const routePoints = secondaryRoute.length > primaryRoute.length ? secondaryRoute : primaryRoute;
  const primaryDistance = finiteNonNegative(primary.distanceM);
  const secondaryDistance = finiteNonNegative(secondary.distanceM);
  const primaryMoving = Math.round(finiteNonNegative(primary.movingMs));
  const secondaryMoving = Math.round(finiteNonNegative(secondary.movingMs));
  const primaryDuration = Math.round(finiteNonNegative(primary.durationMs));
  const secondaryDuration = Math.round(finiteNonNegative(secondary.durationMs));

  return normalizeTrip({
    ...secondary,
    ...primary,
    distanceM: primaryDistance > 0 ? primaryDistance : secondaryDistance,
    movingMs: primaryMoving > 0 ? primaryMoving : secondaryMoving,
    durationMs: primaryDuration > 0 ? primaryDuration : secondaryDuration,
    topKmh: Math.max(finiteNonNegative(primary.topKmh), finiteNonNegative(secondary.topKmh)),
    routePoints,
    startPoint: primary.startPoint || secondary.startPoint,
    endPoint: primary.endPoint || secondary.endPoint,
    startName: primary.startName || secondary.startName,
    endName: primary.endName || secondary.endName
  });
}

export function mergeDriveStores(localRaw, remoteRaw) {
  const local = normalizeDriveStore(localRaw);
  const remote = normalizeDriveStore(remoteRaw);
  const byKey = new Map();
  [...remote.trips, ...local.trips].forEach(trip => {
    const key = tripKey(trip);
    byKey.set(key, mergeTripRecords(byKey.get(key), trip));
  });
  const trips = [...byKey.values()]
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
  const days = mergeDayMaps(local.days, remote.days, aggregateTrips(trips));
  return { version:CLOUD_VERSION, days, trips };
}

async function activeUser() {
  try { return await waitForFirebaseUser(5000); }
  catch { return null; }
}

function cloudRef(uid) {
  return doc(firestoreDb, 'users', uid, 'driveData', 'state');
}

async function readRemote(user) {
  const snapshot = await getDoc(cloudRef(user.uid));
  return snapshot.exists() ? snapshot.data() : null;
}

async function writeRemote(user, store) {
  const normalized = normalizeDriveStore(store);
  await setDoc(cloudRef(user.uid), {
    version:CLOUD_VERSION,
    days:normalized.days,
    trips:normalized.trips,
    updatedAt:serverTimestamp()
  });
  lastSyncedSignature.set(user.uid, signature(normalized));
  return normalized;
}

async function mergeAndWrite(user, local) {
  const uid = user.uid;
  const previous = syncInFlight.get(uid) || Promise.resolve();
  const operation = previous
    .catch(() => null)
    .then(async () => {
      const remote = await readRemote(user);
      const merged = mergeDriveStores(local, remote);
      const mergedSignature = signature(merged);
      if (lastSyncedSignature.get(uid) === mergedSignature) return merged;
      return writeRemote(user, merged);
    });

  syncInFlight.set(uid, operation);
  try {
    return await operation;
  } finally {
    if (syncInFlight.get(uid) === operation) syncInFlight.delete(uid);
  }
}

export async function syncDriveCloudStore(localRaw) {
  const local = normalizeDriveStore(localRaw);
  const user = await activeUser();
  if (!user) return { store:local, cloud:false };
  const merged = await mergeAndWrite(user, local);
  lastSyncedSignature.set(user.uid, signature(merged));
  return { store:merged, cloud:true };
}

export async function pushDriveCloudStore(localRaw) {
  const local = normalizeDriveStore(localRaw);
  const user = await activeUser();
  if (!user) return { store:local, cloud:false };
  const localSignature = signature(local);
  if (lastSyncedSignature.get(user.uid) === localSignature && !syncInFlight.has(user.uid)) {
    return { store:local, cloud:true, unchanged:true };
  }
  const merged = await mergeAndWrite(user, local);
  lastSyncedSignature.set(user.uid, signature(merged));
  return { store:merged, cloud:true };
}
