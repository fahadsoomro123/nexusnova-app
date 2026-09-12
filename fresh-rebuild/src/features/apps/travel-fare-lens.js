import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml } from '../../core/local-store.js';

const WEBSITE_URL = 'https://nexusnovatools.com/';
const TRIP_STORE_KEY = 'nexusnova_travel_trip_center_v1';
const functions = getFunctions(firebaseApp, 'us-central1');
const LIVE_TIMEOUT_MS = 15_000;
const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80'
];
const CITY_OPTIONS = [
  ['KHI', 'Karachi'], ['ISB', 'Islamabad'], ['LHE', 'Lahore'], ['PEW', 'Peshawar'], ['MUX', 'Multan'], ['SKT', 'Sialkot'],
  ['DXB', 'Dubai'], ['AUH', 'Abu Dhabi'], ['DOH', 'Doha'], ['JED', 'Jeddah'], ['RUH', 'Riyadh'], ['IST', 'Istanbul'],
  ['LHR', 'London'], ['CDG', 'Paris'], ['FRA', 'Frankfurt'], ['FCO', 'Rome'], ['AMS', 'Amsterdam'], ['MAD', 'Madrid'],
  ['JFK', 'New York'], ['LAX', 'Los Angeles'], ['YYZ', 'Toronto'], ['SYD', 'Sydney'], ['MEL', 'Melbourne'], ['SIN', 'Singapore'],
  ['KUL', 'Kuala Lumpur'], ['BKK', 'Bangkok'], ['DEL', 'Delhi'], ['BOM', 'Mumbai'], ['DAC', 'Dhaka'], ['CAI', 'Cairo']
];

function tripStore() {
  try { return JSON.parse(localStorage.getItem(TRIP_STORE_KEY) || '{}'); } catch { return {}; }
}
function saveTripStore(next) {
  try { localStorage.setItem(TRIP_STORE_KEY, JSON.stringify(next)); return true; } catch { return false; }
}
function saveTripAction(action) {
  const state = tripStore();
  state[action] = { savedAt: Date.now() };
  return saveTripStore(state);
}

function openInNovaBrowser(url = WEBSITE_URL) {
  try {
    if (typeof window.NexusBrowserAndroid?.postMessage === 'function') {
      window.NexusBrowserAndroid.postMessage(JSON.stringify({ action: 'open', url }));
      return true;
    }
  } catch (error) {
    console.warn('[Travel Fare Lens] Nova Browser:', error);
  }
  return false;
}

function openRouteInNovaBrowser(destination) {
  const url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination);
  return openInNovaBrowser(url);
}

function cleanFlightNumber(flightNumber) {
  const flight = String(flightNumber || '').trim().replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9-]{2,10}$/.test(flight) ? flight : '';
}

