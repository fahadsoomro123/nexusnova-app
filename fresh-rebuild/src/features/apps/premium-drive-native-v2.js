import { hydrateDriveTrackState, loadDriveTrackState, persistDriveTrackState } from '../../core/drive-track-persistence.js';
import { premiumDriveRenderers } from './premium-drive-tools.js';

const HISTORY_LIMIT = 90;

function nativeBridgeReady() {
  return typeof window.NexusAndroid?.postMessage === 'function' && typeof window.nexusPostNativeAction === 'function';
}

function post(action) {
  return window.nexusPostNativeAction?.(action) === true;
}

function localDayKey(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function announceStoreUpdate() {
  window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
}

async function importCompletedTrip(completed) {
  if (!completed || typeof completed !== 'object') return false;
  const nativeId = String(completed.nativeId || '').trim();
  if (!nativeId) return false;

  const state = await loadDriveTrackState();
  const store = state.store;
  if (store.trips.some(row => row?.nativeId === nativeId)) {
    // A restored/local copy may already contain this native trip. Still make
    // sure the cloud state is caught up, then do not double-count it.
    persistDriveTrackState(store).catch(() => {});
    return false;
  }

  const atMs = Number(completed.at) || Date.now();
  const distanceM = Math.max(0, Number(completed.distanceM) || 0);
  const movingMs = Math.max(0, Number(completed.movingMs) || 0);
  const durationMs = Math.max(0, Number(completed.durationMs) || 0);
  const topKmh = Math.max(0, Number(completed.topKmh) || 0);
  const day = localDayKey(atMs);
  const row = store.days[day] && typeof store.days[day] === 'object'
    ? store.days[day]
    : { distanceM: 0, movingMs: 0, trips: 0 };
  row.distanceM = (Number(row.distanceM) || 0) + distanceM;
  row.movingMs = (Number(row.movingMs) || 0) + movingMs;
  row.trips = (Number(row.trips) || 0) + 1;
  store.days[day] = row;
  store.trips.unshift({
    nativeId,
    at: new Date(atMs).toISOString(),
    endedAt: new Date(Number(completed.endedAt) || Date.now()).toISOString(),
    distanceM,
    movingMs,
    durationMs,
    topKmh
  });
  store.trips = store.trips.slice(0, HISTORY_LIMIT);

  // Save locally first and cloud-back it up through the isolated persistence
  // coordinator. If auth/network is not ready, it is staged and migrated later.
  announceStoreUpdate();
  try { await persistDriveTrackState(store); } catch {}
  return true;
}

function durationText(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function distanceText(meters) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

function compassPoint(degrees) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const value = (((Number(degrees) || 0) % 360) + 360) % 360;
  return names[Math.round(value / 45) % 8];
}

function needleDegree(kmh) {
  const n = Math.max(0, Math.min(240, Number(kmh) || 0));
  return -130 + (n / 240) * 260;
}

function requestPreciseLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(new Error(error?.message || 'Precise location permission is required.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function renderNovaDriveNativeV2() {
  const base = premiumDriveRenderers['nova-drive'];
  const root = base?.();
  if (!(root instanceof HTMLElement) || !nativeBridgeReady()) return root;

  // Preserve the exact original meter/cards/visuals. Only clone the two controls
  // to replace foreground-only JS tracking with the native background engine.
  const oldMain = root.querySelector('[data-dr-main]');
  const oldStop = root.querySelector('[data-dr-stop]');
  if (!(oldMain instanceof HTMLButtonElement) || !(oldStop instanceof HTMLButtonElement)) return root;
  const main = oldMain.cloneNode(true);
  const stop = oldStop.cloneNode(true);
  oldMain.replaceWith(main);
  oldStop.replaceWith(stop);

  const needle = root.querySelector('[data-dr-needle]');
  const valueEl = root.querySelector('[data-dr-value]');
  const modeEl = root.querySelector('[data-dr-mode]');
  const stateEl = root.querySelector('[data-dr-state]');
  const topEl = root.querySelector('[data-dr-top]');
  const averageEl = root.querySelector('[data-dr-average]');
  const distanceEl = root.querySelector('[data-dr-distance]');
  const durationEl = root.querySelector('[data-dr-duration]');
  const accuracyEl = root.querySelector('[data-dr-accuracy]');
  const headingEl = root.querySelector('[data-dr-heading]');
  const statusEl = root.querySelector('[data-dr-status]');

  let snapshot = { active: false, paused: false };
  let disposed = false;

  const paint = detail => {
    if (disposed || !detail || typeof detail !== 'object') return;
    snapshot = detail;
    const active = detail.active === true;
    const paused = detail.paused === true;
    const speed = paused ? 0 : Math.max(0, Number(detail.speedKmh) || 0);
    const top = Math.max(0, Number(detail.topKmh) || 0);
    const distance = Math.max(0, Number(detail.distanceM) || 0);
    const moving = Math.max(0, Number(detail.movingMs) || 0);
    const avg = moving > 0 ? (distance / (moving / 1000)) * 3.6 : 0;
    const heading = Number(detail.heading);
    const accuracy = Number(detail.accuracy);

    needle?.setAttribute('transform', `rotate(${needleDegree(speed).toFixed(2)} 500 500)`);
    if (valueEl) valueEl.textContent = String(Math.round(speed));
    if (modeEl) modeEl.textContent = paused ? 'PAUSED' : active ? 'LIVE SPEED' : 'LIVE SPEED';
    if (stateEl) stateEl.textContent = paused ? 'PAUSED' : active ? 'LIVE' : 'READY';
    if (topEl) topEl.textContent = `${Math.round(top)} km/h`;
    if (averageEl) averageEl.textContent = `${Math.round(Math.max(0, avg))} km/h`;
    if (distanceEl) distanceEl.textContent = distanceText(distance);
    if (durationEl) durationEl.textContent = durationText(detail.durationMs);
    if (accuracyEl) accuracyEl.textContent = Number.isFinite(accuracy) ? `${Math.round(accuracy)} m` : '—';
    if (headingEl) headingEl.textContent = Number.isFinite(heading) ? `${compassPoint(heading)} ${Math.round(heading)}°` : '—';
    if (statusEl) statusEl.textContent = String(detail.error || detail.status || (active ? 'Background GPS active.' : 'Ready.'));

    main.textContent = !active ? '▶ START DRIVE' : paused ? '▶ RESUME DRIVE' : 'Ⅱ PAUSE DRIVE';
    stop.disabled = !active;
    root.dataset.nativeDriveActive = active ? '1' : '0';

    if (detail.completedTrip) importCompletedTrip(detail.completedTrip).catch(() => {});
  };

  const onNative = event => paint(event?.detail);
  window.addEventListener('nexusnova:native-drive', onNative);

  // Reinstall-safe account restore. Existing local/device history is merged into
  // the signed-in account and never blindly replaced by an empty local store.
  hydrateDriveTrackState().catch(() => {});

  main.addEventListener('click', async () => {
    if (disposed) return;
    if (!snapshot.active) {
      if (statusEl) statusEl.textContent = 'Requesting precise GPS permission…';
      try {
        await requestPreciseLocation();
        if (disposed) return;
        post('nativeDriveStart');
      } catch (error) {
        if (statusEl) statusEl.textContent = error?.message || 'Precise location permission is required.';
      }
      return;
    }
    post(snapshot.paused ? 'nativeDriveResume' : 'nativeDrivePause');
  });

  stop.addEventListener('click', () => {
    if (!disposed && snapshot.active) post('nativeDriveStop');
  });

  const poll = setInterval(() => {
    if (!disposed) post('nativeDriveStatus');
  }, 1000);
  post('nativeDriveStatus');

  const baseCleanup = root.__cleanup;
  root.__cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(poll);
    window.removeEventListener('nexusnova:native-drive', onNative);
    // Deliberately do not stop an active native trip on navigation/screen lock.
    baseCleanup?.();
  };
  return root;
}

export function renderNovaTrackNativeV2() {
  const base = premiumDriveRenderers['nova-track'];
  const root = base?.();
  if (!(root instanceof HTMLElement) || !nativeBridgeReady()) return root;
  let disposed = false;
  const onNative = event => {
    if (disposed) return;
    const completed = event?.detail?.completedTrip;
    if (completed) importCompletedTrip(completed).catch(() => {});
  };
  window.addEventListener('nexusnova:native-drive', onNative);
  hydrateDriveTrackState().catch(() => {});
  post('nativeDriveStatus');
  const baseCleanup = root.__cleanup;
  root.__cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('nexusnova:native-drive', onNative);
    baseCleanup?.();
  };
  return root;
}

export const driveNativeV2Renderers = Object.freeze({
  'nova-drive': renderNovaDriveNativeV2,
  'nova-track': renderNovaTrackNativeV2
});
