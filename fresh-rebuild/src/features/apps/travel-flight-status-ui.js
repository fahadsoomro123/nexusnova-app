const API_BASE=String(globalThis.NexusNovaTravelConfig?.apiBase||'/api/travel').replace(/\/$/,'');

const text=value=>String(value??'').trim();
const esc=value=>text(value).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

async function checkStatus(root){
  const number=text(root.querySelector('[data-flight]')?.value).replace(/\s+/g,'').toUpperCase();
  const airline=text(root.querySelector('[data-flight-airline]')?.value).replace(/\s+/g,'').toUpperCase();
  const date=text(root.querySelector('[data-flight-date]')?.value).replace(/-/g,'');
  const out=root.querySelector('[data-live]');
  if(!out)return;
  if(!/^[A-Z0-9-]{2,10}$/.test(number)||!/^[A-Z]{2,3}$/.test(airline)||!/^[0-9]{8}$/.test(date)){
    out.textContent='Enter flight number, airline code and travel date.';
    return;
  }
  out.textContent='Checking configured provider…';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const qs=new URLSearchParams({flight:number,airline,date});
    const response=await fetch(`${API_BASE}/flights/track?${qs.toString()}`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.message||'Live tracking unavailable.');
    const row=Array.isArray(payload?.results)?payload.results[0]:null;
    if(!row){out.textContent='Provider returned no matching live status. No status is being guessed.';return;}
    out.innerHTML=`<b>${esc(row.airline||airline)} ${esc(row.flightNumber||number)}</b> · ${esc(row.status||'UNKNOWN')} · ${esc(row.departure||'Departure unavailable')} → ${esc(row.arrival||'Arrival unavailable')}<br><small>Source: FlightAPI · live provider response</small>`;
  }catch(error){
    out.textContent=error?.name==='AbortError'?'Tracking request timed out.':'Live tracking unavailable or not configured. No status is being guessed.';
  }finally{clearTimeout(timer)}
}

function mount(root){
  const live=root.querySelector('.nxf-live');
  if(!live||live.dataset.statusEnhanced==='1')return;
  live.dataset.statusEnhanced='1';
  const row=live.querySelector('.nxf-live-row');
  if(!row)return;
  const number=row.querySelector('[data-flight]');
  const button=row.querySelector('[data-track]');
  if(!number||!button)return;
  const date=document.createElement('input');
  date.type='date';
  date.dataset.flightDate='1';
  date.setAttribute('aria-label','Flight travel date');
  date.min=new Date().toISOString().slice(0,10);
  date.value=date.min;
  const airline=document.createElement('input');
  airline.type='text';
  airline.dataset.flightAirline='1';
  airline.setAttribute('aria-label','Airline code');
  airline.maxLength=3;
  airline.placeholder='PK';
  row.insertBefore(airline,button);
  row.insertBefore(date,button);
  number.setAttribute('placeholder','PK301');
  number.setAttribute('maxlength','10');
  const handler=event=>{event.preventDefault();event.stopImmediatePropagation();void checkStatus(root)};
  button.addEventListener('click',handler,true);
}

export function enhanceTravelFlightStatus(root){
  if(!root)return()=>{};
  const observer=new MutationObserver(()=>mount(root));
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  mount(root);
  return()=>observer.disconnect();
}
