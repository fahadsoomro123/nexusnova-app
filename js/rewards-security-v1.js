/*
 * NexusNova Secure Rewards Layer — single-owner mining engine.
 *
 * Mining has exactly one executable owner in the web app. Firestore is the
 * authoritative state. The browser only proposes the exact start/finish
 * transitions that Firestore Security Rules permit. No background timer writes,
 * no Cloud Functions mining fallback, and no competing recovery engine.
 */
(() => {
  'use strict';
  if (window.__nexusSecureRewardsSingleOwner) return;
  window.__nexusSecureRewardsSingleOwner = true;

  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const MINING_REWARD = 24;
  const MINING_STYLE_ID = 'nx-future-mining-style';
  const SYNC_TIMEOUT_MS = 10_000;
  const SYNC_RETRY_DELAYS_MS = [2_500, 7_500, 15_000];
  const MINING_START_AD_PLACEMENT = 'mining-start';
  const MINING_START_AD_FEATURE = 'mining';
  const MINING_START_AD_TIMEOUT_MS = 50_000;

  let uiPromise = null;
  let firebasePromise = null;
  let miningTimer = null;
  let unsubscribeMining = null;
  let operationPromise = null;
  let currentUid = '';
  let syncWatchdog = null;
  let syncRetryTimers = [];
  let syncInFlight = null;
  let syncError = '';
  let miningStartAdPending = false;

  const miningState = {
    known: false,
    active: false,
    startedAt: 0,
    balance: 0,
    totalMined: 0
  };

  function el(id) { return document.getElementById(id); }

  function withTimeout(promise, ms, message) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || 'Secure session sync timed out.')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function clearSyncTimers() {
    clearTimeout(syncWatchdog);
    syncWatchdog = null;
    syncRetryTimers.forEach(clearTimeout);
    syncRetryTimers = [];
  }

  function markSyncPending() {
    syncError = '';
    miningState.known = false;
    renderMiningAuthoritative();
    clearTimeout(syncWatchdog);
    syncWatchdog = setTimeout(() => {
      if (miningState.known) return;
      syncError = 'Secure session is taking longer than expected.';
      renderMiningAuthoritative();
    }, SYNC_TIMEOUT_MS);
  }

  function markSyncError(error) {
    if (miningState.known) return;
    syncError = readableError(error || new Error('Secure session could not sync.'));
    renderMiningAuthoritative();
  }

  function installMiningVisuals() {
    if (!document.getElementById(MINING_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = MINING_STYLE_ID;
      style.textContent = `
        #mineBtn.nx-future-miner{position:relative!important;isolation:isolate;overflow:hidden;min-height:116px;padding:20px 28px 20px 132px!important;margin:18px 0 12px!important;border:1px solid rgba(67,171,255,.6)!important;border-radius:28px!important;background:linear-gradient(115deg,rgba(3,14,31,.98),rgba(5,35,72,.96) 54%,rgba(5,71,108,.94))!important;color:#eaf8ff!important;text-align:left;box-shadow:0 20px 46px rgba(0,66,150,.34),0 0 0 1px rgba(57,182,255,.12) inset,0 1px 0 rgba(255,255,255,.18) inset!important;transform:translateZ(0);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease,filter .22s ease!important}
        #mineBtn.nx-future-miner:hover:not(:disabled){transform:translateY(-2px) scale(1.004);border-color:rgba(111,215,255,.92)!important;box-shadow:0 24px 56px rgba(0,102,210,.42),0 0 32px rgba(18,177,255,.18),0 0 0 1px rgba(90,204,255,.18) inset!important}
        #mineBtn.nx-future-miner:disabled{cursor:wait;opacity:.76}
        #mineBtn.nx-future-miner::before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(100deg,transparent 0 28%,rgba(81,206,255,.10) 45%,transparent 63%),repeating-linear-gradient(90deg,transparent 0 38px,rgba(77,179,255,.035) 39px 40px);animation:nxMineScan 4.8s linear infinite}
        #mineBtn.nx-future-miner::after{content:"";position:absolute;width:180px;height:180px;right:-76px;top:-80px;border-radius:50%;background:radial-gradient(circle,rgba(84,221,255,.32),rgba(27,125,255,.09) 40%,transparent 70%);z-index:-1;animation:nxMineAura 3.2s ease-in-out infinite}
        .nx-mining-reactor{position:absolute;left:25px;top:50%;width:82px;height:82px;transform:translateY(-50%);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 46%,#e9ffff 0 8%,#6fe7ff 9% 20%,#0a8cff 21% 39%,#031d4a 40% 62%,#020813 63%);box-shadow:0 0 0 1px rgba(135,231,255,.75),0 0 0 7px rgba(24,137,255,.11),0 0 31px rgba(34,184,255,.64),inset 0 0 22px rgba(255,255,255,.28)}
        .nx-mining-reactor::before,.nx-mining-reactor::after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(116,221,255,.58);inset:-8px;border-left-color:transparent;border-bottom-color:transparent;animation:nxMineSpin 5s linear infinite}.nx-mining-reactor::after{inset:8px;border-color:rgba(255,255,255,.55);border-right-color:transparent;animation-duration:2.7s;animation-direction:reverse}
        .nx-mining-bolt{width:26px;height:40px;background:#efffff;clip-path:polygon(56% 0,18% 52%,45% 52%,34% 100%,82% 39%,54% 39%);filter:drop-shadow(0 0 7px #79eaff) drop-shadow(0 0 13px #139cff)}
        #mineBtn.nx-future-miner #btnText{position:relative;display:block;font-size:20px;line-height:1.05;font-weight:900;letter-spacing:.035em;text-shadow:0 0 18px rgba(99,210,255,.32)}
        #mineBtn.nx-future-miner .sub-text{display:block;margin-top:8px;font-size:10px;letter-spacing:.20em;font-weight:800;color:#8cc8ef;opacity:1}#mineBtn.nx-future-miner .nx-mining-note{display:block;margin-top:8px;color:#5689ad;font-size:9px;font-weight:800;letter-spacing:.13em}
        #mineBtn.nx-future-miner[data-state="active"]{border-color:rgba(79,255,201,.75)!important;background:linear-gradient(115deg,rgba(2,24,32,.98),rgba(3,64,72,.96) 54%,rgba(2,113,93,.94))!important;box-shadow:0 20px 48px rgba(0,187,141,.28),0 0 36px rgba(41,255,194,.14),0 0 0 1px rgba(82,255,205,.13) inset!important}
        #mineBtn.nx-future-miner[data-state="active"] .nx-mining-reactor{background:radial-gradient(circle at 50% 46%,#f3fff9 0 8%,#80ffd1 9% 20%,#00d99c 21% 39%,#053c35 40% 62%,#020d0b 63%);box-shadow:0 0 0 1px rgba(126,255,213,.8),0 0 0 7px rgba(0,215,153,.11),0 0 34px rgba(0,255,184,.68),inset 0 0 22px rgba(255,255,255,.25)}
        #mineBtn.nx-future-miner[data-state="complete"]{border-color:rgba(255,197,85,.78)!important;background:linear-gradient(115deg,rgba(31,20,4,.98),rgba(92,52,4,.96) 55%,rgba(126,75,6,.94))!important;box-shadow:0 20px 48px rgba(218,130,0,.28),0 0 32px rgba(255,187,67,.14)!important}
        #mineBtn.nx-future-miner[data-state="error"]{border-color:rgba(255,95,126,.68)!important;background:linear-gradient(115deg,rgba(32,8,18,.98),rgba(76,12,31,.95),rgba(91,21,39,.94))!important}
        #timer.nx-mining-timer{position:relative;width:max-content;max-width:100%;margin:12px auto 18px;padding:10px 18px;border-radius:999px;border:1px solid rgba(74,169,255,.24);background:rgba(8,25,48,.58);color:#59b5ff;box-shadow:inset 0 0 18px rgba(22,107,255,.06);letter-spacing:.06em;font-size:17px}#timer.nx-mining-timer.nx-complete{color:#ffd06d;border-color:rgba(255,189,72,.38);background:rgba(58,35,6,.58)}#timer.nx-mining-timer.nx-error{color:#ff849a;border-color:rgba(255,91,122,.28);background:rgba(58,7,20,.48)}
        @keyframes nxMineSpin{to{transform:rotate(360deg)}}@keyframes nxMineAura{50%{transform:scale(1.16);opacity:.72}}@keyframes nxMineScan{to{background-position:520px 0,0 0}}
        @media(max-width:520px){#mineBtn.nx-future-miner{min-height:108px;padding:18px 18px 18px 112px!important;border-radius:24px!important}.nx-mining-reactor{left:20px;width:70px;height:70px}#mineBtn.nx-future-miner #btnText{font-size:18px}#mineBtn.nx-future-miner .sub-text{font-size:9px}}
        @media(prefers-reduced-motion:reduce){#mineBtn.nx-future-miner::before,#mineBtn.nx-future-miner::after,.nx-mining-reactor::before,.nx-mining-reactor::after{animation:none!important}}
      `;
      document.head.appendChild(style);
    }

    const button = el('mineBtn');
    const timer = el('timer');
    if (button) {
      button.classList.add('nx-future-miner');
      if (!button.querySelector('.nx-mining-reactor')) {
        const reactor = document.createElement('span');
        reactor.className = 'nx-mining-reactor';
        reactor.setAttribute('aria-hidden', 'true');
        reactor.innerHTML = '<i class="nx-mining-bolt"></i>';
        button.prepend(reactor);
      }
      if (!button.querySelector('.nx-mining-note')) {
        const note = document.createElement('span');
        note.className = 'nx-mining-note';
        note.textContent = 'SECURE NVX REACTOR • FIRESTORE VERIFIED';
        button.appendChild(note);
      }
    }
    timer?.classList.add('nx-mining-timer');
  }

  function formatClock(ms) {
    const left = Math.max(0, ms);
    const h = Math.floor(left / 3_600_000);
    const m = Math.floor((left % 3_600_000) / 60_000);
    const s = Math.floor((left % 60_000) / 1_000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function setVisibleBalance(value) {
    if (!Number.isFinite(Number(value))) return;
    const amount = Number(value);
    if (el('balance')) el('balance').textContent = amount.toFixed(4);
    if (el('walletBalance')) el('walletBalance').textContent = `${amount.toFixed(4)} NVX`;
    if (el('usdValue')) el('usdValue').textContent = `$ ${(amount * 0.10).toFixed(2)} USD`;
    if (el('walletUsd')) el('walletUsd').textContent = `$ ${(amount * 0.10).toFixed(2)} USD`;
  }

  function renderMiningAuthoritative() {
    installMiningVisuals();
    const button = el('mineBtn');
    const text = el('btnText');
    const timer = el('timer');
    if (!button || !text || !timer) return;

    clearInterval(miningTimer);
    miningTimer = null;
    timer.classList.remove('nx-complete', 'nx-error');

    if (!miningState.known) {
      button.dataset.state = syncError ? 'error' : 'ready';
      button.classList.remove('active');
      text.textContent = syncError ? 'RETRY SECURE SYNC' : 'SYNCING MINING';
      timer.classList.toggle('nx-error', Boolean(syncError));
      timer.textContent = syncError ? 'SESSION SYNC DELAYED • TAP TO RETRY' : 'CHECKING SECURE SESSION';
      return;
    }

    if (!miningState.active) {
      button.dataset.state = 'ready';
      button.classList.remove('active');
      text.textContent = 'START MINING';
      timer.textContent = 'MINER OFFLINE';
      setVisibleBalance(miningState.balance);
      return;
    }

    const startedAt = Number(miningState.startedAt) || 0;
    const elapsedNow = Math.max(0, Date.now() - startedAt);
    if (startedAt <= 0 || elapsedNow >= DAY) {
      button.dataset.state = 'complete';
      button.classList.remove('active');
      text.textContent = 'CLAIM + START NEXT';
      timer.classList.add('nx-complete');
      timer.textContent = 'SESSION COMPLETE • TAP TO CONTINUE';
      setVisibleBalance(Number(miningState.balance) + MINING_REWARD);
      return;
    }

    button.dataset.state = 'active';
    button.classList.add('active');
    text.textContent = 'MINING ACTIVE';

    const tick = () => {
      const elapsed = Math.max(0, Date.now() - startedAt);
      const left = Math.max(0, DAY - elapsed);
      if (left <= 0) {
        clearInterval(miningTimer);
        miningTimer = null;
        renderMiningAuthoritative();
        return;
      }
      timer.textContent = formatClock(left);
      const projected = Number(miningState.balance) + Math.min(MINING_REWARD, elapsed / HOUR);
      setVisibleBalance(projected);
    };

    tick();
    miningTimer = setInterval(tick, 1000);
  }

  function adoptState(data = {}) {
    clearSyncTimers();
    syncError = '';
    const balance = Number(data.balance);
    const totalMined = Number(data.totalMined);
    miningState.known = true;
    miningState.active = data.miningActive === true || data.active === true;
    miningState.startedAt = miningState.active
      ? Number(data.miningStartedAt ?? data.startedAt) || 0
      : 0;
    if (Number.isFinite(balance) && balance >= 0) miningState.balance = balance;
    if (Number.isFinite(totalMined) && totalMined >= 0) miningState.totalMined = totalMined;

    try {
      window.nexusApplySecureAccountState?.({
        balance: miningState.balance,
        totalMined: miningState.totalMined
      });
    } catch (error) {
      console.warn('NexusNova non-fatal account display sync:', error);
    }
    renderMiningAuthoritative();
  }

  async function firebaseModules() {
    if (!firebasePromise) {
      const loader = Promise.all([
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
      ]);
      firebasePromise = withTimeout(
        loader,
        SYNC_TIMEOUT_MS,
        'Firebase secure-session modules timed out. Check your internet and tap retry.'
      ).catch(error => {
        firebasePromise = null;
        throw error;
      });
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
    }
    if (!user.emailVerified) throw new Error('Verify your email before using NVX mining.');

    if (write) {
      if (typeof window.nexusRequireAppCheck !== 'function') {
        throw new Error('App Check is unavailable. Reload NexusNova and try again.');
      }
      await window.nexusRequireAppCheck();
    }

    return { app, auth, authMod, user, db: fsMod.getFirestore(app), fsMod };
  }

  function normalizeDoc(data = {}) {
    const balance = Number(data.balance);
    const totalMined = Number(data.totalMined);
    return {
      miningActive: data.miningActive === true,
      miningStartedAt: Number(data.miningStartedAt) || 0,
      balance: Number.isFinite(balance) ? balance : NaN,
      totalMined: Number.isFinite(totalMined) ? totalMined : NaN,
      novaVaultPending: Math.max(0, Math.floor(Number(data.novaVaultPending) || 0))
    };
  }

  async function readState(context) {
    const ref = context.fsMod.doc(context.db, 'users', context.user.uid);
    const snap = await context.fsMod.getDoc(ref);
    if (!snap.exists()) throw new Error('User profile not found.');
    const state = normalizeDoc(snap.data() || {});
    if (!Number.isFinite(state.balance) || state.balance < 0 || !Number.isFinite(state.totalMined) || state.totalMined < 0) {
      throw new Error('Account mining values need repair. No balance was changed.');
    }
    return state;
  }

  async function finishExpired(context) {
    const now = Date.now();
    return context.fsMod.runTransaction(context.db, async tx => {
      const ref = context.fsMod.doc(context.db, 'users', context.user.uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const state = normalizeDoc(snap.data() || {});
      if (!Number.isFinite(state.balance) || !Number.isFinite(state.totalMined)) {
        throw new Error('Account mining values need repair. No balance was changed.');
      }
      if (!state.miningActive) {
        if (state.miningStartedAt !== 0) throw new Error('Mining session state is inconsistent.');
        return { finished:false, ...state };
      }
      if (state.miningStartedAt <= 0) throw new Error('Mining session timestamp is invalid.');
      if (now - state.miningStartedAt < DAY) return { finished:false, ...state };

      const nextBalance = state.balance + MINING_REWARD;
      const nextTotal = state.totalMined + MINING_REWARD;
      const nextVaultPending = state.novaVaultPending + 1;
      tx.update(ref, {
        balance: nextBalance,
        totalMined: nextTotal,
        miningActive: false,
        miningStartedAt: 0,
        miningLastUpdate: now,
        novaVaultPending: nextVaultPending
      });
      return {
        finished:true,
        miningActive:false,
        miningStartedAt:0,
        balance:nextBalance,
        totalMined:nextTotal,
        novaVaultPending:nextVaultPending,
        earned:MINING_REWARD,
        novaVaultEarned:1
      };
    });
  }

  async function repairMalformed(context) {
    const now = Date.now();
    return context.fsMod.runTransaction(context.db, async tx => {
      const ref = context.fsMod.doc(context.db, 'users', context.user.uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const raw = snap.data() || {};
      const active = raw.miningActive === true;
      const startedAt = Number(raw.miningStartedAt) || 0;
      const malformed = (active && startedAt <= 0) || (!active && startedAt !== 0);
      if (!malformed) return normalizeDoc(raw);
      tx.update(ref, {
        miningActive:false,
        miningStartedAt:0,
        miningLastUpdate:now
      });
      return { ...normalizeDoc(raw), miningActive:false, miningStartedAt:0 };
    });
  }

  async function startFresh(context) {
    const now = Date.now();
    return context.fsMod.runTransaction(context.db, async tx => {
      const ref = context.fsMod.doc(context.db, 'users', context.user.uid);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('User profile not found.');
      const state = normalizeDoc(snap.data() || {});
      if (!Number.isFinite(state.balance) || !Number.isFinite(state.totalMined)) {
        throw new Error('Account mining values need repair. No balance was changed.');
      }
      if (state.miningActive) {
        if (state.miningStartedAt <= 0) throw new Error('Mining session timestamp is invalid.');
        return { started:false, alreadyActive:true, ...state };
      }
      if (state.miningStartedAt !== 0) throw new Error('Mining session state is inconsistent.');
      tx.update(ref, {
        miningActive:true,
        miningStartedAt:now,
        miningLastUpdate:now
      });
      return {
        started:true,
        miningActive:true,
        miningStartedAt:now,
        balance:state.balance,
        totalMined:state.totalMined
      };
    });
  }

  function readableError(error) {
    const code = String(error?.code || '');
    const raw = String(error?.message || error || 'Secure mining could not sync.');
    if (/permission-denied/i.test(code) || /missing or insufficient permissions/i.test(raw)) {
      return 'Secure mining rules rejected this update. The app owner needs to publish the current Firestore rules once; normal users do not need to change anything.';
    }
    if (/app.?check/i.test(raw)) return 'Firebase App Check could not verify this session.';
    return raw;
  }

  async function getUI() {
    if (window.NexusNovaUI) return window.NexusNovaUI;
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-nx-premium-ui]');
      const done = () => window.NexusNovaUI ? resolve(window.NexusNovaUI) : reject(new Error('Premium UI did not initialize.'));
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, { once:true });
        setTimeout(done, 1400);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = () => reject(new Error('Premium UI could not be loaded.'));
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  async function showMessage({ title, text, icon='security', buttonText='Got it', eyebrow='MINING STATUS' }) {
    try {
      const ui = await getUI();
      await ui.alert({ title, text, icon, buttonText, eyebrow });
    } catch (_) {
      console.warn(`${title}: ${text}`);
    }
  }

  function postNative(action, payload = {}) {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        return window.nexusPostNativeAction(action, payload);
      }
      if (typeof window.NexusAndroid?.postMessage !== 'function') return false;
      window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function requestMiningStartAdBestEffort() {
    const hasBridge =
      typeof window.NexusAndroid?.postMessage === 'function' ||
      typeof window.nexusPostNativeAction === 'function';
    if (!hasBridge || miningStartAdPending) return Promise.resolve(false);

    miningStartAdPending = true;
    renderMiningAuthoritative();
    return new Promise(resolve => {
      let settled = false;
      let timeout = null;
      const finish = shown => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        window.removeEventListener('nexusnova:native-ad-event', onAdEvent);
        resolve(Boolean(shown));
      };
      const onAdEvent = event => {
        const detail = event?.detail || {};
        if (String(detail.provider || '') !== 'admob') return;
        if (String(detail.placement || '') !== MINING_START_AD_PLACEMENT) return;
        const type = String(detail.event || '');
        if (type === 'interstitial-dismissed') {
          finish(true);
          return;
        }
        if ([
          'interstitial-unavailable', 'interstitial-skipped',
          'interstitial-failed', 'interstitial-load-failed'
        ].includes(type)) finish(false);
      };
      window.addEventListener('nexusnova:native-ad-event', onAdEvent);
      timeout = setTimeout(() => finish(false), MINING_START_AD_TIMEOUT_MS);
      const posted = postNative('showInterstitialAd', {
        placement: MINING_START_AD_PLACEMENT,
        feature: MINING_START_AD_FEATURE,
        reason: MINING_START_AD_PLACEMENT,
        testOnly: false
      });
      if (!posted) finish(false);
    }).finally(() => {
      miningStartAdPending = false;
      renderMiningAuthoritative();
    });
  }

  async function startMining() {
    if (operationPromise) return operationPromise;
    operationPromise = (async () => {
      const button = el('mineBtn');
      if (button) button.disabled = true;
      try {
        const context = await getContext({ write:true });
        let state = await readState(context);
        adoptState(state);

        const malformed =
          (state.miningActive && state.miningStartedAt <= 0) ||
          (!state.miningActive && state.miningStartedAt !== 0);
        if (malformed) {
          state = await repairMalformed(context);
          adoptState(state);
        }

        if (state.miningActive && Date.now() - state.miningStartedAt >= DAY) {
          const finished = await finishExpired(context);
          adoptState(finished);
          state = await readState(context);
        }

        if (state.miningActive) {
          adoptState(state);
          return state;
        }

        // User intent is authoritative: start the secure mining session first.
        // The Android interstitial is attempted immediately afterwards, but ad
        // no-fill/failure/timeout never turns mining back off or requires a
        // second tap. This keeps monetization best-effort and UX frustration low.
        const started = await startFresh(context);
        adoptState(started);
        void requestMiningStartAdBestEffort();
        return started;
      } catch (error) {
        console.error('NexusNova secure mining:', error);
        const message = readableError(error);
        await showMessage({ title:'Mining Could Not Start', text:message });
        try {
          const context = await getContext({ write:false });
          adoptState(await readState(context));
        } catch (_) {
          renderMiningAuthoritative();
        }
        throw error;
      } finally {
        if (button) button.disabled = false;
      }
    })().finally(() => { operationPromise = null; });
    return operationPromise;
  }

  async function finishMining() {
    if (operationPromise) return operationPromise;
    operationPromise = (async () => {
      try {
        const context = await getContext({ write:true });
        const result = await finishExpired(context);
        adoptState(result);
        return result;
      } finally {
        operationPromise = null;
      }
    })();
    return operationPromise;
  }

  async function readMiningStateOnce(user) {
    const [appMod, , fsMod] = await firebaseModules();
    const apps = appMod.getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    const ref = fsMod.doc(fsMod.getFirestore(apps[0]), 'users', user.uid);
    const snap = await withTimeout(
      fsMod.getDoc(ref),
      SYNC_TIMEOUT_MS,
      'Secure session sync timed out. Check your internet and tap retry.'
    );
    if (!snap.exists()) throw new Error('User profile not found.');
    if (user.uid !== currentUid) return null;
    adoptState(snap.data() || {});
    return snap.data() || {};
  }

  function scheduleSyncRetries(user) {
    syncRetryTimers.forEach(clearTimeout);
    syncRetryTimers = SYNC_RETRY_DELAYS_MS.map(delay => setTimeout(() => {
      if (miningState.known || user.uid !== currentUid) return;
      readMiningStateOnce(user).catch(error => {
        console.warn('NexusNova secure mining retry:', error);
        markSyncError(error);
      });
    }, delay));
  }

  async function retrySecureSync({ userInitiated = false } = {}) {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      try {
        const [appMod, authMod] = await firebaseModules();
        const apps = appMod.getApps();
        if (!apps.length) throw new Error('Firebase app is not initialized.');
        const auth = authMod.getAuth(apps[0]);
        const user = auth.currentUser || await waitForUser(authMod, auth);
        if (!user) throw new Error('Please sign in first.');
        currentUid = user.uid;
        markSyncPending();
        return await readMiningStateOnce(user);
      } catch (error) {
        console.warn('NexusNova secure mining manual sync:', error);
        markSyncError(error);
        if (userInitiated) {
          await showMessage({
            eyebrow:'SECURE SESSION',
            title:'Sync Delayed',
            text:readableError(error),
            icon:'security',
            buttonText:'OK'
          });
        }
        throw error;
      } finally {
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  }

  async function subscribeToMining() {
    const [appMod, authMod, fsMod] = await firebaseModules();
    const apps = appMod.getApps();
    if (!apps.length) {
      markSyncError(new Error('Firebase app is not initialized.'));
      return;
    }
    const auth = authMod.getAuth(apps[0]);
    authMod.onAuthStateChanged(auth, user => {
      try { unsubscribeMining?.(); } catch (_) {}
      unsubscribeMining = null;
      clearSyncTimers();
      currentUid = user?.uid || '';
      if (!user) {
        miningState.known = false;
        syncError = 'Sign in is required to sync mining.';
        renderMiningAuthoritative();
        return;
      }

      markSyncPending();
      const ref = fsMod.doc(fsMod.getFirestore(apps[0]), 'users', user.uid);
      unsubscribeMining = fsMod.onSnapshot(ref, snap => {
        if (user.uid !== currentUid) return;
        if (!snap.exists()) {
          markSyncError(new Error('User profile not found.'));
          return;
        }
        adoptState(snap.data() || {});
      }, error => {
        if (user.uid !== currentUid) return;
        console.warn('NexusNova mining state watch:', error);
        markSyncError(error);
        scheduleSyncRetries(user);
      });

      // Firestore listeners can occasionally wait on a weak/mobile connection.
      // A bounded one-shot read gives startup a second path and prevents an
      // infinite CHECKING SECURE SESSION state without changing any NVX value.
      readMiningStateOnce(user).catch(error => {
        if (user.uid !== currentUid || miningState.known) return;
        console.warn('NexusNova initial mining sync:', error);
        markSyncError(error);
        scheduleSyncRetries(user);
      });
    });
  }

  async function callable(name, data={}) {
    if (typeof window.nexusRequireAppCheck !== 'function') throw new Error('App Check is unavailable.');
    await window.nexusRequireAppCheck();
    const [appMod, fnMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js')
    ]);
    const apps = appMod.getApps();
    if (!apps.length) throw new Error('Firebase app is not initialized.');
    return (await fnMod.httpsCallable(fnMod.getFunctions(apps[0]), name)(data)).data || {};
  }

  async function claimDaily() {
    const button = el('dailyBtn');
    if (button) button.disabled = true;
    try {
      const result = await callable('claimDailyReward');
      if (typeof window.nexusApplySecureAccountState === 'function') window.nexusApplySecureAccountState(result);
      await showMessage({ eyebrow:'DAILY REWARD', title:'Reward Added', text:`+${Number(result.reward || 5).toFixed(2)} NVX was added to your secure balance.`, icon:'spark', buttonText:'Great' });
      window.updateDailyButton?.();
    } catch (error) {
      await showMessage({ eyebrow:'DAILY REWARD', title:'Reward Unavailable', text:String(error?.message || 'Daily reward could not be claimed.') });
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function completeTask(taskId) {
    const button = taskId === 'task1' ? el('task1Btn') : null;
    if (button) button.disabled = true;
    try {
      const result = await callable('completeTaskReward', { taskId });
      if (typeof window.nexusApplySecureAccountState === 'function') window.nexusApplySecureAccountState(result);
      await showMessage({ eyebrow:'TASK VERIFIED', title:'Task Reward Added', text:`+${Number(result.reward || 0).toFixed(2)} NVX was added to your secure balance.`, icon:'spark', buttonText:'Done' });
      window.updateTaskButtons?.();
    } catch (error) {
      await showMessage({ eyebrow:'TASK VERIFICATION', title:'Task Could Not Be Verified', text:String(error?.message || 'Task reward could not be claimed.') });
    } finally {
      if (button) button.disabled = false;
    }
  }

  function installHandlers() {
    installMiningVisuals();
    const mine = el('mineBtn');
    if (mine) mine.onclick = () => {
      if (!miningState.known) {
        retrySecureSync({ userInitiated:true }).catch(() => {});
        return;
      }
      startMining().catch(() => {});
    };
    window.claimDailyReward = claimDaily;
    window.completeTask = completeTask;
  }

  // Compatibility contract used by page2-core. Render requests from legacy
  // timers deliberately ignore their stale parameters and render the current
  // Firestore-backed state instead.
  window.nexusSecureStartMining = startMining;
  window.nexusSecureFinishMining = finishMining;
  window.nexusSecureRenderMining = () => renderMiningAuthoritative();
  window.nexusSecureAdoptMiningState = state => {
    if (state && typeof state === 'object') adoptState(state);
    return { ...miningState };
  };
  window.nexusSecureMiningState = () => ({ ...miningState, startAdPending:miningStartAdPending });
  window.nexusSecureSyncMining = async ({ force = false } = {}) => {
    if (!force && miningState.known) return { ...miningState };
    return retrySecureSync({ userInitiated:false });
  };
  window.nexusMiningEngineVersion = 'single-owner-v6-start-first-ad-best-effort-nova-vault';

  installHandlers();
  renderMiningAuthoritative();
  subscribeToMining().catch(error => {
    console.warn('NexusNova mining subscription:', error);
    markSyncError(error);
  });
  window.addEventListener('load', () => {
    installHandlers();
    setTimeout(installHandlers, 1200);
    setTimeout(installHandlers, 3500);
  }, { once:true });

  console.info('NexusNova mining engine loaded: single-owner-v4-sync-watchdog');
})();
