import { renderTravelSuite as renderTravelSuiteV16 } from './travel-suite-v16.js';

function ensureRuntimeShellCss() {
  if (document.getElementById('nn-travel-runtime-shell-v17')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-runtime-shell-v17';
  style.textContent = `
    .nn-travel-fullscreen-shell{
      position:relative!important;
      overflow:hidden!important;
      min-height:0!important;
      width:100%!important;
      max-width:100vw!important;
    }
    .nn-travel-fullscreen-mount{
      position:absolute!important;
      inset:0!important;
      margin:0!important;
      padding:0!important;
      min-width:0!important;
      min-height:0!important;
      overflow:hidden!important;
    }
    .nn-travel-reference-fill{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      max-width:100%!important;
      height:100%!important;
      max-height:100%!important;
      min-width:0!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
    }
    .nn-travel-reference-fill .nn-ref-canvas{
      position:absolute!important;
      inset:0!important;
      left:0!important;
      top:0!important;
      transform:none!important;
      width:100%!important;
      max-width:100%!important;
      height:100%!important;
      max-height:100%!important;
      min-width:0!important;
      min-height:0!important;
      box-sizing:border-box!important;
      align-content:stretch!important;
    }
    .nn-travel-reference-fill .nn-stage{
      height:100%!important;
      min-height:0!important;
      overflow:hidden!important;
    }
    .nn-travel-reference-fill [data-panel]{
      height:100%!important;
      min-height:0!important;
      overflow:hidden!important;
    }
    .nn-travel-reference-fill [data-panel][hidden]{
      display:none!important;
      visibility:hidden!important;
      pointer-events:none!important;
      position:absolute!important;
      inset:0!important;
    }
    .nn-travel-reference-fill .nn-results,
    .nn-travel-reference-fill .nn-ref-results-list{
      min-height:0!important;
      overflow-y:auto!important;
      overscroll-behavior:contain!important;
    }
  `;
  document.head.appendChild(style);
}

function clampTravelPhoneWidth(root) {
  const viewportWidth = Math.max(
    1,
    Math.floor(
      window.visualViewport?.width ||
      window.innerWidth ||
      document.documentElement?.clientWidth ||
      390
    )
  );
  const screen = root.closest('.nx-screen');
  const screenWidth = Math.floor(screen?.getBoundingClientRect().width || 0);
  const mountWidth = Math.floor(root.parentElement?.getBoundingClientRect().width || 0);
  const candidates = [viewportWidth, screenWidth, mountWidth].filter(value => Number.isFinite(value) && value > 0);
  const width = Math.max(1, Math.min(...candidates));

  root.style.setProperty('width', `${width}px`, 'important');
  root.style.setProperty('max-width', `${viewportWidth}px`, 'important');
  root.style.setProperty('min-width', '0', 'important');
  root.style.setProperty('box-sizing', 'border-box', 'important');
  root.style.setProperty('margin', '0', 'important');

  const canvas = root.querySelector('.nn-ref-canvas');
  if (canvas) {
    canvas.style.setProperty('left', '0', 'important');
    canvas.style.setProperty('transform', 'none', 'important');
    canvas.style.setProperty('width', `${width}px`, 'important');
    canvas.style.setProperty('max-width', `${viewportWidth}px`, 'important');
    canvas.style.setProperty('min-width', '0', 'important');
    canvas.style.setProperty('box-sizing', 'border-box', 'important');
  }
  return width;
}

function hideLegacyTravelChrome(root, screen) {
  if (!screen) return;

  const appHead = screen.querySelector('.nx-app-head');
  const travelDock = root.querySelector('.nn-dock');
  const back = appHead?.querySelector('[data-app-back]');
  if (back && travelDock && back.parentElement !== travelDock) {
    travelDock.prepend(back);
    back.className = 'nn-travel-back';
    back.setAttribute('aria-label', back.getAttribute('aria-label') || 'Back');
    back.textContent = '‹';
  }
  if (appHead) {
    appHead.hidden = true;
    appHead.setAttribute('aria-hidden', 'true');
    appHead.style.setProperty('display', 'none', 'important');
  }

  const candidates = [...screen.querySelectorAll('*')].filter(el => {
    if (el === root || root.contains(el)) return false;
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    return text.includes('TRAVEL OPERATIONS DESK');
  });

  for (const candidate of candidates) {
    let target = candidate;
    for (let i = 0; i < 4 && target.parentElement && target.parentElement !== screen; i += 1) {
      const parent = target.parentElement;
      const text = String(parent.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
      const rect = parent.getBoundingClientRect();
      if (text.includes('TRAVEL OPERATIONS DESK') && rect.height > 0 && rect.height <= 150 && !parent.contains(root)) {
        target = parent;
      } else {
        break;
      }
    }
    target.hidden = true;
    target.setAttribute('aria-hidden', 'true');
    target.style.setProperty('display', 'none', 'important');
  }
}

function installHardTabIsolation(root) {
  let active = root.querySelector('[data-travel-tab].is-active')?.dataset.travelTab || 'flights';
  let disposed = false;
  let timers = [];

  const apply = () => {
    if (disposed || !root.isConnected) return;
    const normalized = ['flights', 'hotels', 'ground', 'plan'].includes(active) ? active : 'flights';
    root.dataset.activeTravelPanel = normalized;

    root.querySelectorAll('[data-travel-tab]').forEach(tab => {
      const selected = tab.dataset.travelTab === normalized;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });

    root.querySelectorAll('[data-panel]').forEach(panel => {
      const selected = panel.dataset.panel === normalized;
      panel.hidden = !selected;
      panel.setAttribute('aria-hidden', selected ? 'false' : 'true');
      panel.style.setProperty('display', selected ? 'grid' : 'none', 'important');
      panel.style.setProperty('visibility', selected ? 'visible' : 'hidden', 'important');
      panel.style.setProperty('pointer-events', selected ? 'auto' : 'none', 'important');
      if (!selected) {
        panel.style.setProperty('position', 'absolute', 'important');
        panel.style.setProperty('inset', '0', 'important');
      } else {
        panel.style.removeProperty('position');
        panel.style.removeProperty('inset');
      }
    });
  };

  const settle = () => {
    timers.forEach(clearTimeout);
    timers = [];
    queueMicrotask(apply);
    requestAnimationFrame(() => requestAnimationFrame(apply));
    timers.push(window.setTimeout(apply, 40));
    timers.push(window.setTimeout(apply, 180));
    timers.push(window.setTimeout(apply, 420));
  };

  const onClick = event => {
    const tab = event.target.closest?.('[data-travel-tab]');
    if (!tab || !root.contains(tab)) return;
    active = tab.dataset.travelTab || 'flights';
    settle();
  };

  root.addEventListener('click', onClick, true);
  settle();

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    disposed = true;
    timers.forEach(clearTimeout);
    root.removeEventListener('click', onClick, true);
    previousCleanup?.();
  };
}

function installReferenceFullscreen(root) {
  let disposed = false;
  let timer = 0;

  const fit = () => {
    if (disposed || !root.isConnected) return;

    const screen = root.closest('.nx-screen') || root.parentElement;
    const mount = root.parentElement;
    if (!screen || !mount) return;

    hideLegacyTravelChrome(root, screen);

    screen.classList.add('nn-travel-fullscreen-shell');
    mount.classList.add('nn-travel-fullscreen-mount');
    root.classList.add('nn-travel-reference-fill');

    const viewportHeight = Math.max(1, Math.floor(window.visualViewport?.height || window.innerHeight || screen.getBoundingClientRect().height || 720));
    const screenRect = screen.getBoundingClientRect();
    const globalDock = document.querySelector('.nx-dock.global:not([hidden])');
    const dockRect = globalDock?.getBoundingClientRect();

    const screenTop = Number.isFinite(screenRect.top) ? Math.max(0, screenRect.top) : 0;
    let contentBottom = viewportHeight;
    if (dockRect && Number.isFinite(dockRect.top) && dockRect.top > screenTop + 120 && dockRect.top <= viewportHeight + 12) {
      contentBottom = dockRect.top - 6;
    }
    const available = Math.max(320, Math.floor(contentBottom - screenTop));

    screen.style.setProperty('position', 'relative', 'important');
    screen.style.setProperty('height', `${available}px`, 'important');
    screen.style.setProperty('max-height', `${available}px`, 'important');
    screen.style.setProperty('min-height', `${available}px`, 'important');
    screen.style.setProperty('overflow', 'hidden', 'important');
    screen.style.setProperty('margin', '0', 'important');
    screen.style.setProperty('padding', '0', 'important');

    mount.style.setProperty('position', 'absolute', 'important');
    mount.style.setProperty('inset', '0', 'important');
    mount.style.setProperty('width', '100%', 'important');
    mount.style.setProperty('height', '100%', 'important');
    mount.style.setProperty('max-height', '100%', 'important');
    mount.style.setProperty('margin', '0', 'important');
    mount.style.setProperty('padding', '0', 'important');
    mount.style.setProperty('overflow', 'hidden', 'important');

    const width = clampTravelPhoneWidth(root);
    root.style.setProperty('position', 'absolute', 'important');
    root.style.setProperty('inset', '0', 'important');
    root.style.setProperty('width', `${width}px`, 'important');
    root.style.setProperty('height', '100%', 'important');
    root.style.setProperty('max-height', '100%', 'important');
    root.style.setProperty('min-height', '0', 'important');
    root.style.setProperty('--nn-h', `${available}px`);

    const canvas = root.querySelector('.nn-ref-canvas');
    if (canvas) {
      canvas.style.setProperty('position', 'absolute', 'important');
      canvas.style.setProperty('inset', '0', 'important');
      canvas.style.setProperty('left', '0', 'important');
      canvas.style.setProperty('top', '0', 'important');
      canvas.style.setProperty('transform', 'none', 'important');
      canvas.style.setProperty('width', '100%', 'important');
      canvas.style.setProperty('height', '100%', 'important');
      canvas.style.setProperty('max-height', '100%', 'important');
      canvas.style.setProperty('min-height', '0', 'important');
    }
  };

  const settle = () => {
    requestAnimationFrame(() => requestAnimationFrame(fit));
    clearTimeout(timer);
    timer = window.setTimeout(fit, 180);
  };

  settle();
  window.addEventListener('resize', settle, { passive: true });
  window.visualViewport?.addEventListener('resize', settle, { passive: true });

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener('resize', settle);
    window.visualViewport?.removeEventListener('resize', settle);
    previousCleanup?.();
  };
}

export function renderTravelSuite() {
  ensureRuntimeShellCss();
  const root = renderTravelSuiteV16();
  root.dataset.runtimeRepair = 'locked-reference-fullscreen-tabs-v17';
  clampTravelPhoneWidth(root);
  installHardTabIsolation(root);
  installReferenceFullscreen(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
