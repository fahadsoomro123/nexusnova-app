/* NexusNova ALL APPS / Nova Hub Scroll + Compact Paint Owner v1
   - Keeps the bounded Android/WebView scroll container.
   - Uses a compact Samsung/One-UI-inspired app-grid scale.
   - Removes expensive Hub-only blur/glow paint layers that can cause scroll jank.
   - No feature logic, mining, rewards, auth, ads or native behavior is changed.
*/
(() => {
  'use strict';
  if (window.__nxAllAppsScrollFixV1) return;
  window.__nxAllAppsScrollFixV1 = true;
  window.nexusNovaHubVisualVersion = 'samsung-compact-smooth-v1';

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
      /* Dedicated Nova Hub scroll surface: opaque enough to avoid expensive
         backdrop recomposition on Android WebView while preserving the theme. */
      body.nx-allapps-open #moreMenu.more-menu.show{
        overflow-y:auto!important;
        overflow-x:hidden!important;
        overscroll-behavior-y:contain!important;
        -webkit-overflow-scrolling:touch!important;
        touch-action:pan-y!important;
        scroll-behavior:auto!important;
        background:linear-gradient(180deg,rgba(4,12,25,.995),rgba(2,7,14,.995))!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
        border-color:rgba(72,151,255,.22)!important;
        box-shadow:0 -8px 24px rgba(0,0,0,.48)!important;
        contain:paint!important;
      }

      /* Samsung-like compact app drawer density: four balanced columns on a
         normal phone viewport, with equal icon weight and generous tap area. */
      body.nx-allapps-open #moreMenu .more-inner{
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:8px!important;
        align-items:start!important;
        align-content:start!important;
        max-width:560px!important;
        padding:0 2px 10px!important;
        touch-action:pan-y!important;
        overscroll-behavior-y:auto!important;
      }

      body.nx-allapps-open #moreMenu .more-item{
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:flex-start!important;
        min-width:0!important;
        min-height:82px!important;
        padding:8px 3px 7px!important;
        border-radius:16px!important;
        border:1px solid rgba(255,255,255,.075)!important;
        background:rgba(11,24,42,.92)!important;
        box-shadow:0 3px 10px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.035)!important;
        transition:background-color .12s ease,border-color .12s ease!important;
        transform:none!important;
        isolation:auto!important;
        overflow:hidden!important;
        touch-action:manipulation!important;
        -webkit-tap-highlight-color:transparent!important;
        contain:layout paint style!important;
      }
      body.nx-allapps-open #moreMenu .more-item::before,
      body.nx-allapps-open #moreMenu .more-item::after{
        display:none!important;
        content:none!important;
      }
      body.nx-allapps-open #moreMenu .more-item:hover{
        transform:none!important;
        border-color:rgba(91,174,255,.20)!important;
        box-shadow:0 3px 10px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.035)!important;
      }
      body.nx-allapps-open #moreMenu .more-item:active{
        transform:scale(.985)!important;
        background:rgba(17,36,61,.96)!important;
      }

      /* Compact squircle icon container. Existing per-app color variables stay,
         but glossy overlays, dots and drop-shadows are removed for robustness. */
      body.nx-allapps-open #moreMenu .more-item .mi-icon{
        position:relative!important;
        display:grid!important;
        place-items:center!important;
        flex:0 0 46px!important;
        width:46px!important;
        height:46px!important;
        margin:0 auto 5px!important;
        border-radius:14px!important;
        color:#fff!important;
        background:linear-gradient(145deg,var(--mi-a,#247fff),var(--mi-b,#0757c8))!important;
        border:1px solid rgba(255,255,255,.20)!important;
        box-shadow:0 3px 8px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.18)!important;
        transform:none!important;
        overflow:hidden!important;
      }
      body.nx-allapps-open #moreMenu .more-item .mi-icon::before,
      body.nx-allapps-open #moreMenu .more-item .mi-icon::after{
        display:none!important;
        content:none!important;
      }
      body.nx-allapps-open #moreMenu .more-item .mi-icon svg{
        position:relative!important;
        z-index:1!important;
        width:24px!important;
        height:24px!important;
        stroke:#fff!important;
        stroke-width:1.8!important;
        filter:none!important;
        transform:none!important;
      }
      body.nx-allapps-open #moreMenu .more-item:hover .mi-icon{
        transform:none!important;
      }
      body.nx-allapps-open #moreMenu .more-item > span:last-child{
        display:-webkit-box!important;
        width:100%!important;
        min-height:22px!important;
        margin-top:0!important;
        overflow:hidden!important;
        -webkit-box-orient:vertical!important;
        -webkit-line-clamp:2!important;
        text-align:center!important;
        font-size:9.5px!important;
        line-height:1.13!important;
        font-weight:750!important;
        letter-spacing:0!important;
        color:#f5f9ff!important;
        text-shadow:none!important;
      }

      /* Keep the Nova Hub identity, but make its header compact enough that the
         actual app grid appears sooner and less content needs repainting. */
      body.nx-allapps-open #moreMenu .nx-nova-hub-header{
        margin:0 0 8px!important;
        padding:11px 12px!important;
        border-radius:17px!important;
        border-color:rgba(79,178,255,.17)!important;
        background:linear-gradient(145deg,rgba(9,31,57,.98),rgba(5,17,32,.98))!important;
        box-shadow:0 4px 12px rgba(0,0,0,.20)!important;
      }
      body.nx-allapps-open #moreMenu .nx-nova-hub-header-top{gap:9px!important}
      body.nx-allapps-open #moreMenu .nx-nova-hub-mark{
        width:36px!important;height:36px!important;flex:0 0 36px!important;
        border-radius:12px!important;box-shadow:0 4px 10px rgba(10,122,255,.20)!important
      }
      body.nx-allapps-open #moreMenu .nx-nova-hub-mark svg{width:21px!important;height:21px!important}
      body.nx-allapps-open #moreMenu .nx-nova-hub-title{font-size:16px!important}
      body.nx-allapps-open #moreMenu .nx-nova-hub-copy{margin-top:5px!important;font-size:9.5px!important;line-height:1.35!important}

      /* Core Hub entries must use the same compact app-tile language as every
         other launcher entry; no oversized special cards inside the grid. */
      body.nx-allapps-open #moreMenu .more-item[data-nx-nova-hub-core="1"]{
        border-color:rgba(84,178,255,.12)!important;
        background:rgba(11,29,50,.94)!important;
      }

      /* Preserve compact density on common Android CSS widths. */
      @media(max-width:390px){
        body.nx-allapps-open #moreMenu .more-inner{
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:7px!important;
        }
        body.nx-allapps-open #moreMenu .more-item{
          min-height:79px!important;
          padding:7px 2px 6px!important;
          border-radius:15px!important;
        }
        body.nx-allapps-open #moreMenu .more-item .mi-icon{
          width:44px!important;height:44px!important;flex-basis:44px!important;border-radius:13px!important;
        }
        body.nx-allapps-open #moreMenu .more-item .mi-icon svg{width:23px!important;height:23px!important}
        body.nx-allapps-open #moreMenu .more-item > span:last-child{font-size:9px!important}
        body.nx-allapps-open #moreMenu .nx-nova-hub-copy{display:none!important}
      }
      @media(max-width:330px){
        body.nx-allapps-open #moreMenu .more-inner{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }
      @media(prefers-reduced-motion:reduce){
        body.nx-allapps-open #moreMenu .more-item{transition:none!important}
      }

      /* Light theme keeps the same paint-light geometry. */
      body.nexus-light.nx-allapps-open #moreMenu.more-menu.show{
        background:#f7faff!important;border-color:#cadcf1!important;box-shadow:0 -6px 20px rgba(24,71,121,.12)!important
      }
      body.nexus-light.nx-allapps-open #moreMenu .more-item{
        background:#fff!important;border-color:#dbe6f2!important;box-shadow:0 2px 7px rgba(30,73,120,.08)!important
      }
      body.nexus-light.nx-allapps-open #moreMenu .more-item > span:last-child{color:#0a1a30!important}
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.nxNovaHubVisual = 'samsung-compact-smooth-v1';
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

    /* Inline !important intentionally wins over legacy regional rules that
       expand ALL APPS beyond the usable Android viewport. */
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
