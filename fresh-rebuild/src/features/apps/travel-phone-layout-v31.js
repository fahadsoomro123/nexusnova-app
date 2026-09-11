// Compatibility entry retained because existing APK/OTA manifests still load v31.
// V32 remains the physical viewport engine. This bridge deliberately reports v31
// to legacy v28 code so that v28 delegates here instead of re-applying old geometry.
import './travel-phone-layout-v32.js?ota=travel-v32-proof39';

const COMPAT_STYLE_ID='nn-travel-phone-layout-v31';
const ROOT_SELECTOR='.nn-travel-v19';

function installCompatStyle(){
  let style=document.getElementById(COMPAT_STYLE_ID);
  if(!style){
    style=document.createElement('style');
    style.id=COMPAT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent=`
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}{height:var(--nn-v39-content-h,calc(100dvh - 76px))!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}::after{content:'OTA 39 • CARD FILL'!important}

/* Proof39 owns the final normal-phone flight geometry. The root/frame were already
   full height in proof38; the remaining black void came from the flight panel/card
   staying at their content-sized rectangle. Keep the approved control dimensions,
   but make the glass shell itself consume the complete stage down to the app dock. */
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden]){
  position:absolute!important;top:4px!important;bottom:4px!important;left:12px!important;right:12px!important;
  width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;
  display:block!important;overflow:hidden!important
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden])>.nn-hero{
  position:absolute!important;top:0!important;left:0!important;right:0!important;width:auto!important;
  height:var(--nn-v39-hero-h,clamp(108px,17vh,150px))!important;min-height:0!important;max-height:none!important;margin:0!important
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{
  position:absolute!important;top:var(--nn-v39-hero-h,clamp(108px,17vh,150px))!important;bottom:0!important;left:0!important;right:0!important;
  width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;
  display:grid!important;grid-template-rows:38px 82px 58px 58px 44px 52px 44px!important;
  align-content:start!important;gap:6px!important;padding:8px!important;overflow-x:hidden!important;overflow-y:auto!important;
  overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-trip-top,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-routes,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-pair,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-filter-row,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-search-button,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>div:last-child{
  min-height:0!important;height:100%!important;max-height:none!important;margin-top:0!important
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-routes .nn-route,
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-pair .nn-control{
  min-height:0!important;height:100%!important;max-height:none!important
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>.nn-search-button{
  display:grid!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;position:relative!important
}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-search-card>div:last-child{
  display:grid!important;grid-template-rows:13px minmax(31px,1fr)!important;overflow:hidden!important
}
@media(min-width:391px){
  html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}:not(.nn-v28-route-focus) .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{
    grid-template-rows:44px 92px 72px 72px 48px 58px 48px!important
  }
}
`;
}

function isVisible(el){
  if(!(el instanceof HTMLElement)) return false;
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
}

function setImportant(el,name,value){
  if(el instanceof HTMLElement) el.style.setProperty(name,value,'important');
}

function correctGeometry(root){
  if(!(root instanceof HTMLElement)||!root.isConnected) return;
  const layoutH=Math.max(1,Math.round(window.innerHeight||document.documentElement.clientHeight||0));
  const visual=window.visualViewport;
  const visualH=Math.max(1,Math.round(visual?.height||layoutH));
  const visualTop=Math.max(0,Math.round(visual?.offsetTop||0));
  const focused=document.activeElement instanceof HTMLInputElement&&root.contains(document.activeElement);
  const keyboard=focused&&(layoutH-visualH>=Math.max(100,Math.round(layoutH*.13)));
  const dock=document.querySelector('#nx-app>.nx-dock')||document.querySelector('.nx-dock');
  const dockTop=!keyboard&&isVisible(dock)
    ? Math.round(dock.getBoundingClientRect().top-8)
    : Math.round(visualTop+visualH-4);

  // Preserve proof38's root sizing because the physical screenshot proved the dock
  // itself is correctly pinned. Proof39 fixes the first descendants whose bottoms
  // were still hundreds of pixels above that dock.
  const contentH=Math.max(360,Math.min(layoutH,dockTop));
  root.style.setProperty('--nn-v39-content-h',`${contentH}px`,'important');
  root.style.setProperty('height','var(--nn-v39-content-h)','important');
  root.style.setProperty('min-height','0','important');
  root.style.setProperty('--nn-v17-frame-height',`${contentH}px`,'important');
  root.style.setProperty('--nn-v8-frame-height',`${contentH}px`,'important');
  root.style.setProperty('--nn-travel-frame-height',`${contentH}px`,'important');

  const frame=root.querySelector('.nn-travel-frame');
  if(frame instanceof HTMLElement){
    setImportant(frame,'position','absolute');
    setImportant(frame,'inset','0');
    setImportant(frame,'width','100%');
    setImportant(frame,'height','100%');
    setImportant(frame,'min-height','0');
    setImportant(frame,'max-height','none');
  }

  const rootRect=root.getBoundingClientRect();
  const tab=root.querySelector('.nn-tab-dock');
  const tabRect=tab instanceof HTMLElement?tab.getBoundingClientRect():null;
  const stageTop=Math.max(1,Math.round((tabRect?.bottom ?? (rootRect.top+rootRect.width*.187))-rootRect.top));
  const stage=root.querySelector('.nn-travel-stage');
  if(stage instanceof HTMLElement){
    setImportant(stage,'grid-row','auto');
    setImportant(stage,'position','absolute');
    setImportant(stage,'top',`${stageTop}px`);
    setImportant(stage,'bottom','0');
    setImportant(stage,'left','0');
    setImportant(stage,'right','0');
    setImportant(stage,'width','auto');
    setImportant(stage,'height','auto');
    setImportant(stage,'min-height','0');
    setImportant(stage,'max-height','none');
    setImportant(stage,'padding','0');
    setImportant(stage,'overflow','hidden');
  }

  if(!keyboard){
    const panel=root.querySelector('.nn-panel.nn-flight-panel:not([hidden])');
    const hero=panel?.querySelector(':scope > .nn-hero');
    const card=panel?.querySelector(':scope > .nn-search-card');
    const heroH=Math.round(Math.min(150,Math.max(108,layoutH*.17)));
    root.style.setProperty('--nn-v39-hero-h',`${heroH}px`,'important');

    if(panel instanceof HTMLElement){
      setImportant(panel,'position','absolute');
      setImportant(panel,'top','4px');
      setImportant(panel,'bottom','4px');
      setImportant(panel,'left','12px');
      setImportant(panel,'right','12px');
      setImportant(panel,'width','auto');
      setImportant(panel,'height','auto');
      setImportant(panel,'min-height','0');
      setImportant(panel,'max-height','none');
      setImportant(panel,'display','block');
      setImportant(panel,'overflow','hidden');
    }
    if(hero instanceof HTMLElement){
      setImportant(hero,'position','absolute');
      setImportant(hero,'top','0');
      setImportant(hero,'left','0');
      setImportant(hero,'right','0');
      setImportant(hero,'width','auto');
      setImportant(hero,'height',`${heroH}px`);
      setImportant(hero,'min-height','0');
      setImportant(hero,'max-height','none');
      setImportant(hero,'margin','0');
    }
    if(card instanceof HTMLElement){
      setImportant(card,'position','absolute');
      setImportant(card,'top',`${heroH}px`);
      setImportant(card,'bottom','0');
      setImportant(card,'left','0');
      setImportant(card,'right','0');
      setImportant(card,'width','auto');
      setImportant(card,'height','auto');
      setImportant(card,'min-height','0');
      setImportant(card,'max-height','none');
      setImportant(card,'margin','0');
    }

    // Store actual physical geometry after the forced layout. These values make a
    // future phone-only mismatch diagnosable without another guess-based patch.
    const frameRect=frame instanceof HTMLElement?frame.getBoundingClientRect():null;
    const stageRect=stage instanceof HTMLElement?stage.getBoundingClientRect():null;
    const panelRect=panel instanceof HTMLElement?panel.getBoundingClientRect():null;
    const cardRect=card instanceof HTMLElement?card.getBoundingClientRect():null;
    root.dataset.v39DockTop=String(dockTop);
    root.dataset.v39RootBottom=String(Math.round(root.getBoundingClientRect().bottom));
    if(frameRect) root.dataset.v39FrameBottom=String(Math.round(frameRect.bottom));
    if(stageRect) root.dataset.v39StageBottom=String(Math.round(stageRect.bottom));
    if(panelRect){
      root.dataset.v39PanelBottom=String(Math.round(panelRect.bottom));
      root.dataset.v39PanelGap=String(Math.round(dockTop-panelRect.bottom));
    }
    if(cardRect){
      root.dataset.v39CardBottom=String(Math.round(cardRect.bottom));
      root.dataset.v39CardGap=String(Math.round(dockTop-cardRect.bottom));
    }
  }

  root.dataset.otaProof='39';
  root.dataset.v39ContentHeight=String(contentH);
  root.dataset.v39StageTop=String(stageTop);
  root.dataset.v39Keyboard=keyboard?'true':'false';
  root.dataset.v39LegacyFallbackBlocked='true';
}

function sync(root){
  window.NexusNovaTravelLayoutV32?.sync?.(root);
  correctGeometry(root);
}

installCompatStyle();
window.NexusNovaTravelLayoutV31={sync};
// v28 only delegates when it sees v31. Keep the physical engine truth separately.
window.NexusNovaTravelLayoutOwner='v31';
window.NexusNovaTravelPhysicalLayoutOwner='v32';
window.NexusNovaTravelLayoutCompatStyleId=COMPAT_STYLE_ID;

function scan(){document.querySelectorAll(ROOT_SELECTOR).forEach(sync)}
function schedule(){scan();requestAnimationFrame(scan);setTimeout(scan,80);setTimeout(scan,320);setTimeout(scan,900)}
scan();
new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('resize',schedule);
window.addEventListener('orientationchange',schedule);
window.visualViewport?.addEventListener('resize',schedule);
window.visualViewport?.addEventListener('scroll',schedule);
