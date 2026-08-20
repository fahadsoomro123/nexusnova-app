import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

const GAUGE_ARC = 'M 76.87 76.87 A 38 38 0 1 1 76.87 23.13';
const DRIVE_HISTORY = 90;
const MAX_DRIVE_KMH = 240;
const MAX_GPS_ACCURACY_M = 80;

function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
  root.innerHTML = html;
  return root;
}

function gaugeMarkup(kind, unit, maxLabel) {
  return `<div class="nxgauge nxgauge--${kind}">
    <svg viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(kind)} gauge">
      <defs>
        <linearGradient id="nxGaugeGradient-${kind}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#55718b"/>
          <stop offset="38%" stop-color="#41c8e6"/>
          <stop offset="72%" stop-color="#4ad3a1"/>
          <stop offset="100%" stop-color="#d4b66f"/>
        </linearGradient>
      </defs>
      <path class="nxgauge__track" d="${GAUGE_ARC}" pathLength="100"/>
      <path class="nxgauge__fill" data-gauge-fill d="${GAUGE_ARC}" pathLength="100" style="stroke-dasharray:0 100"/>
      <g class="nxgauge__needle" data-gauge-needle>
        <line x1="50" y1="51" x2="50" y2="20"/>
        <circle cx="50" cy="51" r="4.4"/>
        <circle cx="50" cy="51" r="1.6"/>
      </g>
      <text x="19" y="78" class="nxgauge__mark">0</text>
      <text x="77" y="78" class="nxgauge__mark">${escapeHtml(maxLabel)}</text>
    </svg>
    <div class="nxgauge__readout"><span data-gauge-mode>READY</span><strong data-gauge-value>0</strong><small>${escapeHtml(unit)}</small></div>
  </div>`;
}

function setGauge(root, ratio, value, mode, decimals = 1) {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  const needle = root.querySelector('[data-gauge-needle]');
  const fill = root.querySelector('[data-gauge-fill]');
  const valueEl = root.querySelector('[data-gauge-value]');
  const modeEl = root.querySelector('[data-gauge-mode]');
  const angle = -135 + safeRatio * 270;
  if (needle) needle.style.transform = `rotate(${angle}deg)`;
  if (fill) fill.style.strokeDasharray = `${(safeRatio * 100).toFixed(2)} 100`;
  if (valueEl) valueEl.textContent = Number(value || 0).toFixed(decimals);
  if (modeEl) modeEl.textContent = mode;
  root.style.setProperty('--gauge-ratio', safeRatio);
}

function emptyDriveStore() {
  return { version:1, days:{}, trips:[] };
}

