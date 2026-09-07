import { renderTravelGroundPanel } from './travel-ground.js';

const TRAVEL_HOST_STYLE_ID = 'nn-travel-host-guard-v7';
const TRAVEL_OTA_REVISION = 5;

function localDateOffset(days = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function datePlusDays(value, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return localDateOffset(days);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTravelDates(root) {
  const departure = root.querySelector('[data-flight-departure]');
  const returnDate = root.querySelector('[data-flight-return]');
  if (departure) {
    departure.min = localDateOffset(1);
    if (!departure.value) departure.value = localDateOffset(7);
    if (returnDate) returnDate.min = departure.value;
    departure.addEventListener('change', () => {
      if (!returnDate) return;
      returnDate.min = departure.value || localDateOffset(1);
      if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = '';
    });
  }

  const checkIn = root.querySelector('[data-hotel-checkin]');
  const checkOut = root.querySelector('[data-hotel-checkout]');
  if (checkIn && checkOut) {
    checkIn.min = localDateOffset(1);
    if (!checkIn.value) checkIn.value = localDateOffset(7);
    checkOut.min = localDateOffset(2);
    if (!checkOut.value) checkOut.value = localDateOffset(10);
    checkIn.addEventListener('change', () => {
      checkOut.min = checkIn.value || localDateOffset(2);
      if (!checkOut.value || checkOut.value <= checkOut.min) {
        checkOut.value = datePlusDays(checkIn.value || localDateOffset(1), 3);
      }
    });
  }

  const groundDate = root.querySelector('[data-ground-date]');
  if (groundDate) {
    groundDate.min = localDateOffset(1);
    if (!groundDate.value) groundDate.value = localDateOffset(7);
  }

  const tripStart = root.querySelector('[data-trip-start]');
  const tripStatus = root.querySelector('[data-trip-status]');
  const hasSavedTrip = String(tripStatus?.textContent || '').includes('Saved trip plan loaded');
  if (tripStart && !hasSavedTrip && !tripStart.value) tripStart.value = localDateOffset(0);
}

function stampTravelRevision(root) {
  const badge = root.querySelector('.nn-ota-badge');
  if (!badge) return;
  badge.textContent = String(TRAVEL_OTA_REVISION);
  badge.dataset.otaRevision = String(TRAVEL_OTA_REVISION);
  badge.setAttribute('aria-label', `OTA revision ${TRAVEL_OTA_REVISION}`);
  root.dataset.otaRevision = String(TRAVEL_OTA_REVISION);
}

function installRouteEditing(root) {
  const bindings = [
    ['[data-flight-origin]', '[data-city="from"]'],
    ['[data-flight-destination]', '[data-city="to"]']
  ];
  for (const [inputSelector, citySelector] of bindings) {
    const input = root.querySelector(inputSelector);
    const city = root.querySelector(citySelector);
    if (!(input instanceof HTMLInputElement) || !(city instanceof HTMLElement) || input.dataset.routeEditBound === 'true') continue;
    input.dataset.routeEditBound = 'true';
    const originalCity = city.textContent || '';
    input.dataset.originalRouteValue = input.value;
    input.dataset.originalCity = originalCity;
    input.addEventListener('focus', () => {
      requestAnimationFrame(() => {
        if (document.activeElement === input) input.select();
      });
    });
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const originalValue = input.dataset.originalRouteValue || '';
      city.textContent = value && value !== originalValue ? value : (input.dataset.originalCity || originalCity);
    });
  }
}

