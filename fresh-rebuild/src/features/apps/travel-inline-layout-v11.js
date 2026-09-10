const STYLE_ID = 'nn-travel-inline-layout-v11';
const ROOT = '.nn-travel-v19';

function install() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* Legacy host guard may mount after the flagship runtime. These selectors are
   intentionally stronger so inline editing and safe viewport behavior win
   without changing the rest of the Travel visual shell. */
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app>.nx-stage{
  left:0!important;right:0!important;top:max(0px,env(safe-area-inset-top))!important;bottom:0!important;
  width:100%!important;height:auto!important;min-height:0!important;padding:0!important;overflow:hidden!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app>.nx-dock{
  left:50%!important;right:auto!important;bottom:max(8px,var(--nx-safe-bottom))!important;
  width:min(calc(100% - 22px),520px)!important;margin:0!important;transform:translateX(-50%)!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-travel-frame{
  height:var(--nn-v8-frame-height,calc(100% - 68px))!important;overflow:hidden!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card{
  min-height:100%!important;height:100%!important;max-height:100%!important;
  display:flex!important;flex-direction:column!important;align-content:stretch!important;justify-content:space-between!important;
  grid-template-rows:none!important;gap:6px!important;padding-bottom:8px!important;
  overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;scrollbar-width:thin
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-trip-top{
  flex:0 0 auto!important;min-height:34px!important;height:auto!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-routes{
  flex:0 0 74px!important;min-height:74px!important;height:74px!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-pair{
  flex:0 0 48px!important;min-height:48px!important;height:48px!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-filter-row{
  flex:0 0 40px!important;min-height:40px!important;height:40px!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-search-button{
  flex:0 0 48px!important;min-height:48px!important;height:48px!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>div:last-child{
  flex:0 0 48px!important;min-height:48px!important;height:48px!important;
  display:grid!important;grid-template-rows:13px 35px!important;overflow:hidden!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-routes .nn-route{
  min-height:72px!important;height:100%!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-pair .nn-control{
  min-height:46px!important;height:100%!important
}
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card .nn-trust{
  min-height:34px!important;height:34px!important
}

/* Route focus/keyboard must keep the same Travel screen. No blank/fullscreen editor. */
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-travel-frame,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-frame{
  grid-template-rows:10vw 8.7vw minmax(0,1fr)!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-travel-head,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-head{
  display:grid!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-tab-dock,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-tab-dock{
  display:grid!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-hero,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-hero{
  display:block!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-flight-panel:not([hidden]),
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-flight-panel:not([hidden]){
  display:grid!important;grid-template-rows:clamp(90px,18vh,140px) minmax(0,1fr)!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-search-card,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-search-card{
  display:flex!important;flex-direction:column!important;grid-template-rows:none!important;
  overflow-y:auto!important;gap:6px!important;padding:8px 8px 7px!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-routes,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-routes{
  min-height:74px!important;height:74px!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-route,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route{
  min-height:72px!important;height:100%!important;padding:7px 8px!important
}
html.nn-travel-v8-active.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-route input,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route input{
  width:64%!important;height:30px!important;min-height:30px!important;font-size:21px!important
}

/* Tall phones get proportionally larger useful controls instead of one large
   dead block. The same content hierarchy remains intact. */
@media (min-height:1000px){
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-flight-panel:not([hidden]){
    grid-template-rows:clamp(250px,28vh,340px) minmax(0,1fr)!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-trip-top{
    flex-basis:50px!important;min-height:50px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-routes{
    flex-basis:150px!important;min-height:150px!important;height:150px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-pair{
    flex-basis:100px!important;min-height:100px!important;height:100px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-filter-row{
    flex-basis:64px!important;min-height:64px!important;height:64px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-search-button{
    flex-basis:64px!important;min-height:64px!important;height:64px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>div:last-child{
    flex-basis:70px!important;min-height:70px!important;height:70px!important;grid-template-rows:15px 55px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-routes .nn-route{
    min-height:146px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card>.nn-pair .nn-control{
    min-height:96px!important
  }
  html.nn-travel-v8-active.nn-travel-host-lock body #nx-app ${ROOT} .nn-search-card .nn-trust{
    min-height:54px!important;height:54px!important
  }
}
`;
  document.head.appendChild(style);
}

install();
