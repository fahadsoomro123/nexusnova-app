/* NexusNova Nova Vault 10x v1
   Opt-in rewarded-ad upgrade for Nova Vault.

   Value safety:
   - Normal Vault remains exactly owned by nexusnova-nova-vault-v1.js.
   - A WebView rewarded-earned event never writes NVX/inventory.
   - Production 10x first waits for a Google SSV-created boost credit, then calls
     the App-Check-protected openNovaVaultBoosted backend function.
   - TEST ads only show a clearly labeled local preview. They do not consume a
     Vault, add NVX, add inventory, or create a production boost credit.
*/
(() => {
  'use strict';
  if (window.__nxNovaVault10xV1) return;
  window.__nxNovaVault10xV1 = true;
  window.nexusNovaVault10xVersion = 'nova-vault-10x-v1';

  const PURPOSE = 'nova-vault-10x';
  const FIREBASE_VERSION = '12.1.0';
  const BUTTON_ID = 'nxVault10xOpen';
  const ODDS_ID = 'nxVault10xOdds';
  const CREDIT_ID = 'nxVault10xCredits';
  const STYLE_ID = 'nxVault10xStyle';
  const SSV_WAIT_MS = 45_000;

  let modulesPromise = null;
  let authUnsubscribe = null;
  let userUnsubscribe = null;
  let nativeTestMode = true;
  let ssvIdentityReady = false;
  let nativeRewardedReady = false;
  let boostCredits = 0;
  let pendingAd = false;
  let earned = false;
  let activeUid = '';
  let lastTestPreview = '';
  let refreshTimer = null;

  const $ = id => document.getElementById(id);
  const cleanInt = value => Math.max(0, Math.floor(Number(value) || 0));

  function vaultState() {
    try { return window.NexusNovaVault?.status?.() || {}; } catch (_) { return {}; }
  }

  function installStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{grid-column:1/-1;border:1px solid rgba(255,130,178,.32);border-radius:13px;padding:12px 9px;background:linear-gradient(135deg,#ff4f87,#ff7b63);color:#fff;font-size:10px;font-weight:950;letter-spacing:.045em;cursor:pointer;box-shadow:0 10px 25px rgba(255,74,127,.18)}
      #${BUTTON_ID}:disabled{cursor:not-allowed;opacity:.46;filter:saturate(.45)}
      #${ODDS_ID}{grid-column:1/-1;margin-top:2px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.035)}
      .nx-vault-10x-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;font-size:9px;font-weight:950;color:#ffd6e3;letter-spacing:.07em}
      #${CREDIT_ID}{padding:4px 7px;border:1px solid rgba(255,122,167,.24);border-radius:999px;background:rgba(255,85,135,.10);font-size:8px;color:#ffc4d7;white-space:nowrap}
      .nx-vault-10x-grid{display:grid;grid-template-columns:1.35fr .8fr 1fr;gap:5px;align-items:center;font-size:8px;color:#938aa9}
      .nx-vault-10x-grid b{color:#d9d3e7;font-size:8px}.nx-vault-10x-grid strong{color:#ff9fbd;font-size:8px;text-align:right}.nx-vault-10x-grid span:nth-child(3n+2){text-align:right}
      .nx-vault-10x-note{margin-top:7px;font-size:7.5px;line-height:1.45;color:#776f89;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function installUi() {
    const panel = $('nxNovaVaultPanel');
    const actions = panel?.querySelector('.nx-vault-actions');
    if (!panel || !actions) return false;
    installStyle();

    if (!$(ODDS_ID)) {
      const odds = document.createElement('div');
      odds.id = ODDS_ID;
      odds.innerHTML = `
        <div class="nx-vault-10x-title"><span>🎁 NORMAL vs 10× CHANCE</span><span id="${CREDIT_ID}">0 BOOST READY</span></div>
        <div class="nx-vault-10x-grid">
          <b>Reward</b><b style="text-align:right">Normal</b><b style="text-align:right">10× pool</b>
          <span>NVX</span><span>60% • 1–10</span><strong>13.04% • 5–25</strong>
          <span>Nova Booster</span><span>18%</span><strong>39.13%</strong>
          <span>Nova Rain</span><span>17%</span><strong>36.96%</strong>
          <span>24H Time Warp</span><span>5%</span><strong>10.87%</strong>
        </div>
        <div class="nx-vault-10x-note">10× multiplies every premium-item weight by ten relative to the normal NVX weight, then normalizes the pool to 100%. The boosted NVX range is also larger. One completed rewarded ad unlocks one secure boosted opening.</div>`;
      actions.insertAdjacentElement('beforeend', odds);
    }

    if (!$(BUTTON_ID)) {
      const button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.textContent = '10× CHANCE • WATCH AD';
      button.addEventListener('click', handleTenX);
      actions.insertAdjacentElement('beforeend', button);
    }

    refreshUi();
    return true;
  }

  function refreshUi() {
    const button = $(BUTTON_ID);
    const credit = $(CREDIT_ID);
    if (!button) return;

    const vault = vaultState();
    const pendingVaults = cleanInt(vault.pending ?? vault.inventory?.pendingVaults);
    const cooldownMs = Math.max(0, Number(vault.cooldownRemainingMs || 0));
    const cooldownSec = Math.ceil(cooldownMs / 1000);

    if (credit) credit.textContent = `${boostCredits} BOOST${boostCredits === 1 ? '' : 'S'} READY`;

    if (pendingAd) {
      button.disabled = true;
      button.textContent = earned ? 'AD COMPLETE • VERIFYING 10×…' : 'REWARDED AD IN PROGRESS…';
      return;
    }
    if (pendingVaults < 1) {
      button.disabled = true;
      button.textContent = '10× CHANCE • NO VAULT READY';
      return;
    }
    if (cooldownMs > 0) {
      button.disabled = true;
      button.textContent = `10× CHANCE • COOLDOWN ${cooldownSec}s`;
      return;
    }

    button.disabled = false;
    if (!nativeTestMode && boostCredits > 0) {
      button.textContent = `10× OPEN READY • ${boostCredits} CREDIT${boostCredits === 1 ? '' : 'S'}`;
    } else if (nativeTestMode) {
      button.textContent = '10× CHANCE • TEST REWARDED AD';
    } else {
      button.textContent = '10× CHANCE • WATCH REWARDED AD';
    }
  }

  async function firebaseModules() {
    if (!modulesPromise) {
      modulesPromise = Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-functions.js`)
      ]);
    }
    return modulesPromise;
  }

  async function authContext() {
    const [appMod, authMod, fsMod] = await firebaseModules();
    const app = appMod.getApps()[0];
    if (!app) throw new Error('NexusNova account is not ready yet.');
    const auth = authMod.getAuth(app);
    let user = auth.currentUser;
    if (!user) throw new Error('Please sign in first.');
    await user.reload();
    user = auth.currentUser || user;
    if (!user.emailVerified) throw new Error('Verify your email before using 10× Nova Vault rewards.');
    await user.getIdToken(true);
    if (typeof window.nexusRequireAppCheck !== 'function') throw new Error('Firebase App Check is unavailable.');
    await window.nexusRequireAppCheck();
    const db = fsMod.getFirestore(app);
    return { app, auth, user, db, fsMod };
  }

  async function secureBoostedOpen() {
    if (nativeTestMode) {
      await showMessage('TEST Mode Protection', 'TEST ads never consume a real Nova Vault or change NVX/inventory. Use the 10× TEST ad to preview the complete flow safely.', 'security');
      return null;
    }
    const ctx = await authContext();
    const [, , , fnMod] = await firebaseModules();
    const result = (await fnMod.httpsCallable(fnMod.getFunctions(ctx.app), 'openNovaVaultBoosted')({})).data || {};
    if (Number.isFinite(Number(result.balance))) window.nexusApplySecureAccountState?.(result);
    try { await window.nexusSecureSyncMining?.({ force:true }); } catch (_) {}
    boostCredits = cleanInt(result.novaVaultBoostCredits);
    refreshUi();

    const reward = result.reward || {};
    const type = String(reward.type || 'reward');
    const amount = Number(reward.amount || 0);
    const copy = type === 'nvx'
      ? `10× pool dropped +${amount.toFixed(0)} NVX.`
      : type === 'booster'
        ? '10× pool dropped 1 Nova Booster.'
        : type === 'rain'
          ? '10× pool dropped 1 Nova Rain.'
          : '10× pool dropped the rare 24H Time Warp.';
    await showMessage('10× Nova Vault Opened', `${copy} One secure boost credit and one pending Vault were consumed.`, 'spark');
    return result;
  }

  function cryptoUnit() {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] / 0x100000000;
    } catch (_) {
      return Math.random();
    }
  }

  function testPreview() {
    const roll = cryptoUnit() * 46000;
    let text;
    if (roll < 6000) {
      const amount = 5 + Math.floor(cryptoUnit() * 21);
      text = `Preview result: +${amount} NVX.`;
    } else if (roll < 24000) text = 'Preview result: 1 Nova Booster.';
    else if (roll < 41000) text = 'Preview result: 1 Nova Rain.';
    else text = 'Preview result: 1 × 24H Time Warp.';
    lastTestPreview = text;
    return showMessage('10× TEST Preview', `${text} TEST MODE changed nothing: no Vault consumed, no balance changed and no inventory was added.`, 'spark');
  }

  async function showMessage(title, text, icon = 'spark') {
    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({ eyebrow:'NOVA VAULT 10×', title, text, icon, buttonText:'OK' });
        return;
      }
    } catch (_) {}
    console.info(`Nova Vault 10× — ${title}: ${text}`);
  }

  function postStatus() {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        window.nexusPostNativeAction('adStatus', {});
        return;
      }
      window.NexusAndroid?.postMessage?.(JSON.stringify({ action:'adStatus' }));
    } catch (_) {}
  }

  async function handleTenX() {
    if (pendingAd) return;
    const vault = vaultState();
    const pendingVaults = cleanInt(vault.pending ?? vault.inventory?.pendingVaults);
    if (pendingVaults < 1) {
      await showMessage('No Vault Ready', 'Complete a natural 24-hour mining session or earn a Vault gift first.', 'security');
      return;
    }
    if (Number(vault.cooldownRemainingMs || 0) > 0) {
      await showMessage('Nova Cooldown', 'Wait for the shared Nova cooldown before opening another Vault.', 'security');
      return;
    }

    if (!nativeTestMode && boostCredits > 0) {
      try { await secureBoostedOpen(); }
      catch (error) { await showMessage('10× Open Unavailable', String(error?.message || error || 'Secure boosted opening failed.').replace(/^FirebaseError:\s*/i,''), 'security'); }
      return;
    }

    let ctx;
    try { ctx = await authContext(); }
    catch (error) {
      await showMessage('Account Check Required', String(error?.message || error || 'Please sign in and verify your account.'), 'security');
      return;
    }

    if (!window.NexusNovaAds?.requestRewarded) {
      await showMessage('Ad Service Loading', 'Rewarded ads are not ready yet. Try again in a moment.', 'security');
      return;
    }

    if (!ssvIdentityReady) {
      postStatus();
      await new Promise(resolve => setTimeout(resolve, 450));
    }

    activeUid = ctx.user.uid;
    pendingAd = true;
    earned = false;
    refreshUi();

    const request = window.NexusNovaAds.requestRewarded(PURPOSE, { userId:activeUid });
    if (!request?.shown) {
      pendingAd = false;
      await showMessage('Ad Not Ready', 'The rewarded ad is unavailable right now. Your Nova Vault was not consumed.', 'security');
      refreshUi();
    }
  }

  async function readBoostCredits() {
    try {
      const ctx = await authContext();
      const snap = await ctx.fsMod.getDoc(ctx.fsMod.doc(ctx.db, 'users', ctx.user.uid));
      boostCredits = cleanInt(snap.data()?.novaVaultBoostCredits);
      refreshUi();
      return boostCredits;
    } catch (_) {
      return boostCredits;
    }
  }

  async function waitForSsvCredit() {
    const started = Date.now();
    while (Date.now() - started < SSV_WAIT_MS) {
      const credits = await readBoostCredits();
      if (credits > 0) return true;
      await new Promise(resolve => setTimeout(resolve, 1800));
    }
    return false;
  }

  async function subscribeCredits() {
    if (authUnsubscribe) return;
    try {
      const [appMod, authMod, fsMod] = await firebaseModules();
      const app = appMod.getApps()[0];
      if (!app) return;
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      authUnsubscribe = authMod.onAuthStateChanged(auth, user => {
        try { userUnsubscribe?.(); } catch (_) {}
        userUnsubscribe = null;
        boostCredits = 0;
        activeUid = user?.uid || '';
        refreshUi();
        if (!user) return;
        const ref = fsMod.doc(db, 'users', user.uid);
        userUnsubscribe = fsMod.onSnapshot(ref, snap => {
          boostCredits = cleanInt(snap.data()?.novaVaultBoostCredits);
          refreshUi();
        }, error => console.warn('Nova Vault 10× credit watch:', error));
      });
    } catch (error) {
      console.warn('Nova Vault 10× credit subscription unavailable:', error);
    }
  }

  window.addEventListener('nexusnova:native-ad-event', event => {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    if (typeof detail.testMode === 'boolean') nativeTestMode = detail.testMode;
    if (String(detail.event || '') === 'status') {
      ssvIdentityReady = detail.ssvIdentityReady === true;
      nativeRewardedReady = Boolean(detail.rewardedReady);
      refreshUi();
      return;
    }
    if (String(detail.event || '') === 'rewarded-ready') {
      nativeRewardedReady = true;
      refreshUi();
    }

    if (String(detail.rewardPurpose || '') !== PURPOSE) return;
    const type = String(detail.event || '');

    if (type === 'rewarded-preparing' || type === 'rewarded-showing' || type === 'rewarded-opened') {
      pendingAd = true;
      refreshUi();
      return;
    }
    if (type === 'rewarded-earned') {
      earned = true;
      refreshUi();
      return;
    }
    if (type === 'rewarded-dismissed') {
      const didEarn = earned;
      pendingAd = false;
      earned = false;
      refreshUi();
      if (!didEarn) {
        void showMessage('10× Not Unlocked', 'The ad closed before reward completion. No Vault or value was changed.', 'security');
        return;
      }
      if (nativeTestMode) {
        void testPreview();
        return;
      }
      void (async () => {
        const credited = await waitForSsvCredit();
        if (!credited) {
          await showMessage('Google Verification Pending', 'The ad completed, but the signed server credit has not arrived yet. Your Vault was not consumed. When the credit appears, the 10× button will show OPEN READY.', 'security');
          return;
        }
        try { await secureBoostedOpen(); }
        catch (error) { await showMessage('10× Open Unavailable', String(error?.message || error || 'Secure boosted opening failed.').replace(/^FirebaseError:\s*/i,''), 'security'); }
      })();
      return;
    }

    if (type === 'rewarded-load-failed' || type === 'rewarded-failed' || type === 'rewarded-unavailable') {
      pendingAd = false;
      earned = false;
      refreshUi();
      void showMessage('Rewarded Ad Unavailable', 'The ad could not be completed. No Vault, NVX or inventory was changed.', 'security');
    }
  });

  function boot() {
    installUi();
    subscribeCredits();
    refreshUi();
    postStatus();
    if (!refreshTimer) refreshTimer = setInterval(refreshUi, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
  [350,900,1800,3500,6500,10000].forEach(ms => setTimeout(boot, ms));
  setTimeout(postStatus, 1400);

  window.NexusNovaVault10x = Object.freeze({
    purpose:PURPOSE,
    status:() => Object.freeze({
      nativeTestMode,ssvIdentityReady,nativeRewardedReady,boostCredits,
      pendingAd,earned,lastTestPreview
    }),
    refresh:readBoostCredits
  });
})();
