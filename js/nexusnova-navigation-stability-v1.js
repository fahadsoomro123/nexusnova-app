/* NexusNova Navigation Stability v1
   Final navigation owner for Android/WebView + browser.
   Keeps ALL APPS escapable, restores Back to ALL APPS controls, and reduces
   scroll jank without touching mining, rewards, ads, wallet, or feature logic.
*/
(() => {
  'use strict';
  if (window.__nxNavigationStabilityV1) return;
  window.__nxNavigationStabilityV1 = true;

  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const CORE_TABS = new Set(['home', 'wallet', 'tasks', 'market']);
  const INSTALL_DELAYS = [0, 500, 1400, 3000, 6000, 10000];

  function menuOpen() {
    const menu = $('moreMenu');
    if (!menu) return false;
    return menu.classList.contains('show') && getComputedStyle(menu).display !== 'none';
  }

  function setDock(name) {
    const items = $$('.bottom-dock .dock-item');
    items.forEach(item => item.classList.remove('active'));
    const map = { home: items[0], wallet: items[1], tasks: items[2], market: items[3] };
    (map[name] || $('moreBtn'))?.classList.add('active');
  }

  function activeTabName() {
    return document.querySelector('main.main > .tab.active, main > .tab.active, .tab.active')
      ?.id?.replace(/^tab-/, '') || 'home';
  }

  function closeAllApps(clearOrigin = false) {
    const menu = $('moreMenu');
    if (menu) {
      menu.classList.remove('show');
      menu.style.display = 'none';
    }
    document.body.classList.remove('nx-allapps-open');
    if (clearOrigin) document.body.classList.remove('nx-opened-from-allapps');
  }

  function showAllApps() {
    try { window.nexusStopQRScan?.(); } catch (_) {}
    const menu = $('moreMenu');
    if (!menu) return false;
    menu.style.removeProperty('display');
    menu.classList.add('show');
    if (getComputedStyle(menu).display === 'none') menu.style.display = 'block';
    document.body.classList.add('nx-opened-from-allapps', 'nx-allapps-open');
    setDock('__allapps');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return true;
  }

  function targetFromMoreButton(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return String(button.dataset.nxmega);
    if (button.dataset?.finalBible) return 'bible';
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/)?.[1] || '';
  }

  function ensureBackButtons() {
    const targets = new Set(
      $$('#moreMenu .more-item').map(targetFromMoreButton).filter(Boolean)
    );
    targets.add('bible');

    targets.forEach(name => {
      const tab = $('tab-' + name);
      if (!tab) return;

      // Settings is a root destination in the approved Mine + Nova Hub layout.
      // Never decorate it with sub-app / reader Back chrome.
      if (name === 'about') {
        tab.querySelectorAll(':scope > .nx-allapps-back').forEach(node => node.remove());
        return;
      }
      if (name === 'tools' && tab.querySelector('.tools-main-back')) return;
      if (tab.querySelector(':scope > .nx-allapps-back')) return;

      const bar = document.createElement('div');
      bar.className = 'nx-allapps-back';
      bar.innerHTML = '<button class="tool-btn" type="button" data-nx-back-allapps>← Back to ALL APPS</button>';
      tab.insertBefore(bar, tab.firstChild);
    });
  }

  function fallbackSwitch(name, button) {
    const tab = $('tab-' + name);
    if (!tab) return false;
    $$('.tab').forEach(node => node.classList.remove('active'));
    tab.classList.add('active');
    setDock(name);
    if (button) button.classList.add('active');
    return true;
  }

  function dockName(button) {
    if (!button) return '';
    const code = String(button.getAttribute('onclick') || '');
    const named = code.match(/switchTab\(\s*['"]([^'"]+)['"]/)?.[1];
    if (named) return named;
    const items = $$('.bottom-dock .dock-item');
    const index = items.indexOf(button);
    return ['home', 'wallet', 'tasks', 'market'][index] || '';
  }

  function openCoreFromDock(name, button) {
    if (!CORE_TABS.has(name)) return false;
    closeAllApps(true);
    let result = false;
    try {
      result = typeof window.switchTab === 'function'
        ? window.switchTab(name, button)
        : fallbackSwitch(name, button);
    } catch (error) {
      console.warn('NexusNova stable dock navigation fallback:', error);
      result = fallbackSwitch(name, button);
    }
    setDock(name);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return result !== false;
  }

  function installCaptureNavigation() {
    if (document.__nxStableNavCapture) return;
    document.__nxStableNavCapture = true;

    document.addEventListener('click', event => {
      const dock = event.target.closest?.('.bottom-dock .dock-item');
      if (dock) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (dock.id === 'moreBtn') {
          if (menuOpen()) {
            closeAllApps(false);
            setDock(activeTabName());
          } else {
            showAllApps();
          }
          return;
        }

        const name = dockName(dock);
        if (name) openCoreFromDock(name, dock);
        return;
      }

      const back = event.target.closest?.('[data-nx-back-allapps], .nx-allapps-back button, .tools-main-back');
      if (back) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showAllApps();
        return;
      }

      const moreItem = event.target.closest?.('#moreMenu .more-item');
      if (moreItem) {
        document.body.classList.add('nx-opened-from-allapps');
        closeAllApps(false);
        requestAnimationFrame(ensureBackButtons);
      }
    }, true);
  }

  function wrapSwitchTab() {
    const current = window.switchTab;
    if (typeof current !== 'function' || current.__nxNavigationStableV1) return;

    const wrapped = function(name, button) {
      if (CORE_TABS.has(String(name))) closeAllApps(true);
      const result = current.call(this, name, button);
      if (CORE_TABS.has(String(name))) {
        setDock(String(name));
        requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
      }
      return result;
    };
    wrapped.__nxNavigationStableV1 = true;
    wrapped.__nxNavigationPrior = current;
    window.switchTab = wrapped;
  }

  function wrapOpenMoreTab() {
    const current = window.openMoreTab;
    if (typeof current !== 'function' || current.__nxNavigationStableV1) return;

    const wrapped = function(name) {
      document.body.classList.add('nx-opened-from-allapps');
      closeAllApps(false);
      const result = current.call(this, name);
      ensureBackButtons();
      setDock('__allapps');
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
      return result;
    };
    wrapped.__nxNavigationStableV1 = true;
    wrapped.__nxNavigationPrior = current;
    window.openMoreTab = wrapped;
  }

  function installGlobalOwners() {
    wrapSwitchTab();
    wrapOpenMoreTab();

    const stableBack = function() {
      return showAllApps();
    };
    stableBack.__nxNavigationStableV1 = true;
    window.nexusBackToAllApps = stableBack;

    if (!window.toggleMore?.__nxNavigationStableV1) {
      const stableToggle = function() {
        if (menuOpen()) {
          closeAllApps(false);
          setDock(activeTabName());
          return false;
        }
        return showAllApps();
      };
      stableToggle.__nxNavigationStableV1 = true;
      window.toggleMore = stableToggle;
    }
  }

  function installScrollPolish() {
    if ($('nxNavigationStabilityStylesV1')) return;
    const style = document.createElement('style');
    style.id = 'nxNavigationStabilityStylesV1';
    style.textContent = `
      html,body{scroll-behavior:auto!important;overscroll-behavior-y:contain}
      body{overflow-x:hidden!important}
      .bottom-dock,.bottom-dock .dock-item{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      body.nx-allapps-open #moreMenu.more-menu.show{overflow-y:auto!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch;touch-action:pan-y;z-index:1290!important;padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))!important}
      body.nx-allapps-open .bottom-dock{z-index:1300!important;pointer-events:auto!important}
      #moreMenu .more-inner{scroll-behavior:auto!important;overscroll-behavior:contain}
      .nx-allapps-back{touch-action:manipulation}
      .nx-allapps-back .tool-btn{touch-action:manipulation;min-height:42px}
      body.nx-nav-scrolling #moreMenu .more-item{transition:none!important;box-shadow:none!important}
      body.nx-nav-scrolling #moreMenu .more-item .mi-icon{transition:none!important;filter:none!important}
    `;
    document.head.appendChild(style);

    let timer = 0;
    let raf = 0;
    const noteScroll = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          document.body.classList.add('nx-nav-scrolling');
        });
      }
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.remove('nx-nav-scrolling'), 120);
    };
    window.addEventListener('scroll', noteScroll, { passive: true });
    $('moreMenu')?.addEventListener('scroll', noteScroll, { passive: true });
  }

  function installObservers() {
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (main && !main.__nxStableBackObserver) {
      let queued = false;
      const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          ensureBackButtons();
        });
      });
      observer.observe(main, { childList: true, subtree: true });
      main.__nxStableBackObserver = observer;
    }

    const menu = document.querySelector('#moreMenu .more-inner');
    if (menu && !menu.__nxStableMenuObserver) {
      const observer = new MutationObserver(() => requestAnimationFrame(ensureBackButtons));
      observer.observe(menu, { childList: true });
      menu.__nxStableMenuObserver = observer;
    }
  }

  function install() {
    installCaptureNavigation();
    installGlobalOwners();
    installScrollPolish();
    ensureBackButtons();
    installObservers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  INSTALL_DELAYS.forEach(delay => setTimeout(install, delay));
})();