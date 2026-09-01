import { hydrateDriveTrackState, loadDriveTrackState, persistDriveTrackState } from '../../core/drive-track-persistence.js';
import { premiumDriveRenderers } from './premium-drive-tools.js';

const HISTORY_LIMIT = 90;
const TRACKING_PREF = 'nexusnova_drive_smart_tracking_v3';
const importedNativeIds = new Set();

function nativeBridgeReady() {
  return typeof window.NexusAndroid?.postMessage === 'function' && typeof window.nexusPostNativeAction === 'function';
}

function post(action) {
  return window.nexusPostNativeAction?.(action) === true;
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

function announceStoreUpdate() {
  window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
}

async function importCompletedTrip(completed) {
  if (!completed || typeof completed !== 'object') return false;
  const nativeId = String(completed.nativeId || '').trim();
  if (!nativeId || importedNativeIds.has(nativeId)) return false;

  const state = await loadDriveTrackState();
  const store = state.store;
  if (store.trips.some(row => row?.nativeId === nativeId)) {
    importedNativeIds.add(nativeId);
    return false;
  }

  const atMs = Number(completed.at) || Date.now();
  const distanceM = Math.max(0, Number(completed.distanceM) || 0);
  const movingMs = Math.max(0, Number(completed.movingMs) || 0);
  const durationMs = Math.max(0, Number(completed.durationMs) || movingMs);
  const topKmh = Math.max(0, Number(completed.topKmh) || 0);
  const avgKmh = movingMs > 0 ? (distanceM / (movingMs / 1000)) * 3.6 : Math.max(0, Number(completed.avgKmh) || 0);
  const mode = String(completed.mode || '').toLowerCase() === 'bicycle' ? 'bicycle' : 'motor';
  const day = localDayKey(atMs);
  const row = store.days[day] && typeof store.days[day] === 'object'
    ? store.days[day]
    : { distanceM:0, movingMs:0, trips:0 };

  row.distanceM = (Number(row.distanceM) || 0) + distanceM;
  row.movingMs = (Number(row.movingMs) || 0) + movingMs;
  row.trips = (Number(row.trips) || 0) + 1;
  store.days[day] = row;
  store.trips.unshift({
    nativeId,
    at:new Date(atMs).toISOString(),
    endedAt:new Date(Number(completed.endedAt) || Date.now()).toISOString(),
    distanceM,
    movingMs,
    durationMs,
    topKmh,
    avgKmh,
    mode
  });
  store.trips = store.trips.slice(0, HISTORY_LIMIT);

  announceStoreUpdate();
  const result = await persistDriveTrackState(store);
  importedNativeIds.add(nativeId);
  return result?.cloud === true;
}

async function importCompletedQueue(detail) {
  const queue = Array.isArray(detail?.completedTrips)
    ? detail.completedTrips
    : detail?.completedTrip ? [detail.completedTrip] : [];
  for (const trip of queue) {
    try { await importCompletedTrip(trip); } catch {}
  }
}

function durationText(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function distanceText(meters, compact = false) {
  const km = Math.max(0, Number(meters) || 0) / 1000;
  if (compact) return km < 10 ? `${km.toFixed(1)}k` : `${Math.round(km)}k`;
  return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

function compassPoint(degrees) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const value = (((Number(degrees) || 0) % 360) + 360) % 360;
  return names[Math.round(value / 45) % 8];
}

function needleDegree(kmh) {
  const n = Math.max(0, Math.min(240, Number(kmh) || 0));
  return -130 + (n / 240) * 260;
}

function requestPreciseLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(new Error(error?.message || 'Precise location permission is required.')),
      { enableHighAccuracy:true, timeout:15000, maximumAge:0 }
    );
  });
}

function trackingPreference() {
  try { return localStorage.getItem(TRACKING_PREF) !== 'off'; }
  catch { return true; }
}

function saveTrackingPreference(enabled) {
  try { localStorage.setItem(TRACKING_PREF, enabled ? 'on' : 'off'); } catch {}
}

