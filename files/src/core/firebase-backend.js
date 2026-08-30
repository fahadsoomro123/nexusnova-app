import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { CustomProvider, getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app-check.js';

const DAY = 86_400_000;
const MINING_REWARD = 24;
export const firebaseConfig = {
  apiKey: 'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0',
  authDomain: 'nexusnova-6ade2.firebaseapp.com',
  projectId: 'nexusnova-6ade2',
  storageBucket: 'nexusnova-6ade2.firebasestorage.app',
  messagingSenderId: '49791194817',
  appId: '1:49791194817:web:07f28326e0f15979536640',
  measurementId: 'G-YLPFKWSS12'
};

function matchesFirebaseConfig(app) {
  const options = app?.options || {};
  return options.apiKey === firebaseConfig.apiKey &&
    options.projectId === firebaseConfig.projectId &&
    options.appId === firebaseConfig.appId;
}

const existingFirebaseApp = getApps().find(matchesFirebaseConfig);
export const firebaseApp = existingFirebaseApp || initializeApp(
  firebaseConfig,
  'nexusnova-fresh-web-07f28326e0f15979536640'
);
let appCheck = null;
let appCheckError = '';
let unsubscribe = null;
let operation = null;

const siteKey = String(document.querySelector('meta[name="nexusnova-app-check-site-key"]')?.content || '').trim();
const nativeAppCheckBridge = globalThis.NexusAppCheckAndroid;
const nativeAppCheckPending = new Map();
let nativeAppCheckRequestCounter = 0;
let nativeAppCheckListenerReady = false;

function nativeAppCheckAvailable() {
  return nativeAppCheckBridge && typeof nativeAppCheckBridge.postMessage === 'function';
}

function settleNativeAppCheck(requestId, payload) {
  const pending = nativeAppCheckPending.get(requestId);
  if (!pending) return;
  nativeAppCheckPending.delete(requestId);
  clearTimeout(pending.timer);

  if (!payload?.ok) {
    pending.reject(new Error(String(payload?.error || 'Native App Check verification failed.')));
    return;
  }

  const token = String(payload.token || '').trim();
  const expireTimeMillis = Number(payload.expireTimeMillis);
  if (!token || !Number.isFinite(expireTimeMillis) || expireTimeMillis <= Date.now()) {
    pending.reject(new Error('Native App Check returned an invalid token.'));
    return;
  }
  pending.resolve({ token, expireTimeMillis });
}

function ensureNativeAppCheckListener() {
  if (!nativeAppCheckAvailable() || nativeAppCheckListenerReady) return;
  const listener = event => {
    try {
      const payload = JSON.parse(String(event?.data || ''));
      settleNativeAppCheck(String(payload?.requestId || ''), payload);
    } catch (error) {
      console.error('[NexusNova Fresh] native App Check response:', error);
    }
  };
  if (typeof nativeAppCheckBridge.addEventListener === 'function') {
    nativeAppCheckBridge.addEventListener('message', listener);
  } else {
    nativeAppCheckBridge.onmessage = listener;
  }
  nativeAppCheckListenerReady = true;
}

function requestNativeAppCheckToken() {
  ensureNativeAppCheckListener();
  return new Promise((resolve, reject) => {
    if (!nativeAppCheckAvailable()) {
      reject(new Error('Native Android App Check bridge is unavailable.'));
      return;
    }

    const requestId = `ac-${Date.now().toString(36)}-${(++nativeAppCheckRequestCounter).toString(36)}`;
    const timer = setTimeout(() => {
      nativeAppCheckPending.delete(requestId);
      reject(new Error('Native Android App Check timed out.'));
    }, 20_000);
    nativeAppCheckPending.set(requestId, { resolve, reject, timer });

    try {
      nativeAppCheckBridge.postMessage(JSON.stringify({
        action: 'getAppCheckToken',
        requestId,
        forceRefresh: true
      }));
    } catch (error) {
      clearTimeout(timer);
      nativeAppCheckPending.delete(requestId);
      reject(error);
    }
  });
}

try {
  if (nativeAppCheckAvailable()) {
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new CustomProvider({ getToken: requestNativeAppCheckToken }),
      isTokenAutoRefreshEnabled: true
    });
  } else if (siteKey) {
    // Browser/GitHub Pages path keeps the registered Web reCAPTCHA provider.
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } else {
    appCheckError = 'App Check is not configured for this client.';
  }
} catch (error) {
  appCheckError = 'App Check initialization failed.';
  console.error('[NexusNova Fresh] App Check:', error);
}

// Initialize Firebase services after App Check so Firestore can consume the
// native Android token in the WebView shell.
export const firebaseAuth = getAuth(firebaseApp);
export const firestoreDb = getFirestore(firebaseApp);

export function waitForFirebaseUser(timeout = 4200) {
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
  return new Promise(resolve => {
    let settled = false;
    const off = onAuthStateChanged(firebaseAuth, user => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      off();
      resolve(user || null);
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      off();
      resolve(firebaseAuth.currentUser || null);
    }, timeout);
  });
}

export async function requireFreshAppCheck() {
  if (!appCheck) throw new Error(appCheckError || 'App Check is not configured for this fresh build yet.');
  const token = await getToken(appCheck, false);
  if (!token?.token) throw new Error('App Check could not verify this session.');
  return token;
}

