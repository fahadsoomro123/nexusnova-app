/* NexusNova Drive + Track v1
   Foreground/manual GPS driving utilities.
   - Nova Drive: live GPS speed, top speed, trip distance, duration, accuracy,
     heading and elevation with explicit Start/Stop controls.
   - Nova Track: today/week/month distance, trips, moving time and 7-day history.
   - No coordinates are persisted. Only aggregate distance/time/trip summaries
     are stored locally per NexusNova account on this device.
*/
(() => {
  'use strict';
  if (window.__nxDriveTrackV1) return;
  window.__nxDriveTrackV1 = true;
  window.nexusNovaDriveTrackVersion = 'drive-track-v1';

  const $ = id => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const MAX_HISTORY = 90;
  const MAX_REASONABLE_KMH = 240;
  const MAX_ACCEPTABLE_ACCURACY_M = 80;

  const DRIVE_ICON = `<span class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M6.5 14.5a6 6 0 0 1 11 0"/><path d="m12 14 3.5-4"/><circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg></span>`;
  const TRACK_ICON = `<span class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M3 19h19"/></svg></span>`;

  let watchId = null;
  let rideTimer = null;
  let ride = null;
  let lastFix = null;
  let lastUiSpeed = 0;

  function accountKey() {
    const id = String(window.nexusAccountId || window.__nexusAuthUser?.uid || 'guest').trim() || 'guest';
    return `nexusnova_drive_track_v1:${id}`;
  }

  function emptyStore() {
    return { version:1, days:{}, trips:[] };
  }

  function readStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(accountKey()) || 'null');
      if (!raw || typeof raw !== 'object') return emptyStore();
      return {
        version:1,
        days:raw.days && typeof raw.days === 'object' ? raw.days : {},
        trips:Array.isArray(raw.trips) ? raw.trips.slice(0,MAX_HISTORY) : []
      };
    } catch (_) {
      return emptyStore();
    }
  }

  function writeStore(data) {
    try {
      data.trips = Array.isArray(data.trips) ? data.trips.slice(0,MAX_HISTORY) : [];
      localStorage.setItem(accountKey(), JSON.stringify(data));
      return true;
    } catch (_) {
      return false;
    }
  }

  function localDayKey(value = new Date()) {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function dayStart(value = new Date()) {
    const d = new Date(value);
    d.setHours(0,0,0,0);
    return d;
  }

  function weekStart(value = new Date()) {
    const d = dayStart(value);
    const weekday = (d.getDay()+6)%7;
    d.setDate(d.getDate()-weekday);
    return d;
  }

  function monthStart(value = new Date()) {
    const d = dayStart(value);
    d.setDate(1);
    return d;
  }

  function dayRecord(store,key) {
    const existing = store.days[key];
    if (!existing || typeof existing !== 'object') {
      store.days[key] = {distanceM:0,movingMs:0,trips:0};
    }
    const row = store.days[key];
    row.distanceM = Number(row.distanceM)||0;
    row.movingMs = Number(row.movingMs)||0;
    row.trips = Number(row.trips)||0;
    return row;
  }

  function addMovement(distanceM,movingMs) {
    if (!(distanceM > 0) && !(movingMs > 0)) return;
    const store = readStore();
    const row = dayRecord(store,localDayKey());
    row.distanceM += Math.max(0,Number(distanceM)||0);
    row.movingMs += Math.max(0,Number(movingMs)||0);
    writeStore(store);
    window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
  }

  function finishTripSummary() {
    if (!ride || ride.tripRecorded) return;
    ride.tripRecorded = true;
    const store = readStore();
    const row = dayRecord(store,localDayKey(ride.startedAt));
    row.trips += 1;
    store.trips.unshift({
      at:new Date(ride.startedAt).toISOString(),
      endedAt:new Date().toISOString(),
      distanceM:Math.max(0,ride.distanceM||0),
      movingMs:Math.max(0,ride.movingMs||0),
      durationMs:Math.max(0,Date.now()-ride.startedAt),
      topKmh:Math.max(0,ride.topKmh||0)
    });
    writeStore(store);
    window.dispatchEvent(new Event('nexusnova:drive-track-updated'));
  }

  const rad = value => Number(value) * Math.PI / 180;
  function haversineM(a,b) {
    const R = 6371000;
    const dLat = rad(b.lat-a.lat);
    const dLon = rad(b.lon-a.lon);
    const lat1 = rad(a.lat), lat2 = rad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }

  function bearingDeg(a,b) {
    const p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon-a.lon);
    const y = Math.sin(dl)*Math.cos(p2);
    const x = Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  }

  function formatDuration(ms) {
    const total = Math.max(0,Math.floor((Number(ms)||0)/1000));
    const h = Math.floor(total/3600);
    const m = Math.floor((total%3600)/60);
    const s = total%60;
    return h > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function formatDistance(m) {
    const km = Math.max(0,Number(m)||0)/1000;
    return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function installStyles() {
    if ($('nxDriveTrackV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'nxDriveTrackV1Styles';
    style.textContent = `
      #tab-nova-drive,#tab-nova-track{padding-bottom:12px}
      .nxdt-shell{max-width:760px;margin:0 auto}
      .nxdt-hero{position:relative;overflow:hidden;margin-bottom:12px;padding:17px;border:1px solid rgba(74,176,255,.22);border-radius:23px;background:radial-gradient(circle at 88% 0,rgba(45,196,255,.18),transparent 36%),linear-gradient(145deg,rgba(7,31,58,.98),rgba(3,12,25,.99));box-shadow:0 15px 38px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.045)}
      .nxdt-kicker{color:#55c4ff;font-size:9px;font-weight:950;letter-spacing:.19em;text-transform:uppercase}
      .nxdt-title{margin:4px 0 0;color:#fff;font-size:22px;line-height:1.1;font-weight:950;letter-spacing:-.03em}
      .nxdt-copy{margin:7px 0 0;color:#86a1be;font-size:11px;line-height:1.5}
      .nxdt-gps-pill{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:7px 10px;border-radius:999px;border:1px solid rgba(93,185,255,.18);background:rgba(11,39,70,.75);color:#a9c7e6;font-size:9px;font-weight:850;letter-spacing:.06em}.nxdt-gps-pill i{width:7px;height:7px;border-radius:50%;background:#7f9ab7}.nxdt-gps-pill.live i{background:#27df9d;box-shadow:0 0 12px rgba(39,223,157,.65)}
      .nxdt-gauge-card{display:grid;grid-template-columns:minmax(220px,320px) minmax(0,1fr);gap:16px;align-items:center;margin-bottom:12px;padding:17px;border:1px solid rgba(80,164,255,.17);border-radius:23px;background:linear-gradient(145deg,rgba(7,24,45,.98),rgba(3,13,27,.99));box-shadow:0 12px 30px rgba(0,0,0,.22)}
      .nxdt-gauge{--nxdt-arc:0deg;position:relative;width:min(68vw,280px);aspect-ratio:1;margin:auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(from 225deg,#1678ff 0deg,#31d5ff var(--nxdt-arc),rgba(41,94,145,.16) var(--nxdt-arc),rgba(41,94,145,.16) 270deg,transparent 270deg);box-shadow:0 0 0 1px rgba(86,184,255,.13),0 18px 44px rgba(0,0,0,.34),inset 0 0 35px rgba(30,130,255,.08)}
      .nxdt-gauge:before{content:"";position:absolute;inset:16px;border-radius:50%;background:radial-gradient(circle at 50% 36%,rgba(31,120,213,.20),transparent 35%),linear-gradient(160deg,#071a2e,#020914 75%);border:1px solid rgba(108,190,255,.14);box-shadow:inset 0 0 34px rgba(0,0,0,.46)}
      .nxdt-speed{position:relative;z-index:1;text-align:center}.nxdt-speed strong{display:block;color:#fff;font-size:58px;line-height:.95;font-weight:950;letter-spacing:-.07em;text-shadow:0 0 24px rgba(62,190,255,.22)}.nxdt-speed span{display:block;margin-top:7px;color:#64c8ff;font-size:10px;font-weight:900;letter-spacing:.18em}.nxdt-speed small{display:block;margin-top:12px;color:#718ba7;font-size:9px;letter-spacing:.08em}
      .nxdt-side-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.nxdt-stat{min-height:80px;padding:12px;border-radius:16px;border:1px solid rgba(91,159,229,.13);background:rgba(8,25,45,.88)}.nxdt-stat span{display:block;color:#718aa5;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.nxdt-stat strong{display:block;margin-top:7px;color:#f4f9ff;font-size:17px;font-weight:900;word-break:break-word}.nxdt-stat em{display:block;margin-top:4px;color:#4dafff;font-size:9px;font-style:normal}
      .nxdt-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px}.nxdt-btn{min-height:51px;border-radius:15px;border:1px solid rgba(96,180,255,.20);background:linear-gradient(145deg,rgba(13,63,119,.78),rgba(6,30,59,.94));color:#eafbff;font-weight:900;font-size:12px;letter-spacing:.045em;touch-action:manipulation}.nxdt-btn.primary{background:linear-gradient(135deg,#126cff,#20bdf3);border-color:rgba(150,224,255,.50);box-shadow:0 10px 26px rgba(23,126,255,.23)}.nxdt-btn.stop{background:linear-gradient(135deg,#8b2339,#c83a50);border-color:rgba(255,130,151,.34)}.nxdt-btn:disabled{opacity:.38;filter:saturate(.4)}
      .nxdt-note{margin-top:9px;color:#6f88a3;font-size:9.5px;line-height:1.5;text-align:center}
      .nxdt-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:12px}.nxdt-summary-card{padding:14px;border-radius:18px;border:1px solid rgba(88,169,249,.15);background:linear-gradient(145deg,rgba(8,29,52,.95),rgba(4,16,31,.97));box-shadow:0 8px 22px rgba(0,0,0,.17)}.nxdt-summary-card span{display:block;color:#7891ad;font-size:9px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.nxdt-summary-card strong{display:block;margin-top:8px;color:#fff;font-size:18px;font-weight:950}.nxdt-summary-card small{display:block;margin-top:4px;color:#4fb8ff;font-size:9px}
      .nxdt-card{margin-bottom:12px;padding:15px;border-radius:20px;border:1px solid rgba(84,160,235,.14);background:linear-gradient(145deg,rgba(7,25,46,.97),rgba(3,13,27,.98));box-shadow:0 10px 27px rgba(0,0,0,.18)}.nxdt-card h3{margin:0;color:#f6fbff;font-size:13px;font-weight:900}.nxdt-card p{margin:4px 0 0;color:#748da8;font-size:9.5px}
      .nxdt-chart{display:grid;grid-template-columns:repeat(7,1fr);gap:7px;align-items:end;height:145px;margin-top:15px;padding-top:8px}.nxdt-bar-col{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px}.nxdt-bar-track{width:100%;max-width:34px;height:105px;display:flex;align-items:flex-end;border-radius:10px;background:rgba(18,49,79,.65);overflow:hidden;border:1px solid rgba(85,158,229,.10)}.nxdt-bar{width:100%;min-height:3px;border-radius:9px 9px 5px 5px;background:linear-gradient(180deg,#2bd6ff,#1676ff);box-shadow:0 0 16px rgba(38,153,255,.18)}.nxdt-bar-col b{color:#7895b2;font-size:8px;font-weight:800}.nxdt-bar-col small{color:#4e6c8b;font-size:7px}
      .nxdt-trip{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid rgba(83,150,218,.10)}.nxdt-trip:last-child{border-bottom:0}.nxdt-trip strong{display:block;color:#eef7ff;font-size:11px}.nxdt-trip span{display:block;margin-top:3px;color:#6e89a5;font-size:8.5px}.nxdt-trip b{color:#59c6ff;font-size:11px}.nxdt-empty{padding:14px 0;color:#7089a4;font-size:10px;text-align:center}
      #moreMenu .more-item[data-nx-drive-track="drive"]{--mi-a:#10b8dc;--mi-b:#0665c2}
      #moreMenu .more-item[data-nx-drive-track="track"]{--mi-a:#8b5cf6;--mi-b:#4f33c7}
      @media(max-width:620px){.nxdt-gauge-card{grid-template-columns:1fr;padding:14px}.nxdt-gauge{width:min(64vw,245px)}.nxdt-speed strong{font-size:50px}.nxdt-side-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.nxdt-stat{min-height:70px;padding:10px}.nxdt-stat strong{font-size:14px}.nxdt-summary{grid-template-columns:1fr}.nxdt-summary-card{display:grid;grid-template-columns:1fr auto;align-items:center}.nxdt-summary-card strong{margin-top:0;text-align:right}.nxdt-summary-card small{grid-column:1/-1}.nxdt-chart{gap:4px}}
      @media(max-width:370px){.nxdt-side-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.nxdt-gauge{width:min(72vw,230px)}}
    `;
    document.head.appendChild(style);
  }

  function createTab(id,html) {
    let tab = $(id);
    if (tab) return tab;
    const main = document.querySelector('main.main') || document.querySelector('main');
    if (!main) return null;
    tab = document.createElement('section');
    tab.id = id;
    tab.className = 'tab';
    tab.innerHTML = html;
    main.appendChild(tab);
    return tab;
  }

  function ensureTabs() {
    createTab('tab-nova-drive',`
      <div class="nxdt-shell">
        <section class="nxdt-hero">
          <div class="nxdt-kicker">NEXUSNOVA • GPS DRIVE</div>
          <div class="nxdt-title">Nova Drive</div>
          <p class="nxdt-copy">Premium foreground GPS speedometer and trip meter. Start a ride only when you are ready to track.</p>
          <div id="nxDriveGpsStatus" class="nxdt-gps-pill"><i></i><span>GPS IDLE</span></div>
        </section>
        <section class="nxdt-gauge-card">
          <div id="nxDriveGauge" class="nxdt-gauge">
            <div class="nxdt-speed"><strong id="nxDriveSpeed">0</strong><span>KM/H</span><small>LIVE GPS SPEED</small></div>
          </div>
          <div class="nxdt-side-stats">
            <div class="nxdt-stat"><span>Top Speed</span><strong id="nxDriveTop">0.0</strong><em>km/h</em></div>
            <div class="nxdt-stat"><span>Trip</span><strong id="nxDriveDistance">0.00</strong><em>km</em></div>
            <div class="nxdt-stat"><span>Duration</span><strong id="nxDriveDuration">00:00</strong><em>elapsed</em></div>
            <div class="nxdt-stat"><span>Accuracy</span><strong id="nxDriveAccuracy">—</strong><em>GPS meters</em></div>
            <div class="nxdt-stat"><span>Heading</span><strong id="nxDriveHeading">—</strong><em>degrees</em></div>
            <div class="nxdt-stat"><span>Elevation</span><strong id="nxDriveAltitude">—</strong><em>meters</em></div>
          </div>
        </section>
        <div class="nxdt-controls">
          <button id="nxDriveStart" class="nxdt-btn primary" type="button">START RIDE</button>
          <button id="nxDriveStop" class="nxdt-btn stop" type="button" disabled>STOP RIDE</button>
        </div>
        <div class="nxdt-note">GPS starts only after you tap Start Ride. Keep your phone safely mounted while driving.</div>
      </div>`);

    createTab('tab-nova-track',`
      <div class="nxdt-shell">
        <section class="nxdt-hero">
          <div class="nxdt-kicker">NEXUSNOVA • DISTANCE LOG</div>
          <div class="nxdt-title">Nova Track</div>
          <p class="nxdt-copy">Your locally stored daily, weekly and monthly distance from completed or active Nova Drive sessions.</p>
          <div class="nxdt-gps-pill live"><i></i><span>LOCAL PRIVATE HISTORY</span></div>
        </section>
        <section class="nxdt-summary">
          <div class="nxdt-summary-card"><span>Today</span><strong id="nxTrackToday">0.00 km</strong><small id="nxTrackTodayMeta">0 trips • 00:00 moving</small></div>
          <div class="nxdt-summary-card"><span>This Week</span><strong id="nxTrackWeek">0.00 km</strong><small id="nxTrackWeekMeta">0 trips • 00:00 moving</small></div>
          <div class="nxdt-summary-card"><span>This Month</span><strong id="nxTrackMonth">0.00 km</strong><small id="nxTrackMonthMeta">0 trips • 00:00 moving</small></div>
        </section>
        <section class="nxdt-card">
          <h3>Last 7 Days</h3><p>Distance completed with Nova Drive.</p>
          <div id="nxTrackChart" class="nxdt-chart"></div>
        </section>
        <section class="nxdt-card">
          <h3>Recent Trips</h3><p>Trip summaries only — GPS coordinates are not stored.</p>
          <div id="nxTrackTrips"></div>
        </section>
      </div>`);
  }

  function makeHubButton(target,label,kind,icon,a,b) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'more-item';
    button.dataset.nxDriveTrack = kind;
    button.dataset.nxNovaHubTarget = target;
    button.dataset.nxNovaHubLatePalette = '1';
    button.setAttribute('onclick',`openMoreTab('${target}')`);
    button.style.setProperty('--mi-a',a);
    button.style.setProperty('--mi-b',b);
    button.innerHTML = `${icon}<span>${label}</span>`;
    button.addEventListener('click',()=>{
      if (target === 'nova-track') setTimeout(renderTrack,80);
      [40,150].forEach(ms=>setTimeout(fitHubPanel,ms));
    });
    return button;
  }

  function labelOf(button) {
    const spans = button?.querySelectorAll(':scope > span');
    return String(spans?.length ? spans[spans.length-1].textContent : button?.textContent || '').replace(/\s+/g,' ').trim().toUpperCase();
  }

  function ensureHubButtons() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner) return false;
    let drive = inner.querySelector('[data-nx-drive-track="drive"]');
    let track = inner.querySelector('[data-nx-drive-track="track"]');
    const speedTest = $$('#moreMenu .more-item').find(button=>labelOf(button)==='SPEED TEST');
    if (!drive) {
      drive = makeHubButton('nova-drive','Nova Drive','drive',DRIVE_ICON,'#10b8dc','#0665c2');
      if (speedTest) inner.insertBefore(drive,speedTest); else inner.appendChild(drive);
    }
    if (!track) {
      track = makeHubButton('nova-track','Nova Track','track',TRACK_ICON,'#8b5cf6','#4f33c7');
      drive.insertAdjacentElement('afterend',track);
    }
    return true;
  }

  function fitHubPanel() {
    const menu = $('moreMenu');
    const inner = menu?.querySelector('.more-inner');
    if (!menu || !inner || !menu.classList.contains('show')) return;
    requestAnimationFrame(()=>{
      if (!menu.classList.contains('show')) return;
      const dock = document.querySelector('.bottom-dock');
      const rect = menu.getBoundingClientRect();
      const dockTop = dock?.getBoundingClientRect()?.top;
      const viewportBottom = Math.min(window.innerHeight || document.documentElement.clientHeight || 0,dockTop || Number.POSITIVE_INFINITY);
      const available = Math.max(160,Math.floor(viewportBottom-Math.max(0,rect.top)-8));
      const contentHeight = Math.max(120,Math.ceil(inner.scrollHeight+26));
      const desired = Math.min(available,contentHeight);
      menu.style.setProperty('min-height','0px','important');
      menu.style.setProperty('height','auto','important');
      menu.style.setProperty('max-height',`${desired}px`,'important');
    });
  }

  function setGpsStatus(text,live=false) {
    const el = $('nxDriveGpsStatus');
    if (!el) return;
    el.classList.toggle('live',live);
    const span = el.querySelector('span');
    if (span) span.textContent = text;
  }

  function setText(id,value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function renderDrive() {
    const active = Boolean(ride?.running);
    const speed = Math.max(0,lastUiSpeed||0);
    setText('nxDriveSpeed',String(Math.round(speed)));
    setText('nxDriveTop',(ride?.topKmh||0).toFixed(1));
    setText('nxDriveDistance',((ride?.distanceM||0)/1000).toFixed(2));
    setText('nxDriveDuration',formatDuration(active ? Date.now()-ride.startedAt : (ride?.durationMs||0)));
    setText('nxDriveAccuracy',Number.isFinite(ride?.accuracy) ? `${Math.round(ride.accuracy)} m` : '—');
    setText('nxDriveHeading',Number.isFinite(ride?.heading) ? `${Math.round(ride.heading)}°` : '—');
    setText('nxDriveAltitude',Number.isFinite(ride?.altitude) ? `${Math.round(ride.altitude)} m` : '—');
    const gauge = $('nxDriveGauge');
    if (gauge) gauge.style.setProperty('--nxdt-arc',`${Math.max(0,Math.min(270,(speed/220)*270)).toFixed(1)}deg`);
    const start = $('nxDriveStart'), stop = $('nxDriveStop');
    if (start) start.disabled = active;
    if (stop) stop.disabled = !active;
  }

  function stopWatch() {
    if (watchId !== null && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
    }
    watchId = null;
    if (rideTimer) clearInterval(rideTimer);
    rideTimer = null;
  }

  function stopRide(options={}) {
    const wasRunning = Boolean(ride?.running);
    stopWatch();
    if (ride) {
      ride.running = false;
      ride.durationMs = Date.now()-ride.startedAt;
      if (wasRunning && options.record !== false) finishTripSummary();
    }
    lastFix = null;
    lastUiSpeed = 0;
    setGpsStatus(options.message || (wasRunning ? 'RIDE SAVED' : 'GPS IDLE'),false);
    renderDrive();
    renderTrack();
    return true;
  }

  function onGpsError(error) {
    const code = Number(error?.code)||0;
    const label = code === 1 ? 'LOCATION PERMISSION DENIED' : code === 2 ? 'GPS SIGNAL UNAVAILABLE' : 'GPS TIMEOUT — RETRY';
    setGpsStatus(label,false);
    stopWatch();
    if (ride) ride.running = false;
    lastUiSpeed = 0;
    renderDrive();
  }

  function onPosition(position) {
    if (!ride?.running || document.visibilityState === 'hidden') return;
    const c = position?.coords;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
    const now = Number(position.timestamp)||Date.now();
    const accuracy = Number(c.accuracy);
    const fix = {lat:Number(c.latitude),lon:Number(c.longitude),time:now,accuracy:Number.isFinite(accuracy)?accuracy:null};
    ride.accuracy = Number.isFinite(accuracy) ? accuracy : ride.accuracy;
    ride.altitude = Number.isFinite(c.altitude) ? Number(c.altitude) : ride.altitude;

    let derivedKmh = 0;
    let segmentM = 0;
    let dt = 0;
    if (lastFix) {
      dt = Math.max(0,now-lastFix.time);
      segmentM = haversineM(lastFix,fix);
      if (dt >= 500) derivedKmh = segmentM/(dt/1000)*3.6;
    }

    const nativeKmh = Number.isFinite(c.speed) && c.speed >= 0 ? Number(c.speed)*3.6 : NaN;
    let speedKmh = Number.isFinite(nativeKmh) ? nativeKmh : derivedKmh;
    if (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > MAX_REASONABLE_KMH*1.35) speedKmh = 0;

    if (Number.isFinite(c.heading) && c.heading >= 0) ride.heading = Number(c.heading);
    else if (lastFix && segmentM >= 4) ride.heading = bearingDeg(lastFix,fix);

    const accurate = !Number.isFinite(accuracy) || accuracy <= MAX_ACCEPTABLE_ACCURACY_M;
    const plausible = !lastFix || !derivedKmh || derivedKmh <= MAX_REASONABLE_KMH;
    if (lastFix && dt >= 500 && accurate && plausible) {
      const priorAccuracy = Number.isFinite(lastFix.accuracy) ? lastFix.accuracy : 12;
      const currentAccuracy = Number.isFinite(accuracy) ? accuracy : 12;
      const noiseFloor = Math.max(2.5,Math.min(12,Math.max(priorAccuracy,currentAccuracy)*0.25));
      if (segmentM >= noiseFloor) {
        ride.distanceM += segmentM;
        const movingMs = speedKmh >= 1 ? Math.min(dt,15000) : 0;
        ride.movingMs += movingMs;
        addMovement(segmentM,movingMs);
      }
    }

    if (accurate && speedKmh <= MAX_REASONABLE_KMH) ride.topKmh = Math.max(ride.topKmh,speedKmh);
    lastUiSpeed = speedKmh;
    lastFix = fix;
    setGpsStatus(accurate ? 'GPS LIVE' : `LOW ACCURACY • ${Math.round(accuracy)} m`,accurate);
    renderDrive();
  }

  function startRide() {
    if (ride?.running) return;
    if (!navigator.geolocation?.watchPosition) {
      setGpsStatus('GPS NOT AVAILABLE',false);
      return;
    }
    ride = {
      running:true,startedAt:Date.now(),durationMs:0,distanceM:0,movingMs:0,topKmh:0,
      accuracy:null,heading:null,altitude:null,tripRecorded:false
    };
    lastFix = null;
    lastUiSpeed = 0;
    setGpsStatus('ACQUIRING HIGH-ACCURACY GPS',false);
    renderDrive();
    try {
      watchId = navigator.geolocation.watchPosition(onPosition,onGpsError,{
        enableHighAccuracy:true,
        maximumAge:1000,
        timeout:10000
      });
      rideTimer = setInterval(renderDrive,1000);
    } catch (error) {
      onGpsError(error);
    }
  }

  function aggregateRange(store,start,end) {
    let distanceM=0,movingMs=0,trips=0;
    const from = dayStart(start).getTime(), to = dayStart(end).getTime();
    Object.entries(store.days||{}).forEach(([key,row])=>{
      const time = new Date(`${key}T00:00:00`).getTime();
      if (!Number.isFinite(time) || time < from || time > to) return;
      distanceM += Number(row?.distanceM)||0;
      movingMs += Number(row?.movingMs)||0;
      trips += Number(row?.trips)||0;
    });
    return {distanceM,movingMs,trips};
  }

  function renderTrack() {
    if (!$('tab-nova-track')) return;
    const store = readStore();
    const now = new Date();
    const today = dayStart(now);
    const todayAgg = aggregateRange(store,today,today);
    const weekAgg = aggregateRange(store,weekStart(now),today);
    const monthAgg = aggregateRange(store,monthStart(now),today);

    setText('nxTrackToday',formatDistance(todayAgg.distanceM));
    setText('nxTrackTodayMeta',`${todayAgg.trips} trip${todayAgg.trips===1?'':'s'} • ${formatDuration(todayAgg.movingMs)} moving`);
    setText('nxTrackWeek',formatDistance(weekAgg.distanceM));
    setText('nxTrackWeekMeta',`${weekAgg.trips} trip${weekAgg.trips===1?'':'s'} • ${formatDuration(weekAgg.movingMs)} moving`);
    setText('nxTrackMonth',formatDistance(monthAgg.distanceM));
    setText('nxTrackMonthMeta',`${monthAgg.trips} trip${monthAgg.trips===1?'':'s'} • ${formatDuration(monthAgg.movingMs)} moving`);

    const days = [];
    for (let i=6;i>=0;i--) {
      const d = new Date(today);
      d.setDate(d.getDate()-i);
      const row = store.days[localDayKey(d)] || {};
      days.push({date:d,distanceM:Number(row.distanceM)||0});
    }
    const maxM = Math.max(1,...days.map(day=>day.distanceM));
    const chart = $('nxTrackChart');
    if (chart) chart.innerHTML = days.map(day=>{
      const pct = Math.max(3,Math.round(day.distanceM/maxM*100));
      const km = day.distanceM/1000;
      return `<div class="nxdt-bar-col"><div class="nxdt-bar-track"><div class="nxdt-bar" style="height:${pct}%"></div></div><b>${day.date.toLocaleDateString(undefined,{weekday:'short'}).slice(0,3)}</b><small>${km<10?km.toFixed(1):Math.round(km)}k</small></div>`;
    }).join('');

    const trips = $('nxTrackTrips');
    if (trips) {
      const recent = (store.trips||[]).slice(0,10);
      trips.innerHTML = recent.length ? recent.map(item=>{
        const when = new Date(item.at);
        return `<div class="nxdt-trip"><div><strong>${escapeHtml(when.toLocaleDateString())} • ${escapeHtml(when.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</strong><span>${escapeHtml(formatDuration(item.durationMs))} elapsed • top ${(Number(item.topKmh)||0).toFixed(1)} km/h</span></div><b>${escapeHtml(formatDistance(item.distanceM))}</b></div>`;
      }).join('') : '<div class="nxdt-empty">No Nova Drive trips yet. Start a ride when you are ready.</div>';
    }
  }

  function bindControls() {
    const start = $('nxDriveStart'), stop = $('nxDriveStop');
    if (start && start.dataset.nxDriveBound !== '1') {
      start.dataset.nxDriveBound = '1';
      start.addEventListener('click',startRide);
    }
    if (stop && stop.dataset.nxDriveBound !== '1') {
      stop.dataset.nxDriveBound = '1';
      stop.addEventListener('click',()=>stopRide());
    }
  }

  function installHubObserver() {
    const inner = document.querySelector('#moreMenu .more-inner');
    if (!inner || inner.__nxDriveTrackObserver) return;
    let queued = false;
    const observer = new MutationObserver(()=>{
      if (queued) return;
      queued = true;
      requestAnimationFrame(()=>{
        queued = false;
        ensureHubButtons();
        fitHubPanel();
      });
    });
    observer.observe(inner,{childList:true});
    inner.__nxDriveTrackObserver = observer;
  }

  function install() {
    installStyles();
    ensureTabs();
    ensureHubButtons();
    bindControls();
    installHubObserver();
    renderDrive();
    renderTrack();

    document.addEventListener('click',event=>{
      if (event.target?.closest?.('#moreBtn,#moreMenu .more-item,.bottom-dock')) {
        [0,70,180].forEach(ms=>setTimeout(fitHubPanel,ms));
      }
    },true);
    window.addEventListener('nexusnova:drive-track-updated',renderTrack);
    window.addEventListener('nexusaccountready',()=>setTimeout(renderTrack,0));
    window.addEventListener('pageshow',()=>{ renderTrack(); fitHubPanel(); });
    window.addEventListener('pagehide',()=>{
      if (ride?.running) stopRide({record:true,message:'RIDE SAVED'});
      else stopWatch();
    });
    [250,800,1800,4000].forEach(ms=>setTimeout(()=>{
      ensureTabs();ensureHubButtons();bindControls();renderTrack();fitHubPanel();
    },ms));

    window.NexusNovaDriveTrack = Object.freeze({
      version:'1.0.0',
      start:startRide,
      stop:stopRide,
      refresh:renderTrack,
      isRunning:()=>Boolean(ride?.running)
    });
    window.dispatchEvent(new Event('nexusnova:drive-track-ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
