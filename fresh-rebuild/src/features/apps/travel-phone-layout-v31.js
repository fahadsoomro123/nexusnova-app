const STYLE_ID = 'nn-travel-phone-layout-v31';
const ROOT_SELECTOR = '.nn-travel-v19';

// Public marker used by late-loaded integrations to avoid introducing another
// effective viewport owner. Older runtimes may still manage interactions/results,
// but V31's private variables are the sole source of frame geometry.
window.NexusNovaTravelLayoutOwner = 'v31';

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html.nn-travel-v31-active,html.nn-travel-v31-active body{
  width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important
}
html.nn-travel-v31-active body #nx-app{
  width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important
}
html.nn-travel-v31-active body #nx-app>.nx-stage{
  position:fixed!important;inset:0!important;width:100%!important;height:auto!important;
  min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important
}
html.nn-travel-v31-active body #nx-app>.nx-dock{
  position:fixed!important;left:11px!important;right:11px!important;bottom:4px!important;
  width:auto!important;margin:0!important;transform:none!important;z-index:950!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR}{
  position:absolute!important;inset:0!important;width:100%!important;
  height:var(--nn-v30-root-height,100%)!important;min-height:0!important;
  max-height:none!important;overflow:hidden!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-travel-frame{
  position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:auto!important;
  width:100%!important;height:var(--nn-v30-frame-height,calc(100% - 68px))!important;
  min-height:0!important;max-height:none!important;overflow:hidden!important;
  display:grid!important;grid-template-rows:10vw 8.7vw minmax(0,1fr)!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-travel-stage{
  grid-row:3!important;position:absolute!important;top:18.7vw!important;bottom:0!important;left:0!important;right:0!important;
  align-self:stretch!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;overflow:hidden!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden]){
  --nn-v30-hero-height:clamp(108px,17vh,150px);position:absolute!important;
  top:4px!important;bottom:4px!important;left:12px!important;right:12px!important;
  width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;
  display:block!important;overflow:hidden!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden])>.nn-hero{
  position:absolute!important;top:0!important;left:0!important;right:0!important;
  width:auto!important;height:var(--nn-v30-hero-height)!important;min-height:0!important;max-height:none!important;margin:0!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden])>.nn-search-card{
  position:absolute!important;top:var(--nn-v30-hero-height)!important;bottom:0!important;
  left:0!important;right:0!important;width:auto!important;height:auto!important;
  min-height:0!important;max-height:none!important;margin:0!important;overflow-x:hidden!important;overflow-y:auto!important;
  display:grid!important;grid-template-rows:minmax(34px,.58fr) minmax(74px,1.08fr) minmax(48px,.8fr) minmax(48px,.8fr) minmax(40px,.66fr) minmax(48px,.78fr) minmax(48px,.78fr)!important;
  align-content:stretch!important;gap:6px!important;padding:8px 8px 7px!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-trip-top,
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-routes,
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-pair,
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-filter-row,
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-search-button,
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>div:last-child{
  min-height:0!important;height:100%!important;max-height:none!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-routes .nn-route,
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>.nn-pair .nn-control{
  min-height:0!important;height:100%!important;max-height:none!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card>div:last-child{
  display:grid!important;grid-template-rows:13px minmax(34px,1fr)!important;overflow:hidden!important
}
html.nn-travel-v31-active body #nx-app ${ROOT_SELECTOR} .nn-search-card .nn-trust{
  min-height:0!important;height:100%!important;max-height:none!important
}
html.nn-travel-v31-keyboard body #nx-app>.nx-dock{display:none!important}
html.nn-travel-v31-keyboard body #nx-app ${ROOT_SELECTOR} .nn-travel-frame{
  grid-template-rows:10vw 8.7vw minmax(0,1fr)!important;visibility:visible!important;pointer-events:auto!important
}
html.nn-travel-v31-keyboard body #nx-app ${ROOT_SELECTOR} .nn-travel-head,
html.nn-travel-v31-keyboard body #nx-app ${ROOT_SELECTOR} .nn-tab-dock{
  display:grid!important;visibility:visible!important;opacity:1!important
}
html.nn-travel-v31-keyboard body #nx-app ${ROOT_SELECTOR} .nn-hero{
  display:block!important;visibility:visible!important;opacity:1!important
}
html.nn-travel-v31-keyboard body #nx-app ${ROOT_SELECTOR} .nn-panel.nn-flight-panel:not([hidden]){
  --nn-v30-hero-height:clamp(72px,13vh,96px)
}
`;
  document.head.appendChild(style);
}

function visible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function routeInput(root) {
  const active = document.activeElement;
  return active instanceof HTMLInputElement && root.contains(active) && active.closest('.nn-route') ? active : null;
}

function bind(root) {
  if (!(root instanceof HTMLElement) || root.dataset.phoneLayoutV31 === 'true') return;
  root.dataset.phoneLayoutV31 = 'true';
  const doc = document.documentElement;
  const visual = window.visualViewport;
  let disposed = false;
  let resizeObserver = null;

  const sync = () => {
    if (disposed || !root.isConnected) return;
    doc.classList.add('nn-travel-v31-active');

    const rootTop = Math.max(0, Math.round(root.getBoundingClientRect().top));
    const layoutHeight = Math.max(
      1,
      Math.round(window.innerHeight || 0),
      Math.round(document.documentElement.clientHeight || 0)
    );
    const visualHeight = Math.max(1, Math.round(visual?.height || layoutHeight));
    const visualTop = Math.max(0, Math.round(visual?.offsetTop || 0));
    const active = routeInput(root);
    const keyboardOpen = Boolean(active) && layoutHeight - visualHeight >= Math.max(100, Math.round(layoutHeight * .13));
    doc.classList.toggle('nn-travel-v31-keyboard', keyboardOpen);

    let targetBottom;
    if (keyboardOpen) {
      targetBottom = visualTop + visualHeight - 4;
    } else {
      const dock = document.querySelector('#nx-app>.nx-dock') || document.querySelector('.nx-dock');
      const dockRect = visible(dock) ? dock.getBoundingClientRect() : null;
      // The visible dock's live top edge is the only exact content boundary.
      // This remains correct across 3-button/gesture navigation, cutouts and
      // vendor WebViews that report a stale innerHeight (notably XOS/Android 11).
      targetBottom = dockRect
        ? Math.round(dockRect.top - 10)
        : Math.round(visualTop + visualHeight - 68);
    }

    targetBottom = Math.max(rootTop + 320, Math.round(targetBottom));
    const frameHeight = Math.max(1, targetBottom - rootTop);
    root.style.setProperty('--nn-v30-frame-height', `${frameHeight}px`);
    root.style.setProperty('--nn-v30-root-height', `${Math.max(frameHeight, layoutHeight - rootTop)}px`);
    root.dataset.v31FrameHeight = String(frameHeight);
    root.dataset.v31TargetBottom = String(targetBottom);
    root.dataset.v30LayoutHeight = String(layoutHeight);
    root.dataset.v30VisualHeight = String(visualHeight);

    if (active) requestAnimationFrame(() => active.closest('.nn-route')?.scrollIntoView({block:'nearest',inline:'nearest'}));
  };

  const schedule = () => {
    sync();
    requestAnimationFrame(sync);
    setTimeout(sync, 80);
    setTimeout(sync, 300);
    setTimeout(sync, 1000);
  };

  root.addEventListener('focusin', schedule, true);
  root.addEventListener('focusout', schedule, true);
  visual?.addEventListener('resize', schedule);
  visual?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(schedule);
    const dock = document.querySelector('#nx-app>.nx-dock') || document.querySelector('.nx-dock');
    if (dock instanceof HTMLElement) resizeObserver.observe(dock);
    resizeObserver.observe(document.documentElement);
  }
  schedule();

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    if (disposed) return;
    disposed = true;
    resizeObserver?.disconnect();
    root.removeEventListener('focusin', schedule, true);
    root.removeEventListener('focusout', schedule, true);
    visual?.removeEventListener('resize', schedule);
    visual?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    root.style.removeProperty('--nn-v30-frame-height');
    root.style.removeProperty('--nn-v30-root-height');
    doc.classList.remove('nn-travel-v31-active', 'nn-travel-v31-keyboard');
    previousCleanup?.();
  };
  window.NexusNovaTravelLayoutV31 = { sync };
}

function scan() {
  document.querySelectorAll(ROOT_SELECTOR).forEach(bind);
}

installStyle();
scan();
new MutationObserver(scan).observe(document.documentElement, {subtree:true, childList:true});