function ensureTravelHostStyle() {
  if (document.getElementById(TRAVEL_HOST_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TRAVEL_HOST_STYLE_ID;
  style.textContent = `
html.nn-travel-host-lock,html.nn-travel-host-lock body{
  width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important;
  overscroll-behavior:none!important;scroll-behavior:auto!important
}
html.nn-travel-host-lock .nx-app{
  width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
  margin:0!important;overflow:hidden!important
}
html.nn-travel-host-lock .nx-stage{
  position:fixed!important;inset:0!important;width:100%!important;height:auto!important;
  min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;
  scroll-padding:0!important;overflow:hidden!important;overscroll-behavior:none!important
}
html.nn-travel-host-lock .nx-screen.nn-travel-host-screen{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
  min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;
  overflow:hidden!important
}
html.nn-travel-host-lock .nx-screen.nn-travel-host-screen>[data-app-mount]{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
  min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important
}
html.nn-travel-host-lock .nx-dock.global{
  margin:0!important;transform:none!important;left:5px!important;right:5px!important;
  width:auto!important;bottom:4px!important
}
html.nn-travel-host-lock .nn-travel-v19{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
  min-height:0!important;max-height:none!important;overflow:hidden!important
}
html.nn-travel-host-lock .nn-travel-v19 .nn-travel-frame{
  top:0!important;left:0!important;right:0!important;bottom:auto!important;
  width:100%!important;height:var(--nn-travel-frame-height,calc(100% - 72px))!important;
  min-height:0!important;max-height:none!important;overflow:hidden!important
}
html.nn-travel-host-lock .nn-travel-v19 .nn-travel-stage{
  grid-row:3!important
}
html.nn-travel-host-lock .nn-travel-v19 .nn-travel-stage,
html.nn-travel-host-lock .nn-travel-v19 .nn-panel,
html.nn-travel-host-lock .nn-travel-v19 .nn-flight-panel{
  min-height:0!important;overflow:hidden!important
}
html.nn-travel-host-lock .nn-travel-v19 .nn-results-body,
html.nn-travel-host-lock .nn-travel-v19 [data-flight-results],
html.nn-travel-host-lock .nn-travel-v19 [data-hotel-results],
html.nn-travel-host-lock .nn-travel-v19 [data-ground-results]{
  overscroll-behavior:contain!important
}
@media (min-height:681px){
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-flight-panel:not([hidden]){
    grid-template-rows:clamp(118px,24vh,190px) minmax(0,1fr)!important
  }
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-search-card{
    grid-template-rows:minmax(34px,.62fr) minmax(72px,1.08fr) minmax(46px,.82fr) minmax(46px,.82fr) minmax(34px,.62fr) minmax(47px,.78fr) minmax(42px,.72fr)!important;
    align-content:stretch!important;min-height:0!important;height:100%!important;overflow:hidden!important
  }
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-trip-top,
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-routes,
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-pair,
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-filter-row,
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-search-button,
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-search-card>div:last-child{
    min-height:0!important;height:100%!important
  }
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-route,
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-control{
    min-height:0!important;height:100%!important
  }
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-search-card>div:last-child{
    display:grid!important;grid-template-rows:13px minmax(29px,1fr)!important
  }
  html.nn-travel-host-lock:not(.nn-travel-keyboard-open):not(.nn-travel-route-focus-open) .nn-travel-v19 .nn-trust{
    min-height:0!important;height:100%!important
  }
}
html.nn-travel-keyboard-open .nx-dock.global,
html.nn-travel-route-focus-open .nx-dock.global{display:none!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-travel-frame,
.nn-travel-v19.nn-travel-route-focus .nn-travel-frame{
  grid-template-rows:0 0 minmax(0,1fr)!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-travel-head,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-tab-dock,
.nn-travel-v19.nn-travel-route-focus .nn-travel-head,
.nn-travel-v19.nn-travel-route-focus .nn-tab-dock,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-hero,
.nn-travel-v19.nn-travel-route-focus .nn-hero{display:none!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-flight-panel:not([hidden]),
.nn-travel-v19.nn-travel-route-focus .nn-flight-panel:not([hidden]){
  grid-template-rows:minmax(0,1fr)!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-secondary:not([hidden]){
  grid-template-rows:minmax(0,1fr)!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-secondary-hero{display:none!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-secondary-card{min-height:0!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-card,
.nn-travel-v19.nn-travel-route-focus .nn-search-card{
  grid-template-rows:28px 60px 38px 38px 28px 40px minmax(22px,1fr)!important;
  align-content:stretch!important;overflow:hidden!important;gap:3px!important;padding:5px!important;min-height:0!important;height:100%!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-trip-modes,
.nn-travel-v19.nn-travel-route-focus .nn-trip-modes{height:28px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-card>.nn-trip-top,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-card>.nn-routes,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-card>.nn-pair,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-filter-row,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-button,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-card>div:last-child,
.nn-travel-v19.nn-travel-route-focus .nn-search-card>.nn-trip-top,
.nn-travel-v19.nn-travel-route-focus .nn-search-card>.nn-routes,
.nn-travel-v19.nn-travel-route-focus .nn-search-card>.nn-pair,
.nn-travel-v19.nn-travel-route-focus .nn-filter-row,
.nn-travel-v19.nn-travel-route-focus .nn-search-button,
.nn-travel-v19.nn-travel-route-focus .nn-search-card>div:last-child{
  display:grid!important;visibility:visible!important;opacity:1!important;min-height:0!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-routes,
html.nn-travel-keyboard-open .nn-travel-v19 .nn-route,
.nn-travel-v19.nn-travel-route-focus .nn-routes,
.nn-travel-v19.nn-travel-route-focus .nn-route{height:60px!important;min-height:60px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-route,
.nn-travel-v19.nn-travel-route-focus .nn-route{padding:4px 7px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-route input,
.nn-travel-v19.nn-travel-route-focus .nn-route input{width:82%!important;height:27px!important;font-size:18px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-route small,
.nn-travel-v19.nn-travel-route-focus .nn-route small{font-size:7px!important;line-height:1.05!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-control,
.nn-travel-v19.nn-travel-route-focus .nn-control{height:38px!important;min-height:38px!important;padding:2px 7px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-filter-row,
.nn-travel-v19.nn-travel-route-focus .nn-filter-row{height:28px!important;min-height:28px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-button,
.nn-travel-v19.nn-travel-route-focus .nn-search-button{height:40px!important;min-height:40px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-search-card>div:last-child,
.nn-travel-v19.nn-travel-route-focus .nn-search-card>div:last-child{
  grid-template-rows:9px minmax(13px,1fr)!important;overflow:hidden!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-status,
.nn-travel-v19.nn-travel-route-focus .nn-status{height:9px!important;line-height:9px!important;font-size:6px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-trust,
.nn-travel-v19.nn-travel-route-focus .nn-trust{min-height:13px!important;height:100%!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-trust small,
.nn-travel-v19.nn-travel-route-focus .nn-trust small{display:none!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-trust .big,
.nn-travel-v19.nn-travel-route-focus .nn-trust .big{font-size:13px!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-trust b,
.nn-travel-v19.nn-travel-route-focus .nn-trust b{font-size:6px!important}
.nn-travel-v19.nn-travel-route-focus .nn-route:focus-within{
  border-color:#62eaff!important;box-shadow:0 0 0 2px rgba(65,218,255,.14),0 0 16px rgba(30,186,255,.22)!important
}
`;
  document.head.appendChild(style);
}

function installLockedTravelHost(root) {
  if (root.dataset.travelHostGuard === 'v7') return;
  root.dataset.travelHostGuard = 'v7';
  ensureTravelHostStyle();
  stampTravelRevision(root);
  installRouteEditing(root);

  const doc = document.documentElement;
  const visual = window.visualViewport;
  let disposed = false;
  let baselineHeight = Math.max(
    1,
    Math.round(window.innerHeight || 0),
    Math.round(document.documentElement.clientHeight || 0),
    Math.round(visual?.height || 0)
  );
  let screen = null;
  let stage = null;

  const editableInRoot = () => {
    const active = document.activeElement;
    return active instanceof HTMLElement
      && root.contains(active)
      && active.matches('input,select,textarea,[contenteditable="true"]')
      ? active
      : null;
  };

  const markHost = () => {
    if (!root.isConnected) return false;
    screen = root.closest('.nx-screen');
    stage = screen?.closest('.nx-stage') || document.querySelector('.nx-stage');
    screen?.classList.add('nn-travel-host-screen');
    doc.classList.add('nn-travel-host-lock');
    return Boolean(screen);
  };

  const syncFrame = (keyboardOpen, routeFocus, layoutHeight, visibleHeight) => {
    const rootRect = root.getBoundingClientRect();
    const viewportTop = Math.max(0, Number(visual?.offsetTop || 0));
    const visibleBottom = viewportTop + Math.min(layoutHeight, visibleHeight);
    const compact = keyboardOpen || routeFocus;
    let targetBottom = Math.min(rootRect.bottom, visibleBottom);
    let dockGap = 0;

    if (!compact) {
      const dock = document.querySelector('.nx-dock.global');
      if (dock instanceof HTMLElement && getComputedStyle(dock).display !== 'none') {
        const dockRect = dock.getBoundingClientRect();
        targetBottom = Math.min(targetBottom, dockRect.top - 6);
        dockGap = Math.max(0, Math.round(dockRect.top - targetBottom));
      }
    }

    const frameHeight = Math.max(1, Math.floor(targetBottom - rootRect.top));
    root.style.setProperty('--nn-travel-frame-height', `${frameHeight}px`);
    root.dataset.travelFrameHeight = String(frameHeight);
    root.dataset.travelDockGap = String(dockGap);
  };

  const syncViewport = () => {
    if (disposed || !markHost()) return;
    const active = editableInRoot();
    const routeFocus = Boolean(active?.closest('.nn-route'));
    const layoutHeight = Math.max(
      1,
      Math.round(window.innerHeight || 0),
      Math.round(document.documentElement.clientHeight || 0)
    );
    const visibleHeight = Math.max(1, Math.round(visual?.height || layoutHeight));
    if (!active) baselineHeight = Math.max(baselineHeight, layoutHeight, visibleHeight);
    const effectiveHeight = Math.min(layoutHeight, visibleHeight);
    const keyboardOpen = Boolean(active)
      && baselineHeight - effectiveHeight >= Math.max(110, Math.round(baselineHeight * 0.14));

    doc.classList.toggle('nn-travel-keyboard-open', keyboardOpen);
    doc.classList.toggle('nn-travel-route-focus-open', routeFocus);
    root.classList.toggle('nn-travel-keyboard-open', keyboardOpen);
    root.classList.toggle('nn-travel-route-focus', routeFocus);
    root.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false';
    root.dataset.routeFocus = routeFocus ? 'true' : 'false';
    syncFrame(keyboardOpen, routeFocus, layoutHeight, visibleHeight);

    if (stage) stage.scrollTop = 0;
    const scroller = document.scrollingElement;
    if (scroller) scroller.scrollTop = 0;
  };

  const onFocusIn = event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('input,select,textarea,[contenteditable="true"]')) return;
    setTimeout(syncViewport, 0);
    setTimeout(syncViewport, 80);
    setTimeout(syncViewport, 260);
  };

  const onFocusOut = () => {
    setTimeout(syncViewport, 90);
  };

  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  visual?.addEventListener('resize', syncViewport);
  visual?.addEventListener('scroll', syncViewport);
  window.addEventListener('resize', syncViewport);
  window.addEventListener('orientationchange', syncViewport);

  requestAnimationFrame(() => requestAnimationFrame(syncViewport));
  setTimeout(syncViewport, 120);
  setTimeout(syncViewport, 420);
  setTimeout(syncViewport, 900);

  const previousCleanup = root.__cleanup;
  root.__cleanup = () => {
    if (disposed) return;
    disposed = true;
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    visual?.removeEventListener('resize', syncViewport);
    visual?.removeEventListener('scroll', syncViewport);
    window.removeEventListener('resize', syncViewport);
    window.removeEventListener('orientationchange', syncViewport);
    root.classList.remove('nn-travel-keyboard-open', 'nn-travel-route-focus');
    root.style.removeProperty('--nn-travel-frame-height');
    screen?.classList.remove('nn-travel-host-screen');
    doc.classList.remove('nn-travel-host-lock', 'nn-travel-keyboard-open', 'nn-travel-route-focus-open');
    previousCleanup?.();
  };
}

