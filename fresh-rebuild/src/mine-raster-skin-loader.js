// Reference raster v2 package counts verified for OTA release.
const MINE_SKINS = {
  header: 2,
  miner: 4,
  ring: 3,
  tools: 2,
  dock: 1,
};

const OTA_PROOF_ID = 'nx-ota-v2-proof';
const skinUrls = new Map();
let activatedStyle = null;

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
    padding: '4px 7px',
    borderRadius: '7px',
    color: '#fff',
    font: '700 11px/1 system-ui, sans-serif',
    letterSpacing: '0.06em',
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

function b64ToBlob(b64, type = 'image/webp') {
  const raw = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type });
}

function verifyImageBlob(blob, name) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        reject(new Error(`${name} decode empty`));
        return;
      }
      resolve(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${name} decode failed`));
    };
    img.src = url;
  });
}

async function fetchText(url, label) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label} ${response.status}`);
  return response.text();
}

async function loadSkin(name, count) {
  const pieces = await Promise.all(
    Array.from({ length: count }, (_, idx) => {
      const part = String(idx + 1).padStart(2, '0');
      const url = new URL(`../assets/skins/mine-ref-v2-data/${name}.${part}.b64`, import.meta.url);
      return fetchText(url, `${name}.${part}`);
    })
  );

  const url = await verifyImageBlob(b64ToBlob(pieces.join('')), name);
  skinUrls.set(name, url);
  document.documentElement.style.setProperty(`--mine-skin-${name}`, `url("${url}")`);
}

async function loadReferenceCss() {
  const url = new URL('../assets/styles/premium-mine-component-skin-v2.css', import.meta.url);
  const css = await fetchText(url, 'skin-css');
  if (!css.includes('.nx-screen-head') || !css.includes('--mine-skin-header')) {
    throw new Error('skin-css invalid');
  }
  return css;
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

setProof('V2 LOAD', '#f59e0b');

Promise.all([
  ...Object.entries(MINE_SKINS).map(([name, count]) => loadSkin(name, count)),
  loadReferenceCss(),
])
  .then(results => activateReferenceSkin(results[results.length - 1]))
  .catch(error => {
    console.warn('[NexusNova Mine] reference skin loader:', error);
    document.documentElement.dataset.mineRasterSkin = 'waiting';
    setProof(`V2 ERR ${String(error?.message || 'unknown').slice(0, 18)}`, '#dc2626');
  });

window.addEventListener('pagehide', () => {
  activatedStyle?.remove();
  activatedStyle = null;
  skinUrls.forEach(url => URL.revokeObjectURL(url));
  skinUrls.clear();
}, { once: true });
