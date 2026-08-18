/* NexusNova page2 after-core v2
   Optional/secondary modules run after Firebase/Auth core is installed. This is
   detached from the native page-load critical path so slow optional networks do
   not trigger Android's stale/offline fallback.
*/
(() => {
  'use strict';
  if (window.__nxPage2AfterCoreV2) return;
  window.__nxPage2AfterCoreV2 = true;

  void (async () => {
    // AdMob UX guard: background preload failures remain silent; explicit user
    // requests keep their existing feature-owned feedback.
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

    // Wait for the existing Nova Hub visual owner before revealing the dashboard.
    // This does not change Nova Hub code; it only avoids exposing the legacy dock
    // during startup while that already-approved module is still downloading.
    try {
      await import('./nexusnova-nova-hub-nav-v1.js?v=1');
    } catch (error) {
      console.warn('NexusNova Nova Hub navigation readiness:', error);
    }

    try {
      await import('./nexusnova-account-deletion-settings-v1.js?v=2');
    } catch (error) {
      console.warn('NexusNova account deletion Settings option:', error);
    }

    window.__nxPage2AfterCoreReadyV2 = true;
    window.dispatchEvent(new Event('nexusnova:after-core-ready'));
  })().catch(error => {
    console.error('NexusNova after-core bootstrap failed:', error);
    window.dispatchEvent(new CustomEvent('nexusnova:dashboard-bootstrap-failed', {
      detail: { message: String(error?.message || error || '') }
    }));
  });
})();
