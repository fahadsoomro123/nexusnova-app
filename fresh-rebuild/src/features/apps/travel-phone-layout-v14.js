const STYLE_ID='nn-travel-phone-layout-v14';
const ROOT='.nn-travel-v19';
const LEGACY_STYLE_IDS=[
  'nn-travel-host-guard-v8',
  'nn-travel-inline-layout-v11',
  'nn-travel-phone-layout-v12',
  'nn-travel-phone-layout-v13'
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
html.nn-travel-v14-keyboard body #nx-app>.nx-dock{display:none!important}
html.nn-travel-v8-active body #nx-app ${ROOT}{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travel-frame{position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:auto!important;width:100%!important;height:var(--nn-v14-frame-height,calc(100% - 68px))!important;min-height:0!important;max-height:none!important;overflow:hidden!important;display:grid!important;grid-template-rows:10vw 8.7vw minmax(0,1fr)!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-travel-stage{grid-row:3!important;position:relative!important;align-self:stretch!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden]){position:absolute!important;top:6px!important;bottom:6px!important;left:12px!important;right:12px!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;display:grid!important;grid-template-rows:clamp(96px,18vh,150px) minmax(0,1fr)!important;gap:0!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card{align-self:stretch!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;gap:6px!important;padding:8px 8px 7px!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-trip-top{flex:0 0 34px!important;min-height:34px!important;height:34px!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-routes{flex:1 0 74px!important;min-height:74px!important;height:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-pair{flex:.82 0 48px!important;min-height:48px!important;height:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-filter-row{flex:.64 0 40px!important;min-height:40px!important;height:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-search-button{flex:.72 0 48px!important;min-height:48px!important;height:auto!important;display:grid!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>div:last-child{flex:.68 0 48px!important;min-height:48px!important;height:auto!important;display:grid!important;grid-template-rows:13px minmax(34px,1fr)!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-routes .nn-route,html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card>.nn-pair .nn-control{height:100%!important;min-height:0!important}
html.nn-travel-v8-active body #nx-app ${ROOT} .nn-route-editor-v8{display:none!important}

html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-travel-frame,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-frame{grid-template-rows:10vw 8.7vw minmax(0,1fr)!important;visibility:visible!important;pointer-events:auto!important}
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-travel-head,
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-tab-dock,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-head,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-tab-dock{display:grid!important;visibility:visible!important;opacity:1!important}
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-hero,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-hero{display:block!important;visibility:visible!important;opacity:1!important}
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden]),
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-panel.nn-flight-panel:not([hidden]){grid-template-rows:clamp(72px,14vh,104px) minmax(0,1fr)!important}
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-search-card,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-search-card{min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;display:flex!important;flex-direction:column!important;gap:5px!important;padding:7px!important}
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-routes,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-routes{flex:0 0 74px!important;height:74px!important;min-height:74px!important}
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-route,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route{height:72px!important;min-height:72px!important}
html.nn-travel-v14-keyboard body #nx-app ${ROOT} .nn-route input,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route input{width:64%!important;height:30px!important;min-height:30px!important;font-size:21px!important}
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
  document.documentElement.classList.toggle('nn-travel-v14-keyboard',keyboardOpen);
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
  for(const name of ['--nn-v14-frame-height','--nn-v13-frame-height','--nn-v8-frame-height','--nn-travel-frame-height']) root.style.setProperty(name,`${frameHeight}px`);
  root.dataset.v14KeyboardOpen=keyboardOpen?'true':'false';
  root.dataset.v14FrameHeight=String(frameHeight);
  root.dataset.v14TargetBottom=String(Math.round(targetBottom));
  root.dataset.v14LayoutHeight=String(layoutHeight);
  root.dataset.v14VisualHeight=String(visualHeight);
  const panel=root.querySelector('.nn-flight-panel:not([hidden])');
  const card=root.querySelector('.nn-search-card');
  if(panel instanceof HTMLElement) root.dataset.v14PanelBottom=String(Math.round(panel.getBoundingClientRect().bottom));
  if(card instanceof HTMLElement) root.dataset.v14CardBottom=String(Math.round(card.getBoundingClientRect().bottom));
  if(active) requestAnimationFrame(()=>active.closest('.nn-route')?.scrollIntoView({block:'nearest',inline:'nearest'}));
}
function schedule(root){
  applyGeometry(root);
  requestAnimationFrame(()=>applyGeometry(root));
  setTimeout(()=>applyGeometry(root),80);
  setTimeout(()=>applyGeometry(root),260);
  setTimeout(()=>applyGeometry(root),520);
}
function bind(root){
  if(!(root instanceof HTMLElement)||root.dataset.phoneLayoutV14==='true') return;
  root.dataset.phoneLayoutV14='true';
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
    document.documentElement.classList.remove('nn-travel-v14-keyboard');
    for(const name of ['--nn-v14-frame-height']) root.style.removeProperty(name);
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
