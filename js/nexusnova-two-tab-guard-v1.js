/* NexusNova two-tab render guard v1.2
   Navigation presentation only.
   Ensures the bottom dock physically renders Mining + Nova Hub and nothing else.
   Keeps the integrated Wallet/Rewards/Market strip clear of the fixed dock.
   Also guarantees DOM-hidden Nova Hub duplicates stay physically hidden even
   when older launcher CSS declares display:flex!important.
*/
(() => {
  'use strict';
  if (window.__nxTwoTabGuardV1) return;
  window.__nxTwoTabGuardV1 = true;

  const STYLE_ID = 'nxTwoTabGuardStyleV1';
  const AUX = new Set(['wallet','tasks','market']);
  const $ = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

  function targetOf(button) {
    if (!button) return '';
    if (button.id === 'moreBtn') return 'hub';
    const action = String(button.getAttribute('onclick') || '');
    const match = action.match(/switchTab\(\s*['"]([^'"]+)['"]/);
    return match?.[1] || '';
  }

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (style) return style;
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.nx-two-tab-shell .bottom-dock .dock-inner.nx-two-tab-dock
      > .dock-item[data-nx-dock-hidden="1"]{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
        width:0!important;
        min-width:0!important;
        max-width:0!important;
        padding:0!important;
        margin:0!important;
        overflow:hidden!important;
      }
      body.nx-two-tab-shell .bottom-dock .dock-inner.nx-two-tab-dock
      > .dock-item[data-nx-dock-primary]{
        display:flex!important;
        visibility:visible!important;
        pointer-events:auto!important;
      }
      body #moreMenu .more-item[hidden],
      body #moreMenu .more-item[aria-hidden="true"]{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  function hideAux(button) {
    if (!button) return;
    button.dataset.nxDockHidden = '1';
    button.hidden = true;
    button.setAttribute('aria-hidden','true');
    button.tabIndex = -1;
    button.classList.remove('active');
    button.style.setProperty('display','none','important');
    button.style.setProperty('visibility','hidden','important');
    button.style.setProperty('pointer-events','none','important');
  }

  function showPrimary(button, name) {
    if (!button) return;
    delete button.dataset.nxDockHidden;
    button.hidden = false;
    button.removeAttribute('aria-hidden');
    button.tabIndex = 0;
    button.dataset.nxDockPrimary = name;
    button.style.removeProperty('display');
    button.style.removeProperty('visibility');
    button.style.removeProperty('pointer-events');
  }

  function positionCoreStrip() {
    const home = document.getElementById('tab-home');
    const panel = document.getElementById('nxHomeCoreAccess');
    const stats = home?.querySelector('.stats-grid');
    if (!home || !panel || !stats || panel.parentElement !== home) return false;
    /* Keep essentials after the miner status but before stats. This keeps all
       three labels visible above the fixed two-tab dock on normal phone sizes. */
    if (panel.nextElementSibling !== stats) home.insertBefore(panel, stats);
    return true;
  }

  function enforce() {
    ensureStyle();
    const inner = $('.bottom-dock .dock-inner');
    if (!inner) return false;
    document.body?.classList.add('nx-two-tab-shell');
    inner.classList.add('nx-two-tab-dock');

    const items = qsa(':scope > .dock-item', inner);
    let mining = null;
    let hub = null;
    items.forEach(button => {
      const target = targetOf(button);
      if (target === 'home') mining = button;
      else if (target === 'hub') hub = button;
      else if (AUX.has(target)) hideAux(button);
      else if (button !== mining && button !== hub) hideAux(button);
    });

    showPrimary(mining,'mining');
    showPrimary(hub,'hub');
    positionCoreStrip();
    return Boolean(mining && hub);
  }

  function visibleTargets() {
    const inner = $('.bottom-dock .dock-inner');
    if (!inner) return [];
    return qsa(':scope > .dock-item',inner)
      .filter(node => {
        const cs = getComputedStyle(node);
        return !node.hidden && cs.display !== 'none' && cs.visibility !== 'hidden';
      })
      .map(targetOf);
  }

  let raf = 0;
  function queue() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; enforce(); });
  }

  function install() {
    enforce();
    const dock = $('.bottom-dock');
    if (dock) {
      const observer = new MutationObserver(queue);
      observer.observe(dock,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style','data-nx-dock-hidden']});
    }
    [100,300,700,1500,3000,6000].forEach(ms => setTimeout(enforce,ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.NexusNovaTwoTabGuard = Object.freeze({version:'1.2.0',enforce,visibleTargets,positionCoreStrip});
})();