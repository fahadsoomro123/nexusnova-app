/* NexusNova App Check bootstrap */
const host = String(window.location.hostname || '').toLowerCase();
const referrer = String(document.referrer || '').toLowerCase();

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

await import('./page2-core.js?v=appcheck-debug-8');

// A secure mining transaction must not be reported as failed just because a
// secondary/profile UI refresh throws afterwards. The secure rewards layer
// calls this helper only after Firestore has accepted the mining transition.
// Keep those presentation errors non-fatal so an accepted session stays ON.
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

// Firebase Auth can keep an ID token that was minted before the user verified
// their email. Firestore Security Rules read the token claim, not only the
// client-side user.emailVerified property. Refresh both the user record and
// the ID token once on app startup so secure mining sees the new claim without
// requiring a logout/login cycle.
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

// Mining self-heal v2 owns legacy-session recovery and the final Mine button
// handler. It refreshes auth inside the write path and uses normal finish then
// start transactions, so users never have to edit Firebase fields manually.
import('./mining-session-recovery-v2.js?v=2').catch(error => {
  console.warn('NexusNova mining self-heal module:', error);
});
