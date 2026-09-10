const STYLE_ID = 'nn-travel-flagship-runtime-v8';
const ROOT_SELECTOR = '.nn-travel-v19';

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html.nn-travel-v8-active,
html.nn-travel-v8-active body{
  width:100%!important;height:100%!important;min-height:0!important;
  overflow:hidden!important;overscroll-behavior:none!important
}
html.nn-travel-v8-active #nx-app,
html.nn-travel-v8-active .nx-app{
  width:100%!important;max-width:none!important;height:100%!important;min-height:0!important;
  margin:0!important;overflow:hidden!important
}
html.nn-travel-v8-active #nx-stage,
html.nn-travel-v8-active .nx-stage{
  position:fixed!important;left:0!important;right:0!important;
  top:max(0px,env(safe-area-inset-top))!important;bottom:0!important;
  width:100%!important;height:auto!important;min-height:0!important;
  margin:0!important;padding:0!important;overflow:hidden!important;scroll-padding:0!important
}
html.nn-travel-v8-active .nx-screen.nn-travel-v8-screen{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;
  margin:0!important;padding:0!important;overflow:hidden!important
}
html.nn-travel-v8-active .nx-screen.nn-travel-v8-screen>[data-app-mount]{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;
  margin:0!important;padding:0!important;overflow:hidden!important
}

/* Keep the app's original compact dock design. Travel only raises its stacking level. */
html.nn-travel-v8-active #nx-app>.nx-dock{z-index:950!important}
html.nn-travel-v8-active #nx-app>.nx-dock[hidden]{display:grid!important}
html.nn-travel-v8-active.nn-travel-v8-editing #nx-app>.nx-dock{display:none!important}

