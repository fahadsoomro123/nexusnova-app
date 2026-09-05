import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

const functions = getFunctions(firebaseApp, 'us-central1');
const TRIP_KEY = 'nexusnova_trip_plan_v3';
const DAY_MS = 86_400_000;
const LIVE_TIMEOUT_MS = 12_000;
const CURRENCIES = ['PKR','USD','EUR','GBP','AED','SAR','CAD','AUD','JPY','CNY','INR','TRY'];
const SCALE = { USD:1, EUR:.92, GBP:.79, AED:3.67, SAR:3.75, PKR:279, CAD:1.36, AUD:1.52, JPY:148, CNY:7.2, INR:83, TRY:32 };

function futureDate(days = 1) { return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10); }
function timeout(promise, ms = LIVE_TIMEOUT_MS) { return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Secure travel API timed out.')), ms))]); }
function errorText(error) { return String(error?.message || error || 'Search unavailable.').replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[a-z-]+:\s*/i, '').slice(0, 150); }
function money(value, currency = 'USD') { const amount = Number(value); if (!Number.isFinite(amount)) return '—'; try { return new Intl.NumberFormat(undefined, { style:'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(amount); } catch { return `${Math.round(amount).toLocaleString()} ${currency}`; } }
function durationText(minutes) { const value = Math.max(0, Math.round(Number(minutes) || 0)); if (!value) return '—'; const h = Math.floor(value / 60), m = value % 60; return h ? `${h}h ${m}m` : `${m}m`; }
function timeText(value) { const d = new Date(value); if (!Number.isFinite(d.getTime())) return '—'; return d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }
function hashText(value) { let hash = 2166136261; for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seeded(seed, min, max) { return min + (hashText(seed) % Math.max(1, max - min + 1)); }
function scaledUsd(usd, currency) { return usd * (SCALE[currency] || 1); }
function currencyOptions() { return CURRENCIES.map(code => `<option value="${code}">${code}</option>`).join(''); }
function countOptions(max = 9, selected = 1) { return Array.from({length:max}, (_, i) => `<option value="${i+1}"${i+1===selected?' selected':''}>${i+1}</option>`).join(''); }

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nn-travel-v4';
  root.dataset.nnTravelRoot = 'v4';
  root.innerHTML = html;
  return root;
}

function ensureStyles() {
  document.getElementById('nn-travel-premium-style')?.remove();
  if (document.getElementById('nn-travel-flagship-v4-style')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-flagship-v4-style';
  style.textContent = `
    [data-nn-travel-root="v4"]{
      --nn-h:calc(100dvh - 118px); --nn-line:rgba(180,200,235,.2); --nn-glass:rgba(9,15,31,.78);
      width:100%; height:var(--nn-h); min-height:390px; max-height:none; overflow:hidden!important; margin:0!important; padding:0!important;
      display:grid; grid-template-rows:58px minmax(0,1fr); gap:8px; perspective:1200px; isolation:isolate;
    }
    [data-nn-travel-root="v4"] *{box-sizing:border-box}
    [data-nn-travel-root="v4"] .nn-dock{position:relative;z-index:3;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:7px;border:1px solid var(--nn-line);border-radius:19px;background:linear-gradient(165deg,rgba(22,31,54,.94),rgba(7,12,25,.96));box-shadow:0 16px 35px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.6);overflow:hidden}
    [data-nn-travel-root="v4"] .nn-dock:before{content:"";position:absolute;inset:-80% 25% 35% -10%;background:radial-gradient(circle,rgba(89,157,255,.2),transparent 65%);pointer-events:none}
    [data-nn-travel-root="v4"] .nn-tab{position:relative;min-width:0;height:42px;border:1px solid rgba(157,180,220,.18);border-radius:13px;background:linear-gradient(180deg,rgba(42,55,82,.62),rgba(14,22,40,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 5px 10px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;gap:5px;padding:5px;color:inherit;font-size:.69rem;font-weight:850;letter-spacing:.01em;transform:translateZ(0);transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
    [data-nn-travel-root="v4"] .nn-tab:active{transform:translateY(1px) scale(.985)}
    [data-nn-travel-root="v4"] .nn-tab.is-active{border-color:color-mix(in srgb,var(--accent) 65%,white 8%);background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 24%,rgba(25,35,60,.95)),rgba(12,19,34,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 8px 20px color-mix(in srgb,var(--accent) 20%,transparent),0 0 0 1px color-mix(in srgb,var(--accent) 12%,transparent)}
    [data-nn-travel-root="v4"] .nn-tab:nth-child(1){--accent:#62b5ff}[data-nn-travel-root="v4"] .nn-tab:nth-child(2){--accent:#f9bd62}[data-nn-travel-root="v4"] .nn-tab:nth-child(3){--accent:#5ee0bd}[data-nn-travel-root="v4"] .nn-tab:nth-child(4){--accent:#b994ff}
    [data-nn-travel-root="v4"] .nn-tab-icon{font-size:.88rem;filter:drop-shadow(0 2px 5px color-mix(in srgb,var(--accent) 55%,transparent))}
    [data-nn-travel-root="v4"] .nn-api-dot{width:6px;height:6px;border-radius:50%;background:#708098;box-shadow:0 0 0 2px rgba(112,128,152,.12)}
    [data-nn-travel-root="v4"] .nn-api-dot[data-state="live"]{background:#58e6a9;box-shadow:0 0 9px rgba(88,230,169,.75)}
    [data-nn-travel-root="v4"] .nn-api-dot[data-state="standby"]{background:#ffb45a;box-shadow:0 0 8px rgba(255,180,90,.5)}
    [data-nn-travel-root="v4"] .nn-stage{min-height:0;overflow:hidden;position:relative}
    [data-nn-travel-root="v4"] .nn-panel{--accent:#62b5ff;position:relative;height:100%;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;padding:1px;transform-style:preserve-3d}
    [data-nn-travel-root="v4"] .nn-panel[hidden]{display:none!important}
    [data-nn-travel-root="v4"] .nn-panel[data-panel="hotels"]{--accent:#f9bd62}[data-nn-travel-root="v4"] .nn-panel[data-panel="ground"]{--accent:#5ee0bd}[data-nn-travel-root="v4"] .nn-panel[data-panel="plan"]{--accent:#b994ff}
    [data-nn-travel-root="v4"] .nn-card{position:relative;margin:0!important;padding:10px!important;border:1px solid color-mix(in srgb,var(--accent) 30%,rgba(170,190,225,.15));border-radius:18px;background:radial-gradient(circle at 92% -10%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 34%),linear-gradient(150deg,rgba(25,35,58,.92),rgba(8,14,28,.93));box-shadow:0 16px 30px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.09),inset 0 -1px 0 rgba(0,0,0,.45);backdrop-filter:blur(18px);overflow:hidden}
    [data-nn-travel-root="v4"] .nn-card:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.05),transparent 28%,transparent 72%,rgba(255,255,255,.025))}
    [data-nn-travel-root="v4"] .nn-form-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    [data-nn-travel-root="v4"] .nn-form-head strong{font-size:.88rem;letter-spacing:-.015em}[data-nn-travel-root="v4"] .nn-form-head span{font-size:.58rem;padding:4px 7px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);background:color-mix(in srgb,var(--accent) 10%,rgba(8,14,28,.75));font-weight:850}
    [data-nn-travel-root="v4"] .nn-grid{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:end}
    [data-nn-travel-root="v4"] .span2{grid-column:1/-1}
    [data-nn-travel-root="v4"] .nx-field{margin:0!important;min-width:0}[data-nn-travel-root="v4"] .nx-field>span{display:block;margin:0 0 3px;font-size:.59rem;line-height:1;color:rgba(215,226,244,.73);letter-spacing:.04em;text-transform:uppercase}
    [data-nn-travel-root="v4"] input,[data-nn-travel-root="v4"] select,[data-nn-travel-root="v4"] textarea{width:100%;height:35px!important;min-height:35px!important;padding:6px 8px!important;border-radius:10px!important;border:1px solid rgba(165,185,220,.18)!important;background:linear-gradient(180deg,rgba(4,9,20,.72),rgba(14,22,38,.82))!important;box-shadow:inset 0 2px 5px rgba(0,0,0,.26),0 1px 0 rgba(255,255,255,.035)!important;font-size:.74rem!important}
    [data-nn-travel-root="v4"] textarea{height:48px!important;min-height:48px!important;resize:none}
    [data-nn-travel-root="v4"] .nn-action{height:35px!important;min-height:35px!important;padding:5px 8px!important;border-radius:10px!important;font-size:.66rem!important;font-weight:900!important;letter-spacing:.025em!important;border:1px solid color-mix(in srgb,var(--accent) 42%,rgba(255,255,255,.08))!important;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 38%,#172033),color-mix(in srgb,var(--accent) 17%,#090f1e))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 7px 14px color-mix(in srgb,var(--accent) 14%,transparent)!important}
    [data-nn-travel-root="v4"] .nn-action.secondary{background:linear-gradient(180deg,rgba(45,57,79,.62),rgba(15,23,38,.82))!important;border-color:rgba(170,190,220,.2)!important}
    [data-nn-travel-root="v4"] button:disabled{opacity:.58;cursor:wait}
    [data-nn-travel-root="v4"] .nn-status{position:relative;margin:6px 1px 0!important;min-height:14px;font-size:.61rem!important;line-height:1.25;color:rgba(205,218,239,.73)}
    [data-nn-travel-root="v4"] .nn-results{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:1px 2px 3px}
    [data-nn-travel-root="v4"] .nn-empty{height:100%;min-height:78px;border:1px dashed rgba(160,180,215,.16);border-radius:16px;background:linear-gradient(145deg,rgba(16,25,43,.5),rgba(6,11,22,.56));display:grid;place-items:center;text-align:center;padding:16px;color:rgba(192,207,230,.58);font-size:.68rem}
    [data-nn-travel-root="v4"] .nn-result-card{position:relative;padding:9px;margin:0 0 7px;border:1px solid rgba(170,192,226,.17);border-radius:15px;background:radial-gradient(circle at 100% 0,color-mix(in srgb,var(--accent) 12%,transparent),transparent 32%),linear-gradient(150deg,rgba(24,34,56,.9),rgba(8,14,27,.9));box-shadow:0 9px 18px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden}
    [data-nn-travel-root="v4"] .nn-result-card.live{border-color:rgba(79,222,164,.3)}[data-nn-travel-root="v4"] .nn-result-card.estimate{border-color:rgba(112,167,255,.23)}
    [data-nn-travel-root="v4"] .nn-rhead{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.nn-rhead>div{min-width:0}[data-nn-travel-root="v4"] .nn-rhead strong{display:block;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}[data-nn-travel-root="v4"] .nn-meta{margin:2px 0 0;font-size:.59rem;line-height:1.25;color:rgba(196,211,235,.66)}
    [data-nn-travel-root="v4"] .nn-chip{flex:none;padding:3px 6px;border-radius:999px;border:1px solid rgba(170,190,220,.19);background:rgba(15,23,40,.68);font-size:.54rem;font-weight:900;letter-spacing:.035em}.nn-chip.live{border-color:rgba(79,222,164,.34);color:#8af0c4}.nn-chip.warn{border-color:rgba(255,184,95,.32);color:#ffd094}
    [data-nn-travel-root="v4"] .nn-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:7px}.nn-stats>div{min-width:0;padding:6px;border-radius:10px;border:1px solid rgba(160,180,215,.12);background:rgba(7,13,25,.48);box-shadow:inset 0 1px 4px rgba(0,0,0,.25)}.nn-stats span{display:block;font-size:.52rem;color:rgba(190,205,230,.6);text-transform:uppercase}.nn-stats strong{display:block;margin-top:2px;font-size:.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    [data-nn-travel-root="v4"] .nn-toolbar{display:flex;gap:5px;margin-top:7px}[data-nn-travel-root="v4"] .nn-toolbar button{height:28px!important;min-height:28px!important;padding:3px 7px!important;border-radius:8px!important;font-size:.58rem!important}
    [data-nn-travel-root="v4"] .nn-plan-day:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(var(--accent),color-mix(in srgb,var(--accent) 20%,#fff))}
    @media (min-width:680px){[data-nn-travel-root="v4"] .nn-grid{grid-template-columns:repeat(4,minmax(0,1fr))}[data-nn-travel-root="v4"] .desktop-span2{grid-column:span 2}[data-nn-travel-root="v4"] .span2{grid-column:span 2}}
    @media (max-height:650px){[data-nn-travel-root="v4"]{grid-template-rows:50px minmax(0,1fr);gap:6px}[data-nn-travel-root="v4"] .nn-dock{padding:5px;border-radius:15px}[data-nn-travel-root="v4"] .nn-tab{height:38px}[data-nn-travel-root="v4"] .nn-card{padding:8px!important}[data-nn-travel-root="v4"] .nn-form-head{margin-bottom:6px}[data-nn-travel-root="v4"] input,[data-nn-travel-root="v4"] select,[data-nn-travel-root="v4"] .nn-action{height:32px!important;min-height:32px!important}[data-nn-travel-root="v4"] textarea{height:42px!important;min-height:42px!important}}
    @media (max-width:360px){[data-nn-travel-root="v4"] .nn-tab{font-size:.62rem;gap:3px;padding:4px}[data-nn-travel-root="v4"] .nn-tab-icon{font-size:.78rem}[data-nn-travel-root="v4"] .nn-api-dot{width:5px;height:5px}}
  `;
  document.head.appendChild(style);
}

function syncViewport(root) {
  const apply = () => {
    if (!root.isConnected) return;
    const top = Math.max(0, root.getBoundingClientRect().top);
    const viewport = window.visualViewport?.height || window.innerHeight || 720;
    const reserveBottom = 72;
    root.style.setProperty('--nn-h', `${Math.max(390, Math.floor(viewport - top - reserveBottom))}px`);
  };
  requestAnimationFrame(apply);
  window.addEventListener('resize', apply, { passive:true });
  window.visualViewport?.addEventListener('resize', apply, { passive:true });
}

function setDot(root, key, state, title = '') {
  const dot = root.querySelector(`[data-api-dot="${key}"]`);
  if (!dot) return;
  dot.dataset.state = state;
  if (title) dot.title = title;
}

async function checkProviderHealth(root) {
  setDot(root, 'plan', 'live', 'On-device planner ready');
  try {
    await timeout(requireFirebaseUser(), 5000);
    const response = await timeout(httpsCallable(functions, 'getProviderHealth')({}), 7000);
    const travel = response?.data?.health?.travel || {};
    setDot(root, 'flights', travel.duffel || travel.amadeus ? 'live' : 'standby', travel.duffel || travel.amadeus ? 'Flight API configured' : 'Flight API standby');
    setDot(root, 'hotels', travel.amadeus ? 'live' : 'standby', travel.amadeus ? 'Hotel API configured' : 'Hotel API standby');
    setDot(root, 'ground', travel.distribusion ? 'live' : 'standby', travel.distribusion ? 'Ground API configured' : 'Ground API standby');
  } catch {
    ['flights','hotels','ground'].forEach(key => setDot(root, key, 'standby', 'Secure API will be checked on search'));
  }
}

function setTab(root, name) {
  const active = ['flights','hotels','ground','plan'].includes(name) ? name : 'flights';
  root.querySelectorAll('[data-travel-tab]').forEach(button => {
    const selected = button.dataset.travelTab === active;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
  });
  root.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== active; });
}

function estimateFlight(query) {
  const seed = `${query.from}|${query.to}|${query.departure}|${query.returnDate}|${query.adults}|${query.cabin}`;
  const cabin = {economy:1,premium_economy:1.5,business:2.8,first:4.2}[query.cabin] || 1;
  const returnFactor = query.returnDate ? 1.72 : 1;
  const base = seeded(`${seed}|base`, 95, 560) * cabin * returnFactor * query.adults;
  return [['Value',.88,1],['Balanced',1.02,0],['Flexible',1.18,1]].map(([name,factor,stops], i) => ({
    estimate:true, provider:'Planning estimate', carriers:[name], total:scaledUsd(base*factor,query.currency), compareTotal:scaledUsd(base*factor,query.currency), currency:query.currency, compareCurrency:query.currency,
    durationMinutes:seeded(`${seed}|time|${i}`,95,700), stops, originLabel:query.from, destinationLabel:query.to
  }));
}

function flightState(root) { return root.__nnFlight || (root.__nnFlight = {offers:[], sort:'cheapest'}); }
function sortFlights(list, mode) {
  const copy = [...list];
  if (mode === 'fastest') return copy.sort((a,b)=>(Number(a.durationMinutes)||1e9)-(Number(b.durationMinutes)||1e9));
  if (mode === 'best') return copy.sort((a,b)=>((Number(a.compareTotal)||1e9)*(1+(Number(a.stops)||0)*.08))-((Number(b.compareTotal)||1e9)*(1+(Number(b.stops)||0)*.08)));
  return copy.sort((a,b)=>(Number(a.compareTotal)||Number(a.total)||1e9)-(Number(b.compareTotal)||Number(b.total)||1e9));
}

function paintFlights(root) {
  const state = flightState(root), box = root.querySelector('[data-flight-results]');
  const offers = sortFlights(state.offers, state.sort);
  const toolbar = offers.length > 1 ? `<div class="nn-toolbar"><button class="nn-action secondary" data-flight-sort="cheapest">LOWEST</button><button class="nn-action secondary" data-flight-sort="fastest">FASTEST</button><button class="nn-action secondary" data-flight-sort="best">BEST</button></div>` : '';
  box.innerHTML = toolbar + (offers.length ? offers.map((o,i) => {
    const live = o.live === true && !o.estimate;
    const carrier = Array.isArray(o.carriers) && o.carriers.length ? o.carriers.join(' + ') : (live ? o.provider : 'Planning option');
    return `<article class="nn-result-card ${live?'live':'estimate'}"><div class="nn-rhead"><div><strong>${escapeHtml(carrier)}</strong><p class="nn-meta">${escapeHtml(o.originLabel||o.originCode||'')} → ${escapeHtml(o.destinationLabel||o.destinationCode||'')}</p></div><span class="nn-chip ${live?'live':'warn'}">${live?'LIVE API':i===0?'ESTIMATE':'PLAN'}</span></div><div class="nn-stats"><div><span>Price</span><strong>${escapeHtml(money(o.compareTotal ?? o.total,o.compareCurrency||o.currency||'USD'))}</strong></div><div><span>${live?'Depart':'Time'}</span><strong>${escapeHtml(live?timeText(o.departingAt):durationText(o.durationMinutes))}</strong></div><div><span>${live?'Duration':'Stops'}</span><strong>${escapeHtml(live?durationText(o.durationMinutes):String(Number(o.stops)||0))}</strong></div></div><p class="nn-meta">${live?`${escapeHtml(o.provider||'Provider')} returned bookable inventory.`:'Indicative planning estimate only — verify the final fare before booking.'}</p></article>`;
  }).join('') : '<div class="nn-empty">Enter a route and search.</div>');
}

async function searchFlights(root) {
  const q = {
    from:root.querySelector('[data-flight-origin]').value.trim(), to:root.querySelector('[data-flight-destination]').value.trim(),
    departure:root.querySelector('[data-flight-departure]').value, returnDate:root.querySelector('[data-flight-return]').value,
    adults:Number(root.querySelector('[data-flight-adults]').value)||1, cabin:root.querySelector('[data-flight-cabin]').value,
    currency:root.querySelector('[data-flight-currency]').value
  };
  const status = root.querySelector('[data-flight-status]'), button = root.querySelector('[data-flight-search]');
  if (!q.from || !q.to || !q.departure) { status.textContent='Enter origin, destination and departure date.'; return; }
  if (q.from.toLowerCase()===q.to.toLowerCase()) { status.textContent='Origin and destination must be different.'; return; }
  if (q.returnDate && q.returnDate < q.departure) { status.textContent='Return must be after departure.'; return; }
  const state = flightState(root); state.offers=estimateFlight(q); state.sort='cheapest'; paintFlights(root);
  status.textContent='Planning range ready • checking secure live flight APIs…'; button.disabled=true; button.textContent='CHECKING API…';
  try {
    await timeout(requireFirebaseUser(),5000);
    const res = await timeout(httpsCallable(functions,'searchWorldwideFlights')({origin:q.from,destination:q.to,departureDate:q.departure,returnDate:q.returnDate,adults:q.adults,cabin:q.cabin,currency:q.currency}));
    const data=res?.data||{}; const live=data.ok===true&&Array.isArray(data.offers)?data.offers.filter(x=>x?.live===true):[];
    if (live.length) { state.offers=live; state.sort='cheapest'; paintFlights(root); status.textContent=`${live.length} live flight offer${live.length===1?'':'s'} returned.`; setDot(root,'flights','live'); }
    else status.textContent=`Live API returned no bookable inventory • planning estimates kept${data.message?` (${data.message})`:''}.`;
  } catch (e) { status.textContent=`Secure flight API unavailable • planning estimates kept (${errorText(e)}).`; setDot(root,'flights','standby'); }
  finally { button.disabled=false; button.textContent='SEARCH FARES'; }
}

function nightsBetween(a,b){const x=Date.parse(`${a}T00:00:00Z`),y=Date.parse(`${b}T00:00:00Z`);return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,Math.round((y-x)/DAY_MS)):0;}
function estimateHotels(q){const nights=nightsBetween(q.checkIn,q.checkOut), seed=`${q.destination}|${q.checkIn}|${q.checkOut}|${q.adults}|${q.rooms}`, base=seeded(seed,32,135);return [['Smart Stay',.82],['Comfort Select',1],['Premium Choice',1.34]].map(([name,f],i)=>{const per=base*f*Math.max(1,q.rooms);return {estimate:true,name,provider:'Planning estimate',stayTotal:scaledUsd(per*nights,q.currency),pricePerNight:scaledUsd(per,q.currency),compareTotal:scaledUsd(per*nights,q.currency),comparePerNight:scaledUsd(per,q.currency),currency:q.currency,compareCurrency:q.currency,nights,rooms:q.rooms,adults:q.adults,roomDescription:['Value planning tier','Balanced comfort planning tier','Premium planning tier'][i]};});}
function hotelState(root){return root.__nnHotel||(root.__nnHotel={offers:[],sort:'total'});}
function paintHotels(root){const state=hotelState(root),box=root.querySelector('[data-hotel-results]');const offers=[...state.offers].sort((a,b)=>state.sort==='night'?(Number(a.comparePerNight??a.pricePerNight)||1e9)-(Number(b.comparePerNight??b.pricePerNight)||1e9):(Number(a.compareTotal??a.stayTotal)||1e9)-(Number(b.compareTotal??b.stayTotal)||1e9));const toolbar=offers.length>1?`<div class="nn-toolbar"><button class="nn-action secondary" data-hotel-sort="total">LOWEST TOTAL</button><button class="nn-action secondary" data-hotel-sort="night">LOWEST/NIGHT</button></div>`:'';box.innerHTML=toolbar+(offers.length?offers.map((o,i)=>{const live=o.live===true&&!o.estimate;return `<article class="nn-result-card ${live?'live':'estimate'}"><div class="nn-rhead"><div><strong>${escapeHtml(o.name||'Hotel')}</strong><p class="nn-meta">${escapeHtml(o.cityCode||'')} ${o.countryCode?`• ${escapeHtml(o.countryCode)}`:''}</p></div><span class="nn-chip ${live?'live':'warn'}">${live?'LIVE API':i===0?'ESTIMATE':'PLAN'}</span></div><div class="nn-stats"><div><span>Stay total</span><strong>${escapeHtml(money(o.compareTotal??o.stayTotal,o.compareCurrency||o.currency||'USD'))}</strong></div><div><span>Per night</span><strong>${escapeHtml(money(o.comparePerNight??o.pricePerNight,o.compareCurrency||o.currency||'USD'))}</strong></div><div><span>Stay</span><strong>${Number(o.nights)||0} nights</strong></div></div><p class="nn-meta">${escapeHtml(o.roomDescription||'Room details supplied by provider.')}${live?'':' • Estimate only; verify availability and final rate.'}</p></article>`;}).join(''):'<div class="nn-empty">Enter a destination and dates.</div>');}
async function searchHotels(root){const q={destination:root.querySelector('[data-hotel-destination]').value.trim(),checkIn:root.querySelector('[data-hotel-checkin]').value,checkOut:root.querySelector('[data-hotel-checkout]').value,adults:Number(root.querySelector('[data-hotel-adults]').value)||1,rooms:Number(root.querySelector('[data-hotel-rooms]').value)||1,currency:root.querySelector('[data-hotel-currency]').value};const status=root.querySelector('[data-hotel-status]'),button=root.querySelector('[data-hotel-search]'),nights=nightsBetween(q.checkIn,q.checkOut);if(!q.destination||!q.checkIn||!q.checkOut){status.textContent='Enter destination, check-in and check-out.';return;}if(nights<1){status.textContent='Check-out must be after check-in.';return;}if(nights>30){status.textContent='Keep hotel stays to 30 nights or fewer.';return;}const state=hotelState(root);state.offers=estimateHotels(q);state.sort='total';paintHotels(root);status.textContent='Planning range ready • checking secure live hotel API…';button.disabled=true;button.textContent='CHECKING API…';try{await timeout(requireFirebaseUser(),5000);const res=await timeout(httpsCallable(functions,'searchWorldwideHotels')({destination:q.destination,checkIn:q.checkIn,checkOut:q.checkOut,adults:q.adults,rooms:q.rooms,currency:q.currency}));const data=res?.data||{};const live=data.ok===true&&Array.isArray(data.offers)?data.offers.filter(x=>x?.live===true):[];if(live.length){state.offers=live;state.sort='total';paintHotels(root);status.textContent=`${live.length} live hotel offer${live.length===1?'':'s'} returned.`;setDot(root,'hotels','live');}else status.textContent=`Live hotel API returned no availability • planning estimates kept${data.message?` (${data.message})`:''}.`;}catch(e){status.textContent=`Secure hotel API unavailable • planning estimates kept (${errorText(e)}).`;setDot(root,'hotels','standby');}finally{button.disabled=false;button.textContent='SEARCH HOTELS';}}

function estimateGround(q){const seed=`${q.from}|${q.to}|${q.date}|${q.time}|${q.adults}`,distance=seeded(`${seed}|distance`,80,950),rail=Math.max(55,Math.round(distance/2.8)),bus=Math.max(80,Math.round(rail*1.5)),railUsd=Math.max(8,distance*.065)*q.adults,busUsd=Math.max(5,railUsd*.58);return [{estimate:true,mode:'Rail',provider:'Planning estimate',total:scaledUsd(railUsd,q.currency),currency:q.currency,durationMinutes:rail,originLabel:q.from,destinationLabel:q.to},{estimate:true,mode:'Coach / Bus',provider:'Planning estimate',total:scaledUsd(busUsd,q.currency),currency:q.currency,durationMinutes:bus,originLabel:q.from,destinationLabel:q.to},{estimate:true,mode:'Mixed transfer',provider:'Planning estimate',total:scaledUsd((railUsd+busUsd)*.57,q.currency),currency:q.currency,durationMinutes:Math.round((rail+bus)/2),originLabel:q.from,destinationLabel:q.to}];}
function paintGround(root,offers){const box=root.querySelector('[data-ground-results]');box.innerHTML=offers.length?offers.map((o,i)=>{const live=o.live===true&&!o.estimate;const carrier=Array.isArray(o.carrierNames)&&o.carrierNames.length?o.carrierNames.join(' + '):o.provider;return `<article class="nn-result-card ${live?'live':'estimate'}"><div class="nn-rhead"><div><strong>${escapeHtml(o.mode||'Ground transport')}</strong><p class="nn-meta">${escapeHtml(carrier||'Provider')} • ${escapeHtml(o.originLabel||'')} → ${escapeHtml(o.destinationLabel||'')}</p></div><span class="nn-chip ${live?'live':'warn'}">${live?'LIVE API':i===1?'BUDGET':'ESTIMATE'}</span></div><div class="nn-stats"><div><span>Fare</span><strong>${escapeHtml(money(o.total,o.currency||'USD'))}</strong></div><div><span>${live?'Depart':'Time'}</span><strong>${escapeHtml(live?timeText(o.departingAt):durationText(o.durationMinutes))}</strong></div><div><span>Duration</span><strong>${escapeHtml(durationText(o.durationMinutes))}</strong></div></div><p class="nn-meta">${live?`${o.seatsLeft!=null?`${o.seatsLeft} seats left • `:''}${o.electronicTicket?'E-ticket available • ':''}live provider inventory.`:'Indicative planning estimate only — verify timetable and final fare.'}</p></article>`;}).join(''):'<div class="nn-empty">Enter a route and search.</div>';}
async function searchGround(root){const q={from:root.querySelector('[data-ground-origin]').value.trim(),to:root.querySelector('[data-ground-destination]').value.trim(),date:root.querySelector('[data-ground-date]').value,time:root.querySelector('[data-ground-time]').value||'08:00',adults:Number(root.querySelector('[data-ground-adults]').value)||1,currency:root.querySelector('[data-ground-currency]').value};const status=root.querySelector('[data-ground-status]'),button=root.querySelector('[data-ground-search]');if(!q.from||!q.to||!q.date){status.textContent='Enter origin, destination and date.';return;}if(q.from.toLowerCase()===q.to.toLowerCase()){status.textContent='Origin and destination must be different.';return;}const fallback=estimateGround(q);paintGround(root,fallback);status.textContent='Planning comparison ready • checking live rail/bus API…';button.disabled=true;button.textContent='CHECKING API…';try{await timeout(requireFirebaseUser(),5000);const res=await timeout(httpsCallable(functions,'searchWorldwideGroundTransport')({origin:q.from,destination:q.to,departureDate:q.date,departureTime:q.time,adults:q.adults,currency:q.currency}));const data=res?.data||{};const live=data.ok===true&&Array.isArray(data.offers)?data.offers.filter(x=>x?.live===true):[];if(live.length){paintGround(root,live);status.textContent=`${live.length} live rail/bus option${live.length===1?'':'s'} returned.`;setDot(root,'ground','live');}else status.textContent=`Live ground API returned no inventory • planning estimates kept${data.message?` (${data.message})`:''}.`;}catch(e){status.textContent=`Secure ground API unavailable • planning estimates kept (${errorText(e)}).`;setDot(root,'ground','standby');}finally{button.disabled=false;button.textContent='SEARCH RAIL / BUS';}}

function dayRows(plan){const start=new Date(`${plan.start}T00:00:00`);return Array.from({length:plan.days},(_,i)=>{const date=new Date(start.getTime()+i*DAY_MS),hint=i===0?'Arrival, check-in and local orientation.':i===plan.days-1?'Final activities, checkout buffer and return preparation.':i%2?'Main sights, local food and flexible evening.':'Neighbourhoods, culture and local transport.';return `<article class="nn-result-card nn-plan-day"><div class="nn-rhead"><div><strong>Day ${i+1} • ${escapeHtml(date.toLocaleDateString())}</strong><p class="nn-meta">${escapeHtml(hint)}</p></div><span class="nn-chip live">PLAN</span></div></article>`;}).join('');}
function renderPlan(root,plan){const box=root.querySelector('[data-trip-results]');if(!plan?.destination){box.innerHTML='<div class="nn-empty">Create a trip and the itinerary appears here.</div>';return;}box.innerHTML=`<article class="nn-result-card"><div class="nn-rhead"><div><strong>${escapeHtml(plan.destination)} • ${plan.days} days</strong><p class="nn-meta">Saved privately on this device</p></div><span class="nn-chip live">SAVED</span></div>${plan.notes?`<p class="nn-meta">${escapeHtml(plan.notes)}</p>`:''}</article>${dayRows(plan)}<button class="nn-action" type="button" data-trip-use-flight>USE DESTINATION IN FLIGHTS</button>`;}
function saveTrip(root){const plan={destination:root.querySelector('[data-trip-destination]').value.trim().slice(0,80),start:root.querySelector('[data-trip-start]').value,days:Math.max(1,Math.min(30,Math.floor(Number(root.querySelector('[data-trip-days]').value)||3))),notes:root.querySelector('[data-trip-notes]').value.trim().slice(0,500),createdAt:Date.now()};const status=root.querySelector('[data-trip-status]');if(!plan.destination||!/^\d{4}-\d{2}-\d{2}$/.test(plan.start)){status.textContent='Choose a destination and valid start date.';return;}saveJson(TRIP_KEY,plan);status.textContent='Trip saved privately on this device.';renderPlan(root,plan);}
function clearTrip(root){localStorage.removeItem(TRIP_KEY);root.querySelector('[data-trip-destination]').value='';root.querySelector('[data-trip-notes]').value='';root.querySelector('[data-trip-days]').value='3';root.querySelector('[data-trip-status]').textContent='Saved trip cleared.';renderPlan(root,null);}
function useTrip(root){const plan=loadJson(TRIP_KEY,null);if(!plan?.destination)return;root.querySelector('[data-flight-destination]').value=plan.destination;if(plan.start)root.querySelector('[data-flight-departure]').value=plan.start;setTab(root,'flights');root.querySelector('[data-flight-status]').textContent=`${plan.destination} copied to Flights. Add origin and search.`;requestAnimationFrame(()=>root.querySelector('[data-flight-origin]')?.focus({preventScroll:true}));}

function installEvents(root){
  root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.matches('[data-travel-tab]'))setTab(root,b.dataset.travelTab);else if(b.matches('[data-flight-search]'))searchFlights(root);else if(b.matches('[data-flight-sort]')){const s=flightState(root);s.sort=b.dataset.flightSort||'cheapest';paintFlights(root);}else if(b.matches('[data-hotel-search]'))searchHotels(root);else if(b.matches('[data-hotel-sort]')){const s=hotelState(root);s.sort=b.dataset.hotelSort||'total';paintHotels(root);}else if(b.matches('[data-ground-search]'))searchGround(root);else if(b.matches('[data-trip-save]'))saveTrip(root);else if(b.matches('[data-trip-clear]'))clearTrip(root);else if(b.matches('[data-trip-use-flight]'))useTrip(root);});
  root.addEventListener('keydown',event=>{const b=event.target.closest('[data-travel-tab]');if(!b||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const tabs=[...root.querySelectorAll('[data-travel-tab]')],i=tabs.indexOf(b),next=tabs[(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];setTab(root,next.dataset.travelTab);next.focus({preventScroll:true});});
  root.addEventListener('change',event=>{if(event.target.matches('[data-flight-departure]')){const r=root.querySelector('[data-flight-return]');r.min=event.target.value||futureDate(1);if(r.value&&r.value<r.min)r.value='';}if(event.target.matches('[data-hotel-checkin]')){const out=root.querySelector('[data-hotel-checkout]'),base=Date.parse(`${event.target.value||futureDate(1)}T00:00:00Z`);out.min=new Date(base+DAY_MS).toISOString().slice(0,10);if(!out.value||out.value<=event.target.value)out.value=new Date(base+3*DAY_MS).toISOString().slice(0,10);}});
}

export function renderTravelSuite(){
  ensureStyles();
  const saved=loadJson(TRIP_KEY,loadJson('nexusnova_trip_plan_v2',loadJson('nexusnova_trip_plan_v1',null)));
  const root=node(`
    <nav class="nn-dock" role="tablist" aria-label="Travel tools">
      <button class="nn-tab is-active" type="button" role="tab" aria-selected="true" data-travel-tab="flights"><span class="nn-tab-icon">✈</span><span>Flights</span><i class="nn-api-dot" data-api-dot="flights"></i></button>
      <button class="nn-tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-travel-tab="hotels"><span class="nn-tab-icon">◆</span><span>Hotels</span><i class="nn-api-dot" data-api-dot="hotels"></i></button>
      <button class="nn-tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-travel-tab="ground"><span class="nn-tab-icon">⇄</span><span>Rail/Bus</span><i class="nn-api-dot" data-api-dot="ground"></i></button>
      <button class="nn-tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-travel-tab="plan"><span class="nn-tab-icon">✓</span><span>Trip</span><i class="nn-api-dot" data-api-dot="plan"></i></button>
    </nav>
    <div class="nn-stage">
      <section class="nn-panel" data-panel="flights">
        <section class="nn-card">
          <div class="nn-form-head"><strong>Flight Fare Compare</strong><span>LIVE API + SAFE FALLBACK</span></div>
          <div class="nn-grid">
            <label class="nx-field"><span>From</span><input maxlength="80" autocomplete="off" data-flight-origin placeholder="Karachi / KHI"></label>
            <label class="nx-field"><span>To</span><input maxlength="80" autocomplete="off" data-flight-destination placeholder="Dubai / DXB"></label>
            <label class="nx-field"><span>Departure</span><input type="date" data-flight-departure></label>
            <label class="nx-field"><span>Return</span><input type="date" data-flight-return></label>
            <label class="nx-field"><span>Adults</span><select data-flight-adults>${countOptions()}</select></label>
            <label class="nx-field"><span>Cabin</span><select data-flight-cabin><option value="economy">Economy</option><option value="premium_economy">Premium Economy</option><option value="business">Business</option><option value="first">First</option></select></label>
            <label class="nx-field"><span>Currency</span><select data-flight-currency>${currencyOptions()}</select></label>
            <button class="nn-action" type="button" data-flight-search>SEARCH FARES</button>
          </div><p class="nn-status" role="status" aria-live="polite" data-flight-status>Ready • secure flight APIs checked on search.</p>
        </section>
        <section class="nn-results" data-flight-results><div class="nn-empty">Enter a route and search. Results stay inside this screen.</div></section>
      </section>
      <section class="nn-panel" data-panel="hotels" hidden>
        <section class="nn-card">
          <div class="nn-form-head"><strong>Hotel Availability</strong><span>LIVE AMADEUS API</span></div>
          <div class="nn-grid">
            <label class="nx-field span2 desktop-span2"><span>Destination</span><input maxlength="80" autocomplete="off" data-hotel-destination placeholder="Paris / PAR"></label>
            <label class="nx-field"><span>Check-in</span><input type="date" data-hotel-checkin></label><label class="nx-field"><span>Check-out</span><input type="date" data-hotel-checkout></label>
            <label class="nx-field"><span>Adults</span><select data-hotel-adults>${countOptions(9,2)}</select></label><label class="nx-field"><span>Rooms</span><select data-hotel-rooms>${countOptions(4,1)}</select></label>
            <label class="nx-field"><span>Currency</span><select data-hotel-currency>${currencyOptions()}</select></label><button class="nn-action" type="button" data-hotel-search>SEARCH HOTELS</button>
          </div><p class="nn-status" role="status" aria-live="polite" data-hotel-status>Ready • secure hotel API checked on search.</p>
        </section>
        <section class="nn-results" data-hotel-results><div class="nn-empty">Enter a destination and dates. Live availability appears here.</div></section>
      </section>
      <section class="nn-panel" data-panel="ground" hidden>
        <section class="nn-card">
          <div class="nn-form-head"><strong>Rail + Bus Compare</strong><span>LIVE DISTRIBUSION API</span></div>
          <div class="nn-grid">
            <label class="nx-field"><span>From</span><input maxlength="80" data-ground-origin placeholder="London"></label><label class="nx-field"><span>To</span><input maxlength="80" data-ground-destination placeholder="Paris"></label>
            <label class="nx-field"><span>Date</span><input type="date" data-ground-date></label><label class="nx-field"><span>From time</span><input type="time" data-ground-time value="08:00"></label>
            <label class="nx-field"><span>Travellers</span><select data-ground-adults>${countOptions()}</select></label><label class="nx-field"><span>Currency</span><select data-ground-currency>${currencyOptions()}</select></label>
            <button class="nn-action span2" type="button" data-ground-search>SEARCH RAIL / BUS</button>
          </div><p class="nn-status" role="status" aria-live="polite" data-ground-status>Ready • city names resolve worldwide before live provider search.</p>
        </section>
        <section class="nn-results" data-ground-results><div class="nn-empty">Enter a route and search. Live rail/bus inventory appears here.</div></section>
      </section>
      <section class="nn-panel" data-panel="plan" hidden>
        <section class="nn-card">
          <div class="nn-form-head"><strong>Private Trip Planner</strong><span>ON DEVICE</span></div>
          <div class="nn-grid">
            <label class="nx-field span2 desktop-span2"><span>Destination</span><input maxlength="80" data-trip-destination placeholder="Any city worldwide"></label>
            <label class="nx-field"><span>Start date</span><input type="date" data-trip-start></label><label class="nx-field"><span>Days</span><input type="number" min="1" max="30" value="3" data-trip-days></label>
            <label class="nx-field span2 desktop-span2"><span>Notes / places</span><textarea maxlength="500" data-trip-notes></textarea></label>
            <button class="nn-action" type="button" data-trip-save>CREATE / SAVE</button><button class="nn-action secondary" type="button" data-trip-clear>CLEAR</button>
          </div><p class="nn-status" role="status" aria-live="polite" data-trip-status>${saved?.destination?'Saved trip loaded.':'No saved trip.'}</p>
        </section>
        <section class="nn-results" data-trip-results></section>
      </section>
    </div>`);

  root.querySelector('[data-flight-departure]').min=futureDate(1); root.querySelector('[data-flight-departure]').value=futureDate(7); root.querySelector('[data-flight-return]').min=futureDate(7); root.querySelector('[data-flight-currency]').value='PKR';
  root.querySelector('[data-hotel-checkin]').min=futureDate(1); root.querySelector('[data-hotel-checkin]').value=futureDate(7); root.querySelector('[data-hotel-checkout]').min=futureDate(8); root.querySelector('[data-hotel-checkout]').value=futureDate(10); root.querySelector('[data-hotel-currency]').value='PKR';
  root.querySelector('[data-ground-date]').min=futureDate(0); root.querySelector('[data-ground-date]').value=futureDate(1); root.querySelector('[data-ground-currency]').value='PKR';
  root.querySelector('[data-trip-start]').value=new Date().toISOString().slice(0,10);
  if(saved&&typeof saved==='object'){root.querySelector('[data-trip-destination]').value=String(saved.destination||'').slice(0,80);root.querySelector('[data-trip-start]').value=/^\d{4}-\d{2}-\d{2}$/.test(String(saved.start||''))?saved.start:root.querySelector('[data-trip-start]').value;root.querySelector('[data-trip-days]').value=String(Math.max(1,Math.min(30,Number(saved.days)||3)));root.querySelector('[data-trip-notes]').value=String(saved.notes||'').slice(0,500);renderPlan(root,{destination:root.querySelector('[data-trip-destination]').value,start:root.querySelector('[data-trip-start]').value,days:Number(root.querySelector('[data-trip-days]').value),notes:root.querySelector('[data-trip-notes]').value});}else renderPlan(root,null);
  installEvents(root); syncViewport(root); setTab(root,'flights'); checkProviderHealth(root);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
