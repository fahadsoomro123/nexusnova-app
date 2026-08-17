/* NexusNova Shell v2
   Major navigation/UI shell only.
   - Bottom dock: Mining + Nova Hub only.
   - Wallet, Rewards and Market move to Mining quick access.
   - Settings becomes short by default with More Settings collapsed.
   - No mining/reward/wallet/auth/Firebase value mutation.
*/
(() => {
  'use strict';
  if (window.__nxShellV2) return;
  window.__nxShellV2 = true;

  const HOME_AUX = new Set(['wallet','tasks','market']);
  const CSS_MARKER = 'data-nx-shell-v2-css';
  const $ = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let wrappedUx = null;

  function ensureCss() {
    if ($(`link[${CSS_MARKER}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/nexusnova-shell-v2.css?v=20260817-shell2';
    link.setAttribute(CSS_MARKER,'1');
    document.head.appendChild(link);
  }

  function dockButton(target) {
    return qsa('.bottom-dock .dock-item').find(button => {
      const action = String(button.getAttribute('onclick') || '');
      return new RegExp(`switchTab\\(\\s*['"]${target}['"]`).test(action);
    }) || null;
  }

  function labelNode(button) {
    if (!button) return null;
    return qsa(':scope > span',button)
      .filter(node => !node.classList.contains('mi-icon') && !node.classList.contains('nx-brand-app-badge'))
      .pop() || null;
  }

  function setText(node, value) {
    if (node && String(node.textContent || '').trim() !== value) node.textContent = value;
  }

  function activeTabName() {
    return String($('main.main > .tab.active,main > .tab.active,.tab.active')?.id || '').replace(/^tab-/,'') || 'home';
  }

  function setupDock() {
    const inner = $('.bottom-dock .dock-inner');
    if (!inner) return false;
    document.body?.classList.add('nx-two-tab-shell');
    inner.classList.add('nx-two-tab-dock');

    const mining = dockButton('home');
    const hub = $('#moreBtn');

    if (mining) {
      setText(labelNode(mining),'Mining');
      mining.dataset.nxDockPrimary = 'mining';
      mining.hidden = false;
      mining.removeAttribute('aria-hidden');
      mining.tabIndex = 0;
      mining.setAttribute('aria-label','Mining');
      mining.title = 'Mining';
    }

    if (hub) {
      setText(labelNode(hub),'Nova Hub');
      hub.dataset.nxDockPrimary = 'hub';
      hub.hidden = false;
      hub.removeAttribute('aria-hidden');
      hub.tabIndex = 0;
      hub.setAttribute('aria-label','Open Nova Hub');
      hub.title = 'Nova Hub';
    }

    HOME_AUX.forEach(target => {
      const button = dockButton(target);
      if (!button) return;
      button.dataset.nxDockHidden = '1';
      button.hidden = true;
      button.setAttribute('aria-hidden','true');
      button.tabIndex = -1;
      button.classList.remove('active');
    });

    syncDockState();
    return Boolean(mining && hub);
  }

  function syncDockState() {
    const mining = dockButton('home');
    const hub = $('#moreBtn');
    const tabName = activeTabName();
    const hubOpen = Boolean($('#moreMenu')?.classList.contains('show'));
    const miningFamily = tabName === 'home' || HOME_AUX.has(tabName);

    if (mining) mining.classList.toggle('active',miningFamily && !hubOpen);
    if (hub) hub.classList.toggle('active',hubOpen || !miningFamily);
  }

  function backToMining() {
    const mining = dockButton('home');
    if (!mining) return false;
    try {
      mining.click();
      setTimeout(syncDockState,0);
      return true;
    } catch (_) { return false; }
  }

  function installBackBridge() {
    const ux = window.NexusNovaUxSimplify;
    if (!ux || ux === wrappedUx || ux.__nxShellV2Wrapped) return false;

    const originalSystemBack = typeof ux.systemBack === 'function' ? ux.systemBack.bind(ux) : null;
    const originalBack = typeof ux.back === 'function' ? ux.back.bind(ux) : null;
    wrappedUx = Object.freeze({
      ...ux,
      __nxShellV2Wrapped:true,
      back() {
        if (HOME_AUX.has(activeTabName())) return backToMining();
        return originalBack ? originalBack() : false;
      },
      systemBack() {
        const menuOpen = Boolean($('#moreMenu')?.classList.contains('show'));
        if (!menuOpen && HOME_AUX.has(activeTabName())) return backToMining();
        return originalSystemBack ? originalSystemBack() : false;
      }
    });
    window.NexusNovaUxSimplify = wrappedUx;
    return true;
  }

  function openCore(target) {
    if (!HOME_AUX.has(target)) return false;
    $('#moreMenu')?.classList.remove('show');

    const legacy = dockButton(target);
    if (legacy) {
      try {
        legacy.click();
        setTimeout(syncDockState,0);
        return true;
      } catch (_) {}
    }

    try {
      if (typeof window.openMoreTab === 'function') {
        window.openMoreTab(target);
        setTimeout(syncDockState,0);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function ensureHomeQuickAccess() {
    const home = $('#tab-home');
    if (!home) return false;
    let panel = $('#nxHomeCoreAccess',home);
    if (panel) return true;

    panel = document.createElement('section');
    panel.id = 'nxHomeCoreAccess';
    panel.className = 'nx-home-core-access';
    panel.setAttribute('aria-label','NexusNova quick access');
    panel.innerHTML = `
      <div class="nx-core-head">
        <div><span>NEXUSNOVA CORE</span><strong>Quick access</strong></div>
        <small>Essentials</small>
      </div>
      <div class="nx-core-grid">
        <button type="button" class="nx-core-card" data-nx-core-target="wallet" aria-label="Open Wallet">
          <span class="nx-core-icon"><svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10h17M15.5 14h2"/></svg></span>
          <span class="nx-core-copy"><b>Wallet</b><small>Assets & activity</small></span><i>›</i>
        </button>
        <button type="button" class="nx-core-card" data-nx-core-target="tasks" aria-label="Open Rewards">
          <span class="nx-core-icon"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8v12M4 12h16M8 8c0-2 1.4-3 3-3 1.2 0 1.8.5 2.5 1.7C14.2 5.5 15 5 16.2 5 18 5 19 6.2 19 8"/></svg></span>
          <span class="nx-core-copy"><b>Rewards</b><small>Daily & tasks</small></span><i>›</i>
        </button>
        <button type="button" class="nx-core-card" data-nx-core-target="market" aria-label="Open Market">
          <span class="nx-core-icon"><svg viewBox="0 0 24 24"><path d="M4 18V9l4 4 4-7 4 5 4-3v10z"/></svg></span>
          <span class="nx-core-copy"><b>Market</b><small>Live crypto prices</small></span><i>›</i>
        </button>
      </div>`;

    qsa('[data-nx-core-target]',panel).forEach(button => {
      button.addEventListener('click',() => openCore(button.dataset.nxCoreTarget));
    });

    const stats = $('.stats-grid',home);
    if (stats?.nextSibling) home.insertBefore(panel,stats.nextSibling);
    else home.appendChild(panel);
    return true;
  }

  function cardTitle(card) {
    return String(card?.querySelector('h2,h3')?.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function rowByControl(tab,id) {
    return tab.querySelector(`#${id}`)?.closest('.settings-row') || null;
  }

  function ensureAdvancedSettings(tab) {
    let details = $('#nxMoreSettings',tab);
    if (details) return details;

    details = document.createElement('details');
    details.id = 'nxMoreSettings';
    details.className = 'nx-more-settings';
    details.innerHTML = `
      <summary>
        <span class="nx-more-settings-icon">•••</span>
        <span><b>More Settings</b><small>AI, privacy, system, support & advanced preferences</small></span>
        <i>⌄</i>
      </summary>
      <div class="nx-more-settings-body"></div>`;
    tab.appendChild(details);
    return details;
  }

  function compactSettings() {
    const tab = $('#tab-about');
    if (!tab) return false;
    tab.classList.add('nx-settings-compact');

    const hero = $('.settings-hero',tab);
    if (hero) {
      const title = hero.querySelector('h2');
      const sub = hero.querySelector('.settings-muted');
      if (title) setText(title,'NexusNova Settings');
      if (sub) setText(sub,'Essential controls. Advanced options stay tucked away.');
    }

    const details = ensureAdvancedSettings(tab);
    const body = $('.nx-more-settings-body',details);
    if (!body) return false;

    let advancedPrefs = $('#nxAdvancedPreferences',body);
    if (!advancedPrefs) {
      advancedPrefs = document.createElement('div');
      advancedPrefs.id = 'nxAdvancedPreferences';
      advancedPrefs.className = 'card settings-card nx-advanced-preferences';
      advancedPrefs.innerHTML = '<h3>Advanced preferences</h3>';
      body.prepend(advancedPrefs);
    }

    ['compactSetting','notifyMarket','currencySetting'].forEach(id => {
      const row = rowByControl(tab,id);
      if (row && row.parentElement !== advancedPrefs) advancedPrefs.appendChild(row);
    });

    const keep = new Set(['account','appearance','notifications','general']);
    Array.from(tab.children).forEach(child => {
      if (!(child instanceof HTMLElement) || !child.classList.contains('settings-card')) return;
      const title = cardTitle(child);
      const keepVisible = Array.from(keep).some(key => title.includes(key));
      if (!keepVisible && child.parentElement !== body) body.appendChild(child);
    });

    Array.from(tab.children).forEach(child => {
      if (!(child instanceof HTMLElement) || !child.classList.contains('settings-card')) return;
      const title = cardTitle(child);
      if (!Array.from(keep).some(key => title.includes(key))) body.appendChild(child);
    });

    return true;
  }

  function installObservers() {
    const tabs = ['tab-home','tab-wallet','tab-tasks','tab-market'].map(id => document.getElementById(id)).filter(Boolean);
    const menu = $('#moreMenu');
    const observer = new MutationObserver(syncDockState);
    [...tabs,menu].filter(Boolean).forEach(node => observer.observe(node,{attributes:true,attributeFilter:['class','hidden']}));

    const settings = $('#tab-about');
    if (settings) {
      let settingsTimer = 0;
      const settingsObserver = new MutationObserver(() => {
        clearTimeout(settingsTimer);
        settingsTimer = setTimeout(compactSettings,40);
      });
      settingsObserver.observe(settings,{childList:true});
    }
  }

  function apply() {
    ensureCss();
    setupDock();
    ensureHomeQuickAccess();
    compactSettings();
    installBackBridge();
    syncDockState();
  }

  function install() {
    apply();
    installObservers();
    document.addEventListener('click',() => setTimeout(() => { installBackBridge(); syncDockState(); },0),true);
    [180,500,1100,2200,4500].forEach(ms => setTimeout(apply,ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.NexusNovaShellV2 = Object.freeze({
    version:'2.0.1',
    refresh:apply,
    openCore,
    backToMining
  });
})();