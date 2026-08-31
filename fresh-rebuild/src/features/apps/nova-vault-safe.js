import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseApp, firestoreDb, requireFirebaseUser } from '../../core/firebase-backend.js';
import { nativeAds } from '../../core/native-ads.js';

const NOVA_VAULT_RASTER_PARTS = 12;
const NOVA_VAULT_RASTER_BASE = new URL('../../../assets/skins/nova-vault-ref-v9-data/', import.meta.url);
const NOVA_VAULT_SOURCE_WIDTH = 512;
const NOVA_VAULT_SOURCE_HEIGHT = 712;
const NOVA_VAULT_SOURCE_BYTES = 107442;
const NOVA_VAULT_SOURCE_RATIO = NOVA_VAULT_SOURCE_WIDTH / NOVA_VAULT_SOURCE_HEIGHT;
let vaultRasterUrl = null;
let vaultRasterPromise = null;
let vaultRasterRefs = 0;

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

function verifyRasterUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || 0;
      const height = image.naturalHeight || 0;
      const ratio = height ? width / height : 0;
      if (
        width !== NOVA_VAULT_SOURCE_WIDTH ||
        height !== NOVA_VAULT_SOURCE_HEIGHT ||
        Math.abs(ratio - NOVA_VAULT_SOURCE_RATIO) > 0.001
      ) {
        reject(new Error(`Nova Vault reference dimensions ${width}x${height}`));
        return;
      }
      resolve({ width, height });
    };
    image.onerror = () => reject(new Error('Nova Vault reference image decode failed'));
    image.src = url;
  });
}

async function loadVaultRasterBytes() {
  const chunks = [];
  for (let index = 1; index <= NOVA_VAULT_RASTER_PARTS; index += 1) {
    const partName = `reference.${String(index).padStart(2, '0')}.b64`;
    const response = await fetch(new URL(partName, NOVA_VAULT_RASTER_BASE), { cache:'no-store' });
    if (!response.ok) throw new Error(`Nova Vault raster part ${index} HTTP ${response.status}`);
    const text = (await response.text()).replace(/\s+/g, '');
    if (!text) throw new Error(`Nova Vault raster part ${index} is empty`);
    chunks.push(text);
  }
  const encoded = chunks.join('');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes.byteLength !== NOVA_VAULT_SOURCE_BYTES) {
    throw new Error(`Nova Vault raster byte size ${bytes.byteLength}`);
  }
  const ascii = offset => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (ascii(0) !== 'RIFF' || ascii(8) !== 'WEBP') {
    throw new Error('Nova Vault raster container signature is invalid');
  }
  return bytes;
}

async function prepareVaultRasterUrl() {
  if (vaultRasterUrl) return vaultRasterUrl;
  if (vaultRasterPromise) return vaultRasterPromise;
  vaultRasterPromise = (async () => {
    const bytes = await loadVaultRasterBytes();
    const blob = new Blob([bytes], { type:'image/webp' });
    const objectUrl = URL.createObjectURL(blob);
    try {
      await verifyRasterUrl(objectUrl);
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
    vaultRasterUrl = objectUrl;
    return objectUrl;
  })();
  try {
    return await vaultRasterPromise;
  } finally {
    vaultRasterPromise = null;
  }
}

async function attachVaultRaster(root) {
  const url = await prepareVaultRasterUrl();
  if (!root.isConnected) return () => {};
  const images = [...root.querySelectorAll('[data-vault-raster]')];
  images.forEach(image => { image.src = url; });
  await Promise.all(images.map(image => image.decode?.().catch(() => undefined)));
  if (!root.isConnected) return () => {};
  root.dataset.rasterReady = 'true';
  vaultRasterRefs += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    vaultRasterRefs = Math.max(0, vaultRasterRefs - 1);
    root.removeAttribute('data-raster-ready');
    images.forEach(image => image.removeAttribute('src'));
    if (!vaultRasterRefs && vaultRasterUrl) {
      URL.revokeObjectURL(vaultRasterUrl);
      vaultRasterUrl = null;
    }
  };
}

function syncVaultViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
  document.documentElement.style.setProperty('--nova-vault-viewport-height', `${height}px`);
}

