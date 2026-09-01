import { loadDriveTrackState, persistDriveTrackState, hydrateDriveTrackState } from './core/drive-track-persistence.js';

const seen = new Set();
let syncing = false;

function nativeReady() {
  return typeof window.NexusAndroid?.postMessage === 'function' && typeof window.nexusPostNativeAction === 'function';
}

function dayKey(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function installDriveStageGuard() {
  const stage = document.getElementById('nx-stage');
  if (!stage) return;
  const syncClass = () => {
    const driveOpen = Boolean(stage.querySelector(':scope > .nx-drive-v3-screen'));
    stage.classList.toggle('nx-drive-v3-stage', driveOpen);
    document.documentElement.classList.toggle('nx-drive-v3-open', driveOpen);
  };
  const observer = new MutationObserver(syncClass);
  observer.observe(stage, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  syncClass();
}

async function importTrip(completed) {
  const nativeId = String(completed?.nativeId || '').trim();
  if (!nativeId || seen.has(nativeId)) return false;

  const state = await loadDriveTrackState();
  const store = state.store;
  if (store.trips.some(row => row?.nativeId === nativeId)) {
    seen.add(nativeId);
    return false;
  }

  const atMs = Number(completed.at) || Date.now();
  const distanceM = Math.max(0, Number(completed.distanceM) || 0);
  const movingMs = Math.max(0, Number(completed.movingMs) || 0);
  const topKmh = Math.max(0, Number(completed.topKmh) || 0);
  const avgKmh = movingMs > 0 ? (distanceM / (movingMs / 1000)) * 3.6 : Math.max(0, Number(completed.avgKmh) || 0);
  const mode = String(completed.mode || '').toLowerCase() === 'bicycle' ? 'bicycle' : 'motor';
  const key = dayKey(atMs);
  const row = store.days[key] && typeof store.days[key] === 'object'
    ? store.days[key]
    : { distanceM:0, movingMs:0, trips:0 };

  row.distanceM = (Number(row.distanceM) || 0) + distanceM;
  row.movingMs = (Number(row.movingMs) || 0) + movingMs;
  row.trips = (Number(row.trips) || 0) + 1;
  store.days[key] = row;
  store.trips.unshift({
    nativeId,
    at:new Date(atMs).toISOString(),
    endedAt:new Date(Number(completed.endedAt) || Date.now()).toISOString(),
    distanceM,
    movingMs,
    durationMs:Math.max(0, Number(completed.durationMs) || movingMs),
    topKmh,
    avgKmh,
    mode
  });
  store.trips = store.trips.slice(0, 90);

  await persistDriveTrackState(store);
  seen.add(nativeId);
  window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
  return true;
}

async function syncDetail(detail) {
  if (syncing || !detail || typeof detail !== 'object') return;
  const queue = Array.isArray(detail.completedTrips)
    ? detail.completedTrips
    : detail.completedTrip ? [detail.completedTrip] : [];
  if (!queue.length) return;
  syncing = true;
  try {
    for (const trip of queue) {
      try { await importTrip(trip); } catch {}
    }
  } finally {
    syncing = false;
  }
}

window.addEventListener('nexusnova:native-drive', event => {
  syncDetail(event?.detail).catch(() => {});
});

function requestNativeQueue() {
  if (!nativeReady()) return false;
  try { return window.nexusPostNativeAction('nativeDriveStatus') === true; }
  catch { return false; }
}

installDriveStageGuard();

// Restore Firestore history on every app launch, not only when Nova Drive opens.
hydrateDriveTrackState().catch(() => {});

let startupChecks = 0;
const startupTimer = setInterval(() => {
  startupChecks += 1;
  if (requestNativeQueue() || startupChecks >= 20) clearInterval(startupTimer);
}, 500);

window.addEventListener('focus', requestNativeQueue);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestNativeQueue();
});

// A low-frequency foreground heartbeat catches completed native trips even if
// the user never opens Nova Drive during that app session.
setInterval(() => {
  if (document.visibilityState === 'visible') requestNativeQueue();
}, 30_000);
