const MINE_SKINS = {
  header: 2,
  miner: 4,
  ring: 2,
  tools: 2,
  dock: 1,
};

const skinUrls = new Map();

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

Promise.all(Object.entries(MINE_SKINS).map(([name, count]) => loadSkin(name, count)))
  .then(() => {
    document.documentElement.dataset.mineRasterSkin = 'ready';
  })
  .catch(error => {
    console.warn('[NexusNova Mine] reference skin loader:', error);
    document.documentElement.dataset.mineRasterSkin = 'error';
  });

window.addEventListener('pagehide', () => {
  skinUrls.forEach(url => URL.revokeObjectURL(url));
  skinUrls.clear();
}, { once: true });
