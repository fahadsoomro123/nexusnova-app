import { loadDriveTrackState } from './core/drive-track-persistence.js';

const STYLE_ID='nx-drive-native-history-v3-style';
const mounted=new WeakSet();
const overlays=new WeakMap();

function num(value){const n=Number(value);return Number.isFinite(n)?n:0}
function point(raw){
  if(!raw||typeof raw!=='object')return null;
  const lat=Number(raw.lat??raw.latitude),lng=Number(raw.lng??raw.lon??raw.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  return {lat,lng};
}
function route(trip){
  const raw=Array.isArray(trip?.routePoints)?trip.routePoints:Array.isArray(trip?.points)?trip.points:Array.isArray(trip?.route)?trip.route:[];
  return raw.map(point).filter(Boolean).slice(0,1200);
}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
function km(value){const n=Math.max(0,num(value))/1000;return n<10?n.toFixed(2):n.toFixed(1)}
function duration(ms){
  const total=Math.max(0,Math.floor(num(ms)/1000)),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function dateTime(value){
  const d=new Date(value||0);
  if(!Number.isFinite(d.getTime()))return 'Unknown time';
  try{return d.toLocaleString([],{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return d.toLocaleString()}
}
function locationText(trip,which){
  const named=String(which==='start'?(trip?.startName||trip?.startLabel||''):(trip?.endName||trip?.endLabel||'')).trim();
  if(named)return named;
  const p=point(which==='start'?trip?.startPoint:trip?.endPoint)||route(trip)[which==='start'?0:Math.max(0,route(trip).length-1)];
  return p?`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`:'Not stored';
}
function routeSvg(points){
  if(points.length<2)return '<div class="nxdrh-empty"><strong>ROUTE NOT STORED</strong><span>Is trip ke GPS route points available nahi hain.</span></div>';
  const minLat=Math.min(...points.map(p=>p.lat)),maxLat=Math.max(...points.map(p=>p.lat));
  const minLng=Math.min(...points.map(p=>p.lng)),maxLng=Math.max(...points.map(p=>p.lng));
  const latSpan=Math.max(.00001,maxLat-minLat),lngSpan=Math.max(.00001,maxLng-minLng);
  const loLat=minLat-latSpan*.08,hiLat=maxLat+latSpan*.08,loLng=minLng-lngSpan*.08,hiLng=maxLng+lngSpan*.08;
  const x=p=>42+((p.lng-loLng)/(hiLng-loLng))*916;
  const y=p=>558-((p.lat-loLat)/(hiLat-loLat))*516;
  const d=points.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(1)} ${y(p).toFixed(1)}`).join(' ');
  const first=points[0],last=points[points.length-1];
  return `<svg viewBox="0 0 1000 600" preserveAspectRatio="none" role="img" aria-label="Recorded GPS route"><path class="nxdrh-route-glow" d="${d}"/><path class="nxdrh-route" d="${d}"/><circle class="nxdrh-start" cx="${x(first).toFixed(1)}" cy="${y(first).toFixed(1)}" r="12"/><circle class="nxdrh-end" cx="${x(last).toFixed(1)}" cy="${y(last).toFixed(1)}" r="12"/></svg>`;
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.nxdr3 .nxdrh-open-target{cursor:pointer!important;outline:none!important}.nxdr3 .nxdrh-open-target:focus-visible{box-shadow:0 0 0 2px #49dcff!important}.nxdr3 .nxdrh-open-target small{color:#69e4ff!important}
.nxdrh-overlay{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(circle at 50% -10%,rgba(45,139,255,.22),transparent 38%),linear-gradient(180deg,#061527,#020912 62%,#01050a);color:#f5fbff;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;padding:max(9px,env(safe-area-inset-top)) 10px max(9px,env(safe-area-inset-bottom));box-sizing:border-box}
.nxdrh-overlay[hidden]{display:none!important}.nxdrh-overlay *{box-sizing:border-box}.nxdrh-head{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;gap:8px;min-height:50px}.nxdrh-back,.nxdrh-close{width:38px;height:38px;border:1px solid rgba(103,205,255,.24);border-radius:13px;background:linear-gradient(180deg,#0c3856,#061e34);color:#dff9ff;font-size:21px}.nxdrh-title{text-align:center;min-width:0}.nxdrh-title small{display:block;color:#4edcff;font-size:7px;font-weight:950;letter-spacing:.15em}.nxdrh-title strong{display:block;margin-top:3px;font-size:17px;line-height:1}.nxdrh-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:2px 0 10px;display:grid;align-content:start;gap:8px}.nxdrh-map{position:relative;height:clamp(210px,34vh,330px);min-height:210px;border:1px solid rgba(79,201,255,.25);border-radius:20px;overflow:hidden;background:linear-gradient(rgba(44,137,184,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(44,137,184,.09) 1px,transparent 1px),radial-gradient(circle at 50% 45%,rgba(23,120,178,.18),transparent 55%),#031423;background-size:9% 9%,9% 9%,auto,auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 15px 34px rgba(0,0,0,.3)}
.nxdrh-map:before{content:"RECORDED GPS ROUTE";position:absolute;z-index:2;left:12px;top:10px;color:#7feaff;font-size:7px;font-weight:950;letter-spacing:.15em}.nxdrh-map svg{position:absolute;inset:0;width:100%;height:100%;padding:24px 12px 10px;overflow:visible}.nxdrh-route-glow{fill:none;stroke:rgba(28,223,255,.28);stroke-width:17;stroke-linecap:round;stroke-linejoin:round;filter:blur(5px)}.nxdrh-route{fill:none;stroke:#22e9ff;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 7px #16dfff)}.nxdrh-start{fill:#37ff80;filter:drop-shadow(0 0 8px #37ff80)}.nxdrh-end{fill:#ff4661;filter:drop-shadow(0 0 8px #ff4661)}.nxdrh-empty{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:20px;color:#91aabd}.nxdrh-empty strong{color:#d9f8ff;font-size:12px;letter-spacing:.08em}.nxdrh-empty span{margin-top:6px;font-size:9px}
.nxdrh-trip-head{padding:10px 11px;border:1px solid rgba(90,174,232,.15);border-radius:16px;background:linear-gradient(155deg,rgba(9,32,54,.94),rgba(3,16,29,.95))}.nxdrh-trip-head strong{display:block;font-size:12px}.nxdrh-trip-head span{display:block;margin-top:4px;color:#8da9be;font-size:8px}.nxdrh-locs{display:grid;grid-template-columns:1fr 1fr;gap:6px}.nxdrh-loc{min-width:0;padding:9px;border:1px solid rgba(98,175,226,.13);border-radius:14px;background:rgba(5,24,40,.86)}.nxdrh-loc small{display:block;color:#698ca7;font-size:6px;font-weight:950;letter-spacing:.08em}.nxdrh-loc strong{display:block;margin-top:4px;font-size:8px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxdrh-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.nxdrh-metric{min-width:0;padding:8px 4px;border:1px solid rgba(95,170,225,.13);border-radius:13px;background:linear-gradient(155deg,rgba(8,29,49,.94),rgba(3,15,27,.95));text-align:center}.nxdrh-metric span{display:block;color:#718fa7;font-size:6px;font-weight:900}.nxdrh-metric strong{display:block;margin-top:4px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxdrh-list-title{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 0}.nxdrh-list-title strong{font-size:11px}.nxdrh-list-title span{color:#65dfff;font-size:7px}.nxdrh-list{display:grid;gap:6px}.nxdrh-row{width:100%;min-height:58px;border:1px solid rgba(94,169,224,.13);border-radius:14px;background:linear-gradient(155deg,rgba(8,28,48,.94),rgba(3,15,27,.95));color:#eefaff;padding:8px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left}.nxdrh-row.is-active{border-color:rgba(65,215,255,.5);box-shadow:inset 0 0 0 1px rgba(65,215,255,.12),0 0 18px rgba(36,187,255,.1)}.nxdrh-row div{min-width:0}.nxdrh-row strong{display:block;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxdrh-row span{display:block;margin-top:4px;color:#83a1b8;font-size:7px}.nxdrh-row b{color:#dff9ff;font-size:10px;white-space:nowrap}.nxdrh-no-trips{padding:26px 14px;border:1px dashed rgba(102,179,229,.2);border-radius:16px;text-align:center;color:#8ca8bd;font-size:9px}
@media(max-height:690px){.nxdrh-map{height:210px}.nxdrh-head{min-height:44px}.nxdrh-back,.nxdrh-close{width:34px;height:34px}.nxdrh-title strong{font-size:15px}}
`;
  document.head.appendChild(style);
}

function buildOverlay(){
  installStyle();
  const overlay=document.createElement('section');
  overlay.className='nxdrh-overlay';
  overlay.hidden=true;
  overlay.setAttribute('aria-label','Nova Drive trip history');
  overlay.innerHTML=`<header class="nxdrh-head"><button class="nxdrh-back" type="button" data-nxdrh-close aria-label="Back">‹</button><div class="nxdrh-title"><small>NOVA DRIVE / SAVED TRIPS</small><strong>Drive History</strong></div><button class="nxdrh-close" type="button" data-nxdrh-close aria-label="Close">×</button></header><div class="nxdrh-body"><div class="nxdrh-map" data-nxdrh-map></div><div class="nxdrh-trip-head"><strong data-nxdrh-date>No trip selected</strong><span data-nxdrh-mode>Recorded route details</span></div><div class="nxdrh-locs"><article class="nxdrh-loc"><small>START</small><strong data-nxdrh-start>—</strong></article><article class="nxdrh-loc"><small>END</small><strong data-nxdrh-end>—</strong></article></div><div class="nxdrh-metrics"><article class="nxdrh-metric"><span>DISTANCE</span><strong data-nxdrh-distance>0.00 km</strong></article><article class="nxdrh-metric"><span>MOVING</span><strong data-nxdrh-moving>00:00</strong></article><article class="nxdrh-metric"><span>AVG</span><strong data-nxdrh-avg>0 km/h</strong></article><article class="nxdrh-metric"><span>TOP</span><strong data-nxdrh-top>0 km/h</strong></article></div><div class="nxdrh-list-title"><strong>Recorded trips</strong><span data-nxdrh-count>0 trips</span></div><div class="nxdrh-list" data-nxdrh-list></div></div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function mount(root){
  if(!(root instanceof HTMLElement)||mounted.has(root))return;
  mounted.add(root);
  const count=root.querySelector('[data-dr-count]');
  const historyTarget=count?.closest('.nxdr3-stat');
  const lastTarget=root.querySelector('.nxdr3-last');
  if(!(historyTarget instanceof HTMLElement))return;

  historyTarget.classList.add('nxdrh-open-target');
  historyTarget.tabIndex=0;
  historyTarget.setAttribute('role','button');
  historyTarget.setAttribute('aria-label','Open Drive History and recorded routes');
  const historyHint=historyTarget.querySelector('small');
  if(historyHint)historyHint.textContent='Tap to open routes';
  if(lastTarget instanceof HTMLElement){lastTarget.classList.add('nxdrh-open-target');lastTarget.tabIndex=0;lastTarget.setAttribute('role','button');lastTarget.setAttribute('aria-label','Open last recorded trip route')}

  const overlay=buildOverlay();
  overlays.set(root,overlay);
  let trips=[];
  let selected=0;

  const close=()=>{overlay.hidden=true;document.documentElement.classList.remove('nxdrh-open')};
  const select=index=>{
    selected=Math.max(0,Math.min(trips.length-1,Number(index)||0));
    const trip=trips[selected];
    const map=overlay.querySelector('[data-nxdrh-map]');
    const list=overlay.querySelector('[data-nxdrh-list]');
    if(!trip){
      if(map)map.innerHTML='<div class="nxdrh-empty"><strong>NO SAVED TRIPS</strong><span>Complete a Drive trip to save its route here.</span></div>';
      return;
    }
    const pts=route(trip);
    if(map)map.innerHTML=routeSvg(pts);
    overlay.querySelector('[data-nxdrh-date]').textContent=dateTime(trip.endedAt||trip.at);
    overlay.querySelector('[data-nxdrh-mode]').textContent=`${String(trip.mode||'motor').toUpperCase()} • ${pts.length} GPS points`;
    overlay.querySelector('[data-nxdrh-start]').textContent=locationText(trip,'start');
    overlay.querySelector('[data-nxdrh-end]').textContent=locationText(trip,'end');
    overlay.querySelector('[data-nxdrh-distance]').textContent=`${km(trip.distanceM)} km`;
    overlay.querySelector('[data-nxdrh-moving]').textContent=duration(trip.movingMs||trip.durationMs);
    const moving=Math.max(0,num(trip.movingMs));
    const avg=moving>0?(Math.max(0,num(trip.distanceM))/(moving/1000))*3.6:Math.max(0,num(trip.avgKmh));
    overlay.querySelector('[data-nxdrh-avg]').textContent=`${Math.round(avg)} km/h`;
    overlay.querySelector('[data-nxdrh-top]').textContent=`${Math.round(Math.max(0,num(trip.topKmh)))} km/h`;
    list?.querySelectorAll('.nxdrh-row').forEach((row,i)=>row.classList.toggle('is-active',i===selected));
  };

  const refresh=async(preferLast=false)=>{
    const state=await loadDriveTrackState();
    if(!root.isConnected)return;
    trips=Array.isArray(state?.store?.trips)?state.store.trips:[];
    const list=overlay.querySelector('[data-nxdrh-list]');
    const countEl=overlay.querySelector('[data-nxdrh-count]');
    if(countEl)countEl.textContent=`${trips.length} trip${trips.length===1?'':'s'}`;
    if(list){
      list.innerHTML=trips.length?trips.map((trip,index)=>{
        const pts=route(trip);
        return `<button class="nxdrh-row${index===selected?' is-active':''}" type="button" data-nxdrh-trip="${index}"><div><strong>${esc(dateTime(trip.endedAt||trip.at))}</strong><span>${esc(String(trip.mode||'motor').toUpperCase())} • ${pts.length>=2?`${pts.length} GPS points`:'route unavailable'}</span></div><b>${km(trip.distanceM)} km</b></button>`;
      }).join(''):'<div class="nxdrh-no-trips">Abhi koi saved Drive trip nahi mili.</div>';
    }
    if(preferLast)selected=0;
    select(selected);
  };

  const open=async(preferLast=false)=>{
    overlay.hidden=false;
    document.documentElement.classList.add('nxdrh-open');
    try{await refresh(preferLast)}catch(error){console.warn('[NexusNova Drive] history view:',error)}
  };
  const onKey=(event,preferLast=false)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(preferLast)}};
  const onHistory=()=>open(false);
  const onHistoryKey=event=>onKey(event,false);
  const onLast=()=>open(true);
  const onLastKey=event=>onKey(event,true);
  const onStore=()=>{if(!overlay.hidden)refresh(false).catch(()=>{})};

  historyTarget.addEventListener('click',onHistory);
  historyTarget.addEventListener('keydown',onHistoryKey);
  lastTarget?.addEventListener('click',onLast);
  lastTarget?.addEventListener('keydown',onLastKey);
  overlay.querySelectorAll('[data-nxdrh-close]').forEach(button=>button.addEventListener('click',close));
  overlay.addEventListener('click',event=>{
    const row=event.target.closest?.('[data-nxdrh-trip]');
    if(row)select(Number(row.dataset.nxdrhTrip));
  });
  window.addEventListener('nexusnova:drive-track-updated',onStore);

  const watcher=new MutationObserver(()=>{
    if(root.isConnected)return;
    watcher.disconnect();
    window.removeEventListener('nexusnova:drive-track-updated',onStore);
    historyTarget.removeEventListener('click',onHistory);
    historyTarget.removeEventListener('keydown',onHistoryKey);
    lastTarget?.removeEventListener('click',onLast);
    lastTarget?.removeEventListener('keydown',onLastKey);
    overlay.remove();
  });
  watcher.observe(document.documentElement,{childList:true,subtree:true});
}

function scan(node=document){
  if(node instanceof HTMLElement&&node.matches('.nxdr3'))mount(node);
  node.querySelectorAll?.('.nxdr3').forEach(mount);
}

scan();
new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement)scan(node)}))).observe(document.documentElement,{childList:true,subtree:true});
