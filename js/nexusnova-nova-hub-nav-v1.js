/* NexusNova Nova Hub Navigation v1.1
   Compact two-destination dock: Mine + Nova Hub.
   Wallet / Tasks / Market belong to the Mine workspace; Nova Hub owns the app grid.
   No mining, rewards, auth, ads or native code is changed.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubNavV1) return;
  window.__nxNovaHubNavV1 = true;
  window.nexusNovaHubNavVersion = 'nova-hub-nav-v1.1';

  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const MINE_DOMAIN = new Set(['home','wallet','tasks','market']);

  const HUB_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8Z"/>
      <path d="M8.2 15.8V8.2l7.6 7.6V8.2"/>
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/>
    </svg>`;

  const MINE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M13.6 2.8 6.9 13h4.4l-.9 8.2L17.1 11h-4.4l.9-8.2Z" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="9" opacity=".32"/>
    </svg>`;

  function installStyles() {
    if ($('nxNovaHubNavV1Style')) return;
    const style = document.createElement('style');
    style.id = 'nxNovaHubNavV1Style';
    style.textContent = `
      body.nx-nova-hub-nav .bottom-dock{max-width:560px!important;margin:0 auto!important}
      body.nx-nova-hub-nav .bottom-dock .dock-inner{
        display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
        gap:9px!important;align-items:stretch!important;padding:7px!important;height:auto!important
      }
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-hidden="1"]{display:none!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"]{
        display:flex!important;min-width:0!important;width:auto!important;height:62px!important;min-height:62px!important;
        flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:10px!important;
        padding:8px 14px!important;border-radius:18px!important;border:1px solid rgba(96,174,255,.14)!important;
        background:linear-gradient(145deg,rgba(5,18,37,.96),rgba(7,34,64,.94))!important;
        color:#9fc8ee!important;box-shadow:inset 0 1px rgba(255,255,255,.04),0 8px 20px rgba(0,0,0,.16)!important
      }
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"].active{
        border-color:rgba(80,190,255,.48)!important;color:#f4fbff!important;
        background:radial-gradient(circle at 85% 0%,rgba(51,190,255,.24),transparent 42%),linear-gradient(145deg,rgba(7,42,80,.98),rgba(10,87,131,.95))!important;
        box-shadow:0 10px 28px rgba(0,111,199,.24),inset 0 1px rgba(255,255,255,.10)!important
      }
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon{
        width:29px!important;height:29px!important;display:grid!important;place-items:center!important;margin:0!important;
        border-radius:10px!important;background:rgba(62,166,255,.10)!important;border:1px solid rgba(92,192,255,.13)!important
      }
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon svg{width:19px!important;height:19px!important}
      body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .nx-nova-dock-label{
        margin:0!important;font-size:11px!important;font-weight:950!important;letter-spacing:.09em!important;line-height:1!important;white-space:nowrap!important
      }
      #moreMenu .nx-nova-hub-header{
        grid-column:1/-1;position:relative;overflow:hidden;margin:0 0 10px;padding:16px 17px;border-radius:21px;
        border:1px solid rgba(79,178,255,.22);background:radial-gradient(circle at 92% 4%,rgba(48,190,255,.22),transparent 39%),linear-gradient(145deg,rgba(7,28,55,.98),rgba(4,14,30,.98));
        box-shadow:0 15px 34px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.05)
      }
      #moreMenu .nx-nova-hub-header-top{display:flex;align-items:center;gap:11px}
      #moreMenu .nx-nova-hub-mark{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;border-radius:14px;color:#eafdff;background:linear-gradient(145deg,#147dff,#28b9ef);box-shadow:0 10px 24px rgba(10,122,255,.28)}
      #moreMenu .nx-nova-hub-mark svg{width:25px;height:25px}
      #moreMenu .nx-nova-hub-kicker{font-size:9px;font-weight:950;letter-spacing:.19em;color:#61c8ff}
      #moreMenu .nx-nova-hub-title{margin-top:2px;font-size:18px;font-weight:950;color:#f4fbff;letter-spacing:-.02em}
      #moreMenu .nx-nova-hub-copy{margin-top:8px;font-size:10px;line-height:1.5;color:#829db8}
      @media(max-width:700px){
        body.nx-nova-hub-nav{padding-bottom:calc(144px + env(safe-area-inset-bottom))!important}
        body.nx-nova-hub-nav .main{padding-bottom:calc(144px + env(safe-area-inset-bottom))!important}
        body.nx-nova-hub-nav .bottom-dock .dock-inner{height:auto!important;padding:6px!important;gap:7px!important}
        body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"]{height:60px!important;min-height:60px!important;padding:7px 10px!important;flex-direction:row!important}
        body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .nx-nova-dock-label{font-size:10px!important}
      }
      @media(max-width:360px){
        body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"]{gap:7px!important;padding-inline:7px!important}
        body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon{width:27px!important;height:27px!important}
        body.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .nx-nova-dock-label{font-size:9px!important;letter-spacing:.06em!important}
      }
    `;
    document.head.appendChild(style);
  }

  function buttonTarget(button) {
    if (!button) return '';
    if (button.id === 'moreBtn') return 'hub';
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/switchTab\(\s*['"]([^'"]+)['"]/)?.[1] || '';
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
    if (icon && icon.dataset.nxNovaHubIcon !== '1') {
      icon.innerHTML = svg;
      icon.dataset.nxNovaHubIcon = '1';
    }
  }

  function configureDock() {
    const dock = document.querySelector('.bottom-dock');
    const items = $$('.bottom-dock .dock-item');
    if (!dock || !items.length) return false;
    document.body.classList.add('nx-nova-hub-nav');

    let mine = null;
    items.forEach(button => {
      const target = buttonTarget(button);
      if (target === 'home') mine = button;
      const primary = target === 'home' || button.id === 'moreBtn';
      button.dataset.nxNovaHubPrimary = primary ? '1' : '0';
      button.dataset.nxNovaHubHidden = primary ? '0' : '1';
      if (!primary) button.setAttribute('aria-hidden','true');
      else button.removeAttribute('aria-hidden');
    });

    const hub = $('moreBtn');
    if (mine) {
      setDockLabel(mine, 'MINE');
      setDockIcon(mine, MINE_ICON);
      mine.setAttribute('aria-label','Open Mine');
    }
    if (hub) {
      setDockLabel(hub, 'NOVA HUB');
      setDockIcon(hub, HUB_ICON);
      hub.setAttribute('aria-label','Open Nova Hub');
      hub.title = 'Nova Hub';
    }
    return true;
  }

  function configureHub() {
    const menu = $('moreMenu');
    const inner = menu?.querySelector('.more-inner');
    if (!menu || !inner) return false;

    // Remove legacy synthetic Wallet/Market Hub buttons. Core destinations now
    // live under Mine, so Nova Hub remains a clean app grid with one owner.
    inner.querySelectorAll('[data-nx-nova-hub-core="1"],[data-nx-nova-hub-target="wallet"],[data-nx-nova-hub-target="market"]').forEach(node => node.remove());

    let header = $('nxNovaHubHeader');
    if (!header) {
      header = document.createElement('div');
      header.id = 'nxNovaHubHeader';
      header.className = 'nx-nova-hub-header';
      header.innerHTML = `
        <div class="nx-nova-hub-header-top">
          <div class="nx-nova-hub-mark">${HUB_ICON}</div>
          <div><div class="nx-nova-hub-kicker">NEXUSNOVA</div><div class="nx-nova-hub-title">Nova Hub</div></div>
        </div>
        <div class="nx-nova-hub-copy">All apps, utilities, learning and daily tools in one place.</div>`;
    }
    const copy = header.querySelector('.nx-nova-hub-copy');
    if (copy) copy.textContent = 'All apps, utilities, learning and daily tools in one place.';
    if (inner.firstElementChild !== header) inner.insertBefore(header, inner.firstElementChild);
    return true;
  }

  function relabelBackControls() {
    $$('.nx-allapps-back button,.tools-main-back').forEach(button => {
      const current = String(button.textContent || '');
      const next = current.replace(/ALL\s+APPS/gi,'Nova Hub');
      if (next !== current) button.textContent = next;
    });
  }

  function syncActiveDock() {
    const items = $$('.bottom-dock .dock-item');
    if (!items.length) return;
    items.forEach(button => button.classList.remove('active'));
    const activeName = document.querySelector('main.main>.tab.active,main>.tab.active')?.id?.replace(/^tab-/,'') || 'home';
    const menuOpen = document.body.classList.contains('nx-allapps-open') || $('moreMenu')?.classList.contains('show');
    const mine = items.find(button => buttonTarget(button) === 'home');
    const hub = $('moreBtn');
    if (!menuOpen && MINE_DOMAIN.has(activeName)) mine?.classList.add('active');
    else hub?.classList.add('active');
  }

  function refresh() {
    installStyles();
    configureDock();
    configureHub();
    relabelBackControls();
    syncActiveDock();
  }

  let refreshQueued = false;
  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      refresh();
    }, 0);
  }

  function wrapNavigation() {
    const switchTab = window.switchTab;
    if (typeof switchTab === 'function' && !switchTab.__nxNovaHubNavV1) {
      const wrapped = function(name, button) {
        const result = switchTab.call(this, name, button);
        queueRefresh();
        return result;
      };
      wrapped.__nxNovaHubNavV1 = true;
      window.switchTab = wrapped;
    }

    const openMoreTab = window.openMoreTab;
    if (typeof openMoreTab === 'function' && !openMoreTab.__nxNovaHubNavV1) {
      const wrapped = function(name) {
        const result = openMoreTab.call(this, name);
        queueRefresh();
        return result;
      };
      wrapped.__nxNovaHubNavV1 = true;
      window.openMoreTab = wrapped;
    }

    const toggleMore = window.toggleMore;
    if (typeof toggleMore === 'function' && !toggleMore.__nxNovaHubNavV1) {
      const wrapped = function(...args) {
        const result = toggleMore.apply(this, args);
        queueRefresh();
        return result;
      };
      wrapped.__nxNovaHubNavV1 = true;
      window.toggleMore = wrapped;
    }

    const back = window.nexusBackToAllApps;
    if (typeof back === 'function' && !back.__nxNovaHubNavV1) {
      const wrapped = function(...args) {
        const result = back.apply(this, args);
        queueRefresh();
        return result;
      };
      wrapped.__nxNovaHubNavV1 = true;
      window.nexusBackToAllApps = wrapped;
    }
  }

  function boot() {
    refresh();
    wrapNavigation();
    document.addEventListener('click', event => {
      if (event.target?.closest?.('.bottom-dock,#moreMenu,.nx-allapps-back,.tools-main-back')) queueRefresh();
    }, true);
    window.addEventListener('pageshow', queueRefresh);
    window.addEventListener('nexusaccountready', queueRefresh);
    [180,650,1600,3200,6000].forEach(ms => setTimeout(() => {
      wrapNavigation();
      refresh();
    }, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();