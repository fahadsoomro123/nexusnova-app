/* NexusNova Daily Reward secure claim bridge v1
   One narrow, server-authoritative bridge used by the Android Daily Ad gate.

   Security contract:
   - Never writes balance from the browser.
   - Refreshes Firebase Auth before a value-bearing claim.
   - Requires App Check before calling the protected Cloud Function.
   - Propagates failures to the ad gate so UI never reports +5 NVX on failure.
*/
(() => {
  'use strict';
  if (window.__nxDailySecureClaimV1) return;
  window.__nxDailySecureClaimV1 = true;

  let claimPromise = null;

  async function firebaseContext() {
    const [appMod, authMod, fnMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js')
    ]);

    const app = appMod.getApps()[0];
    if (!app) throw new Error('NexusNova account is not ready yet.');

    const auth = authMod.getAuth(app);
    let user = auth.currentUser;
    if (!user) throw new Error('Please sign in first.');

    await user.reload();
    user = auth.currentUser || user;
    await user.getIdToken(true);
    if (!user.emailVerified) {
      throw new Error('Verify your email before claiming NVX rewards.');
    }

    if (typeof window.nexusRequireAppCheck !== 'function') {
      throw new Error('Firebase App Check is unavailable.');
    }
    await window.nexusRequireAppCheck();

    return {
      user,
      callable: fnMod.httpsCallable(fnMod.getFunctions(app, 'us-central1'), 'claimDailyReward')
    };
  }

  async function claimDailySecure() {
    if (claimPromise) return claimPromise;

    claimPromise = (async () => {
      const { callable } = await firebaseContext();
      const response = await callable({ source: 'android-daily-ad-gate-v1' });
      const result = response?.data || {};

      if (result.claimed !== true) {
        throw new Error('Daily Reward was not confirmed by the secure server.');
      }

      const reward = Number(result.reward);
      const balance = Number(result.balance);
      if (!Number.isFinite(reward) || reward <= 0 || !Number.isFinite(balance) || balance < 0) {
        throw new Error('Daily Reward server response was invalid.');
      }

      try {
        window.nexusApplySecureAccountState?.({
          balance,
          streak: Number(result.streak),
          lastDailyReward: Number(result.lastDailyReward)
        });
      } catch (error) {
        console.warn('NexusNova Daily Reward non-fatal UI sync:', error);
      }

      try { window.updateDailyButton?.(); } catch (_) {}
      return result;
    })().finally(() => {
      claimPromise = null;
    });

    return claimPromise;
  }

  window.nexusSecureClaimDaily = claimDailySecure;
  window.__nxDailySecureClaimVersion = 'daily-secure-claim-v1';
  console.info('NexusNova Daily Reward secure claim bridge loaded: v1');
})();
