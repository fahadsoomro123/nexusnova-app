const STYLE_ID='nn-travel-phone-layout-v32';
const ROOT_SELECTOR='.nn-travel-v19';

window.NexusNovaTravelLayoutOwner='v32';

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
html.nn-travel-v32-active,html.nn-travel-v32-active body{width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app{width:100%!important;height:100dvh!important;min-height:0!important;margin:0!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app>.nx-stage{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app>.nx-dock{position:fixed!important;left:11px!important;right:11px!important;bottom:4px!important;width:auto!important;margin:0!important;transform:none!important;z-index:950!important}
html.nn-travel-v32-active .nx-screen.nn-travel-v32-screen{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;animation:none!important;transform:none!important}
html.nn-travel-v32-active .nx-screen.nn-travel-v32-screen>.nx-app-head{display:none!important}
html.nn-travel-v32-active .nx-screen.nn-travel-v32-screen>[data-app-mount]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:auto!important;width:100%!important;height:var(--nn-v32-content-h,calc(100dvh - 76px))!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR} .nn-travel-frame{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;overflow:hidden!important;display:grid!important;grid-template-rows:10vw 8.7vw minmax(0,1fr)!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR} .nn-travel-stage{grid-row:3!important;position:absolute!important;top:18.7vw!important;bottom:0!important;left:0!important;right:0!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden]){--nn-v32-hero:clamp(108px,17vh,150px);position:absolute!important;inset:4px 12px!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;display:block!important;overflow:hidden!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden])>.nn-hero{position:absolute!important;top:0!important;left:0!important;right:0!important;width:auto!important;height:var(--nn-v32-hero)!important;min-height:0!important;max-height:none!important;margin:0!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{position:absolute!important;top:var(--nn-v32-hero)!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;overflow-x:hidden!important;overflow-y:hidden!important;overscroll-behavior:none!important}
html.nn-travel-v32-keyboard body #nx-app>.nx-dock{display:none!important}
html.nn-travel-v32-keyboard body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden]){--nn-v32-hero:clamp(72px,13vh,96px)}
`;
  document.head.appendChild(s);
}

function isVisible(el){
  if(!(el instanceof HTMLElement))return false;
  const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
  return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;
}

function bind(root){
  if(!(root instanceof HTMLElement)||root.dataset.phoneLayoutV32==='true')return;
  root.dataset.phoneLayoutV32='true';
  const doc=document.documentElement;
  const screen=root.closest('.nx-screen');
  const visual=window.visualViewport;
  screen?.classList.add('nn-travel-v32-screen');
  let dead=false;
  let ro=null;

  const sync=()=>{
    if(dead||!root.isConnected)return;
    doc.classList.add('nn-travel-v32-active');
    const layoutH=Math.max(1,Math.round(window.innerHeight||document.documentElement.clientHeight||0));
    const visualH=Math.max(1,Math.round(visual?.height||layoutH));
    const visualTop=Math.max(0,Math.round(visual?.offsetTop||0));
    const focused=document.activeElement instanceof HTMLInputElement&&root.contains(document.activeElement);
    const keyboard=focused&&(layoutH-visualH>=Math.max(100,Math.round(layoutH*.13)));
    doc.classList.toggle('nn-travel-v32-keyboard',keyboard);
    const dock=document.querySelector('#nx-app>.nx-dock');
    const dockTop=!keyboard&&isVisible(dock)?Math.round(dock.getBoundingClientRect().top-8):Math.round(visualTop+visualH-4);
    const top=Math.max(0,Math.round(root.getBoundingClientRect().top));
    const contentH=Math.max(360,dockTop-top);
    root.style.setProperty('--nn-v32-content-h',`${contentH}px`);
    root.dataset.v32ContentHeight=String(contentH);
    root.dataset.v32DockTop=String(dockTop);
    root.dataset.v32LayoutHeight=String(layoutH);
  };
  const schedule=()=>{sync();requestAnimationFrame(sync);setTimeout(sync,80);setTimeout(sync,320);setTimeout(sync,900)};
  visual?.addEventListener('resize',schedule);
  visual?.addEventListener('scroll',schedule);
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  root.addEventListener('focusin',schedule,true);
  root.addEventListener('focusout',schedule,true);
  if('ResizeObserver'in window){ro=new ResizeObserver(schedule);const d=document.querySelector('#nx-app>.nx-dock');if(d instanceof HTMLElement)ro.observe(d);ro.observe(document.documentElement)}
  schedule();

  const old=root.__cleanup;
  root.__cleanup=()=>{
    if(dead)return;dead=true;ro?.disconnect();
    visual?.removeEventListener('resize',schedule);visual?.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',schedule);window.removeEventListener('orientationchange',schedule);
    root.removeEventListener('focusin',schedule,true);root.removeEventListener('focusout',schedule,true);
    root.style.removeProperty('--nn-v32-content-h');screen?.classList.remove('nn-travel-v32-screen');
    doc.classList.remove('nn-travel-v32-active','nn-travel-v32-keyboard');
    old?.();
  };
  window.NexusNovaTravelLayoutV32={sync};
}

function scan(){document.querySelectorAll(ROOT_SELECTOR).forEach(bind)}
installStyle();scan();new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});

// Preview-only flagship presentation layer. This branch keeps v32 as the single
// physical viewport owner while loading the visual system after all legacy
// Travel layout CSS, so it can remove scrolling without reviving v29-v31 hacks.
import('./travel-flagship-v5-preview.js').catch(error=>console.warn('[NexusNova Travel V5] preview layer skipped:',error));
