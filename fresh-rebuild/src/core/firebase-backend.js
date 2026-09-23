// NexusNova production Firebase bridge.
// Restores the real Firebase Auth session and reads the canonical mining
// profile from Firestore. No rewards or balances are invented locally.

import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged, onIdTokenChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { doc, getDoc, getFirestore, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0',
  authDomain: 'nexusnova-6ade2.firebaseapp.com',
  projectId: 'nexusnova-6ade2',
  storageBucket: 'nexusnova-6ade2.firebasestorage.app',
  messagingSenderId: '49791194817',
  appId: '1:49791194817:web:07f28326e0f15979536640',
  measurementId: 'G-YLPFKWSS12'
});

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
export const firestoreDb = getFirestore(app);

const DAY_SECONDS = 86_400;
const EMPTY_SIGNED_OUT = Object.freeze({
  availability: 'unbound',
  active: false,
  startedAt: 0,
  balance: null,
  totalMined: null,
  rate: 1,
  sessionRemainingSeconds: DAY_SECONDS,
  sessionComplete: false,
  halvingStage: 1,
  novaVaultPending: 0,
  statusText: 'Please sign in first.'
});

function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProfile(data) {
  const active = data?.miningActive === true;
  const startedAt = Math.max(0, Math.floor(number(data?.miningStartedAt, 0) || 0));
  const balance = number(data?.balance);
  const totalMined = number(data?.totalMined);
  const pending = Math.max(0, Math.floor(number(data?.novaVaultPending, 0) || 0));
  const remaining = active && startedAt
    ? Math.max(0, Math.ceil((86_400_000 - (Date.now() - startedAt)) / 1000))
    : DAY_SECONDS;

  return {
    availability: 'ready',
    active,
    startedAt,
    balance,
    totalMined,
    rate: 1,
    sessionRemainingSeconds: remaining,
    sessionComplete: active && remaining <= 0,
    halvingStage: 1,
    novaVaultPending: pending,
    statusText: active && remaining > 0
      ? 'Mining active'
      : active
        ? 'Session complete — claim & renew'
        : 'Ready to start 24H mining'
  };
}

export async function waitForFirebaseUser(timeoutMs = 8000) {
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;

  return new Promise(resolve => {
    let settled = false;
    let timer = null;
    const finish = value => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
      resolve(value || null);
    };
    const unsubscribe = onAuthStateChanged(firebaseAuth, next => finish(next));
    timer = setTimeout(() => finish(firebaseAuth.currentUser), Math.max(250, Number(timeoutMs) || 8000));
  });
}

export async function requireFirebaseUser(options = {}) {
  const current = await waitForFirebaseUser(options.timeoutMs ?? 8000);
  if (!current) {
    const error = new Error('Please sign in first.');
    error.code = 'auth/unauthenticated';
    throw error;
  }
  if (options.verified === true && current.emailVerified !== true) {
    const error = new Error('Verify your email before using secure value actions.');
    error.code = 'auth/email-not-verified';
    throw error;
  }
  return current;
}

export async function readUserProfile(uid = null) {
  const current = await requireFirebaseUser();
  const targetUid = String(uid || current.uid);
  if (targetUid !== current.uid) throw new Error('Authenticated account mismatch.');
  const snap = await getDoc(doc(firestoreDb, 'users', targetUid));
  return snap.exists() ? snap.data() : null;
}

export async function getMiningSnapshot() {
  const current = await waitForFirebaseUser();
  if (!current) return { ...EMPTY_SIGNED_OUT };

  try {
    const snap = await getDoc(doc(firestoreDb, 'users', current.uid));
    if (!snap.exists()) {
      return { ...EMPTY_SIGNED_OUT, availability: 'error', statusText: 'NexusNova profile is not ready yet.' };
    }
    return normalizeProfile(snap.data());
  } catch (error) {
    return {
      ...EMPTY_SIGNED_OUT,
      availability: 'error',
      statusText: error?.message || 'Firebase mining profile could not be read.'
    };
  }
}

export function subscribeMining(listener) {
  if (typeof listener !== 'function') return () => {};
  let stopProfile = () => {};

  const stopAuth = onAuthStateChanged(firebaseAuth, next => {
    stopProfile();
    stopProfile = () => {};

    if (!next) {
      listener({ ...EMPTY_SIGNED_OUT });
      return;
    }

    stopProfile = onSnapshot(
      doc(firestoreDb, 'users', next.uid),
      snap => {
        if (!snap.exists()) {
          listener({
            ...EMPTY_SIGNED_OUT,
            availability: 'error',
            statusText: 'NexusNova profile is not ready yet.'
          });
          return;
        }
        listener(normalizeProfile(snap.data()));
      },
      error => listener({
        ...EMPTY_SIGNED_OUT,
        availability: 'error',
        statusText: error?.message || 'Firestore mining sync failed.'
      })
    );
  });

  return () => {
    stopAuth();
    stopProfile();
  };
}

export async function requireFreshAppCheck() {
  // Native Android App Check is initialized by NexusNativeAppCheck. The mining
  // Worker authorizes the mutation with the Firebase ID token.
  return null;
}

export const firebaseBackend = Object.freeze({
  currentUser: () => firebaseAuth.currentUser,
  waitForFirebaseUser,
  requireFirebaseUser,
  readUserProfile,
  getMiningSnapshot,
  subscribeMining,
  async toggleMining() {
    const error = new Error('Use the secure Cloudflare mining action.');
    error.code = 'mining/use-cloudflare';
    throw error;
  }
});
