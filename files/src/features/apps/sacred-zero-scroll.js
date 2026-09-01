import { qiblaSafeV2Renderers } from './premium-qibla-safe-v2.js';
import { premiumPrayerSafeRenderers } from './premium-prayer-safe.js';

function ensureSacredViewportStyles() {
  if (document.getElementById('nx-sacred-zero-scroll-v1')) return;
  const style = document.createElement('style');
  style.id = 'nx-sacred-zero-scroll-v1';
  style.textContent = `
    html.nx-qibla-zero-scroll,html.nx-prayer-zero-scroll,
    html.nx-qibla-zero-scroll body,html.nx-prayer-zero-scroll body{
      width:100%!important;max-width:100%!important;height:100%!important;max-height:100%!important;
      overflow:hidden!important;overscroll-behavior:none!important;touch-action:manipulation;
    }
    html.nx-qibla-zero-scroll .nx-app,html.nx-prayer-zero-scroll .nx-app{
      width:100%!important;max-width:760px!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;
    }
    html.nx-qibla-zero-scroll .nx-stage{
      width:100%!important;max-width:100%!important;
      height:calc(100dvh - var(--nx-dock-height) - var(--nx-safe-bottom) - 6px)!important;
      min-height:0!important;max-height:calc(100dvh - var(--nx-dock-height) - var(--nx-safe-bottom) - 6px)!important;
      padding:4px 8px 0!important;scroll-padding:0!important;overflow:hidden!important;overscroll-behavior:none!important;
    }
    html.nx-prayer-zero-scroll .nx-stage{
      width:100%!important;max-width:100%!important;height:100dvh!important;min-height:0!important;max-height:100dvh!important;
      padding:4px 8px!important;scroll-padding:0!important;overflow:hidden!important;overscroll-behavior:none!important;
    }
    html.nx-qibla-zero-scroll .nx-screen,html.nx-prayer-zero-scroll .nx-screen{
      width:100%!important;max-width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;
      margin:0!important;overflow:hidden!important;overscroll-behavior:none!important;
    }
    html.nx-qibla-zero-scroll .nx-screen>.nx-app-head,html.nx-prayer-zero-scroll .nx-screen>.nx-app-head{display:none!important}
    html.nx-qibla-zero-scroll [data-app-mount],html.nx-prayer-zero-scroll [data-app-mount]{
      position:relative!important;width:100%!important;max-width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;
      margin:0!important;padding:0!important;overflow:hidden!important;overscroll-behavior:none!important;
    }
    .nx-sacred-fit-root{
      position:relative!important;width:100%!important;max-width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;
      margin:0!important;padding:0!important;overflow:hidden!important;overscroll-behavior:none!important;contain:layout paint;
    }
    .nx-sacred-fit-root>.nx-sacred-fit-canvas{
      position:absolute!important;left:50%!important;top:0!important;width:100%!important;max-width:100%!important;
      transform-origin:top center!important;will-change:transform;
    }
    .nx-sacred-fit-root--qibla .nx2-qb-page{
      width:100%!important;max-width:100%!important;margin:0!important;padding:8px 8px 6px!important;overflow:hidden!important;
    }
    .nx-sacred-fit-root--qibla .nx2-qb-ready{display:none!important}
    .nx-sacred-fit-root--qibla .nx2-qb-grid{margin-top:12px!important}
    .nx-sacred-fit-root--qibla .nx2-qb-compass{max-width:100%!important}
    .nx-sacred-fit-root--qibla .nx2-qb-svg{overflow:hidden!important}
    .nx-sacred-fit-root--prayer .nx-prayer-premium{
      width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;
    }
    .nx-sacred-fit-root--prayer .nxprayer-console{width:100%!important;max-width:100%!important;overflow:hidden!important}
    @media(max-width:390px){
      .nx-sacred-fit-root--qibla .nx2-qb-page{padding:6px 6px 4px!important}
      .nx-sacred-fit-root--qibla .nx2-qb-grid{margin-top:8px!important}
    }
  `;
  document.head.appendChild(style);
}

function installViewportClass(className) {
  document.documentElement.classList.add(className);
  document.body.classList.add(className);
  return () => {
    document.documentElement.classList.remove(className);
    document.body.classList.remove(className);
  };
}

function makeFittedScreen(renderer, { kind, activeClass, removeReady = false } = {}) {
  ensureSacredViewportStyles();
  const body = renderer?.();
  if (!(body instanceof HTMLElement)) return body;

  const root = document.createElement('div');
  root.className = `nx-app-body nx-sacred-fit-root nx-sacred-fit-root--${kind}`;
  const canvas = document.createElement('div');
  canvas.className = 'nx-sacred-fit-canvas';
  canvas.appendChild(body);
  root.appendChild(canvas);

  if (removeReady) body.querySelector('.nx2-qb-ready')?.remove();

  const clearViewportClass = installViewportClass(activeClass);
  const baseCleanup = body.__cleanup;
  let disposed = false;
  let raf = 0;
  let timers = [];

  const fit = () => {
    if (disposed) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (disposed) return;
      canvas.style.transform = 'translateX(-50%) scale(1)';
      const available = Math.max(1, root.clientHeight - 2);
      const needed = Math.max(1, body.scrollHeight, canvas.scrollHeight);
      const scale = Math.min(1, available / needed);
      canvas.style.transform = `translateX(-50%) scale(${scale.toFixed(4)})`;
    });
  };

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  resizeObserver?.observe(root);
  resizeObserver?.observe(body);
  window.addEventListener('resize', fit, { passive:true });
  window.addEventListener('orientationchange', fit, { passive:true });
  fit();
  timers = [60, 220, 700, 1400].map(ms => window.setTimeout(fit, ms));

  root.__cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    timers = [];
    resizeObserver?.disconnect();
    window.removeEventListener('resize', fit);
    window.removeEventListener('orientationchange', fit);
    clearViewportClass();
    baseCleanup?.();
  };
  return root;
}

export function renderQiblaZeroScroll() {
  return makeFittedScreen(qiblaSafeV2Renderers.qibla, {
    kind:'qibla',
    activeClass:'nx-qibla-zero-scroll',
    removeReady:true
  });
}

export function renderPrayerZeroScroll() {
  return makeFittedScreen(premiumPrayerSafeRenderers['prayer-times'], {
    kind:'prayer',
    activeClass:'nx-prayer-zero-scroll'
  });
}

export const sacredZeroScrollRenderers = Object.freeze({
  qibla: renderQiblaZeroScroll,
  'prayer-times': renderPrayerZeroScroll
});
