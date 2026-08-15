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
      // Background preload/no-fill is expected to be retryable and must remain silent.
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

// Load the Android Daily Reward ad gate before page2-core. page2-core loads the
// legacy rewarded/mining compatibility stack, so registering the Daily capture
// listener first guarantees that a Daily ad result belongs only to Daily Reward.
try {
  await import('./nexusnova-daily-ad-test-v1.js?v=5');
} catch (error) {
  console.warn('NexusNova Daily Reward ad gate:', error);
}

await import('./page2-core.js?v=appcheck-debug-10');

// The Daily Ad gate deliberately does not write NVX itself. This bridge exposes
// one protected callable that returns/rethrows the authoritative +5 NVX result.
try {
  await import('./nexusnova-daily-secure-claim-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova Daily Reward secure claim bridge:', error);
}

// Central monetization controller. It owns frequency caps and protected-screen
// exclusions while the proven native v60+ ad owner remains unchanged.
try {
  await import('./nexusnova-ad-placements-v1.js?v=3');
} catch (error) {
  console.warn('NexusNova ad placements:', error);
}

// Secure Watch Ad +2.5 NVX controller. Older APKs are capability-gated and
// production is held until the signed SSV endpoint is actually deployed.
try {
  await import('./nexusnova-watch-ad-reward-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova Watch Ad reward:', error);
}

// Google UMP privacy choices entry point. It stays hidden unless native UMP says
// a publisher-rendered privacy-options control is required for this user.
try {
  await import('./nexusnova-ad-privacy-v1.js?v=1');
} catch (error) {
  console.warn('NexusNova ad privacy:', error);
}

// A secure account transaction must not be reported as failed merely because a
// secondary/profile renderer throws afterwards.
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

// Keep Auth verification claims fresh for all value-bearing features. The
// mining engine also refreshes again immediately before every mining write, so
// there is no race with a token minted before email verification.
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