html.nn-travel-v8-active ${ROOT_SELECTOR}{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;
  max-width:none!important;overflow:hidden!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-travel-frame{
  position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:auto!important;
  width:100%!important;height:var(--nn-v8-frame-height,calc(100% - 68px))!important;min-height:0!important;
  max-height:none!important;overflow:hidden!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-travel-stage,
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-panel,
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-flight-panel{
  min-height:0!important;overflow:hidden!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-flight-panel:not([hidden]){
  grid-template-rows:clamp(96px,18vh,150px) minmax(0,1fr)!important
}

/* Use every available pixel. On short/keyboard viewports only the card itself scrolls. */
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card{
  min-height:100%!important;height:100%!important;max-height:100%!important;
  overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;
  display:flex!important;flex-direction:column!important;align-content:stretch!important;
  gap:6px!important;padding-bottom:8px!important;scrollbar-width:thin
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card>.nn-trip-top{
  flex:0 0 auto!important;min-height:0!important;height:auto!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card>.nn-routes{
  flex:1 0 74px!important;min-height:74px!important;height:auto!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card>.nn-pair{
  flex:.78 0 48px!important;min-height:48px!important;height:auto!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card>.nn-filter-row{
  flex:.58 0 40px!important;min-height:40px!important;height:auto!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card>.nn-search-button{
  flex:0 0 48px!important;min-height:48px!important;height:48px!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card>.nn-routes .nn-route{
  min-height:72px!important;height:100%!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-search-card>.nn-pair .nn-control{
  min-height:46px!important;height:100%!important
}

/* Inline route editing: From/To stay in their original boxes, never a fullscreen overlay. */
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-route-editor-v8{display:none!important}
html.nn-travel-v8-active ${ROOT_SELECTOR}.nn-v8-route-edit .nn-travel-frame{
  visibility:visible!important;pointer-events:auto!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR}.nn-v8-inline-edit .nn-route:focus-within{
  position:relative!important;z-index:5!important;
  border-color:#54dfff!important;box-shadow:0 0 0 1px rgba(84,223,255,.28),0 0 18px rgba(25,165,231,.18)!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-route input{
  min-width:0!important;min-height:30px!important
}

/* Full usable-height results with their own scrolling body. */
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results{
  position:absolute!important;z-index:1200!important;
  left:8px!important;right:8px!important;top:var(--nn-v8-results-top,78px)!important;
  bottom:var(--nn-v8-results-bottom,68px)!important;height:auto!important;min-height:0!important;
  max-height:none!important;border:1px solid #2e86b2!important;border-radius:22px!important;
  background:linear-gradient(180deg,#06243a 0%,#041827 45%,#020e18 100%)!important;
  box-shadow:0 20px 48px rgba(0,0,0,.72)!important;overflow:hidden!important;
  display:grid!important;grid-template-rows:56px minmax(0,1fr) auto!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results[hidden]{display:none!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results-head{
  height:56px!important;min-height:56px!important;padding:0 12px 0 14px!important;
  background:linear-gradient(180deg,rgba(10,49,76,.98),rgba(5,30,49,.96))!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results-head strong{font-size:14px!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results-head small{font-size:9px!important;margin-top:3px!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results-close{width:38px!important;height:38px!important;font-size:25px!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results-body{
  min-height:0!important;overflow-y:auto!important;padding:10px!important;overscroll-behavior:contain!important;
  scrollbar-width:thin
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-result{
  min-height:96px!important;border-radius:16px!important;grid-template-columns:48px minmax(0,1fr) auto!important;
  gap:10px!important;padding:11px!important;margin-bottom:9px!important;
  background:linear-gradient(110deg,#0a3a58,#072a42 58%,#052238)!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-logo{
  width:46px!important;height:46px!important;border-radius:12px!important;font-size:10px!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-result strong{font-size:12px!important;line-height:1.22!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-meta{font-size:9.5px!important;line-height:1.35!important;margin-top:4px!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-price{min-width:90px!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-live-chip{font-size:8px!important;padding:3px 6px!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-price strong{font-size:12px!important;margin-top:7px!important}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-empty{min-height:160px!important;font-size:11px!important}

html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results>.nn-filter-row{
  position:relative!important;z-index:1300!important;display:grid!important;grid-template-columns:repeat(4,1fr)!important;
  gap:7px!important;height:58px!important;min-height:58px!important;padding:8px!important;margin:0!important;
  border-top:1px solid rgba(53,135,176,.7)!important;
  background:linear-gradient(180deg,rgba(4,25,42,.98),rgba(2,14,24,.99))!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results>.nn-filter-row .nn-filter{
  min-width:0!important;height:42px!important;border-radius:15px!important;font-size:10.5px!important;gap:5px!important
}
html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results>.nn-filter-row .fi{font-size:17px!important}

@media(max-width:380px){
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-result{min-height:90px!important;grid-template-columns:43px minmax(0,1fr) auto!important;padding:9px!important;gap:8px!important}
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-logo{width:41px!important;height:41px!important}
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-result strong{font-size:11px!important}
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-meta{font-size:8.6px!important}
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-price{min-width:80px!important}
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-results>.nn-filter-row .nn-filter{font-size:9.5px!important}
}
@media(max-height:700px){
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-flight-panel:not([hidden]){grid-template-rows:90px minmax(0,1fr)!important}
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-hero-copy{top:10px!important}
  html.nn-travel-v8-active ${ROOT_SELECTOR} .nn-hero p{display:none!important}
}
`;
  document.head.appendChild(style);
}

function realDock() {
  return document.querySelector('#nx-app > .nx-dock') || document.querySelector('.nx-dock');
}

function isVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function bindRoot(root) {
  if (!(root instanceof HTMLElement) || root.dataset.flagshipRuntimeV8 === 'true') return;
  root.dataset.flagshipRuntimeV8 = 'true';
  root.dataset.routeEditingMode = 'inline';
  installStyle();

  const doc = document.documentElement;
  const screen = root.closest('.nx-screen');
  const results = root.querySelector('.nn-results');
  const filterRow = root.querySelector('.nn-filter-row');
  const visual = window.visualViewport;

  doc.classList.add('nn-travel-v8-active');
  screen?.classList.add('nn-travel-v8-screen');
  root.dataset.productionDockSelector = 'nx-dock';

  const filterMarker = document.createComment('nn-filter-v8-home');
  if (filterRow?.parentNode) filterRow.parentNode.insertBefore(filterMarker, filterRow);

  let editing = false;
  let disposed = false;
  let keyboardWasOpen = false;
  let editFallbackTimer = 0;
  let lastRouteInput = null;

  const restoreFilter = () => {
    if (filterRow && filterMarker.parentNode) filterMarker.parentNode.insertBefore(filterRow, filterMarker.nextSibling);
  };

  const setEditing = (next, sync = true) => {
    editing = Boolean(next);
    root.classList.toggle('nn-v8-inline-edit', editing);
    root.classList.remove('nn-v8-route-edit');
    doc.classList.toggle('nn-travel-v8-editing', editing);
    if (!editing) lastRouteInput = null;
    if (sync) syncLayout();
  };

  const syncResultsFilter = () => {
    if (!(results instanceof HTMLElement) || !(filterRow instanceof HTMLElement)) return;
    if (!results.hidden) {
      if (filterRow.parentNode !== results) results.appendChild(filterRow);
      root.classList.add('nn-v8-results-open');
    } else {
      restoreFilter();
      root.classList.remove('nn-v8-results-open');
    }
  };

  const syncLayout = () => {
    if (disposed || !root.isConnected) return;
    const rootRect = root.getBoundingClientRect();
    const layoutHeight = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || rootRect.height));
    const visibleHeight = Math.max(1, Math.round(visual?.height || layoutHeight));
    const visibleTop = Math.max(0, Math.round(visual?.offsetTop || 0));
    const visibleBottom = visibleTop + Math.min(layoutHeight, visibleHeight);
    const keyboardOpen = layoutHeight - visibleHeight > 120;
    if (keyboardOpen) keyboardWasOpen = true;
    if (!keyboardOpen && keyboardWasOpen && editing) {
      keyboardWasOpen = false;
      setEditing(false, false);
    }

    const dock = realDock();
    const dockVisible = !keyboardOpen && isVisible(dock);
    const dockTop = dockVisible ? dock.getBoundingClientRect().top : visibleBottom;
    const targetBottom = dockVisible ? Math.min(visibleBottom, dockTop - 6) : visibleBottom;
    const frameHeight = Math.max(1, Math.floor(targetBottom - rootRect.top));
    root.style.setProperty('--nn-v8-frame-height', `${frameHeight}px`);

    const topDock = root.querySelector('.nn-tab-dock');
    const head = root.querySelector('.nn-travel-head');
    const top = Math.max(
      8,
      Math.round((head?.getBoundingClientRect().bottom || rootRect.top) - rootRect.top + (topDock?.getBoundingClientRect().height || 0) + 6)
    );
    root.style.setProperty('--nn-v8-results-top', `${top}px`);
    const bottomReserve = dockVisible ? Math.max(8, Math.round(visibleBottom - dockTop + 6)) : 8;
    root.style.setProperty('--nn-v8-results-bottom', `${bottomReserve}px`);
    root.dataset.v8FrameHeight = String(frameHeight);
    root.dataset.v8DockVisible = dockVisible ? 'true' : 'false';
    root.dataset.v8KeyboardOpen = keyboardOpen ? 'true' : 'false';
    root.dataset.v8VisibleHeight = String(Math.round(Math.max(1, visibleBottom - rootRect.top)));
    root.dataset.v8RootBottom = String(Math.round(rootRect.bottom));
    root.dataset.v8TargetBottom = String(Math.round(targetBottom));

    const scroller = document.scrollingElement;
    if (scroller) scroller.scrollTop = 0;
    const stage = root.closest('.nx-stage');
    if (stage instanceof HTMLElement) stage.scrollTop = 0;
  };

  root.addEventListener('focusin', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.closest('.nn-route')) return;
    const firstFocus = lastRouteInput !== input;
    lastRouteInput = input;
    setEditing(true, false);
    clearTimeout(editFallbackTimer);
    editFallbackTimer = window.setTimeout(() => {
      const layoutHeight = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight));
      const visibleHeight = Math.max(1, Math.round(visual?.height || layoutHeight));
      if (layoutHeight - visibleHeight <= 120) setEditing(false);
    }, 700);
    requestAnimationFrame(() => {
      if (firstFocus && document.activeElement === input) {
        try { input.select(); } catch {}
      }
      const route = input.closest('.nn-route');
      route?.scrollIntoView({block:'nearest',inline:'nearest'});
      syncLayout();
    });
  });

  root.addEventListener('focusout', () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && root.contains(active) && active.closest('.nn-route')) return;
      const layoutHeight = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight));
      const visibleHeight = Math.max(1, Math.round(visual?.height || layoutHeight));
      if (layoutHeight - visibleHeight <= 120) setEditing(false);
    }, 80);
  });

  const resultsObserver = results instanceof HTMLElement ? new MutationObserver(() => {
    syncResultsFilter();
    syncLayout();
  }) : null;
  if (results instanceof HTMLElement) resultsObserver?.observe(results, {attributes:true, attributeFilter:['hidden']});

  visual?.addEventListener('resize', syncLayout);
  visual?.addEventListener('scroll', syncLayout);
  window.addEventListener('resize', syncLayout);
  window.addEventListener('orientationchange', syncLayout);

  syncResultsFilter();
  requestAnimationFrame(() => requestAnimationFrame(syncLayout));
  setTimeout(syncLayout, 120);
  setTimeout(syncLayout, 420);
  setTimeout(syncLayout, 900);

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(editFallbackTimer);
    resultsObserver?.disconnect();
    visual?.removeEventListener('resize', syncLayout);
    visual?.removeEventListener('scroll', syncLayout);
    window.removeEventListener('resize', syncLayout);
    window.removeEventListener('orientationchange', syncLayout);
    restoreFilter();
    root.classList.remove('nn-v8-results-open','nn-v8-route-edit','nn-v8-inline-edit');
    root.style.removeProperty('--nn-v8-frame-height');
    root.style.removeProperty('--nn-v8-results-top');
    root.style.removeProperty('--nn-v8-results-bottom');
    screen?.classList.remove('nn-travel-v8-screen');
    doc.classList.remove('nn-travel-v8-active','nn-travel-v8-editing');
    previousCleanup?.();
  };
}

function scan() {
  document.querySelectorAll(ROOT_SELECTOR).forEach(bindRoot);
}

installStyle();
scan();
const observer = new MutationObserver(scan);
observer.observe(document.documentElement, {subtree:true, childList:true});
