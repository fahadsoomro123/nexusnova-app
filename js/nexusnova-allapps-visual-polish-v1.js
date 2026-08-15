/* NexusNova ALL APPS Visual Polish v1
   Additive presentation layer only.
   - Keeps feature logic, navigation, order, WebView and mining untouched.
   - Adds semantic visual identity to plain forms/cards/results opened from ALL APPS.
   - Uses finite passes/click hooks only; no mutation-observer loop.
*/
(() => {
  'use strict';
  if (window.__nxAllAppsVisualPolishV1) return;
  window.__nxAllAppsVisualPolishV1 = true;

  const $ = id => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const fallbackPaths = {
    university:'<path d="M3 10 12 4l9 6-9 4-9-4Z"/><path d="M6 12v5M10 14v3M14 14v3M18 12v5M4 19h16"/>',
    school:'<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-5h6v5M7 11h2M15 11h2"/>',
    worksheet:'<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6M10 17h6"/><path d="m4.5 15 1 1 2-2"/>',
    lesson:'<path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 2V5Z"/><path d="M20 5h-3a3 3 0 0 0-3 3v11h3a3 3 0 0 1 3 2V5Z"/>',
    attendance:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 20c.2-4 2.5-6 5-6s4.8 2 5 6M14 15c2.9.1 5 1.7 5.7 4"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M13 14h3"/>',
    teacher:'<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M7 11v6M17 11v6M5 20h14"/>',
    language:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 4.5 6.3 4.5 9S15 17.7 12 21M12 3C9 6.3 7.5 9.3 7.5 12S9 17.7 12 21"/>',
    duration:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    security:'<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
    contact:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.6-5 3.5-8 8-8s7.4 3 8 8"/>',
    document:'<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    money:'<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M12 11v5"/>',
    weather:'<path d="M7 17a4 4 0 1 1 1-7.9A5 5 0 0 1 20 12a3 3 0 0 1-1 5H7Z"/><path d="M12 3v3M5 6l2 2M19 6l-2 2"/>',
    travel:'<path d="M3 13h18M8 13l-3 7M16 13l3 7M5 10l7-6 7 6"/>',
    health:'<path d="M12 21s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.3-8 11-8 11Z"/><path d="M8 12h2l1-2 2 5 1-3h2"/>',
    qr:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM18 18h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2z"/>',
    islamic:'<path d="M4 20h16M6 20v-8l6-5 6 5v8M12 7V4"/><path d="M10 20v-5h4v5"/>',
    book:'<path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 2V5Z"/><path d="M20 5h-3a3 3 0 0 0-3 3v11h3a3 3 0 0 1 3 2V5Z"/>',
    spark:'<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/>'
  };

  function icon(name='spark') {
    if (window.NexusNovaUI?.icon) {
      const supported = new Set(['university','school','worksheet','lesson','attendance','calendar','teacher','language','duration','security','search','contact','spark']);
      if (supported.has(name)) return window.NexusNovaUI.icon(name);
    }
    const path = fallbackPaths[name] || fallbackPaths.spark;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  const RULES = [
    [/university|college|campus/i,'university'],
    [/school|class|grade/i,'school'],
    [/worksheet|work sheet/i,'worksheet'],
    [/lesson|topic|syllabus/i,'lesson'],
    [/attendance|student|pupil/i,'attendance'],
    [/date|calendar|day|month|year/i,'calendar'],
    [/teacher|subject|quiz|question|exam/i,'teacher'],
    [/language|urdu|sindhi|english/i,'language'],
    [/duration|minute|hour|time/i,'duration'],
    [/security|password|privacy|permission|lock/i,'security'],
    [/search|find|lookup/i,'search'],
    [/contact|phone|email|name/i,'contact'],
    [/document|file|pdf|certificate|cnic/i,'document'],
    [/money|salary|budget|finance|currency|loan|emi|price|amount|saving/i,'money'],
    [/weather|temperature|forecast/i,'weather'],
    [/travel|flight|bus|rail|train|hotel|trip/i,'travel'],
    [/health|bmi|weight|height|medicine|wellness/i,'health'],
    [/qr|scan/i,'qr'],
    [/quran|hadith|bukhari|surah|ayah|islamic|qibla|prayer/i,'islamic'],
    [/bible|chapter|verse|scripture/i,'book']
  ];

  function semanticFor(element) {
    const text = [
      element?.textContent,
      element?.getAttribute?.('placeholder'),
      element?.getAttribute?.('aria-label'),
      element?.getAttribute?.('name'),
      element?.id
    ].filter(Boolean).join(' ');
    return RULES.find(([rx]) => rx.test(text))?.[1] || '';
  }

  function installStyles() {
    if ($('nxAllAppsVisualPolishV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'nxAllAppsVisualPolishV1Styles';
    style.textContent = `
      body.nx-opened-from-allapps .tab.active .nxv-card{
        position:relative;overflow:hidden;border-color:rgba(89,169,255,.20)!important;
        background:linear-gradient(145deg,rgba(9,26,48,.95),rgba(5,16,32,.96))!important;
        box-shadow:0 14px 34px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.035);
        transition:transform .18s cubic-bezier(.2,.8,.2,1),border-color .18s ease,box-shadow .18s ease
      }
      body.nx-opened-from-allapps .tab.active .nxv-card:before{
        content:"";position:absolute;right:-45px;top:-65px;width:140px;height:140px;border-radius:50%;
        background:radial-gradient(circle,rgba(45,146,255,.12),transparent 69%);pointer-events:none
      }
      body.nx-opened-from-allapps .tab.active .nxv-heading{display:flex!important;align-items:center;gap:9px!important}
      .nxv-title-icon,.nxv-field-icon{
        display:inline-grid;place-items:center;flex:0 0 auto;color:#7dccff;
        background:linear-gradient(145deg,rgba(20,106,230,.25),rgba(36,183,255,.12));
        border:1px solid rgba(93,182,255,.20);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)
      }
      .nxv-title-icon{width:32px;height:32px;border-radius:10px}.nxv-title-icon svg{width:18px;height:18px}
      .nxv-field-icon{width:25px;height:25px;border-radius:8px}.nxv-field-icon svg{width:15px;height:15px}
      body.nx-opened-from-allapps .tab.active label.nxv-label{display:flex!important;align-items:center!important;gap:7px!important;color:#cfe4fb!important;font-weight:800!important}
      body.nx-opened-from-allapps .tab.active input:not([type="checkbox"]):not([type="radio"]),
      body.nx-opened-from-allapps .tab.active select,
      body.nx-opened-from-allapps .tab.active textarea{
        border-color:rgba(103,166,232,.18)!important;
        background:linear-gradient(180deg,rgba(4,15,31,.92),rgba(8,24,45,.94))!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease
      }
      body.nx-opened-from-allapps .tab.active input:not([type="checkbox"]):not([type="radio"]):focus,
      body.nx-opened-from-allapps .tab.active select:focus,
      body.nx-opened-from-allapps .tab.active textarea:focus{
        border-color:#4ca7ff!important;box-shadow:0 0 0 3px rgba(38,134,255,.13),0 8px 20px rgba(0,0,0,.12)!important
      }
      body.nx-opened-from-allapps .tab.active .tool-result.nxv-result,
      body.nx-opened-from-allapps .tab.active .status.nxv-result,
      body.nx-opened-from-allapps .tab.active [id$="Result"].nxv-result,
      body.nx-opened-from-allapps .tab.active [id$="Out"].nxv-result{
        position:relative;border-radius:17px!important;border:1px solid rgba(91,166,244,.16)!important;
        background:linear-gradient(145deg,rgba(8,25,46,.90),rgba(5,17,33,.92))!important;
        box-shadow:0 10px 26px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.03)
      }
      body.nx-opened-from-allapps .tab.active button.nxv-action:not(.nxui-btn):not(.dock-item):not(.more-item){
        -webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:transform .15s cubic-bezier(.2,.8,.2,1),filter .15s ease,box-shadow .15s ease
      }
      body.nx-opened-from-allapps .tab.active button.nxv-action:active{transform:scale(.975)}
      @media(max-width:620px){
        .nxv-title-icon{width:29px;height:29px}.nxv-title-icon svg{width:16px;height:16px}
        .nxv-field-icon{width:23px;height:23px}.nxv-field-icon svg{width:14px;height:14px}
      }
      @media(prefers-reduced-motion:reduce){body.nx-opened-from-allapps .tab.active .nxv-card,body.nx-opened-from-allapps .tab.active button.nxv-action{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function decorateLabels(tab) {
    $$('label', tab).forEach(label => {
      if (label.dataset.nxVisualPolish === '1' || label.querySelector('.nx-semantic-badge,.nxv-field-icon,.mi-icon,svg')) return;
      const semantic = semanticFor(label);
      if (!semantic) return;
      const badge = document.createElement('span');
      badge.className = 'nxv-field-icon';
      badge.innerHTML = icon(semantic);
      label.insertBefore(badge,label.firstChild);
      label.classList.add('nxv-label');
      label.dataset.nxVisualPolish = '1';
    });
  }

  function decorateHeadings(tab) {
    $$('h2,h3,.tool-title,.feature-title,.card-title', tab).forEach(heading => {
      if (heading.dataset.nxVisualPolish === '1' || heading.querySelector('.mi-icon,.nxv-title-icon,svg')) return;
      const semantic = semanticFor(heading);
      if (!semantic) return;
      const badge = document.createElement('span');
      badge.className = 'nxv-title-icon';
      badge.innerHTML = icon(semantic);
      heading.insertBefore(badge,heading.firstChild);
      heading.classList.add('nxv-heading');
      heading.dataset.nxVisualPolish = '1';
    });
  }

  function decorateCards(tab) {
    $$('.card,.tool-card,.feature-tile,.nxmega-card', tab).forEach(card => {
      if (card.closest('.nxui-modal') || card.classList.contains('nx-app-hero')) return;
      card.classList.add('nxv-card');
    });
  }

  function decorateResults(tab) {
    $$('.tool-result,.status,[id$="Result"],[id$="Out"],[id$="Output"]', tab).forEach(result => {
      if (result.closest('.nxui-modal') || result.classList.contains('nxui-result-shell')) return;
      result.classList.add('nxv-result');
    });
  }

  function decorateActions(tab) {
    $$('button', tab).forEach(button => {
      if (button.closest('.bottom-dock') || button.classList.contains('more-item') || button.closest('.nxui-modal')) return;
      button.classList.add('nxv-action');
    });
  }

  function decorateTab(tab) {
    if (!tab) return;
    decorateLabels(tab);
    decorateHeadings(tab);
    decorateCards(tab);
    decorateResults(tab);
    decorateActions(tab);
  }

  function activeFeature() {
    return document.querySelector('main.main>.tab.active,main>.tab.active');
  }

  function decorateActive() {
    if (!document.body.classList.contains('nx-opened-from-allapps')) return;
    decorateTab(activeFeature());
  }

  function decorateKnownTabs() {
    $$('#moreMenu .more-item').forEach(button => {
      const code = String(button.getAttribute('onclick') || '');
      const name = button.dataset?.nxmega || (button.dataset?.finalBible ? 'bible' : code.match(/openMoreTab\(\s*['"]([^'"]+)['"]\s*\)/)?.[1]);
      if (name) decorateTab($('tab-' + name));
    });
  }

  function install() {
    installStyles();
    decorateKnownTabs();
    document.addEventListener('click', event => {
      if (!event.target.closest('#moreMenu .more-item,.nx-allapps-back button,.tools-main-back')) return;
      requestAnimationFrame(() => requestAnimationFrame(decorateActive));
      setTimeout(decorateActive,120);
    },true);
    window.addEventListener('nexusnova:premium-ui-ready', () => {
      decorateKnownTabs();
      decorateActive();
    });
    [500,1500,3200,6500].forEach(ms => setTimeout(() => {
      decorateKnownTabs();
      decorateActive();
    },ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();