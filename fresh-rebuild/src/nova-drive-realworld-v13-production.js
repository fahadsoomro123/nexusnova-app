import { hydrateDriveTrackState, loadDriveTrackState } from './core/drive-track-persistence.js';
import { loadNovaVehicleDashboard, setNovaVehiclePaused } from './core/nova-vehicle-premium-store.js';

const ROOT_ID = 'nxrw13';
const ACTIVE_CLASS = 'nxrw13-production-active';
const DRIVE_ACTIVE_CLASS = 'nx-approved-drive-active';
const installedRoots = new WeakSet();
let currentStore = { days:{}, trips:[] };
let currentVehicle = null;
let trackerBusy = false;
let trackerTimer = 0;
let telemetryTimer = 0;
let reconcileQueued = false;
let trackerTrail = [];
let trackerVehicleId = '';

window.NXRW13Runtime = window.NXRW13Runtime || { speedKmh:0 };

function $(selector, root = document) { return root.querySelector(selector); }
function $$(selector, root = document) { return [...root.querySelectorAll(selector)]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function text(el) { return String(el?.textContent || '').trim(); }
function firstNumber(value) { const m = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : 0; }
function km(metres) { const v = Math.max(0, num(metres)) / 1000; return v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
function duration(ms) {
  const total = Math.max(0, Math.round(num(ms) / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}h ${String(m).padStart(2,'0')}m` : m ? `${m}m ${String(s).padStart(2,'0')}s` : `${s}s`;
}
function shortDuration(ms) {
  const total = Math.max(0, Math.round(num(ms) / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2,'0')}` : `${Math.max(0,m)}m`;
}
function ago(ms) {
  const at = num(ms); if (!at) return 'Offline';
  const age = Math.max(0, Date.now() - at);
  if (age < 15000) return 'Now';
  if (age < 60000) return `${Math.floor(age/1000)}s ago`;
  if (age < 3600000) return `${Math.floor(age/60000)}m ago`;
  return `${Math.floor(age/3600000)}h ago`;
}
function compass(deg) {
  const names = ['N','NE','E','SE','S','SW','W','NW'];
  const value = ((num(deg) % 360) + 360) % 360;
  return `${names[Math.round(value / 45) % 8]} ${Math.round(value)}°`;
}
function startOfDay(offsetDays = 0) {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + offsetDays); return d.getTime();
}
function rangeFor(filter) {
  const now = Date.now();
  if (filter === 'Today') return [startOfDay(0), now];
  if (filter === 'Week') return [startOfDay(-6), now];
  if (filter === 'Month') { const d = new Date(); d.setHours(0,0,0,0); d.setDate(1); return [d.getTime(), now]; }
  return [0, now];
}
function tripsFor(filter) {
  const [from,to] = rangeFor(filter);
  return (Array.isArray(currentStore?.trips) ? currentStore.trips : []).filter(trip => {
    const at = new Date(trip?.at || trip?.endedAt || 0).getTime();
    return Number.isFinite(at) && at >= from && at <= to;
  });
}
function dayRowsFor(filter) {
  const [from,to] = rangeFor(filter);
  return Object.entries(currentStore?.days || {}).filter(([key]) => {
    const t = new Date(`${key}T12:00:00`).getTime(); return Number.isFinite(t) && t >= from && t <= to;
  }).map(([,row]) => row || {});
}
function summary(filter) {
  const trips = tripsFor(filter);
  if (trips.length) {
    const distanceM = trips.reduce((a,t)=>a+num(t.distanceM),0);
    const movingMs = trips.reduce((a,t)=>a+num(t.movingMs || t.durationMs),0);
    const topKmh = trips.reduce((a,t)=>Math.max(a,num(t.topKmh)),0);
    const avgKmh = movingMs > 0 ? (distanceM / (movingMs / 1000)) * 3.6 : (trips.reduce((a,t)=>a+num(t.avgKmh),0) / Math.max(1,trips.length));
    return { distanceM, movingMs, topKmh, avgKmh, trips:trips.length, list:trips };
  }
  const rows = dayRowsFor(filter);
  const distanceM = rows.reduce((a,r)=>a+num(r.distanceM),0);
  const movingMs = rows.reduce((a,r)=>a+num(r.movingMs),0);
  const count = rows.reduce((a,r)=>a+num(r.trips),0);
  return { distanceM, movingMs, topKmh:0, avgKmh:movingMs>0?(distanceM/(movingMs/1000))*3.6:0, trips:count, list:[] };
}
function setText(selector, value, root = document) { const el = $(selector, root); if (el) el.textContent = value; }
function runtimeRoot() { return document.getElementById(ROOT_ID); }
function isDriveActive() { return document.documentElement.classList.contains(DRIVE_ACTIVE_CLASS) && !!document.querySelector('[data-nx-approved]'); }

function installLockStyle() {
  if (document.getElementById('nxrw13-production-lock')) return;
  const style = document.createElement('style');
  style.id = 'nxrw13-production-lock';
  style.textContent = `
    html.${ACTIVE_CLASS},html.${ACTIVE_CLASS} body{width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;overflow:hidden!important;overscroll-behavior:none!important;touch-action:manipulation!important}
    html.${ACTIVE_CLASS} [data-nx-approved]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
    html.${ACTIVE_CLASS} #${ROOT_ID}{opacity:1!important;visibility:visible!important;pointer-events:auto!important;width:100vw!important;height:100dvh!important;max-width:100vw!important;max-height:100dvh!important;overflow:hidden!important}
    html.${ACTIVE_CLASS} #${ROOT_ID} .stage,html.${ACTIVE_CLASS} #${ROOT_ID} .screen{width:100%!important;height:100%!important;max-height:100%!important;overflow:hidden!important}
  `;
  document.head.appendChild(style);
}

function originalDriveRoot() { return document.querySelector('[data-nx-approved]'); }
function readApprovedTelemetry() {
  const ui = originalDriveRoot(); if (!ui) return;
  const speedText = text(ui.querySelector('.nx-approved-drive-speed'));
  const speed = clamp(firstNumber(speedText), 0, 180);
  window.NXRW13Runtime.speedKmh = speed;
  const metrics = [
    text(ui.querySelector('.nx-approved-metric.m1')),
    text(ui.querySelector('.nx-approved-metric.m2')),
    text(ui.querySelector('.nx-approved-metric.m3')),
    text(ui.querySelector('.nx-approved-metric.m4'))
  ];
  const root = runtimeRoot(); if (!root) return;
  const nodes = $$('.telemetryRail .metric b', root);
  if (nodes[0]) nodes[0].textContent = metrics[0] ? firstNumber(metrics[0]).toFixed(2) : km(summary('Today').distanceM);
  if (nodes[1]) nodes[1].textContent = metrics[1] ? Math.round(firstNumber(metrics[1])) : Math.round(summary('Today').avgKmh);
  if (nodes[2]) nodes[2].textContent = metrics[2] ? Math.round(firstNumber(metrics[2])) : Math.round(summary('Today').topKmh);
  if (nodes[3]) nodes[3].textContent = metrics[3] || shortDuration(summary('Today').movingMs);
  const canvas = root.querySelector('.screen.on[data-screen="dashboard"] .cockpitCanvas');
  if (canvas && window.NXRW13Cockpit?.drawCockpit) window.NXRW13Cockpit.drawCockpit(canvas);
}

function updateRibbon() {
  const root = runtimeRoot(); if (!root) return;
  const defs = [['Today','TODAY'],['Week','THIS WEEK'],['Month','THIS MONTH'],['All','HISTORY']];
  const buttons = $$('.tripRibbon button', root);
  defs.forEach(([filter],i) => {
    const s = summary(filter), button = buttons[i]; if (!button) return;
    const b = button.querySelector('b'), small = button.querySelector('small');
    if (b) b.textContent = filter === 'All' ? `${Math.round(s.trips)} trips` : `${km(s.distanceM)} km`;
    if (small) small.textContent = filter === 'Today' ? `${Math.round(s.trips)} trips` : filter === 'All' ? 'Nova Track' : `${Math.round(s.trips)} trips`;
    button.dataset.jumpFilter = filter;
  });
}

function routePath(points) {
  const valid = (Array.isArray(points) ? points : []).map(p => ({lat:num(p?.lat ?? p?.latitude),lng:num(p?.lng ?? p?.longitude)})).filter(p=>Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180&&(p.lat||p.lng));
  if (valid.length < 2) return '';
  const lats = valid.map(p=>p.lat), lngs = valid.map(p=>p.lng), minLat=Math.min(...lats), maxLat=Math.max(...lats), minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
  const dx = Math.max(0.00001,maxLng-minLng), dy=Math.max(0.00001,maxLat-minLat), x0=70,x1=604,y0=190,y1=1060;
  const sample = valid.length > 180 ? valid.filter((_,i)=>i % Math.ceil(valid.length/180)===0) : valid;
  return sample.map((p,i)=>`${i?'L':'M'} ${(x0+((p.lng-minLng)/dx)*(x1-x0)).toFixed(1)} ${(y1-((p.lat-minLat)/dy)*(y1-y0)).toFixed(1)}`).join(' ');
}
function setRoute(screen, points) {
  const root = runtimeRoot(); if (!root) return;
  const d = routePath(points);
  $$(`.screen[data-screen="${screen}"] .routeSvg path`,root).forEach(path=>path.setAttribute('d',d));
  const svg = root.querySelector(`.screen[data-screen="${screen}"] .routeSvg`);
  if (svg) svg.style.opacity = d ? '1' : '0';
}
function activeHistoryFilter() {
  const root=runtimeRoot(); const on=root?.querySelector('.filterStrip button.on');
  return on?.dataset.filter || 'Today';
}
function updateHistory(filter = activeHistoryFilter()) {
  const root = runtimeRoot(); if (!root) return;
  const s = summary(filter);
  const vals = { d:km(s.distanceM), t:shortDuration(s.movingMs), a:String(Math.round(s.avgKmh)), p:String(Math.round(s.topKmh)) };
  Object.entries(vals).forEach(([k,v])=>setText(`[data-hstat="${k}"]`,v,root));
  const pills = $$('.screen[data-screen="history"] .mapHudTop .glassPill',root);
  if (pills[0]) pills[0].textContent = `DRIVE HISTORY · ${filter === 'All' ? 'ALL TRIPS' : filter.toUpperCase()}`;
  if (pills[1]) pills[1].textContent = `${Math.round(s.trips)} TRIPS`;
  const list = root.querySelector('.tripList');
  if (list) {
    const recent = s.list.slice(0,2);
    list.innerHTML = recent.length ? recent.map(trip => {
      const when = new Date(trip.endedAt || trip.at || Date.now());
      const time = when.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      return `<div class="tripItem"><b>${time} · ${km(trip.distanceM)} km</b><small>${duration(trip.movingMs || trip.durationMs)} · avg ${Math.round(num(trip.avgKmh))} km/h</small></div>`;
    }).join('') : '<div class="tripItem"><b>No stored trips</b><small>This filter has no completed Drive trips yet.</small></div>';
  }
  const latest = s.list[0];
  const places = $$('.journeyLine .place b',root);
  if (places[0]) places[0].textContent = latest?.startName || (latest?.startPoint ? `${num(latest.startPoint.lat).toFixed(5)}, ${num(latest.startPoint.lng).toFixed(5)}` : 'Start not stored');
  if (places[1]) places[1].textContent = latest?.endName || (latest?.endPoint ? `${num(latest.endPoint.lat).toFixed(5)}, ${num(latest.endPoint.lng).toFixed(5)}` : 'End not stored');
  setRoute('history', latest?.routePoints || []);
}

async function refreshStore({hydrate=false}={}) {
  try {
    const result = hydrate ? await hydrateDriveTrackState() : await loadDriveTrackState();
    currentStore = result?.store || {days:{},trips:[]};
  } catch (error) { console.warn('[NexusNova v13] Drive store refresh failed:', error); }
  updateRibbon(); updateHistory(); readApprovedTelemetry();
}

function validLivePoint(live) {
  if (!live) return null;
  const lat = num(live.latitude), lng = num(live.longitude);
  if (!lat && !lng) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {lat,lng};
}
function rememberTrackerPoint(vehicle, live) {
  const id = String(vehicle?.vehicleId || '');
  if (id !== trackerVehicleId) { trackerVehicleId = id; trackerTrail = []; }
  const point = validLivePoint(live); if (!point) return;
  const prev = trackerTrail[trackerTrail.length-1];
  if (!prev || Math.abs(prev.lat-point.lat) > 0.000003 || Math.abs(prev.lng-point.lng) > 0.000003) {
    trackerTrail.push(point);
    if (trackerTrail.length > 120) trackerTrail.splice(0, trackerTrail.length-120);
  }
}
function updateTrackerUi(vehicle = currentVehicle) {
  const root = runtimeRoot(); if (!root) return;
  const live = vehicle?.live || null;
  const online = !!vehicle && (vehicle.trackerOnline || vehicle.status === 'online') && !!live;
  rememberTrackerPoint(vehicle, live);
  setRoute('tracking', trackerTrail);
  setText('[data-track-status]', vehicle?.trackingPaused ? 'Ⅱ PAUSED' : online ? '● LIVE' : '● OFFLINE', root);
  const chips = $$('.trackSide .trackChip b',root);
  if (chips[1]) chips[1].textContent = live ? compass(live.heading) : '—';
  if (chips[2]) chips[2].textContent = online ? 'OWNER LINK · SECURE' : 'SIGNAL · OFFLINE';
  const pills = $$('.screen[data-screen="tracking"] .mapHudTop .glassPill',root);
  if (pills[0]) pills[0].textContent = vehicle?.trackingPaused ? 'VEHICLE TRACKING · PAUSED' : online ? 'VEHICLE TRACKING · LIVE' : 'VEHICLE TRACKING · OFFLINE';
  if (pills[1]) pills[1].textContent = live ? `GPS ±${Math.round(num(live.accuracyM))}m` : 'GPS WAITING';
  const title = root.querySelector('.trackerTitle b'); if (title) title.textContent = vehicle?.displayName || 'NexusNova Vehicle';
  const button = root.querySelector('[data-toggle-track]'); if (button) { button.textContent = vehicle?.trackingPaused ? 'RESUME TRACKING' : 'PAUSE TRACKING'; button.disabled = trackerBusy || !vehicle?.vehicleId; }
  const vals = $$('.trackerMetrics b',root);
  if (vals[0]) vals[0].textContent = live ? `${Math.round(num(live.speedKmh))} km/h` : '—';
  if (vals[1]) vals[1].textContent = live && Number.isFinite(Number(live.batteryPct)) ? `${Math.round(num(live.batteryPct))}%${live.charging?' ⚡':''}` : '—';
  if (vals[2]) vals[2].textContent = live ? `±${Math.round(num(live.accuracyM))} m` : '—';
  if (vals[3]) vals[3].textContent = ago(live?.receivedAt || live?.observedAt || vehicle?.lastSeenAt);
  const addr = root.querySelector('.trackerAddress span');
  if (addr) addr.innerHTML = live ? `<strong>Current:</strong> ${num(live.latitude).toFixed(5)}, ${num(live.longitude).toFixed(5)}` : '<strong>Current:</strong> Waiting for vehicle GPS';
  const vehicleEl = root.querySelector('.vehicle3d');
  if (vehicleEl) {
    vehicleEl.style.display = live ? '' : 'none';
    vehicleEl.style.transform = `translate(-50%,-50%) rotate(${Math.round(num(live?.heading) || 0)}deg)`;
  }
}
async function refreshTracker() {
  if (!isDriveActive()) return;
  try {
    const dashboard = await loadNovaVehicleDashboard();
    currentVehicle = dashboard?.vehicles?.[0] || null;
  } catch (error) {
    console.warn('[NexusNova v13] Tracker refresh failed:', error);
    currentVehicle = null;
  }
  updateTrackerUi();
}
async function toggleTracker() {
  const vehicle = currentVehicle; if (!vehicle?.vehicleId || trackerBusy) return;
  trackerBusy = true; updateTrackerUi(vehicle);
  try {
    const paused = !vehicle.trackingPaused;
    await setNovaVehiclePaused(vehicle.vehicleId, paused);
    currentVehicle = {...vehicle,trackingPaused:paused};
  } catch (error) { console.warn('[NexusNova v13] Tracker pause failed:', error); }
  finally { trackerBusy=false; updateTrackerUi(currentVehicle); }
}

function openHistoryFilter(filter) {
  const root = runtimeRoot(); if (!root) return;
  window.NexusNovaRealWorldCandidateV13?.show?.('history');
  const button = root.querySelector(`.filterStrip [data-filter="${filter}"]`);
  if (button && !button.classList.contains('on')) button.click();
  queueMicrotask(()=>updateHistory(filter));
}
function bindProduction(root) {
  if (!root || installedRoots.has(root)) return;
  installedRoots.add(root);
  const jumps=['Today','Week','Month','All'];
  $$('.tripRibbon button',root).forEach((button,i)=>{ if(jumps[i]) button.dataset.jumpFilter=jumps[i]; });
  root.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-track]');
    if (toggle) { event.preventDefault(); event.stopImmediatePropagation(); toggleTracker(); return; }
    const jump = event.target.closest('.tripRibbon button[data-jump-filter]');
    if (jump) { event.preventDefault(); event.stopImmediatePropagation(); openHistoryFilter(jump.dataset.jumpFilter); return; }
    const filter = event.target.closest('.filterStrip [data-filter]');
    if (filter) queueMicrotask(()=>updateHistory(filter.dataset.filter));
    const nav = event.target.closest('[data-nav="tracking"]');
    if (nav) queueMicrotask(refreshTracker);
  }, true);
}

