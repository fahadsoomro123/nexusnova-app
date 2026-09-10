import { loadDriveTrackState } from './core/drive-track-persistence.js';

const TRACK_PREFIX='nexusnova_drive_track_v1:';
const ARCHIVE_KEY='nexusnova_drive_archive_v16';
let nativeTrips=[];
let storeTrips=[];
let lastHistory=null;
let installed=false;
let repaintQueued=false;

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function point(raw){
  if(!raw||typeof raw!=='object')return null;
  const lat=Number(raw.lat??raw.latitude),lng=Number(raw.lng??raw.lon??raw.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  return {lat,lng,...(Number.isFinite(Number(raw.at??raw.time??raw.timestamp))?{at:Number(raw.at??raw.time??raw.timestamp)}:{})};
}
function route(raw){return(Array.isArray(raw)?raw:[]).map(point).filter(Boolean).slice(0,1200)}
function tripTime(t){const d=new Date(t?.endedAt??t?.at??0).getTime();return Number.isFinite(d)?d:0}
function filterStart(filter){
  const d=new Date();d.setHours(0,0,0,0);
  if(filter==='Today')return d.getTime();
  if(filter==='Week'){d.setDate(d.getDate()-6);return d.getTime()}
  if(filter==='Month'){d.setDate(1);return d.getTime()}
  return 0;
}
function clean(raw){
  if(!raw||typeof raw!=='object')return null;
  const r=route(raw.routePoints||raw.points||raw.route);
  if(r.length<2)return null;
  return {...raw,routePoints:r,startPoint:point(raw.startPoint||raw.startCoordinate||raw.start),endPoint:point(raw.endPoint||raw.endCoordinate||raw.end)};
}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}}
function localLegacyTrips(){
  const out=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key||!key.startsWith(TRACK_PREFIX))continue;
      const raw=readJson(key,null);
      if(Array.isArray(raw?.trips))out.push(...raw.trips);
    }
    const archived=readJson(ARCHIVE_KEY,[]);
    if(Array.isArray(archived))out.push(...archived);
  }catch{}
  return out;
}
function candidates(filter){
  const start=filterStart(filter),seen=new Set(),rows=[];
  for(const raw of [...nativeTrips,...storeTrips,...localLegacyTrips()]){
    const t=clean(raw);if(!t)continue;
    const at=tripTime(t);if(at<start)continue;
    const id=String(t.nativeId||t.tripId||'')||`${at}|${Math.round(num(t.distanceM))}|${t.routePoints.length}`;
    if(seen.has(id))continue;seen.add(id);rows.push(t);
  }
  return rows.sort((a,b)=>tripTime(b)-tripTime(a));
}
function enrich(input={}){
  const current=route(input.routePoints);
  if(current.length>=2)return input;
  const best=candidates(input.filter||'Today')[0];
  if(!best)return input;
  const start=best.startPoint||best.routePoints[0],end=best.endPoint||best.routePoints.at(-1);
  return {...input,routePoints:best.routePoints,start:input.start&&input.start!=='Not stored'?input.start:(best.startName||best.startLabel||(start?`${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`:input.start)),end:input.end&&input.end!=='Not stored'?input.end:(best.endName||best.endLabel||(end?`${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}`:input.end))};
}
async function refreshStore(){
  try{const state=await loadDriveTrackState();storeTrips=Array.isArray(state?.store?.trips)?state.store.trips:[]}catch{}
  scheduleRepaint();
}
function scheduleRepaint(){
  if(repaintQueued)return;repaintQueued=true;
  queueMicrotask(()=>{repaintQueued=false;if(lastHistory&&window.NexusNovaGoldV14?.setHistory)window.NexusNovaGoldV14.setHistory({...lastHistory})});
}
function install(){
  if(installed)return true;
  const api=window.NexusNovaGoldV14;if(!api?.setHistory)return false;
  installed=true;
  const original=api.setHistory.bind(api);
  api.setHistory=(value={})=>{lastHistory={...(lastHistory||{}),...value};const fixed=enrich(lastHistory);lastHistory={...lastHistory,...fixed};return original(fixed)};
  refreshStore();
  try{window.nexusPostNativeAction?.('nativeDriveStatus')}catch{}
  return true;
}

window.addEventListener('nexusnova:native-drive',event=>{
  const d=event?.detail||{};
  const q=Array.isArray(d.completedTrips)?d.completedTrips:d.completedTrip?[d.completedTrip]:[];
  if(q.length){nativeTrips=q;refreshStore()}
});
window.addEventListener('nexusnova:drive-track-updated',refreshStore);

if(!install()){
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer)},100);
}
window.NexusNovaDriveVisibleRouteV19={refresh:refreshStore,candidates:filter=>candidates(filter||'Today').length};
