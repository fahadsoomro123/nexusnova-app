// NexusNova Travel route-exit isolation.
// Travel intentionally locks the document while its fullscreen shell is mounted.
// This guard removes only Travel-owned state after leaving the route.
const TRAVEL_ROOT = '.nn-travel-v19';
const GLOBAL_CLASSES = Object.freeze([
  'nn-travel-reference-lock',
  'nn-travel-host-lock',
  'nn-travel-keyboard-open',
  'nn-travel-route-focus-open',
  'nn-travel-v8-active',
  'nn-travel-v8-editing',
  'nn-travel-v14-keyboard',
  'nn-travel-v15-keyboard',
  'nn-travel-v17-route-edit',
  'nn-travel-v31-active',
  'nn-travel-v31-keyboard',
  'nn-travel-v32-active',
  'nn-travel-v32-keyboard'
]);
const ROOT_CLASSES = Object.freeze([
  'nn-v8-results-open',
  'nn-v8-route-edit',
  'nn-travel-keyboard-open',
  'nn-travel-route-focus'
]);
const ROOT_PROPERTIES = Object.freeze([
  '--nn-v8-frame-height',
  '--nn-v8-results-top',
  '--nn-v8-results-bottom',
  '--nn-travel-frame-height',
  '--nn-v13-frame-height',
  '--nn-v14-frame-height',
  '--nn-v15-frame-height',
  '--nn-v17-frame-height',
  '--nn-v17-root-height',
  '--nn-v29-frame-height',
  '--nn-v29-root-height',
  '--nn-v30-frame-height',
  '--nn-v30-root-height',
  '--nn-v32-content-h'
]);
const SCREEN_CLASSES = Object.freeze([
  'nn-travel-reference-shell',
  'nn-travel-host-screen',
  'nn-travel-v8-screen',
  'nn-travel-v32-screen'
]);

let sawTravel = false;
const wrappedCleanups = new WeakSet();

function travelMounted() {
  return document.querySelector(TRAVEL_ROOT) instanceof HTMLElement;
}

function hasStaleTravelLock() {
  const doc = document.documentElement;
  return GLOBAL_CLASSES.some(name => doc.classList.contains(name))
    || GLOBAL_CLASSES.some(name => document.body?.classList.contains(name));
}

function stripRootState(root) {
  if (!(root instanceof HTMLElement)) return;
  root.classList.remove(...ROOT_CLASSES);
  ROOT_PROPERTIES.forEach(name => root.style.removeProperty(name));
  const screen = root.closest('.nx-screen');
  screen?.classList.remove(...SCREEN_CLASSES);
}

function stripGlobalState() {
  const doc = document.documentElement;
  const body = document.body;
  doc.classList.remove(...GLOBAL_CLASSES);
  body?.classList.remove(...GLOBAL_CLASSES);
  document.querySelectorAll(SCREEN_CLASSES.map(name => `.${name}`).join(','))
    .forEach(node => node.classList.remove(...SCREEN_CLASSES));
}

function wrapTravelCleanup(root) {
  if (!(root instanceof HTMLElement)) return;
  const current = root.__cleanup;
  if (typeof current !== 'function' || wrappedCleanups.has(current)) return;

  const wrapped = () => {
    try {
      current();
    } finally {
      stripRootState(root);
      stripGlobalState();
      sawTravel = false;
    }
  };
  wrappedCleanups.add(wrapped);
  root.__cleanup = wrapped;
  root.dataset.travelExitIsolation = 'v32';
}

export function releaseTravelExitLocks() {
  if (travelMounted()) {
    sawTravel = true;
    document.querySelectorAll(TRAVEL_ROOT).forEach(wrapTravelCleanup);
    return false;
  }

  const hadLock = sawTravel || hasStaleTravelLock();
  if (!hadLock) return false;
  stripGlobalState();
  sawTravel = false;
  return true;
}

function scan() {
  const roots = [...document.querySelectorAll(TRAVEL_ROOT)];
  if (roots.length) {
    sawTravel = true;
    roots.forEach(wrapTravelCleanup);
    return;
  }
  releaseTravelExitLocks();
}

const target = document.getElementById('nx-stage') || document.documentElement;
new MutationObserver(scan).observe(target, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(scan));
window.addEventListener('popstate', () => queueMicrotask(scan));

window.NexusNovaTravelExitIsolation = Object.freeze({
  scan,
  release: releaseTravelExitLocks
});

scan();
