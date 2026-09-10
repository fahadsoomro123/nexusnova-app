import { loadDriveTrackState, persistDriveTrackState } from './core/drive-track-persistence.js';

const KEY='nexusnova_drive_archive_v16';
const api=window.NexusNovaGoldV14;
let recoveryTimer=null,recoveryBusy=false;
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:0};
function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function write(v){try{localStorage.setItem(KEY,JSON.stringify(v));return true}catch(e){console.warn('[Nova Drive Archive] local archive write failed',e);return false}}
function id(t){const n=String(t?.nativeId||'').trim();return n?`n:${n}`:[t?.at,t?.endedAt,Math.round(num(t?.distanceM)),Math.round(num(t?.movingMs||t?.durationMs))].join('|')}
function point(p){if(!p||typeof p!=='object')return null;const lat=Number(p.lat??p.latitude),lng=Number(p.lng??p.lon??p.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;return{lat,lng,...(Number.isFinite(Number(p.at))?{at:Number(p.at)}:{})}}
function route(list){return(Array.isArray(list)?list:[]).map(point).filter(Boolean)}
function clean(t){if(!t||typeof t!=='object')return null;const at=new Date(Number(t.at)||t.at||Date.now()),end=new Date(Number(t.endedAt)||t.endedAt||Date.now());if(Number.isNaN(at.getTime())||Number.isNaN(end.getTime()))return null;const r=route(t.routePoints);const s=point(t.startPoint),e=point(t.endPoint);return{nativeId:String(t.nativeId||'').trim(),at:at.toISOString(),endedAt:end.toISOString(),distanceM:num(t.distanceM),movingMs:num(t.movingMs),durationMs:num(t.durationMs||t.movingMs),topKmh:num(t.topKmh),avgKmh:num(t.avgKmh),mode:String(t.mode||'unknown'),...(r.length?{routePoints:r}:{}),...(s?{startPoint:s}:{}),...(e?{endPoint:e}:{})}}
function archiveTrips(list){const current=read(),m=new Map(current.map(t=>[id(t),t]));let changed=false;for(const raw of Array.isArray(list)?list:[]){const t=clean(raw);if(!t)continue;const k=id(t),old=m.get(k);if(!old||JSON.stringify(old)!==JSON.stringify(t)){m.set(k,{...old,...t});changed=true}}if(changed)write([...m.values()].sort((a,b)=>new Date(b.endedAt)-new Date(a.endedAt)));return changed}
async function recoverArchive(){
  if(recoveryBusy)return{recovered:0,busy:true};
  const archived=read();if(!archived.length)return{recovered:0};
  recoveryBusy=true;
  try{
    const state=await loadDriveTrackState(),store=state?.store||{days:{},trips:[]};
    const current=Array.isArray(store.trips)?store.trips:[],m=new Map(current.map(t=>[id(t),t]));
    let changed=false,added=0;
    for(const t of archived){
      const k=id(t),old=m.get(k);
      if(!old){m.set(k,t);added++;changed=true;continue}
      const merged={...t,...old};
      if(JSON.stringify(merged)!==JSON.stringify(old)){m.set(k,merged);changed=true}
    }
    if(!changed)return{recovered:0,total:current.length};
    const trips=[...m.values()].sort((a,b)=>new Date(b.endedAt)-new Date(a.endedAt));
    const saved=await persistDriveTrackState({...store,trips});
    return{recovered:added,cloud:saved?.cloud===true,total:saved?.store?.trips?.length||trips.length};
  }finally{recoveryBusy=false}
}
function scheduleRecovery(delay=80){clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>recoverArchive().catch(e=>console.warn('[Nova Drive Archive] recovery failed',e)),delay)}

window.addEventListener('nexusnova:native-drive',e=>{const d=e?.detail||{},q=Array.isArray(d.completedTrips)?d.completedTrips:d.completedTrip?[d.completedTrip]:[];if(archiveTrips(q))scheduleRecovery(120)});
window.addEventListener('nexusnova:drive-track-updated',()=>scheduleRecovery(100));
window.NexusNovaDriveArchiveV16={recover:recoverArchive,count:()=>read().length};

if(api){const baseMount=api.mount.bind(api);api.mount=(opts={})=>{const original=opts.actions?.recover;const actions={...(opts.actions||{}),recover:async()=>{try{await recoverArchive()}catch(e){console.warn('[Nova Drive Archive] recovery failed',e)}try{return original?.()}catch{}}};const r=baseMount({...opts,actions});scheduleRecovery(250);return r}}
