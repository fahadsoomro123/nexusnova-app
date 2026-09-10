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
const LEGACY_GUEST_KEY = `${STORE_PREFIX}guest`;
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

function removeKey(key) {
  try { localStorage.removeItem(key); } catch {}
}

function mergeLegacySources(base) {
  let merged = normalizeDriveStore(base);
  const device = readKey(DEVICE_KEY);
  const guest = readKey(LEGACY_GUEST_KEY);
  if (hasData(device)) merged = mergeDriveStores(merged, device);
  if (hasData(guest)) merged = mergeDriveStores(merged, guest);
  return { merged, device, guest };
}

function legacyUidStores(currentUid) {
  const excluded = new Set([DEVICE_KEY, LEGACY_GUEST_KEY, keyForUid(currentUid)]);
  const found = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(STORE_PREFIX) || excluded.has(key)) continue;
      const suffix = key.slice(STORE_PREFIX.length).trim();
      if (!suffix || suffix === 'device' || suffix === 'guest') continue;
      const store = readKey(key);
      if (hasData(store)) found.push({ key, store });
    }
  } catch {}
  return found;
}

async function activeUser(timeout = 6000) {
  try { return await waitForFirebaseUser(timeout); }
  catch { return null; }
}

export async function loadDriveTrackState() {
  const user = await activeUser();
  const key = user ? keyForUid(user.uid) : DEVICE_KEY;
  const base = readKey(key);
  if (!user) return { key, user, store: base, cloud: false };
  const { merged } = mergeLegacySources(base);
  if (hasData(merged)) saveJson(key, merged);
  return { key, user, store: merged, cloud: false };
}

/**
 * Restore the signed-in user's Drive/Track history from Firestore and merge
 * both the current device staging key and the original pre-auth `guest` key.
 * Older NexusNova Drive builds saved trips under `...:guest`; ignoring that key
 * made valid on-device history appear to have vanished after an upgrade.
 * Legacy copies are deleted only after a confirmed cloud write.
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
    const legacy = mergeLegacySources(accountLocal);
    const localCandidate = legacy.merged;

    // Persist the merged local candidate BEFORE any network request. Recover
    // must still restore old phone data when Firestore is temporarily blocked.
    if (hasData(localCandidate)) saveJson(key, localCandidate);

    try {
      const result = await syncDriveCloudStore(localCandidate);
      // A trip can finish while hydration is awaiting Firestore. Merge the
      // response into whatever is local NOW so an older restore result can
      // never erase a newly completed trip.
      let restored = mergeDriveStores(readKey(key), result?.store || localCandidate);
      const newestLegacy = mergeLegacySources(restored);
      restored = newestLegacy.merged;
      saveJson(key, restored);
      if (result?.cloud) {
        if (hasData(newestLegacy.device)) removeKey(DEVICE_KEY);
        if (hasData(newestLegacy.guest)) removeKey(LEGACY_GUEST_KEY);
        announceUpdate();
      }
      return { key, user, store: restored, cloud: result?.cloud === true, recoveredLocal:true };
    } catch (error) {
      // Cloud permission/network failure must never block local recovery.
      const kept = mergeLegacySources(mergeDriveStores(readKey(key), localCandidate)).merged;
      saveJson(key, kept);
      if (hasData(kept)) announceUpdate();
      console.warn('[NexusNova Drive] cloud restore deferred; local history kept:', error);
      return { key, user, store: kept, cloud: false, recoveredLocal:hasData(kept), error };
    }
  })().finally(() => { hydrateInFlight = null; });
  return hydrateInFlight;
}

/**
 * Manual recovery fallback for upgrades that changed Firebase identity.
 * We only inspect old account-scoped Drive keys after normal account/device/
 * guest recovery found nothing. Exactly one populated old UID key is safe to
 * claim automatically. Multiple old UID stores are left untouched to avoid
 * mixing different people's history on a shared phone.
 */
export async function recoverLegacyDriveTrackState() {
  const hydrated = await hydrateDriveTrackState();
  if (!hydrated?.user) {
    return { ...hydrated, legacyUidCandidates:0, legacyUidRecovered:false };
  }

  const candidates = legacyUidStores(hydrated.user.uid);
  if (!candidates.length) {
    return {
      ...hydrated,
      legacyUidCandidates:0,
      legacyUidRecovered:false
    };
  }

  // A newly completed trip must not prevent Recover from scanning older UID
  // stores. Previous code returned early as soon as today's store had data,
  // which is exactly why only today's trip appeared while older phone history
  // stayed stranded under earlier Firebase identities. Merge every app-local
  // Drive store and let mergeDriveStores de-duplicate trip identities.
  const key = keyForUid(hydrated.user.uid);
  let recovered = mergeDriveStores(readKey(key), hydrated.store);
  for (const candidate of candidates) recovered = mergeDriveStores(recovered, candidate.store);
  saveJson(key, recovered);
  if (hasData(recovered)) announceUpdate();

  try {
    const result = await pushDriveCloudStore(recovered);
    recovered = mergeDriveStores(readKey(key), result?.store || recovered);
    saveJson(key, recovered);
    if (hasData(recovered)) announceUpdate();
    return {
      ...hydrated,
      key,
      store:recovered,
      cloud:result?.cloud === true,
      legacyUidCandidates:candidates.length,
      legacyUidRecovered:hasData(recovered)
    };
  } catch (error) {
    recovered = mergeDriveStores(readKey(key), recovered);
    saveJson(key, recovered);
    if (hasData(recovered)) announceUpdate();
    console.warn('[NexusNova Drive] legacy UID history restored locally; cloud backup deferred:', error);
    return {
      ...hydrated,
      key,
      store:recovered,
      cloud:false,
      legacyUidCandidates:candidates.length,
      legacyUidRecovered:hasData(recovered),
      error
    };
  }
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
  let local = mergeDriveStores(readKey(key), incoming);
  local = mergeLegacySources(local).merged;

  // Local-first makes a WebView/app crash non-destructive even if the network
  // disappears during the cloud write.
  saveJson(key, local);
  announceUpdate();

  try {
    const result = await pushDriveCloudStore(local);
    // Never save a stale cloud response over a newer local trip. Another
    // persistence call may have written newer data while this request waited.
    let saved = mergeDriveStores(readKey(key), result?.store || local);
    const newestLegacy = mergeLegacySources(saved);
    saved = newestLegacy.merged;
    saveJson(key, saved);
    if (result?.cloud) {
      if (hasData(newestLegacy.device)) removeKey(DEVICE_KEY);
      if (hasData(newestLegacy.guest)) removeKey(LEGACY_GUEST_KEY);
      announceUpdate();
    }
    return { key, user, store: saved, cloud: result?.cloud === true };
  } catch (error) {
    const kept = mergeLegacySources(mergeDriveStores(readKey(key), local)).merged;
    saveJson(key, kept);
    console.warn('[NexusNova Drive] cloud backup deferred:', error);
    return { key, user, store: kept, cloud: false, error };
  }
}
