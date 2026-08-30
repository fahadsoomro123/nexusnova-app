// Reference raster v2 package counts verified for OTA release.
const MINE_SKINS = {
  header: 2,
  miner: 4,
  ring: 2,
  tools: 2,
  dock: 1,
};

const OTA_PROOF_ID = 'nx-ota-v2-proof';
const skinUrls = new Map();
let activatedStyle = null;

function installOtaProofMarker() {
  if (document.getElementById(OTA_PROOF_ID)) return;
  const badge = document.createElement('div');
  badge.id = OTA_PROOF_ID;
  badge.textContent = 'OTA V2';
  badge.setAttribute('aria-hidden', 'true');
  Object.assign(badge.style, {
    position: 'fixed',
    top: '42px',
    right: '10px',
    zIndex: '2147483647',
    padding: '4px 7px',
    borderRadius: '7px',
    background: '#ff2d55',
    color: '#fff',
    font: '700 11px/1 system-ui, sans-serif',
    letterSpacing: '0.08em',
    boxShadow: '0 2px 8px rgba(0,0,0,.45)',
    pointerEvents: 'none',
  });
  document.body.appendChild(badge);
}

function b64ToBlobUrl(b64, type = 'image/webp') {
  const raw = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type }));
}

async function loadSkin(name, count) {
  const pieces = await Promise.all(
    Array.from({ length: count }, (_, idx) => {
      const part = String(idx + 1).padStart(2, '0');
      return fetch(new URL(`../assets/skins/mine-ref-v2-data/${name}.${part}.b64`, import.meta.url), {
        cache: 'no-store',
      }).then(response => {
        if (!response.ok) throw new Error(`Mine skin ${name}.${part} ${response.status}`);
        return response.text();
      });
    })
  );
  const url = b64ToBlobUrl(pieces.join(''));
  skinUrls.set(name, url);
  document.documentElement.style.setProperty(`--mine-skin-${name}`, `url("${url}")`);
}

function activateReferenceSkin() {
  if (activatedStyle) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../assets/styles/premium-mine-component-skin-v2.css', import.meta.url).href;
  link.dataset.mineReferenceRaster = 'v2';
  document.head.appendChild(link);
  activatedStyle = link;
  document.documentElement.dataset.mineRasterSkin = 'ready';
}

installOtaProofMarker();

Promise.all(Object.entries(MINE_SKINS).map(([name, count]) => loadSkin(name, count)))
  .then(activateReferenceSkin)
  .catch(error => {
    // Fail closed: the existing working Mine visuals remain active until every
    // reference component exists. Never activate a partial/broken raster skin.
    console.warn('[NexusNova Mine] reference skin loader:', error);
    document.documentElement.dataset.mineRasterSkin = 'waiting';
  });

window.addEventListener('pagehide', () => {
  activatedStyle?.remove();
  activatedStyle = null;
  skinUrls.forEach(url => URL.revokeObjectURL(url));
  skinUrls.clear();
}, { once: true });
