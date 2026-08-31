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

function ensureNovaVaultRasterReferenceStyle() {
  if (document.getElementById('nx-nova-vault-raster-v5-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova-vault-raster-v5-style';
  style.textContent = `
    .nx-screen.nx-vault-raster-v5{
      position:relative!important;width:100%!important;max-width:none!important;
      min-height:100dvh!important;margin:0!important;padding:0!important;
      overflow:hidden!important;background:#010710!important;color:#eef8ff!important
    }
    .nx-vault-raster-v5 [data-app-mount]{
      width:100%!important;max-width:none!important;height:100%!important;
      margin:0!important;padding:0!important;background:transparent!important
    }
    .nx-vault-raster-v5>.nx-app-head{
      position:absolute!important;left:0!important;top:0!important;z-index:60!important;
      width:100%!important;height:9.8246%!important;min-height:0!important;max-height:none!important;
      margin:0!important;padding:0!important;border:0!important;border-radius:0!important;
      background:transparent!important;box-shadow:none!important;pointer-events:none!important
    }
    .nx-vault-raster-v5>.nx-app-head>.nx-app-head__icon,
    .nx-vault-raster-v5>.nx-app-head>div{visibility:hidden!important;pointer-events:none!important}
    .nx-vault-raster-v5>.nx-app-head>.nx-back{
      position:absolute!important;left:1.7%!important;top:12%!important;width:9.4%!important;height:76%!important;
      min-width:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;
      background:transparent!important;box-shadow:none!important;color:transparent!important;
      opacity:.001!important;pointer-events:auto!important
    }

    .nx-vault-raster-stage{
      position:relative;width:100%;height:calc(100dvh - 68px - env(safe-area-inset-bottom));
      min-height:720px;max-height:none;overflow:hidden;background:#010710;
      isolation:isolate;touch-action:pan-y
    }
    .nx-vault-raster-skin{
      position:absolute;left:0;width:100%;overflow:hidden;pointer-events:none;z-index:1
    }
    .nx-vault-raster-skin>img{
      position:absolute;left:0;width:100%;max-width:none;object-fit:fill;
      user-select:none;-webkit-user-drag:none;pointer-events:none
    }
    .nx-vault-raster-skin--header{top:0;height:9.8246%}
    .nx-vault-raster-skin--header>img{top:0;height:1017.8571%}
    .nx-vault-raster-skin--hero{top:9.8246%;height:24.5614%}
    .nx-vault-raster-skin--hero>img{top:-40%;height:407.1429%}
    .nx-vault-raster-skin--stats{top:34.386%;height:11.9298%}
    .nx-vault-raster-skin--stats>img{top:-288.2353%;height:838.2353%}
    .nx-vault-raster-skin--primary{top:46.3158%;height:29.8246%}
    .nx-vault-raster-skin--primary>img{top:-155.2941%;height:335.2941%}
    .nx-vault-raster-skin--inventory{top:76.1404%;height:23.8596%}
    .nx-vault-raster-skin--inventory>img{top:-319.1176%;height:419.1176%}

    .nx-vault-hotspot{
      position:absolute;z-index:20;margin:0;padding:0;border:0;border-radius:0;
      background:transparent;color:transparent;font-size:0;box-shadow:none;outline:0;
      -webkit-tap-highlight-color:transparent;touch-action:manipulation
    }
    .nx-vault-hotspot:disabled{pointer-events:none}
    .nx-vault-hotspot--open{left:8.4%;top:61.0%;width:45.2%;height:10.1%}
    .nx-vault-hotspot--watch{left:61.8%;top:61.1%;width:34.0%;height:9.8%}
    .nx-vault-hotspot--booster{left:5.2%;top:79.4%;width:27.0%;height:9.6%}
    .nx-vault-hotspot--rain{left:32.7%;top:79.4%;width:29.0%;height:9.6%}
    .nx-vault-hotspot--warp{left:62.3%;top:79.4%;width:32.8%;height:9.6%}
    .nx-vault-hotspot--warp24{left:5.2%;top:89.2%;width:89.8%;height:8.7%}

    .nx-vault-dynamic{
      position:absolute;z-index:12;display:grid;place-items:center;margin:0;
      color:#f5f8fd;font-family:inherit;font-weight:950;line-height:1;text-align:center;
      text-shadow:0 2px 0 #000,0 0 12px rgba(21,194,255,.15);pointer-events:none
    }
    .nx-vault-dynamic[hidden]{display:none!important}
    .nx-vault-dynamic--pending{
      left:11.1%;top:18.2%;width:11.9%;height:7.8%;
      background:linear-gradient(90deg,rgba(3,15,25,.98),rgba(3,17,28,.98));
      font-size:clamp(44px,9vw,92px);letter-spacing:-.05em
    }
    .nx-vault-dynamic--booster,.nx-vault-dynamic--rain,.nx-vault-dynamic--warp{
      top:39.3%;width:8.1%;height:5.5%;background:rgba(3,14,24,.98);
      font-size:clamp(28px,5.4vw,58px)
    }
    .nx-vault-dynamic--booster{left:15.8%}.nx-vault-dynamic--rain{left:47.3%}
    .nx-vault-dynamic--warp{left:77.6%;background:rgba(7,8,22,.98)}
    .nx-vault-dynamic--credits{
      left:83.1%;top:2.25%;width:13.1%;height:3.55%;
      background:linear-gradient(90deg,rgba(16,8,26,.98),rgba(12,7,21,.98));
      color:#fff;font-size:clamp(10px,1.9vw,19px);white-space:nowrap;letter-spacing:.01em
    }
    .nx-vault-dynamic--boost-state{
      left:65.0%;top:71.2%;width:28.0%;height:2.7%;
      background:rgba(9,6,21,.97);color:#dd54ff;
      font-size:clamp(9px,1.65vw,16px);letter-spacing:.05em;white-space:nowrap
    }

    .nx-vault-live-status{
      position:absolute;left:7%;right:7%;bottom:7.2%;z-index:80;
      min-height:42px;padding:10px 14px;border:1px solid rgba(63,195,255,.44);
      border-radius:11px;background:rgba(3,16,27,.94);box-shadow:0 8px 24px rgba(0,0,0,.46);
      color:#dff7ff;font-size:12px;font-weight:750;line-height:1.35;text-align:center;
      opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .16s ease,transform .16s ease
    }
    .nx-vault-live-status.is-visible{opacity:1;transform:none}

    @media(max-height:760px){
      .nx-vault-raster-stage{min-height:0;height:calc(100dvh - 62px - env(safe-area-inset-bottom))}
    }
    @media(prefers-reduced-motion:reduce){
      .nx-vault-live-status{transition:none}
    }
  `;
  document.head.appendChild(style);
}

function installRasterScreen(root) {
  let screen = null;
  const apply = () => {
    if (!root.isConnected) return;
    screen = root.closest('.nx-screen');
    if (screen) screen.classList.add('nx-vault-raster-v5');
  };
  queueMicrotask(apply);
  requestAnimationFrame(apply);
  return () => screen?.classList.remove('nx-vault-raster-v5');
}

export function renderNovaVaultSafe() {
  ensureNovaVaultRasterReferenceStyle();
  const root = document.createElement('div');
  root.className = 'nx-vault-raster-stage';
  root.dataset.vaultV3Integrated = 'true';
  root.innerHTML = `
    <div class="nx-vault-raster-skin nx-vault-raster-skin--header" aria-hidden="true"><img src="./assets/skins/nova-vault-ref-v5/reference.webp" alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--hero" aria-hidden="true"><img src="./assets/skins/nova-vault-ref-v5/reference.webp" alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--stats" aria-hidden="true"><img src="./assets/skins/nova-vault-ref-v5/reference.webp" alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--primary" aria-hidden="true"><img src="./assets/skins/nova-vault-ref-v5/reference.webp" alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--inventory" aria-hidden="true"><img src="./assets/skins/nova-vault-ref-v5/reference.webp" alt="" decoding="async" draggable="false"></div>

    <span class="nx-vault-dynamic nx-vault-dynamic--pending" data-vault-pending hidden></span>
    <span class="nx-vault-dynamic nx-vault-dynamic--booster" data-vault-booster hidden></span>
    <span class="nx-vault-dynamic nx-vault-dynamic--rain" data-vault-rain hidden></span>
    <span class="nx-vault-dynamic nx-vault-dynamic--warp" data-vault-warp hidden></span>
    <span class="nx-vault-dynamic nx-vault-dynamic--credits" data-vault-credits hidden></span>
    <span class="nx-vault-dynamic nx-vault-dynamic--boost-state" data-vault-boost-state hidden></span>

    <button class="nx-vault-hotspot nx-vault-hotspot--open" type="button" data-vault-open aria-label="Open Vault">OPEN VAULT</button>
    <button class="nx-vault-hotspot nx-vault-hotspot--watch" type="button" data-vault-watch aria-label="Watch ad for 10X">WATCH AD FOR 10X</button>
    <button class="nx-vault-hotspot nx-vault-hotspot--booster" type="button" data-vault-boost aria-label="Use Booster">USE BOOSTER</button>
    <button class="nx-vault-hotspot nx-vault-hotspot--rain" type="button" data-vault-rain-use aria-label="Use Nova Rain">USE NOVA RAIN</button>
    <button class="nx-vault-hotspot nx-vault-hotspot--warp" type="button" data-vault-warp-use aria-label="Use Time Warp">USE TIME WARP</button>
    <button class="nx-vault-hotspot nx-vault-hotspot--warp24" type="button" data-vault-warp-use aria-label="Use 24 hour Time Warp">USE 24H TIME WARP</button>

    <div class="nx-vault-live-status" data-vault-status role="status" aria-live="polite"></div>
  `;

  const removeScreenClass = installRasterScreen(root);
  const refs = {
    pending: root.querySelector('[data-vault-pending]'),
    booster: root.querySelector('[data-vault-booster]'),
    rain: root.querySelector('[data-vault-rain]'),
    warp: root.querySelector('[data-vault-warp]'),
    credits: root.querySelector('[data-vault-credits]'),
    boostState: root.querySelector('[data-vault-boost-state]'),
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

  const showDynamic = (element, shouldShow, value) => {
    element.hidden = !shouldShow;
    if (shouldShow) element.textContent = String(value);
  };

  const paint = () => {
    if (!active) return;
    showDynamic(refs.pending, pending !== 7, pending);
    showDynamic(refs.booster, booster !== 0, booster);
    showDynamic(refs.rain, rain !== 0, rain);
    showDynamic(refs.warp, warp !== 0, warp);
    showDynamic(refs.credits, credits !== 0, `${credits} CREDIT${credits === 1 ? '' : 'S'}`);
    showDynamic(refs.boostState, credits > 0, `10X BOOST ACTIVE • ${credits} CREDIT${credits === 1 ? '' : 'S'}`);

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
        boosted ? { source:'fresh-rebuild-raster-reference-v5' } : {}
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
