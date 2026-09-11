import { travelCall } from './travel-edge-client.js';

// Additive-only Travel result details. Core search/provider/layout logic is untouched.
const ROOT_SELECTOR = '.nn-travel-v19';
const STYLE_ID = 'nn-travel-result-details-v1';
const wikiCache = new Map();
const geoCache = new Map();
let geoTail = Promise.resolve();
let lastGeoAt = 0;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const safeHttps = value => {
  try { const u = new URL(String(value || '')); return u.protocol === 'https:' ? u.href : ''; }
  catch { return ''; }
};
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const money = (value,currency='PKR') => {
  const n=num(value); if(n===null) return 'Provider value unavailable';
  try { return new Intl.NumberFormat('en-PK',{style:'currency',currency,maximumFractionDigits:0}).format(n); }
  catch { return `${Math.round(n).toLocaleString()} ${currency}`; }
};
const clock = value => {
  const d=new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : '—';
};
const duration = value => {
  const n=Math.max(0,Math.round(Number(value)||0)); return n ? `${Math.floor(n/60)}h ${n%60}m` : '—';
};

function installStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style'); style.id=STYLE_ID;
  style.textContent=`
.nn-travel-v19 .nn-result.nn-rdv-ready{grid-template-columns:62px minmax(0,1fr) auto!important;cursor:pointer!important;outline:none!important}
.nn-travel-v19 .nn-result.nn-rdv-ready>.nn-logo{display:none!important}
.nn-travel-v19 .nn-result.nn-rdv-ready:focus-visible{box-shadow:0 0 0 2px #65eaff,0 0 18px rgba(55,215,255,.38)!important}
.nn-rdv-thumb{position:relative;width:60px;height:52px;border:1px solid #398ab0;border-radius:10px;overflow:hidden;background:linear-gradient(145deg,#0d557b,#05243c);display:grid;place-items:center;align-self:center;color:#c9f5ff;font-size:9px;font-weight:900}
.nn-rdv-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}.nn-rdv-thumb[data-ready="true"] img{display:block}
.nn-rdv-thumb small{position:absolute;right:3px;bottom:3px;z-index:3;padding:1px 3px;border-radius:999px;background:rgba(1,18,29,.84);border:1px solid rgba(99,229,255,.45);color:#bdf5ff;font-size:5.5px;font-weight:900}
.nn-rdv-tap{display:block;margin-top:3px;color:#65e9ff;font-size:6px;font-weight:900;letter-spacing:.04em}
html.nn-rdv-open body #nx-app>.nx-dock{display:none!important}
.nn-rdv-detail{position:absolute;z-index:2600;inset:4px 6px 5px;border:1px solid #2d87b1;border-radius:18px;background:linear-gradient(180deg,#061d2f,#020b14 72%);box-shadow:0 22px 70px rgba(0,0,0,.84);overflow:hidden;display:flex;flex-direction:column;color:#f6fbff}
.nn-rdv-detail[hidden]{display:none!important}.nn-rdv-head{height:48px;min-height:48px;border-bottom:1px solid rgba(64,142,179,.55);display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 13px;background:rgba(4,24,39,.95)}
.nn-rdv-head b{font-size:12px}.nn-rdv-head small{display:block;color:#76dfff;font-size:7px;margin-top:2px}.nn-rdv-close{width:34px;height:34px;border:1px solid #3b8cb4;border-radius:50%;background:#08263c;color:#fff;font-size:21px;line-height:1}
.nn-rdv-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:9px 10px 14px}.nn-rdv-hero{position:relative;height:126px;border:1px solid #2d7ea6;border-radius:15px;overflow:hidden;background:radial-gradient(circle at 75% 20%,rgba(31,193,255,.22),transparent 34%),linear-gradient(145deg,#0a3b58,#041825)}
.nn-rdv-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}.nn-rdv-hero[data-ready="true"] img{display:block}.nn-rdv-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,10,17,.02),rgba(1,10,17,.78))}
.nn-rdv-hero-copy{position:absolute;z-index:3;left:12px;right:12px;bottom:10px}.nn-rdv-hero-copy h3{margin:0;font-size:19px;line-height:1.05}.nn-rdv-hero-copy p{margin:5px 0 0;color:#c0e1ef;font-size:8px}.nn-rdv-photo-source{position:absolute;z-index:4;right:8px;top:8px;padding:3px 5px;border-radius:999px;background:rgba(1,16,26,.82);border:1px solid rgba(104,229,255,.5);font-size:6px;font-weight:900;color:#bdf7ff}
.nn-rdv-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.nn-rdv-fact{min-height:50px;border:1px solid #235f82;border-radius:12px;background:#041522;padding:7px 8px}.nn-rdv-fact span{display:block;color:#81bbd3;font-size:7px}.nn-rdv-fact b{display:block;margin-top:4px;font-size:10px;line-height:1.25}
.nn-rdv-section{margin-top:9px;border:1px solid #246787;border-radius:14px;background:#031522;overflow:hidden}.nn-rdv-section-title{padding:8px 10px;border-bottom:1px solid rgba(53,125,157,.5);font-size:9px;font-weight:900;color:#d7f5ff}.nn-rdv-section-body{padding:8px 9px;color:#b7d8e7;font-size:8px;line-height:1.45}
.nn-rdv-map{position:relative;height:210px;min-height:190px;background:#061827;overflow:hidden;touch-action:auto}.nn-rdv-map iframe{position:absolute;inset:0;width:100%;height:100%;border:0;filter:saturate(.82) brightness(.88)}.nn-rdv-map svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 0 5px rgba(64,225,255,.85))}
.nn-rdv-map::before{content:'LOADING LIVE MAP…';position:absolute;z-index:0;inset:0;display:grid;place-items:center;color:#79dffc;font-size:8px}.nn-rdv-map[data-map-state="ready"]::before{display:none}.nn-rdv-map[data-map-state="error"]::before{content:'MAP TILES UNAVAILABLE — USE OPEN MAP BELOW';padding:18px;text-align:center;color:#ffcf72}
.nn-rdv-map-note{padding:6px 9px;color:#8dbbd0;font-size:7px;background:#02111c;border-top:1px solid rgba(53,125,157,.45)}.nn-rdv-map-loading{height:150px;display:grid;place-items:center;text-align:center;padding:14px;color:#79dffc;font-size:8px;background:radial-gradient(circle,rgba(28,152,210,.17),transparent 55%)}
.nn-rdv-segment{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(48,112,143,.35)}.nn-rdv-segment:last-child{border-bottom:0}.nn-rdv-segment strong{font-size:9px}.nn-rdv-segment span{font-size:7px;color:#9ecbde}.nn-rdv-open-map{display:inline-flex;margin-top:7px;align-items:center;justify-content:center;min-height:32px;padding:0 10px;border:1px solid #44c8ef;border-radius:10px;background:#073552;color:#d9f8ff;text-decoration:none;font-size:8px;font-weight:900}
@media(max-width:380px){.nn-travel-v19 .nn-result.nn-rdv-ready{grid-template-columns:56px minmax(0,1fr) auto!important}.nn-rdv-thumb{width:54px;height:48px}.nn-rdv-grid{gap:5px}.nn-rdv-map{height:190px}}
`;
  document.head.appendChild(style);
}