function modeLabel(mode) {
  return String(mode || '').toLowerCase() === 'bicycle' ? 'BICYCLE' : 'MOTOR';
}

function modeIcon(mode) {
  return String(mode || '').toLowerCase() === 'bicycle' ? '🚲' : '🚗';
}

function dashboardStyles() {
  return `<style>
  .nx-drive-v3-screen{overflow:hidden!important;height:100dvh!important;min-height:0!important;background:#020812!important}
  .nx-drive-v3-screen>.nx-app-head{display:none!important}
  .nxdr3{--cyan:#43d5ff;--blue:#2f8cff;--purple:#9877ff;--line:rgba(116,183,255,.19);height:100dvh;max-height:100dvh;overflow:hidden;padding:max(9px,env(safe-area-inset-top)) 10px max(9px,env(safe-area-inset-bottom));box-sizing:border-box;color:#f5fbff;background:radial-gradient(circle at 50% -10%,rgba(48,132,255,.22),transparent 35%),radial-gradient(circle at 100% 55%,rgba(124,70,255,.12),transparent 32%),linear-gradient(180deg,#061427 0%,#020913 58%,#01060d 100%);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:7px}
  .nxdr3 *{box-sizing:border-box}.nxdr3 button{font:inherit}
  .nxdr3-top{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;min-height:47px;padding:5px 7px 5px 10px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(145deg,rgba(15,37,61,.9),rgba(5,20,36,.82));box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 30px rgba(0,0,0,.24)}
  .nxdr3-brand{min-width:0}.nxdr3-brand small{display:block;color:var(--cyan);font-size:7px;font-weight:950;letter-spacing:.17em}.nxdr3-brand strong{display:block;margin-top:2px;font-size:18px;line-height:1;letter-spacing:-.035em}.nxdr3-brand span{display:block;margin-top:3px;color:#89a5bd;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nxdr3-toggle{height:34px;padding:0 10px;border:1px solid rgba(81,218,255,.25);border-radius:12px;background:linear-gradient(180deg,rgba(13,65,91,.92),rgba(7,35,55,.94));color:#dff9ff;font-size:8px;font-weight:950;letter-spacing:.08em;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 5px 18px rgba(0,154,255,.12)}
  .nxdr3-toggle.is-off{border-color:rgba(255,138,138,.2);background:linear-gradient(180deg,#38202a,#21131c);color:#ffb7bd}
  .nxdr3-main{min-height:0;display:grid;grid-template-columns:minmax(0,1.18fr) minmax(122px,.82fr);gap:7px}
  .nxdr3-meter-card,.nxdr3-intel{min-height:0;border:1px solid var(--line);border-radius:20px;background:linear-gradient(155deg,rgba(8,28,48,.96),rgba(2,12,23,.97));box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 14px 34px rgba(0,0,0,.24);overflow:hidden}
  .nxdr3-meter-card{display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:9px 9px 8px}
  .nxdr3-state-row{display:flex;align-items:center;justify-content:space-between;gap:6px}.nxdr3-state{display:flex;align-items:center;gap:6px;min-width:0}.nxdr3-dot{width:7px;height:7px;border-radius:50%;background:#22e56c;box-shadow:0 0 12px rgba(34,229,108,.7)}.nxdr3-dot.is-wait{background:#ffc94a;box-shadow:0 0 12px rgba(255,201,74,.55)}.nxdr3-state strong{font-size:8px;letter-spacing:.08em;white-space:nowrap}.nxdr3-gps{color:#8ba6be;font-size:7px;white-space:nowrap}
  .nxdr3-gauge-wrap{position:relative;min-height:0;display:grid;place-items:center;padding:2px}
  .nxdr3-gauge{position:relative;width:min(100%,31vh,270px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 52%,#081624 0 37%,#091c2d 38% 49%,#02070d 50% 59%,#152a38 60% 61%,#080e15 62% 69%,#69737a 70% 71%,#131a20 72% 76%,#03070a 77%);box-shadow:inset 0 0 0 2px rgba(214,242,255,.13),inset 0 0 32px rgba(48,160,255,.14),0 15px 35px rgba(0,0,0,.55),0 0 22px rgba(31,148,255,.12)}
  .nxdr3-gauge:before{content:"";position:absolute;inset:9%;border-radius:50%;background:conic-gradient(from 220deg,rgba(48,208,255,.95) 0 24%,rgba(64,117,255,.5) 24% 42%,rgba(118,77,255,.16) 42% 58%,transparent 58% 100%);mask:radial-gradient(circle,transparent 0 77%,#000 78%);-webkit-mask:radial-gradient(circle,transparent 0 77%,#000 78%);filter:drop-shadow(0 0 5px rgba(55,190,255,.55));opacity:.78}
  .nxdr3-gauge:after{content:"";position:absolute;inset:8%;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,.17),transparent 28%,transparent 68%,rgba(95,200,255,.035));clip-path:polygon(0 0,100% 0,78% 38%,17% 29%);pointer-events:none}
  .nxdr3-needle{position:absolute;left:50%;top:50%;width:3px;height:39%;border-radius:99px;background:linear-gradient(#f5ffff,var(--cyan));transform-origin:50% 96%;transform:translate(-50%,-96%) rotate(-130deg);box-shadow:0 0 9px rgba(65,213,255,.75);transition:transform .32s cubic-bezier(.2,.7,.2,1);z-index:3}
  .nxdr3-hub{position:absolute;left:50%;top:50%;width:30px;height:30px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 28%,#d9eef7,#65737d 28%,#15212a 55%,#03070b 74%);border:2px solid #83939d;box-shadow:0 5px 12px rgba(0,0,0,.55);z-index:4}
  .nxdr3-speed{position:absolute;left:50%;top:63%;transform:translate(-50%,-50%);text-align:center;z-index:5}.nxdr3-speed strong{display:block;font-size:clamp(28px,8vw,47px);font-weight:550;line-height:.88;letter-spacing:-.06em;text-shadow:0 4px 15px #000}.nxdr3-speed span{display:block;margin-top:4px;color:#8bbbd8;font-size:7px;font-weight:950;letter-spacing:.12em}
  .nxdr3-mode-chip{justify-self:center;display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:0 8px;border:1px solid rgba(97,191,255,.18);border-radius:999px;background:rgba(5,24,40,.88);color:#b9d8eb;font-size:7px;font-weight:900;letter-spacing:.06em}
  .nxdr3-intel{padding:8px;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:7px}.nxdr3-detect{padding:8px;border:1px solid rgba(92,177,255,.15);border-radius:14px;background:linear-gradient(135deg,rgba(20,55,84,.66),rgba(8,30,52,.62))}.nxdr3-detect small{display:block;color:#6ddfff;font-size:6px;font-weight:950;letter-spacing:.15em}.nxdr3-detect strong{display:block;margin-top:3px;font-size:11px}.nxdr3-detect span{display:block;margin-top:3px;color:#91a9bc;font-size:7px;line-height:1.2}
  .nxdr3-metrics{display:grid;grid-template-columns:1fr 1fr;gap:5px}.nxdr3-metric{min-width:0;padding:7px 6px;border:1px solid rgba(110,175,225,.12);border-radius:12px;background:linear-gradient(155deg,rgba(12,35,57,.72),rgba(5,20,34,.72))}.nxdr3-metric span{display:block;color:#7893aa;font-size:6px;font-weight:900;letter-spacing:.07em}.nxdr3-metric strong{display:block;margin-top:3px;font-size:11px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nxdr3-status{align-self:end;min-height:38px;padding:7px;border-radius:12px;background:rgba(2,13,24,.7);border:1px solid rgba(90,155,210,.1);color:#a8bac9;font-size:7px;line-height:1.32;display:flex;align-items:center}
  .nxdr3-analytics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.nxdr3-stat{min-width:0;padding:7px 5px;border:1px solid rgba(100,166,220,.13);border-radius:13px;background:linear-gradient(160deg,rgba(9,31,52,.92),rgba(3,16,29,.93));text-align:center}.nxdr3-stat span{display:block;color:#7897af;font-size:6px;font-weight:900;letter-spacing:.07em}.nxdr3-stat strong{display:block;margin-top:3px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxdr3-stat small{display:block;margin-top:2px;color:#4dcfff;font-size:6px}
  .nxdr3-bottom{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:stretch}.nxdr3-last{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px 8px;border:1px solid rgba(113,178,228,.13);border-radius:14px;background:linear-gradient(155deg,rgba(9,30,50,.9),rgba(3,15,27,.92))}.nxdr3-last-icon{font-size:15px}.nxdr3-last div{min-width:0}.nxdr3-last span{display:block;color:#7391a8;font-size:6px;font-weight:900}.nxdr3-last strong{display:block;margin-top:2px;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxdr3-last b{font-size:9px;color:#dff9ff;white-space:nowrap}.nxdr3-recover{min-width:84px;border:1px solid rgba(103,199,255,.2);border-radius:14px;background:linear-gradient(180deg,rgba(12,54,81,.94),rgba(5,29,48,.96));color:#aeeeff;font-size:7px;font-weight:950;letter-spacing:.06em;padding:0 9px}.nxdr3-recover:disabled{opacity:.55}
  @media(max-height:720px){.nxdr3{padding-top:6px;padding-bottom:6px;gap:5px}.nxdr3-top{min-height:41px}.nxdr3-brand strong{font-size:16px}.nxdr3-gauge{width:min(100%,28vh,220px)}.nxdr3-meter-card{padding:7px}.nxdr3-intel{padding:6px;gap:5px}.nxdr3-detect{padding:6px}.nxdr3-metric{padding:5px}.nxdr3-status{min-height:30px;padding:5px}.nxdr3-stat{padding:5px 3px}.nxdr3-last{padding:5px 7px}}
  @media(max-width:355px){.nxdr3{padding-left:7px;padding-right:7px}.nxdr3-main{grid-template-columns:minmax(0,1.08fr) minmax(112px,.92fr);gap:5px}.nxdr3-gauge{width:min(100%,27vh,205px)}.nxdr3-metrics{gap:4px}.nxdr3-metric strong{font-size:10px}.nxdr3-toggle{padding:0 8px}.nxdr3-recover{min-width:72px;padding:0 6px}}
  @media(prefers-reduced-motion:reduce){.nxdr3-needle{transition:none}}
  </style>`;
}