function ensureNovaVaultRasterReferenceStyle() {
  if (document.getElementById('nx-nova-vault-raster-v6-style')) return;
  const style = document.createElement('style');
  style.id = 'nx-nova-vault-raster-v6-style';
  style.textContent = `
    html.nx-vault-raster-active .nx-app{width:100%!important;max-width:none!important;margin:0!important}
    html.nx-vault-raster-active .nx-stage{
      min-height:var(--nova-vault-viewport-height,100dvh)!important;
      padding:0!important;scroll-padding:0!important;overflow:hidden!important
    }
    .nx-screen.nx-vault-raster-v6{
      position:relative!important;width:100%!important;max-width:none!important;
      height:calc(var(--nova-vault-viewport-height,100dvh) - 68px - env(safe-area-inset-bottom))!important;
      min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;
      background:#010710!important;color:#eef8ff!important;animation:none!important
    }
    .nx-vault-raster-v6 [data-app-mount]{
      position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
      margin:0!important;padding:0!important;background:#010710!important;overflow:hidden!important
    }
    .nx-vault-raster-v6>.nx-app-head{
      position:absolute!important;left:0!important;top:0!important;z-index:60!important;
      width:100%!important;height:9.8245614%!important;min-height:0!important;max-height:none!important;
      margin:0!important;padding:0!important;border:0!important;border-radius:0!important;
      background:transparent!important;box-shadow:none!important;pointer-events:none!important
    }
    .nx-vault-raster-v6>.nx-app-head>.nx-app-head__icon,
    .nx-vault-raster-v6>.nx-app-head>div{visibility:hidden!important;pointer-events:none!important}
    .nx-vault-raster-v6>.nx-app-head>.nx-back{
      position:absolute!important;left:1.7%!important;top:12%!important;width:9.4%!important;height:76%!important;
      min-width:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;
      background:transparent!important;box-shadow:none!important;color:transparent!important;
      opacity:0!important;pointer-events:auto!important;-webkit-tap-highlight-color:transparent!important
    }

    .nx-vault-raster-stage{
      position:absolute;inset:0;width:100%;height:100%;overflow:hidden;background:#010710;
      isolation:isolate;touch-action:manipulation
    }
    .nx-vault-raster-skin{
      position:absolute;left:0;width:100%;overflow:hidden;pointer-events:none;z-index:1;background:#010710
    }
    .nx-vault-raster-skin>img{
      position:absolute;left:0;width:100%;max-width:none;object-fit:fill;opacity:0;
      user-select:none;-webkit-user-drag:none;pointer-events:none
    }
    .nx-vault-raster-stage[data-raster-ready="true"] .nx-vault-raster-skin>img{opacity:1}
    .nx-vault-raster-skin--header{top:0;height:9.8245614%}
    .nx-vault-raster-skin--header>img{top:0;height:1097.142857%}
    .nx-vault-raster-skin--hero{top:9.8245614%;height:24.5614035%}
    .nx-vault-raster-skin--hero>img{top:-40%;height:438.8571429%}
    .nx-vault-raster-skin--stats{top:34.3859649%;height:11.9298246%}
    .nx-vault-raster-skin--stats>img{top:-288.2352941%;height:903.5294118%}
    .nx-vault-raster-skin--primary{top:46.3157895%;height:29.8245614%}
    .nx-vault-raster-skin--primary>img{top:-155.2941176%;height:361.4117647%}
    .nx-vault-raster-skin--inventory{top:76.1403509%;height:23.8596491%}
    .nx-vault-raster-skin--inventory>img{top:-319.1176471%;height:451.7647059%}

    .nx-vault-hotspot{
      position:absolute;z-index:20;margin:0;padding:0;border:0;border-radius:0;background:transparent;
      color:transparent;font-size:0;box-shadow:none;outline:0;-webkit-tap-highlight-color:transparent;touch-action:manipulation
    }
    .nx-vault-hotspot:disabled{pointer-events:none}
    .nx-vault-hotspot--open{left:8.4%;top:61.0%;width:45.2%;height:10.1%}
    .nx-vault-hotspot--watch{left:61.8%;top:61.1%;width:34.0%;height:9.8%}
    .nx-vault-hotspot--booster{left:5.2%;top:79.4%;width:27.0%;height:9.6%}
    .nx-vault-hotspot--rain{left:32.7%;top:79.4%;width:29.0%;height:9.6%}
    .nx-vault-hotspot--warp{left:62.3%;top:79.4%;width:32.8%;height:9.6%}
    .nx-vault-hotspot--warp24{left:5.2%;top:89.2%;width:89.8%;height:8.7%}

    .nx-vault-dynamic{
      position:absolute;z-index:12;display:grid;place-items:center;margin:0;color:#f5f8fd;font-family:inherit;
      font-weight:950;line-height:1;text-align:center;text-shadow:0 2px 0 #000,0 0 12px rgba(21,194,255,.15);pointer-events:none
    }
    .nx-vault-dynamic[hidden]{display:none!important}
    .nx-vault-dynamic--pending{
      left:11.1%;top:18.2%;width:11.9%;height:7.8%;background:linear-gradient(90deg,rgba(3,15,25,.985),rgba(3,17,28,.985));
      font-size:clamp(44px,9vw,92px);letter-spacing:-.05em
    }
    .nx-vault-dynamic--booster,.nx-vault-dynamic--rain,.nx-vault-dynamic--warp{
      top:39.3%;width:8.1%;height:5.5%;background:rgba(3,14,24,.985);font-size:clamp(28px,5.4vw,58px)
    }
    .nx-vault-dynamic--booster{left:15.8%}.nx-vault-dynamic--rain{left:47.3%}
    .nx-vault-dynamic--warp{left:77.6%;background:rgba(7,8,22,.985)}
    .nx-vault-dynamic--credits{
      left:83.1%;top:2.25%;width:13.1%;height:3.55%;background:linear-gradient(90deg,rgba(16,8,26,.985),rgba(12,7,21,.985));
      color:#fff;font-size:clamp(10px,1.9vw,19px);white-space:nowrap;letter-spacing:.01em
    }
    .nx-vault-dynamic--boost-state{
      left:65.0%;top:71.2%;width:28.0%;height:2.7%;background:rgba(9,6,21,.985);color:#dd54ff;
      font-size:clamp(9px,1.65vw,16px);letter-spacing:.05em;white-space:nowrap
    }
    .nx-vault-live-status{
      position:absolute;left:7%;right:7%;bottom:7.2%;z-index:80;min-height:42px;padding:10px 14px;
      border:1px solid rgba(63,195,255,.44);border-radius:11px;background:rgba(3,16,27,.96);box-shadow:0 8px 24px rgba(0,0,0,.46);
      color:#dff7ff;font-size:12px;font-weight:750;line-height:1.35;text-align:center;opacity:0;transform:translateY(8px);
      pointer-events:none;transition:opacity .16s ease,transform .16s ease
    }
    .nx-vault-live-status.is-visible{opacity:1;transform:none}
    @media(prefers-reduced-motion:reduce){.nx-vault-live-status{transition:none}}
  `;
  document.head.appendChild(style);
}

