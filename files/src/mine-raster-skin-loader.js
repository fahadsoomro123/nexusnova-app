// Reference raster v2 package counts verified for OTA release.
const MINE_SKINS = {
  header: 2,
  miner: 4,
  ring: 2,
  tools: 2,
  dock: 1,
};

const OTA_PROOF_ID = 'nx-ota-v2-proof';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
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

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function encodeBase64Pure(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0;
    const c = hasC ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    out += B64[(triple >> 18) & 63];
    out += B64[(triple >> 12) & 63];
    out += hasB ? B64[(triple >> 6) & 63] : '=';
    out += hasC ? B64[triple & 63] : '=';
  }
  return out;
}

function piecesToDataUrl(pieces, name) {
  const decoded = pieces.map((piece, idx) =>
    decodeBase64Pure(piece, `${name}.${String(idx + 1).padStart(2, '0')}`)
  );
  const bytes = concatBytes(decoded);
  if (bytes.length < 16) throw new Error(`${name} bytes short`);
  return `data:image/webp;base64,${encodeBase64Pure(bytes)}`;
}

function verifyImageDataUrl(dataUrl, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error(`${name} decode empty`));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error(`${name} image decode`));
    img.src = dataUrl;
  });
}

async function fetchText(url, label) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label} ${response.status}`);
  return response.text();
}

async function loadSkin(name, count) {
  setProof(`V2 LOAD ${name}`, '#f59e0b');
  const pieces = await Promise.all(
    Array.from({ length: count }, (_, idx) => {
      const part = String(idx + 1).padStart(2, '0');
      const url = new URL(`../assets/skins/mine-ref-v2-data/${name}.${part}.b64`, import.meta.url);
      return fetchText(url, `${name}.${part}`);
    })
  );

  const dataUrl = piecesToDataUrl(pieces, name);
  await verifyImageDataUrl(dataUrl, name);
  document.documentElement.style.setProperty(`--mine-skin-${name}`, `url("${dataUrl}")`);
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
    setProof(`V2 ERR ${String(error?.message || 'unknown').slice(0, 70)}`, '#dc2626');
  });

window.addEventListener('pagehide', () => {
  activatedStyle?.remove();
  activatedStyle = null;
  Object.keys(MINE_SKINS).forEach(name => {
    document.documentElement.style.removeProperty(`--mine-skin-${name}`);
  });
}, { once: true });
