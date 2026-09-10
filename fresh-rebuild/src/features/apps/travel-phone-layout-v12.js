const STYLE_ID = 'nn-travel-phone-layout-v12';
const LEGACY_STYLE_ID = 'nn-travel-host-guard-v8';
const ROOT = '.nn-travel-v19';

const SAFE_HOST_CSS = `
html.nn-travel-host-lock,html.nn-travel-host-lock body{
  width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important;
  overscroll-behavior:none!important;scroll-behavior:auto!important
}
html.nn-travel-host-lock .nx-app{
  width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
  margin:0!important;overflow:hidden!important
}
html.nn-travel-host-lock #nx-app>.nx-stage{
  position:fixed!important;inset:0!important;width:100%!important;height:auto!important;
  min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;
  scroll-padding:0!important;overflow:hidden!important;overscroll-behavior:none!important
}
html.nn-travel-host-lock .nx-screen.nn-travel-host-screen{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
  min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;overflow:hidden!important
}
html.nn-travel-host-lock .nx-screen.nn-travel-host-screen>[data-app-mount]{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
  min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important
}
html.nn-travel-host-lock ${ROOT}{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
  min-height:0!important;max-height:none!important;overflow:hidden!important
}
html.nn-travel-host-lock ${ROOT} .nn-travel-frame{
  top:0!important;left:0!important;right:0!important;bottom:auto!important;width:100%!important;
  height:var(--nn-v8-frame-height,calc(100% - 68px))!important;min-height:0!important;max-height:none!important;
  overflow:hidden!important
}
html.nn-travel-keyboard-open #nx-app>.nx-dock,
html.nn-travel-route-focus-open #nx-app>.nx-dock{display:none!important}
`;

function neutralizeLegacyHostStyle() {
  const legacy = document.getElementById(LEGACY_STYLE_ID);
  if (!(legacy instanceof HTMLStyleElement)) return;
  if (legacy.dataset.phoneLayoutV12 === 'true') return;
  legacy.dataset.phoneLayoutV12 = 'true';
  legacy.textContent = SAFE_HOST_CSS;
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* Android WebView already excludes the system status/navigation bars. Do not
   apply safe-area insets a second time. This selector intentionally matches
   the v11 host-lock specificity so the phone-safe values actually win. */
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app>.nx-stage,
html.nn-travel-v8-active body #nx-app>.nx-stage,
html.nn-travel-host-lock body #nx-app>.nx-stage{
  top:0!important;bottom:0!important;left:0!important;right:0!important;
  width:100%!important;height:auto!important;min-height:0!important;padding:0!important;overflow:hidden!important
}

/* Keep the real app dock compact and place it immediately above Android nav. */
html.nn-travel-v8-active.nn-travel-host-lock body #nx-app>.nx-dock,
html.nn-travel-v8-active body #nx-app>.nx-dock,
html.nn-travel-host-lock body #nx-app>.nx-dock{
  left:50%!important;right:auto!important;bottom:4px!important;
  width:min(calc(100% - 22px),520px)!important;margin:0!important;
  transform:translateX(-50%)!important;z-index:950!important
}

/* Route editing stays inside the existing From/To cards. Never collapse the
   Travel shell into a route-only strip when the keyboard opens. */
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-travel-frame,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-travel-frame,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-frame{
  visibility:visible!important;pointer-events:auto!important
}
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-travel-head,
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-tab-dock,
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-hero,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-travel-head,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-tab-dock,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-hero,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-travel-head,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-tab-dock,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-hero{
  display:grid!important;visibility:visible!important;opacity:1!important
}
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-hero,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-hero,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-hero{display:block!important}
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-flight-panel:not([hidden]),
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-flight-panel:not([hidden]),
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-flight-panel:not([hidden]){
  display:grid!important;grid-template-rows:clamp(86px,18vh,132px) minmax(0,1fr)!important;min-height:0!important
}
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-search-card,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-search-card,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-search-card{
  display:flex!important;flex-direction:column!important;grid-template-rows:none!important;
  min-height:100%!important;height:100%!important;max-height:100%!important;
  overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;
  gap:6px!important;padding:8px 8px 7px!important
}
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-routes,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-routes,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-routes{
  flex:0 0 74px!important;height:74px!important;min-height:74px!important
}
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-route,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-route,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route{
  height:72px!important;min-height:72px!important
}
html.nn-travel-keyboard-open body #nx-app ${ROOT} .nn-route input,
html.nn-travel-route-focus-open body #nx-app ${ROOT} .nn-route input,
html.nn-travel-v8-active body #nx-app ${ROOT}.nn-travel-route-focus .nn-route input{
  width:64%!important;height:30px!important;min-height:30px!important;font-size:21px!important
}

/* No special route editor overlay is allowed in v12. */
html body #nx-app ${ROOT} .nn-route-editor-v8{display:none!important}

/* Short phones keep useful controls reachable through the card's own scroll,
   instead of clipping them into a black area. */
@media(max-height:760px){
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-flight-panel:not([hidden]){
    grid-template-rows:84px minmax(0,1fr)!important
  }
  html.nn-travel-v8-active body #nx-app ${ROOT} .nn-search-card{
    overflow-y:auto!important;min-height:100%!important;height:100%!important
  }
}
`;
  document.head.appendChild(style);
}

function scan() {
  neutralizeLegacyHostStyle();
}

installStyle();
scan();
new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
