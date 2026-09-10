const STYLE_ID='nn-travel-phone-layout-v15';
const ROOT='.nn-travel-v19';
const LEGACY_STYLE_IDS=[
  'nn-travel-host-guard-v8',
  'nn-travel-inline-layout-v11',
  'nn-travel-phone-layout-v12',
  'nn-travel-phone-layout-v13',
  'nn-travel-phone-layout-v14'
];

function disableLegacyStyles(){
  for(const id of LEGACY_STYLE_IDS){
    const style=document.getElementById(id);
    if(style instanceof HTMLStyleElement) style.disabled=true;
  }
}

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html.nn-travel-v8-active,html.nn-travel-v8-active body{width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app{width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app>.nx-stage{position:fixed!important;inset:0!important;width:100%!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app>.nx-dock{left:50%!important;right:auto!important;bottom:4px!important;width:min(calc(100% - 22px),520px)!important;margin:0!important;transform:translateX(-50%)!important;z-index:950!important}
html.nn-travel-v15-keyboard body #nx-app>.nx-dock{display:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT}{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travel-frame{position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:auto!important;width:100%!important;height:var(--nn-v15-frame-height,calc(100% - 68px))!important;min-height:0!important;max-height:none!important;overflow:hidden!important;display:grid!important;grid-template-rows:10vw 8.7vw minmax(0,1fr)!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travel-stage{grid-row:3!important;position:relative!important;align-self:stretch!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden]){--nn-v15-hero-height:clamp(108px,17vh,150px);position:absolute!important;top:6px!important;bottom:6px!important;left:12px!important;right:12px!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;display:block!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden])>.nn-hero{position:absolute!important;top:0!important;left:0!important;right:0!important;width:auto!important;height:var(--nn-v15-hero-height)!important;min-height:0!important;max-height:none!important;margin:0!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{position:absolute!important;top:var(--nn-v15-hero-height)!important;bottom:0!important;left:0!important;right:0!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;overflow:hidden!important;display:grid!important;grid-template-rows:minmax(34px,.58fr) minmax(74px,1.04fr) minmax(48px,.8fr) minmax(48px,.8fr) minmax(40px,.66fr) minmax(48px,.78fr) minmax(48px,.78fr)!important;align-content:stretch!important;gap:6px!important;padding:8px 8px 7px!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-trip-top,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-routes,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-pair,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-filter-row,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-search-button,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>div:last-child{min-height:0!important;height:100%!important;max-height:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-routes .nn-route,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-pair .nn-control{min-height:0!important;height:100%!important;max-height:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>div:last-child{display:grid!important;grid-template-rows:13px minmax(34px,1fr)!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card .nn-trust{min-height:0!important;height:100%!important;max-height:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-button{display:grid!important;visibility:visible!important;opacity:1!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route-editor-v8{display:none!important}

html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-travel-frame,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-frame{grid-template-rows:10vw 8.7vw minmax(0,1fr)!important;visibility:visible!important;pointer-events:auto!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-travel-head,html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-tab-dock,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-head,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-tab-dock{display:grid!important;visibility:visible!important;opacity:1!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-hero,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-hero{display:block!important;visibility:visible!important;opacity:1!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden]),html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-panel.nn-flight-panel:not([hidden]){--nn-v15-hero-height:clamp(72px,13vh,96px)}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{overflow-y:auto!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;gap:5px!important;padding:7px!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-search-card>.nn-trip-top,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-search-card>.nn-trip-top{flex:0 0 34px!important;height:34px!important;min-height:34px!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-search-card>.nn-routes,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-search-card>.nn-routes{flex:0 0 74px!important;height:74px!important;min-height:74px!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-route,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route{height:72px!important;min-height:72px!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-route input,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route input{width:64%!important;height:30px!important;min-height:30px!important;font-size:21px!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-search-card>.nn-pair,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-search-card>.nn-pair{flex:0 0 48px!important;height:48px!important;min-height:48px!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-filter-row,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-filter-row{flex:0 0 40px!important;height:40px!important;min-height:40px!important}
html.nn-travel-v15-keyboard body #nx-app ${ROOT} .nn-search-button,html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-search-button{flex:0 0 48px!important;height:48px!important;min-height:48px!important}
@media(max-width:380px){html.nn-travel-v8-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden]){left:8px!important;right:8px!important}}
`;
  document.head.appendChild(style);
}

function dock(){return document.querySelector('#nx-app>.nx-dock')||document.querySelector('.nx-dock')}
function routeInput(root){
  const active=document.activeElement;
  return active instanceof HTMLInputElement&&root.contains(active)&&Boolean(active.closest('.nn-route'))?active:null;
}
function shown(el){
  if(!(el instanceof HTMLElement)) return false;
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
}
function applyGeometry(root){
  if(!(root instanceof HTMLElement)||!root.isConnected) return;
  disableLegacyStyles();
  const active=routeInput(root);
  const rootRect=root.getBoundingClientRect();
  const layoutHeight=Math.max(1,Math.round(window.innerHeight||document.documentElement.clientHeight||rootRect.height));
  const visualHeight=Math.max(1,Math.round(window.visualViewport?.height||layoutHeight));
  const visualTop=Math.max(0,Math.round(window.visualViewport?.offsetTop||0));
  const delta=layoutHeight-visualHeight;
  const keyboardOpen=Boolean(active)&&delta>=Math.max(120,Math.round(layoutHeight*.14));
  document.documentElement.classList.toggle('nn-travel-v15-keyboard',keyboardOpen);
  let targetBottom;
  const realDock=dock();
  if(keyboardOpen){
    targetBottom=Math.max(rootRect.top+1,visualTop+visualHeight);
  }else if(realDock instanceof HTMLElement&&shown(realDock)){
    targetBottom=Math.round(realDock.getBoundingClientRect().top)-6;
  }else{
    targetBottom=layoutHeight;
  }
  targetBottom=Math.max(rootRect.top+1,Math.min(layoutHeight,targetBottom));
  const frameHeight=Math.max(1,Math.floor(targetBottom-rootRect.top));
  for(const name of ['--nn-v15-frame-height','--nn-v14-frame-height','--nn-v13-frame-height','--nn-v8-frame-height','--nn-travel-frame-height']) root.style.setProperty(name,`${frameHeight}px`);
  root.dataset.v15KeyboardOpen=keyboardOpen?'true':'false';
  root.dataset.v15FrameHeight=String(frameHeight);
  root.dataset.v15TargetBottom=String(Math.round(targetBottom));
  root.dataset.v15LayoutHeight=String(layoutHeight);
  root.dataset.v15VisualHeight=String(visualHeight);
  const panel=root.querySelector('.nn-flight-panel:not([hidden])');
  const card=root.querySelector('.nn-search-card');
  const realDockRect=realDock instanceof HTMLElement&&shown(realDock)?realDock.getBoundingClientRect():null;
  if(panel instanceof HTMLElement) root.dataset.v15PanelBottom=String(Math.round(panel.getBoundingClientRect().bottom));
  if(card instanceof HTMLElement) root.dataset.v15CardBottom=String(Math.round(card.getBoundingClientRect().bottom));
  if(realDockRect) root.dataset.v15DockTop=String(Math.round(realDockRect.top));
  if(active) requestAnimationFrame(()=>active.closest('.nn-route')?.scrollIntoView({block:'nearest',inline:'nearest'}));
}
function schedule(root){
  applyGeometry(root);
  requestAnimationFrame(()=>applyGeometry(root));
  setTimeout(()=>applyGeometry(root),80);
  setTimeout(()=>applyGeometry(root),260);
  setTimeout(()=>applyGeometry(root),520);
  setTimeout(()=>applyGeometry(root),1000);
}
function bind(root){
  if(!(root instanceof HTMLElement)||root.dataset.phoneLayoutV15==='true') return;
  root.dataset.phoneLayoutV15='true';
  const run=()=>schedule(root);
  root.addEventListener('focusin',run,true);
  root.addEventListener('focusout',run,true);
  window.visualViewport?.addEventListener('resize',run);
  window.visualViewport?.addEventListener('scroll',run);
  window.addEventListener('resize',run);
  window.addEventListener('orientationchange',run);
  schedule(root);
  const previousCleanup=root.__cleanup;
  root.__cleanup=()=>{
    root.removeEventListener('focusin',run,true);
    root.removeEventListener('focusout',run,true);
    window.visualViewport?.removeEventListener('resize',run);
    window.visualViewport?.removeEventListener('scroll',run);
    window.removeEventListener('resize',run);
    window.removeEventListener('orientationchange',run);
    document.documentElement.classList.remove('nn-travel-v15-keyboard');
    root.style.removeProperty('--nn-v15-frame-height');
    previousCleanup?.();
  };
}
function scan(){
  disableLegacyStyles();
  document.querySelectorAll(ROOT).forEach(bind);
}
installStyle();
scan();
new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