function directImage(offer){
  const keys=['thumbnailUrl','thumbnail','imageUrl','image','photoUrl','photo','pictureUrl','picture','logoUrl','logo'];
  const objects=[offer,offer?.hotel,offer?.property,offer?.carrier,offer?.airline,offer?.media];
  for(const obj of objects){
    if(!obj||typeof obj!=='object') continue;
    for(const key of keys){ const url=safeHttps(obj[key]); if(url) return {url,label:'PROVIDER PHOTO'}; }
    for(const key of ['images','photos','pictures','media']){
      const list=Array.isArray(obj[key])?obj[key]:[];
      for(const item of list){ const url=safeHttps(typeof item==='string'?item:item?.url||item?.href||item?.src||item?.thumbnail); if(url) return {url,label:'PROVIDER PHOTO'}; }
    }
  }
  return null;
}

function words(value){return String(value||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>=3&&!['hotel','resort','the','and','inn','airport','international'].includes(w));}
function titleScore(title,target){const a=new Set(words(title)),b=words(target);return b.length?b.filter(w=>a.has(w)).length/b.length:0;}
async function wikiThumb(query,strictTarget=''){
  const key=`${query}|${strictTarget}`.toLowerCase(); if(wikiCache.has(key)) return wikiCache.get(key);
  const job=(async()=>{
    try{
      const url=new URL('https://en.wikipedia.org/w/api.php');
      for(const [k,v] of Object.entries({action:'query',generator:'search',gsrsearch:query,gsrlimit:'5',prop:'pageimages',pithumbsize:'520',format:'json',origin:'*'})) url.searchParams.set(k,v);
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6000);
      const r=await fetch(url.href,{signal:ctl.signal,credentials:'omit',referrerPolicy:'no-referrer'}); clearTimeout(timer); if(!r.ok) return null;
      let pages=Object.values((await r.json())?.query?.pages||{}).filter(p=>safeHttps(p?.thumbnail?.source));
      if(strictTarget) pages=pages.filter(p=>titleScore(p.title,strictTarget)>=.5);
      pages.sort((a,b)=>titleScore(b.title,strictTarget||query)-titleScore(a.title,strictTarget||query));
      const p=pages[0],image=safeHttps(p?.thumbnail?.source); return image?{url:image,label:strictTarget?'VERIFIED WEB PHOTO':'LOCATION PHOTO'}:null;
    }catch{return null;}
  })(); wikiCache.set(key,job); return job;
}

