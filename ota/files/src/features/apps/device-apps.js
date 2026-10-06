import { escapeHtml, loadJson, saveJson, uid } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

async function accountId() {
  try {
    const user = await requireFirebaseUser();
    return String(user?.uid || '').trim() || 'device';
  } catch {
    return 'device';
  }
}

function normalizeEmergencyPhone(value) {
  let phone = String(value || '').trim().replace(/[^\d+]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^03\d{9}$/.test(phone)) phone = `+92${phone.slice(1)}`;
  return /^\+?\d{7,15}$/.test(phone) ? phone : '';
}

export function renderEmergency() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col">
        <label class="nx-field"><span>Name</span><input maxlength="80" data-em-name placeholder="Family member"></label>
        <label class="nx-field"><span>Phone</span><input inputmode="tel" maxlength="18" data-em-phone placeholder="03XXXXXXXXX"></label>
      </div>
      <button class="nx-primary" type="button" data-em-add>ADD EMERGENCY CONTACT</button>
      <p class="nx-tool-meta" data-em-status>Contacts stay on this device for the signed-in NexusNova account.</p>
    </section>
    <section class="nx-stack" data-em-list></section>
  `);

  const name = root.querySelector('[data-em-name]');
  const phone = root.querySelector('[data-em-phone]');
  const status = root.querySelector('[data-em-status]');
  const list = root.querySelector('[data-em-list]');
  let key = '';

  const draw = () => {
    if (!key) return;
    const contacts = loadJson(key, []);
    list.innerHTML = contacts.length ? contacts.map(contact => `
      <article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${escapeHtml(contact.name)}</strong><button class="nx-icon-button" type="button" data-em-delete="${escapeHtml(contact.id)}">×</button></div>
        <p>${escapeHtml(contact.phone)}</p>
        <button class="nx-primary" type="button" data-em-call="${escapeHtml(contact.phone)}">CALL</button>
      </article>
    `).join('') : '<div class="nx-empty">No family emergency contacts saved.</div>';

    list.querySelectorAll('[data-em-call]').forEach(button => button.addEventListener('click', () => {
      const safePhone = normalizeEmergencyPhone(button.dataset.emCall);
      if (!safePhone) return;
      window.location.href = `tel:${safePhone}`;
    }));

    list.querySelectorAll('[data-em-delete]').forEach(button => button.addEventListener('click', () => {
      saveJson(key, loadJson(key, []).filter(contact => contact.id !== button.dataset.emDelete));
      draw();
    }));
  };

  accountId().then(id => {
    key = id === 'device' ? 'nexusnovaEmergencyContacts:device' : `nexusnovaEmergencyContacts:${id}`;
    draw();
  });

  root.querySelector('[data-em-add]').addEventListener('click', () => {
    if (!key) return;
    const cleanName = name.value.trim().slice(0, 80);
    const cleanPhone = normalizeEmergencyPhone(phone.value);
    if (!cleanName) {
      status.textContent = 'Enter a contact name.';
      return;
    }
    if (!cleanPhone) {
      status.textContent = 'Enter a valid phone number.';
      return;
    }
    const contacts = loadJson(key, []);
    contacts.push({ id: uid('emergency'), name: cleanName, phone: cleanPhone });
    saveJson(key, contacts.slice(-50));
    name.value = '';
    phone.value = '';
    status.textContent = 'Emergency contact saved.';
    draw();
  });

  return root;
}

export function renderLocation() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col">
        <div class="nx-list-card"><strong data-loc-lat>—</strong><p>Latitude</p></div>
        <div class="nx-list-card"><strong data-loc-lon>—</strong><p>Longitude</p></div>
      </div>
      <div class="nx-two-col">
        <div class="nx-list-card"><strong data-loc-accuracy>—</strong><p>Accuracy</p></div>
        <div class="nx-list-card"><strong data-loc-altitude>—</strong><p>Altitude</p></div>
      </div>
      <button class="nx-primary" type="button" data-loc-refresh>GET MY LOCATION</button>
      <div class="nx-two-col">
        <button type="button" data-loc-copy disabled>COPY COORDINATES</button>
        <button type="button" data-loc-map disabled>OPEN MAP</button>
      </div>
      <p class="nx-tool-meta" data-loc-status>Your coordinates are shown live and are not stored by this screen.</p>
    </section>
  `);

  const latEl = root.querySelector('[data-loc-lat]');
  const lonEl = root.querySelector('[data-loc-lon]');
  const accuracyEl = root.querySelector('[data-loc-accuracy]');
  const altitudeEl = root.querySelector('[data-loc-altitude]');
  const status = root.querySelector('[data-loc-status]');
  const refresh = root.querySelector('[data-loc-refresh]');
  const copy = root.querySelector('[data-loc-copy]');
  const map = root.querySelector('[data-loc-map]');
  let current = null;

  const getLocation = () => {
    if (!navigator.geolocation) {
      status.textContent = 'Location is not supported on this device.';
      return;
    }
    refresh.disabled = true;
    status.textContent = 'Getting current GPS location…';
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude, accuracy, altitude } = position.coords;
      current = { latitude, longitude };
      latEl.textContent = Number(latitude).toFixed(6);
      lonEl.textContent = Number(longitude).toFixed(6);
      accuracyEl.textContent = Number.isFinite(accuracy) ? `${Math.round(accuracy)} m` : '—';
      altitudeEl.textContent = Number.isFinite(altitude) ? `${Math.round(altitude)} m` : '—';
      status.textContent = 'Live location ready. Coordinates were not saved.';
      copy.disabled = false;
      map.disabled = false;
      refresh.disabled = false;
    }, error => {
      status.textContent = `Location unavailable: ${error.message || 'permission or GPS error'}`;
      refresh.disabled = false;
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  };

  refresh.addEventListener('click', getLocation);
  copy.addEventListener('click', async () => {
    if (!current) return;
    const text = `${current.latitude.toFixed(6)}, ${current.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Coordinates copied.';
    } catch {
      status.textContent = text;
    }
  });
  map.addEventListener('click', () => {
    if (!current) return;
    const url = `https://www.google.com/maps?q=${encodeURIComponent(`${current.latitude},${current.longitude}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  return root;
}

const MAX_HISTORY = 90;
const MAX_REASONABLE_KMH = 240;
const MAX_ACCEPTABLE_ACCURACY_M = 80;

function emptyDriveStore() {
  return { version: 1, days: {}, trips: [] };
}

function localDayKey(value = new Date()) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayStart(value = new Date()) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekStart(value = new Date()) {
  const d = dayStart(value);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  return d;
}

function monthStart(value = new Date()) {
  const d = dayStart(value);
  d.setDate(1);
  return d;
}

function readDriveStore(key) {
  const raw = loadJson(key, null);
  if (!raw || typeof raw !== 'object') return emptyDriveStore();
  return {
    version: 1,
    days: raw.days && typeof raw.days === 'object' ? raw.days : {},
    trips: Array.isArray(raw.trips) ? raw.trips.slice(0, MAX_HISTORY) : []
  };
}

function writeDriveStore(key, store) {
  store.trips = Array.isArray(store.trips) ? store.trips.slice(0, MAX_HISTORY) : [];
  saveJson(key, store);
  window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
}

function dayRecord(store, key) {
  if (!store.days[key] || typeof store.days[key] !== 'object') {
    store.days[key] = { distanceM: 0, movingMs: 0, trips: 0 };
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

async function driveStoreKey() {
  const id = await accountId();
  return `nexusnova_drive_track_v1:${id}`;
}

export function renderNovaDrive() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-list-card"><strong data-drive-speed style="font-size:2.3rem">0</strong><p>km/h live speed</p></div>
      <div class="nx-two-col">
        <div class="nx-list-card"><strong data-drive-top>0 km/h</strong><p>Top speed</p></div>
        <div class="nx-list-card"><strong data-drive-distance>0.00 km</strong><p>Trip distance</p></div>
      </div>
      <div class="nx-two-col">
        <div class="nx-list-card"><strong data-drive-duration>00:00</strong><p>Duration</p></div>
        <div class="nx-list-card"><strong data-drive-accuracy>—</strong><p>GPS accuracy</p></div>
      </div>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-drive-start>START DRIVE</button>
        <button type="button" data-drive-stop disabled>STOP</button>
      </div>
      <p class="nx-tool-meta" data-drive-status>Foreground GPS only. Coordinates are never stored; only trip distance/time summaries are saved.</p>
    </section>
  `);

  const speedEl = root.querySelector('[data-drive-speed]');
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
    const duration = ride ? Date.now() - ride.startedAt : 0;
    speedEl.textContent = Math.round(ride?.speedKmh || 0);
    topEl.textContent = `${Math.round(ride?.topKmh || 0)} km/h`;
    distanceEl.textContent = formatDistance(ride?.distanceM || 0);
    durationEl.textContent = formatDuration(duration);
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
    if (!Number.isFinite(accuracy) || accuracy > MAX_ACCEPTABLE_ACCURACY_M) {
      status.textContent = 'Waiting for a more accurate GPS fix…';
      return;
    }

    const now = Number(position.timestamp) || Date.now();
    const fix = { lat: Number(c.latitude), lon: Number(c.longitude), at: now };
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return;

    let segmentM = 0;
    let dt = 0;
    let calculatedKmh = 0;
    if (lastFix) {
      dt = Math.max(0, now - lastFix.at);
      segmentM = haversineM(lastFix, fix);
      if (dt > 0) calculatedKmh = (segmentM / (dt / 1000)) * 3.6;
    }

    const gpsKmh = Number.isFinite(c.speed) && c.speed >= 0 ? c.speed * 3.6 : NaN;
    let speedKmh = Number.isFinite(gpsKmh) ? gpsKmh : calculatedKmh;
    if (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > MAX_REASONABLE_KMH) speedKmh = 0;

    if (lastFix && dt > 0 && calculatedKmh <= MAX_REASONABLE_KMH && segmentM >= 1) {
      ride.distanceM += segmentM;
      const movingMs = speedKmh >= 2 ? dt : 0;
      ride.movingMs += movingMs;
      addMovement(segmentM, movingMs);
    }

    ride.speedKmh = speedKmh;
    ride.topKmh = Math.max(ride.topKmh, speedKmh);
    lastFix = fix;
    status.textContent = 'GPS live. Trip aggregates are being recorded.';
    paint();
  };

  const finish = () => {
    if (!ride) return;
    if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
    watchId = null;
    clearInterval(timer);
    timer = null;

    if (storeKey) {
      const store = readDriveStore(storeKey);
      const row = dayRecord(store, localDayKey(ride.startedAt));
      row.trips += 1;
      store.trips.unshift({
        at: new Date(ride.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        distanceM: Math.max(0, ride.distanceM || 0),
        movingMs: Math.max(0, ride.movingMs || 0),
        durationMs: Math.max(0, Date.now() - ride.startedAt),
        topKmh: Math.max(0, ride.topKmh || 0)
      });
      writeDriveStore(storeKey, store);
    }

    ride.speedKmh = 0;
    paint();
    status.textContent = 'Drive stopped. Aggregate trip summary saved; coordinates were not stored.';
    start.disabled = false;
    stop.disabled = true;
    ride = null;
    lastFix = null;
  };

  start.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      status.textContent = 'GPS is not supported on this device.';
      return;
    }
    if (ride) return;
    storeKey = await driveStoreKey();
    ride = { startedAt: Date.now(), distanceM: 0, movingMs: 0, topKmh: 0, speedKmh: 0 };
    lastFix = null;
    start.disabled = true;
    stop.disabled = false;
    status.textContent = 'Starting high-accuracy GPS…';
    paint();
    timer = setInterval(paint, 1000);
    watchId = navigator.geolocation.watchPosition(onFix, error => {
      status.textContent = `GPS unavailable: ${error.message || 'permission or signal error'}`;
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 });
  });

  stop.addEventListener('click', finish);
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
  }, { distanceM: 0, movingMs: 0, trips: 0 });
}

export function renderNovaTrack() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-two-col">
        <div class="nx-list-card"><strong data-track-today>0.00 km</strong><p>Today</p></div>
        <div class="nx-list-card"><strong data-track-week>0.00 km</strong><p>This week</p></div>
      </div>
      <div class="nx-two-col">
        <div class="nx-list-card"><strong data-track-month>0.00 km</strong><p>This month</p></div>
        <div class="nx-list-card"><strong data-track-time>00:00</strong><p>Today moving time</p></div>
      </div>
      <p class="nx-tool-meta">Nova Track reads only aggregate distance/time/trip summaries saved by Nova Drive.</p>
    </section>
    <section class="nx-tool-card"><strong>Last 7 days</strong><div class="nx-stack" data-track-days></div></section>
    <section class="nx-tool-card"><strong>Recent trips</strong><div class="nx-stack" data-track-trips></div></section>
  `);

  const todayEl = root.querySelector('[data-track-today]');
  const weekEl = root.querySelector('[data-track-week]');
  const monthEl = root.querySelector('[data-track-month]');
  const timeEl = root.querySelector('[data-track-time]');
  const daysEl = root.querySelector('[data-track-days]');
  const tripsEl = root.querySelector('[data-track-trips]');
  let key = '';

  const draw = () => {
    if (!key) return;
    const store = readDriveStore(key);
    const today = store.days?.[localDayKey()] || { distanceM: 0, movingMs: 0, trips: 0 };
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
      const row = store.days?.[localDayKey(d)] || { distanceM: 0, trips: 0 };
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), row });
    }
    daysEl.innerHTML = days.map(item => `<article class="nx-list-card"><div class="nx-list-card__head"><strong>${escapeHtml(item.label)}</strong><span>${formatDistance(item.row.distanceM || 0)}</span></div><p>${Number(item.row.trips) || 0} trip${Number(item.row.trips) === 1 ? '' : 's'}</p></article>`).join('');

    tripsEl.innerHTML = store.trips.length ? store.trips.slice(0, 12).map(trip => `
      <article class="nx-list-card">
        <div class="nx-list-card__head"><strong>${new Date(trip.at).toLocaleString()}</strong><span>${formatDistance(trip.distanceM)}</span></div>
        <p>${formatDuration(trip.durationMs)} • top ${Math.round(Number(trip.topKmh) || 0)} km/h</p>
      </article>
    `).join('') : '<div class="nx-empty">No recorded drives yet.</div>';
  };

  driveStoreKey().then(value => { key = value; draw(); });
  window.addEventListener('nexusnova:drive-track-updated', draw);
  root.__cleanup = () => window.removeEventListener('nexusnova:drive-track-updated', draw);
  return root;
}

export const deviceRenderers = Object.freeze({
  emergency: renderEmergency,
  location: renderLocation,
  'nova-drive': renderNovaDrive,
  'nova-track': renderNovaTrack
});
