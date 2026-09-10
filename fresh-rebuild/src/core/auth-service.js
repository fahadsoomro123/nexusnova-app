// NexusNova public-mirror auth shim.
// The public build has no live Firebase keys, so QA uses a local session only.

const SESSION_KEY = 'nexusnova_public_qa_user_v1';
const DEFAULT_EMAIL = 'qa@nexusnova.local';

let currentUser = readSession();
const listeners = new Set();

function safeJson(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function readSession() {
  const saved = safeJson(localStorage.getItem(SESSION_KEY));
  if (saved?.uid) return userFrom(saved);
  return null;
}

function userFrom(raw = {}) {
  const email = String(raw.email || DEFAULT_EMAIL).trim() || DEFAULT_EMAIL;
  const name = String(raw.displayName || raw.name || email.split('@')[0] || 'NexusNova QA').trim();
  return {
    uid: String(raw.uid || `public-qa-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).slice(0, 96),
    email,
    displayName: name,
    emailVerified: true,
    isAnonymous: false,
    providerId: 'public-qa-local',
    async reload() { return undefined; },
    toJSON() { return { uid:this.uid, email:this.email, displayName:this.displayName, emailVerified:true }; }
  };
}

function save(user) {
  currentUser = user;
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user.toJSON()));
  else localStorage.removeItem(SESSION_KEY);
  queueMicrotask(() => listeners.forEach(listener => {
    try { listener(currentUser); } catch {}
  }));
  return user;
}

function credentialsUser(email, name) {
  return userFrom({
    email: String(email || DEFAULT_EMAIL).trim() || DEFAULT_EMAIL,
    displayName: String(name || '').trim()
  });
}

export const authService = {
  get currentUser() { return currentUser; },

  waitForUser() {
    return Promise.resolve(currentUser);
  },

  onChange(listener) {
    listeners.add(listener);
    queueMicrotask(() => {
      try { listener?.(currentUser); } catch {}
    });
    return () => listeners.delete(listener);
  },

  async signIn(email) {
    return save(credentialsUser(email));
  },

  async register({ name, email } = {}) {
    return save(credentialsUser(email, name));
  },

  async resendVerification() {
    return undefined;
  },

  async logout() {
    save(null);
  }
};
