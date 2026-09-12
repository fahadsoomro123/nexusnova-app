// Travel V42 lower-controls overlay unmask.
// Phone geometry diagnostics proved the Travel card/panel already extend to the dock.
// This fix therefore leaves all viewport sizing alone. It only prevents decorative
// masks/overlays from painting above or intercepting the lower Search Flights controls.
const STYLE_ID='nn-travel-overlay-unmask-v42';
const ROOT='.nn-travel-v19';

function installStyle(){
  let style=document.getElementById(STYLE_ID);
  if(!style){
    style=document.createElement('style');
    style.id=STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent=`
/* Decorative pseudo layers in the Travel shell must never become a black/touch mask. */
html.nn-travel-v32-active body::after,
html.nn-travel-v32-active body #nx-app::after,
html.nn-travel-v32-active body #nx-app>.nx-stage::after,
html.nn-travel-v32-active .nx-screen.nn-travel-v32-screen::after,
html.nn-travel-v32-active .nx-screen.nn-travel-v32-screen>[data-app-mount]::after,
html.nn-travel-v32-active body #nx-app ${ROOT}::before,
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-travel-frame::before,
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-travel-frame::after,
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-travel-stage::before,
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-travel-stage::after,
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden])::before,
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden])::after,
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-search-card::after{
  pointer-events:none!important;
  background:transparent!important;
  background-image:none!important;
  box-shadow:none!important;
  filter:none!important;
}

/* Keep the real Travel surface and controls above any retained decorative shell paint. */
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-travel-stage{
  z-index:20!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden]){
  z-index:30!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{
  z-index:40!important;
  isolation:isolate!important;
  pointer-events:auto!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-search-card>.nn-search-button{
  z-index:600!important;
  pointer-events:auto!important;
  touch-action:manipulation!important;
  visibility:visible!important;
  opacity:1!important;
}
html.nn-travel-v32-active body #nx-app ${ROOT} .nn-search-card>.nn-search-button *{
  pointer-events:none!important;
}
html.nn-travel-v32-active body #nx-app>.nx-dock{
  z-index:950!important;
}

/* Phone-visible proof only; pointer-events stays off. */
html.nn-travel-v32-active body #nx-app ${ROOT}${ROOT}::after{
  content:'C42 • OVERLAY OFF'!important;
  pointer-events:none!important;
}
`;
}

function setImportant(el,name,value){
  if(el instanceof HTMLElement) el.style.setProperty(name,value,'important');
}

function protectedElement(el,root,card,button,dock){
  if(!(el instanceof HTMLElement)) return true;
  if(el===document.documentElement||el===document.body) return true;
  if(el===button||button.contains(el)) return true;
  if(el===card||card.contains(el)) return true;
  if(el===root||el.contains(root)) return true;
  if(root.contains(el) && (el.matches('.nn-travel-frame,.nn-travel-stage,.nn-panel.nn-flight-panel,.nn-hero,.nn-tab-dock,.nn-travel-head'))) return true;
  if(el===dock||dock?.contains(el)) return true;
  if(el.id==='nx-app'||el.id==='nx-stage'||el.matches('.nx-screen,[data-app-mount]')) return true;
  return false;
}

function neutralizeBlockers(root){
  if(!(root instanceof HTMLElement)||!root.isConnected) return;
  const card=root.querySelector('.nn-search-card');
  const button=root.querySelector('.nn-search-button');
  const dock=document.querySelector('#nx-app>.nx-dock');
  if(!(card instanceof HTMLElement)||!(button instanceof HTMLElement)) return;

  // Always restore direct touchability on the actual CTA.
  setImportant(button,'pointer-events','auto');
  setImportant(button,'visibility','visible');
  setImportant(button,'opacity','1');
  setImportant(button,'z-index','600');

  const br=button.getBoundingClientRect();
  if(br.width<4||br.height<4) return;
  const points=[
    [Math.round(br.left+br.width*.5),Math.round(br.top+Math.min(br.height*.5,20))],
    [Math.round(br.left+br.width*.5),Math.round(br.bottom-Math.min(5,br.height*.12))]
  ];
  const rr=root.getBoundingClientRect();
  let neutralized=0;

  for(const [x,y] of points){
    const stack=document.elementsFromPoint(x,y);
    const buttonIndex=stack.indexOf(button);
    const candidates=buttonIndex>=0?stack.slice(0,buttonIndex):stack;
    for(const el of candidates){
      if(!(el instanceof HTMLElement)||protectedElement(el,root,card,button,dock)) continue;
      const r=el.getBoundingClientRect();
      if(r.width<4||r.height<4) continue;
      const coversPoint=x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
      if(!coversPoint) continue;

      // Any layer sitting above the CTA must not eat the tap.
      setImportant(el,'pointer-events','none');
      el.dataset.nnV42TouchBlocker='disabled';

      // If it is a large overlay/mask, also make the black paint transparent.
      const name=`${el.id} ${el.className}`;
      const hinted=/(overlay|mask|backdrop|scrim|shade|curtain|guard|veil|cover)/i.test(name);
      const large=r.width>=rr.width*.55&&r.height>=Math.max(70,rr.height*.16);
      if(hinted||large){
        setImportant(el,'background','transparent');
        setImportant(el,'background-image','none');
        setImportant(el,'box-shadow','none');
        setImportant(el,'filter','none');
        el.dataset.nnV42PaintBlocker='transparent';
      }
      neutralized++;
    }
  }

  root.dataset.overlayUnmask='v42';
  root.dataset.v42Blockers=String(neutralized);
}

function scan(){
  document.querySelectorAll(ROOT).forEach(root=>neutralizeBlockers(root));
}

installStyle();
scan();
requestAnimationFrame(scan);
setTimeout(scan,120);
setTimeout(scan,500);
const timer=setInterval(scan,900);
window.addEventListener('resize',scan);
window.addEventListener('orientationchange',scan);
window.visualViewport?.addEventListener('resize',scan);
window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