function activate() {
  installLockStyle();
  document.documentElement.classList.add(ACTIVE_CLASS);
  const root = window.NexusNovaRealWorldCandidateV13?.show?.('dashboard') || runtimeRoot();
  bindProduction(root);
  setRoute('history', []);
  setRoute('tracking', []);
  refreshStore({hydrate:true});
  refreshTracker();
  clearInterval(trackerTimer); trackerTimer = window.setInterval(refreshTracker, 10000);
  clearInterval(telemetryTimer); telemetryTimer = window.setInterval(readApprovedTelemetry, 1000);
}
function deactivate() {
  document.documentElement.classList.remove(ACTIVE_CLASS);
  clearInterval(trackerTimer); trackerTimer=0; clearInterval(telemetryTimer); telemetryTimer=0;
  trackerTrail=[]; trackerVehicleId='';
  window.NexusNovaRealWorldCandidateV13?.hide?.();
}
function reconcile() {
  reconcileQueued=false;
  if (isDriveActive()) { if (!runtimeRoot()) activate(); else { document.documentElement.classList.add(ACTIVE_CLASS); bindProduction(runtimeRoot()); } }
  else if (runtimeRoot()) deactivate();
}
function queueReconcile() { if (reconcileQueued) return; reconcileQueued=true; queueMicrotask(reconcile); }

window.addEventListener('nexusnova:drive-track-updated',()=>refreshStore());
new MutationObserver(queueReconcile).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
window.addEventListener('pageshow',queueReconcile);
window.addEventListener('resize',()=>{ if(isDriveActive()){ readApprovedTelemetry(); updateHistory(); updateTrackerUi(); } });
queueReconcile();
