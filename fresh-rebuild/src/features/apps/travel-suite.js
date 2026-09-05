import { renderTravelSuite as renderTravelSuiteV16 } from './travel-suite-v16.js';

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
  root.style.setProperty('margin-left', '0', 'important');
  root.style.setProperty('margin-right', '0', 'important');

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

function installTravelFullscreenShell(root) {
  let disposed = false;

  const fit = () => {
    if (disposed || !root.isConnected) return;

    const screen = root.closest('.nx-screen');
    const header = screen?.querySelector('.nx-app-head');
    const dock = root.querySelector('.nn-dock');
    const back = header?.querySelector('[data-app-back]');

    if (back && dock && back.parentElement !== dock) {
      dock.prepend(back);
      back.className = 'nn-travel-back';
      back.setAttribute('aria-label', back.getAttribute('aria-label') || 'Back');
      back.textContent = '‹';
    }

    if (header) {
      header.hidden = true;
      header.style.display = 'none';
      header.setAttribute('aria-hidden', 'true');
    }
    if (screen) {
      screen.classList.add('nn-travel-fullscreen-shell');
      screen.style.overflow = 'hidden';
      screen.style.minHeight = '0';
      screen.style.maxWidth = '100vw';
    }
    const mount = root.parentElement;
    if (mount) {
      mount.style.minHeight = '0';
      mount.style.minWidth = '0';
      mount.style.maxWidth = '100vw';
      mount.style.overflow = 'hidden';
    }

    const viewport = window.visualViewport?.height || window.innerHeight || 720;
    const top = Math.max(0, root.getBoundingClientRect().top);
    let bottom = viewport;
    const globalDock = document.querySelector('.nx-dock.global:not([hidden])') || document.querySelector('.nx-dock:not([hidden])');
    if (globalDock) {
      const rect = globalDock.getBoundingClientRect();
      if (Number.isFinite(rect.top) && rect.top > top && rect.top < viewport) bottom = rect.top - 6;
    }
    const available = Math.max(0, Math.floor(bottom - top));
    root.style.minHeight = '0';
    root.style.height = `${available}px`;
    root.style.setProperty('--nn-h', `${available}px`);

    const width = clampTravelPhoneWidth(root);
    const canvas = root.querySelector('.nn-ref-canvas');
    if (canvas) {
      if (root.classList.contains('nn-travel-v16')) {
        canvas.style.setProperty('left', '0', 'important');
        canvas.style.setProperty('transform', 'none', 'important');
        canvas.style.setProperty('width', `${width}px`, 'important');
        canvas.style.setProperty('height', '100%', 'important');
      } else {
        const legacyWidth = Math.max(1, root.clientWidth);
        const legacyHeight = Math.max(1, root.clientHeight);
        const scale = Math.min(legacyWidth / 550, legacyHeight / 1215);
        canvas.style.transform = `translateX(-50%) scale(${Math.max(.5, Math.min(1.06, scale))})`;
      }
    }
  };

  clampTravelPhoneWidth(root);
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit, { passive: true });
  window.visualViewport?.addEventListener('resize', fit, { passive: true });

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    disposed = true;
    window.removeEventListener('resize', fit);
    window.visualViewport?.removeEventListener('resize', fit);
    previousCleanup?.();
  };
}

export function renderTravelSuite() {
  const root = renderTravelSuiteV16();
  clampTravelPhoneWidth(root);
  installTravelFullscreenShell(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
