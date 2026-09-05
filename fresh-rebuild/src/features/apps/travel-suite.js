import { renderTravelSuite as renderTravelSuiteV9 } from './travel-suite-v9.js';

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
      Object.assign(back.style, {
        position: 'absolute', left: '8px', top: '7px', zIndex: '7',
        width: '58px', height: '76px', minWidth: '58px', minHeight: '76px',
        padding: '0', borderRadius: '18px',
        border: '1px solid #1d5275',
        background: 'linear-gradient(180deg,#123958,#0a263f)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08),0 8px 18px rgba(0,0,0,.26)',
        color: '#e9f7ff', fontSize: '38px', fontWeight: '300', lineHeight: '1'
      });
      dock.style.paddingLeft = '80px';
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
    }
    const mount = root.parentElement;
    if (mount) {
      mount.style.minHeight = '0';
      mount.style.overflow = 'hidden';
    }

    const viewport = window.visualViewport?.height || window.innerHeight || 720;
    const top = Math.max(0, root.getBoundingClientRect().top);
    let bottom = viewport;
    const globalDock = document.querySelector('.nx-dock:not([hidden])');
    if (globalDock) {
      const rect = globalDock.getBoundingClientRect();
      if (Number.isFinite(rect.top) && rect.top > top && rect.top < viewport) bottom = rect.top - 6;
    }
    const available = Math.max(0, Math.floor(bottom - top));
    root.style.minHeight = '0';
    root.style.height = `${available}px`;
    root.style.setProperty('--nn-h', `${available}px`);

    const canvas = root.querySelector('.nn-ref-canvas');
    if (canvas) {
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      const scale = Math.min(width / 550, height / 1032);
      canvas.style.transform = `translateX(-50%) scale(${Math.max(.5, Math.min(1.06, scale))})`;
    }
  };

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
  const root = renderTravelSuiteV9();
  installTravelFullscreenShell(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
