/* NexusNova Nova Hub Navigation v2
   Focused UI owner for the approved Mine + Nova Hub shell.
   - Keeps mining/session logic untouched.
   - Moves Wallet / Tasks / Market launchers under the Mine screen as UI-only quick access.
   - Removes Nova Hub intro/search/core duplicates and generic ALL APPS back clutter.
   - Keeps the existing smooth-scroll owner untouched.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubNavV2) return;
  window.__nxNovaHubNavV1 = true;
  window.__nxNovaHubNavV2 = true;
  window.nexusNovaHubNavVersion = 'nova-hub-nav-v2';

  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const MINE_CHILDREN = new Set(['home','wallet','tasks','market']);
  const HUB_REMOVED_TARGETS = new Set(['wallet','tasks','market']);

  const HUB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8Z"/><path d="M8.2 15.8V8.2l7.6 7.6V8.2"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/></svg>`;
  const MINE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.6 2.8 6.9 13h4.4l-.9 8.2L17.1 11h-4.4l.9-8.2Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9" opacity=".32"/></svg>`;
  const WALLET_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 9h18"/><path d="M15.5 13.2h3"/></svg>`;
  const TASKS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>`;
  const MARKET_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18V9l4 3.2 4-6.1 4 5 4-2.6V18"/><path d="M4 18h16"/></svg>`;
  const TROPHY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v5M8 20h8M10 17h4"/></svg>`;
  const GROWTH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18 10 12l4 3 6-8"/><path d="M15 7h5v5"/><path d="M4 6v12h16"/></svg>`;

  const LATE_PALETTE = [
    ['#8b5cf6','#5b21b6'],['#f97316','#c2410c'],['#14b8a6','#0f766e'],['#ec4899','#be185d'],
    ['#22c55e','#15803d'],['#eab308','#a16207'],['#06b6d4','#0e7490'],['#6366f1','#4338ca'],
    ['#ef4444','#b91c1c'],['#84cc16','#4d7c0f'],['#d946ef','#a21caf'],['#0ea5e9','#0369a1']
  ];

  function installStyles() {
    if ($('nxNovaHubNavV2Style')) return;
    const style = document.createElement('style');
    style.id = 'nxNovaHubNavV2Style';
    style.textContent = `
      body.nx-nova-hub-nav .bottom-dock{max-width:560px!important;margin:0 auto!important}
      body.nx-nova-hub-nav .bottom-dock .dock-inner{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:9px!important;align-items:stretch!important;padding:7px!important;height:auto!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-hidden="1"]{display:none!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"]{display:flex!important;min-width:0!important;width:auto!important;height:62px!important;min-height:62px!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:10px!important;padding:8px 14px!important;border-radius:18px!important;border:1px solid rgba(96,174,255,.14)!important;background:linear-gradient(145deg,rgba(5,18,37,.96),rgba(7,34,64,.94))!important;color:#9fc8ee!important;box-shadow:inset 0 1px rgba(255,255,255,.04),0 8px 20px rgba(0,0,0,.16)!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"].active{border-color:rgba(80,190,255,.48)!important;color:#f4fbff!important;background:radial-gradient(circle at 85% 0%,rgba(51,190,255,.24),transparent 42%),linear-gradient(145deg,rgba(7,42,80,.98),rgba(10,87,131,.95))!important;box-shadow:0 10px 28px rgba(0,111,199,.24),inset 0 1px rgba(255,255,255,.10)!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon{width:29px!important;height:29px!important;display:grid!important;place-items:center!important;margin:0!important;border-radius:10px!important;background:rgba(62,166,255,.10)!important;border:1px solid rgba(92,192,255,.13)!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon svg{width:19px!important;height:19px!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .nx-nova-dock-label{margin:0!important;font-size:11px!important;font-weight:950!important;letter-spacing:.09em!important;line-height:1!important;white-space:nowrap!important}

      /* Mine child launchers are presentation only; the existing Wallet/Tasks/Market tabs and handlers stay authoritative. */
      #tab-home #nxMineCoreAccess{margin-top:14px;padding:12px;border:1px solid rgba(76,157,255,.17);border-radius:18px;background:linear-gradient(145deg,rgba(7,22,42,.94),rgba(4,13,27,.96));box-shadow:0 8px 22px rgba(0,0,0,.18)}
      #tab-home #nxMineCoreAccess .nx-mine-core-kicker{margin:0 0 9px;font-size:9px;font-weight:900;letter-spacing:.16em;color:#79bfff;text-transform:uppercase}
      #tab-home #nxMineCoreAccess .nx-mine-core-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      #tab-home #nxMineCoreAccess .nx-mine-core-btn{min-width:0;min-height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px 4px;border-radius:15px;border:1px solid rgba(255,255,255,.08);background:rgba(12,28,49,.92);color:#f7fbff;box-shadow:0 3px 10px rgba(0,0,0,.18);touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      #tab-home #nxMineCoreAccess .nx-mine-core-btn:active{transform:scale(.985)}
      #tab-home #nxMineCoreAccess .nx-mine-core-icon{width:39px;height:39px;display:grid;place-items:center;border-radius:12px;color:#fff;border:1px solid rgba(255,255,255,.20);box-shadow:inset 0 1px 0 rgba(255,255,255,.17)}
      #tab-home #nxMineCoreAccess .nx-mine-core-icon svg{width:21px;height:21px}
      #tab-home #nxMineCoreAccess [data-nx-mine-open="wallet"] .nx-mine-core-icon{background:linear-gradient(145deg,#18a8ff,#1265d7)}
      #tab-home #nxMineCoreAccess [data-nx-mine-open="tasks"] .nx-mine-core-icon{background:linear-gradient(145deg,#17c997,#087f6b)}
      #tab-home #nxMineCoreAccess [data-nx-mine-open="market"] .nx-mine-core-icon{background:linear-gradient(145deg,#8b5cf6,#5332c7)}
      #tab-home #nxMineCoreAccess .nx-mine-core-label{font-size:10px;font-weight:850;line-height:1;color:#f5f9ff}

      /* Search/intro/core duplicates are retired from Nova Hub. */
      #nxAllAppsSmartSearch,#nxNovaHubHeader,#moreMenu .more-item[data-nx-nova-hub-core="1"]{display:none!important}

      /* Generic ALL APPS / Nova Hub back bars are removed from app screens.
         Book/readers retain their own dedicated reader navigation. */
      main .tab:not(#tab-bible):not([id*="urdu"][id*="library"]) > .nx-allapps-back{display:none!important}
      #tab-tools .tools-main-back{display:none!important}
      [data-nx-hub-legacy-nav="1"]{display:none!important}

      @media(max-width:700px){body.nx-nova-hub-nav{padding-bottom:calc(144px + env(safe-area-inset-bottom))!important}body.nx-nova-hub-nav .main{padding-bottom:calc(144px + env(safe-area-inset-bottom))!important}body.nx-nova-hub-nav .bottom-dock .dock-inner{height:auto!important;padding:6px!important;gap:7px!important}body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"]{height:60px!important;min-height:60px!important;padding:7px 10px!important;flex-direction:row!important}body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .nx-nova-dock-label{font-size:10px!important}}
      @media(max-width:360px){body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"]{gap:7px!important;padding-inline:7px!important}body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon{width:27px!important;height:27px!important}body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .nx-nova-dock-label{font-size:9px!important;letter-spacing:.06em!important}}
    `;
    document.head.appendChild(style);
  }

  function dockTarget(button) {
    if (!button) return '';
    if (button.id === 'moreBtn') return 'hub';
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/switchTab\(\s*['"]([^'"]+)['"]/)?.[1] || '';
  }

  function moreTarget(button) {
    if (!button) return '';
    if (button.dataset?.nxNovaHubTarget) return String(button.dataset.nxNovaHubTarget);
    if (button.dataset?.nxmega) return String(button.dataset.nxmega);
    if (button.dataset?.finalBible) return 'bible';
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/)?.[1] || '';
  }

  function labelOf(button) {
    if (!button) return '';
    const spans = button.querySelectorAll(':scope > span');
    const value = spans.length ? spans[spans.length - 1].textContent : button.textContent;
    return String(value || '').replace(/\s+/g,' ').trim().toUpperCase();
  }

  function setDockLabel(button, label) {
    if (!button) return;
    let node = button.querySelector('.nx-nova-dock-label');
    if (!node) {
      const candidates = Array.from(button.children).filter(child => !child.classList.contains('mi-icon'));
      node = candidates[candidates.length - 1] || document.createElement('span');
      node.classList.add('nx-nova-dock-label');
      if (!node.parentNode) button.appendChild(node);
    }
    if (node.textContent !== label) node.textContent = label;
  }

  function setDockIcon(button, svg) {
    const icon = button?.querySelector('.mi-icon');
    if (!icon) return;
    if (icon.dataset.nxNovaHubIcon !== '2') {
      icon.innerHTML = svg;
      icon.dataset.nxNovaHubIcon = '2';
    }
  }

  function configureDock() {
    const dock = document.querySelector('.bottom-dock');
    const items = $$('.bottom-dock .dock-item');
    if (!dock || !items.length) return false;
    document.body.classList.add('nx-nova-hub-nav');
    let mine = null;
    items.forEach(button => {
      const target = dockTarget(button);
      if (target === 'home') mine = button;
      const primary = target === 'home' || button.id === 'moreBtn';
      button.dataset.nxNovaHubPrimary = primary ? '1' : '0';
      button.dataset.nxNovaHubHidden = primary ? '0' : '1';
      if (!primary) button.setAttribute('aria-hidden','true'); else button.removeAttribute('aria-hidden');
    });
    const hub = $('moreBtn');
    if (mine) {
      setDockLabel(mine,'MINE');
      setDockIcon(mine,MINE_ICON);
      mine.setAttribute('aria-label','Open Mine');
    }
    if (hub) {
      setDockLabel(hub,'NOVA HUB');
      setDockIcon(hub,HUB_ICON);
      hub.setAttribute('aria-label','Open Nova Hub');
      hub.title='Nova Hub';
    }
    return true;
  }

  function ensureMineCoreAccess() {
    const home = $('tab-home');
    if (!home) return false;
    let panel = $('nxMineCoreAccess');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'nxMineCoreAccess';
      panel.setAttribute('aria-label','Mine quick access');
      panel.innerHTML = `
        <div class="nx-mine-core-kicker">QUICK ACCESS</div>
        <div class="nx-mine-core-grid">
          <button class="nx-mine-core-btn" type="button" data-nx-mine-open="wallet"><span class="nx-mine-core-icon">${WALLET_ICON}</span><span class="nx-mine-core-label">Wallet</span></button>
          <button class="nx-mine-core-btn" type="button" data-nx-mine-open="tasks"><span class="nx-mine-core-icon">${TASKS_ICON}</span><span class="nx-mine-core-label">Tasks</span></button>
          <button class="nx-mine-core-btn" type="button" data-nx-mine-open="market"><span class="nx-mine-core-icon">${MARKET_ICON}</span><span class="nx-mine-core-label">Market</span></button>
        </div>`;
      const stats = home.querySelector('.stats-grid');
      if (stats) stats.insertAdjacentElement('afterend',panel); else home.appendChild(panel);
      panel.addEventListener('click',event => {
        const button = event.target.closest('[data-nx-mine-open]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const target = String(button.dataset.nxMineOpen || '');
        if (!MINE_CHILDREN.has(target) || target === 'home') return;
        window.switchTab?.(target,null);
        queueRefresh();
        requestAnimationFrame(() => window.scrollTo({top:0,left:0,behavior:'auto'}));
      });
    }
    return true;
  }

  function normalizeSpecialIcons() {
    $$('#moreMenu .more-item').forEach(button => {
      const label = labelOf(button);
      if (label !== 'LEADERBOARD' && label !== 'GROWTH') return;
      const svg = label === 'LEADERBOARD' ? TROPHY_ICON : GROWTH_ICON;
      const display = label === 'LEADERBOARD' ? 'Leaderboard' : 'Growth';
      if (button.dataset.nxNovaHubIconNormalized === '1') return;
      button.innerHTML = `<span class="mi-icon">${svg}</span><span>${display}</span>`;
      button.dataset.nxNovaHubIconNormalized = '1';
    });
  }

  function colorizeRemainingIcons() {
    const buttons = $$('#moreMenu .more-item');
    buttons.forEach((button,index) => {
      if (index < 21) {
        if (button.dataset.nxNovaHubLatePalette === '1') {
          button.style.removeProperty('--mi-a');
          button.style.removeProperty('--mi-b');
          button.dataset.nxNovaHubLatePalette = '0';
        }
        return;
      }
      const pair = LATE_PALETTE[(index - 21) % LATE_PALETTE.length];
      button.style.setProperty('--mi-a',pair[0]);
      button.style.setProperty('--mi-b',pair[1]);
      button.dataset.nxNovaHubLatePalette = '1';
    });
  }

  function configureHub() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner) return false;

    $('nxNovaHubHeader')?.remove();
    $('nxAllAppsSmartSearch')?.remove();

    $$('#moreMenu .more-item').forEach(button => {
      const target = moreTarget(button);
      if (HUB_REMOVED_TARGETS.has(target)) button.remove();
    });

    normalizeSpecialIcons();
    colorizeRemainingIcons();
    return true;
  }

  function pruneLegacyNavigation() {
    const generic = /(?:^|\s)(?:PREVIOUS|NEXT)(?:\s|$)|BACK\s+(?:TO\s+)?(?:ALL\s+APPS|NOVA\s+HUB)/i;
    $$('main .tab').forEach(tab => {
      const id = String(tab.id || '').toLowerCase();
      const bookException = id === 'tab-bible' || (id.includes('urdu') && id.includes('library'));
      if (bookException) return;

      tab.querySelectorAll(':scope > .nx-allapps-back').forEach(node => node.dataset.nxHubLegacyNav='1');
      tab.querySelectorAll('.tools-main-back').forEach(node => {
        if (/ALL\s+APPS|NOVA\s+HUB/i.test(String(node.textContent || ''))) node.dataset.nxHubLegacyNav='1';
      });

      const matches = Array.from(tab.querySelectorAll('button')).filter(button => generic.test(String(button.textContent || '').replace(/\s+/g,' ').trim()));
      matches.forEach(button => {
        const text = String(button.textContent || '').replace(/\s+/g,' ').trim();
        if (/BACK\s+(?:TO\s+)?(?:ALL\s+APPS|NOVA\s+HUB)/i.test(text)) {
          (button.closest('.nx-allapps-back') || button).dataset.nxHubLegacyNav='1';
          return;
        }
        let parent = button.parentElement;
        while (parent && parent !== tab) {
          const navCount = Array.from(parent.querySelectorAll('button')).filter(candidate => generic.test(String(candidate.textContent || '').replace(/\s+/g,' ').trim())).length;
          if (navCount >= 2 && !parent.querySelector('input,select,textarea')) {
            parent.dataset.nxHubLegacyNav='1';
            break;
          }
          parent = parent.parentElement;
        }
      });
    });
  }

  function syncActiveDock() {
    const items = $$('.bottom-dock .dock-item');
    if (!items.length) return;
    items.forEach(button => button.classList.remove('active'));
    const activeName = document.querySelector('main.main>.tab.active,main>.tab.active')?.id?.replace(/^tab-/,'') || 'home';
    const menuOpen = document.body.classList.contains('nx-allapps-open') || $('moreMenu')?.classList.contains('show');
    const mine = items.find(button => dockTarget(button) === 'home');
    const hub = $('moreBtn');
    if (!menuOpen && MINE_CHILDREN.has(activeName)) mine?.classList.add('active'); else hub?.classList.add('active');
  }

  function refresh() {
    installStyles();
    configureDock();
    ensureMineCoreAccess();
    configureHub();
    pruneLegacyNavigation();
    syncActiveDock();
  }

  let refreshQueued = false;
  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      refresh();
    },0);
  }

  function wrapNavigation() {
    const switchTab = window.switchTab;
    if (typeof switchTab === 'function' && !switchTab.__nxNovaHubNavV2) {
      const wrapped = function(name,button) {
        const result = switchTab.call(this,name,button);
        queueRefresh();
        setTimeout(syncActiveDock,30);
        return result;
      };
      wrapped.__nxNovaHubNavV2 = true;
      wrapped.__nxNovaHubPrior = switchTab;
      window.switchTab = wrapped;
    }

    const openMoreTab = window.openMoreTab;
    if (typeof openMoreTab === 'function' && !openMoreTab.__nxNovaHubNavV2) {
      const wrapped = function(name) {
        const result = openMoreTab.call(this,name);
        queueRefresh();
        setTimeout(pruneLegacyNavigation,30);
        return result;
      };
      wrapped.__nxNovaHubNavV2 = true;
      wrapped.__nxNovaHubPrior = openMoreTab;
      window.openMoreTab = wrapped;
    }

    const toggleMore = window.toggleMore;
    if (typeof toggleMore === 'function' && !toggleMore.__nxNovaHubNavV2) {
      const wrapped = function(...args) {
        const result = toggleMore.apply(this,args);
        queueRefresh();
        return result;
      };
      wrapped.__nxNovaHubNavV2 = true;
      wrapped.__nxNovaHubPrior = toggleMore;
      window.toggleMore = wrapped;
    }
  }

  function installMenuObserver() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner || inner.__nxNovaHubV2Observer) return;
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        configureHub();
      });
    });
    observer.observe(inner,{childList:true});
    inner.__nxNovaHubV2Observer = observer;
  }

  function boot() {
    refresh();
    wrapNavigation();
    installMenuObserver();
    document.addEventListener('click',event => {
      if (event.target?.closest?.('.bottom-dock,#moreMenu,[data-nx-mine-open]')) queueRefresh();
    },true);
    window.addEventListener('pageshow',queueRefresh);
    window.addEventListener('nexusaccountready',queueRefresh);
    [180,650,1600,3200,6000,10000].forEach(ms => setTimeout(() => {
      wrapNavigation();
      refresh();
      installMenuObserver();
    },ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
