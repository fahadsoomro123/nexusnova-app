import { loadDriveTrackState } from './core/drive-track-persistence.js';

const mounted = new WeakSet();
const boundSharedDock = new WeakSet();
const IDLE_REPAINT_MS = 120;
const HISTORY_PAGE_SIZE = 6;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nonNegative(value) {
  return Math.max(0, finite(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localDayKey(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function startOfMonth(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

function kmText(meters) {
  const km = nonNegative(meters) / 1000;
  return km < 10 ? km.toFixed(2) : km.toFixed(1);
}

function speedText(value) {
  return String(Math.round(nonNegative(value)));
}

function durationText(ms) {
  const totalSeconds = Math.max(0, Math.floor(nonNegative(ms) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function dateLabel(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString([], { day:'2-digit', month:'short', year:'numeric' });
}

function timeLabel(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function normalizeNativeTrip(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const distanceM = nonNegative(raw.distanceM);
  const movingMs = nonNegative(raw.movingMs);
  const durationMs = nonNegative(raw.durationMs || raw.elapsedMs || movingMs);
  const avgKmh = movingMs > 0 ? (distanceM / (movingMs / 1000)) * 3.6 : nonNegative(raw.avgKmh);
  return {
    nativeId:String(raw.nativeId || raw.tripId || '').trim(),
    at:new Date(finite(raw.at || raw.startedAt) || Date.now()).toISOString(),
    endedAt:new Date(finite(raw.endedAt) || Date.now()).toISOString(),
    distanceM,
    movingMs,
    durationMs,
    topKmh:nonNegative(raw.topKmh),
    avgKmh:nonNegative(avgKmh),
    mode:String(raw.mode || raw.tripMode || '').toLowerCase() === 'bicycle' ? 'bicycle' : 'motor',
    points:Array.isArray(raw.points) ? raw.points : Array.isArray(raw.routePoints) ? raw.routePoints : []
  };
}

function completedFromDetail(detail) {
  const queue = Array.isArray(detail?.completedTrips)
    ? detail.completedTrips
    : detail?.completedTrip ? [detail.completedTrip] : [];
  return normalizeNativeTrip(queue.at(-1));
}

function pointFrom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.lon ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat,
    lng,
    at:finite(raw.at ?? raw.timestamp ?? raw.time),
    speedKmh:nonNegative(raw.speedKmh ?? raw.speed)
  };
}

function routePoints(trip) {
  const raw = Array.isArray(trip?.points)
    ? trip.points
    : Array.isArray(trip?.routePoints)
      ? trip.routePoints
      : Array.isArray(trip?.route)
        ? trip.route
        : [];
  return raw.map(pointFrom).filter(Boolean);
}

function coordinateLabel(point, fallback) {
  if (!point) return fallback;
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function filterTrips(trips, filter) {
  const rows = Array.isArray(trips) ? trips : [];
  if (filter === 'history') return rows;
  const start = filter === 'today'
    ? startOfDay()
    : filter === 'week'
      ? startOfWeek()
      : startOfMonth();
  const startMs = start.getTime();
  return rows.filter(trip => {
    const at = new Date(trip?.at || trip?.endedAt || 0).getTime();
    return Number.isFinite(at) && at >= startMs;
  });
}

function boundsFor(points, zoomLevel) {
  if (!points.length) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  points.forEach(point => {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  });
  const zoomScale = Math.pow(1.55, -zoomLevel);
  const latSpan = Math.max(0.006, maxLat - minLat) * (1.5 * zoomScale);
  const lngSpan = Math.max(0.006, maxLng - minLng) * (1.5 * zoomScale);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  return {
    south:centerLat - latSpan / 2,
    north:centerLat + latSpan / 2,
    west:centerLng - lngSpan / 2,
    east:centerLng + lngSpan / 2
  };
}

function osmEmbedUrl(bounds, marker) {
  if (!bounds) return '';
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
  const markerPart = marker ? `&marker=${encodeURIComponent(`${marker.lat},${marker.lng}`)}` : '';
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik${markerPart}`;
}

function googleRouteUrl(points) {
  if (!points.length) return '';
  const start = points[0];
  const end = points.at(-1);
  const middle = points.length > 2
    ? points.slice(1, -1).filter((_, index, list) => index % Math.max(1, Math.ceil(list.length / 6)) === 0).slice(0, 6)
    : [];
  const params = new URLSearchParams({
    api:'1',
    origin:`${start.lat},${start.lng}`,
    destination:`${end.lat},${end.lng}`,
    travelmode:'driving'
  });
  if (middle.length) params.set('waypoints', middle.map(point => `${point.lat},${point.lng}`).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function openExternal(url) {
  if (!url) return false;
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action:'open', url }));
      return true;
    }
  } catch {}
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

function historyStyles() {
  return `<style data-nx-drive-history-v1-style>
  html.nx-approved-drive-active .nx-approved-view[data-approved-history-view]{
    position:absolute!important;top:50%!important;left:50%!important;right:auto!important;bottom:auto!important;
    width:min(var(--nx-approved-vw,100vw),864px)!important;height:auto!important;aspect-ratio:864/1472!important;
    max-height:var(--nx-approved-vh,100dvh)!important;margin:0!important;transform:translate(-50%,-50%)!important;
    transform-origin:center!important;--nx-approved-crop-x:0px!important;z-index:68!important;overflow:hidden!important;
    background:radial-gradient(circle at 48% 22%,rgba(20,124,183,.18),transparent 29%),radial-gradient(circle at 84% 60%,rgba(90,64,220,.12),transparent 32%),linear-gradient(180deg,#071522 0%,#020a13 56%,#01060c 100%)!important;
    color:#f4fbff!important;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif!important;
  }
  .nx-approved-history-view,.nx-approved-history-view *{box-sizing:border-box}
  .nx-approved-history-view button{font:inherit;-webkit-tap-highlight-color:transparent}
  .nxh-shell{position:absolute;inset:0;padding:2.35% 4.35% 8.2%;display:grid;grid-template-rows:7.1% 7.4% 5.2% 5.1% minmax(0,1fr);gap:1.05%;overflow:hidden}
  .nxh-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2%;align-items:center;padding:0 2.5%;border:1px solid rgba(73,206,255,.32);border-radius:18px;background:linear-gradient(180deg,rgba(20,46,68,.95),rgba(5,20,33,.97));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 9px 24px rgba(0,0,0,.42)}
  .nxh-brand{display:flex;align-items:center;gap:2.7%;min-width:0}.nxh-logo{width:13.5%;aspect-ratio:1;border-radius:12px;display:grid;place-items:center;border:1px solid rgba(87,229,255,.72);background:linear-gradient(145deg,#183955,#06121e);color:#dffcff;font-weight:1000;font-size:clamp(13px,4vw,28px);box-shadow:inset 0 0 14px rgba(0,201,255,.16)}
  .nxh-brand-copy{min-width:0}.nxh-brand-copy strong{display:block;font-size:clamp(12px,3.15vw,24px);letter-spacing:.08em;white-space:nowrap}.nxh-brand-copy small{display:block;margin-top:3px;color:#8eb4cc;font-size:clamp(5px,1.38vw,10px);font-weight:850;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nxh-gps{height:48%;padding:0 12px;border:1px solid rgba(89,222,255,.48);border-radius:999px;background:linear-gradient(180deg,#113651,#061b2a);color:#baf4ff;font-size:clamp(7px,1.85vw,13px);font-weight:950;letter-spacing:.08em;display:flex;align-items:center;gap:7px}.nxh-gps i{width:8px;height:8px;border-radius:50%;background:#38ff8d;box-shadow:0 0 9px #38ff8d}
  .nxh-console{display:grid;grid-template-columns:minmax(0,1fr) 38%;gap:2%;align-items:center;padding:0 2.5%;border:1px solid rgba(99,170,224,.14);border-radius:18px;background:linear-gradient(145deg,rgba(10,35,55,.92),rgba(4,17,30,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
  .nxh-console small{display:block;color:#43d9ff;font-size:clamp(5px,1.45vw,10px);font-weight:950;letter-spacing:.16em}.nxh-console strong{display:block;margin-top:2px;font-size:clamp(16px,4.8vw,34px);letter-spacing:-.035em}.nxh-console span{display:block;margin-top:2px;color:#8aa6ba;font-size:clamp(5px,1.55vw,11px)}
  .nxh-tracking{height:53%;border:1px solid rgba(53,222,255,.63);border-radius:999px;background:linear-gradient(180deg,#123b55,#061b2b);color:#70ebff;font-size:clamp(7px,1.85vw,13px);font-weight:950;letter-spacing:.08em;display:flex;align-items:center;justify-content:center;gap:8px}.nxh-tracking i{width:8px;height:8px;border-radius:50%;background:#2cff82;box-shadow:0 0 8px #2cff82}
  .nxh-tabs{display:grid;grid-template-columns:1fr 1fr;gap:1.2%;padding:.75%;border:1px solid rgba(81,182,236,.23);border-radius:14px;background:#061521}.nxh-tab{border:0;border-radius:10px;background:transparent;color:#8fa9ba;font-size:clamp(8px,2.2vw,16px);font-weight:950;letter-spacing:.055em;cursor:pointer}.nxh-tab.is-active{background:linear-gradient(180deg,#17577b,#0b3049);color:#eafbff;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 12px rgba(0,197,255,.12)}
  .nxh-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:1.2%}.nxh-filter{border:1px solid rgba(91,178,231,.22);border-radius:12px;background:linear-gradient(180deg,#0a2235,#061522);color:#93adc0;font-size:clamp(6px,1.7vw,12px);font-weight:900;cursor:pointer}.nxh-filter.is-active{border-color:rgba(63,223,255,.65);background:linear-gradient(180deg,#0c5f83,#083651);color:#eaffff;box-shadow:0 0 12px rgba(0,193,255,.14)}
  .nxh-body{min-height:0;display:grid;grid-template-rows:42% 14.2% 12.5% minmax(0,1fr);gap:1.3%;overflow:hidden}.nxh-body.is-list{grid-template-rows:1fr}.nxh-body.is-list>.nxh-map,.nxh-body.is-list>.nxh-stats,.nxh-body.is-list>.nxh-locations,.nxh-body.is-list>.nxh-recent{display:none!important}.nxh-body:not(.is-list)>.nxh-all{display:none!important}
  .nxh-card{border:1px solid rgba(80,177,233,.2);border-radius:17px;background:linear-gradient(155deg,rgba(9,32,51,.98),rgba(3,14,25,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 9px 20px rgba(0,0,0,.32);overflow:hidden}
  .nxh-map{position:relative;min-height:0}.nxh-map-head{position:absolute;z-index:8;left:3%;right:3%;top:3%;display:flex;align-items:center;justify-content:space-between;pointer-events:none}.nxh-map-head strong{font-size:clamp(7px,2vw,14px);letter-spacing:.12em}.nxh-map-head span{color:#a7c4d6;font-size:clamp(6px,1.55vw,11px)}
  .nxh-map-stage{position:absolute;inset:0;background:radial-gradient(circle at 25% 25%,rgba(14,101,126,.17),transparent 25%),linear-gradient(rgba(58,129,170,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(58,129,170,.08) 1px,transparent 1px),#06131f;background-size:auto,11% 11%,11% 11%,auto}.nxh-map-frame{position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;filter:saturate(.65) brightness(.56) contrast(1.28) hue-rotate(155deg);opacity:.78}.nxh-route-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.nxh-route-shadow{fill:none;stroke:rgba(47,69,255,.65);stroke-width:10;stroke-linecap:round;stroke-linejoin:round;filter:blur(5px)}.nxh-route-line{fill:none;stroke:#42e8ff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(55,223,255,.95))}.nxh-route-start{fill:#33ff86;stroke:#e8fff2;stroke-width:2}.nxh-route-end{fill:#ff446d;stroke:#ffe6ec;stroke-width:2}
  .nxh-no-route{position:absolute;z-index:5;left:8%;right:8%;top:39%;text-align:center;color:#90acbf;font-size:clamp(7px,1.9vw,13px);line-height:1.45}.nxh-no-route strong{display:block;color:#d7f7ff;font-size:1.2em;margin-bottom:4px}
  .nxh-map-controls{position:absolute;z-index:9;right:2.5%;top:18%;display:grid;gap:5px}.nxh-map-control{width:clamp(27px,7vw,46px);aspect-ratio:1;border:1px solid rgba(89,223,255,.4);border-radius:10px;background:rgba(4,19,31,.92);color:#c9f8ff;font-size:clamp(13px,4vw,25px);font-weight:900;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.35)}.nxh-map-control.open{font-size:clamp(8px,2.1vw,14px)}
  .nxh-map.is-full{position:absolute!important;z-index:69!important;left:4.35%!important;right:4.35%!important;top:23.3%!important;bottom:8.2%!important;height:auto!important;border-color:rgba(61,220,255,.55)!important;box-shadow:0 0 35px rgba(0,173,255,.2),0 18px 45px rgba(0,0,0,.6)!important}.nxh-map.is-full .nxh-map-head{top:2%}.nxh-map.is-full .nxh-map-controls{top:9%}
  .nxh-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1.1%;background:transparent;border:0;box-shadow:none;overflow:visible}.nxh-stat{min-width:0;border:1px solid rgba(78,179,234,.18);border-radius:12px;background:linear-gradient(180deg,#0a2235,#061522);display:grid;place-content:center;text-align:center}.nxh-stat span{color:#72dfff;font-size:clamp(5px,1.35vw,9px);font-weight:900;letter-spacing:.09em}.nxh-stat strong{display:block;margin-top:3px;font-size:clamp(12px,3.5vw,25px);line-height:1}.nxh-stat small{display:block;margin-top:3px;color:#819daf;font-size:clamp(5px,1.2vw,8px)}
  .nxh-locations{display:grid;grid-template-columns:1fr 1fr;gap:1.2%;background:transparent;border:0;box-shadow:none;overflow:visible}.nxh-location{position:relative;min-width:0;border:1px solid rgba(76,175,232,.17);border-radius:12px;background:linear-gradient(180deg,#091f31,#06131f);padding:5% 7% 4% 14%;display:grid;align-content:center}.nxh-location i{position:absolute;left:6%;top:50%;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:#35ff8c;box-shadow:0 0 8px #35ff8c}.nxh-location.end i{background:#ff4771;box-shadow:0 0 8px #ff4771}.nxh-location span{color:#6fdcff;font-size:clamp(5px,1.25vw,9px);font-weight:900;letter-spacing:.09em}.nxh-location strong{display:block;margin-top:3px;font-size:clamp(7px,1.8vw,13px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxh-location small{display:block;margin-top:2px;color:#849fb1;font-size:clamp(5px,1.2vw,8px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nxh-recent{padding:2.2% 2.7%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:4%}.nxh-recent-head{display:flex;align-items:center;justify-content:space-between}.nxh-recent-head strong{font-size:clamp(6px,1.65vw,12px);letter-spacing:.11em}.nxh-view-all{border:0;background:transparent;color:#6be8ff;font-size:clamp(6px,1.45vw,10px);font-weight:900;cursor:pointer}.nxh-recent-list{min-height:0;display:grid;grid-template-rows:repeat(3,1fr);gap:2%}.nxh-trip-row{min-height:0;width:100%;border:1px solid rgba(70,156,211,.11);border-radius:9px;background:rgba(6,21,34,.74);color:#e9f8ff;padding:0 3%;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:4%;align-items:center;text-align:left;cursor:pointer}.nxh-trip-row strong{font-size:clamp(6px,1.65vw,12px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxh-trip-row span,.nxh-trip-row small{color:#9db6c7;font-size:clamp(5px,1.35vw,9px);white-space:nowrap}.nxh-trip-row b{color:#64e8ff;font-size:clamp(9px,2.5vw,18px)}.nxh-empty{grid-column:1/-1;display:grid;place-items:center;color:#8ca7b9;font-size:clamp(7px,1.8vw,12px);text-align:center;padding:4%}
  .nxh-all{min-height:0;padding:3%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:2.2%}.nxh-all-head{display:flex;align-items:center;justify-content:space-between}.nxh-all-head strong{font-size:clamp(10px,2.7vw,19px)}.nxh-all-back{border:1px solid rgba(78,205,255,.28);border-radius:9px;background:#0a2639;color:#c7f7ff;padding:6px 11px;font-size:clamp(6px,1.55vw,11px);font-weight:900}.nxh-all-list{min-height:0;display:grid;grid-template-rows:repeat(${HISTORY_PAGE_SIZE},1fr);gap:1.5%}.nxh-all-list .nxh-trip-row{padding:0 4%}.nxh-pager{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:3%}.nxh-page-btn{height:100%;border:1px solid rgba(66,187,241,.22);border-radius:9px;background:#082134;color:#bfefff;font-size:clamp(6px,1.5vw,11px);font-weight:900}.nxh-page-btn:disabled{opacity:.35}.nxh-page-count{color:#89a9bb;font-size:clamp(6px,1.45vw,10px);white-space:nowrap}
  .nx-history-entry{position:absolute;z-index:30;top:61.2%;height:9.6%;border:0;background:transparent;color:transparent;cursor:pointer}.nx-history-entry.today{left:3.5%;width:20.5%}.nx-history-entry.week{left:25.5%;width:20.5%}.nx-history-entry.month{left:47.5%;width:20.5%}.nx-history-entry.history{left:69.5%;width:26.7%}
  @media (prefers-reduced-motion:reduce){.nxh-map-control,.nxh-filter,.nxh-tab{transition:none!important}}
  </style>`;
}

function historyMarkup() {
  return `<section class="nx-approved-view nx-approved-history-view" data-approved-history-view aria-label="Drive History">
    <div class="nxh-shell">
      <header class="nxh-top">
        <div class="nxh-brand"><span class="nxh-logo">N</span><div class="nxh-brand-copy"><strong>NOVA DRIVE COCKPIT</strong><small>NEXUSNOVA • PRECISE GPS • TRIP SAFE</small></div></div>
        <div class="nxh-gps"><i></i>NATIVE GPS</div>
      </header>
      <section class="nxh-console">
        <div><small>SMART MOBILITY CONSOLE</small><strong>Nova Drive</strong><span>Auto vehicle + bicycle trip intelligence</span></div>
        <div class="nxh-tracking"><i></i><span>TRACKING ON</span></div>
      </section>
      <nav class="nxh-tabs" aria-label="Nova Drive section"><button class="nxh-tab" type="button" data-history-dashboard>◉ DASHBOARD</button><button class="nxh-tab is-active" type="button" data-history-current>☷ DRIVE HISTORY</button></nav>
      <nav class="nxh-filters" aria-label="Drive History period"><button class="nxh-filter" type="button" data-history-filter="today">▣ TODAY</button><button class="nxh-filter" type="button" data-history-filter="week">▥ THIS WEEK</button><button class="nxh-filter" type="button" data-history-filter="month">◔ THIS MONTH</button><button class="nxh-filter" type="button" data-history-filter="history">◷ HISTORY</button></nav>
      <main class="nxh-body" data-history-body>
        <section class="nxh-map nxh-card" data-history-map>
          <div class="nxh-map-head"><strong>ROUTE MAP</strong><span data-history-date>—</span></div>
          <div class="nxh-map-stage" data-history-map-stage></div>
          <div class="nxh-map-controls"><button class="nxh-map-control" type="button" data-map-zoom-in aria-label="Zoom in">+</button><button class="nxh-map-control" type="button" data-map-zoom-out aria-label="Zoom out">−</button><button class="nxh-map-control open" type="button" data-map-open aria-label="Open route map">MAP</button><button class="nxh-map-control open" type="button" data-map-full aria-label="Expand route map">⛶</button></div>
        </section>
        <section class="nxh-stats">
          <article class="nxh-stat"><span>DISTANCE</span><strong data-history-distance>0.00</strong><small>km</small></article>
          <article class="nxh-stat"><span>MOVING TIME</span><strong data-history-moving>00:00</strong><small>hh:mm</small></article>
          <article class="nxh-stat"><span>AVG SPEED</span><strong data-history-average>0</strong><small>km/h</small></article>
          <article class="nxh-stat"><span>TOP SPEED</span><strong data-history-top>0</strong><small>km/h</small></article>
        </section>
        <section class="nxh-locations">
          <article class="nxh-location"><i></i><span>START LOCATION</span><strong data-history-start>—</strong><small data-history-start-time>—</small></article>
          <article class="nxh-location end"><i></i><span>END LOCATION</span><strong data-history-end>—</strong><small data-history-end-time>—</small></article>
        </section>
        <section class="nxh-recent nxh-card"><div class="nxh-recent-head"><strong>RECENT TRIPS</strong><button class="nxh-view-all" type="button" data-history-view-all>View all →</button></div><div class="nxh-recent-list" data-history-recent></div></section>
        <section class="nxh-all nxh-card"><div class="nxh-all-head"><strong>DRIVE HISTORY</strong><button class="nxh-all-back" type="button" data-history-list-back>← TRIP DETAIL</button></div><div class="nxh-all-list" data-history-all-list></div><div class="nxh-pager"><button class="nxh-page-btn" type="button" data-history-prev>← PREVIOUS</button><span class="nxh-page-count" data-history-page>1 / 1</span><button class="nxh-page-btn" type="button" data-history-next>NEXT →</button></div></section>
      </main>
    </div>
  </section>`;
}

function buildRouteSvg(points, bounds) {
  if (!points.length || !bounds) return '';
  const width = 1000;
  const height = 620;
  const x = lng => ((lng - bounds.west) / Math.max(1e-9, bounds.east - bounds.west)) * width;
  const y = lat => height - ((lat - bounds.south) / Math.max(1e-9, bounds.north - bounds.south)) * height;
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.lng).toFixed(2)} ${y(point.lat).toFixed(2)}`).join(' ');
  const start = points[0];
  const end = points.at(-1);
  return `<svg class="nxh-route-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path class="nxh-route-shadow" d="${path}"/><path class="nxh-route-line" d="${path}"/><circle class="nxh-route-start" cx="${x(start.lng).toFixed(2)}" cy="${y(start.lat).toFixed(2)}" r="9"/><circle class="nxh-route-end" cx="${x(end.lng).toFixed(2)}" cy="${y(end.lat).toFixed(2)}" r="9"/></svg>`;
}

function setApprovedMetric(el, value, unit) {
  if (!el) return;
  el.innerHTML = `${escapeHtml(value)}${unit ? `<small>${escapeHtml(unit)}</small>` : ''}`;
}

function mount(ui) {
  if (!(ui instanceof HTMLElement) || mounted.has(ui)) return;
  const driveView = ui.querySelector('[data-approved-drive-view]');
  const trackerView = ui.querySelector('[data-approved-tracker-view]');
  if (!driveView || !trackerView) return;
  mounted.add(ui);

  ui.insertAdjacentHTML('beforeend', `${historyStyles()}${historyMarkup()}`);
  const historyView = ui.querySelector('[data-approved-history-view]');
  if (!historyView) return;

  const shell = ui.closest('.nxdr3');
  const body = historyView.querySelector('[data-history-body]');
  const mapCard = historyView.querySelector('[data-history-map]');
  const mapStage = historyView.querySelector('[data-history-map-stage]');
  const recent = historyView.querySelector('[data-history-recent]');
  const allList = historyView.querySelector('[data-history-all-list]');
  const pageEl = historyView.querySelector('[data-history-page]');
  const prevBtn = historyView.querySelector('[data-history-prev]');
  const nextBtn = historyView.querySelector('[data-history-next]');
  const trackingCopy = historyView.querySelector('.nxh-tracking span');

  let nativeDetail = { active:false, armed:true };
  let lastCompletedNative = null;
  let store = { trips:[], days:{} };
  let lastTrip = null;
  let selectedTrip = null;
  let activeFilter = 'history';
  let historyOpen = false;
  let listMode = false;
  let page = 0;
  let mapZoom = 0;
  let disposed = false;

  function stickyTrip() {
    return lastCompletedNative || lastTrip || null;
  }

  function writeHiddenMetric(selector, value) {
    const element = shell?.querySelector(selector);
    if (element && element.textContent !== value) element.textContent = value;
  }

  function paintStickyLastTrip() {
    if (disposed || nativeDetail?.active === true) return;
    const trip = stickyTrip();
    if (!trip) return;
    const distance = `${kmText(trip.distanceM)} km`;
    const avg = `${speedText(trip.avgKmh)} km/h`;
    const top = `${speedText(trip.topKmh)} km/h`;
    const moving = durationText(trip.movingMs);

    // Keep the hidden functional dashboard model populated too. The approved
    // overlay polls these nodes, so app close/reopen can never repaint zeros over
    // the most recent completed trip while Nova Drive is merely armed/waiting.
    writeHiddenMetric('[data-dr-distance]', distance);
    writeHiddenMetric('[data-dr-average]', avg);
    writeHiddenMetric('[data-dr-top]', top);
    writeHiddenMetric('[data-dr-duration]', moving);

    setApprovedMetric(driveView.querySelector('[data-approved-distance]'), kmText(trip.distanceM), 'km');
    setApprovedMetric(driveView.querySelector('[data-approved-average]'), speedText(trip.avgKmh), 'km/h');
    setApprovedMetric(driveView.querySelector('[data-approved-top]'), speedText(trip.topKmh), 'km/h');
    setApprovedMetric(driveView.querySelector('[data-approved-duration]'), moving, 'hh:mm');
  }

  async function refreshStore() {
    try {
      const state = await loadDriveTrackState();
      if (disposed) return;
      store = state?.store || { trips:[], days:{} };
      lastTrip = Array.isArray(store.trips) ? store.trips[0] || null : null;
      if (lastCompletedNative && lastTrip?.nativeId && lastTrip.nativeId === lastCompletedNative.nativeId) lastCompletedNative = null;
      paintStickyLastTrip();
      if (historyOpen) renderHistory();
    } catch {}
  }

  function selectedRows() {
    return filterTrips(store?.trips || [], activeFilter);
  }

  function ensureSelection(rows) {
    if (!rows.length) {
      selectedTrip = null;
      return;
    }
    const selectedId = selectedTrip?.nativeId || '';
    selectedTrip = rows.find(trip => selectedId && trip?.nativeId === selectedId) || rows[0];
  }

  function renderMap(trip) {
    if (!mapStage) return;
    const points = routePoints(trip);
    const bounds = boundsFor(points, mapZoom);
    if (!points.length || !bounds) {
      mapStage.innerHTML = `<div class="nxh-no-route"><strong>ROUTE MAP READY</strong>This trip has no stored GPS path. New route-enabled trips will draw the complete travelled line here.</div>`;
      historyView.querySelector('[data-map-open]')?.toggleAttribute('disabled', true);
      return;
    }
    const iframe = osmEmbedUrl(bounds, points.at(-1));
    mapStage.innerHTML = `${iframe ? `<iframe class="nxh-map-frame" title="OpenStreetMap route background" src="${escapeHtml(iframe)}" loading="lazy" referrerpolicy="no-referrer"></iframe>` : ''}${buildRouteSvg(points, bounds)}`;
    historyView.querySelector('[data-map-open]')?.removeAttribute('disabled');
  }

  function renderRecent(rows) {
    if (!recent) return;
    const rows3 = rows.slice(0, 3);
    recent.innerHTML = rows3.length ? rows3.map((trip, index) => `<button class="nxh-trip-row" type="button" data-trip-index="${index}"><strong>${escapeHtml(dateLabel(trip.at))}</strong><span>${escapeHtml(kmText(trip.distanceM))} km</span><small>${escapeHtml(durationText(trip.movingMs))}</small><b>›</b></button>`).join('') : `<div class="nxh-empty">No saved trips in this period yet.</div>`;
    recent.querySelectorAll('[data-trip-index]').forEach(button => button.addEventListener('click', () => {
      selectedTrip = rows[Number(button.dataset.tripIndex) || 0] || null;
      mapZoom = 0;
      renderHistory();
    }));
  }

  function renderAll(rows) {
    if (!allList || !pageEl || !prevBtn || !nextBtn) return;
    const pages = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
    page = Math.min(Math.max(0, page), pages - 1);
    const slice = rows.slice(page * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE);
    allList.innerHTML = slice.length ? slice.map((trip, index) => `<button class="nxh-trip-row" type="button" data-all-index="${index}"><strong>${escapeHtml(dateLabel(trip.at))} • ${escapeHtml(timeLabel(trip.at))}</strong><span>${escapeHtml(kmText(trip.distanceM))} km</span><small>${escapeHtml(durationText(trip.movingMs))}</small><b>›</b></button>`).join('') : `<div class="nxh-empty">No trips in this period.</div>`;
    allList.querySelectorAll('[data-all-index]').forEach(button => button.addEventListener('click', () => {
      selectedTrip = slice[Number(button.dataset.allIndex) || 0] || null;
      listMode = false;
      body?.classList.remove('is-list');
      mapZoom = 0;
      renderHistory();
    }));
    pageEl.textContent = `${page + 1} / ${pages}`;
    prevBtn.disabled = page <= 0;
    nextBtn.disabled = page >= pages - 1;
  }

  function renderHistory() {
    const rows = selectedRows();
    ensureSelection(rows);
    historyView.querySelectorAll('[data-history-filter]').forEach(button => button.classList.toggle('is-active', button.dataset.historyFilter === activeFilter));
    if (trackingCopy) trackingCopy.textContent = nativeDetail?.armed === false ? 'TRACKING OFF' : nativeDetail?.active === true ? 'TRIP ACTIVE' : 'TRACKING ON';

    const trip = selectedTrip;
    const points = routePoints(trip);
    const startPoint = points[0] || pointFrom(trip?.startPoint || trip?.startLocation);
    const endPoint = points.at(-1) || pointFrom(trip?.endPoint || trip?.endLocation);
    const startName = trip?.startName || trip?.startLabel || coordinateLabel(startPoint, 'Location not stored');
    const endName = trip?.endName || trip?.endLabel || coordinateLabel(endPoint, 'Location not stored');

    const setText = (selector, value) => {
      const element = historyView.querySelector(selector);
      if (element) element.textContent = String(value);
    };
    setText('[data-history-date]', trip ? dateLabel(trip.at) : 'No trip selected');
    setText('[data-history-distance]', trip ? kmText(trip.distanceM) : '0.00');
    setText('[data-history-moving]', trip ? durationText(trip.movingMs) : '00:00');
    setText('[data-history-average]', trip ? speedText(trip.avgKmh) : '0');
    setText('[data-history-top]', trip ? speedText(trip.topKmh) : '0');
    setText('[data-history-start]', startName);
    setText('[data-history-end]', endName);
    setText('[data-history-start-time]', trip ? `Started ${timeLabel(trip.at)}` : '—');
    setText('[data-history-end-time]', trip ? `Ended ${timeLabel(trip.endedAt)}` : '—');

    renderMap(trip);
    renderRecent(rows);
    renderAll(rows);
    body?.classList.toggle('is-list', listMode);
  }

  function openHistory(filter = 'history') {
    activeFilter = ['today','week','month','history'].includes(filter) ? filter : 'history';
    historyOpen = true;
    listMode = false;
    page = 0;
    mapZoom = 0;
    historyView.classList.add('is-active');
    historyView.removeAttribute('aria-hidden');
    renderHistory();
    refreshStore().catch(() => {});
  }

  function closeHistory() {
    historyOpen = false;
    listMode = false;
    mapCard?.classList.remove('is-full');
    historyView.classList.remove('is-active');
    historyView.setAttribute('aria-hidden', 'true');
  }

  [
    ['today','today'],
    ['week','week'],
    ['month','month'],
    ['history','history']
  ].forEach(([className, filter]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nx-history-entry ${className}`;
    button.setAttribute('aria-label', `Open Drive History ${filter}`);
    button.addEventListener('click', () => openHistory(filter));
    driveView.appendChild(button);
  });

  historyView.querySelector('[data-history-dashboard]')?.addEventListener('click', closeHistory);
  historyView.querySelector('[data-history-current]')?.addEventListener('click', () => { listMode = false; body?.classList.remove('is-list'); });
  historyView.querySelectorAll('[data-history-filter]').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.historyFilter || 'history';
    selectedTrip = null;
    page = 0;
    listMode = false;
    mapZoom = 0;
    body?.classList.remove('is-list');
    renderHistory();
  }));
  historyView.querySelector('[data-history-view-all]')?.addEventListener('click', () => {
    listMode = true;
    page = 0;
    body?.classList.add('is-list');
    renderHistory();
  });
  historyView.querySelector('[data-history-list-back]')?.addEventListener('click', () => {
    listMode = false;
    body?.classList.remove('is-list');
    renderHistory();
  });
  prevBtn?.addEventListener('click', () => { page -= 1; renderHistory(); });
  nextBtn?.addEventListener('click', () => { page += 1; renderHistory(); });
  historyView.querySelector('[data-map-zoom-in]')?.addEventListener('click', () => { mapZoom = Math.min(3, mapZoom + 1); renderMap(selectedTrip); });
  historyView.querySelector('[data-map-zoom-out]')?.addEventListener('click', () => { mapZoom = Math.max(-2, mapZoom - 1); renderMap(selectedTrip); });
  historyView.querySelector('[data-map-full]')?.addEventListener('click', () => mapCard?.classList.toggle('is-full'));
  historyView.querySelector('[data-map-open]')?.addEventListener('click', () => openExternal(googleRouteUrl(routePoints(selectedTrip))));

  const onNative = event => {
    nativeDetail = event?.detail && typeof event.detail === 'object' ? event.detail : nativeDetail;
    const completed = completedFromDetail(nativeDetail);
    if (completed) lastCompletedNative = completed;
    // active=true is the exact "new trip has started" gate. Until that event,
    // the previous completed trip remains visible on the dashboard.
    if (nativeDetail?.active !== true) paintStickyLastTrip();
    if (historyOpen) renderHistory();
    if (completed) setTimeout(() => refreshStore().catch(() => {}), 80);
  };
  const onStore = () => refreshStore().catch(() => {});
  window.addEventListener('nexusnova:native-drive', onNative);
  window.addEventListener('nexusnova:drive-track-updated', onStore);

  const trackerObserver = new MutationObserver(() => {
    if (trackerView.classList.contains('is-active')) closeHistory();
  });
  trackerObserver.observe(trackerView, { attributes:true, attributeFilter:['class'] });

  function bindSharedFrame() {
    const frame = ui.querySelector('[data-approved-final-frame]');
    if (!frame || boundSharedDock.has(frame)) return;
    boundSharedDock.add(frame);
    frame.querySelector('[data-final-drive]')?.addEventListener('click', () => { if (historyOpen) closeHistory(); });
    frame.querySelector('[data-final-vehicle]')?.addEventListener('click', () => { if (historyOpen) closeHistory(); });
  }
  bindSharedFrame();
  const frameObserver = new MutationObserver(bindSharedFrame);
  frameObserver.observe(ui, { childList:true, subtree:true });

  refreshStore().catch(() => {});
  const stickyTimer = setInterval(paintStickyLastTrip, IDLE_REPAINT_MS);

  const cleanupTimer = setInterval(() => {
    if (ui.isConnected) return;
    disposed = true;
    clearInterval(cleanupTimer);
    clearInterval(stickyTimer);
    trackerObserver.disconnect();
    frameObserver.disconnect();
    window.removeEventListener('nexusnova:native-drive', onNative);
    window.removeEventListener('nexusnova:drive-track-updated', onStore);
  }, 900);

  window.NexusNovaDriveHistory = {
    open:filter => openHistory(filter),
    close:closeHistory
  };
}

function scan(node = document) {
  if (node instanceof HTMLElement && node.matches('[data-nx-approved]')) mount(node);
  node.querySelectorAll?.('[data-nx-approved]').forEach(mount);
}

scan();
new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
  if (node instanceof HTMLElement) scan(node);
}))).observe(document.documentElement, { childList:true, subtree:true });
