// Compatibility entry retained because existing APK/OTA manifests still load v31.
// V32 remains the physical viewport engine. This bridge deliberately reports v31
// to legacy v28 code so that v28 delegates here instead of re-applying old geometry.
import './travel-phone-layout-v32.js?ota=travel-v32-proof38';

const COMPAT_STYLE_ID='nn-travel-phone-layout-v31';
const ROOT_SELECTOR='.nn-travel-v19';

function installCompatStyle(){
  if(document.getElementById(COMPAT_STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=COMPAT_STYLE_ID;
  style.textContent=`
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}{height:var(--nn-v38-content-h,calc(100dvh - 76px))!important}
html.nn-travel-v32-active body #nx-app ${ROOT_SELECTOR}::after{content:'OTA 38 • OWNER FIX'!important}
`;
  document.head.appendChild(style);
}

function isVisible(el){
  if(!(el instanceof HTMLElement)) return false;
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
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
  const viewportBottom=!keyboard&&isVisible(dock)
    ? Math.round(dock.getBoundingClientRect().top-8)
    : Math.round(visualTop+visualH-4);

  // Root is pinned to viewport top by V32, so subtracting root.getBoundingClientRect().top
  // creates the large false black gap seen on physical phones. Use the viewport bottom
  // directly as the content height and cap it to the layout viewport.
  const contentH=Math.max(360,Math.min(layoutH,viewportBottom));
  root.style.setProperty('--nn-v38-content-h',`${contentH}px`,'important');
  root.style.setProperty('height','var(--nn-v38-content-h)','important');
  root.style.setProperty('min-height','0','important');
  root.style.setProperty('--nn-v17-frame-height',`${contentH}px`,'important');
  root.style.setProperty('--nn-v8-frame-height',`${contentH}px`,'important');
  root.style.setProperty('--nn-travel-frame-height',`${contentH}px`,'important');

  const frame=root.querySelector('.nn-travel-frame');
  if(frame instanceof HTMLElement){
    frame.style.setProperty('height','100%','important');
    frame.style.setProperty('min-height','0','important');
    frame.style.setProperty('max-height','none','important');
  }

  // Remove the stale v28 inline stage offset that can survive from the first render.
  const stage=root.querySelector('.nn-travel-stage');
  if(stage instanceof HTMLElement){
    stage.style.setProperty('grid-row','auto','important');
    stage.style.setProperty('position','absolute','important');
    stage.style.setProperty('top','18.7vw','important');
    stage.style.setProperty('bottom','0','important');
    stage.style.setProperty('left','0','important');
    stage.style.setProperty('right','0','important');
    stage.style.setProperty('height','auto','important');
    stage.style.setProperty('min-height','0','important');
  }

  root.dataset.otaProof='38';
  root.dataset.v38ContentHeight=String(contentH);
  root.dataset.v38ViewportBottom=String(viewportBottom);
  root.dataset.v38LegacyFallbackBlocked='true';
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
