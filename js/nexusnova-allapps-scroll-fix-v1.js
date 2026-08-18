/* NexusNova ALL APPS Scroll Fix v1
   Resolves the Android/WebView conflict where older regional ALL APPS CSS
   expands #moreMenu while the navigation layer expects it to be a bounded
   scroll container. This file touches scrolling only; no feature logic.
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
        touch-action:pan-y!important;
      }
    `;
    document.head.appendChild(style);
  }

  function fitScroller() {
    if (!isOpen()) return;
    const m = menu();
    if (!m) return;

    const dock = document.querySelector('.bottom-dock');
    const rect = m.getBoundingClientRect();
    const dockRect = dock?.getBoundingClientRect();
    const viewportBottom = Math.min(
      window.innerHeight || document.documentElement.clientHeight || 0,
      dockRect?.top || Number.POSITIVE_INFINITY
    );
    const available = Math.max(160, Math.floor(viewportBottom - Math.max(0, rect.top) - 8));

    /* Inline !important intentionally wins over the legacy regional rule that
       sets min-height/max-height/overflow for ALL APPS. */
    m.style.setProperty('min-height', '0px', 'important');
    m.style.setProperty('height', 'auto', 'important');
    m.style.setProperty('max-height', available + 'px', 'important');
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
      setTimeout(fitScroller, 60);
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
    window.addEventListener('nexusnova:tab-changed', event => {
      if (String(event?.detail?.name || '') === 'allapps') scheduleFit();
    });

    scheduleFit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();

// Final web-only branding layer: turns the fixed dock into Mine + Nova Hub and
// keeps Wallet/Market accessible inside the Hub. Loaded here because this module
// already runs last in page2.js after the navigation stability owner.
import('./nexusnova-nova-hub-nav-v1.js?v=1').catch(error => {
  console.warn('NexusNova Nova Hub navigation:', error);
});

// Web-only Play-readiness Settings option. This opens the same-origin account
// deletion request page without changing auth or deleting anything client-side.
import('./nexusnova-account-deletion-settings-v1.js?v=1').catch(error => {
  console.warn('NexusNova account deletion Settings option:', error);
});