function coordinateFrom(value){
  if(!value||typeof value!=='object') return null;
  const lat=num(value.latitude??value.lat??value.geoCode?.latitude??value.coordinates?.lat??value.location?.latitude);
  const lon=num(value.longitude??value.lon??value.lng??value.geoCode?.longitude??value.coordinates?.lng??value.location?.longitude);
  return lat!==null&&lon!==null&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon,label:value.name||value.label||value.address||''}:null;
}
function findCoordinate(offer){
  for(const candidate of [offer,offer?.hotel,offer?.property,offer?.location,offer?.geoCode,offer?.coordinates]){const p=coordinateFrom(candidate);if(p)return p;} return null;
}
async function geoLookup(query){
  const key=String(query||'').trim().toLowerCase(); if(!key) return null; if(geoCache.has(key)) return geoCache.get(key);
  const job=(async()=>{
    try{
      const u=new URL('https://nominatim.openstreetmap.org/search'); u.searchParams.set('format','jsonv2');u.searchParams.set('limit','1');u.searchParams.set('q',query);
      const r=await fetch(u.href,{headers:{'Accept-Language':'en'},credentials:'omit',referrerPolicy:'no-referrer'}); if(!r.ok)return null;
      const row=(await r.json())?.[0],lat=num(row?.lat),lon=num(row?.lon); return lat!==null&&lon!==null?{lat,lon,label:row?.display_name||query}:null;
    }catch{return null;}
  })(); geoCache.set(key,job); return job;
}
function queueGeo(query){
  const run=async()=>{const wait=Math.max(0,1050-(Date.now()-lastGeoAt));if(wait)await new Promise(r=>setTimeout(r,wait));lastGeoAt=Date.now();return geoLookup(query);};
  const task=geoTail.then(run,run);geoTail=task.catch(()=>null);return task;
}

