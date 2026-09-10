// NexusNova public-mirror Firebase stub.
// Real Firebase/App Check configuration is private and must only be used from
// the private repository / laptop QA route. This file intentionally contains
// no live API keys or backend credentials.

const PUBLIC_DISABLED_ERROR = 'Firebase-backed features are disabled in the sanitized public build.';

export const firebaseConfig = Object.freeze({
  apiKey: 'PUBLIC_BUILD_FIREBASE_DISABLED',
  authDomain: 'nexusnova-6ade2.firebaseapp.com',
  projectId: 'nexusnova-6ade2',
  storageBucket: 'nexusnova-6ade2.firebasestorage.app',
  messagingSenderId: '49791194817',
  appId: '1:49791194817:web:07f28326e0f15979536640',
  measurementId: 'G-YLPFKWSS12'
});

export const firebaseApp = null;
export const firebaseAuth = Object.freeze({ currentUser: null });
export const firestoreDb = null;

export function waitForFirebaseUser() {
  return Promise.resolve(null);
}

export async function requireFreshAppCheck() {
  throw new Error(PUBLIC_DISABLED_ERROR);
}

export async function requireFirebaseUser() {
  const error = new Error(PUBLIC_DISABLED_ERROR);
  error.code = 'public-build-firebase-disabled';
  throw error;
}

export async function readUserProfile() {
  throw new Error(PUBLIC_DISABLED_ERROR);
}

const unavailableState = Object.freeze({
  availability: 'unavailable',
  active: false,
  startedAt: 0,
  balance: null,
  totalMined: null,
  rate: 1,
  sessionRemainingSeconds: 86400,
  sessionComplete: false,
  halvingStage: 1,
  novaVaultPending: 0,
  statusText: 'Secure Firebase features require the private/laptop build.'
});

export const firebaseBackend = {
  async currentUser() {
    return null;
  },

  async getMiningSnapshot() {
    return { ...unavailableState };
  },

  async toggleMining() {
    throw new Error(PUBLIC_DISABLED_ERROR);
  },

  subscribeMining(listener) {
    try { listener?.({ ...unavailableState }); } catch (_) {}
    return () => {};
  }
};
