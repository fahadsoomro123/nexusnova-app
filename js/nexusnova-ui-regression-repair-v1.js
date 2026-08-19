/* NexusNova UI Regression Repair v1
   Focused restore for the user-approved Android layout.
   - NEVER changes the approved bottom Mine + Nova Hub dock structure.
   - Restores Wallet / Tasks / Market as Mine-domain quick destinations.
   - Keeps Nova Hub header above Smart App Search.
   - Removes reader-style PREVIOUS/BACK/NEXT chrome from Settings.
   - Hides duplicate Settings app hero only; account/settings logic stays owned by Settings v3.
*/
(() => {
  'use strict';
  if (window.__nxUiRegressionRepairV1) return;
  window.__nxUiRegressionRepairV1 = true;

  const MINE_DOMAIN = new Set(['home','wallet','tasks','market']);
  const EXPECTED_HUB_LABELS = [
    'TOOLS','GOLD/FX','NEWS','CHAT','AI','LOCATION','SOS','FAMILY','PROFILE','DAILY','BUDGET','LEARN','TRAVEL','HEALTH','SMART','QIBLA','PK NEWS','WATCH','BROWSER','CALLER','SETTINGS','SUPER APP','DAILY TOOLS','CALENDAR','REMINDERS','FINANCE','WEATHER','LEARNING','PAKISTAN HUB','ISLAMIC HUB','BIBLE','HABITS','SAVINGS','CONTACTS','SHOPPING','DOCUMENTS','FILE VAULT','QR TOOLS','SECURITY','MARKETPLACE','ORDERS','NOTIFICATIONS','TEACHER TOOLKIT'
  ];
  let queued = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function labelOf(button) {
    const spans = button?.querySelectorAll(':scope > span');
    const value = spans?.length ? spans[spans.length - 1].textContent : button?.textContent;
    return String(value || '').replace(/\s+/g,' ').trim().toUpperCase();
  }

  function activeTabName() {
    return String($('main.main > .tab.active, main > .tab.active, .tab.active')?.id || '').replace(/^tab-/,'') || 'home';
  }

  function installStyles() {
    if ($('#nxUiRegressionRepairV1Style')) return;
    const style = document.createElement('style');
    style.id = 'nxUiRegressionRepairV1Style';
    style.textContent = `
      /* Settings is a root screen, not a book reader/sub-app. */
      body.nx-settings-root-v1 #nxUxBottomNav{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
      #tab-about > .nx-allapps-back{display:none!important}
      #tab-about > .nx-app-hero{display:none!important}

      /* Wallet / Tasks / Market belong to the Mine workspace while the approved
         bottom dock remains exactly Mine + Nova Hub. */
      #nxMineQuickNavV1{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 4px}
      #nxMineQuickNavV1 button{min-width:0;min-height:48px;padding:8px 6px;border:1px solid rgba(86,177,255,.18);border-radius:15px;background:linear-gradient(145deg,rgba(6,25,49,.96),rgba(7,48,78,.90));color:#dff3ff;font:900 10px/1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.045em;display:flex;align-items:center;justify-content:center;gap:6px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;box-shadow:inset 0 1px rgba(255,255,255,.04)}
      #nxMineQuickNavV1 button:active{transform:scale(.975)}
      #nxMineQuickNavV1 .nx-mine-quick-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:9px;background:rgba(64,166,255,.10);border:1px solid rgba(92,192,255,.12)}
      #nxMineQuickNavV1 svg{width:15px;height:15px}

      /* Wallet and Market synthetic Hub shortcuts are hidden because their
         approved access is restored under Mine. The actual tabs remain intact. */
      #moreMenu [data-nx-nova-hub-core="1"]{display:none!important}

      /* Keep header/search structure compact and stable. */
      #moreMenu .nx-nova-hub-header{margin-bottom:10px!important}
      #nxAllAppsSmartSearch{margin-top:0!important}
      @media(max-width:420px){
        #nxMineQuickNavV1{gap:6px;margin-top:10px}
        #nxMineQuickNavV1 button{min-height:44px;font-size:9px;padding:7px 4px}
        #nxMineQuickNavV1 .nx-mine-quick-icon{width:23px;height:23px}
      }
    `;
    document.head.appendChild(style);
  }

  function icon(kind) {
    const path = kind === 'wallet'
      ? '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 9h18"/><path d="M15.5 13.2h3"/>'
      : kind === 'tasks'
        ? '<path d="M7 4h10v16H7z"/><path d="m9.5 9 1.3 1.3L14 7.5M9.5 14l1.3 1.3L14 12.5"/>'
        : '<path d="M4 18V9l4 3 4-6 4 5 4-3v10"/><path d="M4 18h16"/>';
    return `<span class="nx-mine-quick-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`;
  }

  function ensureMineQuickNav() {
    const home = $('#tab-home');
    if (!home) return false;
    let nav = $('#nxMineQuickNavV1');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'nxMineQuickNavV1';
      nav.setAttribute('aria-label','Mine workspace shortcuts');
      nav.innerHTML = `
        <button type="button" data-nx-mine-target="wallet">${icon('wallet')}<span>WALLET</span></button>
        <button type="button" data-nx-mine-target="tasks">${icon('tasks')}<span>TASKS</span></button>
        <button type="button" data-nx-mine-target="market">${icon('market')}<span>MARKET</span></button>`;
      nav.addEventListener('click', event => {
        const button = event.target.closest('[data-nx-mine-target]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const target = String(button.dataset.nxMineTarget || '');
        if (!MINE_DOMAIN.has(target)) return;
        try { window.switchTab?.(target, null); }
        catch (_) { return; }
        [0,40,180].forEach(ms => setTimeout(syncDockDomain, ms));
      });
      const stats = home.querySelector('.stats-grid');
      if (stats) stats.insertAdjacentElement('afterend', nav);
      else home.appendChild(nav);
    }
    return true;
  }

  function ensureHubHeaderOrder() {
    const inner = $('#moreMenu .more-inner');
    const header = $('#nxNovaHubHeader');
    if (!inner || !header) return false;

    if (inner.firstElementChild !== header) {
      inner.insertBefore(header, inner.firstElementChild);
    }

    const search = $('#nxAllAppsSmartSearch');
    if (search && header.nextElementSibling !== search) {
      inner.insertBefore(search, header.nextElementSibling);
    }

    const copy = header.querySelector('.nx-nova-hub-copy');
    if (copy) copy.textContent = 'All apps, utilities, learning and daily tools in one place.';
    return true;
  }

  function syncSettingsRoot() {
    const settings = $('#tab-about');
    const active = Boolean(settings?.classList.contains('active'));
    document.body.classList.toggle('nx-settings-root-v1', active);
    if (active) {
      settings.querySelector(':scope > .nx-allapps-back')?.remove();
      const pager = $('#nxUxBottomNav');
      pager?.classList.remove('show','reader');
    }
  }

  function syncDockDomain() {
    const active = activeTabName();
    const menu = $('#moreMenu');
    const hubOpen = Boolean(document.body.classList.contains('nx-allapps-open') || menu?.classList.contains('show'));
    if (hubOpen || !MINE_DOMAIN.has(active)) return;

    const hub = $('#moreBtn');
    const mine = $$('.bottom-dock .dock-item').find(button =>
      button !== hub && button.dataset.nxNovaHubPrimary === '1'
    );
    if (!mine) return;
    $$('.bottom-dock .dock-item').forEach(button => button.classList.remove('active'));
    mine.classList.add('active');
  }

  function inventory() {
    const labels = $$('#moreMenu .more-item')
      .filter(button => button.dataset.nxNovaHubCore !== '1')
      .map(labelOf)
      .filter(Boolean);
    const present = new Set(labels);
    return {
      expected: EXPECTED_HUB_LABELS.slice(),
      present: labels,
      missing: EXPECTED_HUB_LABELS.filter(label => !present.has(label)),
      count: labels.length
    };
  }

  function sync() {
    queued = false;
    installStyles();
    ensureMineQuickNav();
    ensureHubHeaderOrder();
    syncSettingsRoot();
    syncDockDomain();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(sync);
  }

  function installObservers() {
    const inner = $('#moreMenu .more-inner');
    if (inner && inner.dataset.nxUiRepairObserved !== '1') {
      inner.dataset.nxUiRepairObserved = '1';
      new MutationObserver(schedule).observe(inner,{childList:true});
    }
    const main = $('main.main') || $('main');
    if (main && main.dataset.nxUiRepairObserved !== '1') {
      main.dataset.nxUiRepairObserved = '1';
      new MutationObserver(schedule).observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
    }
  }

  function boot() {
    sync();
    installObservers();
    [120,350,800,1500,3000,6000].forEach(ms => setTimeout(sync, ms));
    document.addEventListener('click', schedule, true);
    window.addEventListener('nexusnova:after-core-ready', schedule);
  }

  window.NexusNovaUiRegressionRepair = Object.freeze({version:'1.0.0',sync,inventory});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();