export async function requireFirebaseUser({ write = false, verified = false } = {}) {
  let user = await waitForFirebaseUser();
  if (!user) {
    const error = new Error('Please sign in first.');
    error.code = 'auth-required';
    throw error;
  }
  if (write || verified) {
    await user.reload();
    user = firebaseAuth.currentUser || user;
    await user.getIdToken(true);
    if (!user.emailVerified) throw new Error('Verify your email before using secure NVX actions.');
  }
  if (write) await requireFreshAppCheck();
  return user;
}

export async function readUserProfile(user = null) {
  const active = user || await requireFirebaseUser();
  const snap = await getDoc(doc(firestoreDb, 'users', active.uid));
  if (!snap.exists()) throw new Error('User profile not found.');
  return snap.data() || {};
}

function miningActionErrorText(error) {
  const message = String(error?.message || 'Mining action failed.')
    .replace(/^Firebase:\s*/i, '')
    .trim();
  const code = String(error?.code || '').trim();
  return code && !message.includes(code)
    ? `Action blocked: ${message} [${code}]`
    : `Action blocked: ${message}`;
}

function normalize(raw = {}) {
  const balance = Number(raw.balance);
  const totalMined = Number(raw.totalMined);
  const startedAt = Number(raw.miningStartedAt) || 0;
  const active = raw.miningActive === true;
  const elapsed = active && startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;
  return {
    availability: 'ready',
    active,
    startedAt,
    balance: Number.isFinite(balance) && balance >= 0 ? balance : null,
    totalMined: Number.isFinite(totalMined) && totalMined >= 0 ? totalMined : null,
    rate: 1,
    sessionRemainingSeconds: active ? Math.max(0, Math.ceil((DAY - elapsed) / 1000)) : DAY / 1000,
    sessionComplete: active && elapsed >= DAY,
    halvingStage: 1,
    novaVaultPending: Math.max(0, Math.floor(Number(raw.novaVaultPending) || 0)),
    statusText: active ? (elapsed >= DAY ? 'Session complete' : 'Mining active') : 'Ready to mine'
  };
}

async function startFresh(user) {
  const now = Date.now();
  const userRef = doc(firestoreDb, 'users', user.uid);
  return runTransaction(firestoreDb, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User profile not found.');
    const raw = snap.data() || {};
    const state = normalize(raw);
    if (state.balance == null || state.totalMined == null) throw new Error('Account mining values need repair. No balance was changed.');
    if (state.active) return raw;
    if ((Number(raw.miningStartedAt) || 0) !== 0) throw new Error('Mining session state is inconsistent.');
    tx.update(userRef, { miningActive: true, miningStartedAt: now, miningLastUpdate: now });
    return { ...raw, miningActive: true, miningStartedAt: now, miningLastUpdate: now };
  });
}

async function rolloverExpired(user) {
  const now = Date.now();
  const userRef = doc(firestoreDb, 'users', user.uid);
  return runTransaction(firestoreDb, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User profile not found.');
    const raw = snap.data() || {};
    const state = normalize(raw);
    if (state.balance == null || state.totalMined == null) throw new Error('Account mining values need repair. No balance was changed.');
    if (!state.active || state.startedAt <= 0) return raw;
    if (now - state.startedAt < DAY) return raw;

    const nextBalance = state.balance + MINING_REWARD;
    const nextTotal = state.totalMined + MINING_REWARD;
    const nextVaultPending = state.novaVaultPending + 1;

    tx.update(userRef, {
      balance: nextBalance,
      totalMined: nextTotal,
      miningActive: true,
      miningStartedAt: now,
      miningLastUpdate: now,
      novaVaultPending: nextVaultPending
    });

    return {
      ...raw,
      balance: nextBalance,
      totalMined: nextTotal,
      miningActive: true,
      miningStartedAt: now,
      miningLastUpdate: now,
      novaVaultPending: nextVaultPending
    };
  });
}

export const firebaseBackend = {
  async currentUser() {
    return waitForFirebaseUser();
  },

  async getMiningSnapshot() {
    const user = await requireFirebaseUser();
    return normalize(await readUserProfile(user));
  },

  async toggleMining() {
    if (operation) return operation;
    operation = (async () => {
      try {
        const user = await requireFirebaseUser({ write: true });
        const raw = await readUserProfile(user);
        const state = normalize(raw);

        if (state.active && state.sessionComplete) {
          return normalize(await rolloverExpired(user));
        }
        if (!state.active) {
          return normalize(await startFresh(user));
        }
        return state;
      } catch (error) {
        console.error('[NexusNova Fresh] mining action:', error);
        try {
          const user = await requireFirebaseUser();
          const fallback = normalize(await readUserProfile(user));
          return { ...fallback, statusText: miningActionErrorText(error) };
        } catch (_) {
          throw error;
        }
      }
    })().finally(() => { operation = null; });
    return operation;
  },

  subscribeMining(listener) {
    let cancelled = false;
    waitForFirebaseUser().then(user => {
      if (cancelled || !user) return;
      unsubscribe?.();
      unsubscribe = onSnapshot(doc(firestoreDb, 'users', user.uid), snap => {
        if (!snap.exists()) return;
        listener(normalize(snap.data() || {}));
      }, error => console.error('[NexusNova Fresh] mining subscription:', error));
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
      unsubscribe = null;
    };
  }
};