function setThumb(card,photo,fallback='LIVE'){
  if(!card?.isConnected) return;
  let thumb=card.querySelector(':scope > .nn-rdv-thumb');
  if(!thumb){thumb=document.createElement('div');thumb.className='nn-rdv-thumb';thumb.dataset.ready='true';thumb.innerHTML=`<span>${esc(fallback)}</span><img alt="" loading="lazy" referrerpolicy="no-referrer"><small>LIVE</small>`;card.prepend(thumb);}
  const img=thumb.querySelector('img'),tag=thumb.querySelector('small');
  if(photo?.url&&img){img.onload=()=>{thumb.dataset.ready='true';if(tag)tag.textContent=photo.label||'PHOTO';};img.onerror=()=>{thumb.dataset.ready='true';if(tag)tag.textContent='LIVE';};img.src=photo.url;}
}
function addTap(card,text){
  if(card.querySelector('.nn-rdv-tap')) return;
  const target=card.querySelector('.nn-meta')?.parentElement || [...card.children].find(el=>!el.classList.contains('nn-logo')&&!el.classList.contains('nn-price')&&!el.classList.contains('nn-rdv-thumb'));
  if(target){const tap=document.createElement('span');tap.className='nn-rdv-tap';tap.textContent=text;target.appendChild(tap);}
}
function sortFlights(root,offers){
  const rows=[...(offers||[])],mode=root.dataset.flightSort||'best';
  if(mode==='direct')return rows.filter(o=>Number(o.stops||0)===0);
  if(mode==='cheapest')return rows.sort((a,b)=>Number(a.compareTotal??a.total??1e15)-Number(b.compareTotal??b.total??1e15));
  if(mode==='fastest')return rows.sort((a,b)=>Number(a.durationMinutes||1e15)-Number(b.durationMinutes||1e15));
  return rows;
}
async function resolveFlightPhoto(offer){return directImage(offer)||wikiThumb(`${offer?.destinationCode||offer?.destinationLabel||''} airport`);}
async function resolveHotelPhoto(offer,name,area){return directImage(offer)||await wikiThumb(name,name)||wikiThumb(`${area} landmark`);}

function hotelKey(root){const q=s=>root.querySelector(s)?.value||'';return [q('[data-hotel-destination]'),q('[data-hotel-checkin]'),q('[data-hotel-checkout]'),q('[data-hotel-adults]'),q('[data-hotel-rooms]')].join('|');}
async function hydrateHotels(root){
  const key=hotelKey(root); if(!key)return[]; if(root.__nnRdvHotelKey===key)return root.__nnRdvHotelOffers||[]; if(root.__nnRdvHotelPending?.key===key)return root.__nnRdvHotelPending.promise;
  const q=s=>root.querySelector(s)?.value||''; const payload={destination:q('[data-hotel-destination]').trim(),checkIn:q('[data-hotel-checkin]'),checkOut:q('[data-hotel-checkout]'),adults:Number(q('[data-hotel-adults]'))||1,rooms:Number(q('[data-hotel-rooms]'))||1,currency:'PKR'};
  if(!payload.destination||!payload.checkIn||!payload.checkOut)return[];
  const promise=travelCall('searchWorldwideHotels',payload).then(data=>{const offers=data?.ok===true&&Array.isArray(data.offers)?data.offers.filter(o=>o?.live===true):[];root.__nnRdvHotelKey=key;root.__nnRdvHotelOffers=offers;return offers;}).catch(()=>[]).finally(()=>{if(root.__nnRdvHotelPending?.key===key)root.__nnRdvHotelPending=null;});
  root.__nnRdvHotelPending={key,promise};return promise;
}
function hotelName(card){return card.querySelector('strong')?.textContent?.trim()||'';}
function hotelAddress(offer){const a=offer?.address||offer?.hotel?.address||offer?.property?.address;if(typeof a==='string')return a;if(Array.isArray(a))return a.filter(Boolean).join(', ');if(a&&typeof a==='object'){const lines=a.lines||a.addressLines||a.line;return [...(Array.isArray(lines)?lines:[lines]),a.cityName,a.city,a.stateCode,a.postalCode,a.countryCode].filter(Boolean).join(', ');}return Array.isArray(offer?.addressLines)?offer.addressLines.filter(Boolean).join(', '):'';}