function buildDashboard() {
  const root = document.createElement('section');
  root.className = 'nxdr3';
  root.innerHTML = `${dashboardStyles()}
    <header class="nxdr3-top">
      <div class="nxdr3-brand"><small>SMART MOBILITY CONSOLE</small><strong>Nova Drive</strong><span>Auto vehicle + bicycle trip intelligence</span></div>
      <button class="nxdr3-toggle" type="button" data-dr-toggle>TRACKING ON</button>
    </header>
    <section class="nxdr3-main">
      <article class="nxdr3-meter-card">
        <div class="nxdr3-state-row"><div class="nxdr3-state"><i class="nxdr3-dot is-wait" data-dr-dot></i><strong data-dr-state>ARMING</strong></div><span class="nxdr3-gps" data-dr-gps>GPS —</span></div>
        <div class="nxdr3-gauge-wrap">
          <div class="nxdr3-gauge"><i class="nxdr3-needle" data-dr-needle></i><i class="nxdr3-hub"></i><div class="nxdr3-speed"><strong data-dr-value>0</strong><span>KM/H</span></div></div>
        </div>
        <div class="nxdr3-mode-chip"><span data-dr-mode-icon>🚗</span><span data-dr-mode>WAITING FOR TRIP</span></div>
      </article>
      <aside class="nxdr3-intel">
        <div class="nxdr3-detect"><small>LIVE DETECTION</small><strong data-dr-activity>SMART GPS</strong><span data-dr-confidence>Walking ignored • vehicle/bicycle auto-detect</span></div>
        <div class="nxdr3-metrics">
          <article class="nxdr3-metric"><span>DISTANCE</span><strong data-dr-distance>0.00 km</strong></article>
          <article class="nxdr3-metric"><span>MOVING AVG</span><strong data-dr-average>0 km/h</strong></article>
          <article class="nxdr3-metric"><span>TOP SPEED</span><strong data-dr-top>0 km/h</strong></article>
          <article class="nxdr3-metric"><span>MOVING TIME</span><strong data-dr-duration>00:00</strong></article>
          <article class="nxdr3-metric"><span>HEADING</span><strong data-dr-heading>—</strong></article>
          <article class="nxdr3-metric"><span>CLOUD</span><strong data-dr-cloud>CHECKING</strong></article>
        </div>
        <div class="nxdr3-status" data-dr-status>Nova Drive is preparing smart background tracking.</div>
      </aside>
    </section>
    <section class="nxdr3-analytics">
      <article class="nxdr3-stat"><span>TODAY</span><strong data-dr-today>0.00 km</strong><small data-dr-today-trips>0 trips</small></article>
      <article class="nxdr3-stat"><span>THIS WEEK</span><strong data-dr-week>0.00 km</strong><small>analytics</small></article>
      <article class="nxdr3-stat"><span>THIS MONTH</span><strong data-dr-month>0.00 km</strong><small>analytics</small></article>
      <article class="nxdr3-stat"><span>HISTORY</span><strong data-dr-count>0 trips</strong><small>Nova Track merged</small></article>
    </section>
    <footer class="nxdr3-bottom">
      <div class="nxdr3-last"><span class="nxdr3-last-icon" data-dr-last-icon>🚗</span><div><span>LAST RECORDED TRIP</span><strong data-dr-last-title>No recorded drive yet</strong></div><b data-dr-last-distance>—</b></div>
      <button class="nxdr3-recover" type="button" data-dr-recover>↻ RECOVER</button>
    </footer>`;
  return root;
}

