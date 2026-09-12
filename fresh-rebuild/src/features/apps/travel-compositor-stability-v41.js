// Travel V41 compositor stability fix.
// Phone diagnostics proved the Travel geometry already reaches the production dock.
// This module therefore does not alter viewport heights or card geometry. It removes
// expensive GPU promotion/backdrop effects that can produce oversized black paint
// tiles in Android WebView while preserving the approved gradients/shadows/controls.
const STYLE_ID='nn-travel-compositor-stability-v41';
const ROOT='.nn-travel-v19';

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html.nn-travel-v32-active body #nx-app>.nx-dock{
  -webkit-backdrop-filter:none!important;
  backdrop-filter:none!important;
  will-change:auto!important;
  filter:none!important;
  mix-blend-mode:normal!important;
  transform:none!important;
  -webkit-transform:none!important;
  transform-style:flat!important;
  background:linear-gradient(180deg,rgba(7,20,34,.995),rgba(4,14,24,.995))!important;
}

/* Keep the premium glass/3D paint, but stop pre-promoting every large tactile
   surface into its own perspective GPU layer on Android/coarse-pointer devices. */
@media (hover:none),(pointer:coarse){
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-search-card,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-route,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-control,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-filter,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-search-button,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-trip-mode{
    will-change:auto!important;
    transform-style:flat!important;
    perspective:none!important;
    -webkit-backface-visibility:visible!important;
    backface-visibility:visible!important;
  }

  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-route,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-control,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-filter,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-search-button,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-trip-mode{
    transform:translateY(-2px)!important;
    -webkit-transform:translateY(-2px)!important;
  }

  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-route:active,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-control:active,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-filter:active,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-search-button:active,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-trip-mode:active,
  html.nn-travel-v32-active body #nx-app ${ROOT} .nn-tactile-pressed{
    transform:translateY(2px) scale(.993)!important;
    -webkit-transform:translateY(2px) scale(.993)!important;
  }
}

/* Higher specificity than the retained Proof39 badge rule so a phone screenshot
   proves this exact compositor build is active without adding an interactive layer. */
html.nn-travel-v32-active body #nx-app ${ROOT}${ROOT}::after{
  content:'C41 • COMPOSITOR RESET'!important;
}
`;
  document.head.appendChild(style);
}

function mark(){
  const root=document.querySelector(ROOT);
  if(root instanceof HTMLElement){
    root.dataset.compositorStability='v41';
    const dock=document.querySelector('#nx-app>.nx-dock');
    if(dock instanceof HTMLElement) dock.dataset.travelCompositorStability='v41';
  }
}

installStyle();
mark();
const timer=setInterval(mark,1200);
window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