async function decorateFlights(root){
  const box=root.querySelector('[data-flight-results]'); if(!box)return; const offers=sortFlights(root,root.__flightOffers||[]);
  [...box.querySelectorAll('article.nn-result')].forEach((card,index)=>{
    if(card.dataset.rdvReady==='true')return; card.dataset.rdvReady='true';card.classList.add('nn-rdv-ready');card.dataset.rdvType = 'flight';card.dataset.rdvIndex=String(index);card.tabIndex=0;card.__nnRdvOffer=offers[index];addTap(card,'TAP FOR FULL ROUTE + MAP');
    setThumb(card,null,'FLT'); resolveFlightPhoto(offers[index]).then(photo=>setThumb(card,photo,'FLT'));
  });
}
async function decorateHotels(root){
  const box=root.querySelector('[data-hotel-results]'); if(!box)return; const cards=[...box.querySelectorAll('article.nn-result')].filter(c=>c.dataset.rdvReady!=='true'); if(!cards.length)return;
  const offers=await hydrateHotels(root); if(!root.isConnected)return;
  cards.forEach((card,index)=>{if(card.dataset.rdvReady==='true')return; const name=hotelName(card);const offer=offers.find(o=>String(o?.name||o?.hotelName||'').trim().toLowerCase()===name.toLowerCase())||offers[index];card.dataset.rdvReady='true';card.classList.add('nn-rdv-ready');card.dataset.rdvType='hotel';card.dataset.rdvIndex=String(index);card.tabIndex=0;card.__nnRdvOffer=offer;addTap(card,'TAP FOR HOTEL DETAILS + MAP');setThumb(card,null,'HOTEL');resolveHotelPhoto(offer,name,root.querySelector('[data-hotel-destination]')?.value||'').then(photo=>setThumb(card,photo,'HOTEL'));});
}

