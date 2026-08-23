import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

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

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function ensureProfile(user, requestedName = '') {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const name = cleanName(requestedName || user.displayName || user.email?.split('@')[0] || 'NexusNova User');
  const profile = {
    uid: user.uid,
    name,
    email: String(user.email || '').slice(0, 320),
    balance: 0,
    totalMined: 0,
    tasksCompleted: 0,
    completedTasks: {},
    miningActive: false,
    miningStartedAt: 0,
    miningLastUpdate: 0,
    sessionEarned: 0,
    lastDailyReward: 0,
    dailyRewardStreak: 0,
    createdAt: serverTimestamp()
  };
  await setDoc(ref, profile);
  return profile;
}

export const authService = {
  get currentUser() { return auth.currentUser; },

  waitForUser(timeout = 5000) {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise(resolve => {
      let done = false;
      const off = onAuthStateChanged(auth, user => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        off();
        resolve(user || null);
      });
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        off();
        resolve(auth.currentUser || null);
      }, timeout);
    });
  },

  onChange(listener) {
    return onAuthStateChanged(auth, listener);
  },

  async signIn(email, password) {
    const credential = await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    await ensureProfile(credential.user);
    return credential.user;
  },

  async register({ name, email, password }) {
    const safeName = cleanName(name);
    if (!safeName) throw new Error('Enter your name.');
    const credential = await createUserWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    await updateProfile(credential.user, { displayName: safeName });
    await ensureProfile(credential.user, safeName);
    await sendEmailVerification(credential.user);
    return credential.user;
  },

  async resendVerification() {
    if (!auth.currentUser) throw new Error('Sign in first.');
    await sendEmailVerification(auth.currentUser);
  },

  async logout() {
    await signOut(auth);
  }
};
