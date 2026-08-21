import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';
import { requireFirebaseUser } from '../../core/firebase-backend.js';

const GAUGE_ARC = 'M 76.87 76.87 A 38 38 0 1 1 76.87 23.13';
const DRIVE_HISTORY = 90;
const MAX_DRIVE_KMH = 240;
const MAX_GPS_ACCURACY_M = 30;
const MAX_FIX_GAP_MS = 8000;
const MIN_FIX_GAP_MS = 350;
const MIN_MOVING_KMH = 2;

function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
  root.innerHTML = html;
  return root;
}

function gaugeMarkup(kind, unit) {
  return `<div class="nxgauge nxgauge--${kind}">
    <div class="nxgauge__glass" aria-hidden="true"></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(kind)} gauge">
      <defs><linearGradient id="nxGaugeGradient-${kind}" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#2d9dff"/><stop offset="78%" stop-color="#d73939"/><stop offset="100%" stop-color="#ff3b30"/></linearGradient></defs>
      <path class="nxgauge__track" d="${GAUGE_ARC}" pathLength="100"/>
      <path class="nxgauge__fill" data-gauge-fill d="${GAUGE_ARC}" pathLength="100" style="stroke-dasharray:0 100"/>
      <g class="nxgauge__scale nxgauge__scale--drive"><text x="17" y="79">0</text><text x="11" y="67">20</text><text x="10" y="54">40</text><text x="15" y="40">60</text><text x="24" y="29">80</text><text x="35" y="21">100</text><text x="50" y="18">120</text><text x="64" y="21">140</text><text x="76" y="29">160</text><text x="84" y="41">180</text><text x="89" y="54">200</text><text x="88" y="68">220</text><text x="80" y="80">240</text></g>
      <text x="50" y="30" text-anchor="middle" class="nxgauge__unitmark">KM/H</text>
      <g class="nxgauge__needle" data-gauge-needle><line x1="50" y1="51" x2="50" y2="16"/><circle cx="50" cy="51" r="5.2"/><circle cx="50" cy="51" r="2.3"/></g>
    </svg>
    <div class="nxgauge__readout"><span data-gauge-mode>READY</span><strong data-gauge-value>0</strong><small>${escapeHtml(unit)}</small></div>
    <div class="nxdrive-odometer" data-drive-odometer>000000</div>
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
}

function emptyDriveStore() { return { version:1, days:{}, trips:[] }; }
function localDayKey(value = new Date()) { const d=new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dayStart(value = new Date()) { const d=new Date(value); d.setHours(0,0,0,0); return d; }
function weekStart(value = new Date()) { const d=dayStart(value); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; }
function monthStart(value = new Date()) { const d=dayStart(value); d.setDate(1); return d; }
async function accountId(){ try{ const user=await requireFirebaseUser(); return String(user?.uid||'').trim()||'device'; }catch{return'device';} }
async function driveStoreKey(){ return `nexusnova_drive_track_v1:${await accountId()}`; }
function readDriveStore(key){ const raw=loadJson(key,null); if(!raw||typeof raw!=='object')return emptyDriveStore(); return {version:1,days:raw.days&&typeof raw.days==='object'?raw.days:{},trips:Array.isArray(raw.trips)?raw.trips.slice(0,DRIVE_HISTORY):[]}; }
function writeDriveStore(key,store){ store.trips=Array.isArray(store.trips)?store.trips.slice(0,DRIVE_HISTORY):[]; saveJson(key,store); window.dispatchEvent(new Event('nexusnova:drive-track-updated')); }
function dayRecord(store,key){ if(!store.days[key]||typeof store.days[key]!=='object')store.days[key]={distanceM:0,movingMs:0,trips:0}; const row=store.days[key]; row.distanceM=Number(row.distanceM)||0; row.movingMs=Number(row.movingMs)||0; row.trips=Number(row.trips)||0; return row; }
function rad(value){ return Number(value)*Math.PI/180; }
function haversineM(a,b){ const R=6371000,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),lat1=rad(a.lat),lat2=rad(b.lat); const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.min(1,Math.sqrt(h))); }
function formatDuration(ms){ const total=Math.max(0,Math.floor((Number(ms)||0)/1000)),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60; return h>0?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function formatDistance(meters){ const km=Math.max(0,Number(meters)||0)/1000; return km<10?`${km.toFixed(2)} km`:`${km.toFixed(1)} km`; }
function activeDuration(ride){ if(!ride)return 0; const currentPause=ride.pausedAt?Date.now()-ride.pausedAt:0; return Math.max(0,Date.now()-ride.startedAt-(ride.pausedMs||0)-currentPause); }
function compassPoint(degrees){ const names=['N','NE','E','SE','S','SW','W','NW']; return names[Math.round((((Number(degrees)||0)%360)+360)%360/45)%8]; }
function finiteSpeedMps(value){ const n=Number(value); return Number.isFinite(n)&&n>=0&&n*3.6<=MAX_DRIVE_KMH?n:NaN; }

export function renderNovaDrivePremium() {
  const root = node(`
    <section class="nxdrive-console nxdrive-console--sample-c">
      <header><div><span>LIVE GPS DRIVE</span><strong>Nova Drive</strong></div><b data-drive-state>IDLE</b></header>
      <div class="nxdrive-meter-label">METER SAMPLE C</div>
      ${gaugeMarkup('drive','KM/H')}
      <section class="nxdrive-metrics">
        <article><span>TOP SPEED</span><strong data-drive-top>0 km/h</strong></article><article><span>AVG SPEED</span><strong data-drive-average>0 km/h</strong></article><article><span>TRIP</span><strong data-drive-distance>0.00 km</strong></article>
        <article><span>DURATION</span><strong data-drive-duration>00:00</strong></article><article><span>GPS ACCURACY</span><strong data-drive-accuracy>—</strong></article><article><span>HEADING</span><strong data-drive-heading>—</strong></article>
      </section>
      <div class="nxdrive-controls"><button class="nxpi-action" type="button" data-drive-start>START DRIVE</button><button class="nxpi-action nxpi-action--pause" type="button" data-drive-pause disabled>PAUSE</button><button class="nxpi-action nxpi-action--danger" type="button" data-drive-stop disabled>STOP</button></div>
      <p class="nxpi-status" data-drive-status>Foreground GPS only. Coordinates are never stored; only trip distance/time summaries are saved.</p>
    </section>
  `,'nx-drive-premium');

  const gauge=root.querySelector('.nxgauge');
  const faceCover=gauge.querySelector('.nxgauge__glass');
  const gaugeSvg=gauge.querySelector('svg');
  const driveScale=gauge.querySelector('.nxgauge__scale--drive');
  const unitMark=gauge.querySelector('.nxgauge__unitmark');

  if(faceCover){
    faceCover.style.setProperty('display','block','important');
    faceCover.style.setProperty('position','absolute','important');
    faceCover.style.setProperty('left','50.8%','important');
    faceCover.style.setProperty('top','45.2%','important');
    faceCover.style.setProperty('width','69%','important');
    faceCover.style.setProperty('height','auto','important');
    faceCover.style.setProperty('aspect-ratio','1','important');
    faceCover.style.setProperty('transform','translate(-50%,-50%)','important');
    faceCover.style.setProperty('border-radius','50%','important');
    faceCover.style.setProperty('z-index','2','important');
    faceCover.style.setProperty('pointer-events','none','important');
    faceCover.style.setProperty('background','radial-gradient(circle,#171c20 0 70%,rgba(10,14,18,.96) 71% 80%,transparent 81%),repeating-conic-gradient(from -135deg,rgba(235,239,241,.72) 0deg .45deg,transparent .65deg 9deg),conic-gradient(from -135deg,transparent 0deg 205deg,rgba(255,37,46,.46) 205deg 270deg,transparent 270deg 360deg),radial-gradient(circle,#11161a 0%,#090d11 100%)','important');
    faceCover.style.setProperty('box-shadow','inset 0 0 38px rgba(0,0,0,.76),inset 0 0 0 1px rgba(255,255,255,.05)','important');
  }
  if(gaugeSvg){
    gaugeSvg.style.setProperty('position','absolute','important');
    gaugeSvg.style.setProperty('left','50.8%','important');
    gaugeSvg.style.setProperty('top','45.2%','important');
    gaugeSvg.style.setProperty('width','68%','important');
    gaugeSvg.style.setProperty('height','auto','important');
    gaugeSvg.style.setProperty('aspect-ratio','1','important');
    gaugeSvg.style.setProperty('transform','translate(-50%,-50%)','important');
    gaugeSvg.style.setProperty('z-index','3','important');
    gaugeSvg.style.setProperty('overflow','visible','important');
  }
  if(driveScale){
    driveScale.style.setProperty('display','block','important');
    driveScale.style.setProperty('opacity','1','important');
    driveScale.querySelectorAll('text').forEach(text=>{
      text.style.setProperty('fill','#f2f3f4','important');
      text.style.setProperty('font-size','5.1px','important');
      text.style.setProperty('font-weight','760','important');
    });
  }
  if(unitMark){
    unitMark.style.setProperty('display','block','important');
    unitMark.style.setProperty('opacity','1','important');
    unitMark.style.setProperty('fill','#c8cccf','important');
  }

  const stateEl=root.querySelector('[data-drive-state]'),topEl=root.querySelector('[data-drive-top]'),averageEl=root.querySelector('[data-drive-average]'),distanceEl=root.querySelector('[data-drive-distance]'),durationEl=root.querySelector('[data-drive-duration]'),accuracyEl=root.querySelector('[data-drive-accuracy]'),headingEl=root.querySelector('[data-drive-heading]'),odometerEl=root.querySelector('[data-drive-odometer]'),status=root.querySelector('[data-drive-status]'),start=root.querySelector('[data-drive-start]'),pause=root.querySelector('[data-drive-pause]'),stop=root.querySelector('[data-drive-stop]');
  let watchId=null,timer=null,storeKey='',ride=null,lastFix=null;

  const paint=()=>{
    const speed=ride?.pausedAt?0:Math.max(0,Number(ride?.speedKmh)||0);
    setGauge(gauge,Math.min(1,speed/MAX_DRIVE_KMH),speed,ride?.pausedAt?'PAUSED':ride?'LIVE SPEED':'READY',0);
    topEl.textContent=`${Math.round(Number(ride?.topKmh)||0)} km/h`;
    const avg=ride?.movingMs>0?(Number(ride.distanceM)/(ride.movingMs/1000))*3.6:0;
    averageEl.textContent=`${Math.round(Math.max(0,avg))} km/h`;
    distanceEl.textContent=formatDistance(ride?.distanceM||0);
    durationEl.textContent=formatDuration(activeDuration(ride));
    headingEl.textContent=Number.isFinite(ride?.heading)?`${compassPoint(ride.heading)} ${Math.round(ride.heading)}°`:'—';
    odometerEl.textContent=String(Math.round((Number(ride?.distanceM)||0)/10)).padStart(6,'0').slice(-6);
  };

  const addMovement=(distanceM,movingMs)=>{
    if(!storeKey||(!(distanceM>0)&&!(movingMs>0)))return;
    const store=readDriveStore(storeKey),row=dayRecord(store,localDayKey());
    row.distanceM+=Math.max(0,Number(distanceM)||0);
    row.movingMs+=Math.max(0,Number(movingMs)||0);
    writeDriveStore(storeKey,store);
  };

  const onFix=position=>{
    if(!ride)return;
    const c=position.coords;
    const accuracy=Number(c.accuracy);
    accuracyEl.textContent=Number.isFinite(accuracy)?`${Math.round(accuracy)} m`:'—';
    if(Number.isFinite(Number(c.heading)))ride.heading=Number(c.heading);
    if(ride.pausedAt){ lastFix=null; paint(); return; }
    if(!Number.isFinite(accuracy)||accuracy>MAX_GPS_ACCURACY_M){
      stateEl.textContent='GPS ACQUIRING';
      status.textContent='Waiting for a precise GPS fix…';
      lastFix=null;
      ride.speedKmh=0;
      paint();
      return;
    }

    const now=Number(position.timestamp)||Date.now();
    const fix={lat:Number(c.latitude),lon:Number(c.longitude),at:now,accuracy,gpsSpeed:finiteSpeedMps(c.speed)};
    if(!Number.isFinite(fix.lat)||!Number.isFinite(fix.lon))return;

    let displayedKmh=Number.isFinite(fix.gpsSpeed)?fix.gpsSpeed*3.6:0;
    let acceptedDistance=0;
    let movingMs=0;

    if(lastFix){
      const dt=Math.max(0,now-lastFix.at);
      if(dt>=MIN_FIX_GAP_MS&&dt<=MAX_FIX_GAP_MS){
        const seconds=dt/1000;
        const rawDistance=haversineM(lastFix,fix);
        const calculatedKmh=seconds>0?(rawDistance/seconds)*3.6:0;
        const previousMps=finiteSpeedMps(lastFix.gpsSpeed);
        const currentMps=finiteSpeedMps(fix.gpsSpeed);
        const sensorMps=Number.isFinite(previousMps)&&Number.isFinite(currentMps)?(previousMps+currentMps)/2:Number.isFinite(currentMps)?currentMps:Number.isFinite(previousMps)?previousMps:NaN;
        const sensorKmh=Number.isFinite(sensorMps)?sensorMps*3.6:NaN;
        const motionKmh=Number.isFinite(sensorKmh)?sensorKmh:calculatedKmh;
        const plausible=motionKmh>=0&&motionKmh<=MAX_DRIVE_KMH&&calculatedKmh<=MAX_DRIVE_KMH*1.35;

        if(plausible&&motionKmh>=MIN_MOVING_KMH){
          const combinedAccuracy=Math.hypot(accuracy,lastFix.accuracy);
          const noiseFloor=Math.max(2.5,Math.min(12,combinedAccuracy*0.22));
          const speedDistance=Number.isFinite(sensorMps)?sensorMps*seconds:NaN;

          if(Number.isFinite(speedDistance)&&speedDistance>=1){
            if(rawDistance>=noiseFloor){
              const ratio=speedDistance>0?rawDistance/speedDistance:1;
              acceptedDistance=ratio>=0.4&&ratio<=2.5?rawDistance*0.55+speedDistance*0.45:speedDistance;
            } else {
              acceptedDistance=speedDistance;
            }
          } else if(rawDistance>=noiseFloor){
            acceptedDistance=rawDistance;
          }

          const maximumSegment=(MAX_DRIVE_KMH/3.6)*seconds*1.05;
          acceptedDistance=Math.max(0,Math.min(acceptedDistance,maximumSegment));
          if(acceptedDistance>0)movingMs=dt;
        }

        if(!Number.isFinite(fix.gpsSpeed))displayedKmh=calculatedKmh<=MAX_DRIVE_KMH?calculatedKmh:0;
      }
    }

    if(!Number.isFinite(displayedKmh)||displayedKmh<0||displayedKmh>MAX_DRIVE_KMH)displayedKmh=0;
    if(ride.speedKmh>0&&displayedKmh>0)displayedKmh=ride.speedKmh*0.28+displayedKmh*0.72;

    if(acceptedDistance>0){
      ride.distanceM+=acceptedDistance;
      ride.movingMs+=movingMs;
      addMovement(acceptedDistance,movingMs);
    }

    ride.speedKmh=displayedKmh;
    const rawTopKmh=Number.isFinite(fix.gpsSpeed)?fix.gpsSpeed*3.6:displayedKmh;
    if(accuracy<=20&&rawTopKmh>=MIN_MOVING_KMH&&rawTopKmh<=MAX_DRIVE_KMH)ride.topKmh=Math.max(ride.topKmh,rawTopKmh);
    lastFix=fix;
    stateEl.textContent=displayedKmh>=MIN_MOVING_KMH?'DRIVING':'LIVE';
    status.textContent='GPS live • precision-filtered speed, distance and trip time are being recorded.';
    paint();
  };

  const finish=()=>{
    if(!ride)return;
    if(watchId!==null)navigator.geolocation?.clearWatch(watchId);
    clearInterval(timer); watchId=null; timer=null;
    if(ride.pausedAt){ride.pausedMs+=Date.now()-ride.pausedAt;ride.pausedAt=null;}
    if(storeKey){
      const store=readDriveStore(storeKey),row=dayRecord(store,localDayKey(ride.startedAt));
      row.trips+=1;
      store.trips.unshift({at:new Date(ride.startedAt).toISOString(),endedAt:new Date().toISOString(),distanceM:Math.max(0,ride.distanceM||0),movingMs:Math.max(0,ride.movingMs||0),durationMs:activeDuration(ride),topKmh:Math.max(0,ride.topKmh||0)});
      writeDriveStore(storeKey,store);
    }
    ride.speedKmh=0; paint(); ride=null; lastFix=null;
    stateEl.textContent='SAVED';
    status.textContent='Drive stopped • aggregate trip summary saved • coordinates were not stored.';
    start.disabled=false; pause.disabled=true; pause.textContent='PAUSE'; stop.disabled=true;
  };

  start.addEventListener('click',async()=>{
    if(!navigator.geolocation){status.textContent='GPS is not supported on this device.';return;}
    if(ride)return;
    storeKey=await driveStoreKey();
    ride={startedAt:Date.now(),pausedAt:null,pausedMs:0,distanceM:0,movingMs:0,topKmh:0,speedKmh:0,heading:null};
    lastFix=null; start.disabled=true; pause.disabled=false; stop.disabled=false; stateEl.textContent='STARTING'; status.textContent='Starting precision GPS…'; paint();
    timer=setInterval(paint,1000);
    watchId=navigator.geolocation.watchPosition(onFix,error=>{stateEl.textContent='GPS ERROR';status.textContent=`GPS unavailable: ${error.message||'permission or signal error'}`;},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });

  pause.addEventListener('click',()=>{
    if(!ride)return;
    if(ride.pausedAt){
      ride.pausedMs+=Date.now()-ride.pausedAt; ride.pausedAt=null; lastFix=null; pause.textContent='PAUSE'; stateEl.textContent='LIVE'; status.textContent='Drive resumed • waiting for the next precise GPS fix.';
    }else{
      ride.pausedAt=Date.now(); ride.speedKmh=0; lastFix=null; pause.textContent='RESUME'; stateEl.textContent='PAUSED'; status.textContent='Drive paused • movement is not being added.';
    }
    paint();
  });

  stop.addEventListener('click',finish);
  paint();
  root.__cleanup=()=>{if(watchId!==null)navigator.geolocation?.clearWatch(watchId);clearInterval(timer);watchId=null;timer=null;};
  return root;
}

function aggregateRange(store,startAt){ const start=dayStart(startAt).getTime(); return Object.entries(store.days||{}).reduce((sum,[key,row])=>{const at=new Date(`${key}T00:00:00`).getTime();if(!Number.isFinite(at)||at<start)return sum;sum.distanceM+=Number(row.distanceM)||0;sum.movingMs+=Number(row.movingMs)||0;sum.trips+=Number(row.trips)||0;return sum;},{distanceM:0,movingMs:0,trips:0}); }

export function renderNovaTrackPremium(){
  const root=node(`<section class="nxtrack-console"><header><div><span>DRIVE ANALYTICS</span><strong>Nova Track</strong></div><b>PRIVATE AGGREGATES</b></header><section class="nxtrack-summary"><article><span>TODAY</span><strong data-track-today>0.00 km</strong></article><article><span>THIS WEEK</span><strong data-track-week>0.00 km</strong></article><article><span>THIS MONTH</span><strong data-track-month>0.00 km</strong></article><article><span>MOVING TODAY</span><strong data-track-time>00:00</strong></article></section><section class="nxtrack-chart"><header><span>LAST 7 DAYS</span><strong data-track-total>0.00 km</strong></header><div class="nxtrack-bars" data-track-bars></div></section></section><section class="nxtrack-trips"><header><span>RECENT TRIPS</span><strong>Nova Drive history</strong></header><div data-track-trips></div></section>`,'nx-track-premium');
  const todayEl=root.querySelector('[data-track-today]'),weekEl=root.querySelector('[data-track-week]'),monthEl=root.querySelector('[data-track-month]'),timeEl=root.querySelector('[data-track-time]'),totalEl=root.querySelector('[data-track-total]'),barsEl=root.querySelector('[data-track-bars]'),tripsEl=root.querySelector('[data-track-trips]'); let key='';
  const draw=()=>{ if(!key)return; const store=readDriveStore(key),today=store.days?.[localDayKey()]||{distanceM:0,movingMs:0,trips:0},week=aggregateRange(store,weekStart()),month=aggregateRange(store,monthStart()); todayEl.textContent=formatDistance(today.distanceM||0);weekEl.textContent=formatDistance(week.distanceM);monthEl.textContent=formatDistance(month.distanceM);timeEl.textContent=formatDuration(today.movingMs||0); const days=[]; for(let i=6;i>=0;i-=1){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const row=store.days?.[localDayKey(d)]||{distanceM:0,trips:0};days.push({label:d.toLocaleDateString(undefined,{weekday:'short'}).slice(0,2).toUpperCase(),distanceM:Number(row.distanceM)||0,trips:Number(row.trips)||0});} const max=Math.max(1,...days.map(day=>day.distanceM)),total=days.reduce((sum,day)=>sum+day.distanceM,0);totalEl.textContent=formatDistance(total);barsEl.innerHTML=days.map(day=>{const height=Math.max(5,day.distanceM/max*100);return `<article title="${escapeHtml(formatDistance(day.distanceM))} • ${day.trips} trips"><div><i style="height:${height.toFixed(2)}%"></i></div><strong>${escapeHtml(day.label)}</strong><span>${day.distanceM>0?(day.distanceM/1000).toFixed(1):'0'}</span></article>`;}).join(''); tripsEl.innerHTML=store.trips.length?store.trips.slice(0,12).map(trip=>`<article class="nxtrack-trip"><div><strong>${escapeHtml(new Date(trip.at).toLocaleDateString([],{day:'2-digit',month:'short'}))}</strong><span>${escapeHtml(new Date(trip.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</span></div><b>${escapeHtml(formatDistance(trip.distanceM))}</b><small>${escapeHtml(formatDuration(trip.durationMs))} • top ${Math.round(Number(trip.topKmh)||0)} km/h</small></article>`).join(''):'<div class="nx-empty">No recorded drives yet.</div>'; };
  driveStoreKey().then(value=>{key=value;draw();}); window.addEventListener('nexusnova:drive-track-updated',draw); root.__cleanup=()=>window.removeEventListener('nexusnova:drive-track-updated',draw); return root;
}

export const premiumDriveRenderers=Object.freeze({'nova-drive':renderNovaDrivePremium,'nova-track':renderNovaTrackPremium});