function ensureDetail(root){
  let detail=root.querySelector(':scope > .nn-rdv-detail'); if(detail)return detail;
  detail=document.createElement('section');detail.className='nn-rdv-detail';detail.hidden=true;detail.innerHTML='<header class="nn-rdv-head"><div><b data-rdv-head>Details</b><small>Live result • verified map where available</small></div><button type="button" class="nn-rdv-close" aria-label="Close details">×</button></header><div class="nn-rdv-scroll" data-rdv-content></div>';root.appendChild(detail);detail.querySelector('.nn-rdv-close').addEventListener('click',()=>closeDetail(root));return detail;
}
function heroPhoto(hero,photo){const img=hero?.querySelector('img');if(photo?.url&&img){img.onload=()=>hero.dataset.ready='true';img.src=photo.url;}}
function segmentsFrom(offer){return Array.isArray(offer?.segments)&&offer.segments.length?offer.segments:[];}
function segmentHtml(offer){const segs=segmentsFrom(offer);if(!segs.length)return '<div class="nn-rdv-section-body">Segment-level data was not supplied by this live provider.</div>';return `<div class="nn-rdv-section-body">${segs.map(s=>`<div class="nn-rdv-segment"><strong>${esc(s.originCode||s.from||'—')} → ${esc(s.destinationCode||s.to||'—')}</strong><span>${esc(s.carrierName||s.carrier||'Live segment')}</span><span>${esc(clock(s.departingAt||s.departureTime))}</span></div>`).join('')}</div>`;}
function bounds(a,b){const minLat=Math.min(a.lat,b.lat),maxLat=Math.max(a.lat,b.lat),minLon=Math.min(a.lon,b.lon),maxLon=Math.max(a.lon,b.lon),latPad=Math.max(1,(maxLat-minLat)*.18),lonPad=Math.max(1,(maxLon-minLon)*.18);return {minLat:minLat-latPad,maxLat:maxLat+latPad,minLon:minLon-lonPad,maxLon:maxLon+lonPad};}
function armMapFrame(host){
  const frame=host?.querySelector('iframe[data-rdv-map-frame]');if(!frame)return;
  host.dataset.mapState='loading';let settled=false,retried=false;
  let timer=0;const finish=state=>{if(settled||!host.isConnected)return;settled=true;host.dataset.mapState=state;clearTimeout(timer)};
  const onLoad=()=>{try{if(frame.getBoundingClientRect().height<1)throw new Error('hidden map');finish('ready')}catch{finish('error')}};
  frame.addEventListener('load',onLoad,{once:true});frame.addEventListener('error',()=>finish('error'),{once:true});
  const watchdog=()=>{timer=setTimeout(()=>{if(settled||!frame.isConnected)return;if(!retried){retried=true;frame.src=frame.src;watchdog();return;}finish('error')},9000)};watchdog();
  requestAnimationFrame(()=>{if(!frame.isConnected)return;const rect=host.getBoundingClientRect();if(rect.width>0&&rect.height>0)frame.style.visibility='visible'});
}
function routeMapHtml(a,b){
  if(!a||!b)return '<div class="nn-rdv-map-loading">Real airport coordinates could not be resolved. No fake route is shown.</div>';
  const x=bounds(a,b),src=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${x.minLon},${x.minLat},${x.maxLon},${x.maxLat}`)}&layer=mapnik`;
  const open=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${x.minLon},${x.minLat},${x.maxLon},${x.maxLat}`)}&layer=mapnik`;
  return `<div class="nn-rdv-map" data-map-state="loading"><iframe data-rdv-map-frame title="Flight route map" loading="eager" referrerpolicy="no-referrer" src="${esc(src)}"></iframe><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M12 68 Q50 18 88 32" fill="none" stroke="#68eaff" stroke-width="1.6" stroke-dasharray="3 2"/><circle cx="12" cy="68" r="2.2" fill="#fff"/><circle cx="88" cy="32" r="2.2" fill="#fff"/></svg></div><div class="nn-rdv-map-note">${esc(a.label||'Origin')} → ${esc(b.label||'Destination')}<br><a class="nn-rdv-open-map" href="${esc(open)}" target="_blank" rel="noopener noreferrer">OPEN ROUTE MAP</a></div>`;
}
function hotelMapHtml(point){
  if(!point)return '<div class="nn-rdv-map-loading">Verified hotel location could not be resolved. No fake pin is shown.</div>';
  const pad=.012,src=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${point.lon-pad},${point.lat-pad},${point.lon+pad},${point.lat+pad}`)}&layer=mapnik&marker=${encodeURIComponent(`${point.lat},${point.lon}`)}`;
  const open=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(point.lat)}&mlon=${encodeURIComponent(point.lon)}#map=16/${encodeURIComponent(point.lat)}/${encodeURIComponent(point.lon)}`;
  return `<div class="nn-rdv-map" data-map-state="loading"><iframe data-rdv-map-frame title="Hotel location map" loading="eager" referrerpolicy="no-referrer" src="${esc(src)}"></iframe></div><div class="nn-rdv-map-note">${esc(point.label||'Verified map location')}<br><a class="nn-rdv-open-map" href="${esc(open)}" target="_blank" rel="noopener noreferrer">OPEN LOCATION MAP</a></div>`;
}
function closeDetail(root){const d=root.querySelector(':scope > .nn-rdv-detail');if(d)d.hidden=true;document.documentElement.classList.remove('nn-rdv-open');}

