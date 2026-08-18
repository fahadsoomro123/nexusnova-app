/* NexusNova Auth Page v2
   Non-blocking Firebase/Auth controller for the public login/signup page.
   It keeps Android page-load completion independent from optional network delay,
   restores existing sessions before showing auth, and preserves the existing
   Firestore user profile contract.
*/
const FIREBASE_VERSION = '12.1.0';

const [appMod, authMod, fsMod, appCheckMod] = await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
  import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-check.js`)
]);

const firebaseConfig = {
  apiKey: 'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0',
  authDomain: 'nexusnova-6ade2.firebaseapp.com',
  projectId: 'nexusnova-6ade2',
  storageBucket: 'nexusnova-6ade2.firebasestorage.app',
  messagingSenderId: '49791194817',
  appId: '1:49791194817:web:07f28326e0f15979536640',
  measurementId: 'G-YLPFKWSS12'
};

const app = appMod.getApps().find(item => item?.name === '[DEFAULT]') || appMod.initializeApp(firebaseConfig);
const auth = authMod.getAuth(app);
const db = fsMod.getFirestore(app);

const siteKey = String(document.querySelector('meta[name="nexusnova-app-check-site-key"]')?.content || '').trim();
if (siteKey) {
  try {
    appCheckMod.initializeAppCheck(app, {
      provider: new appCheckMod.ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    if (!String(error?.code || '').includes('already')) {
      console.warn('NexusNova Auth App Check:', error);
    }
  }
}

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authBtn = document.getElementById('authBtn');
const googleBtn = document.getElementById('googleLoginBtn');
const googleArea = document.getElementById('googleArea');
const toggleBtn = document.getElementById('toggleBtn');
const forgotBtn = document.getElementById('forgotPasswordBtn');
const title = document.getElementById('authTitle');
const subtitle = document.getElementById('authSubtitle');
const message = document.getElementById('message');
const authShell = document.getElementById('authShell');

let loginMode = false;
let authActionInProgress = false;
let redirected = false;
const nativeShell = typeof window.NexusAndroid?.postMessage === 'function';

function setMessage(text = '', success = false) {
  message.textContent = String(text || '');
  message.dataset.kind = success ? 'success' : (text ? 'error' : '');
}

function setBusy(busy, label = '') {
  authBtn.disabled = Boolean(busy);
  toggleBtn.setAttribute('aria-disabled', busy ? 'true' : 'false');
  forgotBtn.disabled = Boolean(busy);
  if (!nativeShell) googleBtn.disabled = Boolean(busy);
  if (label) authBtn.textContent = label;
}

function authButtonLabel() {
  return loginMode ? 'Log in with Email' : 'Create NexusNova Account';
}

function applyMode(nextLoginMode) {
  loginMode = Boolean(nextLoginMode);
  setMessage('');
  passwordInput.value = '';
  passwordInput.autocomplete = loginMode ? 'current-password' : 'new-password';
  passwordInput.placeholder = loginMode ? 'Your password' : 'Minimum 10 characters';
  title.textContent = loginMode ? 'Welcome Back' : 'Create Account';
  subtitle.textContent = loginMode
    ? 'Log in to continue to your secure NexusNova workspace.'
    : 'Join NexusNova with email. Verify your email before using rewards.';
  authBtn.textContent = authButtonLabel();
  toggleBtn.textContent = loginMode
    ? "Don't have an account? Sign up"
    : 'Already have an account? Log in';
  forgotBtn.hidden = !loginMode;
}

function redirectToDashboard() {
  if (redirected) return;
  redirected = true;
  document.documentElement.classList.add('nx-auth-redirecting');
  window.location.replace('./page2.html');
}

async function createUserProfile(user) {
  const ref = fsMod.doc(db, 'users', user.uid);
  const snap = await fsMod.getDoc(ref);
  if (snap.exists()) return;

  const name = String(user.displayName || 'Miner User').trim().slice(0, 80) || 'Miner User';
  const email = String(user.email || '').trim().slice(0, 320);
  await fsMod.setDoc(ref, {
    uid: user.uid,
    name,
    email,
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
    createdAt: fsMod.serverTimestamp()
  });
}

function readableAuthError(error) {
  switch (String(error?.code || '')) {
    case 'auth/email-already-in-use':
      return 'Unable to create this account. Try Login if you may already have an account.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'New passwords must contain at least 10 characters.';
    case 'auth/network-request-failed':
      return 'Internet connection problem. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a little and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Google sign-in popup was blocked by the browser.';
    case 'auth/unauthorized-domain':
      return 'Google sign-in is not enabled for this web address yet. Use email sign-in.';
    default:
      return String(error?.message || 'Something went wrong. Please try again.');
  }
}

async function emailAuth() {
  if (authActionInProgress) return;
  const email = String(emailInput.value || '').trim();
  const password = String(passwordInput.value || '');

  if (!email || !password) {
    setMessage('Please enter your email and password.');
    return;
  }
  if (!loginMode && password.length < 10) {
    setMessage('New passwords must contain at least 10 characters.');
    passwordInput.focus();
    return;
  }

  authActionInProgress = true;
  setBusy(true, loginMode ? 'Logging in…' : 'Creating account…');
  setMessage('');

  try {
    let user;
    if (loginMode) {
      const result = await authMod.signInWithEmailAndPassword(auth, email, password);
      user = result.user;
      await createUserProfile(user);
      setMessage('Login successful. Opening NexusNova…', true);
    } else {
      const result = await authMod.createUserWithEmailAndPassword(auth, email, password);
      user = result.user;
      await createUserProfile(user);
      try {
        await authMod.sendEmailVerification(user);
        setMessage('Account created. Verification email sent. Opening NexusNova…', true);
      } catch (verificationError) {
        console.warn('NexusNova verification email:', verificationError);
        setMessage('Account created. Open Settings later to resend email verification. Opening NexusNova…', true);
      }
    }
    window.setTimeout(redirectToDashboard, 180);
  } catch (error) {
    console.error('NexusNova email auth:', error);
    authActionInProgress = false;
    setBusy(false);
    authBtn.textContent = authButtonLabel();
    setMessage(readableAuthError(error));
  }
}

async function resetPassword() {
  if (authActionInProgress) return;
  const email = String(emailInput.value || '').trim();
  if (!email) {
    setMessage('Enter your email first, then tap Forgot password.');
    emailInput.focus();
    return;
  }

  authActionInProgress = true;
  forgotBtn.disabled = true;
  setMessage('Sending password reset email…', true);
  try {
    await authMod.sendPasswordResetEmail(auth, email);
    setMessage('Password reset email sent. Check your inbox.', true);
  } catch (error) {
    setMessage(readableAuthError(error));
  } finally {
    authActionInProgress = false;
    forgotBtn.disabled = false;
  }
}

async function googleAuth() {
  if (nativeShell) {
    setMessage('For this Android build, use Email sign-up/login. Google sign-in needs a native browser handoff in a future APK.');
    return;
  }
  if (authActionInProgress) return;

  authActionInProgress = true;
  googleBtn.disabled = true;
  setMessage('Connecting to Google…', true);
  try {
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await authMod.signInWithPopup(auth, provider);
    await createUserProfile(result.user);
    setMessage('Google login successful. Opening NexusNova…', true);
    window.setTimeout(redirectToDashboard, 180);
  } catch (error) {
    console.error('NexusNova Google auth:', error);
    authActionInProgress = false;
    googleBtn.disabled = false;
    setMessage(readableAuthError(error));
  }
}

function handleEnter(event) {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  void emailAuth();
}

authBtn.addEventListener('click', () => void emailAuth());
toggleBtn.addEventListener('click', () => {
  if (authActionInProgress) return;
  applyMode(!loginMode);
});
toggleBtn.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && !authActionInProgress) {
    event.preventDefault();
    applyMode(!loginMode);
  }
});
forgotBtn.addEventListener('click', () => void resetPassword());
googleBtn.addEventListener('click', () => void googleAuth());
emailInput.addEventListener('keydown', handleEnter);
passwordInput.addEventListener('keydown', handleEnter);

if (nativeShell) {
  googleArea.hidden = true;
}

applyMode(false);

// Restore Firebase persistence before exposing the form. If the account is
// already signed in, skip the login screen instead of flashing it and bouncing.
try {
  if (typeof auth.authStateReady === 'function') {
    await Promise.race([auth.authStateReady(), new Promise(resolve => setTimeout(resolve, 5000))]);
  } else {
    await new Promise(resolve => {
      let settled = false;
      const stop = authMod.onAuthStateChanged(auth, () => {
        if (settled) return;
        settled = true;
        stop();
        resolve();
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        stop();
        resolve();
      }, 5000);
    });
  }
} catch (error) {
  console.warn('NexusNova auth restore:', error);
}

if (auth.currentUser && !authActionInProgress) {
  redirectToDashboard();
} else {
  authShell.classList.add('ready');
  window.dispatchEvent(new Event('nexusnova:auth-bootstrap-ready'));
}

authMod.onAuthStateChanged(auth, user => {
  if (user && !authActionInProgress) {
    redirectToDashboard();
    return;
  }
  if (!user && nativeShell) {
    try {
      window.NexusAndroid.postMessage(JSON.stringify({ action: 'clearActiveAccount' }));
    } catch (_) {}
  }
});