function localDayKey(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

async function accountId() {
  try {
    const user = await requireFirebaseUser();
    return String(user?.uid || '').trim() || 'device';
  } catch {
    return 'device';
  }
}

async function driveStoreKey() {
  return `nexusnova_drive_track_v1:${await accountId()}`;
}

function readDriveStore(key) {
  const raw = loadJson(key, null);
  if (!raw || typeof raw !== 'object') return emptyDriveStore();
  return {
    version:1,
    days:raw.days && typeof raw.days === 'object' ? raw.days : {},
    trips:Array.isArray(raw.trips) ? raw.trips.slice(0, DRIVE_HISTORY) : []
  };
}

function writeDriveStore(key, store) {
  store.trips = Array.isArray(store.trips) ? store.trips.slice(0, DRIVE_HISTORY) : [];
  saveJson(key, store);
  window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
}

function dayRecord(store, key) {
  if (!store.days[key] || typeof store.days[key] !== 'object') {
    store.days[key] = { distanceM:0, movingMs:0, trips:0 };
  }
  const row = store.days[key];
  row.distanceM = Number(row.distanceM) || 0;
  row.movingMs = Number(row.movingMs) || 0;
  row.trips = Number(row.trips) || 0;
  return row;
}

function rad(value) {
  return Number(value) * Math.PI / 180;
}

function haversineM(a, b) {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistance(meters) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

export function renderNovaDrivePremium() {
  const root = node(`
    <section class="nxdrive-console">
      <header><div><span>LIVE GPS DRIVE</span><strong>Nova Drive</strong></div><b data-drive-state>IDLE</b></header>
      ${gaugeMarkup('drive', 'KM/H', '240')}
      <section class="nxdrive-metrics">
        <article><span>TOP SPEED</span><strong data-drive-top>0 km/h</strong></article>
        <article><span>TRIP</span><strong data-drive-distance>0.00 km</strong></article>
        <article><span>DURATION</span><strong data-drive-duration>00:00</strong></article>
        <article><span>GPS ACCURACY</span><strong data-drive-accuracy>—</strong></article>
      </section>
      <div class="nxdrive-controls">
        <button class="nxpi-action" type="button" data-drive-start>START DRIVE</button>
        <button class="nxpi-action nxpi-action--danger" type="button" data-drive-stop disabled>STOP</button>
      </div>
      <p class="nxpi-status" data-drive-status>Foreground GPS only. Coordinates are never stored; only trip distance/time summaries are saved.</p>
    </section>
  `, 'nx-drive-premium');

  const gauge = root.querySelector('.nxgauge');
  const stateEl = root.querySelector('[data-drive-state]');
  const topEl = root.querySelector('[data-drive-top]');
  const distanceEl = root.querySelector('[data-drive-distance]');
  const durationEl = root.querySelector('[data-drive-duration]');
  const accuracyEl = root.querySelector('[data-drive-accuracy]');
  const status = root.querySelector('[data-drive-status]');
  const start = root.querySelector('[data-drive-start]');
  const stop = root.querySelector('[data-drive-stop]');

  let watchId = null;
  let timer = null;
  let storeKey = '';
  let ride = null;
  let lastFix = null;

  const paint = () => {
    const speed = Math.max(0, Number(ride?.speedKmh) || 0);
    setGauge(gauge, Math.min(1, speed / MAX_DRIVE_KMH), speed, ride ? 'LIVE SPEED' : 'READY', 0);
    topEl.textContent = `${Math.round(Number(ride?.topKmh) || 0)} km/h`;
    distanceEl.textContent = formatDistance(ride?.distanceM || 0);
    durationEl.textContent = formatDuration(ride ? Date.now() - ride.startedAt : 0);
  };

  const addMovement = (distanceM, movingMs) => {
    if (!storeKey || (!(distanceM > 0) && !(movingMs > 0))) return;
    const store = readDriveStore(storeKey);
    const row = dayRecord(store, localDayKey());
    row.distanceM += Math.max(0, Number(distanceM) || 0);
    row.movingMs += Math.max(0, Number(movingMs) || 0);
    writeDriveStore(storeKey, store);
  };

  const onFix = position => {
    if (!ride) return;
    const c = position.coords;
    const accuracy = Number(c.accuracy);
    accuracyEl.textContent = Number.isFinite(accuracy) ? `${Math.round(accuracy)} m` : '—';
    if (!Number.isFinite(accuracy) || accuracy > MAX_GPS_ACCURACY_M) {
      stateEl.textContent = 'GPS ACQUIRING';
      status.textContent = 'Waiting for a more accurate GPS fix…';
      return;
    }

    const now = Number(position.timestamp) || Date.now();
    const fix = { lat:Number(c.latitude), lon:Number(c.longitude), at:now };
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return;

    let segmentM = 0, dt = 0, calculatedKmh = 0;
    if (lastFix) {
      dt = Math.max(0, now - lastFix.at);
      segmentM = haversineM(lastFix, fix);
      if (dt > 0) calculatedKmh = (segmentM / (dt / 1000)) * 3.6;
    }

    const gpsKmh = Number.isFinite(c.speed) && c.speed >= 0 ? c.speed * 3.6 : NaN;
    let speedKmh = Number.isFinite(gpsKmh) ? gpsKmh : calculatedKmh;
    if (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > MAX_DRIVE_KMH) speedKmh = 0;

    if (lastFix && dt > 0 && calculatedKmh <= MAX_DRIVE_KMH && segmentM >= 1) {
      ride.distanceM += segmentM;
      const movingMs = speedKmh >= 2 ? dt : 0;
      ride.movingMs += movingMs;
      addMovement(segmentM, movingMs);
    }

    ride.speedKmh = speedKmh;
    ride.topKmh = Math.max(ride.topKmh, speedKmh);
    lastFix = fix;
    stateEl.textContent = speedKmh >= 2 ? 'DRIVING' : 'LIVE';
    status.textContent = 'GPS live • trip aggregates are being recorded.';
    paint();
  };

  const finish = () => {
    if (!ride) return;
    if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
    clearInterval(timer);
    watchId = null;
    timer = null;

    if (storeKey) {
      const store = readDriveStore(storeKey);
      const row = dayRecord(store, localDayKey(ride.startedAt));
      row.trips += 1;
      store.trips.unshift({
        at:new Date(ride.startedAt).toISOString(),
        endedAt:new Date().toISOString(),
        distanceM:Math.max(0, ride.distanceM || 0),
        movingMs:Math.max(0, ride.movingMs || 0),
        durationMs:Math.max(0, Date.now() - ride.startedAt),
        topKmh:Math.max(0, ride.topKmh || 0)
      });
      writeDriveStore(storeKey, store);
    }

    ride.speedKmh = 0;
    paint();
    ride = null;
    lastFix = null;
    stateEl.textContent = 'SAVED';
    status.textContent = 'Drive stopped • aggregate trip summary saved • coordinates were not stored.';
    start.disabled = false;
    stop.disabled = true;
  };

  start.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      status.textContent = 'GPS is not supported on this device.';
      return;
    }
    if (ride) return;
    storeKey = await driveStoreKey();
    ride = { startedAt:Date.now(), distanceM:0, movingMs:0, topKmh:0, speedKmh:0 };
    lastFix = null;
    start.disabled = true;
    stop.disabled = false;
    stateEl.textContent = 'STARTING';
    status.textContent = 'Starting high-accuracy GPS…';
    paint();
    timer = setInterval(paint, 1000);
    watchId = navigator.geolocation.watchPosition(onFix, error => {
      stateEl.textContent = 'GPS ERROR';
      status.textContent = `GPS unavailable: ${error.message || 'permission or signal error'}`;
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:1000 });
  });

  stop.addEventListener('click', finish);
  paint();
  root.__cleanup = () => {
    if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
    clearInterval(timer);
    watchId = null;
    timer = null;
  };
  return root;
}

