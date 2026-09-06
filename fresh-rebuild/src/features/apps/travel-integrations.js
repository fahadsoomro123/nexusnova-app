import { renderTravelGroundPanel } from './travel-ground.js';

const TRAVEL_HOST_STYLE_ID = 'nn-travel-host-guard-v3';

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
    departure.value = localDateOffset(7);
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
    checkIn.value = localDateOffset(7);
    checkOut.min = localDateOffset(2);
    checkOut.value = localDateOffset(10);
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
    groundDate.value = localDateOffset(7);
  }

  const tripStart = root.querySelector('[data-trip-start]');
  const tripStatus = root.querySelector('[data-trip-status]');
  const hasSavedTrip = String(tripStatus?.textContent || '').includes('Saved trip plan loaded');
  if (tripStart && !hasSavedTrip) tripStart.value = localDateOffset(0);
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
  position:fixed!important;left:0!important;right:0!important;
  top:var(--nn-travel-vv-top,0px)!important;height:var(--nn-travel-vv-height,100dvh)!important;
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
html.nn-travel-keyboard-open .nx-dock.global{display:none!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-flight-panel:not([hidden]){
  grid-template-rows:0 minmax(0,1fr)!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-hero{display:none!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-secondary:not([hidden]){
  grid-template-rows:0 minmax(0,1fr)!important
}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-secondary-hero{display:none!important}
html.nn-travel-keyboard-open .nn-travel-v19 .nn-secondary-card{min-height:0!important}
.nn-travel-v19.nn-travel-route-focus .nn-search-card{
  grid-template-rows:auto auto!important;align-content:start!important;gap:7px!important
}
.nn-travel-v19.nn-travel-route-focus .nn-search-card>.nn-pair,
.nn-travel-v19.nn-travel-route-focus .nn-filter-row,
.nn-travel-v19.nn-travel-route-focus .nn-search-button,
.nn-travel-v19.nn-travel-route-focus .nn-search-card>div:last-child{display:none!important}
.nn-travel-v19.nn-travel-route-focus .nn-routes,
.nn-travel-v19.nn-travel-route-focus .nn-route{height:78px!important;min-height:78px!important}
.nn-travel-v19.nn-travel-route-focus .nn-route input{height:34px!important;font-size:22px!important}
`;
  document.head.appendChild(style);
}

function installLockedTravelHost(root) {
  if (root.dataset.travelHostGuard === 'v3') return;
  root.dataset.travelHostGuard = 'v3';
  ensureTravelHostStyle();

  const doc = document.documentElement;
  const visual = window.visualViewport;
  let disposed = false;
  let baselineHeight = Math.max(1, Math.round(visual?.height || window.innerHeight || document.documentElement.clientHeight || 1));
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

  const syncViewport = () => {
    if (disposed || !markHost()) return;
    const active = editableInRoot();
    const height = Math.max(1, Math.round(visual?.height || window.innerHeight || document.documentElement.clientHeight || 1));
    const top = Math.max(0, Math.round(visual?.offsetTop || 0));
    if (!active && height >= baselineHeight * 0.82) baselineHeight = Math.max(baselineHeight, height);
    const keyboardOpen = Boolean(active) && baselineHeight - height >= Math.max(110, Math.round(baselineHeight * 0.14));

    doc.style.setProperty('--nn-travel-vv-height', `${height}px`);
    doc.style.setProperty('--nn-travel-vv-top', `${top}px`);
    doc.classList.toggle('nn-travel-keyboard-open', keyboardOpen);
    root.classList.toggle('nn-travel-keyboard-open', keyboardOpen);
    root.classList.toggle('nn-travel-route-focus', Boolean(active?.closest('.nn-route')));
    root.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false';

    if (stage) stage.scrollTop = 0;
    if (!keyboardOpen) {
      const scroller = document.scrollingElement;
      if (scroller) scroller.scrollTop = 0;
    }
  };

  const onFocusIn = event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('input,select,textarea,[contenteditable="true"]')) return;
    root.classList.toggle('nn-travel-route-focus', Boolean(target.closest('.nn-route')));
    setTimeout(syncViewport, 0);
    setTimeout(syncViewport, 80);
    setTimeout(syncViewport, 260);
  };

  const onFocusOut = () => {
    setTimeout(() => {
      if (!editableInRoot()) root.classList.remove('nn-travel-route-focus');
      syncViewport();
    }, 90);
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
    screen?.classList.remove('nn-travel-host-screen');
    doc.classList.remove('nn-travel-host-lock', 'nn-travel-keyboard-open');
    doc.style.removeProperty('--nn-travel-vv-height');
    doc.style.removeProperty('--nn-travel-vv-top');
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