const PUBLIC_OTA_VISUAL_BASE = 'https://raw.githubusercontent.com/fahadsoomro123/nexusnova-website/nexusnova-ota-public/ota/files/assets/visuals/';

const VISUALS = Object.freeze({
  'nova-drive-approved-v7.webp': `${PUBLIC_OTA_VISUAL_BASE}nova-drive-approved-v7.webp`,
  'nova-vehicle-tracking-approved-v2.webp': `${PUBLIC_OTA_VISUAL_BASE}nova-vehicle-tracking-approved-v2.webp`
});

function repairApprovedVisual(img) {
  if (!(img instanceof HTMLImageElement)) return;
  if (!img.classList.contains('nx-approved-art')) return;

  const declared = img.getAttribute('src') || '';
  const key = Object.keys(VISUALS).find((name) => declared.includes(name));
  if (!key) return;

  const expected = VISUALS[key];
  if (img.src === expected || img.dataset.nxApprovedVisualFixed === expected) return;

  img.dataset.nxApprovedVisualFixed = expected;
  img.src = expected;
}

function repairTree(root = document) {
  if (root instanceof HTMLImageElement) repairApprovedVisual(root);
  root.querySelectorAll?.('img.nx-approved-art').forEach(repairApprovedVisual);
}

repairTree();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) repairTree(node);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener('error', (event) => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.classList.contains('nx-approved-art')) {
    repairApprovedVisual(img);
  }
}, true);
