/* NexusNova ALL APPS Experience v1
   Surgical UI/navigation layer only:
   - Back to ALL APPS always becomes a clean, isolated app-grid screen.
   - No mutation-observer loops or menu reordering.
   - Plain feature screens receive NexusNova visual identity without replacing feature logic.
*/
(() => {
  'use strict';
  if (window.__nxAllAppsExperienceV1) return;
  window.__nxAllAppsExperienceV1 = true;

  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const META = {
    tools:['Tools','Daily utilities, calculators and quick helpers.','tools'],
    finance:['Gold & Currency','Live finance tools, rates and conversions.','finance'],
    news:['News','News and useful updates in one clean view.','news'],
    chat:['Community Chat','Connect and communicate inside NexusNova.','chat'],
    ai:['NexusNova AI','Your built-in intelligent assistant.','ai'],
    location:['Location','Location tools with clear privacy controls.','location'],
    emergency:['Emergency & SOS','Fast access to emergency helpers.','sos'],
    family:['Family Hub','Useful family tools and shared helpers.','family'],
    profile:['Profile','Your NexusNova identity and account overview.','profile'],
    tasks:['Daily Rewards','Daily activity, rewards and tasks.','tasks'],
    money:['Budget','Simple money and household planning tools.','finance'],
    learn:['Learning','Study, practice and learning utilities.','learning'],
    travel:['Travel','Travel planning and useful trip tools.','travel'],
    health:['Health','Everyday health and wellness helpers.','health'],
    smart:['Smart Tools','Useful smart utilities for daily life.','smart'],
    qibla:['Qibla','Qibla direction and Islamic utility tools.','qibla'],
    entertainment:['Entertainment','Watch and entertainment utilities.','entertainment'],
    browser:['NexusNova Browser','Browse with the dedicated NexusNova experience.','browser'],
    'caller-id':['Caller ID','Caller lookup and privacy helpers.','caller'],
    about:['Settings','App settings, preferences and information.','settings'],
    'mega-tools':['Daily Tools','Fast utilities for everyday work.','tools'],
    'mega-finance':['Finance Hub','Money, rates and finance utilities.','finance'],
    'mega-calendar':['Calendar','Plan dates, events and schedules.','calendar'],
    'mega-reminders':['Reminders','Keep important tasks and dates visible.','calendar'],
    'mega-weather':['Weather','Weather information in a clear visual view.','weather'],
    'mega-learning':['Learning Hub','Learning, study and practice resources.','learning'],
    'mega-pakistan':['Pakistan Hub','Useful Pakistan-focused information and services.','pakistan'],
    'mega-islamic':['Islamic Hub','Quran, Hadith and Islamic utilities.','islamic'],
    'mega-contacts':['Contacts','Contact and people utilities.','contacts'],
    'mega-shopping':['Shopping','Shopping and marketplace helpers.','shopping'],
    'mega-documents':['Documents','Document utilities and file helpers.','documents'],
    'mega-file-vault':['File Vault','Private file and document storage tools.','vault'],
    'mega-qr':['QR Tools','Scan, create and use QR codes.','qr'],
    'mega-security':['Security','Privacy and account security utilities.','security'],
    'mega-marketplace':['Marketplace','NexusNova marketplace experience.','shopping'],
    'mega-orders':['Orders','Track and manage marketplace orders.','orders'],
    'mega-notifications':['Notifications','Important NexusNova alerts and updates.','notifications'],
    'mega-teacher':['Teacher Toolkit','Lesson plans, quizzes and classroom worksheets.','teacher']
  };

  const PATHS = {
    tools:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2 2-2-2 2-2z"/>',
    finance:'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M12 10v7"/>',
    news:'<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    chat:'<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9h8M8 12h5"/>',
    ai:'<rect x="6" y="7" width="12" height="11" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/>',
    location:'<path d="M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    sos:'<path d="M12 3 21 20H3L12 3z"/><path d="M12 9v5M12 17h.01"/>',
    family:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2.8 20c.4-4.1 2.6-6.2 5.2-6.2s4.8 2.1 5.2 6.2M14 15c3 .1 5 1.8 5.7 5"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-5.2 3.5-8 8-8s7.3 2.8 8 8"/>',
    tasks:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="m8 11 2 2 4-4M8 17h8"/>',
    learning:'<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M6 10v6c3 2 9 2 12 0v-6M21 7v7"/>',
    travel:'<path d="M3 13h18M8 13l-3 7M16 13l3 7M5 10l7-6 7 6"/>',
    health:'<path d="M12 21s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.3-8 11-8 11z"/><path d="M8 12h2l1-2 2 5 1-3h2"/>',
    smart:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 6 6c0 2.5-1.4 4-3 5.5-.8.8-1 1.5-1 2.5h-4c0-1-.2-1.7-1-2.5C7.4 13 6 11.5 6 9a6 6 0 0 1 6-6z"/>',
    qibla:'<circle cx="12" cy="12" r="9"/><path d="M12 12l4-6M12 3v2M12 19v2M3 12h2M19 12h2"/>',
    entertainment:'<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 10 5 2-5 2v-4z"/>',
    browser:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 4.5 6.2 4.5 9S15 17.8 12 21M12 3C9 6.2 7.5 9.2 7.5 12S9 17.8 12 21"/>',
    caller:'<path d="M7 3h4l1 4-2 1c1 3 3 5 6 6l1-2 4 1v4a2 2 0 0 1-2 2C10 19 5 14 5 5a2 2 0 0 1 2-2z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M13 14h3"/>',
    weather:'<path d="M7 17a4 4 0 1 1 1-7.9A5 5 0 0 1 20 12a3 3 0 0 1-1 5H7z"/><path d="M12 3v3M5 6l2 2M19 6l-2 2"/>',
    pakistan:'<path d="M12 3a9 9 0 1 0 0 18 7 7 0 1 1 0-18z"/><path d="m16 8 .7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2L16 8z"/>',
    islamic:'<path d="M4 20h16M6 20v-8l6-5 6 5v8M12 7V4"/><path d="M10 20v-5h4v5"/>',
    contacts:'<circle cx="12" cy="8" r="3"/><path d="M5 20c.6-4.5 3-7 7-7s6.4 2.5 7 7"/><path d="M19 5v4M17 7h4"/>',
    shopping:'<path d="M5 7h16l-2 9H8L5 7z"/><path d="M5 7 4 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
    documents:'<path d="M7 3h7l5 5v13H7V3z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    vault:'<rect x="4" y="5" width="16" height="15" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M12 17v-2M9 12H7M17 12h-2"/>',
    qr:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM18 18h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2z"/>',
    security:'<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3z"/><path d="m9 12 2 2 4-4"/>',
    orders:'<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    notifications:'<path d="M6 17h12l-2-3v-3a4 4 0 0 0-8 0v3l-2 3z"/><path d="M10 20h4"/>',
    teacher:'<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M7 11v6M17 11v6M5 20h14"/><circle cx="12" cy="15" r="2"/>'
  };

  function iconSvg(name) {
    if (window.NexusNovaUI?.icon) return window.NexusNovaUI.icon(name === 'finance' ? 'number' : name);
    const path = PATHS[name] || PATHS.smart;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  function installStyles() {
    if ($('nxAllAppsExperienceStyles')) return;
    const style = document.createElement('style');
    style.id = 'nxAllAppsExperienceStyles';
    style.textContent = `
      /* Hard isolation: while ALL APPS is open, no previous feature is allowed to remain visible. */
      body.nx-allapps-open main.main > .tab,
      body.nx-allapps-open main > .tab{
        display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;
      }
      body.nx-allapps-open #moreMenu.more-menu.show{
        display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;
      }
      body.nx-allapps-open #moreMenu{z-index:1200!important}

      /* Premium feature identity for tabs that were previously plain/text-heavy. */
      .nx-app-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:76px minmax(0,1fr);gap:16px;align-items:center;margin:0 0 14px;padding:18px;border-radius:23px;background:linear-gradient(145deg,rgba(10,29,54,.98),rgba(5,16,34,.98));border:1px solid rgba(89,169,255,.22);box-shadow:0 18px 42px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.05)}
      .nx-app-hero:before{content:"";position:absolute;right:-55px;top:-80px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(49,156,255,.24),transparent 68%);pointer-events:none}
      .nx-app-hero-icon{width:72px;height:72px;display:grid;place-items:center;border-radius:23px;color:#fff;background:linear-gradient(145deg,#1776ff,#39b7ff 62%,#68d8ff);border:1px solid rgba(184,231,255,.34);box-shadow:0 15px 32px rgba(22,124,255,.3),inset 0 1px 0 rgba(255,255,255,.35)}
      .nx-app-hero-icon svg{width:38px;height:38px;filter:drop-shadow(0 5px 8px rgba(0,0,0,.2))}
      .nx-app-hero-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:#65bdff;text-transform:uppercase;margin-bottom:4px}.nx-app-hero h2{margin:0;color:#fff;font-size:21px;line-height:1.1;font-weight:900;letter-spacing:-.025em}.nx-app-hero p{margin:6px 0 0;color:#93aac4;font-size:12px;line-height:1.5}
      body.nx-opened-from-allapps .tab.active .card:not(.nx-app-hero),body.nx-opened-from-allapps .tab.active .tool-result,body.nx-opened-from-allapps .tab.active .integration-note{border-color:rgba(80,156,245,.17);box-shadow:0 12px 32px rgba(0,0,0,.12)}
      .nx-allapps-back{z-index:70!important}.nx-allapps-back .tool-btn,.tools-main-back{border:1px solid rgba(82,162,255,.28)!important;background:linear-gradient(135deg,rgba(17,74,145,.72),rgba(11,41,82,.82))!important;color:#dcecff!important;box-shadow:0 8px 22px rgba(0,0,0,.2)!important}

      /* Semantic field badges: visual meaning without changing the actual field or its behavior. */
      .nx-semantic-label{display:flex!important;align-items:center!important;gap:7px!important}.nx-semantic-badge{width:24px;height:24px;flex:0 0 24px;display:inline-grid;place-items:center;border-radius:8px;color:#70c7ff;background:linear-gradient(145deg,rgba(21,106,230,.22),rgba(33,181,255,.12));border:1px solid rgba(93,180,255,.2)}.nx-semantic-badge svg{width:15px;height:15px}
      @media(max-width:620px){.nx-app-hero{grid-template-columns:62px 1fr;padding:15px;gap:12px;border-radius:20px}.nx-app-hero-icon{width:59px;height:59px;border-radius:19px}.nx-app-hero-icon svg{width:31px;height:31px}.nx-app-hero h2{font-size:18px}.nx-app-hero p{font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function targetFromButton(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return button.dataset.nxmega;
    if (button.dataset?.finalBible) return 'bible';
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/)?.[1] || '';
  }

  function titleFromTab(tab, fallback) {
    const h = tab?.querySelector('h1,h2,h3,.hub-kicker,.balance-title');
    return String(h?.textContent || fallback || 'NexusNova App').replace(/\s+/g,' ').trim();
  }

  function metaFor(name, tab) {
    if (META[name]) return META[name];
    const title = titleFromTab(tab, String(name || 'NexusNova App').replace(/^mega-/,'').replace(/-/g,' '));
    return [title,'A focused NexusNova utility with a clean visual workspace.','smart'];
  }

  function decorateSemanticLabels(tab) {
    if (!tab) return;
    const patterns = [
      [/university|college/i,'university'],[/school|class|grade/i,'school'],[/worksheet/i,'worksheet'],[/lesson/i,'lesson'],[/attendance|student/i,'attendance'],[/date|calendar/i,'calendar'],[/teacher|subject/i,'teacher'],[/location|city|place/i,'location'],[/security|password|privacy/i,'security']
    ];
    tab.querySelectorAll('label,.nxui-label').forEach(label => {
      if (label.dataset.nxSemantic === '1' || label.querySelector('svg,.nx-semantic-badge')) return;
      const text = String(label.textContent || '');
      const hit = patterns.find(([rx]) => rx.test(text));
      if (!hit) return;
      const badge = document.createElement('span');
      badge.className = 'nx-semantic-badge';
      badge.innerHTML = iconSvg(hit[1]);
      label.insertBefore(badge,label.firstChild);
      label.classList.add('nx-semantic-label');
      label.dataset.nxSemantic = '1';
    });
  }

  function decorateTab(name) {
    const tab = $('tab-' + name);
    if (!tab) return;
    decorateSemanticLabels(tab);
    if (tab.querySelector(':scope > .nx-app-hero')) return;
    /* Respect screens that already have a purpose-built visual hero. */
    if (tab.querySelector(':scope > .card .hub-hero,:scope > .hub-hero,:scope > .nxui-hero')) return;
    const [title,subtitle,icon] = metaFor(name,tab);
    const hero = document.createElement('div');
    hero.className = 'nx-app-hero';
    hero.innerHTML = `<div class="nx-app-hero-icon">${iconSvg(icon)}</div><div><div class="nx-app-hero-kicker">NEXUSNOVA • APP</div><h2>${String(title).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</h2><p>${String(subtitle).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p></div>`;
    const back = tab.querySelector(':scope > .nx-allapps-back');
    if (back) back.insertAdjacentElement('afterend',hero);
    else tab.insertBefore(hero,tab.firstChild);
  }

  function decorateKnownTabs() {
    const buttons = $$('#moreMenu .more-item');
    const names = new Set(buttons.map(targetFromButton).filter(Boolean));
    Object.keys(META).forEach(name => names.add(name));
    names.forEach(decorateTab);
  }

  function closeTransientFeatureUi() {
    try { window.nexusStopQRScan?.(); } catch (_) {}
    /* Close only transient dialog/sheet UI. Do not remove feature data or cards. */
    $$('.nxui-backdrop').forEach(el => el.remove());
    document.body.style.removeProperty('overflow');
    const active = document.querySelector('main.main > .tab.active,main > .tab.active');
    if (!active) return;
    active.querySelectorAll('[role="dialog"].show,.modal.show,.popup.show,.dialog.show,.sheet.show,.overlay.show').forEach(el => {
      el.classList.remove('show','open','active');
      el.setAttribute('aria-hidden','true');
    });
  }

  function setMoreDockActive() {
    $$('.bottom-dock .dock-item').forEach(button => button.classList.remove('active'));
    $('moreBtn')?.classList.add('active');
  }

  function showAllAppsClean() {
    closeTransientFeatureUi();
    const menu = $('moreMenu');
    if (!menu) return false;
    document.body.classList.add('nx-opened-from-allapps','nx-allapps-open');
    menu.style.removeProperty('display');
    menu.classList.add('show');
    if (getComputedStyle(menu).display === 'none') menu.style.display = 'block';
    $$('main.main > .tab,main > .tab').forEach(tab => tab.setAttribute('aria-hidden','true'));
    setMoreDockActive();
    window.scrollTo({top:0,behavior:'auto'});
    return true;
  }

  function leaveAllAppsState() {
    const menu = $('moreMenu');
    menu?.classList.remove('show');
    if (menu) menu.style.display = 'none';
    document.body.classList.remove('nx-allapps-open');
    $$('main.main > .tab,main > .tab').forEach(tab => tab.removeAttribute('aria-hidden'));
  }

  function installNavigationGuard() {
    if (window.__nxAllAppsNavigationGuardV1) return;
    window.__nxAllAppsNavigationGuardV1 = true;

    /* Capture Back-to-ALL-APPS before older target/bubble handlers can instantly close the menu again. */
    document.addEventListener('click', event => {
      const back = event.target.closest('.nx-allapps-back button,.tools-main-back');
      if (!back) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showAllAppsClean();
    }, true);

    const oldBack = window.nexusBackToAllApps;
    window.nexusBackToAllApps = function(){ return showAllAppsClean() || oldBack?.(); };

    const oldOpen = window.openMoreTab;
    if (typeof oldOpen === 'function') {
      window.openMoreTab = function(name){
        leaveAllAppsState();
        const result = oldOpen.call(this,name);
        decorateTab(name);
        requestAnimationFrame(() => decorateSemanticLabels($('tab-'+name)));
        return result;
      };
    }

    const oldToggle = window.toggleMore;
    window.toggleMore = function(){
      const menu = $('moreMenu');
      const open = Boolean(menu?.classList.contains('show') && getComputedStyle(menu).display !== 'none');
      if (!open) return showAllAppsClean();
      leaveAllAppsState();
      if (typeof oldToggle === 'function') {
        /* oldToggle would reopen because we already hid it; do not call it here. */
        const active = document.querySelector('.tab.active');
        const name = active?.id?.replace(/^tab-/,'') || 'home';
        const dock = name === 'home' ? $$('.bottom-dock .dock-item')[0] : name === 'wallet' ? $$('.bottom-dock .dock-item')[1] : name === 'tasks' ? $$('.bottom-dock .dock-item')[2] : name === 'market' ? $$('.bottom-dock .dock-item')[3] : $('moreBtn');
        $$('.bottom-dock .dock-item').forEach(b=>b.classList.remove('active')); dock?.classList.add('active');
      }
    };

    const oldSwitch = window.switchTab;
    if (typeof oldSwitch === 'function') {
      window.switchTab = function(name,button){
        if (button?.classList?.contains('dock-item') && button.id !== 'moreBtn') leaveAllAppsState();
        const result = oldSwitch.call(this,name,button);
        if (document.body.classList.contains('nx-opened-from-allapps')) decorateTab(name);
        return result;
      };
    }
  }

  function loadPremiumUI() {
    if (window.NexusNovaUI || document.querySelector('script[data-nx-allapps-premium-ui]')) return;
    const script = document.createElement('script');
    script.src = './js/nexusnova-premium-ui-v1.js?v=1';
    script.dataset.nxAllappsPremiumUi = '1';
    script.onload = () => decorateKnownTabs();
    document.body.appendChild(script);
  }

  function install() {
    installStyles();
    loadPremiumUI();
    decorateKnownTabs();
    installNavigationGuard();
    /* Mega tabs are created synchronously/shortly after page scripts. Finite passes only — no observer loop. */
    [450,1400,3200].forEach(ms => setTimeout(decorateKnownTabs,ms));
  }

  if (document.readyState === 'complete') install();
  else window.addEventListener('load',() => setTimeout(install,60),{once:true});
})();
