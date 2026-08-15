/* NexusNova Watch Ad Reward v1
   Secure +2.5 NVX rewarded-ad UX.

   Security contract:
   - Web/native earned callbacks never credit NVX.
   - Production credit arrives only from Google's signed AdMob SSV callback.
   - The Firebase UID is attached as SSV user_id; task-watch-ad is custom_data.
   - Older APKs are blocked by the ssvIdentityReady capability handshake.
   - Debug/test ads prove UX but never credit +2.5 NVX.
   - Production +2.5 stays disabled until the signed SSV endpoint is deployed.
*/
(() => {
  'use strict';
  if (window.__nxWatchAdRewardV1) return;
  window.__nxWatchAdRewardV1 = true;

  const PURPOSE = 'task-watch-ad';
  const REWARD_NVX = 2.5;
  const PRODUCTION_SSV_ENABLED = false;
  const HINT_ID = 'nxWatchAdRewardHint';
  const BUTTON_ID = 'nxWatchAdRewardBtn';

  let capabilityReady = false;
  let nativeTestMode = true;
  let pending = false;
  let earned = false;
  let baselineBalance = null;
  let activeUid = '';
  let verifyTimer = null;

  function button() {
    let btn = document.getElementById(BUTTON_ID);
    if (btn) return btn;
    btn = [...document.querySelectorAll('button')].find(el =>
      /watchAdReward\s*\(/i.test(String(el.getAttribute('onclick') || ''))
    ) || null;
    if (btn) btn.id = BUTTON_ID;
    return btn;
  }

  function hint() {
    const btn = button();
    if (!btn) return null;
    let el = document.getElementById(HINT_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = HINT_ID;
      el.setAttribute('role', 'status');
      el.style.marginTop = '8px';
      el.style.fontSize = '11px';
      el.style.lineHeight = '1.45';
      el.style.textAlign = 'center';
      el.style.color = '#8fb8e8';
      btn.insertAdjacentElement('afterend', el);
    }
    return el;
  }

  function setHint(text, tone = 'normal') {
    const el = hint();
    if (!el) return;
    el.textContent = String(text || '');
    el.style.color = tone === 'error'
      ? '#ffb4b4'
      : tone === 'success'
        ? '#7ee7c4'
        : '#8fb8e8';
  }

  function decorate() {
    const btn = button();
    if (!btn) return;
    btn.dataset.nxWatchAdSsv = capabilityReady ? 'ready' : 'waiting';
    if (pending) {
      btn.disabled = true;
      setHint('Rewarded ad in progress…');
      return;
    }
    if (!capabilityReady) {
      btn.disabled = false;
      setHint('Secure +2.5 NVX ad reward needs the latest NexusNova Android build.');
      return;
    }
    if (!nativeTestMode && !PRODUCTION_SSV_ENABLED) {
      btn.disabled = true;
      setHint('Secure +2.5 NVX reward activation is pending server deployment. No live ad will be requested yet.');
      return;
    }
    btn.disabled = false;
    setHint(nativeTestMode
      ? 'AdMob TEST MODE • test ads never add +2.5 NVX.'
      : 'Watch the full rewarded ad • Google server verification adds +2.5 NVX.');
  }

  function postStatusRequest() {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        window.nexusPostNativeAction('adStatus', {});
        return;
      }
      window.NexusAndroid?.postMessage?.(JSON.stringify({ action:'adStatus' }));
    } catch (_) {}
  }

  async function authContext() {
    const [appMod, authMod, storeMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
    ]);
    const app = appMod.getApps()[0];
    if (!app) throw new Error('NexusNova account is not ready yet.');
    const auth = authMod.getAuth(app);
    let user = auth.currentUser;
    if (!user) throw new Error('Please sign in first.');
    await user.reload();
    user = auth.currentUser || user;
    await user.getIdToken(true);
    if (!user.emailVerified) throw new Error('Verify your email before earning NVX rewards.');

    const db = storeMod.getFirestore(app);
    const ref = storeMod.doc(db, 'users', user.uid);
    const snap = await storeMod.getDoc(ref);
    const balance = Number(snap.data()?.balance);
    return {
      user,
      db,
      ref,
      storeMod,
      balance: Number.isFinite(balance) ? balance : null
    };
  }

  async function waitForServerCredit() {
    clearTimeout(verifyTimer);
    if (!activeUid || baselineBalance === null) {
      setHint('Ad completed • Google server verification is processing the +2.5 NVX reward.');
      return;
    }

    const started = Date.now();
    const maxWait = 35_000;
    const poll = async () => {
      try {
        const ctx = await authContext();
        if (ctx.user.uid !== activeUid) return;
        const current = ctx.balance;
        if (Number.isFinite(current) && current >= baselineBalance + REWARD_NVX - 1e-9) {
          setHint(`✓ +${REWARD_NVX} NVX verified by server and added.`, 'success');
          try { window.nexusApplySecureAccountState?.({ balance: current }); } catch (_) {}
          return;
        }
      } catch (_) {}

      if (Date.now() - started < maxWait) {
        verifyTimer = setTimeout(poll, 2200);
      } else {
        setHint('Ad completed • secure server verification is still pending; balance will update automatically.');
      }
    };
    verifyTimer = setTimeout(poll, 1400);
  }

  window.watchAdReward = async function watchAdRewardSecure() {
    if (pending) return;

    if (!capabilityReady) {
      postStatusRequest();
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!capabilityReady) {
        setHint('This installed APK does not support secure AdMob reward identity yet. No NVX was changed.', 'error');
        return;
      }
    }

    if (!nativeTestMode && !PRODUCTION_SSV_ENABLED) {
      setHint('Secure +2.5 NVX reward is not live until the signed SSV server is deployed. No live ad was requested.', 'error');
      return;
    }

    if (!window.NexusNovaAds?.requestRewarded) {
      setHint('Rewarded ad service is still loading. Try again in a moment.', 'error');
      return;
    }

    let ctx;
    try {
      ctx = await authContext();
    } catch (error) {
      setHint(error?.message || 'Account verification is required.', 'error');
      return;
    }

    activeUid = ctx.user.uid;
    baselineBalance = ctx.balance;
    pending = true;
    earned = false;
    decorate();

    const result = window.NexusNovaAds.requestRewarded(PURPOSE, { userId: activeUid });
    if (!result?.shown) {
      pending = false;
      setHint('Rewarded ad is not ready yet. No NVX was changed.', 'error');
      decorate();
    }
  };

  window.addEventListener('nexusnova:native-ad-event', event => {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;

    if (String(detail.event || '') === 'status') {
      capabilityReady = detail.ssvIdentityReady === true;
      if (typeof detail.testMode === 'boolean') nativeTestMode = detail.testMode;
      decorate();
      return;
    }

    const purpose = String(detail.rewardPurpose || '');
    if (purpose !== PURPOSE) return;
    if (typeof detail.testMode === 'boolean') nativeTestMode = detail.testMode;

    const type = String(detail.event || '');
    if (type === 'rewarded-preparing' || type === 'rewarded-showing' || type === 'rewarded-opened') {
      pending = true;
      decorate();
      return;
    }

    if (type === 'rewarded-earned') {
      earned = true;
      if (nativeTestMode) {
        setHint('✓ TEST AD COMPLETED • +2.5 NVX was NOT credited in test mode.', 'success');
      } else if (PRODUCTION_SSV_ENABLED) {
        setHint('Ad completed • verifying +2.5 NVX with Google server…');
        waitForServerCredit();
      }
      return;
    }

    if (type === 'rewarded-dismissed') {
      pending = false;
      if (!earned) {
        setHint('Ad closed before reward completion • no NVX was changed.', 'error');
      } else if (nativeTestMode) {
        setHint('✓ TEST AD COMPLETED • secure Watch Ad flow is working; no test NVX was added.', 'success');
      }
      decorateAfterResult();
      return;
    }

    if (type === 'rewarded-unavailable' || type === 'rewarded-load-failed' || type === 'rewarded-failed') {
      pending = false;
      earned = false;
      const message = String(detail.message || detail.reason || 'Ad unavailable').slice(0, 120);
      setHint(`Ad unavailable • ${message} • no NVX was changed.`, 'error');
      decorateAfterResult();
    }
  });

  function decorateAfterResult() {
    const btn = button();
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (!pending && !earned) decorate();
    }, 9000);
  }

  const observer = new MutationObserver(() => {
    if (button()) decorate();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      decorate();
      postStatusRequest();
    }, { once:true });
  } else {
    decorate();
    postStatusRequest();
  }
  setTimeout(postStatusRequest, 1200);
})();
