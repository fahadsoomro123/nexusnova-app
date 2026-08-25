/* NexusNova Nova Hub compact layout v1
   Presentation-only override for Nova Hub.
   - Keeps mining/session logic untouched.
   - Removes the oversized visible card box around hub icons.
   - Displays 68px icons inside a 74px transparent wrapper: exactly 3px per side.
   - Uses a denser responsive grid without changing any button target or handler.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubCompactLayoutV1) return;
  window.__nxNovaHubCompactLayoutV1 = true;
  window.nexusNovaHubCompactLayoutVersion = 'nova-hub-compact-layout-v1';

  const STYLE_ID = 'nxNovaHubCompactLayoutV1Style';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #moreMenu .more-inner[data-nx-compact-hub-grid="1"]{
        display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(82px,1fr))!important;
        gap:10px 8px!important;
        align-items:start!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] > [data-nx-hub-search-row="1"]{
        grid-column:1/-1!important;
        width:100%!important;
        min-width:0!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"]{
        min-width:0!important;
        min-height:0!important;
        height:auto!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:flex-start!important;
        gap:5px!important;
        padding:3px 1px 7px!important;
        margin:0!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        background-color:transparent!important;
        background-image:none!important;
        box-shadow:none!important;
        text-align:center!important;
        overflow:visible!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"]::before,
      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"]::after{
        content:none!important;
        display:none!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"] > .mi-icon{
        width:74px!important;
        height:74px!important;
        min-width:74px!important;
        min-height:74px!important;
        max-width:74px!important;
        max-height:74px!important;
        flex:0 0 74px!important;
        box-sizing:border-box!important;
        display:grid!important;
        place-items:center!important;
        margin:0 auto!important;
        padding:3px!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        background-color:transparent!important;
        background-image:none!important;
        box-shadow:none!important;
        overflow:visible!important;
        line-height:0!important;
        position:relative!important;
        inset:auto!important;
        transform:none!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"] > .mi-icon::before,
      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"] > .mi-icon::after{
        content:none!important;
        display:none!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"] .nx-hub-premium-icon{
        width:68px!important;
        height:68px!important;
        min-width:68px!important;
        min-height:68px!important;
        max-width:68px!important;
        max-height:68px!important;
        flex:0 0 68px!important;
        display:block!important;
        margin:0!important;
        padding:0!important;
        position:static!important;
        inset:auto!important;
        transform:none!important;
        overflow:visible!important;
        filter:drop-shadow(0 7px 9px rgba(0,0,0,.34)) drop-shadow(0 0 7px rgba(82,160,255,.12))!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"] > .nx-hub-title{
        display:block!important;
        width:100%!important;
        max-width:92px!important;
        min-height:22px!important;
        margin:0 auto!important;
        padding:0!important;
        color:#f7fbff!important;
        font-size:10px!important;
        font-weight:850!important;
        line-height:1.12!important;
        letter-spacing:0!important;
        text-align:center!important;
        white-space:normal!important;
        overflow-wrap:anywhere!important;
        position:static!important;
        transform:none!important;
      }

      #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"] > .nx-hub-extra-copy{
        display:none!important;
      }

      @media(max-width:380px){
        #moreMenu .more-inner[data-nx-compact-hub-grid="1"]{
          grid-template-columns:repeat(auto-fit,minmax(78px,1fr))!important;
          gap:9px 6px!important;
        }
        #moreMenu .more-inner[data-nx-compact-hub-grid="1"] .more-item[data-nx-premium-hub-card="1"] > .nx-hub-title{
          max-width:86px!important;
          font-size:9.5px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findSearch(inner) {
    return inner?.querySelector('#nxAllAppsSmartSearch,input[placeholder*="Search Nova Hub" i],input[placeholder*="Nova Hub" i]') || null;
  }

  function markSearchRow(inner) {
    const search = findSearch(inner);
    if (!search) return;
    let row = search;
    while (row.parentElement && row.parentElement !== inner) row = row.parentElement;
    if (row.parentElement === inner) row.dataset.nxHubSearchRow = '1';
  }

  function apply() {
    installStyle();
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner) return false;
    inner.dataset.nxCompactHubGrid = '1';
    markSearchRow(inner);
    return true;
  }

  function boot() {
    apply();
    [80,240,700,1500,3000].forEach(ms => setTimeout(apply, ms));
    const menu = document.getElementById('moreMenu');
    if (menu && !menu.__nxCompactLayoutObserverV1) {
      let queued = false;
      const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; apply(); });
      });
      observer.observe(menu, { childList:true, subtree:true });
      menu.__nxCompactLayoutObserverV1 = observer;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
