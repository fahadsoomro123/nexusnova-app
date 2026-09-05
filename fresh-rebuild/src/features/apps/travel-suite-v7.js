import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { renderTravelSuite as renderTravelSuiteV6 } from './travel-suite-v6.js';

const functions = getFunctions(firebaseApp, 'us-central1');
const LIVE_TIMEOUT_MS = 16000;
const timeout = (promise, ms = LIVE_TIMEOUT_MS) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Secure travel API timed out.')), ms))
]);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const errorText = error => String(error?.message || error || 'Live provider unavailable.').replace(/^FirebaseError:\s*/i,'').replace(/^functions\/[a-z-]+:\s*/i,'').slice(0,150);
function money(value, currency='PKR') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try { return new Intl.NumberFormat('en-PK',{style:'currency',currency,maximumFractionDigits:currency==='JPY'?0:2}).format(amount); }
  catch { return `${Math.round(amount).toLocaleString()} ${currency}`; }
}
function durationText(minutes) {
  const n = Math.max(0, Math.round(Number(minutes)||0));
  if (!n) return '—';
  const h = Math.floor(n/60), m = n%60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function timeText(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function setDot(root,key,state,title='') {
  const dot=root.querySelector(`[data-api-dot="${key}"]`);
  if (!dot) return;
  dot.dataset.state=state;
  if (title) dot.title=title;
}

function paintHotelLive(root, offers) {
  const box=root.querySelector('[data-hotel-results]');
  if (!box) return;
  const list=[...offers].sort((a,b)=>(Number(a.compareTotal ?? a.stayTotal)||1e15)-(Number(b.compareTotal ?? b.stayTotal)||1e15));
  box.innerHTML=list.length?list.map(item=>`<article class="nn-result-card live"><div class="nn-rhead"><div><strong>${esc(item.name||'Hotel')}</strong><p class="nn-meta">${esc(item.cityCode||'')} ${item.countryCode?`• ${esc(item.countryCode)}`:''}</p></div><span class="nn-chip live">LIVE API</span></div><div class="nn-stats"><div><span>Stay total</span><strong>${esc(money(item.compareTotal ?? item.stayTotal,item.compareCurrency||item.currency||'PKR'))}</strong></div><div><span>Per night</span><strong>${esc(money(item.comparePerNight ?? item.pricePerNight,item.compareCurrency||item.currency||'PKR'))}</strong></div><div><span>Stay</span><strong>${Number(item.nights)||0} nights</strong></div></div><p class="nn-meta">${esc(item.roomDescription||'Live room inventory')}${item.cancellation?` • ${esc(item.cancellation)}`:''}</p></article>`).join(''):'<div class="nn-empty">No live hotel availability returned for this search. Try nearby dates or another destination.</div>';
}

async function searchHotelsLive(root) {
  const destination=root.querySelector('[data-hotel-destination]')?.value.trim();
  const checkIn=root.querySelector('[data-hotel-checkin]')?.value;
  const checkOut=root.querySelector('[data-hotel-checkout]')?.value;
  const adults=Number(root.querySelector('[data-hotel-adults]')?.value)||1;
  const rooms=Number(root.querySelector('[data-hotel-rooms]')?.value)||1;
  const currency=root.querySelector('[data-hotel-currency]')?.value||'PKR';
  const status=root.querySelector('[data-hotel-status]');
  const button=root.querySelector('[data-hotel-search]');
  if (!destination || !checkIn || !checkOut) { status.textContent='Enter destination, check-in and check-out.'; return; }
  if (checkOut <= checkIn) { status.textContent='Check-out must be after check-in.'; return; }
  button.disabled=true; button.textContent='SEARCHING LIVE…'; status.textContent='Checking live hotel inventory…';
  paintHotelLive(root,[]);
  try {
    await timeout(requireFirebaseUser(),5000);
    const response=await timeout(httpsCallable(functions,'searchWorldwideHotels')({destination,checkIn,checkOut,adults,rooms,currency}));
    const data=response?.data||{};
    const offers=data.ok===true&&Array.isArray(data.offers)?data.offers.filter(item=>item?.live===true):[];
    paintHotelLive(root,offers);
    if (offers.length) { status.textContent=`${offers.length} genuine live hotel offer${offers.length===1?'':'s'} loaded.`; setDot(root,'hotels','live','Live hotel API returned inventory'); }
    else { status.textContent=data.message||'Live hotel provider returned no availability for these dates.'; setDot(root,'hotels','standby','Live provider returned no inventory'); }
  } catch(error) {
    paintHotelLive(root,[]);
    status.textContent=`Live hotel search failed • ${errorText(error)}`;
    setDot(root,'hotels','standby','Live hotel API unavailable');
  } finally { button.disabled=false; button.textContent='SEARCH HOTELS'; }
}

function paintGroundLive(root, offers) {
  const box=root.querySelector('[data-ground-results]');
  if (!box) return;
  const list=[...offers].sort((a,b)=>(Number(a.total)||1e15)-(Number(b.total)||1e15));
  box.innerHTML=list.length?list.map(item=>`<article class="nn-result-card live"><div class="nn-rhead"><div><strong>${esc(item.mode||'Ground transport')}</strong><p class="nn-meta">${esc((item.carrierNames||[]).join(' + ')||item.provider||'Live provider')} • ${esc(item.originLabel||'')} → ${esc(item.destinationLabel||'')}</p></div><span class="nn-chip live">LIVE API</span></div><div class="nn-stats"><div><span>Fare</span><strong>${esc(money(item.total,item.currency||'PKR'))}</strong></div><div><span>Depart</span><strong>${esc(timeText(item.departingAt))}</strong></div><div><span>Duration</span><strong>${esc(durationText(item.durationMinutes))}</strong></div></div><p class="nn-meta">${item.seatsLeft!=null?`${esc(item.seatsLeft)} seats left • `:''}${item.electronicTicket?'E-ticket available • ':''}live provider inventory.</p></article>`).join(''):'<div class="nn-empty">No live rail/bus inventory returned for this search. Try another time, date or nearby city.</div>';
}

async function searchGroundLive(root) {
  const origin=root.querySelector('[data-ground-origin]')?.value.trim();
  const destination=root.querySelector('[data-ground-destination]')?.value.trim();
  const departureDate=root.querySelector('[data-ground-date]')?.value;
  const departureTime=root.querySelector('[data-ground-time]')?.value||'08:00';
  const adults=Number(root.querySelector('[data-ground-adults]')?.value)||1;
  const currency=root.querySelector('[data-ground-currency]')?.value||'PKR';
  const status=root.querySelector('[data-ground-status]');
  const button=root.querySelector('[data-ground-search]');
  if (!origin || !destination || !departureDate) { status.textContent='Enter origin, destination and date.'; return; }
  if (origin.toLowerCase()===destination.toLowerCase()) { status.textContent='Origin and destination must be different.'; return; }
  button.disabled=true; button.textContent='SEARCHING LIVE…'; status.textContent='Checking live rail and bus inventory…';
  paintGroundLive(root,[]);
  try {
    await timeout(requireFirebaseUser(),5000);
    const response=await timeout(httpsCallable(functions,'searchWorldwideGroundTransport')({origin,destination,departureDate,departureTime,adults,currency}));
    const data=response?.data||{};
    const offers=data.ok===true&&Array.isArray(data.offers)?data.offers.filter(item=>item?.live===true):[];
    paintGroundLive(root,offers);
    if (offers.length) { status.textContent=`${offers.length} genuine live rail/bus option${offers.length===1?'':'s'} loaded.`; setDot(root,'ground','live','Live rail/bus API returned inventory'); }
    else { status.textContent=data.message||'Live rail/bus provider returned no inventory for this search.'; setDot(root,'ground','standby','Live provider returned no inventory'); }
  } catch(error) {
    paintGroundLive(root,[]);
    status.textContent=`Live rail/bus search failed • ${errorText(error)}`;
    setDot(root,'ground','standby','Live ground API unavailable');
  } finally { button.disabled=false; button.textContent='SEARCH RAIL / BUS'; }
}

function installPakistanTourAction(root) {
  const plan=root.querySelector('[data-panel="plan"]');
  const grid=plan?.querySelector('.nn-grid');
  if (!plan || !grid || grid.querySelector('[data-pakistan-tours]')) return;
  const button=document.createElement('button');
  button.type='button';
  button.className='nn-action span2 nn-pakistan-tour-action';
  button.dataset.pakistanTours='';
  button.textContent='COMPARE PAKISTAN TOUR PACKAGES';
  grid.appendChild(button);
  plan.style.gridTemplateRows='430px minmax(0,1fr)';
  const card=plan.querySelector('.nn-card');
  if (card) { card.style.height='430px'; card.style.minHeight='430px'; }
}

function paintPakistanTours(root, packages) {
  const box=root.querySelector('[data-trip-results]');
  if (!box) return;
  const list=[...packages].sort((a,b)=>(Number(a.price)||1e15)-(Number(b.price)||1e15));
  box.innerHTML=list.length?`<div class="nn-pak-head"><strong>Pakistan Agency Package Compare</strong><span>${list.length} live package${list.length===1?'':'s'}</span></div>${list.map(item=>`<article class="nn-result-card live"><div class="nn-rhead"><div><strong>${esc(item.title||'Tour package')}</strong><p class="nn-meta">${esc(item.provider||'Pakistan travel agency')} ${item.fromCity?`• ${esc(item.fromCity)}`:''}${item.toCity?` → ${esc(item.toCity)}`:''}</p></div><span class="nn-chip live">LIVE API</span></div><div class="nn-stats"><div><span>Price</span><strong>${esc(money(item.price,item.currency||'PKR'))}</strong></div><div><span>Duration</span><strong>${item.durationDays?`${esc(item.durationDays)} days`:'—'}</strong></div><div><span>Seats</span><strong>${item.seatsAvailable!=null?esc(item.seatsAvailable):'—'}</strong></div></div><p class="nn-meta">${item.airline?`${esc(item.airline)} • `:''}${Array.isArray(item.inclusions)&&item.inclusions.length?esc(item.inclusions.slice(0,4).join(' • ')):'Live agency package inventory'}</p></article>`).join('')}`:'<div class="nn-empty">No live Pakistan tour packages are available right now. No scraped or invented package price is shown.</div>';
}

async function searchPakistanTours(root) {
  const status=root.querySelector('[data-trip-status]');
  const button=root.querySelector('[data-pakistan-tours]');
  if (!button) return;
  button.disabled=true; button.textContent='CHECKING PAKISTAN AGENCIES…'; status.textContent='Loading genuine Pakistan agency package inventory…';
  try {
    await timeout(requireFirebaseUser(),5000);
    const response=await timeout(httpsCallable(functions,'searchPakistanUmrahPackages')({}));
    const data=response?.data||{};
    const packages=data.ok===true&&Array.isArray(data.packages)?data.packages.filter(item=>item?.live===true):[];
    paintPakistanTours(root,packages);
    status.textContent=packages.length?`${packages.length} genuine Pakistan agency package${packages.length===1?'':'s'} loaded and sorted by price.`:(data.reason||'No live Pakistan agency packages returned.');
  } catch(error) {
    paintPakistanTours(root,[]);
    status.textContent=`Pakistan agency package search failed • ${errorText(error)}`;
  } finally { button.disabled=false; button.textContent='COMPARE PAKISTAN TOUR PACKAGES'; }
}

function installLiveOnlyInterceptors(root) {
  root.addEventListener('click', event => {
    const hotel=event.target.closest('[data-hotel-search]');
    if (hotel) { event.preventDefault(); event.stopImmediatePropagation(); searchHotelsLive(root); return; }
    const ground=event.target.closest('[data-ground-search]');
    if (ground) { event.preventDefault(); event.stopImmediatePropagation(); searchGroundLive(root); return; }
    const tours=event.target.closest('[data-pakistan-tours]');
    if (tours) { event.preventDefault(); event.stopImmediatePropagation(); searchPakistanTours(root); }
  }, true);
}

function ensureV7Styles() {
  if (document.getElementById('nn-travel-live-only-v7')) return;
  const style=document.createElement('style');
  style.id='nn-travel-live-only-v7';
  style.textContent=`
    .nn-travel-v7 .nn-pakistan-tour-action{background:linear-gradient(100deg,#18c89e,#087ed8)!important;border-color:#56edc7!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 18px rgba(27,205,162,.18)!important}
    .nn-travel-v7 .nn-pak-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 2px 8px;padding:8px 10px;border-radius:12px;border:1px solid rgba(72,226,176,.22);background:rgba(7,54,48,.45);font-size:12px;color:#bff5e5}
    .nn-travel-v7 .nn-pak-head strong{font-size:13px;color:#eafff8}
  `;
  document.head.appendChild(style);
}

export function renderTravelSuite() {
  ensureV7Styles();
  const root=renderTravelSuiteV6();
  root.classList.add('nn-travel-v7');
  root.dataset.liveOnly='true';
  installPakistanTourAction(root);
  installLiveOnlyInterceptors(root);
  return root;
}

export const travelSuiteRenderers=Object.freeze({travel:renderTravelSuite});
