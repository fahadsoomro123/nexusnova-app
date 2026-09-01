import { loadJson, saveJson } from './local-store.js';
import { waitForFirebaseUser } from './firebase-backend.js';
import {
  mergeDriveStores,
  normalizeDriveStore,
  pushDriveCloudStore,
  syncDriveCloudStore
} from './drive-cloud-store.js';

const STORE_PREFIX = 'nexusnova_drive_track_v1:';
const DEVICE_KEY = `${STORE_PREFIX}device`;
let hydrateInFlight = null;

function announceUpdate() {
  window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
}

function keyForUid(uid) {
  return `${STORE_PREFIX}${String(uid || '').trim()}`;
}

function readKey(key) {
  return normalizeDriveStore(loadJson(key, null));
}

function hasData(store) {
  const normalized = normalizeDriveStore(store);
  return normalized.trips.length > 0 || Object.keys(normalized.days).length > 0;
}

function removeDeviceStore() {
  try { localStorage.removeItem(DEVICE_KEY); } catch {}
}

async function activeUser(timeout = 6000) {
  try { return await waitForFirebaseUser(timeout); }
  catch { return null; }
}

export async function loadDriveTrackState() {
  const user = await activeUser();
  const key = user ? keyForUid(user.uid) : DEVICE_KEY;
  return { key, user, store: readKey(key), cloud: false };
}

/**
 * Restore the signed-in user's Drive/Track history from Firestore and merge any
 * pre-auth/device history into the same account exactly once. Device data is
 * removed only after a confirmed cloud write, so a temporary network failure
 * cannot destroy the only local copy.
 */
export async function hydrateDriveTrackState() {
  if (hydrateInFlight) return hydrateInFlight;
  hydrateInFlight = (async () => {
    const user = await activeUser(8000);
    if (!user) {
      return { key: DEVICE_KEY, user: null, store: readKey(DEVICE_KEY), cloud: false };
    }

    const key = keyForUid(user.uid);
    const accountLocal = readKey(key);
    const deviceLocal = readKey(DEVICE_KEY);
    const localCandidate = hasData(deviceLocal)
      ? mergeDriveStores(accountLocal, deviceLocal)
      : accountLocal;

    try {
      const result = await syncDriveCloudStore(localCandidate);
      // A trip can finish while hydration is awaiting Firestore. Merge the
      // response into whatever is local NOW so an older restore result can
      // never erase a newly completed trip.
      let restored = mergeDriveStores(readKey(key), result?.store || localCandidate);
      const latestDevice = readKey(DEVICE_KEY);
      if (hasData(latestDevice)) restored = mergeDriveStores(restored, latestDevice);
      saveJson(key, restored);
      if (result?.cloud) {
        if (hasData(latestDevice)) removeDeviceStore();
        announceUpdate();
      }
      return { key, user, store: restored, cloud: result?.cloud === true };
    } catch (error) {
      // Keep the newest local candidate if cloud is temporarily unavailable.
      let kept = mergeDriveStores(readKey(key), localCandidate);
      const latestDevice = readKey(DEVICE_KEY);
      if (hasData(latestDevice)) kept = mergeDriveStores(kept, latestDevice);
      saveJson(key, kept);
      console.warn('[NexusNova Drive] cloud restore deferred:', error);
      return { key, user, store: kept, cloud: false, error };
    }
  })().finally(() => { hydrateInFlight = null; });
  return hydrateInFlight;
}

/**
 * Save locally first, then merge/push to the user's Firestore Drive document.
 * When authentication is not available yet, the data stays under the device
 * staging key and is claimed by the account on the next successful hydration.
 */
export async function persistDriveTrackState(rawStore) {
  const incoming = normalizeDriveStore(rawStore);
  const user = await activeUser();

  if (!user) {
    const staged = mergeDriveStores(readKey(DEVICE_KEY), incoming);
    saveJson(DEVICE_KEY, staged);
    announceUpdate();
    return { key: DEVICE_KEY, user: null, store: staged, cloud: false };
  }

  const key = keyForUid(user.uid);
  const deviceLocal = readKey(DEVICE_KEY);
  let local = mergeDriveStores(readKey(key), incoming);
  if (hasData(deviceLocal)) local = mergeDriveStores(local, deviceLocal);

  // Local-first makes a WebView/app crash non-destructive even if the network
  // disappears during the cloud write.
  saveJson(key, local);
  announceUpdate();

  try {
    const result = await pushDriveCloudStore(local);
    // Never save a stale cloud response over a newer local trip. Another
    // persistence call may have written newer data while this request waited.
    let saved = mergeDriveStores(readKey(key), result?.store || local);
    const latestDevice = readKey(DEVICE_KEY);
    if (hasData(latestDevice)) saved = mergeDriveStores(saved, latestDevice);
    saveJson(key, saved);
    if (result?.cloud) {
      if (hasData(latestDevice)) removeDeviceStore();
      announceUpdate();
    }
    return { key, user, store: saved, cloud: result?.cloud === true };
  } catch (error) {
    const kept = mergeDriveStores(readKey(key), local);
    saveJson(key, kept);
    console.warn('[NexusNova Drive] cloud backup deferred:', error);
    return { key, user, store: kept, cloud: false, error };
  }
}