async function openFlight(root,card){
  const detail=ensureDetail(root),content=detail.querySelector('[data-rdv-content]');let offer=card.__nnRdvOffer||sortFlights(root,root.__flightOffers||[])[Number(card.dataset.rdvIndex)||0]||{};
  const origin=offer.originCode||root.querySelector('[data-flight-origin]')?.value||'',destination=offer.destinationCode||root.querySelector('[data-flight-destination]')?.value||'',carrier=(offer.carriers||[])[0]||offer.provider||'Live provider',stops=Number(offer.stops||0),photo=await resolveFlightPhoto(offer);
  detail.querySelector('[data-rdv-head]').textContent='Full Flight Details';content.innerHTML=`<div class="nn-rdv-hero" data-rdv-hero><img alt="" referrerpolicy="no-referrer"><span class="nn-rdv-photo-source">${esc(photo?.label||'LIVE RESULT')}</span><div class="nn-rdv-hero-copy"><h3>${esc(origin)} → ${esc(destination)}</h3><p>${esc(carrier)} • ${stops?`${stops} stop${stops>1?'s':''}`:'Non-stop'}</p></div></div><div class="nn-rdv-grid"><div class="nn-rdv-fact"><span>Departure</span><b>${esc(clock(offer.departingAt))}</b></div><div class="nn-rdv-fact"><span>Arrival</span><b>${esc(clock(offer.arrivingAt))}</b></div><div class="nn-rdv-fact"><span>Duration</span><b>${esc(duration(offer.durationMinutes))}</b></div><div class="nn-rdv-fact"><span>Live fare</span><b>${esc(money(offer.compareTotal??offer.total,offer.compareCurrency||offer.currency||'PKR'))}</b></div><div class="nn-rdv-fact"><span>Carrier</span><b>${esc(carrier)}</b></div><div class="nn-rdv-fact"><span>Provider</span><b>${esc(offer.provider||'Live provider')}</b></div></div><section class="nn-rdv-section"><div class="nn-rdv-section-title">FLIGHT SEGMENTS</div>${segmentHtml(offer)}</section><section class="nn-rdv-section"><div class="nn-rdv-section-title">FULL ROUTE MAP</div><div data-rdv-map><div class="nn-rdv-map-loading">Resolving real airport locations…</div></div></section>`;
  heroPhoto(content.querySelector('[data-rdv-hero]'),photo);detail.hidden=false;document.documentElement.classList.add('nn-rdv-open');
  const a=coordinateFrom(offer.origin||offer.departure||offer.originLocation)||await queueGeo(`${origin} airport`),b=coordinateFrom(offer.destination||offer.arrival||offer.destinationLocation)||await queueGeo(`${destination} airport`),map=content.querySelector('[data-rdv-map]');if(map&&!detail.hidden){map.innerHTML=routeMapHtml(a,b);armMapFrame(map.querySelector('.nn-rdv-map'))}
}
async function openHotel(root,card){
  let offer=card.__nnRdvOffer;if(!offer){const offers=await hydrateHotels(root);offer=offers[Number(card.dataset.rdvIndex)||0]||{};} const detail=ensureDetail(root),content=detail.querySelector('[data-rdv-content]'),name=offer.name||offer.hotelName||hotelName(card)||'Live hotel',city=offer.cityName||offer.cityCode||'',country=offer.countryName||offer.countryCode||'',address=hotelAddress(offer),rating=offer.rating||offer.stars||offer.hotel?.rating||'',photo=await resolveHotelPhoto(offer,name,[city,country].filter(Boolean).join(' '));
  const displayedPrice=card.querySelector('.nn-price strong')?.textContent?.trim()||'Provider value unavailable'; const livePrice=num(offer.compareTotal??offer.stayTotal??offer.total)!==null?money(offer.compareTotal??offer.stayTotal??offer.total,offer.compareCurrency||offer.currency||'PKR'):displayedPrice;
  detail.querySelector('[data-rdv-head]').textContent='Full Hotel Details';content.innerHTML=`<div class="nn-rdv-hero" data-rdv-hero><img alt="" referrerpolicy="no-referrer"><span class="nn-rdv-photo-source">${esc(photo?.label||'LIVE RESULT')}</span><div class="nn-rdv-hero-copy"><h3>${esc(name)}</h3><p>${esc([city,country].filter(Boolean).join(' • ')||'Live hotel result')}</p></div></div><div class="nn-rdv-grid"><div class="nn-rdv-fact"><span>Stay</span><b>${esc(offer.nights?`${offer.nights} night${Number(offer.nights)===1?'':'s'}`:'Live stay')}</b></div><div class="nn-rdv-fact"><span>Live price</span><b>${esc(livePrice)}</b></div><div class="nn-rdv-fact"><span>Rating</span><b>${rating?`${esc(rating)} ★`:'Provider not supplied'}</b></div><div class="nn-rdv-fact"><span>Provider</span><b>${esc(offer.provider||'Live provider')}</b></div></div><section class="nn-rdv-section"><div class="nn-rdv-section-title">HOTEL LOCATION</div><div class="nn-rdv-section-body">${address?esc(address):'Resolving available real location from the live hotel name and destination. No fake address is shown.'}</div><div data-rdv-map><div class="nn-rdv-map-loading">Resolving real hotel location…</div></div></section>`;
  heroPhoto(content.querySelector('[data-rdv-hero]'),photo);detail.hidden=false;document.documentElement.classList.add('nn-rdv-open');const point=findCoordinate(offer)||await queueGeo([name,address,city,country].filter(Boolean).join(', ')),map=content.querySelector('[data-rdv-map]');if(map&&!detail.hidden){map.innerHTML=hotelMapHtml(point);armMapFrame(map.querySelector('.nn-rdv-map'))}
}

