import { loadDriveTrackState } from './core/drive-track-persistence.js';

const mounted = new WeakSet();
const FILTERS = new Set(['today','week','month','history']);
const SLICE_HEIGHTS = [90,106,80,76,280,134,110,234,130];
const SLICE_FILES = SLICE_HEIGHTS.map((_, index) => {
  const id = String(index + 1).padStart(2,'0');
  return new URL(`../assets/visuals/drive-history-b64/history-s${id}.b64`, import.meta.url).href;
});
const TOTAL_H = 1240;
const EMPTY_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const fmt = new Intl.DateTimeFormat([], { day:'2-digit', month:'short', year:'numeric' });
const timeFmt = new Intl.DateTimeFormat([], { hour:'2-digit', minute:'2-digit' });

function n(v){ const x=Number(v); return Number.isFinite(x) ? x : 0; }
function safe(v){ return Math.max(0,n(v)); }
function km(m){ const x=safe(m)/1000; return x < 10 ? x.toFixed(2) : x.toFixed(1); }
function speed(v){ return String(Math.round(safe(v))); }
function dur(ms){
  const s=Math.floor(safe(ms)/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), r=s%60;
  return h ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}
function date(v){ const d=new Date(v||Date.now()); return Number.isNaN(d.getTime())?'—':fmt.format(d); }
function clock(v){ const d=new Date(v||Date.now()); return Number.isNaN(d.getTime())?'—':timeFmt.format(d); }
function esc(v){ return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function point(raw){
  if(!raw||typeof raw!=='object') return null;
  const lat=Number(raw.lat??raw.latitude), lng=Number(raw.lng??raw.lon??raw.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) return null;
  return {lat,lng,at:n(raw.at||raw.time)};
}
function points(trip){
  const raw=Array.isArray(trip?.routePoints)?trip.routePoints:Array.isArray(trip?.points)?trip.points:[];
  return raw.map(point).filter(Boolean);
}
function dayStart(d=new Date()){ const x=new Date(d);x.setHours(0,0,0,0);return x; }
function weekStart(d=new Date()){ const x=dayStart(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x; }
function monthStart(d=new Date()){ const x=dayStart(d);x.setDate(1);return x; }
function filtered(trips, filter){
  const rows=Array.isArray(trips)?trips:[];
  if(filter==='history') return rows;
  const start=(filter==='today'?dayStart():filter==='week'?weekStart():monthStart()).getTime();
  return rows.filter(t=>new Date(t?.at||t?.endedAt||0).getTime()>=start);
}
function routeSvg(route){
  if(route.length<2) return `<div class="nxh2-no-route"><b>ROUTE NOT STORED</b><span>Purani trip ke GPS points available nahi.</span></div>`;
  const minLat=Math.min(...route.map(p=>p.lat)), maxLat=Math.max(...route.map(p=>p.lat));
  const minLng=Math.min(...route.map(p=>p.lng)), maxLng=Math.max(...route.map(p=>p.lng));
  const dx=Math.max(0.00001,maxLng-minLng), dy=Math.max(0.00001,maxLat-minLat);
  const loLng=minLng-dx*.08, hiLng=maxLng+dx*.08, loLat=minLat-dy*.08, hiLat=maxLat+dy*.08;
  const X=p=>(p.lng-loLng)/(hiLng-loLng)*1000, Y=p=>620-(p.lat-loLat)/(hiLat-loLat)*620;
  const d=route.map((p,i)=>`${i?'L':'M'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ');
  const a=route[0], b=route.at(-1);
  return `<svg viewBox="0 0 1000 620" preserveAspectRatio="none" aria-label="Recorded trip route"><path d="${d}"/><circle class="start" cx="${X(a)}" cy="${Y(a)}" r="12"/><circle class="end" cx="${X(b)}" cy="${Y(b)}" r="12"/></svg>`;
}
async function b64DataUrl(url){
  const urls=Array.isArray(url)?url:[url];
  const parts=await Promise.all(urls.map(async item=>{
    const r=await fetch(item,{cache:'no-store'});
    if(!r.ok) return '';
    return (await r.text()).replace(/\s+/g,'');
  }));
  const b64=parts.join('');
  if(!b64) return EMPTY_PIXEL;
  if(!b64.startsWith('UklGR')) throw new Error('Drive History WEBP header invalid');
  return `data:image/webp;base64,${b64}`;
}
function installStyle(){
  if(document.querySelector('[data-nx-drive-history-v2-style]')) return;
  document.head.insertAdjacentHTML('beforeend',`<style data-nx-drive-history-v2-style>
  .nx-approved-history-v2{position:absolute!important;top:50%!important;left:50%!important;width:var(--nx-approved-drive-cover-w,100vw)!important;height:var(--nx-approved-drive-cover-h,max(100dvh,170.370371vw))!important;z-index:90!important;overflow:hidden!important;background:#01050a!important;transform:translate(-50%,-50%)!important;aspect-ratio:864/1472!important}
  .nx-approved-history-v2:not(.is-active){display:none!important}.nxh2-art{position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:none}.nxh2-art img{display:block;width:100%;height:auto;flex:none}
  .nxh2-cover{position:absolute;background:linear-gradient(180deg,#061a2a,#03101b);border:1px solid rgba(63,197,255,.16);box-shadow:inset 0 0 25px rgba(0,174,255,.04)}
  .nxh2-map{left:3.45%;top:28.95%;width:93.1%;height:20.55%;border-radius:16px;overflow:hidden;background:linear-gradient(rgba(39,128,171,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(39,128,171,.08) 1px,transparent 1px),#031423;background-size:9% 9%}
  .nxh2-map svg{width:100%;height:100%;padding:6%;overflow:visible}.nxh2-map path{fill:none;stroke:#22e9ff;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 8px #16dfff)}.nxh2-map circle.start{fill:#39ff7d;filter:drop-shadow(0 0 9px #39ff7d)}.nxh2-map circle.end{fill:#ff425d;filter:drop-shadow(0 0 9px #ff425d)}
  .nxh2-no-route{position:absolute;inset:0;display:grid;place-content:center;text-align:center;color:#8faabc;font-size:1.55vw}.nxh2-no-route b{color:#bff6ff;font-size:2.15vw;letter-spacing:.08em}.nxh2-no-route span{margin-top:5px}
  .nxh2-metrics{position:absolute;left:3.35%;top:51.15%;width:93.3%;height:8.8%;display:grid;grid-template-columns:repeat(4,1fr);gap:1.4%;pointer-events:none}.nxh2-metric{display:grid;place-content:center;text-align:center;padding-top:10%;color:#fff;text-shadow:0 2px 5px #000}.nxh2-metric b{font-size:4.65vw;line-height:1}.nxh2-metric small{margin-top:7px;color:#a7d5ed;font-size:2.1vw;font-weight:800}
  .nxh2-locs{position:absolute;left:3%;top:62.2%;width:94%;height:7.4%;display:grid;grid-template-columns:1fr 1fr;gap:2.1%;pointer-events:none}.nxh2-loc{padding:7% 8% 3% 20%;min-width:0;color:#fff}.nxh2-loc b{display:block;font-size:2.65vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nxh2-loc span{display:block;margin-top:3px;color:#a7d5ed;font-size:2.1vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nxh2-recent{position:absolute;left:3.3%;top:74.0%;width:93.2%;height:13.4%;padding:4.4% 3% 1%;display:grid;grid-template-rows:repeat(3,1fr);pointer-events:none}.nxh2-row{display:grid;grid-template-columns:1.35fr .8fr .7fr;align-items:center;gap:3%;padding-left:8.5%;color:#eaf8ff;font-size:2.45vw}.nxh2-row span:nth-child(2),.nxh2-row span:nth-child(3){text-align:right}
  .nxh2-hit{position:absolute;z-index:8;border:0;background:transparent;color:transparent;padding:0;cursor:pointer}.nxh2-tab-dashboard{left:3.1%;top:16.75%;width:47%;height:5.2%}.nxh2-tab-history{left:50.2%;top:16.75%;width:46.7%;height:5.2%}.nxh2-filter{top:23.15%;height:4.8%}.nxh2-filter.today{left:3%;width:21.4%}.nxh2-filter.week{left:25.2%;width:24.5%}.nxh2-filter.month{left:50.4%;width:25.5%}.nxh2-filter.history{left:76.4%;width:20.5%}.nxh2-filter.is-active{background:rgba(0,191,255,.08);box-shadow:inset 0 0 0 2px rgba(40,224,255,.75),0 0 16px rgba(0,180,255,.25);border-radius:999px}.nxh2-viewall{left:76%;top:71.2%;width:20%;height:4.2%}.nxh2-trip-hit{left:4%;width:92%;height:3.9%}.nxh2-trip-hit.r1{top:76.6%}.nxh2-trip-hit.r2{top:80.6%}.nxh2-trip-hit.r3{top:84.6%}
  .nxh2-dashboard-tabs{position:absolute;z-index:66;left:3.8%;top:19.95%;width:92.4%;height:5.9%;display:grid;grid-template-columns:1fr 1fr;gap:0;pointer-events:auto}
  .nxh2-dashboard-tabs button{min-width:0;border:1px solid rgba(70,188,255,.34);background:linear-gradient(180deg,rgba(8,29,48,.94),rgba(3,14,25,.96));color:#bddbf1;font-size:clamp(13px,3.25vw,24px);font-weight:850;letter-spacing:-.01em;display:flex;align-items:center;justify-content:center;gap:10px;-webkit-tap-highlight-color:transparent}
  .nxh2-dashboard-tabs button:first-child{border-radius:15px 0 0 15px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}
  .nxh2-dashboard-tabs button:last-child{border-radius:0 15px 15px 0;background:linear-gradient(180deg,rgba(22,125,255,.82),rgba(8,58,126,.94) 50%,rgba(5,24,54,.98));color:#fff;box-shadow:inset 0 0 18px rgba(91,217,255,.22),0 0 22px rgba(27,139,255,.28)}
  </style>`);
}
function mount(ui){
  if(!(ui instanceof HTMLElement)||mounted.has(ui)) return;
  const drive=ui.querySelector('[data-approved-drive-view]');
  const tracker=ui.querySelector('[data-approved-tracker-view]');
  if(!drive||!tracker) return;
  mounted.add(ui); installStyle();
  const history=document.createElement('section');
  history.className='nx-approved-view nx-approved-history-v2'; history.dataset.approvedHistoryViewV2=''; history.setAttribute('aria-hidden','true');
  history.innerHTML=`<div class="nxh2-art"></div><div class="nxh2-cover nxh2-map" data-h2-map></div><div class="nxh2-metrics"><div class="nxh2-metric"><b data-h2-distance>0.00</b><small>km</small></div><div class="nxh2-metric"><b data-h2-moving>00:00</b><small>hh:mm</small></div><div class="nxh2-metric"><b data-h2-avg>0</b><small>km/h</small></div><div class="nxh2-metric"><b data-h2-top>0</b><small>km/h</small></div></div><div class="nxh2-locs"><div class="nxh2-loc"><b data-h2-start>—</b><span data-h2-start-time>—</span></div><div class="nxh2-loc"><b data-h2-end>—</b><span data-h2-end-time>—</span></div></div><div class="nxh2-recent" data-h2-recent></div><button class="nxh2-hit nxh2-tab-dashboard" data-h2-dashboard aria-label="Drive Dashboard"></button><button class="nxh2-hit nxh2-tab-history" data-h2-history aria-label="Drive History"></button><button class="nxh2-hit nxh2-filter today" data-h2-filter="today" aria-label="Today"></button><button class="nxh2-hit nxh2-filter week" data-h2-filter="week" aria-label="This Week"></button><button class="nxh2-hit nxh2-filter month" data-h2-filter="month" aria-label="This Month"></button><button class="nxh2-hit nxh2-filter history" data-h2-filter="history" aria-label="History"></button><button class="nxh2-hit nxh2-viewall" data-h2-viewall aria-label="View all trips"></button><button class="nxh2-hit nxh2-trip-hit r1" data-h2-pick="0" aria-label="Open recent trip 1"></button><button class="nxh2-hit nxh2-trip-hit r2" data-h2-pick="1" aria-label="Open recent trip 2"></button><button class="nxh2-hit nxh2-trip-hit r3" data-h2-pick="2" aria-label="Open recent trip 3"></button>`;
  ui.appendChild(history);
  drive.insertAdjacentHTML('beforeend',`<div class="nxh2-dashboard-tabs" data-h2-dashboard-tabs><button type="button" aria-label="Dashboard">Dashboard</button><button type="button" aria-label="Drive History" data-h2-open-visible>Drive History</button></div>`);
  const art=history.querySelector('.nxh2-art');
  Promise.all(SLICE_FILES.map(b64DataUrl)).then(urls=>{if(history.isConnected)art.innerHTML=urls.map((src,i)=>`<img src="${src}" alt="" style="height:${(SLICE_HEIGHTS[i]/TOTAL_H*100).toFixed(6)}%">`).join('');}).catch(err=>console.error('[NexusNova] Drive History visual load failed',err));
  let store={trips:[]}, filter='today', selected=null, open=false, native={active:false}; const q=s=>history.querySelector(s);
  function currentRows(){return filtered(store.trips||[],filter);}
  function applyStickyTrip(){
    if(native?.active===true) return; const last=store.trips?.[0]; if(!last)return; const shell=ui.closest('.nxdr3')||document;
    [['[data-dr-distance]',`${km(last.distanceM)} km`],['[data-dr-average]',`${speed(last.avgKmh)} km/h`],['[data-dr-top]',`${speed(last.topKmh)} km/h`],['[data-dr-duration]',dur(last.movingMs)]].forEach(([sel,val])=>{const el=shell.querySelector(sel);if(el)el.textContent=val;});
  }
  function render(){
    const rows=currentRows(); if(!selected||!rows.includes(selected))selected=rows[0]||null; history.querySelectorAll('[data-h2-filter]').forEach(b=>b.classList.toggle('is-active',b.dataset.h2Filter===filter));
    const t=selected, route=points(t), a=route[0]||point(t?.startPoint), b=route.at(-1)||point(t?.endPoint);
    q('[data-h2-distance]').textContent=t?km(t.distanceM):'0.00';q('[data-h2-moving]').textContent=t?dur(t.movingMs):'00:00';q('[data-h2-avg]').textContent=t?speed(t.avgKmh):'0';q('[data-h2-top]').textContent=t?speed(t.topKmh):'0';q('[data-h2-start]').textContent=t?(t.startName||t.startLabel||(a?`${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`:'Location not stored')):'—';q('[data-h2-end]').textContent=t?(t.endName||t.endLabel||(b?`${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}`:'Location not stored')):'—';q('[data-h2-start-time]').textContent=t?`Start ${clock(t.at)}`:'—';q('[data-h2-end-time]').textContent=t?`End ${clock(t.endedAt)}`:'—';q('[data-h2-map]').innerHTML=routeSvg(route);q('[data-h2-recent]').innerHTML=rows.slice(0,3).map(t=>`<div class="nxh2-row"><span>${esc(date(t.at))}</span><span>${km(t.distanceM)} km</span><span>${esc(dur(t.movingMs))}</span></div>`).join('');
  }
  async function reload(){const state=await loadDriveTrackState();store=state?.store||{trips:[]};applyStickyTrip();if(open)render();}
  function openHistory(next='today'){filter=FILTERS.has(next)?next:'today';selected=null;open=true;ui.classList.add('is-history-open');history.classList.add('is-active');history.setAttribute('aria-hidden','false');render();reload().catch(()=>{});}
  function closeHistory(){open=false;ui.classList.remove('is-history-open');history.classList.remove('is-active');history.setAttribute('aria-hidden','true');}
  drive.querySelector('[data-h2-open-visible]')?.addEventListener('click',()=>openHistory('today'));
  [['today','today'],['week','week'],['month','month'],['history','history']].forEach(([cls,f])=>{const hit=document.createElement('button');hit.type='button';hit.className=`nx-history-entry-v2 ${cls}`;hit.style.cssText='position:absolute;z-index:62;top:64.7%;height:6.2%;border:0;background:transparent;color:transparent';hit.style.left=cls==='today'?'4.3%':cls==='week'?'27.3%':cls==='month'?'50.0%':'72.3%';hit.style.width=cls==='history'?'21.2%':'19.2%';hit.onclick=()=>openHistory(f);drive.appendChild(hit);});
  q('[data-h2-dashboard]').onclick=closeHistory;history.querySelectorAll('[data-h2-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.h2Filter;selected=null;render();});history.querySelectorAll('[data-h2-pick]').forEach(b=>b.onclick=()=>{const row=currentRows()[Number(b.dataset.h2Pick)||0];if(row){selected=row;render();}});q('[data-h2-viewall]').onclick=()=>{filter='history';selected=null;render();};
  const onNative=e=>{native=e?.detail&&typeof e.detail==='object'?e.detail:native;if(native.active!==true)applyStickyTrip();if(open)render();};const onStore=()=>reload().catch(()=>{});window.addEventListener('nexusnova:native-drive',onNative);window.addEventListener('nexusnova:drive-track-updated',onStore);const trackerObserver=new MutationObserver(()=>{if(tracker.classList.contains('is-active'))closeHistory();});trackerObserver.observe(tracker,{attributes:true,attributeFilter:['class']});reload().catch(()=>{});window.NexusNovaDriveHistory={open:openHistory,close:closeHistory};
}
function scan(root=document){if(root instanceof HTMLElement&&root.matches('[data-nx-approved]'))mount(root);root.querySelectorAll?.('[data-nx-approved]').forEach(mount);}
scan();new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n instanceof HTMLElement)scan(n);}))).observe(document.documentElement,{childList:true,subtree:true});
