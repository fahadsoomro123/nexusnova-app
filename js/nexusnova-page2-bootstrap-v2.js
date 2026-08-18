/* NexusNova Dashboard Bootstrap v2
   Runs the existing page2 bootstrap asynchronously so Android WebView can finish
   the document load promptly instead of mistaking a slow Firebase bootstrap for
   a dead page and falling back to the bundled offline mining screen.
   No feature/navigation logic is changed here.
*/
(() => {
  'use strict';
  if (window.__nxPage2BootstrapV2) return;
  window.__nxPage2BootstrapV2 = true;

  void (async () => {
/* NexusNova App Check bootstrap */
const host = String(window.location.hostname || '').toLowerCase();
const referrer = String(document.referrer || '').toLowerCase();

// AdMob UX guard: background preload failures must never interrupt app startup.
// Explicit rewarded requests still flow to their owning feature so it can show
// an inline status or a deliberate user-facing result.
let nxExplicitRewardedRequest = false;
let nxExplicitRewardedStartedAt = 0;
const NX_REWARDED_REQUEST_WINDOW_MS = 70_000;
window.addEventListener('nexusnova:native-ad-event', event => {
  const detail = event?.detail || {};
  if (String(detail.provider || '') !== 'admob') return;
  const type = String(detail.event || '');

  if (type === 'rewarded-preparing' || type === 'rewarded-showing' || type === 'rewarded-opened') {
    nxExplicitRewardedRequest = true;
    nxExplicitRewardedStartedAt = Date.now();
    return;
  }

  const terminalFailure =
    type === 'rewarded-unavailable' ||
    type === 'rewarded-load-failed' ||
    type === 'rewarded-failed';

  if (terminalFailure) {
    const recentExplicitRequest = nxExplicitRewardedRequest &&
      nxExplicitRewardedStartedAt > 0 &&
      Date.now() - nxExplicitRewardedStartedAt <= NX_REWARDED_REQUEST_WINDOW_MS;

    nxExplicitRewardedRequest = false;
    nxExplicitRewardedStartedAt = 0;

    if (!recentExplicitRequest) {
      event.stopImmediatePropagation();
      console.info('NexusNova AdMob preload unavailable; kept silent.', {
        code: detail.code ?? null,
        message: String(detail.message || detail.reason || '')
      });
    }
    return;
  }

  if (type === 'rewarded-earned' || type === 'rewarded-dismissed') {
    nxExplicitRewardedRequest = false;
    nxExplicitRewardedStartedAt = 0;
  }
}, true);

// Development-only App Check debug mode.
// Never enable this on the production GitHub Pages host.
const isNexusNovaDevHost =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host.includes('--3000--') ||
  host.includes('webcontainer') ||
  host.endsWith('.webcontainer.io') ||
  host.endsWith('.webcontainer-api.io') ||
  host.endsWith('.stackblitz.io') ||
  host === 'stackblitz.com' ||
  host.endsWith('.stackblitz.com') ||
  referrer.includes('stackblitz.com');

if (isNexusNovaDevHost) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  console.info('NexusNova App Check: development debug provider enabled.');
}

const meta = document.querySelector('meta[name="nexusnova-app-check-site-key"]');
if (meta) {
  meta.setAttribute('content', '6LfEc4QtAAAAAOohkqSv0p76iwPTeHI98hqVlwIs');
}

// Android resume guard: wait for persisted Auth before page2-core can interpret
// a temporary null user as a real logout.
const nxNativeShell = typeof window.NexusAndroid?.postMessage === 'function';
if (nxNativeShell) {
  try {
    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js')
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
    const timeout = new Promise(resolve => setTimeout(resolve, 3000));

    if (typeof auth.authStateReady === 'function') {
      await Promise.race([auth.authStateReady(), timeout]);
    } else if (!auth.currentUser) {
      await Promise.race([
        new Promise(resolve => {
          let stop = () => {};
          stop = authMod.onAuthStateChanged(auth, () => {
            try { stop(); } catch (_) {}
            resolve();
          });
        }),
        timeout
      ]);
    }
  } catch (error) {
    console.warn('NexusNova Android Auth resume guard:', error);
  }
}

try {
  await import('./nexusnova-daily-ad-test-v1.js?v=5');
} catch (error) {
  console.warn('NexusNova Daily Reward ad gate:', error);
}

await import('./page2-core.js?v=appcheck-debug-10');

try {
  await import('./nexusnova-daily-secure-claim-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova Daily Reward secure claim bridge:', error);
}

try {
  await import('./nexusnova-ad-placements-v1.js?v=3');
} catch (error) {
  console.warn('NexusNova ad placements:', error);
}

try {
  await import('./nexusnova-watch-ad-reward-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova Watch Ad reward:', error);
}

try {
  await import('./nexusnova-ad-privacy-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova ad privacy:', error);
}

if (typeof window.nexusApplySecureAccountState === 'function') {
  const applySecureAccountState = window.nexusApplySecureAccountState;
  window.nexusApplySecureAccountState = function safeNexusApplySecureAccountState(state = {}) {
    try {
      return applySecureAccountState(state);
    } catch (error) {
      console.warn('NexusNova account UI sync was non-fatal:', error);
      return undefined;
    }
  };
}

window.nexusAuthFreshReady = (async () => {
  try {
    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js')
    ]);
    const apps = appMod.getApps();
    if (!apps.length) return null;
    const auth = authMod.getAuth(apps[0]);

    let user = auth.currentUser;
    if (!user) {
      user = await new Promise(resolve => {
        let settled = false;
        const unsubscribe = authMod.onAuthStateChanged(auth, value => {
          if (settled) return;
          settled = true;
          unsubscribe();
          resolve(value || null);
        });
        setTimeout(() => {
          if (settled) return;
          settled = true;
          unsubscribe();
          resolve(auth.currentUser || null);
        }, 2500);
      });
    }

    if (!user) return null;
    await user.reload();
    user = auth.currentUser || user;
    await user.getIdToken(true);
    console.info('NexusNova Auth: verification claims refreshed.', {
      emailVerified: Boolean(user.emailVerified)
    });
    return user;
  } catch (error) {
    console.warn('NexusNova Auth refresh:', error);
    return null;
  }
})();

try {
  await import('./nexusnova-navigation-stability-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova navigation stability:', error);
}

try {
  await import('./nexusnova-allapps-scroll-fix-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova ALL APPS scroll fix:', error);
}

// Direct Settings injection as a second safe path. The module is idempotent, so
// the existing late loader can still import it without creating a duplicate.
try {
  await import('./nexusnova-account-deletion-settings-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova account deletion Settings option:', error);
}
  })().catch(error => {
    console.error('NexusNova dashboard bootstrap failed:', error);
    window.dispatchEvent(new CustomEvent('nexusnova:dashboard-bootstrap-failed', { detail: { message: String(error?.message || error || '') } }));
  });
})();