function onActivate(root,event){
  const mapLink=event.target?.closest?.('a.nn-rdv-open-map');
  if(mapLink&&root.contains(mapLink)&&event.type==='click'){
    event.preventDefault();const url=safeHttps(mapLink.href);if(!url)return;
    if(typeof window.nexusPostNativeAction==='function'&&window.nexusPostNativeAction('openExternal',{url}))return;
    window.location.href=url;return;
  }
  const card=event.target?.closest?.('article.nn-result.nn-rdv-ready');if(!card||!root.contains(card))return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;if(event.type==='keydown')event.preventDefault();if(event.type==='click'&&event.target.closest('a,button,input,select,textarea'))return;const type=card.dataset.rdvType;if(type==='flight')openFlight(root,card);if(type==='hotel')openHotel(root,card);
}
function scheduleDecorate(root){
  if(root.__nnRdvTimer)return;root.__nnRdvTimer=setTimeout(()=>{root.__nnRdvTimer=0;if(!root.isConnected)return;decorateFlights(root);decorateHotels(root);},120);
}
function bind(root){
  if(!(root instanceof HTMLElement)||root.dataset.rdvBound==='true')return;root.dataset.rdvBound='true';
  const click=e=>onActivate(root,e),key=e=>onActivate(root,e);root.addEventListener('click',click);root.addEventListener('keydown',key);
  const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'&&m.addedNodes.length))scheduleDecorate(root);});
  for(const box of [root.querySelector('[data-flight-results]'),root.querySelector('[data-hotel-results]')]) if(box)observer.observe(box,{childList:true,subtree:false});
  const previousCleanup=root.__cleanup;root.__cleanup=()=>{observer.disconnect();clearTimeout(root.__nnRdvTimer);root.removeEventListener('click',click);root.removeEventListener('keydown',key);document.documentElement.classList.remove('nn-rdv-open');previousCleanup?.();};
  scheduleDecorate(root);
}
function scan(){document.querySelectorAll(ROOT_SELECTOR).forEach(bind);if(!document.querySelector(ROOT_SELECTOR))document.documentElement.classList.remove('nn-rdv-open');}

installStyle();scan();new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
