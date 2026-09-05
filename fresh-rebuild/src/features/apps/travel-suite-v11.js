import { renderTravelSuite as renderTravelSuiteV10 } from './travel-suite-v10.js';
import { travelCall } from './travel-edge-client.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const errorText = error => String(error?.message || error || 'Live provider unavailable.').slice(0, 170);
function money(value, currency='PKR') { const n=Number(value); if(!Number.isFinite(n)) return '—'; try{return new Intl.NumberFormat('en-PK',{style:'currency',currency,maximumFractionDigits:currency==='JPY'?0:2}).format(n)}catch{return `${Math.round(n).toLocaleString()} ${currency}`} }
function durationText(minutes){const n=Math.max(0,Math.round(Number(minutes)||0));if(!n)return '—';const h=Math.floor(n/60),m=n%60;return h?`${h}h ${m}m`:`${m}m`}
function clock(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '—';return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}

function dedupe(list){const seen=new Set();return list.filter(item=>{const key=[item.provider,item.mode,item.originLabel,item.destinationLabel,String(item.departingAt).slice(0,16),Math.round(Number(item.total)||0),item.currency].join('|').toLowerCase();if(seen.has(key))return false;seen.add(key);return true})}

function paint(root, offers){
  const box=root.querySelector('[data-ground-results]'); if(!box)return;
  const list=dedupe([...offers]).sort((a,b)=>(Number(a.total)||1e15)-(Number(b.total)||1e15));
  box.innerHTML=list.length?list.map(item=>`<article class="nn-result-card live"><div class="nn-rhead"><div><strong>${esc(item.mode||'Ground transport')}</strong><p class="nn-meta">${esc((item.carrierNames||[]).join(' + ')||item.provider||'Live provider')} • ${esc(item.originLabel||'')} → ${esc(item.destinationLabel||'')}</p></div><span class="nn-chip live">LIVE FARE</span></div><div class="nn-stats"><div><span>Fare</span><strong>${esc(money(item.total,item.currency||'PKR'))}</strong></div><div><span>Depart</span><strong>${esc(clock(item.departingAt))}</strong></div><div><span>Duration</span><strong>${esc(durationText(item.durationMinutes))}</strong></div></div><p class="nn-meta">${item.seatsLeft!=null?`${esc(item.seatsLeft)} seats left • `:''}${item.electronicTicket?'E-ticket available • ':''}${esc(item.provider||'Live provider')} inventory.</p></article>`).join(''):'<div class="nn-empty">No genuine live rail/bus fare returned. No estimated or scraped fare is shown.</div>';
}

async function searchGround(root){
  const origin=root.querySelector('[data-ground-origin]')?.value.trim();
  const destination=root.querySelector('[data-ground-destination]')?.value.trim();
  const departureDate=root.querySelector('[data-ground-date]')?.value;
  const departureTime=root.querySelector('[data-ground-time]')?.value||'08:00';
  const adults=Number(root.querySelector('[data-ground-adults]')?.value)||1;
  const currency=root.querySelector('[data-ground-currency]')?.value||'PKR';
  const status=root.querySelector('[data-ground-status]');
  const button=root.querySelector('[data-ground-search]');
  if(!button||!status)return;
  if(!origin||!destination||!departureDate){status.textContent='Enter origin, destination and date.';return}
  if(origin.toLowerCase()===destination.toLowerCase()){status.textContent='Origin and destination must be different.';return}
  button.disabled=true; button.textContent='SEARCHING LIVE…'; status.textContent='Checking worldwide + Pakistan rail/bus providers…'; paint(root,[]);
  try{
    const payload={origin,destination,departureDate,departureTime,adults,currency};
    const settled=await Promise.allSettled([
      travelCall('searchWorldwideGroundTransport',payload),
      travelCall('searchPakistanGroundTransport',payload)
    ]);
    let offers=[]; const notes=[];
    for(const item of settled){
      if(item.status==='fulfilled'){
        const data=item.value||{};
        if(Array.isArray(data.offers))offers.push(...data.offers.filter(x=>x?.live===true));
        if(data.message)notes.push(data.message);
        if(data.reason)notes.push(data.reason);
      } else notes.push(errorText(item.reason));
    }
    offers=dedupe(offers); paint(root,offers);
    if(offers.length) status.textContent=`${offers.length} genuine live rail/bus fare${offers.length===1?'':'s'} loaded.`;
    else status.textContent=notes.filter(Boolean).join(' • ')||'No live rail/bus inventory returned for this route/date.';
  }catch(error){paint(root,[]);status.textContent=`Live rail/bus search failed • ${errorText(error)}`}
  finally{button.disabled=false;button.textContent='SEARCH RAIL / BUS'}
}

function installPakistanGroundMerge(root){
  const onWindowCapture=event=>{
    if(!root.isConnected||!root.contains(event.target))return;
    const button=event.target.closest?.('[data-ground-search]');
    if(!button)return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    searchGround(root);
  };
  window.addEventListener('click',onWindowCapture,true);
  const previousCleanup=root.__cleanup;
  root.__cleanup=()=>{window.removeEventListener('click',onWindowCapture,true);previousCleanup?.()};
}

export function renderTravelSuite(){
  const root=renderTravelSuiteV10();
  root.classList.add('nn-travel-v11-ground-merge');
  installPakistanGroundMerge(root);
  return root;
}

export const travelSuiteRenderers=Object.freeze({travel:renderTravelSuite});
