import { recoverLegacyDriveTrackState, loadDriveTrackState, persistDriveTrackState } from './core/drive-track-persistence.js';
import { loadNovaVehicleDashboard, setNovaVehiclePaused } from './core/nova-vehicle-premium-store.js';

const GOLD='nx-gold14-active';
let store={days:{},trips:[]},vehicle=null,trail=[],vehicleId='',busy=false,mounted=false,timers=[],observer=null,reconcileQueued=false;
let nativeDrive={native:true,armed:false,active:false,paused:false,distanceM:0,movingMs:0,speedKmh:0,topKmh:0,avgKmh:0,accuracy:null,heading:null,status:'GPS WAITING',updatedAt:0};
const $=(s,r=document)=>r.querySelector(s);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const text=e=>String(e?.textContent||'').trim();
const first=v=>{const m=String(v||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0};
const km=m=>{const v=Math.max(0,num(m))/1000;return v>=100?Math.round(v).toLocaleString():v>=10?v.toFixed(1):v.toFixed(2)};
const dur=ms=>{const s=Math.max(0,Math.round(num(ms)/1000)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m`};
const ago=ms=>{const at=num(ms);if(!at)return'—';const a=Math.max(0,Date.now()-at);return a<15000?'NOW':a<60000?`${Math.floor(a/1000)}s`:a<3600000?`${Math.floor(a/60000)}m`:`${Math.floor(a/3600000)}h`};

function valid(v,a,b){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=a&&Number(v)<=b}
function point(p){if(!p)return null;const lat=p.lat??p.latitude,lng=p.lng??p.lon??p.longitude;if(!valid(lat,-90,90)||!valid(lng,-180,180))return null;return{lat:Number(lat),lng:Number(lng)}}
function safeRoute(list){return(Array.isArray(list)?list:[]).map(p=>{const q=point(p);return q?{...q,at:num(p?.at)||undefined,accuracy:num(p?.accuracy)||undefined,speedKmh:num(p?.speedKmh)||undefined}:null}).filter(Boolean)}
function compass(v){if(!valid(v,-36000,36000))return'—';const d=((Number(v)%360)+360)%360,n=['N','NE','E','SE','S','SW','W','NW'];return`${n[Math.round(d/45)%8]} ${Math.round(d)}°`}
function driveRoot(){return document.querySelector('.nxdr3')}
function active(){const r=driveRoot();return!!r&&r.isConnected}
function nativeReady(){return typeof window.NexusAndroid?.postMessage==='function'&&typeof window.nexusPostNativeAction==='function'}
function nativeAction(action){if(!nativeReady())return false;try{return window.nexusPostNativeAction(action)===true}catch{return false}}

function startDay(off=0){const d=new Date;d.setHours(0,0,0,0);d.setDate(d.getDate()+off);return d.getTime()}
function range(filter){const now=Date.now();if(filter==='Today')return[startDay(0),now];if(filter==='Week')return[startDay(-6),now];if(filter==='Month'){const d=new Date;d.setHours(0,0,0,0);d.setDate(1);return[d.getTime(),now]}return[0,now]}
function trips(filter){const [a,b]=range(filter);return(Array.isArray(store?.trips)?store.trips:[]).filter(t=>{const at=new Date(t?.at||t?.endedAt||0).getTime();return Number.isFinite(at)&&at>=a&&at<=b})}
function rows(filter){const [a,b]=range(filter);return Object.entries(store?.days||{}).filter(([k])=>{const t=new Date(`${k}T12:00:00`).getTime();return Number.isFinite(t)&&t>=a&&t<=b}).map(([,r])=>r||{})}
function summary(filter){
  const list=trips(filter);
  if(list.length){
    const distanceM=list.reduce((a,t)=>a+num(t.distanceM),0),movingMs=list.reduce((a,t)=>a+num(t.movingMs||t.durationMs),0),topKmh=list.reduce((a,t)=>Math.max(a,num(t.topKmh)),0),avgKmh=movingMs>0?(distanceM/(movingMs/1000))*3.6:list.reduce((a,t)=>a+num(t.avgKmh),0)/Math.max(1,list.length);
    return{distanceM,movingMs,topKmh,avgKmh,count:list.length,list};
  }
  const r=rows(filter),distanceM=r.reduce((a,x)=>a+num(x.distanceM),0),movingMs=r.reduce((a,x)=>a+num(x.movingMs),0),count=r.reduce((a,x)=>a+num(x.trips),0);
  return{distanceM,movingMs,topKmh:0,avgKmh:movingMs>0?(distanceM/(movingMs/1000))*3.6:0,count,list:[]};
}

function driveButtonLabel(){return nativeDrive.active?'DRIVE ACTIVE':nativeDrive.armed?'AUTO DRIVE ON':'ENABLE AUTO DRIVE'}
function enforceDriveButton(){const b=$('#nxgold14 [data-action="drive"]');if(b&&b.textContent!==driveButtonLabel())b.textContent=driveButtonLabel()}
function dashboardFallback(){
  const r=driveRoot();if(!r||!window.NexusNovaGoldV14)return;
  const status=text(r.querySelector('[data-dr-confidence]'))||'GPS WAITING';
  window.NexusNovaGoldV14.setDashboard({speedKmh:first(text(r.querySelector('[data-dr-value]'))),heading:text(r.querySelector('[data-dr-heading]'))||'—',accuracy:'—',altitude:'—',distance:first(text(r.querySelector('[data-dr-distance]'))).toFixed(2),avg:first(text(r.querySelector('[data-dr-average]')))||'—',top:first(text(r.querySelector('[data-dr-top]')))||'—',time:text(r.querySelector('[data-dr-duration]'))||'0m',driving:false,status:/GPS/i.test(status)?status.toUpperCase():'AUTO DRIVE REQUIRES APP'});
  queueMicrotask(enforceDriveButton);
}
function paintNativeDashboard(){
  if(!window.NexusNovaGoldV14)return;
  if(!nativeReady()&&!nativeDrive.updatedAt){dashboardFallback();return}
  const n=nativeDrive,acc=n.accuracy!==null&&n.accuracy!==undefined&&Number.isFinite(Number(n.accuracy))?`±${Math.round(Number(n.accuracy))}m`:'—';
  const status=n.active?'DRIVE ACTIVE':n.armed?'AUTO DRIVE READY':String(n.status||'GPS WAITING').toUpperCase();
  window.NexusNovaGoldV14.setDashboard({speedKmh:num(n.speedKmh),heading:compass(n.heading),accuracy:acc,altitude:'—',distance:km(n.distanceM),avg:num(n.avgKmh)>0?String(Math.round(num(n.avgKmh))):'—',top:num(n.topKmh)>0?String(Math.round(num(n.topKmh))):'—',time:dur(n.movingMs),driving:!!n.active,status});
  queueMicrotask(enforceDriveButton);
}
function applyNative(detail){if(!detail||typeof detail!=='object')return;nativeDrive={...nativeDrive,...detail,updatedAt:num(detail.updatedAt)||Date.now()};paintNativeDashboard()}

function history(filter='Today'){
  if(!window.NexusNovaGoldV14)return;
  const s=summary(filter),last=s.list[0]||null;
  const routeTrip=s.list.find(t=>safeRoute(t?.routePoints||[]).length>=2)||last;
  const sp=point(routeTrip?.startPoint||last?.startPoint),ep=point(routeTrip?.endPoint||last?.endPoint);
  window.NexusNovaGoldV14.setHistory({filter,distance:km(s.distanceM),time:dur(s.movingMs),avg:s.avgKmh?String(Math.round(s.avgKmh)):'—',top:s.topKmh?String(Math.round(s.topKmh)):'—',trips:s.count,start:routeTrip?.startName||last?.startName||(sp?`${sp.lat.toFixed(5)}, ${sp.lng.toFixed(5)}`:'Not stored'),end:routeTrip?.endName||last?.endName||(ep?`${ep.lat.toFixed(5)}, ${ep.lng.toFixed(5)}`:'Not stored'),routePoints:safeRoute(routeTrip?.routePoints||[])});
}
async function refreshStore(recover=false){
  try{const r=recover?await recoverLegacyDriveTrackState():await loadDriveTrackState();store=r?.store||{days:{},trips:[]}}
  catch(e){console.warn('[NexusNova Gold14] store',e)}
  history(window.NexusNovaGold14Filter||'Today');
}
async function preserveCompletedRoutes(detail,attempt=0){
  const queue=Array.isArray(detail?.completedTrips)?detail.completedTrips:detail?.completedTrip?[detail.completedTrip]:[];
  const useful=queue.map(c=>({nativeId:String(c?.nativeId||''),routePoints:safeRoute(c?.routePoints),startPoint:point(c?.startPoint),endPoint:point(c?.endPoint)})).filter(c=>c.nativeId&&(c.routePoints.length>=2||c.startPoint||c.endPoint));
  if(!useful.length)return;
  try{
    const state=await loadDriveTrackState(),next=state?.store;if(!next||!Array.isArray(next.trips))return;
    let changed=false,missing=false;
    for(const c of useful){
      const trip=next.trips.find(t=>String(t?.nativeId||'')===c.nativeId);
      if(!trip){missing=true;continue}
      if(c.routePoints.length>=2&&(!Array.isArray(trip.routePoints)||trip.routePoints.length<2)){trip.routePoints=c.routePoints;changed=true}
      if(c.startPoint&&!point(trip.startPoint)){trip.startPoint=c.startPoint;changed=true}
      if(c.endPoint&&!point(trip.endPoint)){trip.endPoint=c.endPoint;changed=true}
    }
    if(changed){const saved=await persistDriveTrackState(next);store=saved?.store||next;window.dispatchEvent(new Event('nexusnova:drive-track-updated'))}
    if(missing&&attempt<2)setTimeout(()=>preserveCompletedRoutes(detail,attempt+1).catch(()=>{}),attempt?900:300);
  }catch(e){if(attempt<2)setTimeout(()=>preserveCompletedRoutes(detail,attempt+1).catch(()=>{}),attempt?900:300)}
}

function remember(v){
  const id=String(v?.vehicleId||'');if(id!==vehicleId){vehicleId=id;trail=[]}
  const p=point(v?.live);if(!p)return;const last=trail[trail.length-1];
  if(!last||Math.abs(last.lat-p.lat)>.000003||Math.abs(last.lng-p.lng)>.000003){trail.push(p);if(trail.length>120)trail.splice(0,trail.length-120)}
}
function tracker(){
  if(!window.NexusNovaGoldV14)return;
  const v=vehicle,live=v?.live||null,p=point(live),online=!!v&&(v.trackerOnline||v.status==='online')&&!!p;
  remember(v);
  window.NexusNovaGoldV14.setTracker({owner:v?.trackerBound===false?'LOCKED':'OWNER',online,paused:!!v?.trackingPaused,gps:live&&Number.isFinite(Number(live.accuracyM))?`GPS ±${Math.round(num(live.accuracyM))}m`:'GPS WAITING',speed:live&&Number.isFinite(Number(live.speedKmh))?String(Math.round(num(live.speedKmh))):'—',battery:live&&Number.isFinite(Number(live.batteryPct))?`${Math.round(num(live.batteryPct))}%`:'—',signal:live?.signal?String(live.signal).toUpperCase():'—',lastSeen:ago(live?.receivedAt||live?.observedAt||v?.lastSeenAt),routePoints:trail,live:p});
}
async function refreshTracker(){
  try{const d=await loadNovaVehicleDashboard();vehicle=d?.vehicles?.find?.(v=>v?.trackerBound)||d?.vehicles?.[0]||null}
  catch(e){console.warn('[NexusNova Gold14] tracker',e);vehicle=null}
  tracker();
}
async function toggleTracker(){
  const v=vehicle;if(!v?.vehicleId||busy)return;busy=true;
  try{await setNovaVehiclePaused(v.vehicleId,!v.trackingPaused);vehicle={...v,trackingPaused:!v.trackingPaused}}
  catch(e){console.warn('[NexusNova Gold14] pause',e)}
  finally{busy=false;tracker()}
}

function driveAction(){
  const toggle=driveRoot()?.querySelector('[data-dr-toggle]');
  if(toggle){toggle.click();setTimeout(()=>nativeAction('nativeDriveStatus'),260);return}
  if(nativeReady())nativeAction(nativeDrive.armed?'nativeDriveStop':'nativeDriveStart');
}
function actions(){return{drive:driveAction,recover(){driveRoot()?.querySelector('[data-dr-recover]')?.click()},home(){window.NexusNovaFresh?.openHub?.()},filter(filter){window.NexusNovaGold14Filter=filter;history(filter)},trackerToggle(){toggleTracker()}}}

function mount(){
  if(mounted||!active()||!window.NexusNovaGoldV14)return;
  mounted=true;
  document.documentElement.classList.add(GOLD);
  const lock=document.createElement('style');
  lock.id='nxgold14-lock';
  lock.textContent=`html.${GOLD} .nxdr3{opacity:0!important;visibility:hidden!important;pointer-events:none!important}html.${GOLD} #nxgold14{visibility:visible!important;opacity:1!important;pointer-events:auto!important}`;
  document.head.appendChild(lock);
  window.NexusNovaGoldV14.mount({actions:actions()});
  refreshStore(true);
  refreshTracker();
  if(nativeReady())nativeAction('nativeDriveStatus');else dashboardFallback();
  timers=[setInterval(()=>refreshStore(false),8000),setInterval(refreshTracker,12000)];
}
function unmount(){
  if(!mounted)return;
  mounted=false;
  timers.forEach(clearInterval);timers=[];
  window.NexusNovaGoldV14?.unmount?.();
  $('#nxgold14-lock')?.remove();
  document.documentElement.classList.remove(GOLD);
  trail=[];vehicleId='';
}
function reconcile(){active()?mount():unmount()}
function scheduleReconcile(){
  if(active()===mounted||reconcileQueued)return;
  reconcileQueued=true;
  queueMicrotask(()=>{reconcileQueued=false;reconcile()});
}

window.addEventListener('nexusnova:native-drive',event=>{applyNative(event?.detail);preserveCompletedRoutes(event?.detail).catch(()=>{})});
window.addEventListener('nexusnova:drive-track-updated',()=>refreshStore(false));
window.addEventListener('resize',()=>window.NexusNovaGoldV14?.resize?.());
window.addEventListener('pageshow',reconcile);
observer=new MutationObserver(scheduleReconcile);
observer.observe(document.documentElement,{subtree:true,childList:true});
reconcile();
