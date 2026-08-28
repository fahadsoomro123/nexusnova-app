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
      const restored = normalizeDriveStore(result?.store || localCandidate);
      saveJson(key, restored);
      if (result?.cloud) {
        if (hasData(deviceLocal)) removeDeviceStore();
        announceUpdate();
      }
      return { key, user, store: restored, cloud: result?.cloud === true };
    } catch (error) {
      // Keep the complete local candidate if cloud is temporarily unavailable.
      saveJson(key, localCandidate);
      console.warn('[NexusNova Drive] cloud restore deferred:', error);
      return { key, user, store: localCandidate, cloud: false, error };
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
    const saved = normalizeDriveStore(result?.store || local);
    saveJson(key, saved);
    if (result?.cloud) {
      if (hasData(deviceLocal)) removeDeviceStore();
      announceUpdate();
    }
    return { key, user, store: saved, cloud: result?.cloud === true };
  } catch (error) {
    console.warn('[NexusNova Drive] cloud backup deferred:', error);
    return { key, user, store: local, cloud: false, error };
  }
}
