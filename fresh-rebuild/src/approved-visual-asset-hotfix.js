const VISUAL_CHUNKS = Object.freeze({
  'nova-drive-approved-v7.webp': [
    new URL('../assets/visuals/approved-data/drive-q0-01.b64', import.meta.url).href,
    new URL('../assets/visuals/approved-data/drive-q0-02.b64', import.meta.url).href,
    new URL('../assets/visuals/approved-data/drive-q0-03.b64', import.meta.url).href,
    new URL('../assets/visuals/approved-data/drive-q0-04.b64', import.meta.url).href
  ],
  'nova-vehicle-tracking-approved-v2.webp': [
    new URL('../assets/visuals/approved-data/tracker-q0-01.b64', import.meta.url).href,
    new URL('../assets/visuals/approved-data/tracker-q0-02.b64', import.meta.url).href,
    new URL('../assets/visuals/approved-data/tracker-q0-03.b64', import.meta.url).href,
    new URL('../assets/visuals/approved-data/tracker-q0-04.b64', import.meta.url).href,
    new URL('../assets/visuals/approved-data/tracker-q0-05.b64', import.meta.url).href
  ]
});

const EXPECTED_BASE64_LENGTH = Object.freeze({
  'nova-drive-approved-v7.webp': 21636,
  'nova-vehicle-tracking-approved-v2.webp': 24552
});

const VISUAL_CACHE = new Map();

function approvedVisualKey(img) {
  const remembered = img?.dataset?.nxApprovedVisualKey || '';
  if (remembered && VISUAL_CHUNKS[remembered]) return remembered;

  const declared = img?.getAttribute?.('src') || '';
  const current = img?.currentSrc || img?.src || '';
  return Object.keys(VISUAL_CHUNKS).find((name) => declared.includes(name) || current.includes(name)) || '';
}

async function fetchChunk(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`approved visual chunk ${response.status}`);
  return (await response.text()).replace(/\s+/g, '');
}

function validateWebpBase64(key, b64) {
  if (b64.length !== EXPECTED_BASE64_LENGTH[key]) {
    throw new Error(`approved visual length mismatch: ${key}`);
  }
  if (!b64.startsWith('UklGR')) {
    throw new Error(`approved visual RIFF prefix missing: ${key}`);
  }
  const header = atob(b64.slice(0, 16));
  if (header.slice(0, 4) !== 'RIFF' || header.slice(8, 12) !== 'WEBP') {
    throw new Error(`approved visual WEBP header invalid: ${key}`);
  }
}

function approvedVisualDataUrl(key) {
  if (VISUAL_CACHE.has(key)) return VISUAL_CACHE.get(key);

  const promise = Promise.all(VISUAL_CHUNKS[key].map(fetchChunk)).then((parts) => {
    const b64 = parts.join('');
    validateWebpBase64(key, b64);
    return `data:image/webp;base64,${b64}`;
  }).catch((error) => {
    VISUAL_CACHE.delete(key);
    throw error;
  });

  VISUAL_CACHE.set(key, promise);
  return promise;
}

async function repairApprovedVisual(img) {
  if (!(img instanceof HTMLImageElement)) return;
  if (!img.classList.contains('nx-approved-art')) return;

  const key = approvedVisualKey(img);
  if (!key) return;
  img.dataset.nxApprovedVisualKey = key;

  const state = img.dataset.nxApprovedVisualState || '';
  if (state === 'loading' || state === 'ready') return;

  const originalAlt = img.dataset.nxApprovedVisualAlt ?? img.getAttribute('alt') ?? '';
  img.dataset.nxApprovedVisualAlt = originalAlt;
  img.dataset.nxApprovedVisualState = 'loading';
  img.removeAttribute('srcset');
  img.alt = '';
  img.style.visibility = 'hidden';

  try {
    const dataUrl = await approvedVisualDataUrl(key);
    if (!img.isConnected) return;

    img.addEventListener('load', () => {
      img.dataset.nxApprovedVisualState = 'ready';
      img.alt = img.dataset.nxApprovedVisualAlt || '';
      img.style.visibility = '';
    }, { once: true });

    img.addEventListener('error', () => {
      img.dataset.nxApprovedVisualState = 'error';
      img.alt = img.dataset.nxApprovedVisualAlt || '';
      img.style.visibility = '';
    }, { once: true });

    img.src = dataUrl;
  } catch (error) {
    img.dataset.nxApprovedVisualState = 'error';
    img.alt = img.dataset.nxApprovedVisualAlt || '';
    img.style.visibility = '';
    console.error('[NexusNova] approved visual reconstruction failed', key, error);
  }
}

function repairTree(root = document) {
  if (root instanceof HTMLImageElement) void repairApprovedVisual(root);
  root.querySelectorAll?.('img.nx-approved-art').forEach((img) => void repairApprovedVisual(img));
}

repairTree();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) repairTree(node);
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

document.addEventListener('error', (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('nx-approved-art')) return;
  if (img.dataset.nxApprovedVisualState === 'loading' || img.dataset.nxApprovedVisualState === 'ready') return;
  window.setTimeout(() => void repairApprovedVisual(img), 150);
}, true);
