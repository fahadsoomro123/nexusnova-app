const STYLE_ID = 'nn-travel-phone-layout-v13';
const ROOT_SELECTOR = '.nn-travel-v19';
const LEGACY_STYLE_ID = 'nn-travel-host-guard-v8';

const SAFE_LEGACY_CSS = `
html.nn-travel-host-lock,html.nn-travel-host-lock body{width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}
html.nn-travel-host-lock .nx-app{width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;margin:0!important;overflow:hidden!important}
html.nn-travel-host-lock #nx-app>.nx-stage{position:fixed!important;inset:0!important;width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;scroll-padding:0!important;overflow:hidden!important}
html.nn-travel-host-lock .nx-screen.nn-travel-host-screen{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;overflow:hidden!important}
html.nn-travel-host-lock .nx-screen.nn-travel-host-screen>[data-app-mount]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
html.nn-travel-host-lock ${ROOT_SELECTOR}{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-host-lock ${ROOT_SELECTOR} .nn-travel-frame{top:0!important;left:0!important;right:0!important;bottom:auto!important;width:100%!important;height:var(--nn-v13-frame-height,var(--nn-v8-frame-height,calc(100% - 68px)))!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-keyboard-open #nx-app>.nx-dock{display:none!important}
`;

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app>.nx-stage,
html.nn-travel-v8-active body #nx-app>.nx-stage,
html.nn-travel-host-lock body #nx-app>.nx-stage{top:0!important;bottom:0!important;left:0!important;right:0!important;width:100%!important;height:auto!important;min-height:0!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app>.nx-dock,
html.nn-travel-v8-active body #nx-app>.nx-dock,
html.nn-travel-host-lock body #nx-app>.nx-dock{left:50%!important;right:auto!important;bottom:4px!important;width:min(calc(100% - 22px),520px)!important;margin:0!important;transform:translateX(-50%)!important;z-index:950!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-travel-frame,
html.nn-travel-host-lock body #nx-app ${ROOT_SELECTOR} .nn-travel-frame{height:var(--nn-v13-frame-height,var(--nn-v8-frame-height,calc(100% - 68px)))!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-travel-stage,
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-panel,
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-flight-panel{min-height:0!important;height:100%!important;max-height:none!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-flight-panel:not([hidden]){display:grid!important;grid-template-rows:clamp(104px,18vh,150px) minmax(0,1fr)!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card{align-self:stretch!important;min-height:0!important;height:100%!important;max-height:none!important;overflow-x:hidden!important;overflow-y:auto!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;gap:6px!important;padding:8px 8px 7px!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-trip-top{flex:0 0 auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-routes{flex:1 0 74px!important;min-height:74px!important;height:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-pair{flex:.82 0 48px!important;min-height:48px!important;height:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-filter-row{flex:.65 0 40px!important;min-height:40px!important;height:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-search-button{flex:.72 0 48px!important;min-height:48px!important;height:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>div:last-child{flex:.72 0 48px!important;min-height:48px!important;height:auto!important;display:grid!important;grid-template-rows:13px minmax(34px,1fr)!important;overflow:hidden!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-routes .nn-route,
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-pair .nn-control{height:100%!important;min-height:0!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-travel-frame,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-travel-frame{grid-template-rows:10vw 8.7vw minmax(0,1fr)!important;visibility:visible!important;pointer-events:auto!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-travel-head,
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-tab-dock,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-travel-head,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-tab-dock{display:grid!important;visibility:visible!important;opacity:1!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-hero,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-hero{display:block!important;visibility:visible!important;opacity:1!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-flight-panel:not([hidden]),
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-flight-panel:not([hidden]){display:grid!important;grid-template-rows:clamp(72px,14vh,104px) minmax(0,1fr)!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-search-card,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-search-card{display:flex!important;flex-direction:column!important;min-height:100%!important;height:100%!important;max-height:100%!important;overflow-y:auto!important;gap:5px!important;padding:7px!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-routes,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-routes{flex:0 0 74px!important;height:74px!important;min-height:74px!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-route,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-route{height:72px!important;min-height:72px!important}
html.nn-travel-v8-active body #nx-app ${ROOT_SELECTOR}.nn-travel-route-focus .nn-route input,
html.nn-travel-keyboard-open body #nx-app ${ROOT_SELECTOR} .nn-route input{width:64%!important;height:30px!important;min-height:30px!important;font-size:21px!important}
html body #nx-app ${ROOT_SELECTOR} .nn-route-editor-v8{display:none!important}
`;
  document.head.appendChild(style);
}

function neutralizeLegacy(){
  const legacy=document.getElementById(LEGACY_STYLE_ID);
  if(!(legacy instanceof HTMLStyleElement)) return;
  if(legacy.dataset.phoneLayoutV13==='true' && legacy.textContent===SAFE_LEGACY_CSS) return;
  legacy.dataset.phoneLayoutV13='true';
  legacy.textContent=SAFE_LEGACY_CSS;
}

function getDock(){
  return document.querySelector('#nx-app > .nx-dock') || document.querySelector('.nx-dock');
}

function editableIn(root){
  const active=document.activeElement;
  return active instanceof HTMLElement && root.contains(active) && active.matches('input,select,textarea,[contenteditable="true"]') ? active : null;
}

function correctRoot(root){
  if(!(root instanceof HTMLElement) || !root.isConnected) return;
  const active=editableIn(root);
  const layoutHeight=Math.max(1,Math.round(window.innerHeight||document.documentElement.clientHeight||root.getBoundingClientRect().height));
  const rawVisualHeight=Math.max(1,Math.round(window.visualViewport?.height||layoutHeight));
  const delta=layoutHeight-rawVisualHeight;
  const keyboardOpen=Boolean(active) && delta>=Math.max(110,Math.round(layoutHeight*.14));
  const rootRect=root.getBoundingClientRect();
  let targetBottom=keyboardOpen ? Math.max(rootRect.top+1,Math.round((window.visualViewport?.offsetTop||0)+rawVisualHeight)) : layoutHeight;
  const dock=getDock();
  if(!keyboardOpen && dock instanceof HTMLElement && getComputedStyle(dock).display!=='none') targetBottom=Math.min(targetBottom,Math.round(dock.getBoundingClientRect().top)-6);
  const frameHeight=Math.max(1,Math.floor(targetBottom-rootRect.top));
  root.style.setProperty('--nn-v13-frame-height',`${frameHeight}px`);
  root.style.setProperty('--nn-v8-frame-height',`${frameHeight}px`);
  root.style.setProperty('--nn-travel-frame-height',`${frameHeight}px`);
  root.dataset.v13KeyboardOpen=keyboardOpen?'true':'false';
  root.dataset.v13FrameHeight=String(frameHeight);
  root.dataset.v13LayoutHeight=String(layoutHeight);
  root.dataset.v13VisualHeight=String(rawVisualHeight);
  if(active?.closest('.nn-route')){
    requestAnimationFrame(()=>active.closest('.nn-route')?.scrollIntoView({block:'nearest',inline:'nearest'}));
  }
}

function schedule(root){
  correctRoot(root);
  requestAnimationFrame(()=>correctRoot(root));
  setTimeout(()=>correctRoot(root),60);
  setTimeout(()=>correctRoot(root),220);
}

function bind(root){
  if(!(root instanceof HTMLElement) || root.dataset.phoneLayoutV13==='true') return;
  root.dataset.phoneLayoutV13='true';
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
    root.style.removeProperty('--nn-v13-frame-height');
    previousCleanup?.();
  };
}

function scan(){
  neutralizeLegacy();
  document.querySelectorAll(ROOT_SELECTOR).forEach(bind);
}

installStyle();
scan();
new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
