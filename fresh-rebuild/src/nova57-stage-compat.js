const STAGE_ID = 'nx-stage';
const ACTIVE_CLASS = 'nx57-stage-active';
const DOCK_SELECTOR = '.nx-dock';
const NOVA_SELECTOR = '.nx57-shell-premium';
const PREMIUM_GAP_PX = 8;

let measureFrame = 0;

function measureNovaToDock(stage, root) {
  const dock = document.querySelector(DOCK_SELECTOR);
  if (!dock || dock.hidden || !root?.isConnected) {
    root?.style?.removeProperty('--nx57-measured-height');
    return;
  }

  const rootTop = root.getBoundingClientRect().top;
  const dockTop = dock.getBoundingClientRect().top;
  const measured = Math.floor(dockTop - rootTop - PREMIUM_GAP_PX);
  if (Number.isFinite(measured) && measured >= 360) {
    root.style.setProperty('--nx57-measured-height', `${measured}px`);
  }
}

function scheduleMeasure(stage, root) {
  if (measureFrame) cancelAnimationFrame(measureFrame);
  measureFrame = requestAnimationFrame(() => {
    measureFrame = requestAnimationFrame(() => measureNovaToDock(stage, root));
  });
}

function syncNovaStage() {
  const stage = document.getElementById(STAGE_ID);
  if (!stage) return;
  const root = stage.querySelector(NOVA_SELECTOR);
  const active = Boolean(root);
  stage.classList.toggle(ACTIVE_CLASS, active);
  document.documentElement.classList.toggle(ACTIVE_CLASS, active);
  if (active) scheduleMeasure(stage, root);
}

function installNovaStageCompat() {
  const stage = document.getElementById(STAGE_ID);
  if (!stage) return;
  syncNovaStage();

  const observer = new MutationObserver(syncNovaStage);
  observer.observe(stage, { childList: true, subtree: true });

  const remeasure = () => {
    const root = stage.querySelector(NOVA_SELECTOR);
    if (root) scheduleMeasure(stage, root);
  };
  window.addEventListener('resize', remeasure, { passive: true });
  window.addEventListener('orientationchange', remeasure, { passive: true });
  window.visualViewport?.addEventListener('resize', remeasure, { passive: true });
  window.visualViewport?.addEventListener('scroll', remeasure, { passive: true });

  window.addEventListener('pagehide', () => {
    observer.disconnect();
    window.removeEventListener('resize', remeasure);
    window.removeEventListener('orientationchange', remeasure);
    window.visualViewport?.removeEventListener('resize', remeasure);
    window.visualViewport?.removeEventListener('scroll', remeasure);
    if (measureFrame) cancelAnimationFrame(measureFrame);
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installNovaStageCompat, { once: true });
} else {
  installNovaStageCompat();
}
