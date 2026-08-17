/* NexusNova two-tab render guard v1.3
   Final presentation guard only.
   - Physically renders exactly Mining + Nova Hub in the dock.
   - Keeps Wallet/Rewards/Market as one compact integrated Mining strip.
   - Removes over-branding from Mining while retaining one subtle section chip.
   - Normalizes the Speed Test launcher to the same clean Nova Hub icon family.
   - Keeps hidden/duplicate Nova Hub tiles physically hidden.
   No mining/reward/wallet/auth/Firebase value mutation.
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
      /* ----- Hard two-tab dock contract ----- */
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

      /* Old launcher CSS must never resurrect hidden duplicate tiles. */
      body #moreMenu .more-item[hidden],
      body #moreMenu .more-item[aria-hidden="true"]{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }

      /* ----- Mining: one calm identity, no branding clutter ----- */
      body #tab-home > .nx-brand-chip{
        margin:0 0 9px!important;
        padding:4px 8px 4px 5px!important;
        gap:6px!important;
        box-shadow:none!important;
        background:rgba(7,16,29,.72)!important;
        border-color:rgba(78,153,235,.19)!important;
      }
      body #tab-home > .nx-brand-chip .nx-brand-chip-logo{
        width:17px!important;height:17px!important;flex-basis:17px!important;
        border-radius:6px!important;font-size:8px!important;animation:none!important;box-shadow:none!important;
      }
      body #tab-home .nx-brand-mining-seal,
      body #tab-home .nx-brand-corner-watermark,
      body #tab-home > .nx-brand-footer{
        display:none!important;
      }
      body #mineBtn.nx-brand-mining-button::before,
      body #timer.nx-brand-mining-readout::before,
      body #tab-home .stat-card.nx-brand-mining-stat::before{
        content:none!important;
        display:none!important;
      }

      /* Mining essentials stay one slim integrated control strip. */
      body #nxHomeCoreAccess{margin:8px 0 10px!important;}
      body #nxHomeCoreAccess .nx-core-grid{padding:3px!important;border-radius:16px!important;}
      body #nxHomeCoreAccess .nx-core-card{
        min-height:48px!important;padding:3px 2px!important;gap:3px!important;
      }
      body #nxHomeCoreAccess .nx-core-icon{
        width:25px!important;height:25px!important;border-radius:8px!important;
      }
      body #nxHomeCoreAccess .nx-core-icon svg{width:14px!important;height:14px!important;}
      body #nxHomeCoreAccess .nx-core-copy b{font-size:8px!important;}
      body #nxHomeCoreAccess .nx-core-card:not(:last-child)::after{top:8px!important;bottom:8px!important;}

      /* ----- Speed Test launcher: premium but consistent, not oversized ----- */
      body #moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon{
        width:38px!important;
        height:38px!important;
        border-radius:12px!important;
        overflow:hidden!important;
        color:#68d8e6!important;
        background:linear-gradient(145deg,#0d1d2b,#0a1624)!important;
        border:1px solid rgba(88,204,224,.25)!important;
        box-shadow:none!important;
        animation:none!important;
        transform:none!important;
      }
      body #moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon::before,
      body #moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon::after{
        content:none!important;
        display:none!important;
      }
      body #moreMenu .more-item[data-nx-speedtest-v4="1"] .mi-icon svg{
        width:20px!important;
        height:20px!important;
        stroke:currentColor!important;
        stroke-width:1.8!important;
        filter:none!important;
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
    const mineButton = document.getElementById('mineBtn');
    if (!home || !panel || !mineButton || panel.parentElement !== home || mineButton.parentElement !== home) return false;
    /* A balance dashboard convention: essentials directly below the balance,
       then the primary Mining action. This guarantees the strip is never
       obscured by the fixed dock and keeps Mining visually dominant. */
    if (panel.nextElementSibling !== mineButton) home.insertBefore(panel, mineButton);
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

  window.NexusNovaTwoTabGuard = Object.freeze({version:'1.3.0',enforce,visibleTargets,positionCoreStrip});
})();