function money(amount, currency = 'PKR') {
  try { return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${Math.round(Number(amount) || 0).toLocaleString()} ${currency}`; }
}

function futureDate(days = 6) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function compactDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : value;
}

function timeout(promise, ms = LIVE_TIMEOUT_MS) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Secure travel API timed out.')), ms))]);
}

function errorText(error) {
  return String(error?.message || error || 'Search unavailable.').replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[a-z-]+:\s*/i, '').slice(0, 160);
}

function durationText(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return total ? `${Math.floor(total / 60)}h ${total % 60}m` : 'Duration pending';
}

function routeData(root) {
  return {
    origin: root.dataset.nnflOrigin || 'Karachi',
    destination: root.dataset.nnflDestination || 'Islamabad'
  };
}

function updateSearchButton(root, mode) {
  const button = root.querySelector('[data-nnfl-refresh]');
  const labels = { flights: 'SEARCH FLIGHTS', buses: 'SEARCH BUSES', trains: 'SEARCH TRAINS', hotels: 'SEARCH HOTELS', trip: 'REFRESH TRIP' };
  button.textContent = labels[mode] || 'SEARCH';
}

function renderRoute(root, side, city) {
  const key = side === 'origin' ? 'nnflOrigin' : 'nnflDestination';
  root.dataset[key] = city.name;
  root.querySelector(`[data-nnfl-${side}-code]`).textContent = city.code;
  root.querySelector(`[data-nnfl-${side}-name]`).textContent = city.name;
}

function cityMatches(query = '') {
  const needle = String(query).trim().toLowerCase();
  const matches = CITY_OPTIONS.filter(([code, name]) => !needle || code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle)).slice(0, 6);
  if (needle && !matches.some(([, name]) => name.toLowerCase() === needle)) {
    matches.push([needle.slice(0, 3).toUpperCase(), String(query).trim()]);
  }
  return matches.slice(0, 6);
}

function paintCityChoices(root) {
  const picker = root.querySelector('[data-nnfl-city-picker]');
  const query = picker.querySelector('[data-nnfl-city-query]').value;
  const choices = cityMatches(query);
  picker.querySelector('[data-nnfl-city-list]').innerHTML = choices.map(([code, name]) => `<button type="button" data-nnfl-city-choice data-code="${escapeHtml(code)}" data-name="${escapeHtml(name)}"><strong>${escapeHtml(code)}</strong><span>${escapeHtml(name)}</span></button>`).join('') || '<p>No city found. Type any city name, then choose it.</p>';
}

function openCityPicker(root, side) {
  const picker = root.querySelector('[data-nnfl-city-picker]');
  picker.dataset.nnflCitySide = side;
  picker.hidden = false;
  const input = picker.querySelector('[data-nnfl-city-query]');
  input.value = '';
  picker.querySelector('[data-nnfl-city-picker-title]').textContent = side === 'origin' ? 'Choose departure city' : 'Choose destination city';
  paintCityChoices(root);
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
}

function createRoot() {
  const root = document.createElement('section');
  root.className = 'nn-fare-lens';
  root.dataset.nnFareLens = 'true';
  root.dataset.nnflOrigin = 'Karachi';
  root.dataset.nnflDestination = 'Islamabad';
  const departureDate = futureDate();
  root.innerHTML = `
    <div class="nnfl-top">
      <button type="button" class="nnfl-brand" data-nnfl-brand aria-label="Open NexusNova Tools in Nova Browser">
        NEXUSNOVA <span>TOOLS</span><small>nexusnovatools.com</small>
      </button>
      <div class="nnfl-top-actions"><button type="button" class="nnfl-pak-mode" data-nnfl-pak-mode><i class="nnfl-pak-flag" aria-hidden="true"></i><span>Pakistan</span></button><button type="button" class="nnfl-route-link" data-nnfl-brand><span>Nova</span><b>↗</b></button></div>
    </div>
    <div class="nnfl-route">
      <button type="button" class="nnfl-route-city" data-nnfl-edit-route="origin"><small>FROM</small><strong data-nnfl-origin-code>KHI</strong><span data-nnfl-origin-name>Karachi</span></button>
      <button type="button" data-nnfl-swap aria-label="Swap route">→</button>
      <button type="button" class="nnfl-route-city" data-nnfl-edit-route="destination"><small>TO</small><strong data-nnfl-destination-code>ISB</strong><span data-nnfl-destination-name>Islamabad</span></button>
      <p><span data-nnfl-date>${compactDate(departureDate)}</span><span>•</span><span data-nnfl-travellers>2 adults · 1 child</span></p>
    </div>
    <nav class="nnfl-tabs" aria-label="Travel mode">
      <button type="button" class="is-active" data-nnfl-tab="flights">Flights</button>
      <button type="button" data-nnfl-tab="buses">Buses</button>
      <button type="button" data-nnfl-tab="trains">Trains</button>
      <button type="button" data-nnfl-tab="hotels">Hotels</button>
      <button type="button" data-nnfl-tab="trip">Trip</button>
    </nav>
    <div class="nnfl-controls">
      <label>Adults<select data-nnfl-adults>${Array.from({ length: 9 }, (_, index) => `<option value="${index + 1}"${index === 1 ? ' selected' : ''}>${index + 1}</option>`).join('')}</select></label>
      <label>Children<select data-nnfl-children>${Array.from({ length: 9 }, (_, index) => `<option value="${index}"${index === 1 ? ' selected' : ''}>${index}</option>`).join('')}</select></label>
      <label>Cabin<select data-nnfl-cabin><option value="economy">Economy</option><option value="premium_economy">Premium Economy</option><option value="business">Business</option><option value="first">First Class</option></select></label>
      <button type="button" data-nnfl-refresh>SEARCH FLIGHTS</button>
    </div>
    <div class="nnfl-premium-row"><button type="button" data-nnfl-premium="calendar">FARE CALENDAR</button><button type="button" data-nnfl-premium="rescue">DISRUPTION RESCUE</button><button type="button" data-nnfl-premium="preference">SEAT / ROOM</button></div>
    <div class="nnfl-status"><span>FARE LENS</span><strong data-nnfl-title>Family comparison</strong><em data-nnfl-state>Planning fares — live provider connection will replace these only when approved.</em></div>
    <div class="nnfl-live-track"><label>WORLDWIDE FLIGHT DIRECTORY<input data-nnfl-flight-number list="nnfl-flight-directory" inputmode="text" maxlength="14" placeholder="Search / select e.g. PK-301"><datalist id="nnfl-flight-directory"><option value="PK-301" label="Pakistan International Airlines · Karachi → Islamabad"></option><option value="EK-600" label="Emirates · Dubai → Karachi"></option><option value="QR-610" label="Qatar Airways · Doha → Karachi"></option><option value="SV-700" label="Saudia · Jeddah → Karachi"></option><option value="TK-710" label="Turkish Airlines · Istanbul → Karachi"></option><option value="EY-200" label="Etihad Airways · Abu Dhabi → Karachi"></option><option value="BA-115" label="British Airways · London → Dubai"></option><option value="LH-760" label="Lufthansa · Frankfurt → Delhi"></option><option value="SQ-322" label="Singapore Airlines · Singapore → London"></option><option value="AA-100" label="American Airlines · New York → London"></option></datalist></label><button type="button" data-nnfl-track-live>SEARCH / TRACK</button></div>
    <div class="nnfl-results" data-nnfl-results></div>
    <footer><button type="button" data-nnfl-brand>www.nexusnovatools.com</button><span>Nova Browser</span></footer>
    <section class="nnfl-city-picker" data-nnfl-city-picker hidden aria-modal="true" role="dialog">
      <div class="nnfl-city-picker__head"><strong data-nnfl-city-picker-title>Choose city</strong><button type="button" data-nnfl-close-city>Close</button></div>
      <input data-nnfl-city-query autocomplete="off" placeholder="Search any city or airport">
      <div data-nnfl-city-list></div>
    </section>
  `;
  return root;
}

function styles() {
  if (document.getElementById('nn-fare-lens-style')) return;
  const style = document.createElement('style');
  style.id = 'nn-fare-lens-style';
  style.textContent = `
    .nx-travel-route-screen{position:fixed!important;inset:0 0 72px 0!important;width:100vw!important;height:auto!important;min-height:0!important;overflow:hidden!important;padding:0!important;margin:0!important;background:#fff!important;z-index:20}.nx-travel-route-screen [data-app-mount]{width:100vw!important;height:100%;overflow:hidden}.nnfl-floating-back{position:fixed;z-index:30;right:12px;top:max(11px,env(safe-area-inset-top));width:34px;height:34px;border:0;border-radius:50%;background:#fff;color:#1769ff;font-size:26px;line-height:1;box-shadow:0 2px 10px rgba(17,24,39,.12)}
    [data-nn-fare-lens="true"]{position:relative;width:100vw;height:100%;min-height:390px;max-height:none;overflow:hidden!important;background:#fff;color:#111827;padding:max(10px,env(safe-area-inset-top)) 14px 0;display:grid;grid-template-rows:auto auto auto auto auto auto auto minmax(0,1fr) auto;gap:0;font-family:Inter,system-ui,sans-serif}
    [data-nn-fare-lens="true"],[data-nn-fare-lens="true"] *{box-sizing:border-box;overscroll-behavior:none}[data-nn-fare-lens="true"]{touch-action:none}
    [data-nn-fare-lens="true"] button,[data-nn-fare-lens="true"] select{font:inherit}
    .nnfl-top{display:flex;align-items:center;justify-content:space-between;min-height:42px;border-bottom:1px solid #e5eaf0}
    .nnfl-brand,.nnfl-route-link,.nnfl-tabs button,.nnfl-results button, .nnfl-controls button, .nnfl-route button, .nn-fare-book, .nnfl-fallback-link{border:0;background:transparent;color:inherit;cursor:pointer}
    .nnfl-top-actions{display:flex;align-items:center;gap:6px}.nnfl-pak-mode,.nnfl-route-link{height:27px;border-radius:14px;font-size:8px;font-weight:900;letter-spacing:.01em}.nnfl-pak-mode{display:flex;align-items:center;gap:5px;border:1px solid #cfe0ff;background:linear-gradient(135deg,#fff,#edf5ff);color:#1769ff;padding:3px 8px 3px 4px}.nnfl-pak-flag{position:relative;display:block;width:20px;height:13px;border-radius:2px;background:linear-gradient(90deg,#fff 0 24%,#01411c 24%);box-shadow:inset 0 0 0 1px rgba(1,65,28,.12);overflow:hidden}.nnfl-pak-flag:before{content:'☾';position:absolute;left:8px;top:-3px;color:#fff;font-size:12px;line-height:13px}.nnfl-pak-flag:after{content:'★';position:absolute;left:13px;top:0;color:#fff;font-size:5px;line-height:13px}.nnfl-pak-mode.is-active{border-color:#087f5b;background:#087f5b;color:#fff}.nnfl-pak-mode.is-active .nnfl-pak-flag{box-shadow:0 0 0 1px rgba(255,255,255,.35)}.nnfl-route-link{display:flex;align-items:center;gap:5px;border:1px solid #dce5f0;background:#fff;color:#1769ff;padding:3px 8px}.nnfl-route-link b{display:grid;place-items:center;width:17px;height:17px;border-radius:50%;background:#1769ff;color:#fff;font-size:10px;line-height:1}.nnfl-brand{padding:0;text-align:left;font-size:11px;font-weight:900;letter-spacing:.08em}.nnfl-brand span{color:#1769ff}.nnfl-brand small{display:block;color:#748196;font-size:8px;letter-spacing:.04em;margin-top:2px}
    .nnfl-route{display:grid;grid-template-columns:1fr 32px 1fr;align-items:center;padding:10px 0 7px;border-bottom:1px solid #e5eaf0}.nnfl-route-city{min-width:0;border:0;background:#fff;padding:0;text-align:left;color:#111827}.nnfl-route-city:last-of-type{text-align:right}.nnfl-route small,.nnfl-route span{display:block;color:#748196;font-size:10px}.nnfl-route strong{display:block;font-size:28px;line-height:1;margin:3px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nnfl-route>[data-nnfl-swap]{width:32px;height:32px;color:#1769ff;font-size:20px}.nnfl-route p{grid-column:1/-1;display:flex;gap:7px;margin:9px 0 0;font-size:10px;color:#748196}
    .nnfl-tabs{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid #e5eaf0}.nnfl-tabs button{padding:10px 2px 8px;border-bottom:2px solid transparent;color:#748196;font-size:10px}.nnfl-tabs button.is-active{color:#1769ff;border-color:#1769ff;font-weight:800}
    .nnfl-controls{display:grid;grid-template-columns:repeat(3,1fr) 1.45fr;gap:6px;align-items:end;padding:8px 0;border-bottom:1px solid #e5eaf0}.nnfl-controls label{display:grid;gap:3px;font-size:8px;color:#748196;text-transform:uppercase;letter-spacing:.05em}.nnfl-controls select{width:100%;height:28px;border:0;border-bottom:1px solid #cfd8e3;background:#fff;color:#111827;font-size:10px}.nnfl-controls button{height:28px;background:#1769ff;color:#fff;border-radius:8px;font-size:9px;font-weight:800}
    .nnfl-premium-row{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:7px 0 0}.nnfl-premium-row button{border:1px solid #dce5f0;background:#fff;color:#1769ff;border-radius:7px;padding:6px 3px;font-size:7px;font-weight:900}.nnfl-premium-row button.is-active{background:#1769ff;color:#fff}.nnfl-fare-calendar{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding-top:5px}.nnfl-fare-calendar button{min-height:52px;border:1px solid #e1e7ef;background:#fff;border-radius:8px;text-align:left;padding:6px}.nnfl-fare-calendar small,.nnfl-fare-calendar span{display:block;color:#748196;font-size:7px}.nnfl-fare-calendar strong{display:block;font-size:9px;margin:4px 0}.nnfl-premium-note,.nnfl-preference p,.nnfl-rescue span,.nnfl-rescue small{font-size:9px;color:#748196}.nnfl-rescue{display:grid;gap:7px;padding-top:6px}.nnfl-rescue strong{font-size:13px}.nnfl-rescue button{border:0;border-bottom:1px solid #e5eaf0;background:#fff;text-align:left;padding:9px 0;color:#1769ff;font-size:10px;font-weight:800}.nnfl-preference{padding-top:8px}.nnfl-preference>div{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.nnfl-preference button{border:1px solid #dce5f0;background:#fff;padding:11px 6px;border-radius:8px;color:#1769ff;font-size:9px;font-weight:800}.nnfl-status{display:grid;grid-template-columns:auto 1fr;gap:5px 9px;padding:9px 0 6px}.nnfl-live-track{display:grid;grid-template-columns:1fr 106px;gap:7px;align-items:end;border-bottom:1px solid #e5eaf0;padding:0 0 7px}.nnfl-live-track label{display:grid;gap:3px;color:#748196;font-size:8px;letter-spacing:.05em}.nnfl-live-track input{height:27px;border:0;border-bottom:1px solid #cfd8e3;background:#fff;padding:0;color:#111827;font-size:10px}.nnfl-live-track button{height:27px;border:0;border-radius:8px;background:#087f5b;color:#fff;font-size:8px;font-weight:800}.nnfl-status span{font-size:8px;color:#1769ff;font-weight:900;letter-spacing:.08em}.nnfl-status strong{font-size:12px}.nnfl-status em{grid-column:1/-1;font-size:9px;color:#748196;font-style:normal}
    .nnfl-results{min-height:0;overflow:hidden}.nnfl-fare{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:58px;border-bottom:1px solid #e5eaf0}.nnfl-fare-mark{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#eef4ff;color:#1769ff;font-size:11px;font-weight:900}.nnfl-fare:nth-child(2) .nnfl-fare-mark{background:#fff6df;color:#9a6308}.nnfl-fare:nth-child(3) .nnfl-fare-mark{background:#eaf8f2;color:#087f5b}.nnfl-fare small,.nnfl-fare em{display:block;color:#748196;font-size:8px;font-style:normal}.nnfl-fare strong{display:block;font-size:11px;margin:2px 0}.nnfl-fare>div:last-child{text-align:right}.nnfl-fare b{display:block;font-size:12px}.nn-fare-book{color:#1769ff;font-size:9px;font-weight:800;margin-top:4px}.nnfl-tracker-panel{padding:14px 0;border-bottom:1px solid #e5eaf0}.nnfl-tracker-panel small{display:block;color:#1769ff;font-size:8px;font-weight:900;letter-spacing:.08em}.nnfl-tracker-panel strong{display:block;font-size:25px;margin:5px 0}.nnfl-tracker-panel>span{display:block;color:#748196;font-size:10px;line-height:1.35}.nnfl-tracker-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0;margin-top:12px;border-top:1px solid #e5eaf0}.nnfl-tracker-grid div{padding:9px 0;border-bottom:1px solid #e5eaf0}.nnfl-tracker-grid div:nth-child(even){padding-left:9px;border-left:1px solid #e5eaf0}.nnfl-tracker-grid span,.nnfl-tracker-grid b{display:block}.nnfl-tracker-grid span{font-size:8px;color:#748196}.nnfl-tracker-grid b{margin-top:3px;font-size:10px}.nnfl-tracker-note{margin:10px 0 0;color:#748196;font-size:9px}
    .nnfl-empty{display:grid;place-items:center;height:100%;text-align:center;color:#748196;font-size:11px;padding:20px}.nnfl-trip-center{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid #e5eaf0}.nnfl-trip-budget{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #e5eaf0}.nnfl-trip-budget small,.nnfl-trip-budget span{display:block;color:#748196;font-size:9px}.nnfl-trip-budget strong{font-size:15px}.nnfl-trip-action{min-height:50px;padding:8px 5px 8px 0;text-align:left;border:0;border-bottom:1px solid #e5eaf0;background:#fff;color:#111827}.nnfl-trip-action:nth-of-type(even){padding-left:9px;border-left:1px solid #e5eaf0}.nnfl-trip-action strong,.nnfl-trip-action span{display:block}.nnfl-trip-action strong{font-size:10px}.nnfl-trip-action span{font-size:8px;color:#748196;margin-top:3px}.nnfl-trip-action.is-saved strong{color:#087f5b}.nnfl-trip-note{grid-column:1/-1;margin:0;padding:8px 0;color:#748196;font-size:8px}.nnfl-hotel{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:8px;min-height:66px;align-items:center;border-bottom:1px solid #e5eaf0}.nnfl-hotel img{width:62px;height:48px;object-fit:cover;border-radius:8px;background:#eef4ff}.nnfl-hotel strong{font-size:11px}.nnfl-hotel span,.nnfl-hotel small{display:block;font-size:9px;color:#748196;margin-top:3px}.nnfl-hotel button{border:0;background:#1769ff;color:#fff;border-radius:8px;padding:8px;font-size:9px;font-weight:800}
    [data-nn-fare-lens="true"] footer{display:flex;justify-content:space-between;align-items:center;min-height:30px;border-top:1px solid #e5eaf0;overflow:hidden}.nnfl-fallback-link,[data-nn-fare-lens="true"] footer button,[data-nn-fare-lens="true"] footer span{font-size:8px!important;line-height:1.1!important;color:#1769ff;font-weight:800}.nnfl-fallback-link{padding:0}.nnfl-fallback-link a{color:inherit}.nnfl-fallback-link{display:none}
    .nnfl-city-picker{position:absolute;inset:0;z-index:50;background:#fff;padding:max(14px,env(safe-area-inset-top)) 14px 14px;overflow:hidden}.nnfl-city-picker__head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5eaf0;padding-bottom:10px}.nnfl-city-picker__head strong{font-size:15px}.nnfl-city-picker__head button{border:0;background:#fff;color:#1769ff;font-size:11px;font-weight:800}.nnfl-city-picker input{width:100%;height:42px;margin:13px 0 7px;border:0;border-bottom:2px solid #1769ff;background:#fff;color:#111827;font-size:16px}.nnfl-city-picker [data-nnfl-city-list]{display:grid}.nnfl-city-picker [data-nnfl-city-list] button{display:grid;grid-template-columns:46px 1fr;gap:8px;align-items:center;min-height:48px;border:0;border-bottom:1px solid #e5eaf0;background:#fff;text-align:left;color:#111827}.nnfl-city-picker [data-nnfl-city-list] strong{color:#1769ff;font-size:13px}.nnfl-city-picker [data-nnfl-city-list] span{font-size:13px}.nnfl-city-picker p{font-size:12px;color:#748196}
    @media(max-height:650px){.nx-travel-route-screen{bottom:64px!important}[data-nn-fare-lens="true"]{padding-top:8px}.nnfl-route{padding:6px 0}.nnfl-route strong{font-size:23px}.nnfl-tabs button{padding:7px 1px}.nnfl-controls{padding:5px 0}.nnfl-fare{min-height:48px}.nnfl-status{padding:5px 0}}
  `;
  document.head.appendChild(style);
}

function offers(adults, children, cabin) {
  const multiplier = ({ economy: 1, premium_economy: 1.55, business: 2.45, first: 4.1 })[cabin] || 1;
  const adult = 14900 * adults * multiplier;
  const child = 8650 * children * multiplier;
  const base = adult + child;
  return [
    ['✦', 'BEST OVERALL', 'Non-stop · 1h 55m', 'Bags + flexible change', Math.round(base * 1.11)],
    ['₨', 'LOWEST', '1 stop · 4h 10m', 'Cabin baggage', Math.round(base)],
    ['◷', 'FASTEST', 'Non-stop · 1h 45m', 'Checked bag', Math.round(base * 1.23)]
  ];
}

function renderLiveOffers(liveOffers) {
  return liveOffers.slice(0, 3).map((offer, index) => {
    const carrier = escapeHtml(String(offer.carriers?.join(' · ') || offer.provider || 'Live offer'));
    const route = `${Number(offer.stops) || 0 ? `${offer.stops} stop${Number(offer.stops) === 1 ? '' : 's'}` : 'Non-stop'} · ${durationText(offer.durationMinutes)}`;
    const note = offer.expiresAt ? `Live fare · expires ${escapeHtml(String(offer.expiresAt).slice(0, 10))}` : 'Live fare from approved provider';
    return `<article class="nnfl-fare"><div class="nnfl-fare-mark">${index === 0 ? '✦' : index === 1 ? '₨' : '◷'}</div><div><small>${index === 0 ? 'LIVE BEST VALUE' : index === 1 ? 'LIVE LOWEST' : 'LIVE OPTION'}</small><strong>${carrier}</strong><em>${escapeHtml(route)} · ${note}</em></div><div><b>${money(offer.compareTotal ?? offer.total, offer.compareCurrency || offer.currency || 'PKR')}</b><button type="button" class="nn-fare-book" data-nnfl-book="${escapeHtml(String(offer.id || index))}">SELECT & BOOK</button></div></article>`;
  }).join('');
}

function trackerPanel(flight, data = null, message = 'Searching public ADS-B signal…') {
  const position = data?.position;
  const location = position ? `${Number(position.latitude).toFixed(4)}, ${Number(position.longitude).toFixed(4)}` : 'Signal unavailable';
  const altitude = Number.isFinite(Number(data?.altitudeFt)) ? `${Math.round(data.altitudeFt).toLocaleString()} ft` : '—';
  const speed = Number.isFinite(Number(data?.speedKts)) ? `${Math.round(data.speedKts)} kt` : '—';
  const arrival = data?.destination || '—';
  const seen = Number.isFinite(Number(data?.seenSeconds)) ? `${Math.round(data.seenSeconds)} sec ago` : '—';
  return `<section class="nnfl-tracker-panel"><small>IN-APP LIVE FLIGHT TRACKER · KEYLESS</small><strong>${escapeHtml(flight)}</strong><span>${escapeHtml(message)}</span><div class="nnfl-tracker-grid"><div><span>LIVE LOCATION</span><b>${escapeHtml(location)}</b></div><div><span>ALTITUDE</span><b>${escapeHtml(altitude)}</b></div><div><span>SPEED</span><b>${escapeHtml(speed)}</b></div><div><span>DESTINATION</span><b>${escapeHtml(arrival)}</b></div></div><p class="nnfl-tracker-note">${position ? `Last public receiver update: ${escapeHtml(seen)}. This stays inside NexusNova Travel.` : 'No position was returned from the public receiver network. Try again shortly or use another flight number.'}</p></section>`;
}

async function trackWorldwideFlight(root, flight) {
  const state = root.querySelector('[data-nnfl-state]');
  const box = root.querySelector('[data-nnfl-results]');
  root.__nnflTrackingFlight = flight;
  root.querySelector('[data-nnfl-title]').textContent = 'Live flight tracker';
  state.textContent = `Searching keyless public ADS-B data for ${flight}…`;
  box.innerHTML = trackerPanel(flight);
  try {
    const call = httpsCallable(functions, 'trackWorldwideFlight');
    const response = await timeout(call({ flight }), 12_000);
    const data = response?.data || {};
    if (!data.ok || !data.position) {
      state.textContent = data.message || `No public live signal found for ${flight}.`;
      box.innerHTML = trackerPanel(flight, null, state.textContent);
      return;
    }
    state.textContent = `Live public ADS-B position received for ${flight}.`;
    box.innerHTML = trackerPanel(flight, data, `Live public ADS-B signal · ${data.aircraft || flight}`);
  } catch (error) {
    state.textContent = `Live tracker unavailable — ${errorText(error)}`;
    box.innerHTML = trackerPanel(flight, null, state.textContent);
  }
}

async function refreshFlightComparison(root) {
  const state = root.querySelector('[data-nnfl-state]');
  const refresh = root.querySelector('[data-nnfl-refresh]');
  const { origin, destination } = routeData(root);
  const adults = Number(root.querySelector('[data-nnfl-adults]').value) || 1;
  const children = Number(root.querySelector('[data-nnfl-children]').value) || 0;
  const cabin = root.querySelector('[data-nnfl-cabin]').value || 'economy';
  const departureDate = futureDate();
  if (adults + children > 9) {
    state.textContent = 'Airline comparison allows up to 9 travellers at one time. Reduce Adults + Children to continue.';
    return;
  }
  refresh.disabled = true;
  refresh.textContent = 'Checking live…';
  state.textContent = 'Checking approved secure flight providers…';
  try {
    await timeout(requireFirebaseUser(), 5_000);
    const call = httpsCallable(functions, 'searchWorldwideFlights');
    const response = await timeout(call({ origin, destination, departureDate, adults, children, cabin, currency: 'PKR' }));
    const data = response?.data || {};
    const liveOffers = Array.isArray(data.offers) ? data.offers.filter(item => item?.live === true) : [];
    if (!data.ok || !liveOffers.length) {
      root.__nnflLiveOffers = [];
      state.textContent = data.message || 'No live fares returned. Planning comparison remains clearly marked.';
    } else {
      root.__nnflLiveOffers = liveOffers;
      state.textContent = `${liveOffers.length} live fare${liveOffers.length === 1 ? '' : 's'} returned from approved provider${liveOffers.length === 1 ? '' : 's'}. Booking is enabled only after a provider booking flow is connected.`;
    }
  } catch (error) {
    root.__nnflLiveOffers = [];
    state.textContent = `Live fare search unavailable — planning comparison kept (${errorText(error)}).`;
  } finally {
    refresh.disabled = false;
    updateSearchButton(root, 'flights');
    paint(root, 'flights');
  }
}

function paint(root, mode = 'flights') {
  const pakistanMode = root.dataset.nnflPakistanMode === 'true';
  const adults = Number(root.querySelector('[data-nnfl-adults]').value) || 1;
  const children = Number(root.querySelector('[data-nnfl-children]').value) || 0;
  const cabin = root.querySelector('[data-nnfl-cabin]').value;
  root.querySelector('[data-nnfl-travellers]').textContent = `${adults} adult${adults === 1 ? '' : 's'} · ${children} child${children === 1 ? '' : 'ren'}`;
  root.querySelector('[data-nnfl-refresh]').disabled = adults + children > 9;
  const box = root.querySelector('[data-nnfl-results]');
  const premium = root.dataset.nnflPremium || '';
  const title = root.querySelector('[data-nnfl-title]');
  updateSearchButton(root, mode);
  if (premium === 'calendar') {
    title.textContent = '7-day Fare Calendar';
    box.innerHTML = '<div class="nnfl-fare-calendar">' + [0,1,2,3,4,5,6].map((day) => '<button type="button" data-nnfl-calendar-day="' + day + '"><small>' + (18 + day) + ' SEP</small><strong>' + money(36450 + (day * 1150 % 5100)) + '</strong><span>' + (day === 2 ? 'LOWEST' : 'COMPARE') + '</span></button>').join('') + '</div><p class="nnfl-premium-note">Planning comparison only. Live price alert watches an approved provider when connected.</p>';
  } else if (premium === 'rescue') {
    title.textContent = 'Disruption Rescue';
    box.innerHTML = '<div class="nnfl-rescue"><strong>Flight delayed or cancelled?</strong><span>Compare the next safe way to reach your destination.</span><button type="button">FASTEST FLIGHT · 3h 20m</button><button type="button">OVERNIGHT BUS · 16h 30m</button><button type="button">RAIL + TRANSFER · 18h 10m</button><small>Live disruption options appear only after provider confirmation.</small></div>';
  } else if (premium === 'preference') {
    title.textContent = 'Travel Preference';
    box.innerHTML = '<div class="nnfl-preference"><small>CHOOSE BEFORE BOOKING</small><div><button type="button">WINDOW SEAT</button><button type="button">AISLE SEAT</button><button type="button">LOWER BERTH</button><button type="button">FAMILY ROOM</button></div><p>Preference is saved with your Trip Pass and sent only to an approved booking provider.</p></div>';
  } else if (mode === 'hotels') {
    title.textContent = 'Hotel comparison';
    const hotels = [
      ['Margalla Grand','4.7 ★ · 1.2 km · family room','PKR 18,200 / night','Margalla Grand Hotel Islamabad'],
      ['Centaurus Suites','4.6 ★ · 2.4 km · breakfast','PKR 16,900 / night','Centaurus Suites Islamabad'],
      ['Serena Islamabad','4.8 ★ · 3.6 km · premium','PKR 31,500 / night','Islamabad Serena Hotel']
    ];
    box.innerHTML = hotels.map((hotel, index) => `<article class="nnfl-hotel"><img src="${HOTEL_IMAGES[index]}" alt="${escapeHtml(hotel[0])} hotel photo" referrerpolicy="no-referrer"><div><strong>${escapeHtml(hotel[0])}</strong><span>${escapeHtml(hotel[1])}</span><small>${escapeHtml(hotel[2])}</small></div><button type="button" data-nnfl-route="${escapeHtml(hotel[3])}">ONE-TAP ROUTE</button></article>`).join('');
  } else if (mode === 'trip') {
    title.textContent = 'Trip plan';
    const saved = tripStore();
    const savedClass = action => saved[action] ? ' is-saved' : '';
    box.innerHTML = `<section class="nnfl-trip-center">
      <div class="nnfl-trip-budget"><div><small>SMART FAMILY BUDGET</small><strong>Flight + stay + transfers</strong></div><span>PKR 149,700<br>estimated total</span></div>
      <button type="button" class="nnfl-trip-action${saved.trip ? ' is-saved' : ''}" data-nnfl-trip-action="trip"><strong>MULTI-CITY / MY TRIPS</strong><span>${saved.trip ? 'Saved offline' : 'Add next city + save plan'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.priceAlert ? ' is-saved' : ''}" data-nnfl-trip-action="priceAlert"><strong>PRICE ALERT</strong><span>${saved.priceAlert ? 'Alert saved' : 'Watch this fare'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.delayAlert ? ' is-saved' : ''}" data-nnfl-trip-action="delayAlert"><strong>CONNECTION GUARD</strong><span>${saved.delayAlert ? 'Guard saved' : 'Delay + missed-connection rescue'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.offlinePass ? ' is-saved' : ''}" data-nnfl-trip-action="offlinePass"><strong>TRAVEL WALLET</strong><span>${saved.offlinePass ? 'Pass ready offline' : 'Tickets + PNR + documents'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.hotelCompare ? ' is-saved' : ''}" data-nnfl-trip-action="hotelCompare"><strong>HOTEL COMPARE</strong><span>${saved.hotelCompare ? 'Compare saved' : 'Photos, distance, rooms'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.checklist ? ' is-saved' : ''}" data-nnfl-trip-action="checklist"><strong>VISA CHECKLIST</strong><span>${saved.checklist ? 'Checklist saved' : 'Passport · visa · baggage'}</span></button>
      <p class="nnfl-trip-note">Live price and delay alerts activate only after an approved provider is connected. No fake alerts.</p>
    </section>`;
  } else {
    const liveOffers = mode === 'flights' ? (root.__nnflLiveOffers || []) : [];
    title.textContent = liveOffers.length ? 'Live family comparison' : `${mode === 'flights' ? 'Family comparison' : mode === 'buses' ? 'Bus comparison' : 'Rail comparison'}`;
    box.innerHTML = liveOffers.length
      ? renderLiveOffers(liveOffers)
      : offers(adults, children, cabin).map((offer, index) => `<article class="nnfl-fare"><div class="nnfl-fare-mark">${offer[0]}</div><div><small>${offer[1]}</small><strong>${offer[2]}</strong><em>${offer[3]}</em></div><div><b>${money(offer[4])}</b><button type="button" class="nn-fare-book" data-nnfl-book="fare-${index}">SELECT & BOOK</button></div></article>`).join('');
  }
  box.querySelectorAll('[data-nnfl-book]').forEach(button => button.addEventListener('click', () => {
    root.querySelector('[data-nnfl-state]').textContent = 'Booking handoff is reserved for an approved live provider. No fake ticket or payment was created.';
  }));
  box.querySelectorAll('[data-nnfl-route]').forEach(button => button.addEventListener('click', () => {
    const destination = button.dataset.nnflRoute || '';
    root.querySelector('[data-nnfl-state]').textContent = openRouteInNovaBrowser(destination)
      ? 'Route opened inside Nova Browser.'
      : 'Nova Browser bridge is unavailable in this web preview.';
  }));
  box.querySelectorAll('[data-nnfl-trip-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.nnflTripAction || '';
    const saved = saveTripAction(action);
    root.querySelector('[data-nnfl-state]').textContent = saved
      ? (action === 'delayAlert' || action === 'priceAlert' ? 'Saved on this device. Live provider alert activates when connected.' : 'Saved for offline access on this device.')
      : 'Could not save on this device.';
    paint(root, 'trip');
  }));
  box.querySelectorAll('[data-nnfl-brand]').forEach(button => button.addEventListener('click', () => openInNovaBrowser()));
}

export const fareLensRenderers = {
  travel: () => {
    styles();
    const root = createRoot();
    let active = 'flights';
    root.querySelectorAll('[data-nnfl-brand]').forEach(button => button.addEventListener('click', () => {
      if (!openInNovaBrowser()) root.querySelector('[data-nnfl-state]').textContent = 'Nova Browser bridge is unavailable in this web preview.';
    }));
    root.querySelectorAll('[data-nnfl-tab]').forEach(button => button.addEventListener('click', () => {
      root.dataset.nnflPremium = '';
      root.querySelectorAll('[data-nnfl-premium]').forEach(item => item.classList.remove('is-active'));
      active = button.dataset.nnflTab;
      root.querySelectorAll('[data-nnfl-tab]').forEach(tab => tab.classList.toggle('is-active', tab === button));
      paint(root, active);
    }));
    root.querySelector('[data-nnfl-refresh]').addEventListener('click', () => {
      if (active === 'flights') return refreshFlightComparison(root);
      const labels = { buses: 'Bus', trains: 'Rail', hotels: 'Hotel', trip: 'Trip' };
      root.querySelector('[data-nnfl-state]').textContent = `${labels[active] || 'Travel'} comparison refreshed for the selected route.`;
      paint(root, active);
    });
    root.querySelectorAll('[data-nnfl-edit-route]').forEach(button => button.addEventListener('click', () => openCityPicker(root, button.dataset.nnflEditRoute)));
    root.querySelector('[data-nnfl-close-city]').addEventListener('click', () => { root.querySelector('[data-nnfl-city-picker]').hidden = true; });
    root.querySelector('[data-nnfl-city-query]').addEventListener('input', () => paintCityChoices(root));
    root.querySelector('[data-nnfl-city-list]').addEventListener('click', event => {
      const choice = event.target.closest('[data-nnfl-city-choice]');
      if (!choice) return;
      const picker = root.querySelector('[data-nnfl-city-picker]');
      const side = picker.dataset.nnflCitySide === 'origin' ? 'origin' : 'destination';
      renderRoute(root, side, { code: choice.dataset.code || 'CITY', name: choice.dataset.name || 'City' });
      picker.hidden = true;
      root.__nnflLiveOffers = [];
      root.querySelector('[data-nnfl-state]').textContent = 'Route changed. Tap SEARCH FLIGHTS for live approved-provider fares.';
      paint(root, active);
    });
    root.querySelectorAll('[data-nnfl-premium]').forEach(button => button.addEventListener('click', () => {
      root.dataset.nnflPremium = button.dataset.nnflPremium || '';
      root.querySelectorAll('[data-nnfl-premium]').forEach(item => item.classList.toggle('is-active', item === button));
      paint(root, active);
    }));
    root.querySelector('[data-nnfl-pak-mode]').addEventListener('click', event => {
      const enabled = root.dataset.nnflPakistanMode !== 'true';
      root.dataset.nnflPakistanMode = String(enabled);
      event.currentTarget.classList.toggle('is-active', enabled);
      event.currentTarget.innerHTML = enabled ? '<i class="nnfl-pak-flag" aria-hidden="true"></i><span>Pakistan On</span>' : '<i class="nnfl-pak-flag" aria-hidden="true"></i><span>Pakistan</span>';
      root.querySelector('[data-nnfl-state]').textContent = enabled
        ? 'Pakistan Mode on — local flight, rail, bus and hotel comparison. Live inventory appears only from approved providers.'
        : 'Worldwide comparison mode on.';
      paint(root, active);
    });
    root.querySelector('[data-nnfl-track-live]').addEventListener('click', () => {
      const flight = cleanFlightNumber(root.querySelector('[data-nnfl-flight-number]').value);
      if (!flight) {
        root.querySelector('[data-nnfl-state]').textContent = 'Choose or type any worldwide flight number, for example PK-301, EK-600 or QR-610.';
        return;
      }
      trackWorldwideFlight(root, flight);
    });
    root.querySelector('[data-nnfl-swap]').addEventListener('click', () => {
      const current = routeData(root);
      const originCode = root.querySelector('[data-nnfl-origin-code]').textContent;
      const destinationCode = root.querySelector('[data-nnfl-destination-code]').textContent;
      renderRoute(root, 'origin', { code: destinationCode, name: current.destination });
      renderRoute(root, 'destination', { code: originCode, name: current.origin });
      root.__nnflLiveOffers = [];
      root.querySelector('[data-nnfl-state]').textContent = 'Route swapped. Tap SEARCH FLIGHTS when ready.';
      paint(root, active);
    });
    paint(root, active);
    return root;
  }
};
