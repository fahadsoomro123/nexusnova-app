import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firestoreDb, waitForFirebaseUser } from './firebase-backend.js';

const CLOUD_VERSION = 2;
const MAX_TRIPS = 90;
const MAX_DAYS = 400;
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

function tripKey(trip) {
  const nativeId = String(trip?.nativeId || '').trim();
  if (nativeId) return `native:${nativeId}`;
  return [trip?.at, trip?.endedAt, Math.round(finiteNonNegative(trip?.distanceM)), Math.round(finiteNonNegative(trip?.durationMs))].join('|');
}

function normalizeTrip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const at = isoOrNow(raw.at);
  const endedAt = isoOrNow(raw.endedAt || raw.at);
  const nativeId = String(raw.nativeId || '').trim().slice(0, 180);
  const distanceM = finiteNonNegative(raw.distanceM);
  const movingMs = Math.round(finiteNonNegative(raw.movingMs));
  const durationMs = Math.round(finiteNonNegative(raw.durationMs));
  const avgKmh = movingMs > 0 ? (distanceM / (movingMs / 1000)) * 3.6 : finiteNonNegative(raw.avgKmh);
  return {
    ...(nativeId ? { nativeId } : {}),
    at,
    endedAt,
    distanceM,
    movingMs,
    durationMs,
    topKmh: finiteNonNegative(raw.topKmh),
    avgKmh: finiteNonNegative(avgKmh),
    mode: normalizeMode(raw.mode)
  };
}

function normalizeDays(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = Object.entries(raw)
    .filter(([key, value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && value && typeof value === 'object')
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, MAX_DAYS);
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
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
    .slice(0, MAX_TRIPS);
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
  [...keys].sort((a, b) => b.localeCompare(a)).slice(0, MAX_DAYS).forEach(key => {
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

export function mergeDriveStores(localRaw, remoteRaw) {
  const local = normalizeDriveStore(localRaw);
  const remote = normalizeDriveStore(remoteRaw);
  const byKey = new Map();
  [...remote.trips, ...local.trips].forEach(trip => {
    const key = tripKey(trip);
    const previous = byKey.get(key);
    if (!previous || new Date(trip.endedAt).getTime() >= new Date(previous.endedAt).getTime()) byKey.set(key, trip);
  });
  const trips = [...byKey.values()]
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
    .slice(0, MAX_TRIPS);
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

/**
 * Serialize cloud merges per UID. The old implementation returned an already
 * in-flight promise and silently discarded the newer caller's local store.
 * Queueing each candidate guarantees every newly completed trip participates
 * in a remote merge before that caller resolves.
 */
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