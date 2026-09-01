import { callNovaMiningRewards } from '../../core/nova-mining-rewards-store.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

async function secureCall(name, data = {}) {
  return callNovaMiningRewards(name, data);
}

function rewardText(reward = {}) {
  const type = String(reward.type || 'reward').replace(/-/g, ' ');
  const amount = Number(reward.amount);
  return Number.isFinite(amount) && amount > 0 ? `${type} ${amount}` : type;
}

function callableErrorText(error, fallback = 'Nova Vault request could not be completed.') {
  const code = String(error?.code || '').replace(/^functions\//i, '').trim();
  const raw = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  if (code === 'internal' || /^internal$/i.test(raw)) {
    console.error('[NexusNova Nova Vault] server internal error', error);
    return 'Nova Vault server could not complete this request. No Vault should be consumed. Please retry after the next sync.';
  }
  if (code === 'unavailable') return 'Nova Vault server is temporarily unavailable. Please try again shortly.';
  if (code === 'unauthenticated') return 'Secure session expired. Reopen NexusNova and try again.';
  return (raw || fallback).slice(0, 260);
}

function syncVaultViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
  document.documentElement.style.setProperty('--nova-vault-viewport-height', `${height}px`);
}

function ensureNovaVaultPremiumStyle() {
  if (document.getElementById('nx-nova-vault-premium-v12-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova-vault-premium-v12-style';
  style.textContent = `
    html.nx-vault-premium-active,
    html.nx-vault-premium-active body,
    html.nx-vault-premium-active .nx-app,
    html.nx-vault-premium-active .nx-stage{
      background:#061522!important
    }
    html.nx-vault-premium-active .nx-app{width:100%!important;max-width:none!important;margin:0!important}
    html.nx-vault-premium-active .nx-stage{
      min-height:var(--nova-vault-viewport-height,100dvh)!important;
      padding:0!important;overflow:hidden!important
    }
    .nx-screen.nx-vault-premium-screen{
      position:relative!important;width:100%!important;max-width:none!important;
      height:calc(var(--nova-vault-viewport-height,100dvh) - 68px)!important;
      min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;
      background:linear-gradient(180deg,#081b2a 0%,#061522 46%,#071827 100%)!important;
      color:#eef8ff!important;animation:none!important
    }
    .nx-vault-premium-screen>.nx-app-head{
      position:absolute!important;left:0!important;top:0!important;z-index:60!important;
      width:100%!important;height:58px!important;min-height:58px!important;
      margin:0!important;padding:8px 12px!important;box-sizing:border-box!important;
      display:grid!important;grid-template-columns:42px 36px minmax(0,1fr)!important;
      align-items:center!important;gap:8px!important;border:0!important;border-radius:0!important;
      border-bottom:1px solid rgba(83,205,255,.18)!important;
      background:linear-gradient(180deg,#0a2539,#071c2d)!important;
      box-shadow:0 10px 24px rgba(0,0,0,.22)!important
    }
    .nx-vault-premium-screen>.nx-app-head>.nx-back{
      width:38px!important;height:38px!important;min-width:38px!important;margin:0!important;padding:0!important;
      border:1px solid rgba(89,211,255,.38)!important;border-radius:10px!important;
      background:linear-gradient(180deg,#123f5d,#0a2b43)!important;color:#fff!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 5px 13px rgba(0,0,0,.22)!important;
      font-size:27px!important;line-height:1!important
    }
    .nx-vault-premium-screen>.nx-app-head>.nx-app-head__icon{
      width:32px!important;height:32px!important;display:grid!important;place-items:center!important;
      border:1px solid rgba(75,207,255,.27)!important;border-radius:9px!important;
      background:#0a314b!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important
    }
    .nx-vault-premium-screen>.nx-app-head>div{min-width:0!important}
    .nx-vault-premium-screen>.nx-app-head>div .nx-eyebrow,
    .nx-vault-premium-screen>.nx-app-head>div>p:last-child{display:none!important}
    .nx-vault-premium-screen>.nx-app-head h1{
      margin:0!important;font-size:19px!important;line-height:1!important;font-weight:850!important;
      white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;letter-spacing:.01em!important
    }
    .nx-vault-premium-screen [data-app-mount]{
      position:absolute!important;left:0!important;right:0!important;top:58px!important;bottom:0!important;
      min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;
      background:linear-gradient(180deg,#081b2a 0%,#061522 52%,#071827 100%)!important
    }

    .nx-vault-premium{
      position:absolute;inset:0;box-sizing:border-box;padding:9px 11px 10px;
      display:grid;grid-template-rows:78px 64px minmax(156px,1fr) 104px;
      gap:8px;overflow:hidden;background:linear-gradient(180deg,#081b2a 0%,#061522 52%,#071827 100%);
      font-family:inherit;color:#eef8ff;touch-action:manipulation
    }
    .nx-vault-panel{
      position:relative;min-width:0;min-height:0;box-sizing:border-box;overflow:hidden;
      border:1px solid rgba(114,195,231,.18);border-radius:11px;
      background:linear-gradient(180deg,rgba(12,37,55,.96),rgba(8,27,43,.97));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045),inset 0 -1px 0 rgba(0,0,0,.28),0 9px 22px rgba(0,0,0,.14)
    }
    .nx-vault-panel:before{
      content:"";position:absolute;left:14px;right:14px;top:0;height:1px;
      background:linear-gradient(90deg,transparent,rgba(82,213,255,.54),transparent);pointer-events:none
    }
    .nx-vault-summary{
      display:grid;grid-template-columns:minmax(0,1fr) 128px;align-items:center;padding:10px 13px;gap:10px
    }
    .nx-vault-kicker{display:block;margin-bottom:2px;color:#5edaff;font-size:9px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}
    .nx-vault-count-row{display:flex;align-items:baseline;gap:7px;min-width:0}
    .nx-vault-count{font-size:clamp(34px,8.5vw,55px);line-height:.92;font-weight:950;letter-spacing:-.045em;color:#f6fbff}
    .nx-vault-count-label{font-size:clamp(15px,3.9vw,23px);font-weight:900;letter-spacing:.025em;color:#dcecf5}
    .nx-vault-ready{margin-top:4px;color:#8fb4c7;font-size:9px;font-weight:800;letter-spacing:.04em}
    .nx-vault-boost-badge{
      align-self:stretch;display:flex;flex-direction:column;justify-content:center;min-width:0;padding:9px 10px;
      border:1px solid rgba(222,92,255,.27);border-radius:10px;
      background:linear-gradient(180deg,rgba(53,21,67,.92),rgba(33,16,45,.96));text-align:center;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045)
    }
    .nx-vault-boost-badge strong{display:block;color:#f7e9ff;font-size:14px;font-weight:950;line-height:1.05;letter-spacing:.035em}
    .nx-vault-boost-badge span{display:block;margin-top:5px;color:#d969ef;font-size:7.6px;font-weight:900;line-height:1.2;letter-spacing:.07em;text-transform:uppercase}

    .nx-vault-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .nx-vault-stat{padding:7px;display:grid;grid-template-columns:31px minmax(0,1fr);align-items:center;gap:7px}
    .nx-vault-stat-icon{
      width:31px;height:31px;border:1px solid rgba(83,211,255,.22);border-radius:9px;display:grid;place-items:center;
      background:#0a354f;color:#64e0ff;font-size:16px;font-weight:950;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)
    }
    .nx-vault-stat--purple{border-color:rgba(209,90,240,.17)}
    .nx-vault-stat--purple .nx-vault-stat-icon{border-color:rgba(229,103,255,.23);background:#32143d;color:#ef7aff}
    .nx-vault-stat-name{display:block;color:#91afc1;font-size:7.8px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:.03em}
    .nx-vault-stat-value{display:block;margin-top:2px;font-size:21px;line-height:1;font-weight:950;color:#fff}

    .nx-vault-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;min-height:0}
    .nx-vault-action-card{padding:11px;display:flex;flex-direction:column;justify-content:space-between;gap:7px}
    .nx-vault-action-card--boost{
      border-color:rgba(223,92,255,.22);
      background:linear-gradient(180deg,rgba(46,18,59,.96),rgba(29,14,39,.98))
    }
    .nx-vault-action-card--boost:before{background:linear-gradient(90deg,transparent,rgba(226,91,255,.58),transparent)}
    .nx-vault-action-title{margin:0;color:#64dfff;font-size:12px;font-weight:950;letter-spacing:.075em;text-transform:uppercase}
    .nx-vault-action-card--boost .nx-vault-action-title{color:#ef7cff}
    .nx-vault-action-copy{margin:4px 0 0;color:#aec4d2;font-size:9.4px;line-height:1.34}
    .nx-vault-odds{margin-top:5px;color:#718fa2;font-size:7.4px;font-weight:750;line-height:1.3;letter-spacing:.015em}
    .nx-vault-mode{display:flex;align-items:center;gap:6px;color:#8fbed4;font-size:8px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
    .nx-vault-mode-dot{width:6px;height:6px;border-radius:50%;background:#42d8ff;box-shadow:0 0 8px rgba(66,216,255,.65)}
    .nx-vault-action-card--boost .nx-vault-mode{color:#dc75ef}.nx-vault-action-card--boost .nx-vault-mode-dot{background:#e55cff;box-shadow:0 0 8px rgba(229,92,255,.68)}
    .nx-vault-main-button{
      width:100%;min-height:45px;padding:9px 8px;border:1px solid rgba(82,211,255,.44);border-radius:9px;
      background:linear-gradient(180deg,#12628e,#0a4669);color:#fff;font-size:13px;font-weight:950;letter-spacing:.045em;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.11),inset 0 -2px 0 rgba(0,0,0,.22),0 6px 13px rgba(0,0,0,.18)
    }
    .nx-vault-main-button--boost{border-color:rgba(235,105,255,.44);background:linear-gradient(180deg,#7d2697,#541867)}

    .nx-vault-inventory{padding:8px 9px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px}
    .nx-vault-inventory-title{margin:0;text-align:center;color:#55d7ff;font-size:9.5px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
    .nx-vault-inventory-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;min-height:0}
    .nx-vault-small-button{
      min-width:0;min-height:0;padding:6px 4px;border:1px solid rgba(82,191,231,.22);border-radius:9px;
      background:linear-gradient(180deg,#0c344c,#08283d);color:#d9f4ff;font-size:8px;font-weight:900;line-height:1.18;letter-spacing:.015em;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.035)
    }
    .nx-vault-small-button:nth-child(3),.nx-vault-small-button:nth-child(4){border-color:rgba(208,83,239,.19);background:linear-gradient(180deg,#2d1538,#21102c);color:#edc6f7}
    .nx-vault-premium button:active:not(:disabled){transform:translateY(1px)}
    .nx-vault-premium button:disabled{opacity:.38;filter:saturate(.55)}

    .nx-vault-live-status{
      position:absolute;left:18px;right:18px;bottom:12px;z-index:80;min-height:38px;padding:9px 12px;box-sizing:border-box;
      border:1px solid rgba(87,205,255,.38);border-radius:9px;background:rgba(6,26,40,.98);box-shadow:0 10px 28px rgba(0,0,0,.42);
      color:#e4f9ff;font-size:10px;font-weight:760;line-height:1.35;text-align:center;opacity:0;transform:translateY(7px);
      pointer-events:none;transition:opacity .16s ease,transform .16s ease
    }
    .nx-vault-live-status.is-visible{opacity:1;transform:none}

    @media(max-height:720px){
      .nx-vault-premium{padding:7px 9px 8px;gap:6px;grid-template-rows:70px 58px minmax(138px,1fr) 92px}
      .nx-vault-action-card{padding:9px}.nx-vault-action-copy{font-size:8.7px}.nx-vault-odds{font-size:7px}
      .nx-vault-main-button{min-height:41px;font-size:12px}.nx-vault-inventory{padding:7px}.nx-vault-small-button{font-size:7.4px}
    }
    @media(max-width:360px){
      .nx-vault-premium{padding-left:8px;padding-right:8px}.nx-vault-summary{grid-template-columns:minmax(0,1fr) 108px;padding:9px 10px}
      .nx-vault-stat{grid-template-columns:27px minmax(0,1fr);gap:5px;padding:6px 5px}.nx-vault-stat-icon{width:27px;height:27px;font-size:14px}
      .nx-vault-stat-value{font-size:19px}.nx-vault-boost-badge{padding:7px}.nx-vault-boost-badge strong{font-size:12px}.nx-vault-boost-badge span{font-size:6.8px}
    }
    @media(prefers-reduced-motion:reduce){.nx-vault-live-status{transition:none}.nx-vault-premium button{transition:none!important}}
  `;
  document.head.appendChild(style);
}

function installPremiumScreen(root) {
  let screen = null;
  const apply = () => {
    if (!root.isConnected) return;
    screen = root.closest('.nx-screen');
    if (!screen) return;
    screen.classList.add('nx-vault-premium-screen');
    document.documentElement.classList.add('nx-vault-premium-active');
    syncVaultViewportHeight();
  };
  queueMicrotask(apply);
  requestAnimationFrame(apply);
  window.visualViewport?.addEventListener('resize', syncVaultViewportHeight);
  window.addEventListener('resize', syncVaultViewportHeight);
  return () => {
    screen?.classList.remove('nx-vault-premium-screen');
    document.documentElement.classList.remove('nx-vault-premium-active');
    document.documentElement.style.removeProperty('--nova-vault-viewport-height');
    window.visualViewport?.removeEventListener('resize', syncVaultViewportHeight);
    window.removeEventListener('resize', syncVaultViewportHeight);
  };
}

export function renderNovaVaultSafe() {
  ensureNovaVaultPremiumStyle();
  const root = document.createElement('div');
  root.className = 'nx-vault-premium';
  root.dataset.vaultV3Integrated = 'true';
  root.dataset.vaultPremiumV12 = 'true';
  root.innerHTML = `
    <section class="nx-vault-panel nx-vault-summary" aria-label="Nova Vault summary">
      <div>
        <span class="nx-vault-kicker">Nova Reward System</span>
        <div class="nx-vault-count-row"><strong class="nx-vault-count" data-vault-pending>7</strong><span class="nx-vault-count-label">VAULTS</span></div>
        <div class="nx-vault-ready">READY TO OPEN</div>
      </div>
      <div class="nx-vault-boost-badge"><strong>10X BOOST</strong><span>Rewarded Ad Premium Pool</span></div>
    </section>

    <section class="nx-vault-stats" aria-label="Nova inventory counts">
      <div class="nx-vault-panel nx-vault-stat"><span class="nx-vault-stat-icon">⚡</span><div><span class="nx-vault-stat-name">Booster</span><strong class="nx-vault-stat-value" data-vault-booster>0</strong></div></div>
      <div class="nx-vault-panel nx-vault-stat"><span class="nx-vault-stat-icon">☁</span><div><span class="nx-vault-stat-name">Nova Rain</span><strong class="nx-vault-stat-value" data-vault-rain>0</strong></div></div>
      <div class="nx-vault-panel nx-vault-stat nx-vault-stat--purple"><span class="nx-vault-stat-icon">◷</span><div><span class="nx-vault-stat-name">Time Warp</span><strong class="nx-vault-stat-value" data-vault-warp>0</strong></div></div>
    </section>

    <section class="nx-vault-actions">
      <article class="nx-vault-panel nx-vault-action-card">
        <div>
          <h2 class="nx-vault-action-title">Open Your Vault</h2>
          <p class="nx-vault-action-copy">Open one earned Vault with the normal secure reward pool.</p>
          <p class="nx-vault-odds">NVX 60% • Booster 18% • Rain 17% • Warp 5%</p>
        </div>
        <div class="nx-vault-mode"><span class="nx-vault-mode-dot"></span><span>NORMAL REWARD POOL</span></div>
        <button class="nx-vault-main-button" type="button" data-vault-open>OPEN VAULT</button>
      </article>

      <article class="nx-vault-panel nx-vault-action-card nx-vault-action-card--boost">
        <div>
          <h2 class="nx-vault-action-title">10X Boost</h2>
          <p class="nx-vault-action-copy">Watch a rewarded ad. After signed verification, one Vault opens directly from the premium weighted pool.</p>
          <p class="nx-vault-odds">NVX 13.0% • Booster 39.1% • Rain 37.0% • Warp 10.9%</p>
        </div>
        <div class="nx-vault-mode"><span class="nx-vault-mode-dot"></span><span>AD → DIRECT BOOSTED REWARD</span></div>
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

  const removeScreenClass = installPremiumScreen(root);
  const refs = {
    pending: root.querySelector('[data-vault-pending]'),
    booster: root.querySelector('[data-vault-booster]'),
    rain: root.querySelector('[data-vault-rain]'),
    warp: root.querySelector('[data-vault-warp]'),
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
  let internalBoostGrants = 0;
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
    refs.open.disabled = busy || pending < 1;
    refs.watch.disabled = busy || pending < 1;
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
        internalBoostGrants = Math.max(0, Math.floor(Number(data.novaVaultBoostCredits) || 0));
        paint();
      }, error => announce(callableErrorText(error, 'Could not sync Nova inventory.'), 4500));
      if (!active) unsubscribe();
      else off = unsubscribe;
    } catch (error) {
      announce(callableErrorText(error, 'Could not sync Nova inventory.'), 4500);
    }
  };

  const waitForFreshBoostGrant = async before => {
    const deadline = Date.now() + 12_000;
    while (active && Date.now() < deadline) {
      if (internalBoostGrants > before) return true;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return active && internalBoostGrants > before;
  };

  refs.open.addEventListener('click', async () => {
    if (!active || busy || pending < 1) return;
    setBusy(true);
    announce('Opening secure Vault…', 0);
    try {
      const result = await secureCall('openNovaVault');
      if (active) announce(`✓ Vault opened • ${rewardText(result.reward)}.`, 4800);
    } catch (error) {
      if (active) announce(callableErrorText(error), 5400);
    } finally {
      if (active) setBusy(false);
      else busy = false;
    }
  });

  refs.watch.addEventListener('click', async () => {
    if (!active || busy || pending < 1) return;
    setBusy(true);
    try {
      const user = await requireFirebaseUser({ write:true });
      const before = internalBoostGrants;
      announce('Opening rewarded ad for 10X…', 0);
      const adResult = await nativeAds.showRewarded({ purpose:'nova-vault-10x', userId:user.uid });
      if (!adResult.earned) throw new Error('Ad closed before completion. No boosted Vault was opened.');
      if (!active) return;
      if (adResult.testMode || nativeAds.status().testMode) {
        announce('✓ TEST ad completed. Production signed verification is required before a real 10X reward can be granted.', 5200);
        return;
      }

      announce('Ad completed • verifying securely…', 0);
      const verified = await waitForFreshBoostGrant(before);
      if (!active) return;
      if (!verified) throw new Error('Signed 10X verification has not arrived yet. Please try again shortly.');

      announce('Verified • opening boosted Vault…', 0);
      const result = await secureCall('openNovaVaultBoosted', { source:'fresh-rebuild-premium-v12' });
      if (active) announce(`✓ 10X Vault opened • ${rewardText(result.reward)}.`, 5200);
    } catch (error) {
      if (active) announce(callableErrorText(error, '10X rewarded flow could not be completed.'), 5600);
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
      if (active) announce(callableErrorText(error, `${label} could not be completed.`), 5200);
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
