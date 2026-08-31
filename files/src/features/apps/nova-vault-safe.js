import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

async function secureCall(name, data = {}) {
  await requireFirebaseUser({ write:true });
  const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), name);
  const response = await call(data);
  return response?.data || {};
}

function rewardText(reward = {}) {
  const type = String(reward.type || 'reward').replace(/-/g, ' ');
  const amount = Number(reward.amount);
  return Number.isFinite(amount) && amount > 0 ? `${type} ${amount}` : type;
}

function syncVaultViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
  document.documentElement.style.setProperty('--nova-vault-viewport-height', `${height}px`);
}

function ensureNovaVaultSimpleStyle() {
  if (document.getElementById('nx-nova-vault-simple-v10-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova-vault-simple-v10-style';
  style.textContent = `
    html.nx-vault-simple-active .nx-app{width:100%!important;max-width:none!important;margin:0!important}
    html.nx-vault-simple-active .nx-stage{
      min-height:var(--nova-vault-viewport-height,100dvh)!important;
      padding:0!important;scroll-padding:0!important;overflow:hidden!important
    }
    .nx-screen.nx-vault-simple-screen{
      position:relative!important;width:100%!important;max-width:none!important;
      height:calc(var(--nova-vault-viewport-height,100dvh) - 68px - env(safe-area-inset-bottom))!important;
      min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;
      background:linear-gradient(180deg,#071d31 0%,#061827 52%,#071b2d 100%)!important;
      color:#eef8ff!important;animation:none!important
    }
    .nx-vault-simple-screen>.nx-app-head{
      position:absolute!important;left:0!important;top:0!important;z-index:60!important;
      width:100%!important;height:58px!important;min-height:58px!important;
      margin:0!important;padding:8px 12px!important;box-sizing:border-box!important;
      display:grid!important;grid-template-columns:44px 38px minmax(0,1fr)!important;align-items:center!important;gap:8px!important;
      border:0!important;border-bottom:1px solid rgba(67,196,255,.24)!important;border-radius:0!important;
      background:linear-gradient(180deg,#0a2b47,#082139)!important;
      box-shadow:0 8px 22px rgba(0,0,0,.18)!important
    }
    .nx-vault-simple-screen>.nx-app-head>.nx-back{
      width:40px!important;height:40px!important;min-width:40px!important;margin:0!important;padding:0!important;
      border:1px solid rgba(90,203,255,.35)!important;border-radius:12px!important;
      background:linear-gradient(180deg,#12496f,#0a3150)!important;color:#fff!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important;font-size:28px!important;line-height:1!important
    }
    .nx-vault-simple-screen>.nx-app-head>.nx-app-head__icon{
      width:34px!important;height:34px!important;display:grid!important;place-items:center!important;
      border:1px solid rgba(75,210,255,.3)!important;border-radius:10px!important;background:#0b3857!important
    }
    .nx-vault-simple-screen>.nx-app-head>div{min-width:0!important}
    .nx-vault-simple-screen>.nx-app-head>div .nx-eyebrow,
    .nx-vault-simple-screen>.nx-app-head>div>p:last-child{display:none!important}
    .nx-vault-simple-screen>.nx-app-head h1{
      margin:0!important;font-size:19px!important;line-height:1!important;white-space:nowrap!important;
      overflow:hidden!important;text-overflow:ellipsis!important;letter-spacing:.01em!important
    }
    .nx-vault-simple-screen [data-app-mount]{
      position:absolute!important;left:0!important;right:0!important;top:58px!important;bottom:0!important;
      min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;
      background:transparent!important
    }
    .nx-vault-simple{
      position:absolute;inset:0;box-sizing:border-box;padding:9px 11px 10px;
      display:grid;grid-template-rows:minmax(74px,.86fr) minmax(68px,.74fr) minmax(150px,1.55fr) minmax(104px,1.05fr);
      gap:8px;overflow:hidden;background:linear-gradient(180deg,#071d31,#061827 55%,#071b2d);
      font-family:inherit;color:#eef8ff;touch-action:manipulation
    }
    .nx-vault-panel{
      min-width:0;min-height:0;box-sizing:border-box;border:1px solid rgba(83,191,238,.26);border-radius:16px;
      background:linear-gradient(145deg,#0d3552,#0a2941);box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 8px 20px rgba(0,0,0,.12)
    }
    .nx-vault-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:10px 13px;gap:10px}
    .nx-vault-kicker{display:block;margin-bottom:2px;color:#5ad8ff;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    .nx-vault-count-row{display:flex;align-items:baseline;gap:7px;min-width:0}
    .nx-vault-count{font-size:clamp(34px,8.4vw,58px);line-height:.92;font-weight:950;letter-spacing:-.04em}
    .nx-vault-count-label{font-size:clamp(16px,4vw,25px);font-weight:900;letter-spacing:.02em}
    .nx-vault-ready{margin-top:3px;color:#a8c9dc;font-size:10px;font-weight:700}
    .nx-vault-credit-card{
      min-width:94px;padding:9px 10px;border:1px solid rgba(223,84,255,.36);border-radius:13px;
      background:linear-gradient(145deg,#3a1854,#24143f);text-align:center
    }
    .nx-vault-credit-number{display:block;font-size:17px;font-weight:950;line-height:1.05;color:#fff}
    .nx-vault-credit-label{display:block;margin-top:4px;font-size:9px;font-weight:900;letter-spacing:.08em;color:#e26aff;text-transform:uppercase}

    .nx-vault-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .nx-vault-stat{min-width:0;padding:8px 7px;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:7px}
    .nx-vault-stat-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#0e4a70;color:#5de0ff;font-size:18px;font-weight:900}
    .nx-vault-stat--purple .nx-vault-stat-icon{background:#45175f;color:#ee73ff}
    .nx-vault-stat-name{display:block;color:#a9c4d6;font-size:8.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
    .nx-vault-stat-value{display:block;margin-top:2px;font-size:23px;line-height:1;font-weight:950;color:#fff}

    .nx-vault-actions{display:grid;grid-template-columns:minmax(0,1.03fr) minmax(0,.97fr);gap:8px;min-height:0}
    .nx-vault-action-card{min-width:0;min-height:0;padding:11px;display:flex;flex-direction:column;justify-content:space-between;gap:7px}
    .nx-vault-action-card--boost{border-color:rgba(222,79,255,.32);background:linear-gradient(145deg,#32164b,#22113c)}
    .nx-vault-action-title{margin:0;color:#60dcff;font-size:13px;font-weight:950;letter-spacing:.055em;text-transform:uppercase}
    .nx-vault-action-card--boost .nx-vault-action-title{color:#ed72ff}
    .nx-vault-action-copy{margin:0;color:#b9cddd;font-size:10px;line-height:1.32}
    .nx-vault-mode{display:flex;align-items:center;gap:6px;color:#9fd3eb;font-size:9px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
    .nx-vault-mode-dot{width:7px;height:7px;border-radius:50%;background:#44d6ff;box-shadow:0 0 9px rgba(68,214,255,.7)}
    .nx-vault-mode.is-boosted{color:#ef78ff}.nx-vault-mode.is-boosted .nx-vault-mode-dot{background:#e458ff;box-shadow:0 0 9px rgba(228,88,255,.72)}
    .nx-vault-main-button{
      width:100%;min-height:47px;padding:9px 8px;border:1px solid rgba(87,216,255,.5);border-radius:13px;
      background:linear-gradient(180deg,#1471a8,#0c4f79);color:#fff;font-size:14px;font-weight:950;letter-spacing:.035em;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 5px 14px rgba(0,83,134,.2)
    }
    .nx-vault-main-button--boost{border-color:rgba(236,105,255,.5);background:linear-gradient(180deg,#8e28ad,#5c177d);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 5px 14px rgba(113,20,140,.2)}

    .nx-vault-inventory{padding:9px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:7px}
    .nx-vault-inventory-title{margin:0;text-align:center;color:#59d8ff;font-size:11px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
    .nx-vault-inventory-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:6px;min-height:0}
    .nx-vault-small-button{
      min-width:0;min-height:0;padding:7px;border:1px solid rgba(77,188,232,.28);border-radius:11px;
      background:linear-gradient(180deg,#0f4262,#0b304b);color:#dff8ff;font-size:9.2px;font-weight:900;line-height:1.12;letter-spacing:.025em
    }
    .nx-vault-small-button:nth-child(3),.nx-vault-small-button:nth-child(4){border-color:rgba(207,80,239,.28);background:linear-gradient(180deg,#35184c,#27133d);color:#f2c8ff}
    .nx-vault-simple button:active:not(:disabled){transform:scale(.985)}
    .nx-vault-simple button:disabled{opacity:.42;filter:saturate(.65)}
    .nx-vault-live-status{
      position:absolute;left:18px;right:18px;bottom:13px;z-index:80;min-height:38px;padding:9px 12px;box-sizing:border-box;
      border:1px solid rgba(87,205,255,.42);border-radius:11px;background:rgba(8,41,64,.97);box-shadow:0 8px 24px rgba(0,0,0,.32);
      color:#e4f9ff;font-size:10px;font-weight:750;line-height:1.35;text-align:center;opacity:0;transform:translateY(8px);
      pointer-events:none;transition:opacity .16s ease,transform .16s ease
    }
    .nx-vault-live-status.is-visible{opacity:1;transform:none}
    @media(max-height:690px){
      .nx-vault-simple{padding:7px 9px 8px;gap:6px;grid-template-rows:minmax(66px,.82fr) minmax(60px,.68fr) minmax(132px,1.45fr) minmax(94px,.98fr)}
      .nx-vault-panel{border-radius:13px}.nx-vault-summary{padding:8px 10px}.nx-vault-action-card{padding:9px}
      .nx-vault-action-copy{font-size:9px}.nx-vault-main-button{min-height:42px;font-size:13px}.nx-vault-small-button{font-size:8.6px}
    }
    @media(max-width:360px){
      .nx-vault-simple{padding-left:8px;padding-right:8px}.nx-vault-stat{grid-template-columns:28px minmax(0,1fr);gap:5px;padding:6px 5px}
      .nx-vault-stat-icon{width:28px;height:28px;font-size:15px}.nx-vault-stat-value{font-size:20px}.nx-vault-credit-card{min-width:82px;padding:8px}
    }
    @media(prefers-reduced-motion:reduce){.nx-vault-live-status{transition:none}.nx-vault-simple button{transition:none!important}}
  `;
  document.head.appendChild(style);
}

function installSimpleScreen(root) {
  let screen = null;
  const apply = () => {
    if (!root.isConnected) return;
    screen = root.closest('.nx-screen');
    if (!screen) return;
    screen.classList.add('nx-vault-simple-screen');
    document.documentElement.classList.add('nx-vault-simple-active');
    syncVaultViewportHeight();
  };
  queueMicrotask(apply);
  requestAnimationFrame(apply);
  window.visualViewport?.addEventListener('resize', syncVaultViewportHeight);
  window.addEventListener('resize', syncVaultViewportHeight);
  return () => {
    screen?.classList.remove('nx-vault-simple-screen');
    document.documentElement.classList.remove('nx-vault-simple-active');
    document.documentElement.style.removeProperty('--nova-vault-viewport-height');
    window.visualViewport?.removeEventListener('resize', syncVaultViewportHeight);
    window.removeEventListener('resize', syncVaultViewportHeight);
  };
}

export function renderNovaVaultSafe() {
  ensureNovaVaultSimpleStyle();
  const root = document.createElement('div');
  root.className = 'nx-vault-simple';
  root.dataset.vaultV3Integrated = 'true';
  root.dataset.vaultSimpleV10 = 'true';
  root.innerHTML = `
    <section class="nx-vault-panel nx-vault-summary" aria-label="Nova Vault summary">
      <div>
        <span class="nx-vault-kicker">Nova Reward System</span>
        <div class="nx-vault-count-row"><strong class="nx-vault-count" data-vault-pending>7</strong><span class="nx-vault-count-label">VAULTS</span></div>
        <div class="nx-vault-ready">READY TO OPEN</div>
      </div>
      <div class="nx-vault-credit-card">
        <strong class="nx-vault-credit-number" data-vault-credits>0 CREDITS</strong>
        <span class="nx-vault-credit-label">10X BOOST</span>
      </div>
    </section>

    <section class="nx-vault-stats" aria-label="Nova inventory counts">
      <div class="nx-vault-panel nx-vault-stat"><span class="nx-vault-stat-icon">⚡</span><div><span class="nx-vault-stat-name">Booster</span><strong class="nx-vault-stat-value" data-vault-booster>0</strong></div></div>
      <div class="nx-vault-panel nx-vault-stat"><span class="nx-vault-stat-icon">☁</span><div><span class="nx-vault-stat-name">Nova Rain</span><strong class="nx-vault-stat-value" data-vault-rain>0</strong></div></div>
      <div class="nx-vault-panel nx-vault-stat nx-vault-stat--purple"><span class="nx-vault-stat-icon">◷</span><div><span class="nx-vault-stat-name">Time Warp</span><strong class="nx-vault-stat-value" data-vault-warp>0</strong></div></div>
    </section>

    <section class="nx-vault-actions">
      <article class="nx-vault-panel nx-vault-action-card">
        <div><h2 class="nx-vault-action-title">Open Your Vault</h2><p class="nx-vault-action-copy">Open an earned Vault for a secure server-selected reward.</p></div>
        <div class="nx-vault-mode" data-vault-mode><span class="nx-vault-mode-dot"></span><span data-vault-mode-text>NORMAL VAULT MODE</span></div>
        <button class="nx-vault-main-button" type="button" data-vault-open>OPEN VAULT</button>
      </article>
      <article class="nx-vault-panel nx-vault-action-card nx-vault-action-card--boost">
        <div><h2 class="nx-vault-action-title">10X Boost</h2><p class="nx-vault-action-copy">Watch a rewarded ad to upgrade your next Vault opening to the secure 10X pool.</p></div>
        <div class="nx-vault-mode" data-vault-boost-state><span class="nx-vault-mode-dot"></span><span data-vault-boost-text>10X BOOST NOT ACTIVE</span></div>
        <button class="nx-vault-main-button nx-vault-main-button--boost" type="button" data-vault-watch>WATCH AD FOR 10X</button>
      </article>
    </section>

    <section class="nx-vault-panel nx-vault-inventory">
      <h2 class="nx-vault-inventory-title">Boost Inventory</h2>
      <div class="nx-vault-inventory-grid">
        <button class="nx-vault-small-button" type="button" data-vault-boost>USE BOOSTER</button>
        <button class="nx-vault-small-button" type="button" data-vault-rain-use>USE NOVA RAIN</button>
        <button class="nx-vault-small-button" type="button" data-vault-warp-use>USE TIME WARP</button>
        <button class="nx-vault-small-button" type="button" data-vault-warp-use>USE 24H TIME WARP</button>
      </div>
    </section>

    <div class="nx-vault-live-status" data-vault-status role="status" aria-live="polite"></div>
  `;

  const removeScreenClass = installSimpleScreen(root);
  const refs = {
    pending: root.querySelector('[data-vault-pending]'),
    booster: root.querySelector('[data-vault-booster]'),
    rain: root.querySelector('[data-vault-rain]'),
    warp: root.querySelector('[data-vault-warp]'),
    credits: root.querySelector('[data-vault-credits]'),
    mode: root.querySelector('[data-vault-mode]'),
    modeText: root.querySelector('[data-vault-mode-text]'),
    boostState: root.querySelector('[data-vault-boost-state]'),
    boostText: root.querySelector('[data-vault-boost-text]'),
    open: root.querySelector('[data-vault-open]'),
    watch: root.querySelector('[data-vault-watch]'),
    status: root.querySelector('[data-vault-status]'),
    boostButtons: [...root.querySelectorAll('[data-vault-boost]')],
    rainButtons: [...root.querySelectorAll('[data-vault-rain-use]')],
    warpButtons: [...root.querySelectorAll('[data-vault-warp-use]')]
  };

  let off = null;
  let active = true;
  let busy = false;
  let pending = 7;
  let booster = 0;
  let rain = 0;
  let warp = 0;
  let credits = 0;
  let statusTimer = null;

  const announce = (message, hold = 3400) => {
    if (!active) return;
    refs.status.textContent = message || '';
    refs.status.classList.toggle('is-visible', Boolean(message));
    clearTimeout(statusTimer);
    if (message && hold > 0) {
      statusTimer = setTimeout(() => {
        if (!active) return;
        refs.status.classList.remove('is-visible');
      }, hold);
    }
  };

  const paint = () => {
    if (!active) return;
    refs.pending.textContent = String(pending);
    refs.booster.textContent = String(booster);
    refs.rain.textContent = String(rain);
    refs.warp.textContent = String(warp);
    refs.credits.textContent = `${credits} CREDIT${credits === 1 ? '' : 'S'}`;

    const boosted = credits > 0;
    refs.mode.classList.toggle('is-boosted', boosted);
    refs.modeText.textContent = boosted ? '10X VAULT READY' : 'NORMAL VAULT MODE';
    refs.boostState.classList.toggle('is-boosted', boosted);
    refs.boostText.textContent = boosted ? `10X BOOST ACTIVE • ${credits} CREDIT${credits === 1 ? '' : 'S'}` : '10X BOOST NOT ACTIVE';

    refs.open.disabled = busy || pending < 1;
    refs.watch.disabled = busy || credits >= 3;
    refs.boostButtons.forEach(button => { button.disabled = busy || booster < 1; });
    refs.rainButtons.forEach(button => { button.disabled = busy || rain < 1; });
    refs.warpButtons.forEach(button => { button.disabled = busy || warp < 1; });
  };

  const setBusy = value => {
    busy = Boolean(value);
    paint();
  };

  const bind = async () => {
    try {
      const user = await requireFirebaseUser();
      if (!active) return;
      const unsubscribe = onSnapshot(doc(firestoreDb, 'users', user.uid), snap => {
        if (!active) return;
        const data = snap.data() || {};
        pending = Math.max(0, Math.floor(Number(data.novaVaultPending) || 0));
        booster = Math.max(0, Math.floor(Number(data.novaBoosterInventory) || 0));
        rain = Math.max(0, Math.floor(Number(data.novaRainInventory) || 0));
        warp = Math.max(0, Math.floor(Number(data.novaTimeWarpInventory) || 0));
        credits = Math.max(0, Math.floor(Number(data.novaVaultBoostCredits) || 0));
        paint();
      }, error => announce(error?.message || 'Could not sync Nova inventory.', 4500));
      if (!active) unsubscribe();
      else off = unsubscribe;
    } catch (error) {
      announce(error?.message || 'Could not sync Nova inventory.', 4500);
    }
  };

  const waitForCredit = async before => {
    const deadline = Date.now() + 12_000;
    while (active && Date.now() < deadline) {
      if (credits > before) return true;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    return active && credits > before;
  };

  refs.open.addEventListener('click', async () => {
    if (!active || busy || pending < 1) return;
    const boosted = credits > 0;
    setBusy(true);
    announce(boosted ? 'Opening secure 10X Vault…' : 'Opening secure Vault…', 0);
    try {
      const result = await secureCall(
        boosted ? 'openNovaVaultBoosted' : 'openNovaVault',
        boosted ? { source:'fresh-rebuild-simple-v10' } : {}
      );
      if (active) announce(`✓ ${boosted ? '10X ' : ''}Vault opened • ${rewardText(result.reward)}.`, 4800);
    } catch (error) {
      if (active) announce(String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260), 5200);
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  });

  refs.watch.addEventListener('click', async () => {
    if (!active || busy || credits >= 3) return;
    setBusy(true);
    try {
      const user = await requireFirebaseUser({ write:true });
      const before = credits;
      announce('Opening rewarded ad for secure 10X verification…', 0);
      const result = await nativeAds.showRewarded({ purpose:'nova-vault-10x', userId:user.uid });
      if (!result.earned) throw new Error('Ad closed before reward completion. No 10X credit was created.');
      if (!active) return;
      if (result.testMode || nativeAds.status().testMode) {
        announce('✓ TEST ad completed. Production SSV is required for a secure 10X credit.', 5200);
        return;
      }
      announce('Ad completed • waiting for signed server verification…', 0);
      const verified = await waitForCredit(before);
      if (!active) return;
      if (!verified) throw new Error('The signed 10X credit has not arrived yet. Check again shortly.');
      announce('✓ Secure 10X boost active. OPEN VAULT will use the boosted reward pool.', 5200);
    } catch (error) {
      if (active) announce(error?.message || '10X rewarded flow could not be completed.', 5200);
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  });

  const runInventory = async (label, name, data = {}) => {
    if (!active || busy) return;
    setBusy(true);
    announce(`${label} • secure server request…`, 0);
    try {
      await secureCall(name, data);
      if (active) announce(`✓ ${label} completed.`, 4000);
    } catch (error) {
      if (active) announce(String(error?.message || error).replace(/^FirebaseError:\s*/i, '').slice(0, 260), 5000);
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  };

  refs.boostButtons.forEach(button => button.addEventListener('click', () => runInventory('Using Booster', 'useNovaBoost', { kind:'booster' })));
  refs.rainButtons.forEach(button => button.addEventListener('click', () => runInventory('Using Nova Rain', 'useNovaBoost', { kind:'rain' })));
  refs.warpButtons.forEach(button => button.addEventListener('click', () => runInventory('Using Time Warp', 'useNovaTimeWarp')));

  nativeAds.requestStatus();
  bind();
  paint();

  root.__cleanup = () => {
    active = false;
    clearTimeout(statusTimer);
    off?.();
    off = null;
    removeScreenClass();
  };
  return root;
}

export const novaVaultSafeRenderers = Object.freeze({ 'nova-vault': renderNovaVaultSafe });
