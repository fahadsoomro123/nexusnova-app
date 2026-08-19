import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app-check.js';

const DAY = 86_400_000;
const MINING_REWARD = 24;
const firebaseConfig = {
  apiKey: 'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0',
  authDomain: 'nexusnova-6ade2.firebaseapp.com',
  projectId: 'nexusnova-6ade2',
  storageBucket: 'nexusnova-6ade2.firebasestorage.app',
  messagingSenderId: '49791194817',
  appId: '1:49791194817:web:07f28326e0f15979536640',
  measurementId: 'G-YLPFKWSS12'
};

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let appCheck = null;
let appCheckError = '';
let unsubscribe = null;
let operation = null;

const siteKey = String(document.querySelector('meta[name="nexusnova-app-check-site-key"]')?.content || '').trim();
if (siteKey) {
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    appCheckError = 'App Check initialization failed.';
    console.error('[NexusNova Fresh] App Check:', error);
  }
}

function waitForUser(timeout = 4200) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise(resolve => {
    let settled = false;
    const off = onAuthStateChanged(auth, user => {
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
      resolve(auth.currentUser || null);
    }, timeout);
  });
}

async function requireUser({ write = false } = {}) {
  let user = await waitForUser();
  if (!user) {
    const error = new Error('Please sign in first.');
    error.code = 'auth-required';
    throw error;
  }
  if (write) {
    await user.reload();
    user = auth.currentUser || user;
    await user.getIdToken(true);
    if (!user.emailVerified) throw new Error('Verify your email before using NVX mining.');
    if (!appCheck) throw new Error(appCheckError || 'App Check is not configured for this fresh build yet.');
    const token = await getToken(appCheck, false);
    if (!token?.token) throw new Error('App Check could not verify this session.');
  }
  return user;
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

async function readRaw(user) {
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) throw new Error('User profile not found.');
  return snap.data() || {};
}

async function startFresh(user) {
  const now = Date.now();
  const userRef = doc(db, 'users', user.uid);
  return runTransaction(db, async tx => {
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

async function finishExpired(user) {
  const now = Date.now();
  const userRef = doc(db, 'users', user.uid);
  return runTransaction(db, async tx => {
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
      miningActive: false,
      miningStartedAt: 0,
      miningLastUpdate: now,
      novaVaultPending: nextVaultPending
    });
    return {
      ...raw,
      balance: nextBalance,
      totalMined: nextTotal,
      miningActive: false,
      miningStartedAt: 0,
      miningLastUpdate: now,
      novaVaultPending: nextVaultPending
    };
  });
}

export const firebaseBackend = {
  async currentUser() {
    return waitForUser();
  },

  async getMiningSnapshot() {
    const user = await requireUser({ write: false });
    return normalize(await readRaw(user));
  },

  async toggleMining() {
    if (operation) return operation;
    operation = (async () => {
      const user = await requireUser({ write: true });
      let raw = await readRaw(user);
      let state = normalize(raw);
      if (state.active && state.sessionComplete) {
        raw = await finishExpired(user);
        state = normalize(raw);
      }
      if (!state.active) raw = await startFresh(user);
      return normalize(raw);
    })().finally(() => { operation = null; });
    return operation;
  },

  subscribeMining(listener) {
    let cancelled = false;
    waitForUser().then(user => {
      if (cancelled || !user) return;
      unsubscribe?.();
      unsubscribe = onSnapshot(doc(db, 'users', user.uid), snap => {
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