function aggregateRange(store, startAt) {
  const start = dayStart(startAt).getTime();
  return Object.entries(store.days || {}).reduce((sum, [key, row]) => {
    const at = new Date(`${key}T00:00:00`).getTime();
    if (!Number.isFinite(at) || at < start) return sum;
    sum.distanceM += Number(row.distanceM) || 0;
    sum.movingMs += Number(row.movingMs) || 0;
    sum.trips += Number(row.trips) || 0;
    return sum;
  }, { distanceM:0, movingMs:0, trips:0 });
}

export function renderNovaTrackPremium() {
  const root = node(`
    <section class="nxtrack-console">
      <header><div><span>DRIVE ANALYTICS</span><strong>Nova Track</strong></div><b>PRIVATE AGGREGATES</b></header>
      <section class="nxtrack-summary">
        <article><span>TODAY</span><strong data-track-today>0.00 km</strong></article>
        <article><span>THIS WEEK</span><strong data-track-week>0.00 km</strong></article>
        <article><span>THIS MONTH</span><strong data-track-month>0.00 km</strong></article>
        <article><span>MOVING TODAY</span><strong data-track-time>00:00</strong></article>
      </section>
      <section class="nxtrack-chart">
        <header><span>LAST 7 DAYS</span><strong data-track-total>0.00 km</strong></header>
        <div class="nxtrack-bars" data-track-bars></div>
      </section>
    </section>
    <section class="nxtrack-trips">
      <header><span>RECENT TRIPS</span><strong>Nova Drive history</strong></header>
      <div data-track-trips></div>
    </section>
  `, 'nx-track-premium');

  const todayEl = root.querySelector('[data-track-today]');
  const weekEl = root.querySelector('[data-track-week]');
  const monthEl = root.querySelector('[data-track-month]');
  const timeEl = root.querySelector('[data-track-time]');
  const totalEl = root.querySelector('[data-track-total]');
  const barsEl = root.querySelector('[data-track-bars]');
  const tripsEl = root.querySelector('[data-track-trips]');
  let key = '';

  const draw = () => {
    if (!key) return;
    const store = readDriveStore(key);
    const today = store.days?.[localDayKey()] || { distanceM:0, movingMs:0, trips:0 };
    const week = aggregateRange(store, weekStart());
    const month = aggregateRange(store, monthStart());
    todayEl.textContent = formatDistance(today.distanceM || 0);
    weekEl.textContent = formatDistance(week.distanceM);
    monthEl.textContent = formatDistance(month.distanceM);
    timeEl.textContent = formatDuration(today.movingMs || 0);

    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const row = store.days?.[localDayKey(d)] || { distanceM:0, trips:0 };
      days.push({
        label:d.toLocaleDateString(undefined, { weekday:'short' }).slice(0, 2).toUpperCase(),
        distanceM:Number(row.distanceM) || 0,
        trips:Number(row.trips) || 0
      });
    }
    const max = Math.max(1, ...days.map(day => day.distanceM));
    const total = days.reduce((sum, day) => sum + day.distanceM, 0);
    totalEl.textContent = formatDistance(total);
    barsEl.innerHTML = days.map(day => {
      const height = Math.max(5, day.distanceM / max * 100);
      return `<article title="${escapeHtml(formatDistance(day.distanceM))} • ${day.trips} trips">
        <div><i style="height:${height.toFixed(2)}%"></i></div>
        <strong>${escapeHtml(day.label)}</strong>
        <span>${day.distanceM > 0 ? (day.distanceM / 1000).toFixed(1) : '0'}</span>
      </article>`;
    }).join('');

    tripsEl.innerHTML = store.trips.length ? store.trips.slice(0, 12).map(trip => `
      <article class="nxtrack-trip">
        <div><strong>${escapeHtml(new Date(trip.at).toLocaleDateString([], { day:'2-digit', month:'short' }))}</strong><span>${escapeHtml(new Date(trip.at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }))}</span></div>
        <b>${escapeHtml(formatDistance(trip.distanceM))}</b>
        <small>${escapeHtml(formatDuration(trip.durationMs))} • top ${Math.round(Number(trip.topKmh) || 0)} km/h</small>
      </article>
    `).join('') : '<div class="nx-empty">No recorded drives yet.</div>';
  };

  driveStoreKey().then(value => { key = value; draw(); });
  window.addEventListener('nexusnova:drive-track-updated', draw);
  root.__cleanup = () => window.removeEventListener('nexusnova:drive-track-updated', draw);
  return root;
}

export const premiumDriveRenderers = Object.freeze({
  'nova-drive': renderNovaDrivePremium,
  'nova-track': renderNovaTrackPremium
});
