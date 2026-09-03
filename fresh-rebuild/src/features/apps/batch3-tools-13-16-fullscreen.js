const ACTIVE_CLASS = 'nx-batch3-tools-active';
const SCREEN_CLASS = 'nx-batch3-tools-screen';
const stage = document.getElementById('nx-stage');

let activeScreen = null;
let activeCleanup = null;

const APP_DETECTORS = [
  { id:'qibla', className:'nx-b3-qibla', selectors:['[data-qb-heading]','[data-qb-bearing]'], ownBack:'[data-qb-back]' },
  { id:'prayer-times', className:'nx-b3-prayer', selectors:['[data-prayer-list]','[data-prayer-countdown]'], ownBack:'[data-prayer-back]' },
  { id:'pakistan', className:'nx-b3-pakistan', selectors:['[data-pk-list]','[data-pk-status]'] },
  { id:'news', className:'nx-b3-news', selectors:['[data-news-list]','[data-news-status]'] }
];

function detectApp() {
  if (!stage) return null;
  for (const config of APP_DETECTORS) {
    for (const selector of config.selectors) {
      const marker = stage.querySelector(selector);
      if (!marker) continue;
      const screen = marker.closest('.nx-screen');
      const root = marker.closest('.nx-app-body') || screen?.querySelector('[data-app-mount] > *');
      if (screen && root) return { ...config, marker, screen, root };
    }
  }
  return null;
}

function enhance(found) {
  const { id, className, ownBack, screen, root } = found;
  if (screen.dataset.batch3Fullscreen === id) return () => {};

  screen.dataset.batch3Fullscreen = id;
  screen.classList.add(SCREEN_CLASS, className);
  root.classList.add(`${className}-root`);
  document.documentElement.classList.add(ACTIVE_CLASS);
  document.body.classList.add(ACTIVE_CLASS);
  document.documentElement.dataset.nxBatch3App = id;
  activeScreen = screen;

  let back = null;
  let openHub = null;
  if (!ownBack || !root.querySelector(ownBack)) {
    back = document.createElement('button');
    back.type = 'button';
    back.className = 'nx-batch3-hub-back';
    back.setAttribute('aria-label', 'Back to Nova Hub');
    back.textContent = '‹';
    openHub = () => window.NexusNovaFresh?.openHub?.();
    back.addEventListener('click', openHub);
    screen.appendChild(back);
  }

  return () => {
    if (back && openHub) back.removeEventListener('click', openHub);
    back?.remove();
    root.classList.remove(`${className}-root`);
    screen.classList.remove(SCREEN_CLASS, className);
    delete screen.dataset.batch3Fullscreen;
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    delete document.documentElement.dataset.nxBatch3App;
    activeScreen = null;
  };
}

function sync() {
  const found = detectApp();
  if (!found) {
    if (activeCleanup) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      cleanup();
    }
    return;
  }
  if (activeScreen === found.screen && activeCleanup) return;
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = null;
    cleanup();
  }
  try {
    activeCleanup = enhance(found);
  } catch (error) {
    console.error('[NexusNova Batch 3] fullscreen enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(ACTIVE_CLASS);
    delete document.documentElement.dataset.nxBatch3App;
    activeScreen = null;
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(sync));
  observer.observe(stage, { childList:true, subtree:true });
  sync();
}