function installRasterScreen(root) {
  let screen = null;
  const apply = () => {
    if (!root.isConnected) return;
    screen = root.closest('.nx-screen');
    if (!screen) return;
    screen.classList.add('nx-vault-raster-v6');
    document.documentElement.classList.add('nx-vault-raster-active');
    syncVaultViewportHeight();
  };
  queueMicrotask(apply);
  requestAnimationFrame(apply);
  window.visualViewport?.addEventListener('resize', syncVaultViewportHeight);
  window.addEventListener('resize', syncVaultViewportHeight);
  return () => {
    screen?.classList.remove('nx-vault-raster-v6');
    document.documentElement.classList.remove('nx-vault-raster-active');
    document.documentElement.style.removeProperty('--nova-vault-viewport-height');
    window.visualViewport?.removeEventListener('resize', syncVaultViewportHeight);
    window.removeEventListener('resize', syncVaultViewportHeight);
  };
}

export function renderNovaVaultSafe() {
  ensureNovaVaultRasterReferenceStyle();
  const root = document.createElement('div');
  root.className = 'nx-vault-raster-stage';
  root.dataset.vaultV3Integrated = 'true';
  root.innerHTML = `
    <div class="nx-vault-raster-skin nx-vault-raster-skin--header" aria-hidden="true"><img data-vault-raster alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--hero" aria-hidden="true"><img data-vault-raster alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--stats" aria-hidden="true"><img data-vault-raster alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--primary" aria-hidden="true"><img data-vault-raster alt="" decoding="async" draggable="false"></div>
    <div class="nx-vault-raster-skin nx-vault-raster-skin--inventory" aria-hidden="true"><img data-vault-raster alt="" decoding="async" draggable="false"></div>

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
  let releaseRaster = null;
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
        boosted ? { source:'fresh-rebuild-raster-reference-v6' } : {}
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
  attachVaultRaster(root).then(cleanup => {
    if (!active) cleanup();
    else releaseRaster = cleanup;
  }).catch(error => {
    console.warn('[NexusNova Nova Vault] raster loader:', error);
    announce('Nova Vault visual asset could not load. Reopen the screen after OTA sync.', 5200);
  });

  root.__cleanup = () => {
    active = false;
    clearTimeout(statusTimer);
    off?.();
    off = null;
    releaseRaster?.();
    releaseRaster = null;
    removeScreenClass();
  };
  return root;
}

export const novaVaultSafeRenderers = Object.freeze({ 'nova-vault': renderNovaVaultSafe });