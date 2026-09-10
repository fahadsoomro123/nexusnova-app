import { hydrateDriveTrackState, loadDriveTrackState } from '../../core/drive-track-persistence.js';

const activeCleanups = new WeakMap();
let currentKind = '';
let currentScreen = null;

function text(el) {
  return String(el?.textContent || '').trim();
}

function appName(screen) {
  return text(screen?.querySelector(':scope > .nx-app-head h1'));
}

function dayStart(value = new Date()) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekStart(value = new Date()) {
  const d = dayStart(value);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function monthStart(value = new Date()) {
  const d = dayStart(value);
  d.setDate(1);
  return d;
}

function localDayKey(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function distanceText(meters) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

function durationText(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function aggregateRange(store, startAt) {
  const start = dayStart(startAt).getTime();
  return Object.entries(store?.days || {}).reduce((sum, [key, row]) => {
    const at = new Date(`${key}T00:00:00`).getTime();
    if (!Number.isFinite(at) || at < start) return sum;
    sum.distanceM += Number(row?.distanceM) || 0;
    sum.movingMs += Number(row?.movingMs) || 0;
    sum.trips += Number(row?.trips) || 0;
    return sum;
  }, { distanceM:0, movingMs:0, trips:0 });
}

function balancedPages(total, capacity) {
  if (total <= 0) return [];
  const pages = Math.max(1, Math.ceil(total / Math.max(1, capacity)));
  const base = Math.floor(total / pages);
  let extra = total % pages;
  const out = [];
  let start = 0;
  for (let page = 0; page < pages; page += 1) {
    const size = base + (extra-- > 0 ? 1 : 0);
    out.push([start, start + size]);
    start += size;
  }
  return out;
}

function articleCapacity(root) {
  const h = Math.max(0, root?.clientHeight || window.visualViewport?.height || window.innerHeight || 0);
  if (h >= 790) return 6;
  if (h >= 690) return 5;
  if (h >= 590) return 4;
  return 3;
}

function enhanceArticles(root) {
  if (!root || root.dataset.b4Enhanced === '1') return () => {};
  root.dataset.b4Enhanced = '1';
  root.classList.add('nx-b4-articles');
  const list = root.querySelector('[data-articles-list]');
  const head = root.querySelector('.nxa3-head');
  if (!list || !head) return () => {};

  const nav = document.createElement('div');
  nav.className = 'nxa-b4-nav';
  nav.innerHTML = '<button type="button" data-b4-prev aria-label="Previous articles">‹</button><span data-b4-page>1 / 1</span><button type="button" data-b4-next aria-label="Next articles">›</button>';
  root.appendChild(nav);

  let page = 0;
  let pages = [];
  let disposed = false;
  const prev = nav.querySelector('[data-b4-prev]');
  const next = nav.querySelector('[data-b4-next]');
  const label = nav.querySelector('[data-b4-page]');

  const paint = () => {
    if (disposed) return;
    const cards = [...list.querySelectorAll('.nxa3-card')];
    if (!cards.length) {
      nav.hidden = true;
      list.style.removeProperty('--b4-visible');
      return;
    }
    pages = balancedPages(cards.length, articleCapacity(root));
    page = Math.max(0, Math.min(page, pages.length - 1));
    const [start, end] = pages[page];
    cards.forEach((card, index) => { card.hidden = index < start || index >= end; });
    list.style.setProperty('--b4-visible', String(Math.max(1, end - start)));
    nav.hidden = pages.length <= 1;
    label.textContent = `${page + 1} / ${pages.length}`;
    prev.disabled = page <= 0;
    next.disabled = page >= pages.length - 1;
  };

  const listObserver = new MutationObserver(() => {
    page = 0;
    requestAnimationFrame(paint);
  });
  listObserver.observe(list, { childList:true });
  const resize = new ResizeObserver(() => requestAnimationFrame(paint));
  resize.observe(root);
  prev.addEventListener('click', () => { if (page > 0) { page -= 1; paint(); } });
  next.addEventListener('click', () => { if (page < pages.length - 1) { page += 1; paint(); } });
  requestAnimationFrame(paint);

  return () => {
    disposed = true;
    listObserver.disconnect();
    resize.disconnect();
    nav.remove();
    delete root.dataset.b4Enhanced;
  };
}

function enhanceLocation(root) {
  if (!root || root.dataset.b4Enhanced === '1') return () => {};
  root.dataset.b4Enhanced = '1';
  root.classList.add('nx-b4-location');
  const map = root.querySelector('[data-loc-map]');
  const frame = root.querySelector('.nx-location-map__frame');
  const iframe = root.querySelector('[data-loc-frame]');
  if (!map || !frame || !iframe) return () => {};

  const placeholder = document.createElement('div');
  placeholder.className = 'nx-b4-map-placeholder';
  placeholder.innerHTML = '<i aria-hidden="true"></i><strong>GPS MAP READY</strong><span>Your map appears here after a precise location fix.</span>';
  frame.prepend(placeholder);
  map.hidden = false;

  const sync = () => frame.classList.toggle('is-ready', Boolean(iframe.getAttribute('src')));
  const observer = new MutationObserver(sync);
  observer.observe(iframe, { attributes:true, attributeFilter:['src'] });
  sync();

  return () => {
    observer.disconnect();
    placeholder.remove();
    delete root.dataset.b4Enhanced;
  };
}

function trackCapacity(root) {
  const h = Math.max(0, root?.clientHeight || window.visualViewport?.height || window.innerHeight || 0);
  return h >= 720 ? 5 : h >= 600 ? 4 : 3;
}

function buildTrackView() {
  const root = document.createElement('section');
  root.className = 'nx-b4-track';
  root.innerHTML = `
    <section class="nx-b4-track-status"><span><i></i> DRIVE HISTORY</span><button type="button" data-b4-track-recover>RECOVER</button></section>
    <section class="nx-b4-track-summary">
      <article><span>TODAY</span><strong data-b4-today>0.00 km</strong><small data-b4-today-trips>0 trips</small></article>
      <article><span>THIS WEEK</span><strong data-b4-week>0.00 km</strong><small data-b4-week-trips>0 trips</small></article>
      <article><span>THIS MONTH</span><strong data-b4-month>0.00 km</strong><small data-b4-month-trips>0 trips</small></article>
      <article><span>MOVING TODAY</span><strong data-b4-moving>0m</strong><small>recorded time</small></article>
    </section>
    <section class="nx-b4-track-chart"><div class="nx-b4-track-chart-head"><span>LAST 7 DAYS</span><strong data-b4-seven-total>0.00 km</strong></div><div class="nx-b4-bars" data-b4-bars></div></section>
    <section class="nx-b4-track-history">
      <div class="nx-b4-track-history-head"><span>RECENT TRIPS</span><div class="nx-b4-track-nav"><button type="button" data-b4-trip-prev aria-label="Previous trips">‹</button><b data-b4-trip-page>1 / 1</b><button type="button" data-b4-trip-next aria-label="Next trips">›</button></div></div>
      <div class="nx-b4-trip-list" data-b4-trip-list></div>
    </section>`;
  return root;
}

function mountTrack(screen) {
  if (!screen || screen.dataset.b4TrackMounted === '1') return () => {};
  const mount = screen.querySelector('[data-app-mount]');
  const oldBody = mount?.firstElementChild;
  if (!mount || !oldBody) return () => {};
  screen.dataset.b4TrackMounted = '1';

  const originalCleanup = typeof oldBody.__cleanup === 'function' ? oldBody.__cleanup.bind(oldBody) : () => {};
  try { originalCleanup(); } catch {}

  const root = buildTrackView();
  mount.replaceChildren(root);
  let disposed = false;
  let state = { store:{ days:{}, trips:[] }, cloud:false };
  let tripPage = 0;
  let tripPages = [];

  const todayEl = root.querySelector('[data-b4-today]');
  const todayTripsEl = root.querySelector('[data-b4-today-trips]');
  const weekEl = root.querySelector('[data-b4-week]');
  const weekTripsEl = root.querySelector('[data-b4-week-trips]');
  const monthEl = root.querySelector('[data-b4-month]');
  const monthTripsEl = root.querySelector('[data-b4-month-trips]');
  const movingEl = root.querySelector('[data-b4-moving]');
  const sevenEl = root.querySelector('[data-b4-seven-total]');
  const barsEl = root.querySelector('[data-b4-bars]');
  const listEl = root.querySelector('[data-b4-trip-list]');
  const pageEl = root.querySelector('[data-b4-trip-page]');
  const prev = root.querySelector('[data-b4-trip-prev]');
  const next = root.querySelector('[data-b4-trip-next]');
  const recover = root.querySelector('[data-b4-track-recover]');

  const paint = () => {
    if (disposed) return;
    const store = state.store || { days:{}, trips:[] };
    const today = store.days?.[localDayKey()] || { distanceM:0, movingMs:0, trips:0 };
    const week = aggregateRange(store, weekStart());
    const month = aggregateRange(store, monthStart());
    todayEl.textContent = distanceText(today.distanceM);
    todayTripsEl.textContent = `${Number(today.trips) || 0} trips`;
    weekEl.textContent = distanceText(week.distanceM);
    weekTripsEl.textContent = `${week.trips} trips`;
    monthEl.textContent = distanceText(month.distanceM);
    monthTripsEl.textContent = `${month.trips} trips`;
    movingEl.textContent = durationText(today.movingMs);

    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const row = store.days?.[localDayKey(d)] || { distanceM:0 };
      days.push({ label:d.toLocaleDateString(undefined, { weekday:'short' }).slice(0, 2).toUpperCase(), distanceM:Math.max(0, Number(row.distanceM) || 0) });
    }
    const max = Math.max(1, ...days.map(row => row.distanceM));
    const total = days.reduce((sum, row) => sum + row.distanceM, 0);
    sevenEl.textContent = distanceText(total);
    barsEl.innerHTML = '';
    for (const day of days) {
      const item = document.createElement('article');
      const bar = document.createElement('div');
      const fill = document.createElement('i');
      fill.style.height = `${Math.max(4, (day.distanceM / max) * 100).toFixed(2)}%`;
      bar.appendChild(fill);
      const label = document.createElement('strong');
      label.textContent = day.label;
      const value = document.createElement('span');
      value.textContent = day.distanceM > 0 ? (day.distanceM / 1000).toFixed(1) : '0';
      item.append(bar, label, value);
      barsEl.appendChild(item);
    }

    const trips = Array.isArray(store.trips) ? store.trips : [];
    tripPages = balancedPages(trips.length, trackCapacity(root));
    if (!tripPages.length) {
      tripPage = 0;
      pageEl.textContent = '0 / 0';
      prev.disabled = true;
      next.disabled = true;
      listEl.innerHTML = '<div class="nx-b4-trip-empty">No recorded drives yet.</div>';
      return;
    }
    tripPage = Math.max(0, Math.min(tripPage, tripPages.length - 1));
    const [start, end] = tripPages[tripPage];
    listEl.innerHTML = '';
    for (const trip of trips.slice(start, end)) {
      const row = document.createElement('article');
      const date = new Date(trip?.at || Date.now());
      const left = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = date.toLocaleDateString([], { day:'2-digit', month:'short' });
      const time = document.createElement('span');
      time.textContent = date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      left.append(title, time);
      const distance = document.createElement('b');
      distance.textContent = distanceText(trip?.distanceM);
      const meta = document.createElement('small');
      meta.textContent = `${durationText(trip?.durationMs)} • top ${Math.round(Math.max(0, Number(trip?.topKmh) || 0))} km/h`;
      row.append(left, distance, meta);
      listEl.appendChild(row);
    }
    listEl.style.setProperty('--b4-trip-visible', String(Math.max(1, end - start)));
    pageEl.textContent = `${tripPage + 1} / ${tripPages.length}`;
    prev.disabled = tripPage <= 0;
    next.disabled = tripPage >= tripPages.length - 1;
  };

  const read = async (recoverCloud = false) => {
    if (disposed) return;
    if (recoverCloud) {
      recover.disabled = true;
      recover.textContent = 'RECOVERING…';
    }
    try {
      state = recoverCloud ? await hydrateDriveTrackState() : await loadDriveTrackState();
      paint();
    } catch {
      paint();
    } finally {
      if (recoverCloud && !disposed) {
        recover.disabled = false;
        recover.textContent = 'RECOVER';
      }
    }
  };

  const onStore = () => read(false);
  const resize = new ResizeObserver(() => { tripPage = 0; paint(); });
  resize.observe(root);
  window.addEventListener('nexusnova:drive-track-updated', onStore);
  prev.addEventListener('click', () => { if (tripPage > 0) { tripPage -= 1; paint(); } });
  next.addEventListener('click', () => { if (tripPage < tripPages.length - 1) { tripPage += 1; paint(); } });
  recover.addEventListener('click', () => read(true));
  read(false);

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    resize.disconnect();
    window.removeEventListener('nexusnova:drive-track-updated', onStore);
    delete screen.dataset.b4TrackMounted;
  };
  oldBody.__cleanup = () => {
    try { originalCleanup(); } finally { cleanup(); }
  };
  return cleanup;
}

function mountDriveFailClosed(screen) {
  if (!screen || screen.dataset.b4DriveChecked === '1') return;
  screen.dataset.b4DriveChecked = '1';
  queueMicrotask(() => {
    if (!screen.isConnected || screen.querySelector('.nxdr3')) return;
    const mount = screen.querySelector('[data-app-mount]');
    const oldBody = mount?.firstElementChild;
    if (!mount || !oldBody) return;
    const originalCleanup = typeof oldBody.__cleanup === 'function' ? oldBody.__cleanup.bind(oldBody) : () => {};
    try { originalCleanup(); } catch {}
    const safe = document.createElement('section');
    safe.className = 'nx-b4-drive-unavailable';
    safe.innerHTML = '<i aria-hidden="true"></i><strong>NATIVE TRACKING BRIDGE UNAVAILABLE</strong><span>Nova Drive will not start a second web tracking engine. Reopen the Android app to use verified native smart tracking.</span>';
    mount.replaceChildren(safe);
    oldBody.__cleanup = originalCleanup;
  });
}

function identify(screen) {
  if (!screen) return '';
  if (screen.querySelector('.nx-articles-v3')) return 'articles';
  if (screen.querySelector('.nx-location-suite')) return 'location';
  const name = appName(screen);
  if (name === 'Nova Track') return 'track';
  if (name === 'Nova Drive' || screen.classList.contains('nx-drive-v3-screen')) return 'drive';
  return '';
}

function activate(screen, kind) {
  if (!screen || !kind) return;
  if (currentScreen === screen && currentKind === kind) return;

  if (currentScreen && currentScreen !== screen) {
    activeCleanups.get(currentScreen)?.();
    activeCleanups.delete(currentScreen);
    currentScreen.classList.remove('nx-b4-screen', 'nx-b4-articles-screen', 'nx-b4-location-screen', 'nx-b4-track-screen', 'nx-b4-drive-screen');
  }

  currentScreen = screen;
  currentKind = kind;
  screen.classList.add('nx-b4-screen', `nx-b4-${kind}-screen`);
  document.documentElement.classList.add('nx-b4-active');
  document.documentElement.dataset.b4Kind = kind;

  let cleanup = () => {};
  if (kind === 'articles') cleanup = enhanceArticles(screen.querySelector('.nx-articles-v3'));
  if (kind === 'location') cleanup = enhanceLocation(screen.querySelector('.nx-location-suite'));
  if (kind === 'track') cleanup = mountTrack(screen);
  if (kind === 'drive') mountDriveFailClosed(screen);
  activeCleanups.set(screen, cleanup);
}

function scan() {
  const stage = document.getElementById('nx-stage');
  const screen = stage?.querySelector(':scope > .nx-screen');
  const kind = identify(screen);
  if (screen && kind) {
    activate(screen, kind);
    return;
  }
  if (currentScreen && !currentScreen.isConnected) {
    activeCleanups.get(currentScreen)?.();
    activeCleanups.delete(currentScreen);
    currentScreen = null;
    currentKind = '';
  }
  document.documentElement.classList.remove('nx-b4-active');
  delete document.documentElement.dataset.b4Kind;
}

const observer = new MutationObserver(() => queueMicrotask(scan));
observer.observe(document.documentElement, { childList:true, subtree:true });
window.addEventListener('pageshow', scan);
scan();
