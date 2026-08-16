/* NexusNova AdMob Mining Boost bridge v1.2
   Compatibility filename retained so existing loaders do not break.

   Security contract:
   - Debug/test ads prove the UX only and never change mining timestamps/value.
   - Production mining boosts stay disabled until a server-verified ad proof exists.
   - Normal 24-hour mining start/finish remains owned by the existing mining engine.
*/
(() => {
  'use strict';
  if (window.__nxAdMobMiningBoostV1) return;
  window.__nxAdMobMiningBoostV1 = true;
  // Legacy marker kept temporarily so an already-cached v2 loader can discover
  // this bridge during the migration from Nexus Pass to mining boosts.
  window.__nxAdMobNexusPassV1 = true;

  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const BOOST_MS = 2 * HOUR;
  const BOOSTER_LIMIT = 2;
  const RAIN_LIMIT = 4;
  const TOTAL_LIMIT = BOOSTER_LIMIT + RAIN_LIMIT;
  const MAX_BOOST_MS = TOTAL_LIMIT * BOOST_MS;
  const SERVER_VERIFIED_BOOST_ENABLED = false;
  const STYLE_ID = 'nx-mining-boost-style-v1';
  const PANEL_ID = 'nxMiningBoostPanel';

  let rewardedReady = false;
  let interstitialReady = false;
  let testMode = true;
  let pendingKind = '';
  let firebasePromise = null;
  let miningUnsubscribe = null;
  let authUnsubscribe = null;
  let installTimer = null;

  const miningState = {
    known: false,
    active: false,
    startedAt: 0,
    anchorAt: 0,
    uses: 0,
    boosterUses: 0,
    rainUses: 0,
    reducedMs: 0,
    complete: false,
    malformed: false
  };

  const hasNative = () => typeof window.NexusAndroid?.postMessage === 'function';
  const el = id => document.getElementById(id);

  function post(action, payload = {}) {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        return window.nexusPostNativeAction(action, payload);
      }
      if (!hasNative()) return false;
      window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));
      return true;
    } catch (error) {
      console.warn('NexusNova AdMob native bridge:', error);
      return false;
    }
  }

  function findTaskButton() {
    return el('rewardedAdBtn') ||
      Array.from(document.querySelectorAll('#tab-tasks button'))
        .find(button => /watch\s*ad/i.test(String(button.textContent || '')));
  }

  function statusNode() {
    let node = el('rewardedAdStatus');
    const button = findTaskButton();
    if (!node && button) {
      node = document.createElement('div');
      node.id = 'rewardedAdStatus';
      node.className = 'status';
      node.style.marginTop = '8px';
      node.style.fontSize = '11px';
      button.insertAdjacentElement('afterend', node);
    }
    return node;
  }

  function setButtonText(button, text) {
    if (!button) return;
    const icon = button.querySelector('.mi-icon');
    Array.from(button.childNodes).forEach(node => {
      if (node !== icon) node.remove();
    });
    if (icon) button.appendChild(icon);
    button.appendChild(document.createTextNode(` ${text}`));
  }

  function expectedKind() {
    if (!miningState.active || miningState.complete || miningState.uses >= TOTAL_LIMIT) return '';
    return miningState.uses < BOOSTER_LIMIT ? 'booster' : 'rain';
  }

  function kindLabel(kind) {
    return kind === 'rain' ? 'Nova Rain' : 'Nova Booster';
  }

  function adoptMiningState(raw = {}) {
    const active = raw.miningActive === true || raw.active === true;
    const startedAt = Number(raw.miningStartedAt ?? raw.startedAt) || 0;
    const anchorAt = Number(raw.miningLastUpdate ?? raw.anchorAt) || 0;
    let malformed = false;
    let reducedMs = 0;
    let uses = 0;

    if (active) {
      if (startedAt <= 0 || anchorAt <= 0 || startedAt > anchorAt) {
        malformed = true;
      } else {
        reducedMs = Math.max(0, anchorAt - startedAt);
        const exactUses = reducedMs / BOOST_MS;
        if (reducedMs > MAX_BOOST_MS || Math.abs(exactUses - Math.round(exactUses)) > 0.001) {
          malformed = true;
        } else {
          uses = Math.max(0, Math.min(TOTAL_LIMIT, Math.round(exactUses)));
        }
      }
    }

    miningState.known = true;
    miningState.active = active;
    miningState.startedAt = startedAt;
    miningState.anchorAt = anchorAt;
    miningState.uses = uses;
    miningState.boosterUses = Math.min(BOOSTER_LIMIT, uses);
    miningState.rainUses = Math.max(0, Math.min(RAIN_LIMIT, uses - BOOSTER_LIMIT));
    miningState.reducedMs = Math.min(MAX_BOOST_MS, reducedMs);
    miningState.complete = active && startedAt > 0 && Date.now() - startedAt >= DAY;
    miningState.malformed = malformed;
    render();
  }

  function installStyle() {
    if (el(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:2px 0 18px;padding:14px;border:1px solid rgba(76,172,255,.24);border-radius:22px;background:linear-gradient(145deg,rgba(4,16,37,.94),rgba(6,33,61,.88));box-shadow:0 18px 42px rgba(0,39,92,.18),inset 0 1px rgba(255,255,255,.04)}
      .nx-boost-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:11px}.nx-boost-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:#6dbdff}.nx-boost-title{margin-top:3px;font-size:16px;font-weight:900;color:#eef9ff}.nx-boost-title small{display:block;margin-top:4px;font-size:9px;font-weight:700;letter-spacing:.06em;color:#7895b0}.nx-boost-cap{flex:0 0 auto;padding:6px 9px;border-radius:999px;border:1px solid rgba(85,218,255,.25);background:rgba(20,125,184,.12);font-size:9px;font-weight:900;letter-spacing:.1em;color:#83e7ff}
      .nx-boost-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.nx-boost-card{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:17px;padding:12px;background:rgba(7,21,42,.82);min-width:0}.nx-boost-card::after{content:"";position:absolute;width:74px;height:74px;right:-28px;top:-34px;border-radius:50%;background:radial-gradient(circle,rgba(75,198,255,.28),transparent 68%);pointer-events:none}.nx-boost-card.rain::after{background:radial-gradient(circle,rgba(110,117,255,.28),transparent 68%)}
      .nx-boost-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(145deg,#0b8fff,#43d7ff);box-shadow:0 7px 20px rgba(0,151,255,.22);font-size:18px}.nx-boost-card.rain .nx-boost-icon{background:linear-gradient(145deg,#6258ff,#8e9dff)}.nx-boost-name{margin-top:8px;font-size:12px;font-weight:900;color:#f2fbff}.nx-boost-effect{margin-top:2px;font-size:10px;color:#7fa2bf}.nx-boost-count{position:absolute;right:10px;top:10px;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.07);font-size:9px;font-weight:900;color:#b9d9ef}.nx-boost-btn{position:relative;z-index:1;width:100%;margin-top:9px;border:0;border-radius:11px;padding:9px 8px;background:linear-gradient(135deg,#0b90ff,#1fc7e8);color:white;font-size:9px;font-weight:900;letter-spacing:.04em;cursor:pointer}.nx-boost-card.rain .nx-boost-btn{background:linear-gradient(135deg,#6258ff,#788dff)}.nx-boost-btn:disabled{cursor:not-allowed;opacity:.42;filter:saturate(.45)}
      .nx-boost-progress{height:5px;margin-top:11px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}.nx-boost-progress i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#0e94ff,#48e6d0);transition:width .3s ease}.nx-boost-status{margin-top:8px;text-align:center;font-size:9px;line-height:1.35;color:#7392ac}.nx-boost-status strong{color:#9edcff}.nx-boost-test{color:#ffd477!important}
      @media(max-width:390px){.nx-boost-grid{grid-template-columns:1fr}.nx-boost-card{padding:11px}.nx-boost-head{align-items:center}}
    `;
    document.head.appendChild(style);
  }

  function installPanel() {
    installStyle();
    if (el(PANEL_ID)) return el(PANEL_ID);
    const timer = el('timer');
    if (!timer?.parentNode) return null;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="nx-boost-head">
        <div>
          <div class="nx-boost-kicker">MINING ACCELERATOR</div>
          <div class="nx-boost-title">Nova Time Boosts<small>TEST rewarded ad • no mining-time change</small></div>
        </div>
        <div class="nx-boost-cap">MAX -12H</div>
      </div>
      <div class="nx-boost-grid">
        <div class="nx-boost-card booster">
          <div class="nx-boost-icon">⚡</div>
          <div class="nx-boost-count" id="nxBoosterCount">0 / 2</div>
          <div class="nx-boost-name">Nova Booster</div>
          <div class="nx-boost-effect">2 hours instant reduction</div>
          <button type="button" class="nx-boost-btn" id="nxBoosterBtn">WATCH AD • -2H</button>
        </div>
        <div class="nx-boost-card rain">
          <div class="nx-boost-icon">☄</div>
          <div class="nx-boost-count" id="nxRainCount">0 / 4</div>
          <div class="nx-boost-name">Nova Rain</div>
          <div class="nx-boost-effect">2 hours instant reduction</div>
          <button type="button" class="nx-boost-btn" id="nxRainBtn">UNLOCK AFTER BOOSTER</button>
        </div>
      </div>
      <div class="nx-boost-progress"><i id="nxBoostProgress"></i></div>
      <div class="nx-boost-status" id="nxBoostStatus">Checking mining session…</div>`;

    timer.insertAdjacentElement('afterend', panel);
    el('nxBoosterBtn')?.addEventListener('click', () => activateBoost('booster'));
    el('nxRainBtn')?.addEventListener('click', () => activateBoost('rain'));
    return panel;
  }

  function relabelTaskButton() {
    const button = findTaskButton();
    if (!button) return null;
    button.id = 'rewardedAdBtn';
    const kind = expectedKind();
    let label = 'WATCH AD — MINING BOOST (-2H)';
    if (!miningState.known) label = 'PREPARING MINING BOOST…';
    else if (!miningState.active) label = 'START MINING TO USE BOOST';
    else if (miningState.complete) label = 'CLAIM SESSION BEFORE BOOSTING';
    else if (!kind) label = 'SESSION BOOST LIMIT REACHED';
    else label = testMode ? `TEST AD — ${kindLabel(kind).toUpperCase()} (NO TIME CHANGE)` : 'MINING BOOST NOT LIVE';
    setButtonText(button, label);
    button.disabled = Boolean(miningState.known && (!kind || !miningState.active || miningState.complete)) || (hasNative() && !rewardedReady);
    button.title = 'TEST rewarded ad flow. No mining time or NVX changes until server-verified fulfillment is deployed.';
    return button;
  }

  function render() {
    installPanel();
    relabelTaskButton();

    const boosterCount = el('nxBoosterCount');
    const rainCount = el('nxRainCount');
    const boosterBtn = el('nxBoosterBtn');
    const rainBtn = el('nxRainBtn');
    const progress = el('nxBoostProgress');
    const status = el('nxBoostStatus');
    const taskStatus = statusNode();

    if (boosterCount) boosterCount.textContent = `${miningState.boosterUses} / ${BOOSTER_LIMIT}`;
    if (rainCount) rainCount.textContent = `${miningState.rainUses} / ${RAIN_LIMIT}`;
    if (progress) progress.style.width = `${Math.min(100, (miningState.uses / TOTAL_LIMIT) * 100)}%`;

    const kind = expectedKind();
    const adReady = hasNative() && rewardedReady;
    const boosterInventory = vaultInventory('booster');
    const rainInventory = vaultInventory('rain');
    const cooldownMs = novaCooldownMs();
    const cooldownSeconds = Math.ceil(cooldownMs / 1000);
    if (boosterBtn) {
      const stored = boosterInventory > 0;
      boosterBtn.disabled = kind !== 'booster' || miningState.malformed || (stored ? cooldownMs > 0 : !adReady);
      boosterBtn.textContent = miningState.boosterUses >= BOOSTER_LIMIT
        ? 'BOOSTER COMPLETE'
        : stored
          ? cooldownMs > 0 ? `BOOSTER READY IN ${cooldownSeconds}s` : `USE VAULT BOOSTER • -2H (${boosterInventory})`
          : !hasNative() ? 'NO VAULT BOOSTER'
          : rewardedReady ? 'TEST AD • NO TIME CHANGE' : 'PREPARING TEST AD…';
    }
    if (rainBtn) {
      const stored = rainInventory > 0;
      rainBtn.disabled = kind !== 'rain' || miningState.malformed || (stored ? cooldownMs > 0 : !adReady);
      rainBtn.textContent = miningState.rainUses >= RAIN_LIMIT
        ? 'RAIN COMPLETE'
        : miningState.boosterUses < BOOSTER_LIMIT ? 'UNLOCK AFTER BOOSTER'
        : stored
          ? cooldownMs > 0 ? `RAIN READY IN ${cooldownSeconds}s` : `USE VAULT RAIN • -2H (${rainInventory})`
          : !hasNative() ? 'NO VAULT RAIN'
          : rewardedReady ? 'TEST AD • NO TIME CHANGE' : 'PREPARING TEST AD…';
    }

    let text = 'Checking secure mining session…';
    if (miningState.malformed) {
      text = 'Mining timestamps need repair before a boost can be applied.';
    } else if (miningState.known && !miningState.active) {
      text = 'Start a mining session to activate Nova Booster.';
    } else if (miningState.complete) {
      text = 'Session is complete — claim it before using another boost.';
    } else if (miningState.uses >= TOTAL_LIMIT) {
      text = '<strong>12 hours reduced</strong> • session boost limit reached.';
    } else if (miningState.active) {
      text = `<strong>${miningState.uses * 2}h reduced</strong> • ${TOTAL_LIMIT - miningState.uses} boost${TOTAL_LIMIT - miningState.uses === 1 ? '' : 's'} remaining${testMode ? ' • TEST ADS' : ''}`;
    }
    if (status) {
      status.innerHTML = text;
      status.classList.toggle('nx-boost-test', Boolean(testMode && miningState.active && !miningState.complete));
    }

    if (taskStatus) {
      taskStatus.textContent = !hasNative()
        ? 'Mining boost ads are available inside the NexusNova Android app.'
        : !miningState.active
          ? 'Start mining first; rewarded ads do not directly grant NVX.'
          : miningState.complete
            ? 'Current session is complete. Claim it before another boost.'
            : miningState.uses >= TOTAL_LIMIT
              ? 'Maximum 12-hour reduction reached for this session.'
              : rewardedReady
                ? `${kindLabel(kind)} ready • TEST MODE • no mining-time change`
                : `Preparing rewarded ad…${testMode ? ' • TEST MODE' : ''}`;
    }
  }

  async function premiumMessage(title, text, icon = 'spark') {
    try {
      if (window.NexusNovaUI?.alert) {
        await window.NexusNovaUI.alert({
          eyebrow: 'MINING BOOST', title, text, icon, buttonText: 'OK'
        });
        return;
      }
    } catch (_) {}
    console.info(`NexusNova Mining Boost — ${title}: ${text}`);
  }

  async function firebaseModules() {
    if (!firebasePromise) {
      firebasePromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
      ]);
    }
    return firebasePromise;
  }

  async function waitForUser(authMod, auth) {
    if (auth.currentUser) return auth.currentUser;
    return new Promise(resolve => {
      let settled = false;
      const unsubscribe = authMod.onAuthStateChanged(auth, user => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(user || null);
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(auth.currentUser || null);
      }, 3500);
    });
  }

  async function getContext({ write = false } = {}) {
    const [appMod, authMod, fsMod] = await firebaseModules();
    const apps = appMod.getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    const app = apps[0];
    const auth = authMod.getAuth(app);
    let user = await waitForUser(authMod, auth);
    if (!user) throw new Error('Please sign in first.');

    if (write) {
      await user.reload();
      user = auth.currentUser || user;
      await user.getIdToken(true);
      if (typeof window.nexusRequireAppCheck !== 'function') {
        throw new Error('Firebase App Check is unavailable.');
      }
      await window.nexusRequireAppCheck();
    }
    if (!user.emailVerified) throw new Error('Verify your email before using mining boosts.');

    return { auth, authMod, user, db: fsMod.getFirestore(app), fsMod };
  }

  function deriveBoost(raw = {}) {
    if (raw.miningActive !== true) throw new Error('Start mining before using a boost.');
    const startedAt = Number(raw.miningStartedAt) || 0;
    const anchorAt = Number(raw.miningLastUpdate) || 0;
    if (startedAt <= 0 || anchorAt <= 0 || startedAt > anchorAt) {
      throw new Error('Mining session timestamps need repair before boosting.');
    }
    const reducedMs = anchorAt - startedAt;
    const exactUses = reducedMs / BOOST_MS;
    if (reducedMs < 0 || reducedMs > MAX_BOOST_MS || Math.abs(exactUses - Math.round(exactUses)) > 0.001) {
      throw new Error('Mining boost state is inconsistent. Start a fresh session before boosting.');
    }
    const uses = Math.round(exactUses);
    if (uses >= TOTAL_LIMIT) throw new Error('Maximum 12-hour mining reduction is already used for this session.');
    if (Date.now() - startedAt >= DAY) throw new Error('This mining session is already complete. Claim it first.');
    return { startedAt, anchorAt, uses, reducedMs };
  }

  async function applyBoost(kind = '') {
    if (typeof window.NexusNovaVault?.useBoost !== 'function') {
      throw new Error('Nova Vault secure boost service is still loading.');
    }
    return window.NexusNovaVault.useBoost(kind);
  }

  function vaultInventory(kind) {
    const snapshot = window.NexusNovaVault?.inventory?.() || {};
    return Math.max(0, Number(kind === 'rain' ? snapshot.rain : snapshot.booster) || 0);
  }

  function novaCooldownMs() {
    return Math.max(0, Number(window.NexusNovaVault?.cooldownRemainingMs?.()) || 0);
  }

  async function activateBoost(kind = '') {
    const requested = String(kind || expectedKind() || '').toLowerCase();
    if (vaultInventory(requested) > 0) return applyBoost(requested);
    return showRewarded(requested);
  }

  async function showRewarded(kind = '') {
    installPanel();
    const chosen = String(kind || expectedKind() || '').toLowerCase();
    if (!miningState.known) {
      await premiumMessage('Mining Is Syncing', 'Wait a moment while the secure mining session is checked.', 'security');
      return { shown:false, reason:'mining-sync' };
    }
    if (!miningState.active) {
      await premiumMessage('Start Mining First', 'A boost reduces the current mining session by 2 hours. Start a session first; no NVX is issued just for viewing an ad.', 'security');
      return { shown:false, reason:'no-active-session' };
    }
    if (miningState.complete) {
      await premiumMessage('Session Already Complete', 'Claim the completed mining session before using another boost.', 'spark');
      return { shown:false, reason:'session-complete' };
    }
    const expected = expectedKind();
    if (!expected) {
      await premiumMessage('Boost Limit Reached', 'This session already has the maximum 12-hour reduction.', 'spark');
      return { shown:false, reason:'limit' };
    }
    if (chosen && chosen !== expected) {
      await premiumMessage(
        expected === 'booster' ? 'Nova Booster First' : 'Use Nova Rain',
        expected === 'booster'
          ? 'Use the two Nova Booster rewards first. Nova Rain unlocks after that.'
          : 'The two Nova Booster rewards are complete. The remaining four rewards are Nova Rain.',
        'spark'
      );
      return { shown:false, reason:'wrong-kind' };
    }
    if (!hasNative()) {
      await premiumMessage('Android App Required', 'Rewarded mining boost testing runs through the native NexusNova Android app. No mining time was changed.', 'security');
      return { shown:false, native:false };
    }
    if (!testMode && !SERVER_VERIFIED_BOOST_ENABLED) {
      await premiumMessage(
        'Mining Boost Not Live Yet',
        'Live mining-time rewards need server-verified ad proof. Normal mining continues unchanged.',
        'security'
      );
      return { shown:false, reason:'server-proof-required' };
    }

    pendingKind = expected;
    if (!post('showRewardedAd', { rewardPurpose:'mining-boost', boostKind:expected, testOnly:true })) {
      pendingKind = '';
      return { shown:false, native:false };
    }
    const node = statusNode();
    if (node) node.textContent = rewardedReady ? `Opening ${kindLabel(expected)} ad…` : 'Rewarded ad is still preparing…';
    return { shown:true, native:true, kind:expected };
  }

  function showInterstitial(reason = 'natural-transition') {
    if (!post('showInterstitialAd', { reason:String(reason).slice(0,80) })) {
      return { shown:false, native:false };
    }
    return { shown:true, native:true };
  }

  async function handleEarned(detail) {
    const purpose = String(detail.rewardPurpose || '');
    if (purpose !== 'mining-boost') return;
    if (Number(detail.boostHours || 0) !== 2) {
      pendingKind = '';
      await premiumMessage(
        'App Update Required',
        'This Android build uses an older mining-boost contract. No mining time was changed.',
        'security'
      );
      return;
    }

    const kind = pendingKind || expectedKind();
    pendingKind = '';
    if (!kind) {
      await premiumMessage('Boost Not Applied', 'No eligible active mining boost was pending. No mining value was changed.', 'security');
      return;
    }

    if (detail.testMode === true || testMode || !SERVER_VERIFIED_BOOST_ENABLED) {
      await premiumMessage(
        'TEST Ad Completed',
        `${kindLabel(kind)} ad flow is working. TEST ads never reduce mining time or change NVX.`,
        'spark'
      );
      return;
    }

    await premiumMessage(
      'Mining Boost Not Live Yet',
      'Server-verified mining boost fulfillment is not enabled. No mining value was changed.',
      'security'
    );
  }

  function handleNativeEvent(event) {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    testMode = detail.testMode !== false;

    switch (String(detail.event || '')) {
      case 'status':
        rewardedReady = detail.rewardedReady === true;
        interstitialReady = detail.interstitialReady === true;
        break;
      case 'rewarded-ready':
        rewardedReady = true;
        break;
      case 'rewarded-showing':
      case 'rewarded-opened':
        rewardedReady = false;
        break;
      case 'rewarded-earned':
        rewardedReady = false;
        void handleEarned(detail);
        break;
      case 'rewarded-dismissed':
        break;
      case 'rewarded-unavailable':
      case 'rewarded-load-failed':
      case 'rewarded-failed':
        rewardedReady = false;
        pendingKind = '';
        void premiumMessage('Ad Not Ready', 'A rewarded ad is not available right now. Try again shortly; no mining boost was issued.', 'security');
        break;
      case 'interstitial-ready':
        interstitialReady = true;
        break;
      case 'interstitial-showing':
      case 'interstitial-opened':
        interstitialReady = false;
        break;
      default:
        break;
    }
    render();
  }

  async function syncMiningState() {
    const context = await getContext({ write:false });
    const ref = context.fsMod.doc(context.db, 'users', context.user.uid);
    const snap = await context.fsMod.getDoc(ref);
    if (!snap.exists()) throw new Error('User profile not found.');
    adoptMiningState(snap.data() || {});
    return {...miningState};
  }

  async function subscribeMining() {
    if (miningUnsubscribe || authUnsubscribe) return;
    try {
      const [appMod, authMod, fsMod] = await firebaseModules();
      const apps = appMod.getApps();
      if (!apps.length) return;
      const auth = authMod.getAuth(apps[0]);
      const db = fsMod.getFirestore(apps[0]);
      authUnsubscribe = authMod.onAuthStateChanged(auth, user => {
        try { miningUnsubscribe?.(); } catch (_) {}
        miningUnsubscribe = null;
        if (!user) {
          miningState.known = true;
          miningState.active = false;
          render();
          return;
        }
        const ref = fsMod.doc(db, 'users', user.uid);
        miningUnsubscribe = fsMod.onSnapshot(ref, snap => {
          if (!snap.exists()) return;
          adoptMiningState(snap.data() || {});
        }, error => console.warn('NexusNova mining boost state watch:', error));
      });
    } catch (error) {
      console.warn('NexusNova mining boost subscription:', error);
    }
  }

  function status() {
    return {
      provider: 'admob-native',
      configured: hasNative(),
      rewardedReady,
      interstitialReady,
      testMode,
      rewardPurpose: 'mining-boost',
      boostHours: 2,
      mining: {...miningState}
    };
  }

  window.addEventListener('nexusnova:native-ad-event', handleNativeEvent);
  window.addEventListener('nexusnova:nova-vault-state', render);

  window.NexusNovaRewardedAds = {
    show: showRewarded,
    status,
    configured: hasNative
  };
  window.NexusNovaInterstitialAds = {
    show: showInterstitial,
    status
  };
  window.NexusNovaMiningBoosters = {
    show: showRewarded,
    apply: applyBoost,
    sync: syncMiningState,
    status: () => ({...miningState}),
    adoptDisplayState: adoptMiningState
  };
  // Compatibility object: Nexus Pass is retired by this reward model.
  window.NexusNovaAccessPass = {
    active: () => false,
    expiresAt: () => 0,
    remainingMs: () => 0
  };
  window.watchAdReward = () => showRewarded();

  function install() {
    installPanel();
    render();
    subscribeMining();
    if (hasNative()) post('adStatus');
  }

  install();
  window.addEventListener('load', install, { once:true });
  [250,700,1500,3000].forEach(ms => setTimeout(install, ms));
  if (!installTimer) installTimer = setInterval(render, 5000);
  console.info('NexusNova ads loaded: admob-native-mining-boost-v1');
})();
