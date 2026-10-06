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

function callableErrorText(error, fallback = 'Nova Vault request could not be completed.') {
  const code = String(error?.code || '').replace(/^functions\//i, '').trim();
  const raw = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  if (code === 'internal' || /^internal$/i.test(raw)) {
    console.error('[NexusNova Nova Vault] server internal error', error);
    return 'Secure Vault service hit a server error. Nothing was consumed.';
  }
  if (code === 'unavailable') return 'Vault service is temporarily unavailable.';
  if (code === 'unauthenticated') return 'Secure session expired. Reopen NexusNova and try again.';
  return (raw || fallback).slice(0, 220);
}

function syncViewport() {
  const h = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
  document.documentElement.style.setProperty('--nova-vault-viewport-height', `${h}px`);
}

function ensureStyle() {
  if (document.getElementById('nx-vault-living-v14-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-vault-living-v14-style';
  style.textContent = `
    @keyframes nxVaultBreath{0%,100%{transform:scale(.985);filter:brightness(.94)}50%{transform:scale(1.018);filter:brightness(1.08)}}
    @keyframes nxVaultOrbit{to{transform:rotate(360deg)}}
    @keyframes nxVaultFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    @keyframes nxVaultPulse{0%,100%{opacity:.48;transform:scale(.9)}50%{opacity:1;transform:scale(1.12)}}
    @keyframes nxInventoryPulse{0%,100%{box-shadow:0 0 0 rgba(63,215,255,0)}50%{box-shadow:0 0 18px rgba(63,215,255,.10)}}

    html.nx-vault-living-active,html.nx-vault-living-active body,html.nx-vault-living-active .nx-app,html.nx-vault-living-active .nx-stage{background:#04111c!important}
    html.nx-vault-living-active .nx-stage{min-height:var(--nova-vault-viewport-height,100dvh)!important;padding:0!important;overflow:hidden!important}
    .nx-screen.nx-vault-living-screen{position:relative!important;width:100%!important;max-width:none!important;height:calc(var(--nova-vault-viewport-height,100dvh) - 68px)!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#04111c!important;color:#f4fbff!important}
    .nx-vault-living-screen>.nx-app-head{position:absolute!important;inset:0 0 auto 0!important;z-index:30!important;height:58px!important;min-height:58px!important;margin:0!important;padding:8px 12px!important;box-sizing:border-box!important;display:grid!important;grid-template-columns:42px 36px minmax(0,1fr)!important;align-items:center!important;gap:8px!important;border:0!important;border-bottom:1px solid rgba(90,221,255,.18)!important;border-radius:0!important;background:linear-gradient(180deg,#0a2740,#061927)!important;box-shadow:0 8px 24px rgba(0,0,0,.24)!important}
    .nx-vault-living-screen>.nx-app-head>.nx-back{width:38px!important;height:38px!important;min-width:38px!important;margin:0!important;padding:0!important;border:1px solid rgba(94,221,255,.42)!important;border-radius:12px!important;background:linear-gradient(180deg,#123e5c,#09283d)!important;color:#fff!important;font-size:27px!important;line-height:1!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 18px rgba(37,190,255,.08)!important}
    .nx-vault-living-screen>.nx-app-head>.nx-app-head__icon{width:32px!important;height:32px!important;display:grid!important;place-items:center!important;border:1px solid rgba(85,219,255,.28)!important;border-radius:10px!important;background:#0a314b!important}
    .nx-vault-living-screen>.nx-app-head>div .nx-eyebrow,.nx-vault-living-screen>.nx-app-head>div>p:last-child{display:none!important}
    .nx-vault-living-screen>.nx-app-head h1{margin:0!important;font-size:19px!important;line-height:1!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .nx-vault-living-screen [data-app-mount]{position:absolute!important;left:0!important;right:0!important;top:58px!important;bottom:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#04111c!important}

    .nx-vault-life{position:absolute;inset:0;overflow:hidden;box-sizing:border-box;padding:9px 11px 10px;display:grid;grid-template-rows:64px 54px minmax(0,1fr) 104px;gap:7px;background:radial-gradient(circle at 50% 31%,rgba(18,123,166,.22),transparent 34%),radial-gradient(circle at 82% 60%,rgba(153,39,183,.13),transparent 27%),linear-gradient(180deg,#061827,#04111c 62%,#061622);font-family:inherit;color:#eefaff;isolation:isolate}
    .nx-vault-life:before,.nx-vault-life:after{content:"";position:absolute;inset:-20%;pointer-events:none;z-index:-1}.nx-vault-life:before{background:repeating-radial-gradient(ellipse at 50% 38%,rgba(72,224,255,.052) 0 1px,transparent 1px 22px);animation:nxVaultBreath 6s ease-in-out infinite}.nx-vault-life:after{background:linear-gradient(120deg,transparent 0 34%,rgba(66,216,255,.043) 46%,rgba(219,70,255,.037) 52%,transparent 66%);background-size:220% 220%;animation:nxVaultFlow 10s ease-in-out infinite}

    .nx-vault-life-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:1px 2px}.nx-vault-life-kicker{display:block;color:#63dcff;font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.nx-vault-life-countline{display:flex;align-items:baseline;gap:6px}.nx-vault-life-count{font-size:31px;line-height:1;font-weight:950;letter-spacing:-.045em}.nx-vault-life-label{font-size:13px;font-weight:900;color:#cbe9f6}.nx-vault-life-ready{margin-top:1px;color:#729db2;font-size:7.4px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.nx-vault-life-badge{flex:0 0 auto;min-width:96px;padding:7px 9px;border:1px solid rgba(223,92,255,.28);border-radius:14px;background:linear-gradient(180deg,rgba(56,18,69,.72),rgba(28,11,37,.78));text-align:center;box-shadow:0 0 26px rgba(203,51,236,.08),inset 0 1px 0 rgba(255,255,255,.05)}.nx-vault-life-badge strong{display:block;font-size:11px;line-height:1;color:#f9eaff}.nx-vault-life-badge span{display:block;margin-top:4px;font-size:6.6px;font-weight:900;letter-spacing:.07em;color:#d968ef;text-transform:uppercase}

    .nx-vault-life-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.nx-vault-life-stat{display:grid;grid-template-columns:25px minmax(0,1fr);align-items:center;gap:6px;padding:6px 7px;border:1px solid rgba(93,212,255,.15);border-radius:13px;background:linear-gradient(180deg,rgba(8,36,54,.74),rgba(5,24,38,.78));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.nx-vault-life-stat i{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;font-style:normal;color:#63e4ff;background:radial-gradient(circle,rgba(31,164,210,.35),rgba(5,45,67,.7));box-shadow:0 0 14px rgba(56,202,255,.10)}.nx-vault-life-stat:nth-child(3) i{color:#ef73ff;background:radial-gradient(circle,rgba(159,46,188,.38),rgba(51,18,62,.72))}.nx-vault-life-stat span{display:block;color:#7fa9bd;font-size:6.9px;font-weight:900;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-vault-life-stat strong{display:block;margin-top:1px;font-size:17px;line-height:1;font-weight:950;color:#fff}

    .nx-vault-life-main{position:relative;min-height:0;display:grid;place-items:center;padding:18px 0 55px}.nx-vault-life-hint{position:absolute;left:4px;right:4px;top:1px;text-align:center;color:#698fa3;font-size:7px;font-weight:750;letter-spacing:.01em}.nx-vault-life-hint b{color:#88dff7}.nx-vault-life-hint em{color:#e486f2;font-style:normal}.nx-vault-life-core{position:relative;width:min(48vw,205px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;filter:drop-shadow(0 0 24px rgba(57,204,255,.13));animation:nxVaultBreath 4.8s ease-in-out infinite}.nx-vault-life-core:before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 10deg,#0a344b,#23c9f4 18%,#0b3950 34%,#b73bd2 51%,#0a344b 66%,#2ad7f8 84%,#0a344b);mask:radial-gradient(circle,transparent 0 58%,#000 59% 67%,transparent 68%);-webkit-mask:radial-gradient(circle,transparent 0 58%,#000 59% 67%,transparent 68%);animation:nxVaultOrbit 14s linear infinite}.nx-vault-life-core:after{content:"";position:absolute;inset:12%;border-radius:50%;border:1px solid rgba(92,222,255,.28);box-shadow:inset 0 0 28px rgba(25,145,190,.20),0 0 24px rgba(61,207,255,.14)}.nx-vault-heart{position:absolute;inset:27%;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 38% 32%,#164b67,#071c2b 62%,#04111b);border:1px solid rgba(104,224,255,.28);box-shadow:inset 0 0 22px rgba(50,188,235,.18),0 0 22px rgba(62,212,255,.10)}.nx-vault-heart-dot{width:13px;height:13px;border-radius:50%;background:#67e9ff;box-shadow:0 0 18px rgba(103,233,255,.95);animation:nxVaultPulse 2s ease-in-out infinite}.nx-vault-life-core-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:18%;pointer-events:none}.nx-vault-life-core-text strong{font-size:10px;letter-spacing:.12em;text-transform:uppercase}.nx-vault-life-core-text span{margin-top:3px;color:#6e9fb4;font-size:7px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.nx-vault-life-actions{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr 1fr;gap:7px}.nx-vault-life-btn{min-height:46px;padding:9px 9px;border:1px solid rgba(84,216,255,.36);border-radius:14px;background:linear-gradient(180deg,rgba(11,86,121,.96),rgba(6,53,78,.98));color:#fff;font-size:11.5px;font-weight:950;letter-spacing:.03em;box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 7px 18px rgba(0,0,0,.22)}.nx-vault-life-btn--boost{border-color:rgba(231,96,255,.38);background:linear-gradient(180deg,rgba(115,31,135,.96),rgba(70,19,83,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 7px 18px rgba(0,0,0,.22),0 0 20px rgba(202,61,232,.08)}.nx-vault-life-btn:disabled{opacity:.36;filter:saturate(.5)}.nx-vault-life-btn:active:not(:disabled){transform:translateY(1px)}

    .nx-vault-life-inventory-wrap{position:relative;padding:17px 7px 7px;border:1px solid rgba(83,211,255,.13);border-radius:16px;background:linear-gradient(180deg,rgba(7,32,48,.74),rgba(4,21,33,.78));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}.nx-vault-life-inventory-title{position:absolute;top:5px;left:10px;color:#5fdcff;font-size:7.2px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.nx-vault-life-inventory{height:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.nx-vault-life-mini{position:relative;min-width:0;min-height:0;padding:7px 4px 5px;border:1px solid rgba(86,195,231,.17);border-radius:13px;background:radial-gradient(circle at 50% 20%,rgba(44,166,207,.11),transparent 46%),rgba(6,35,52,.72);color:#c8eaf5;font-size:6.9px;font-weight:900;line-height:1.1;box-shadow:inset 0 1px 0 rgba(255,255,255,.03);animation:nxInventoryPulse 5.5s ease-in-out infinite}.nx-vault-life-mini:nth-child(3),.nx-vault-life-mini:nth-child(4){border-color:rgba(205,79,235,.16);background:radial-gradient(circle at 50% 20%,rgba(178,58,204,.11),transparent 46%),rgba(42,17,51,.70);color:#eac7f3}.nx-vault-life-mini-icon{display:block;margin:0 auto 3px;width:21px;height:21px;border-radius:50%;display:grid;place-items:center;background:rgba(35,151,190,.17);color:#5ee2ff;font-size:11px}.nx-vault-life-mini:nth-child(3) .nx-vault-life-mini-icon,.nx-vault-life-mini:nth-child(4) .nx-vault-life-mini-icon{background:rgba(171,57,195,.17);color:#ec72ff}.nx-vault-life-mini strong{display:block;margin-top:2px;color:#fff;font-size:9px;line-height:1}.nx-vault-life-mini:disabled{opacity:.34;animation:none}

    .nx-vault-life-status{position:absolute;left:14px;right:14px;bottom:10px;z-index:40;min-height:38px;padding:9px 12px;box-sizing:border-box;border:1px solid rgba(84,210,255,.32);border-radius:12px;background:rgba(4,22,34,.97);color:#e8f9ff;font-size:9.5px;font-weight:760;line-height:1.35;text-align:center;box-shadow:0 12px 30px rgba(0,0,0,.46);opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .16s ease,transform .16s ease}.nx-vault-life-status.is-visible{opacity:1;transform:none}
    @media(max-height:720px){.nx-vault-life{padding:7px 9px 8px;gap:5px;grid-template-rows:58px 48px minmax(0,1fr) 92px}.nx-vault-life-core{width:min(43vw,170px)}.nx-vault-life-main{padding-top:16px;padding-bottom:48px}.nx-vault-life-btn{min-height:41px;font-size:10.5px}.nx-vault-life-mini{font-size:6.3px}.nx-vault-life-mini-icon{width:18px;height:18px}.nx-vault-life-count{font-size:28px}}
  `;
  document.head.appendChild(style);
}

function installScreen(root) {
  let screen = null;
  const apply = () => {
    if (!root.isConnected) return;
    screen = root.closest('.nx-screen');
    if (!screen) return;
    screen.classList.add('nx-vault-living-screen');
    document.documentElement.classList.add('nx-vault-living-active');
    syncViewport();
  };
  queueMicrotask(apply);
  requestAnimationFrame(apply);
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.addEventListener('resize', syncViewport);
  return () => {
    screen?.classList.remove('nx-vault-living-screen');
    document.documentElement.classList.remove('nx-vault-living-active');
    document.documentElement.style.removeProperty('--nova-vault-viewport-height');
    window.visualViewport?.removeEventListener('resize', syncViewport);
    window.removeEventListener('resize', syncViewport);
  };
}

export function renderNovaVaultLiving() {
  ensureStyle();
  const root = document.createElement('div');
  root.className = 'nx-vault-life';
  root.dataset.vaultLivingV14 = 'true';
  root.innerHTML = `
    <section class="nx-vault-life-top">
      <div><span class="nx-vault-life-kicker">Nova Reward System</span><div class="nx-vault-life-countline"><strong class="nx-vault-life-count" data-vault-pending>—</strong><span class="nx-vault-life-label">VAULTS</span></div><div class="nx-vault-life-ready">Secure server inventory</div></div>
      <div class="nx-vault-life-badge"><strong>10X BOOST</strong><span>Rewarded premium pool</span></div>
    </section>
    <section class="nx-vault-life-stats">
      <div class="nx-vault-life-stat"><i>⚡</i><div><span>Booster</span><strong data-vault-booster>0</strong></div></div>
      <div class="nx-vault-life-stat"><i>☁</i><div><span>Nova Rain</span><strong data-vault-rain>0</strong></div></div>
      <div class="nx-vault-life-stat"><i>◷</i><div><span>Time Warp</span><strong data-vault-warp>0</strong></div></div>
    </section>
    <section class="nx-vault-life-main">
      <div class="nx-vault-life-hint"><b>Normal:</b> NVX 60 • Booster 18 • Rain 17 • Warp 5 &nbsp; · &nbsp; <em>10X weighted premium pool</em></div>
      <div class="nx-vault-life-core" aria-hidden="true"><div class="nx-vault-heart"><span class="nx-vault-heart-dot"></span></div><div class="nx-vault-life-core-text"><strong>VAULT CORE</strong><span>server selected reward</span></div></div>
      <div class="nx-vault-life-actions"><button class="nx-vault-life-btn" type="button" data-vault-open>OPEN VAULT</button><button class="nx-vault-life-btn nx-vault-life-btn--boost" type="button" data-vault-watch>WATCH AD 10X</button></div>
    </section>
    <section class="nx-vault-life-inventory-wrap">
      <span class="nx-vault-life-inventory-title">Boost Inventory</span>
      <div class="nx-vault-life-inventory">
        <button class="nx-vault-life-mini" type="button" data-vault-boost><span class="nx-vault-life-mini-icon">⚡</span>BOOSTER<strong data-mini-booster>0</strong></button>
        <button class="nx-vault-life-mini" type="button" data-vault-rain-use><span class="nx-vault-life-mini-icon">☁</span>NOVA RAIN<strong data-mini-rain>0</strong></button>
        <button class="nx-vault-life-mini" type="button" data-vault-warp-use><span class="nx-vault-life-mini-icon">◷</span>TIME WARP<strong data-mini-warp>0</strong></button>
        <button class="nx-vault-life-mini" type="button" data-vault-warp-use><span class="nx-vault-life-mini-icon">24</span>24H WARP<strong data-mini-warp-24>0</strong></button>
      </div>
    </section>
    <div class="nx-vault-life-status" data-vault-status role="status" aria-live="polite"></div>
  `;

  const removeScreenClass = installScreen(root);
  const refs = {
    pending: root.querySelector('[data-vault-pending]'), booster: root.querySelector('[data-vault-booster]'), rain: root.querySelector('[data-vault-rain]'), warp: root.querySelector('[data-vault-warp]'),
    miniBooster: root.querySelector('[data-mini-booster]'), miniRain: root.querySelector('[data-mini-rain]'), miniWarp: root.querySelector('[data-mini-warp]'), miniWarp24: root.querySelector('[data-mini-warp-24]'),
    open: root.querySelector('[data-vault-open]'), watch: root.querySelector('[data-vault-watch]'), status: root.querySelector('[data-vault-status]'),
    boostButtons: [...root.querySelectorAll('[data-vault-boost]')], rainButtons: [...root.querySelectorAll('[data-vault-rain-use]')], warpButtons: [...root.querySelectorAll('[data-vault-warp-use]')]
  };

  let off = null, active = true, busy = false, synced = false;
  let pending = 0, booster = 0, rain = 0, warp = 0, internalBoostGrants = 0, statusTimer = null;

  const announce = (message, hold = 3400) => {
    if (!active) return;
    refs.status.textContent = message || '';
    refs.status.classList.toggle('is-visible', Boolean(message));
    clearTimeout(statusTimer);
    if (message && hold > 0) statusTimer = setTimeout(() => active && refs.status.classList.remove('is-visible'), hold);
  };
  const paint = () => {
    if (!active) return;
    refs.pending.textContent = synced ? String(pending) : '—'; refs.booster.textContent = String(booster); refs.rain.textContent = String(rain); refs.warp.textContent = String(warp);
    refs.miniBooster.textContent = String(booster); refs.miniRain.textContent = String(rain); refs.miniWarp.textContent = String(warp); refs.miniWarp24.textContent = String(warp);
    refs.open.disabled = busy || !synced || pending < 1; refs.watch.disabled = busy || !synced || pending < 1;
    refs.boostButtons.forEach(b => { b.disabled = busy || booster < 1; }); refs.rainButtons.forEach(b => { b.disabled = busy || rain < 1; }); refs.warpButtons.forEach(b => { b.disabled = busy || warp < 1; });
  };
  const setBusy = value => { busy = Boolean(value); paint(); };

  const bind = async () => {
    try {
      const user = await requireFirebaseUser();
      if (!active) return;
      const unsubscribe = onSnapshot(doc(firestoreDb, 'users', user.uid), snap => {
        if (!active) return;
        const d = snap.data() || {};
        pending = Math.max(0, Math.floor(Number(d.novaVaultPending) || 0)); booster = Math.max(0, Math.floor(Number(d.novaBoosterInventory) || 0)); rain = Math.max(0, Math.floor(Number(d.novaRainInventory) || 0)); warp = Math.max(0, Math.floor(Number(d.novaTimeWarpInventory) || 0)); internalBoostGrants = Math.max(0, Math.floor(Number(d.novaVaultBoostCredits) || 0));
        synced = true; paint();
      }, error => announce(callableErrorText(error, 'Could not sync Nova inventory.'), 4500));
      if (!active) unsubscribe(); else off = unsubscribe;
    } catch (error) { announce(callableErrorText(error, 'Could not sync Nova inventory.'), 4500); }
  };

  const waitForFreshBoostGrant = async before => {
    const deadline = Date.now() + 12_000;
    while (active && Date.now() < deadline) { if (internalBoostGrants > before) return true; await new Promise(resolve => setTimeout(resolve, 300)); }
    return active && internalBoostGrants > before;
  };

  refs.open.addEventListener('click', async () => {
    if (!active || busy || !synced || pending < 1) return;
    setBusy(true); announce('Vault core selecting reward…', 0);
    try { const result = await secureCall('openNovaVault'); if (active) announce(`✓ ${rewardText(result.reward)} received.`, 4300); }
    catch (error) { if (active) announce(callableErrorText(error), 5000); }
    finally { if (active) setBusy(false); else busy = false; }
  });

  refs.watch.addEventListener('click', async () => {
    if (!active || busy || !synced || pending < 1) return;
    setBusy(true);
    try {
      const user = await requireFirebaseUser({ write:true }); const before = internalBoostGrants; announce('Opening rewarded ad…', 0);
      const adResult = await nativeAds.showRewarded({ purpose:'nova-vault-10x', userId:user.uid });
      if (!adResult.earned) throw new Error('Ad closed before completion. No boosted Vault was opened.');
      if (!active) return;
      if (adResult.testMode || nativeAds.status().testMode) { announce('✓ TEST ad completed. Real 10X rewards require production signed verification.', 4800); return; }
      announce('Ad complete • verifying…', 0); const verified = await waitForFreshBoostGrant(before); if (!verified) throw new Error('Signed 10X verification has not arrived yet. Please try again shortly.');
      announce('Verified • opening boosted Vault…', 0); const result = await secureCall('openNovaVaultBoosted', { source:'fresh-rebuild-living-v14' }); if (active) announce(`✓ 10X ${rewardText(result.reward)} received.`, 4800);
    } catch (error) { if (active) announce(callableErrorText(error, '10X rewarded flow could not be completed.'), 5200); }
    finally { if (active) setBusy(false); else busy = false; }
  });

  const runInventory = async (label, name, data = {}) => {
    if (!active || busy) return;
    setBusy(true); announce(`${label} • secure request…`, 0);
    try { await secureCall(name, data); if (active) announce(`✓ ${label} completed.`, 3900); }
    catch (error) { if (active) announce(callableErrorText(error, `${label} could not be completed.`), 5000); }
    finally { if (active) setBusy(false); else busy = false; }
  };

  refs.boostButtons.forEach(button => button.addEventListener('click', () => runInventory('Booster', 'useNovaBoost', { kind:'booster' })));
  refs.rainButtons.forEach(button => button.addEventListener('click', () => runInventory('Nova Rain', 'useNovaBoost', { kind:'rain' })));
  refs.warpButtons.forEach(button => button.addEventListener('click', () => runInventory('Time Warp', 'useNovaTimeWarp')));

  nativeAds.requestStatus(); bind(); paint();
  root.__cleanup = () => { active = false; clearTimeout(statusTimer); off?.(); off = null; removeScreenClass(); };
  return root;
}
