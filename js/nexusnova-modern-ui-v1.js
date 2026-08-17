/* NexusNova Modern UI v1
   UI-only controller for Nova Hub naming, clean launcher hierarchy and a two-tab shell.
   No mining, reward, wallet, auth, ad value or Firebase writes.
*/
(() => {
  'use strict';
  if (window.__nxModernUiV1) return;
  window.__nxModernUiV1 = true;

  const CSS_MARKER = 'data-nx-modern-ui-v1';
  const COMPAT_STYLE_ID = 'nxModernUiCompatV1';
  const HOME_AUX = new Set(['wallet','tasks','market']);
  const $ = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

  function ensureCss() {
    if (!$(`link[${CSS_MARKER}]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './css/nexusnova-modern-ui-v1.css?v=20260817-modern5';
      link.setAttribute(CSS_MARKER, '1');
      document.head.appendChild(link);
    }
    if (!document.getElementById(COMPAT_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = COMPAT_STYLE_ID;
      style.textContent = `
        /* Android/WebView fallback + legacy launcher override guard. */
        body #moreMenu #nxAllAppsSmartSearch{order:-30!important}
        #moreMenu .more-item .mi-icon{
          color:var(--mi-a,#66adff)!important;
          background:#0d1727!important;
          border-color:rgba(96,145,204,.20)!important;
        }
        #moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon{color:#62d6e5!important;background:#0b1925!important;border-color:rgba(98,214,229,.22)!important}
        #moreMenu .more-item[data-nxmega="productivity"] .mi-icon{color:#82adff!important;background:#10182a!important;border-color:rgba(130,173,255,.22)!important}
        #moreMenu .more-item > span:not(.mi-icon):not(.nx-brand-app-badge){
          margin:0!important;padding:0 2px!important;color:#c9d7e8!important;text-shadow:none!important;
          font-size:9px!important;line-height:1.15!important;font-weight:720!important;letter-spacing:0!important;
          text-transform:none!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important;
        }

        /* Two-tab shell: Mining + Nova Hub only. */
        body.nx-two-tab-shell .bottom-dock{left:18px!important;right:18px!important;bottom:12px!important;padding:5px!important;border-radius:22px!important}
        body.nx-two-tab-shell .bottom-dock .dock-inner.nx-two-tab-dock{
          width:min(100%,390px)!important;max-width:390px!important;margin:0 auto!important;
          display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;
        }
        body.nx-two-tab-shell .bottom-dock .dock-item[data-nx-dock-hidden="1"]{display:none!important}
        body.nx-two-tab-shell .bottom-dock .nx-two-tab-dock>.dock-item{
          min-height:52px!important;padding:7px 12px!important;display:flex!important;flex-direction:row!important;
          align-items:center!important;justify-content:center!important;gap:8px!important;border-radius:16px!important;
          color:#8297ae!important;background:transparent!important;box-shadow:none!important;
        }
        body.nx-two-tab-shell .bottom-dock .nx-two-tab-dock>.dock-item .mi-icon{
          width:27px!important;height:27px!important;flex:0 0 27px!important;margin:0!important;border-radius:9px!important;
          background:transparent!important;border:0!important;color:currentColor!important;box-shadow:none!important;
        }
        body.nx-two-tab-shell .bottom-dock .nx-two-tab-dock>.dock-item .mi-icon svg{width:20px!important;height:20px!important}
        body.nx-two-tab-shell .bottom-dock .nx-two-tab-dock>.dock-item>span:last-child{
          font-size:10px!important;font-weight:800!important;letter-spacing:.01em!important;text-transform:none!important;color:currentColor!important;
        }
        body.nx-two-tab-shell .bottom-dock .nx-two-tab-dock>.dock-item.active{
          color:#eef7ff!important;background:linear-gradient(145deg,rgba(32,111,211,.22),rgba(44,145,238,.13))!important;
          box-shadow:inset 0 0 0 1px rgba(84,159,247,.20)!important;
        }
        body.nx-two-tab-shell .bottom-dock .nx-two-tab-dock>.dock-item.active .mi-icon{
          color:#fff!important;background:linear-gradient(145deg,#287fdf,#55adf6)!important;
          box-shadow:0 5px 14px rgba(36,123,222,.22)!important;
        }

        /* Mining home core access: Wallet, Rewards and Market live here now. */
        #nxHomeCoreAccess{margin:14px 0 3px;padding:0}
        #nxHomeCoreAccess .nx-core-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 2px 8px}
        #nxHomeCoreAccess .nx-core-head strong{color:#dfeaff;font-size:11px;font-weight:850;letter-spacing:.025em}
        #nxHomeCoreAccess .nx-core-head span{color:#60758c;font-size:8px;font-weight:700}
        #nxHomeCoreAccess .nx-core-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
        #nxHomeCoreAccess .nx-core-card{
          min-width:0;min-height:70px;margin:0!important;padding:9px 6px!important;border-radius:15px!important;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px!important;
          background:linear-gradient(180deg,rgba(17,29,47,.78),rgba(8,15,27,.88))!important;
          border:1px solid rgba(119,158,207,.13)!important;color:#cbd9e8!important;box-shadow:inset 0 1px rgba(255,255,255,.025)!important;
        }
        #nxHomeCoreAccess .nx-core-card:active{transform:scale(.97)!important;background:#101c2d!important}
        #nxHomeCoreAccess .nx-core-icon{width:31px;height:31px;display:grid;place-items:center;border-radius:10px;background:#0e1b2c;border:1px solid rgba(93,151,218,.18);color:#6bb2ff}
        #nxHomeCoreAccess .nx-core-card[data-nx-core-target="tasks"] .nx-core-icon{color:#65d4b9}
        #nxHomeCoreAccess .nx-core-card[data-nx-core-target="market"] .nx-core-icon{color:#b293ff}
        #nxHomeCoreAccess .nx-core-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        #nxHomeCoreAccess .nx-core-card b{max-width:100%;font-size:9.5px;line-height:1.05;font-weight:820;color:#e4edf7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #nxHomeCoreAccess .nx-core-card small{font-size:7px;line-height:1;color:#62788f;font-weight:700;white-space:nowrap}
        @media(max-width:360px){
          body.nx-two-tab-shell .bottom-dock{left:10px!important;right:10px!important}
          #nxHomeCoreAccess .nx-core-grid{gap:5px}
          #nxHomeCoreAccess .nx-core-card{min-height:66px;padding-left:3px!important;padding-right:3px!important}
          #nxHomeCoreAccess .nx-core-card b{font-size:8.7px}
          #nxHomeCoreAccess .nx-core-card small{font-size:6.5px}
        }
      `;
      document.head.appendChild(style);
    }
  }

  function targetOf(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return String(button.dataset.nxmega);
    if (button.dataset?.nxSpeedtestV4 === '1' || button.hasAttribute('data-nx-speedtest-v4')) return 'speed-test';
    const match = String(button.getAttribute('onclick') || '').match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?.[1] || '';
  }

  function labelNode(button) {
    return qsa(':scope > span', button)
      .filter(node => !node.classList.contains('mi-icon') && !node.classList.contains('nx-brand-app-badge'))
      .pop() || null;
  }

  function setText(node, value) {
    if (node && String(node.textContent || '').trim() !== value) node.textContent = value;
  }

  function activeTabName() {
    return String($('main.main > .tab.active,main > .tab.active,.tab.active')?.id || '').replace(/^tab-/,'') || 'home';
  }

  function renameHubLanguage() {
    const moreBtn = $('#moreBtn');
    const label = moreBtn ? labelNode(moreBtn) : null;
    setText(label,'Nova Hub');
    if (moreBtn) {
      if (moreBtn.getAttribute('aria-label') !== 'Open Nova Hub') moreBtn.setAttribute('aria-label','Open Nova Hub');
      if (moreBtn.title !== 'Nova Hub') moreBtn.title = 'Nova Hub';
    }

    qsa('[aria-label*="ALL APPS" i],[title*="ALL APPS" i]').forEach(node => {
      if (node.hasAttribute('aria-label')) node.setAttribute('aria-label',node.getAttribute('aria-label').replace(/ALL APPS/gi,'Nova Hub'));
      if (node.hasAttribute('title')) node.setAttribute('title',node.getAttribute('title').replace(/ALL APPS/gi,'Nova Hub'));
    });

    qsa('#nxUxBackHint').forEach(node => { if (/all apps/i.test(node.textContent || '')) setText(node,'NOVA HUB'); });
  }

  function ensureHeader() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return null;
    let header = $('#nxNovaHubHeader',inner);
    if (!header) {
      header = document.createElement('div');
      header.id = 'nxNovaHubHeader';
      header.innerHTML = `
        <div class="nxm-hub-title">
          <span class="nxm-hub-mark" aria-hidden="true">N</span>
          <div><strong>Nova Hub</strong><small>Daily tools, knowledge and utilities in one place</small></div>
        </div>
        <button id="nxNovaHubClose" type="button" aria-label="Close Nova Hub">×</button>`;
      inner.prepend(header);
      $('#nxNovaHubClose',header)?.addEventListener('click',() => {
        try { $('#moreBtn')?.click(); } catch (_) { $('#moreMenu')?.classList.remove('show'); }
      });
    }
    return header;
  }

  function ensureSectionLabel() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return;
    let node = $('#nxNovaHubSection',inner);
    if (!node) {
      node = document.createElement('div');
      node.id = 'nxNovaHubSection';
      node.innerHTML = '<b>Apps & tools</b><span>Tap an icon to open</span>';
      const search = $('#nxAllAppsSmartSearch',inner);
      if (search?.nextSibling) inner.insertBefore(node,search.nextSibling);
      else inner.appendChild(node);
    }
  }

  const LABELS = Object.freeze({
    'tools':'Tools','speed-test':'Speed Test','productivity':'Nova Desk','ai':'AI Assistant','browser':'Browser',
    'finance':'Gold & FX','news':'News','chat':'Chat','location':'Location','emergency':'SOS','family':'Family',
    'profile':'Profile','tasks':'Rewards','money':'Budget','learn':'Learn','travel':'Travel','health':'Health',
    'smart':'Smart Tools','qibla':'Qibla','entertainment':'Entertainment','caller-id':'Caller ID','about':'Settings'
  });

  const PRIORITY = [
    'tools','speed-test','productivity','ai','browser','finance','news','money','learn','travel','health','smart',
    'location','qibla','chat','family','emergency','entertainment','caller-id','profile','tasks','about'
  ];

  function normalizeTiles() {
    const inner = $('#moreMenu .more-inner');
    if (!inner) return;
    const seen = new Set();
    qsa('.more-item',inner).forEach((tile,index) => {
      const target = targetOf(tile);
      if (target && tile.dataset.nxHubTarget !== target) tile.dataset.nxHubTarget = target;
      const label = labelNode(tile);
      if (label && LABELS[target]) setText(label,LABELS[target]);
      const priority = PRIORITY.indexOf(target);
      const order = String(priority >= 0 ? priority : 80 + index);
      if (tile.style.getPropertyValue('order') !== order || tile.style.getPropertyPriority('order') !== 'important') {
        tile.style.setProperty('order',order,'important');
      }
      if (target) {
        const key = `${target}:${String(label?.textContent || '').trim().toLowerCase()}`;
        if (seen.has(key)) {
          if (!tile.hidden) tile.hidden = true;
          if (tile.getAttribute('aria-hidden') !== 'true') tile.setAttribute('aria-hidden','true');
        } else {
          seen.add(key);
          if (tile.hidden && tile.getAttribute('aria-hidden') === 'true') {
            tile.hidden = false;
            tile.removeAttribute('aria-hidden');
          }
        }
      }
    });
  }

  function promoteNovaDesk() {
    const tile = $('#moreMenu .more-item[data-nxmega="productivity"]');
    if (tile) {
      setText(labelNode(tile),'Nova Desk');
      if (tile.getAttribute('aria-label') !== 'Open Nova Desk') tile.setAttribute('aria-label','Open Nova Desk');
    }
    const tab = $('#tab-productivity');
    if (!tab) return;
    setText($('.nxpd-hero h2',tab),'Nova Desk');
    const kicker = $('.nxpd-kicker',tab);
    if (kicker && !/NOVA DESK/i.test(kicker.textContent || '')) setText(kicker,'NEXUSNOVA • NOVA DESK');
    const copy = $('.nxpd-hero p',tab);
    if (copy && !/text, dates and quick office tasks/i.test(copy.textContent || '')) {
      setText(copy,'Private text, dates and quick office tasks — saved locally on your device.');
    }
  }

  function polishSearchCopy() {
    const panel = $('#nxAllAppsSmartSearch');
    if (!panel) return;
    const input = $('[data-smart-input]',panel);
    if (input && input.placeholder !== 'Search Nova Hub…') input.placeholder = 'Search Nova Hub…';
    const status = $('[data-smart-status]',panel);
    if (status && /Type what you need/i.test(status.textContent || '')) setText(status,'Find any NexusNova tool instantly.');
  }

  function dockButtonFor(target) {
    return qsa('.bottom-dock .dock-item').find(button => {
      const action = String(button.getAttribute('onclick') || '');
      return new RegExp(`switchTab\\(\\s*['"]${target}['"]`).test(action);
    }) || null;
  }

  function openCoreTarget(target) {
    if (!HOME_AUX.has(target)) return false;
    $('#moreMenu')?.classList.remove('show');
    const legacy = dockButtonFor(target);
    if (legacy) {
      try { legacy.click(); setTimeout(reflectDockState,0); return true; } catch (_) {}
    }
    try {
      if (typeof window.openMoreTab === 'function') {
        window.openMoreTab(target);
        setTimeout(reflectDockState,0);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function ensureTwoTabDock() {
    const dock = $('.bottom-dock .dock-inner');
    if (!dock) return;
    if (!dock.classList.contains('nx-two-tab-dock')) dock.classList.add('nx-two-tab-dock');
    document.body?.classList.add('nx-two-tab-shell');

    const home = dockButtonFor('home');
    const more = $('#moreBtn');
    if (home) {
      setText(labelNode(home),'Mining');
      home.dataset.nxDockPrimary = 'mining';
      home.hidden = false;
      home.removeAttribute('aria-hidden');
      home.tabIndex = 0;
    }
    if (more) {
      setText(labelNode(more),'Nova Hub');
      more.dataset.nxDockPrimary = 'hub';
      more.hidden = false;
      more.removeAttribute('aria-hidden');
      more.tabIndex = 0;
    }

    ['wallet','tasks','market'].forEach(target => {
      const button = dockButtonFor(target);
      if (!button) return;
      button.dataset.nxDockHidden = '1';
      button.hidden = true;
      button.setAttribute('aria-hidden','true');
      button.tabIndex = -1;
      button.classList.remove('active');
    });
  }

  function ensureCoreAccess() {
    const home = $('#tab-home');
    if (!home || $('#nxHomeCoreAccess',home)) return;
    const panel = document.createElement('div');
    panel.id = 'nxHomeCoreAccess';
    panel.setAttribute('aria-label','NexusNova core access');
    panel.innerHTML = `
      <div class="nx-core-head"><strong>Quick access</strong><span>Your essentials</span></div>
      <div class="nx-core-grid">
        <button type="button" class="nx-core-card" data-nx-core-target="wallet" aria-label="Open Wallet">
          <span class="nx-core-icon"><svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10h17M15.5 14h2"/></svg></span><b>Wallet</b><small>Assets</small>
        </button>
        <button type="button" class="nx-core-card" data-nx-core-target="tasks" aria-label="Open Rewards">
          <span class="nx-core-icon"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8v12M4 12h16M8 8c0-2 1.4-3 3-3 1.2 0 1.8.5 2.5 1.7C14.2 5.5 15 5 16.2 5 18 5 19 6.2 19 8"/></svg></span><b>Rewards</b><small>Daily NVX</small>
        </button>
        <button type="button" class="nx-core-card" data-nx-core-target="market" aria-label="Open Market">
          <span class="nx-core-icon"><svg viewBox="0 0 24 24"><path d="M4 18V9l4 4 4-7 4 5 4-3v10z"/></svg></span><b>Market</b><small>Live prices</small>
        </button>
      </div>`;
    qsa('[data-nx-core-target]',panel).forEach(button => {
      button.addEventListener('click',() => openCoreTarget(button.dataset.nxCoreTarget));
    });
    const stats = $('.stats-grid',home);
    if (stats?.nextSibling) home.insertBefore(panel,stats.nextSibling);
    else home.appendChild(panel);
  }

  function reflectDockState() {
    const dock = $('.bottom-dock .dock-inner');
    if (!dock) return;
    const home = dockButtonFor('home');
    const more = $('#moreBtn');
    const tabName = activeTabName();
    const hubOpen = $('#moreMenu')?.classList.contains('show');
    const homeFamily = tabName === 'home' || HOME_AUX.has(tabName);
    const hubFamily = !homeFamily;
    if (home) home.classList.toggle('active',homeFamily && !hubOpen);
    if (more) more.classList.toggle('active',Boolean(hubOpen || hubFamily));
  }

  function apply() {
    ensureCss();
    document.body?.classList.add('nx-modern-ui-ready');
    renameHubLanguage();
    ensureHeader();
    ensureSectionLabel();
    promoteNovaDesk();
    normalizeTiles();
    polishSearchCopy();
    ensureTwoTabDock();
    ensureCoreAccess();
    reflectDockState();
    try { window.NexusNovaUxSimplify?.refresh?.(); } catch (_) {}
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();

  const observer = new MutationObserver(queue);
  const start = () => document.body && observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
  if (document.body) start(); else document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('click',() => setTimeout(reflectDockState,0),true);
  [200,600,1200,2400,5000].forEach(ms => setTimeout(apply,ms));

  window.NexusNovaModernUI = Object.freeze({version:'1.1.0',refresh:apply,openCore:openCoreTarget});
})();
