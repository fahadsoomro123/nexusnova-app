import { renderTravelSuite as renderTravelSuiteV4 } from './travel-suite-v4.js';

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
      Object.assign(back.style, {
        position: 'absolute', left: '7px', top: '8px', zIndex: '7',
        width: '35px', height: '40px', minWidth: '35px', minHeight: '40px',
        padding: '0', borderRadius: '12px',
        border: '1px solid rgba(160,185,225,.2)',
        background: 'linear-gradient(180deg,rgba(46,60,88,.78),rgba(13,21,38,.9))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08),0 7px 15px rgba(0,0,0,.22)',
        color: 'inherit', fontSize: '22px', lineHeight: '1'
      });
      dock.style.paddingLeft = '48px';
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
  const root = renderTravelSuiteV4();
  installTravelFullscreenShell(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
