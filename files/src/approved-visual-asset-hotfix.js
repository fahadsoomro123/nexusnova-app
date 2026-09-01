const VISUALS = Object.freeze({
  'nova-drive-approved-v7.webp': new URL('../assets/visuals/nova-drive-approved-v7.webp', import.meta.url).href,
  'nova-vehicle-tracking-approved-v2.webp': new URL('../assets/visuals/nova-vehicle-tracking-approved-v2.webp', import.meta.url).href
});

function approvedVisualKey(img) {
  const declared = img.getAttribute('src') || '';
  const current = img.currentSrc || img.src || '';
  return Object.keys(VISUALS).find((name) => declared.includes(name) || current.includes(name)) || '';
}

function repairApprovedVisual(img) {
  if (!(img instanceof HTMLImageElement)) return;
  if (!img.classList.contains('nx-approved-art')) return;

  const key = approvedVisualKey(img);
  if (!key) return;

  const expected = VISUALS[key];
  if (img.getAttribute('src') === expected || img.dataset.nxApprovedVisualFixed === expected) return;

  img.dataset.nxApprovedVisualFixed = expected;
  img.removeAttribute('srcset');
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
    if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
      repairApprovedVisual(mutation.target);
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'srcset']
});

document.addEventListener('error', (event) => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.classList.contains('nx-approved-art')) {
    repairApprovedVisual(img);
  }
}, true);
