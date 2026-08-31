// Reference raster v2 package counts verified for OTA release.
// Crash-safety note: skin bytes are now kept as Blob URLs instead of being
// re-encoded into large data: URLs. This preserves the exact raster bytes
// while sharply reducing peak WebView memory during Mine startup.
const MINE_SKINS = {
  header: 2,
  miner: 4,
  tools: 5,
  dock: 1,
  'ring-shell-exact': 4,
  'ring-band-exact': 3,
};

const OTA_PROOF_ID = 'nx-ota-v2-proof';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let activatedStyle = null;
const skinObjectUrls = new Map();

function syncMineViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.max(
    1,
    Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1)
  );
  document.documentElement.style.setProperty('--mine-viewport-height', `${height}px`);
}

function proofBadge() {
  let badge = document.getElementById(OTA_PROOF_ID);
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = OTA_PROOF_ID;
  badge.setAttribute('aria-hidden', 'true');
  Object.assign(badge.style, {
    position: 'fixed',
    top: '42px',
    right: '10px',
    zIndex: '2147483647',
    maxWidth: '78vw',
    padding: '4px 7px',
    borderRadius: '7px',
    color: '#fff',
    font: '700 11px/1.2 system-ui, sans-serif',
    letterSpacing: '0.03em',
    boxShadow: '0 2px 8px rgba(0,0,0,.45)',
    pointerEvents: 'none',
  });
  document.body.appendChild(badge);
  return badge;
}

function setProof(text, background) {
  const badge = proofBadge();
  badge.textContent = text;
  badge.style.background = background;
}

function decodeBase64Pure(input, label) {
  let clean = String(input || '').replace(/\s+/g, '');
  if (!clean) throw new Error(`${label} empty`);
  if (clean.length % 4 === 1) throw new Error(`${label} b64 length`);
  while (clean.length % 4) clean += '=';

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - padding);
  let offset = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = clean[i];
    const c1 = clean[i + 1];
    const c2 = clean[i + 2];
    const c3 = clean[i + 3];
    const v0 = B64.indexOf(c0);
    const v1 = B64.indexOf(c1);
    const v2 = c2 === '=' ? 0 : B64.indexOf(c2);
    const v3 = c3 === '=' ? 0 : B64.indexOf(c3);

    if (v0 < 0 || v1 < 0 || (c2 !== '=' && v2 < 0) || (c3 !== '=' && v3 < 0)) {
      throw new Error(`${label} b64 char@${i}`);
    }

    const triple = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
    if (offset < out.length) out[offset++] = (triple >> 16) & 255;
    if (offset < out.length && c2 !== '=') out[offset++] = (triple >> 8) & 255;
    if (offset < out.length && c3 !== '=') out[offset++] = triple & 255;
  }

  return out;
}

function verifyImageUrl(url, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error(`${name} decode empty`));
        return;
      }
      resolve(url);
    };
    img.onerror = () => reject(new Error(`${name} image decode`));
    img.src = url;
  });
}

