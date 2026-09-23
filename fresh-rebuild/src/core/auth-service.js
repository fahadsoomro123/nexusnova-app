import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseAuth, firestoreDb } from './firebase-backend.js';

const PROFILE_DEFAULTS = Object.freeze({
  balance: 0,
  totalMined: 0,
  tasksCompleted: 0,
  completedTasks: {},
  miningActive: false,
  miningStartedAt: 0,
  miningLastUpdate: 0,
  sessionEarned: 0,
  lastDailyReward: 0,
  dailyRewardStreak: 0
});

let currentUser = firebaseAuth.currentUser || null;
const listeners = new Set();

async function ensureProfile(user, name = '') {
  const ref = doc(firestoreDb, 'users', user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const profileName = String(name || user.displayName || user.email?.split('@')[0] || 'Miner User')
    .trim().slice(0, 80) || 'Miner User';
  const profileEmail = String(user.email || '').trim().slice(0, 320);

  await setDoc(ref, {
    uid: user.uid,
    name: profileName,
    email: profileEmail,
    ...PROFILE_DEFAULTS,
    createdAt: serverTimestamp()
  });

  return (await getDoc(ref)).data();
}

onIdTokenChanged(firebaseAuth, user => {
  currentUser = user || null;
  listeners.forEach(listener => {
    try { listener(currentUser); } catch {}
  });
});

export const authService = {
  get currentUser() {
    return currentUser || firebaseAuth.currentUser || null;
  },

  waitForUser(timeoutMs = 8000) {
    const existing = firebaseAuth.currentUser;
    if (existing) {
      currentUser = existing;
      return Promise.resolve(existing);
    }

    return new Promise(resolve => {
      let done = false;
      let timer = null;
      const finish = value => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        unsubscribe?.();
        resolve(value || null);
      };
      const unsubscribe = onIdTokenChanged(firebaseAuth, user => finish(user));
      timer = setTimeout(() => finish(firebaseAuth.currentUser), Math.max(250, Number(timeoutMs) || 8000));
    });
  },

  onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    queueMicrotask(() => {
      try { listener(this.currentUser); } catch {}
    });
    return () => listeners.delete(listener);
  },

  async signIn(email, password) {
    const result = await signInWithEmailAndPassword(
      firebaseAuth,
      String(email || '').trim(),
      String(password || '')
    );
    currentUser = result.user;
    await ensureProfile(result.user);
    return result.user;
  },

  async register({ name, email, password } = {}) {
    const result = await createUserWithEmailAndPassword(
      firebaseAuth,
      String(email || '').trim(),
      String(password || '')
    );
    currentUser = result.user;

    if (name) {
      await updateProfile(result.user, { displayName: String(name).trim().slice(0, 80) });
    }

    try {
      await sendEmailVerification(result.user);
    } catch (error) {
      console.warn('[NexusNova] verification email:', error);
    }

    await ensureProfile(result.user, name);
    return result.user;
  },

  async resendVerification() {
    const user = await this.waitForUser();
    if (!user) throw new Error('Please sign in first.');
    await sendEmailVerification(user);
  },

  async logout() {
    await signOut(firebaseAuth);
    currentUser = null;
  }
};
