/* NexusNova Nova Hub Scroll Fix v2
   Keeps Nova Hub a stable, bounded Android/WebView touch scroller.
   Uses viewport/dock geometry only — never the menu's own current top/height,
   avoiding the feedback loop that could progressively shrink the sheet.
   Scrolling/UI only; no feature, mining, wallet, reward, auth or Firebase logic.
*/
(() => {
  'use strict';
  if (window.__nxAllAppsScrollFixV1) return;
  window.__nxAllAppsScrollFixV1 = true;

  const menu = () => document.getElementById('moreMenu');
  const isOpen = () => Boolean(
    document.body?.classList.contains('nx-allapps-open') &&
    menu()?.classList.contains('show')
  );

  function viewportHeight() {
    const visual = Number(window.visualViewport?.height || 0);
    const inner = Number(window.innerHeight || document.documentElement.clientHeight || 0);
    return Math.max(1, visual || inner || 640);
  }

  function installStyles() {
    if (document.getElementById('nxAllAppsScrollFixStylesV1')) return;
    const style = document.createElement('style');
    style.id = 'nxAllAppsScrollFixStylesV1';
    style.textContent = `
      body.nx-allapps-open #moreMenu.more-menu.show{
        overflow-y:auto!important;
        overflow-x:hidden!important;
        overscroll-behavior-y:contain!important;
        -webkit-overflow-scrolling:touch!important;
        touch-action:pan-y!important;
      }
      body.nx-allapps-open #moreMenu .more-inner{
        touch-action:pan-y!important;
        overscroll-behavior-y:auto!important;
      }
      body.nx-allapps-open #moreMenu .more-item{
        touch-action:manipulation!important;
      }
    `;
    document.head.appendChild(style);
  }

  function fitScroller() {
    if (!isOpen()) return;
    const m = menu();
    if (!m) return;

    const vh = viewportHeight();
    const dock = document.querySelector('.bottom-dock');
    const dockRect = dock?.getBoundingClientRect();
    const dockTop = Number.isFinite(dockRect?.top) ? dockRect.top : (vh - 76);

    /* Stable target: about 72% of the visible viewport, while leaving a clean
       top breathing area and never covering the bottom dock. Critically this
       does NOT use m.getBoundingClientRect(), so repeated fits cannot shrink it. */
    const byViewport = Math.floor(vh * 0.72);
    const byDock = Math.floor(dockTop - 84);
    const target = Math.max(190, Math.min(620, byViewport, Math.max(190, byDock)));

    m.style.setProperty('min-height', '0px', 'important');
    m.style.setProperty('height', target + 'px', 'important');
    m.style.setProperty('max-height', target + 'px', 'important');
    m.style.setProperty('overflow-y', 'auto', 'important');
    m.style.setProperty('overflow-x', 'hidden', 'important');
    m.style.setProperty('overscroll-behavior-y', 'contain', 'important');
    m.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    m.style.setProperty('touch-action', 'pan-y', 'important');
  }

  let raf = 0;
  function scheduleFit() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      fitScroller();
      setTimeout(fitScroller, 80);
    });
  }

  function install() {
    installStyles();
    const m = menu();
    if (!m) return;

    if (!document.body.__nxAllAppsScrollBodyObserverV1) {
      const bodyObserver = new MutationObserver(scheduleFit);
      bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      document.body.__nxAllAppsScrollBodyObserverV1 = bodyObserver;
    }

    if (!m.__nxAllAppsScrollMenuObserverV1) {
      const menuObserver = new MutationObserver(scheduleFit);
      menuObserver.observe(m, { attributes: true, attributeFilter: ['class'] });
      m.__nxAllAppsScrollMenuObserverV1 = menuObserver;
    }

    window.addEventListener('resize', scheduleFit, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleFit, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleFit, { passive: true });
    window.addEventListener('orientationchange', scheduleFit, { passive: true });
    window.addEventListener('nexusnova:tab-changed', event => {
      if (/^(allapps|nova-hub)$/i.test(String(event?.detail?.name || ''))) scheduleFit();
    });

    scheduleFit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.NexusNovaHubScroll = Object.freeze({version:'2.0.0',fit:fitScroller});
})();