async function fetchText(url, label) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label} ${response.status}`);
  return response.text();
}

async function loadSkin(name, count) {
  setProof(`V2 LOAD ${name}`, '#f59e0b');

  // Decode one local chunk at a time. The previous implementation fetched all
  // chunks concurrently, concatenated them, then base64-encoded the full image
  // again into a data: URL. On low-memory Android WebViews that briefly held
  // several copies of every Mine raster in memory at once.
  const decodedParts = [];
  for (let idx = 0; idx < count; idx += 1) {
    const part = String(idx + 1).padStart(2, '0');
    const url = new URL(`../assets/skins/mine-ref-v2-data/${name}.${part}.b64`, import.meta.url);
    const text = await fetchText(url, `${name}.${part}`);
    decodedParts.push(decodeBase64Pure(text, `${name}.${part}`));
  }

  const blob = new Blob(decodedParts, { type: 'image/webp' });
  if (blob.size < 16) throw new Error(`${name} bytes short`);

  const objectUrl = URL.createObjectURL(blob);
  try {
    await verifyImageUrl(objectUrl, name);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  const previousUrl = skinObjectUrls.get(name);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  skinObjectUrls.set(name, objectUrl);
  document.documentElement.style.setProperty(`--mine-skin-${name}`, `url("${objectUrl}")`);
}

async function loadReferenceCss() {
  const componentUrl = new URL('../assets/styles/premium-mine-component-skin-v2.css', import.meta.url);
  const geometryUrl = new URL('../assets/styles/premium-mine-raster-layout-reset-v3.css', import.meta.url);
  const exactRingUrl = new URL('../assets/styles/premium-mine-ring-reference-exact-v4.css', import.meta.url);
  const polishUrl = new URL('../assets/styles/premium-mine-visual-polish-v5.css', import.meta.url);
  const viewportUrl = new URL('../assets/styles/premium-mine-viewport-fit-v6.css', import.meta.url);
  const [componentCss, geometryCss, exactRingCss, polishCss, viewportCss] = await Promise.all([
    fetchText(componentUrl, 'skin-css'),
    fetchText(geometryUrl, 'skin-geometry-css'),
    fetchText(exactRingUrl, 'skin-ring-css'),
    fetchText(polishUrl, 'skin-polish-css'),
    fetchText(viewportUrl, 'skin-viewport-css'),
  ]);
  if (!componentCss.includes('.nx-screen-head') || !componentCss.includes('--mine-skin-header')) {
    throw new Error('skin-css invalid');
  }
  if (!geometryCss.includes('.nx-nebula-miner') || !geometryCss.includes('.nx-mining-tools')) {
    throw new Error('skin-geometry-css invalid');
  }
  if (!exactRingCss.includes('--mine-skin-ring-shell-exact') || !exactRingCss.includes('--mine-skin-ring-band-exact')) {
    throw new Error('skin-ring-css invalid');
  }
  if (!polishCss.includes('#nxEmergencySosButton') || !polishCss.includes('.nx-nebula-core__aura')) {
    throw new Error('skin-polish-css invalid');
  }
  if (!viewportCss.includes('--mine-viewport-height') || !viewportCss.includes('.nx-dock')) {
    throw new Error('skin-viewport-css invalid');
  }
  return `${componentCss}\n${geometryCss}\n${exactRingCss}\n${polishCss}\n${viewportCss}`;
}

function activateReferenceSkin(css) {
  if (activatedStyle) return;
  const style = document.createElement('style');
  style.dataset.mineReferenceRaster = 'v2';
  style.textContent = css;
  document.head.appendChild(style);
  activatedStyle = style;
  document.documentElement.dataset.mineRasterSkin = 'ready';
  setProof('V2 READY', '#16a34a');
}

async function prepareReferenceSkin() {
  // CSS is tiny compared with the rasters, so fetch it in parallel while the
  // six raster groups are decoded sequentially to cap startup memory.
  const cssPromise = loadReferenceCss();
  for (const [name, count] of Object.entries(MINE_SKINS)) {
    await loadSkin(name, count);
  }
  const css = await cssPromise;
  activateReferenceSkin(css);
}

syncMineViewportHeight();
window.visualViewport?.addEventListener('resize', syncMineViewportHeight);
window.addEventListener('resize', syncMineViewportHeight);
setProof('V2 LOAD', '#f59e0b');

prepareReferenceSkin().catch(error => {
  console.warn('[NexusNova Mine] reference skin loader:', error);
  document.documentElement.dataset.mineRasterSkin = 'waiting';
  setProof(`V2 ERR ${String(error?.message || 'unknown').slice(0, 70)}`, '#dc2626');
});

window.addEventListener('pagehide', () => {
  activatedStyle?.remove();
  activatedStyle = null;
  window.visualViewport?.removeEventListener('resize', syncMineViewportHeight);
  window.removeEventListener('resize', syncMineViewportHeight);
  document.documentElement.style.removeProperty('--mine-viewport-height');
  Object.keys(MINE_SKINS).forEach(name => {
    document.documentElement.style.removeProperty(`--mine-skin-${name}`);
  });
  skinObjectUrls.forEach(url => URL.revokeObjectURL(url));
  skinObjectUrls.clear();
}, { once: true });
