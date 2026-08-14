/* NexusNova ALL APPS Experience v2
   Focused repair: clean ALL APPS return + premium feature identity.
   No menu reordering, no MutationObserver loops, no feature logic replacement.
*/
(() => {
  'use strict';
  if (window.__nxAllAppsExperienceV2) return;
  window.__nxAllAppsExperienceV2 = true;

  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const META = {
    tools:['Tools','Daily utilities, calculators and quick helpers.'],
    finance:['Gold & Currency','Rates, conversions and finance utilities.'],
    news:['News','Useful news and updates in one clean view.'],
    chat:['Community Chat','Connect and communicate inside NexusNova.'],
    ai:['NexusNova AI','Your built-in intelligent assistant.'],
    location:['Location','Location tools with clear privacy controls.'],
    emergency:['Emergency & SOS','Fast access to emergency helpers.'],
    family:['Family Hub','Useful family tools and shared helpers.'],
    profile:['Profile','Your NexusNova identity and account overview.'],
    tasks:['Daily Rewards','Daily activity, rewards and tasks.'],
    money:['Budget','Simple money and household planning tools.'],
    learn:['Learning','Study, practice and learning utilities.'],
    travel:['Travel','Travel planning and useful trip tools.'],
    health:['Health','Everyday health and wellness helpers.'],
    smart:['Smart Tools','Useful smart utilities for daily life.'],
    qibla:['Qibla','Qibla direction and Islamic utility tools.'],
    entertainment:['Entertainment','Watch and entertainment utilities.'],
    browser:['NexusNova Browser','Browse with the dedicated NexusNova experience.'],
    'caller-id':['Caller ID','Caller lookup and privacy helpers.'],
    about:['Settings','App settings, preferences and information.'],
    'mega-tools':['Daily Tools','Fast utilities for everyday work.'],
    'mega-finance':['Finance Hub','Money, rates and finance utilities.'],
    'mega-calendar':['Calendar','Plan dates, events and schedules.'],
    'mega-reminders':['Reminders','Keep important tasks and dates visible.'],
    'mega-weather':['Weather','Weather information in a clear visual view.'],
    'mega-learning':['Learning Hub','Learning, study and practice resources.'],
    'mega-pakistan':['Pakistan Hub','Useful Pakistan-focused information and services.'],
    'mega-islamic':['Islamic Hub','Quran, Hadith and Islamic utilities.'],
    'mega-contacts':['Contacts','Contact and people utilities.'],
    'mega-shopping':['Shopping','Shopping and marketplace helpers.'],
    'mega-documents':['Documents','Document utilities and file helpers.'],
    'mega-file-vault':['File Vault','Private file and document storage tools.'],
    'mega-qr':['QR Tools','Scan, create and use QR codes.'],
    'mega-security':['Security','Privacy and account security utilities.'],
    'mega-marketplace':['Marketplace','NexusNova marketplace experience.'],
    'mega-orders':['Orders','Track and manage marketplace orders.'],
    'mega-notifications':['Notifications','Important NexusNova alerts and updates.'],
    'mega-teacher':['Teacher Toolkit','Lesson plans, quizzes and classroom worksheets.']
  };

  function targetFromButton(button) {
    if (!button) return '';
    if (button.dataset?.nxmega) return button.dataset.nxmega;
    if (button.dataset?.finalBible) return 'bible';
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/)?.[1] || '';
  }

  function menuButtonFor(name) {
    return $$('#moreMenu .more-item').find(button => targetFromButton(button) === name) || null;
  }

  function featureIcon(name) {
    const button = menuButtonFor(name);
    const svg = button?.querySelector('.mi-icon svg,svg');
    if (svg) return svg.outerHTML;
    if (window.NexusNovaUI?.icon) return window.NexusNovaUI.icon('spark');
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 14 9h6l-5 4 2 7-5-4-5 4 2-7-5-4h6l2-6Z"/></svg>';
  }

  function installStyles() {
    if ($('nxAllAppsExperienceV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'nxAllAppsExperienceV2Styles';
    style.textContent = `
      /* ALL APPS is a real screen: previous feature content cannot remain behind/on top. */
      body.nx-allapps-open main.main>.tab,body.nx-allapps-open main>.tab{
        display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important
      }
      body.nx-allapps-open #moreMenu.more-menu.show{
        display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;z-index:1250!important
      }
      .nx-app-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:74px minmax(0,1fr);gap:15px;align-items:center;margin:0 0 14px;padding:18px;border-radius:23px;background:linear-gradient(145deg,rgba(10,30,57,.98),rgba(4,15,32,.98));border:1px solid rgba(84,166,255,.22);box-shadow:0 18px 42px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.05)}
      .nx-app-hero:before{content:"";position:absolute;right:-60px;top:-85px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(40,151,255,.25),transparent 67%);pointer-events:none}
      .nx-app-hero-icon{width:70px;height:70px;display:grid;place-items:center;border-radius:22px;color:#fff;background:linear-gradient(145deg,#1675ff,#32b5ff 62%,#69dcff);border:1px solid rgba(183,230,255,.35);box-shadow:0 14px 32px rgba(20,122,255,.30),inset 0 1px 0 rgba(255,255,255,.34)}
      .nx-app-hero-icon svg{width:37px;height:37px;filter:drop-shadow(0 5px 8px rgba(0,0,0,.22))}.nx-app-hero-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:#64bdff;text-transform:uppercase;margin-bottom:4px}.nx-app-hero h2{margin:0;color:#fff;font-size:21px;line-height:1.12;font-weight:900;letter-spacing:-.025em}.nx-app-hero p{margin:6px 0 0;color:#94abc5;font-size:12px;line-height:1.5}
      body.nx-opened-from-allapps .tab.active>.card,body.nx-opened-from-allapps .tab.active>.tool-result{border-color:rgba(75,156,247,.17)}
      .nx-allapps-back{z-index:80!important}.nx-allapps-back .tool-btn,#tab-tools .tools-main-back{border:1px solid rgba(80,162,255,.28)!important;background:linear-gradient(135deg,rgba(17,75,148,.76),rgba(9,38,77,.88))!important;color:#e2f0ff!important;box-shadow:0 8px 22px rgba(0,0,0,.18)!important}
      .nx-semantic-label{display:flex!important;align-items:center!important;gap:7px!important}.nx-semantic-badge{width:24px;height:24px;flex:0 0 24px;display:inline-grid;place-items:center;border-radius:8px;color:#70c8ff;background:linear-gradient(145deg,rgba(20,106,230,.24),rgba(35,183,255,.12));border:1px solid rgba(91,180,255,.2)}.nx-semantic-badge svg{width:15px;height:15px}
      @media(max-width:620px){.nx-app-hero{grid-template-columns:60px 1fr;padding:14px;gap:12px;border-radius:20px}.nx-app-hero-icon{width:58px;height:58px;border-radius:18px}.nx-app-hero-icon svg{width:30px;height:30px}.nx-app-hero h2{font-size:18px}.nx-app-hero p{font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function premiumIcon(name) {
    if (window.NexusNovaUI?.icon) return window.NexusNovaUI.icon(name);
    return featureIcon('smart');
  }

  function decorateSemanticLabels(tab) {
    if (!tab) return;
    const patterns = [
      [/university|college/i,'university'],[/school|class|grade/i,'school'],[/worksheet/i,'worksheet'],[/lesson/i,'lesson'],[/attendance|student/i,'attendance'],[/date|calendar/i,'calendar'],[/teacher|subject/i,'teacher'],[/language/i,'language'],[/duration|minutes|time/i,'duration'],[/security|password|privacy/i,'security']
    ];
    tab.querySelectorAll('label,.nxui-label').forEach(label => {
      if (label.dataset.nxSemantic === '1' || label.querySelector('.nx-semantic-badge')) return;
      const hit = patterns.find(([rx]) => rx.test(String(label.textContent || '')));
      if (!hit) return;
      const badge = document.createElement('span');
      badge.className = 'nx-semantic-badge';
      badge.innerHTML = premiumIcon(hit[1]);
      label.insertBefore(badge,label.firstChild);
      label.classList.add('nx-semantic-label');
      label.dataset.nxSemantic = '1';
    });
  }

  function titleFromTab(tab,name) {
    return String(tab?.querySelector('h1,h2,h3,.hub-kicker,.balance-title')?.textContent || name || 'NexusNova App').replace(/\s+/g,' ').trim();
  }

  function decorateTab(name) {
    const tab = $('tab-' + name);
    if (!tab) return;
    decorateSemanticLabels(tab);
    if (tab.querySelector(':scope>.nx-app-hero')) return;
    /* Do not duplicate screens that already have a designed visual hero. */
    if (tab.querySelector(':scope>.card .hub-hero,:scope>.hub-hero,:scope>.nxui-hero')) return;
    const meta = META[name] || [titleFromTab(tab,name),'A focused NexusNova utility with a clean visual workspace.'];
    const hero = document.createElement('div');
    hero.className = 'nx-app-hero';
    hero.dataset.nxFeature = name;
    hero.innerHTML = `<div class="nx-app-hero-icon">${featureIcon(name)}</div><div><div class="nx-app-hero-kicker">NEXUSNOVA • APP</div><h2>${esc(meta[0])}</h2><p>${esc(meta[1])}</p></div>`;
    const back = tab.querySelector(':scope>.nx-allapps-back');
    if (back) back.insertAdjacentElement('afterend',hero); else tab.insertBefore(hero,tab.firstChild);
  }

  function decorateAll() {
    const names = new Set($$('#moreMenu .more-item').map(targetFromButton).filter(Boolean));
    Object.keys(META).forEach(name => names.add(name));
    names.forEach(decorateTab);
  }

  function closeTransientUi() {
    try { window.nexusStopQRScan?.(); } catch (_) {}
    $$('.nxui-backdrop').forEach(el => el.remove());
    document.body.style.removeProperty('overflow');
    const active = document.querySelector('main.main>.tab.active,main>.tab.active');
    active?.querySelectorAll('.modal.show,.popup.show,.dialog.show,.sheet.show,.overlay.show,[role="dialog"].show').forEach(el => {
      el.classList.remove('show','open','active');
      el.setAttribute('aria-hidden','true');
    });
  }

  function setAllAppsDock() {
    $$('.bottom-dock .dock-item').forEach(button => button.classList.remove('active'));
    $('moreBtn')?.classList.add('active');
  }

  function restoreDock() {
    const name = document.querySelector('.tab.active')?.id?.replace(/^tab-/,'') || 'home';
    const items = $$('.bottom-dock .dock-item');
    const map = {home:items[0],wallet:items[1],tasks:items[2],market:items[3]};
    items.forEach(button => button.classList.remove('active'));
    (map[name] || $('moreBtn'))?.classList.add('active');
  }

  function showAllAppsClean() {
    closeTransientUi();
    const menu = $('moreMenu');
    if (!menu) return false;
    document.body.classList.add('nx-opened-from-allapps','nx-allapps-open');
    menu.style.removeProperty('display');
    menu.classList.add('show');
    if (getComputedStyle(menu).display === 'none') menu.style.display = 'block';
    setAllAppsDock();
    window.scrollTo({top:0,behavior:'auto'});
    return true;
  }

  function leaveAllApps() {
    const menu = $('moreMenu');
    menu?.classList.remove('show');
    if (menu) menu.style.display = 'none';
    document.body.classList.remove('nx-allapps-open');
  }

  function installNavigation() {
    if (window.__nxAllAppsExperienceNavigationV2) return;
    window.__nxAllAppsExperienceNavigationV2 = true;

    /* Capture phase is intentional: old Back listeners cannot re-close ALL APPS afterwards. */
    document.addEventListener('click',event => {
      const back = event.target.closest('.nx-allapps-back button,.tools-main-back');
      if (!back) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showAllAppsClean();
    },true);

    const priorBack = window.nexusBackToAllApps;
    window.nexusBackToAllApps = function(){ return showAllAppsClean() || priorBack?.(); };

    const priorOpen = window.openMoreTab;
    if (typeof priorOpen === 'function' && !priorOpen.__nxExperienceV2) {
      const wrapped = function(name){
        leaveAllApps();
        const result = priorOpen.call(this,name);
        decorateTab(name);
        requestAnimationFrame(()=>decorateSemanticLabels($('tab-'+name)));
        return result;
      };
      wrapped.__nxExperienceV2 = true;
      window.openMoreTab = wrapped;
    }

    const priorSwitch = window.switchTab;
    if (typeof priorSwitch === 'function' && !priorSwitch.__nxExperienceV2) {
      const wrapped = function(name,button){
        if (button?.classList?.contains('dock-item') && button.id !== 'moreBtn') leaveAllApps();
        const result = priorSwitch.call(this,name,button);
        if (document.body.classList.contains('nx-opened-from-allapps')) decorateTab(name);
        return result;
      };
      wrapped.__nxExperienceV2 = true;
      window.switchTab = wrapped;
    }

    const priorToggle = window.toggleMore;
    window.toggleMore = function(){
      const menu = $('moreMenu');
      const open = Boolean(menu?.classList.contains('show') && getComputedStyle(menu).display !== 'none');
      if (!open) return showAllAppsClean();
      leaveAllApps();
      restoreDock();
      return false;
    };
    window.toggleMore.__nxExperienceV2 = true;
    window.toggleMore.__nxPriorToggle = priorToggle;
  }

  function ensurePremiumUi() {
    if (window.NexusNovaUI || document.querySelector('script[data-nx-experience-premium]')) return;
    const script = document.createElement('script');
    script.src = './js/nexusnova-premium-ui-v1.js?v=1';
    script.dataset.nxExperiencePremium = '1';
    script.onload = decorateAll;
    document.body.appendChild(script);
  }

  function install() {
    installStyles();
    ensurePremiumUi();
    decorateAll();
    installNavigation();
    /* Finite late passes only for mega tabs/forms created after initial load. */
    [500,1500,3200].forEach(ms=>setTimeout(decorateAll,ms));
  }

  if (document.readyState === 'complete') install();
  else window.addEventListener('load',()=>setTimeout(install,80),{once:true});
})();