export function renderNovaDriveNativeV2() {
  if (!nativeBridgeReady()) return premiumDriveRenderers['nova-drive']?.();
  const root = buildDashboard();
  const screen = root.closest('.nx-screen');
  queueMicrotask(() => root.closest('.nx-screen')?.classList.add('nx-drive-v3-screen'));

  const toggle = root.querySelector('[data-dr-toggle]');
  const needle = root.querySelector('[data-dr-needle]');
  const valueEl = root.querySelector('[data-dr-value]');
  const stateEl = root.querySelector('[data-dr-state]');
  const dotEl = root.querySelector('[data-dr-dot]');
  const gpsEl = root.querySelector('[data-dr-gps]');
  const modeEl = root.querySelector('[data-dr-mode]');
  const modeIconEl = root.querySelector('[data-dr-mode-icon]');
  const activityEl = root.querySelector('[data-dr-activity]');
  const confidenceEl = root.querySelector('[data-dr-confidence]');
  const distanceEl = root.querySelector('[data-dr-distance]');
  const averageEl = root.querySelector('[data-dr-average]');
  const topEl = root.querySelector('[data-dr-top]');
  const durationEl = root.querySelector('[data-dr-duration]');
  const headingEl = root.querySelector('[data-dr-heading]');
  const cloudEl = root.querySelector('[data-dr-cloud]');
  const statusEl = root.querySelector('[data-dr-status]');
  const todayEl = root.querySelector('[data-dr-today]');
  const todayTripsEl = root.querySelector('[data-dr-today-trips]');
  const weekEl = root.querySelector('[data-dr-week]');
  const monthEl = root.querySelector('[data-dr-month]');
  const countEl = root.querySelector('[data-dr-count]');
  const lastIconEl = root.querySelector('[data-dr-last-icon]');
  const lastTitleEl = root.querySelector('[data-dr-last-title]');
  const lastDistanceEl = root.querySelector('[data-dr-last-distance]');
  const recover = root.querySelector('[data-dr-recover]');

  let snapshot = { armed:false, active:false, paused:false };
  let disposed = false;
  let autoArmAttempted = false;

  const setCloud = ready => {
    if (!cloudEl) return;
    cloudEl.textContent = ready ? 'SYNCED' : 'LOCAL';
  };

  const drawHistory = async () => {
    if (disposed) return;
    const state = await loadDriveTrackState();
    if (disposed) return;
    const store = state.store;
    const today = store.days?.[localDayKey()] || { distanceM:0, trips:0 };
    const week = aggregateRange(store, weekStart());
    const month = aggregateRange(store, monthStart());
    if (todayEl) todayEl.textContent = distanceText(today.distanceM || 0);
    if (todayTripsEl) todayTripsEl.textContent = `${Number(today.trips) || 0} trip${Number(today.trips) === 1 ? '' : 's'}`;
    if (weekEl) weekEl.textContent = distanceText(week.distanceM);
    if (monthEl) monthEl.textContent = distanceText(month.distanceM);
    if (countEl) countEl.textContent = `${store.trips.length} trips`;
    const last = store.trips[0];
    if (last) {
      const mode = last.mode === 'bicycle' ? 'bicycle' : 'motor';
      if (lastIconEl) lastIconEl.textContent = modeIcon(mode);
      if (lastTitleEl) lastTitleEl.textContent = `${modeLabel(mode)} • ${new Date(last.at).toLocaleDateString([], { day:'2-digit', month:'short' })} • avg ${Math.round(Number(last.avgKmh) || 0)} km/h`;
      if (lastDistanceEl) lastDistanceEl.textContent = distanceText(last.distanceM);
    } else {
      if (lastIconEl) lastIconEl.textContent = '🚗';
      if (lastTitleEl) lastTitleEl.textContent = 'No recorded drive yet';
      if (lastDistanceEl) lastDistanceEl.textContent = '—';
    }
  };

  const paint = detail => {
    if (disposed || !detail || typeof detail !== 'object') return;
    snapshot = detail;
    const armed = detail.armed === true;
    const active = detail.active === true;
    const paused = detail.paused === true;
    const speed = paused ? 0 : Math.max(0, Number(detail.speedKmh) || 0);
    const top = Math.max(0, Number(detail.topKmh) || 0);
    const distance = Math.max(0, Number(detail.distanceM) || 0);
    const moving = Math.max(0, Number(detail.movingMs) || 0);
    const avg = moving > 0 ? (distance / (moving / 1000)) * 3.6 : Math.max(0, Number(detail.avgKmh) || 0);
    const heading = Number(detail.heading);
    const accuracy = Number(detail.accuracy);
    const activity = String(detail.activity || 'SMART GPS');
    const confidence = Math.max(0, Math.min(100, Number(detail.activityConfidence) || 0));
    const mode = String(detail.tripMode || '').toLowerCase() === 'bicycle' ? 'bicycle' : 'motor';

    if (needle) needle.style.transform = `translate(-50%,-96%) rotate(${needleDegree(speed).toFixed(2)}deg)`;
    if (valueEl) valueEl.textContent = String(Math.round(speed));
    if (distanceEl) distanceEl.textContent = distanceText(distance);
    if (averageEl) averageEl.textContent = `${Math.round(avg)} km/h`;
    if (topEl) topEl.textContent = `${Math.round(top)} km/h`;
    if (durationEl) durationEl.textContent = durationText(moving);
    if (headingEl) headingEl.textContent = Number.isFinite(heading) ? `${compassPoint(heading)} ${Math.round(heading)}°` : '—';
    if (gpsEl) gpsEl.textContent = Number.isFinite(accuracy) ? `GPS ±${Math.round(accuracy)}m` : 'GPS —';
    if (activityEl) activityEl.textContent = activity;
    if (confidenceEl) confidenceEl.textContent = confidence > 0 ? `${confidence}% confidence • walking/running ignored` : 'GPS fallback • walking filter ready';
    if (statusEl) statusEl.textContent = String(detail.error || detail.status || 'Smart tracking ready.');

    const displayState = !armed ? 'TRACKING OFF' : active ? (paused ? 'AUTO-PAUSED' : 'TRIP ACTIVE') : 'ARMED';
    if (stateEl) stateEl.textContent = displayState;
    dotEl?.classList.toggle('is-wait', !active || paused);
    if (toggle) {
      toggle.textContent = armed ? 'TRACKING ON' : 'TRACKING OFF';
      toggle.classList.toggle('is-off', !armed);
    }
    if (modeEl) modeEl.textContent = active ? `${modeLabel(mode)} TRIP` : armed ? 'AUTO-DETECT READY' : 'SMART TRACKING OFF';
    if (modeIconEl) modeIconEl.textContent = active ? modeIcon(mode) : '✦';

    importCompletedQueue(detail).then(() => drawHistory()).catch(() => {});
  };

  const onNative = event => paint(event?.detail);
  const onStore = () => drawHistory().catch(() => {});
  window.addEventListener('nexusnova:native-drive', onNative);
  window.addEventListener('nexusnova:drive-track-updated', onStore);

  const hydrate = async (manual = false) => {
    if (manual && recover) {
      recover.disabled = true;
      recover.textContent = 'RECOVERING…';
    }
    try {
      const result = await hydrateDriveTrackState();
      setCloud(result?.cloud === true);
      await drawHistory();
      if (manual && statusEl) statusEl.textContent = result?.cloud
        ? `${result.store?.trips?.length || 0} trip records restored from your account backup.`
        : 'Cloud recovery is unavailable right now; the local copy is safe.';
    } catch (error) {
      setCloud(false);
      if (manual && statusEl) statusEl.textContent = error?.message || 'Record recovery could not complete.';
    } finally {
      if (manual && recover) {
        recover.disabled = false;
        recover.textContent = '↻ RECOVER';
      }
    }
  };

  const armAutomatically = async () => {
    if (autoArmAttempted || !trackingPreference()) return;
    autoArmAttempted = true;
    if (statusEl) statusEl.textContent = 'Requesting precise GPS once, then Nova Drive will auto-detect trips.';
    try {
      await requestPreciseLocation();
      if (!disposed) post('nativeDriveStart');
    } catch (error) {
      if (statusEl) statusEl.textContent = error?.message || 'Precise location permission is required.';
    }
  };

  toggle?.addEventListener('click', async () => {
    if (snapshot.armed) {
      saveTrackingPreference(false);
      post('nativeDriveStop');
      return;
    }
    saveTrackingPreference(true);
    autoArmAttempted = false;
    await armAutomatically();
  });

  recover?.addEventListener('click', () => hydrate(true));

  hydrate(false).catch(() => {});
  drawHistory().catch(() => {});
  post('nativeDriveStatus');
  armAutomatically().catch(() => {});

  const poll = setInterval(() => {
    if (!disposed) post('nativeDriveStatus');
  }, 1000);

  root.__cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(poll);
    window.removeEventListener('nexusnova:native-drive', onNative);
    window.removeEventListener('nexusnova:drive-track-updated', onStore);
    root.closest('.nx-screen')?.classList.remove('nx-drive-v3-screen');
    screen?.classList.remove('nx-drive-v3-screen');
    // Smart tracking deliberately remains armed after leaving the screen.
  };
  return root;
}

export function renderNovaTrackNativeV2() {
  // Legacy/deep-link compatibility: Nova Track is now merged into Nova Drive.
  return renderNovaDriveNativeV2();
}

export const driveNativeV2Renderers = Object.freeze({
  'nova-drive': renderNovaDriveNativeV2,
  'nova-track': renderNovaTrackNativeV2
});