export function enhanceTravelApp(id, root) {
  if (!(root instanceof HTMLElement) || id !== 'travel') return root;

  const lockedTravelV16 = root.matches?.('.nn-travel-v16,[data-runtime-repair]')
    || root.querySelector?.('.nn-travel-v16,[data-runtime-repair]');
  if (lockedTravelV16) {
    normalizeTravelDates(root);
    installLockedTravelHost(root);
    return root;
  }

  const expansion = [...root.querySelectorAll('.nx-tool-card')]
    .find(card => card.textContent?.includes('Worldwide Travel Expansion')) || null;
  const groundPanel = renderTravelGroundPanel();
  if (expansion) {
    expansion.insertAdjacentElement('beforebegin', groundPanel);
    const meta = expansion.querySelector('.nx-tool-meta');
    if (meta) meta.textContent = 'Flights, hotels, rail and coach/bus now use browser-free in-app data engines. Live inventory appears only when an approved secure provider returns it.';
    const railBox = [...expansion.querySelectorAll('.nx-summary-grid > div')]
      .find(item => item.textContent?.includes('Rail / Bus'));
    const state = railBox?.querySelector('strong');
    if (state) state.textContent = 'LIVE SEARCH ENGINE';
  } else {
    root.appendChild(groundPanel);
  }

  normalizeTravelDates(root);
  return root;
}
