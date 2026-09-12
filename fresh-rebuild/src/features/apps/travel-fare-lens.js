import { escapeHtml } from '../../core/local-store.js';

const WEBSITE_URL = 'https://nexusnovatools.com/';
const TRIP_STORE_KEY = 'nexusnova_travel_trip_center_v1';
const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80'
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

function openLiveFlightStatus(flightNumber) {
  const flight = String(flightNumber || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z0-9-]{2,10}$/.test(flight)) return false;
  return openInNovaBrowser('https://www.google.com/search?q=' + encodeURIComponent(flight + ' live flight status'));
}

function money(amount) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
}

function createRoot() {
  const root = document.createElement('section');
  root.className = 'nn-fare-lens';
  root.dataset.nnFareLens = 'true';
  root.innerHTML = `
    <div class="nnfl-top">
      <button type="button" class="nnfl-brand" data-nnfl-brand aria-label="Open NexusNova Tools in Nova Browser">
        NEXUSNOVA <span>TOOLS</span><small>nexusnovatools.com</small>
      </button>
      <button type="button" class="nnfl-route-link" data-nnfl-brand>OPEN IN NOVA BROWSER ↗</button>
    </div>
    <div class="nnfl-route">
      <div><small>FROM</small><strong>KHI</strong><span>Karachi</span></div>
      <button type="button" data-nnfl-swap aria-label="Swap route">→</button>
      <div><small>TO</small><strong>ISB</strong><span>Islamabad</span></div>
      <p><span data-nnfl-date>18 Sep</span><span>•</span><span data-nnfl-travellers>2 adults · 1 child</span></p>
    </div>
    <nav class="nnfl-tabs" aria-label="Travel mode">
      <button type="button" class="is-active" data-nnfl-tab="flights">Flights</button>
      <button type="button" data-nnfl-tab="buses">Buses</button>
      <button type="button" data-nnfl-tab="trains">Trains</button>
      <button type="button" data-nnfl-tab="hotels">Hotels</button>
      <button type="button" data-nnfl-tab="trip">Trip</button>
    </nav>
    <div class="nnfl-controls">
      <label>Adults<select data-nnfl-adults><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option></select></label>
      <label>Children<select data-nnfl-children><option value="0">0</option><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option></select></label>
      <label>Cabin<select data-nnfl-cabin><option value="economy">Economy</option><option value="business">Business</option></select></label>
      <button type="button" data-nnfl-refresh>Refresh comparison</button>
    </div>
    <div class="nnfl-status"><span>FARE LENS</span><strong data-nnfl-title>Family comparison</strong><em data-nnfl-state>Planning fares — live provider connection will replace these only when approved.</em></div>
    <div class="nnfl-live-track"><label>LIVE FLIGHT TRACKER<input data-nnfl-flight-number inputmode="text" maxlength="10" placeholder="e.g. PK-301"></label><button type="button" data-nnfl-track-live>TRACK LIVE</button></div>
    <div class="nnfl-results" data-nnfl-results></div>
    <footer><button type="button" data-nnfl-brand>www.nexusnovatools.com</button><span>Always opens inside Nova Browser</span></footer>
  `;
  return root;
}

function styles() {
  if (document.getElementById('nn-fare-lens-style')) return;
  const style = document.createElement('style');
  style.id = 'nn-fare-lens-style';
  style.textContent = `
    [data-nn-fare-lens="true"]{height:calc(100dvh - 118px);min-height:390px;max-height:820px;overflow:hidden!important;background:#fff;color:#111827;padding:env(safe-area-inset-top) 14px 0;display:grid;grid-template-rows:auto auto auto auto auto minmax(0,1fr) auto;gap:0;font-family:Inter,system-ui,sans-serif}
    [data-nn-fare-lens="true"] *{box-sizing:border-box}
    [data-nn-fare-lens="true"] button,[data-nn-fare-lens="true"] select{font:inherit}
    .nnfl-top{display:flex;align-items:center;justify-content:space-between;min-height:42px;border-bottom:1px solid #e5eaf0}
    .nnfl-brand,.nnfl-route-link,.nnfl-tabs button,.nnfl-results button, .nnfl-controls button, .nnfl-route button, .nn-fare-book, .nnfl-fallback-link{border:0;background:transparent;color:inherit;cursor:pointer}
    .nnfl-brand{padding:0;text-align:left;font-size:11px;font-weight:900;letter-spacing:.08em}.nnfl-brand span{color:#1769ff}.nnfl-brand small{display:block;color:#748196;font-size:8px;letter-spacing:.04em;margin-top:2px}.nnfl-route-link{font-size:8px;color:#1769ff;font-weight:800}
    .nnfl-route{display:grid;grid-template-columns:1fr 32px 1fr;align-items:center;padding:10px 0 7px;border-bottom:1px solid #e5eaf0}.nnfl-route>div:last-of-type{text-align:right}.nnfl-route small,.nnfl-route span{display:block;color:#748196;font-size:10px}.nnfl-route strong{display:block;font-size:28px;line-height:1;margin:3px 0}.nnfl-route>button{width:32px;height:32px;color:#1769ff;font-size:20px}.nnfl-route p{grid-column:1/-1;display:flex;gap:7px;margin:9px 0 0;font-size:10px;color:#748196}
    .nnfl-tabs{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid #e5eaf0}.nnfl-tabs button{padding:10px 2px 8px;border-bottom:2px solid transparent;color:#748196;font-size:10px}.nnfl-tabs button.is-active{color:#1769ff;border-color:#1769ff;font-weight:800}
    .nnfl-controls{display:grid;grid-template-columns:repeat(3,1fr) 1.45fr;gap:6px;align-items:end;padding:8px 0;border-bottom:1px solid #e5eaf0}.nnfl-controls label{display:grid;gap:3px;font-size:8px;color:#748196;text-transform:uppercase;letter-spacing:.05em}.nnfl-controls select{width:100%;height:28px;border:0;border-bottom:1px solid #cfd8e3;background:#fff;color:#111827;font-size:10px}.nnfl-controls button{height:28px;background:#1769ff;color:#fff;border-radius:8px;font-size:9px;font-weight:800}
    .nnfl-status{display:grid;grid-template-columns:auto 1fr;gap:5px 9px;padding:9px 0 6px}.nnfl-live-track{display:grid;grid-template-columns:1fr 106px;gap:7px;align-items:end;border-bottom:1px solid #e5eaf0;padding:0 0 7px}.nnfl-live-track label{display:grid;gap:3px;color:#748196;font-size:8px;letter-spacing:.05em}.nnfl-live-track input{height:27px;border:0;border-bottom:1px solid #cfd8e3;background:#fff;padding:0;color:#111827;font-size:10px}.nnfl-live-track button{height:27px;border:0;border-radius:8px;background:#087f5b;color:#fff;font-size:9px;font-weight:800}.nnfl-status span{font-size:8px;color:#1769ff;font-weight:900;letter-spacing:.08em}.nnfl-status strong{font-size:12px}.nnfl-status em{grid-column:1/-1;font-size:9px;color:#748196;font-style:normal}
    .nnfl-results{min-height:0;overflow:hidden}.nnfl-fare{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:58px;border-bottom:1px solid #e5eaf0}.nnfl-fare-mark{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#eef4ff;color:#1769ff;font-size:11px;font-weight:900}.nnfl-fare:nth-child(2) .nnfl-fare-mark{background:#fff6df;color:#9a6308}.nnfl-fare:nth-child(3) .nnfl-fare-mark{background:#eaf8f2;color:#087f5b}.nnfl-fare small,.nnfl-fare em{display:block;color:#748196;font-size:8px;font-style:normal}.nnfl-fare strong{display:block;font-size:11px;margin:2px 0}.nnfl-fare>div:last-child{text-align:right}.nnfl-fare b{display:block;font-size:12px}.nn-fare-book{color:#1769ff;font-size:9px;font-weight:800;margin-top:4px}
    .nnfl-empty{display:grid;place-items:center;height:100%;text-align:center;color:#748196;font-size:11px;padding:20px}.nnfl-trip-center{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid #e5eaf0}.nnfl-trip-budget{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #e5eaf0}.nnfl-trip-budget small,.nnfl-trip-budget span{display:block;color:#748196;font-size:9px}.nnfl-trip-budget strong{font-size:15px}.nnfl-trip-action{min-height:50px;padding:8px 5px 8px 0;text-align:left;border:0;border-bottom:1px solid #e5eaf0;background:#fff;color:#111827}.nnfl-trip-action:nth-of-type(even){padding-left:9px;border-left:1px solid #e5eaf0}.nnfl-trip-action strong,.nnfl-trip-action span{display:block}.nnfl-trip-action strong{font-size:10px}.nnfl-trip-action span{font-size:8px;color:#748196;margin-top:3px}.nnfl-trip-action.is-saved strong{color:#087f5b}.nnfl-trip-note{grid-column:1/-1;margin:0;padding:8px 0;color:#748196;font-size:8px}.nnfl-hotel{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:8px;min-height:66px;align-items:center;border-bottom:1px solid #e5eaf0}.nnfl-hotel img{width:62px;height:48px;object-fit:cover;border-radius:8px;background:#eef4ff}.nnfl-hotel strong{font-size:11px}.nnfl-hotel span,.nnfl-hotel small{display:block;font-size:9px;color:#748196;margin-top:3px}.nnfl-hotel button{border:0;background:#1769ff;color:#fff;border-radius:8px;padding:8px;font-size:9px;font-weight:800}
    [data-nn-fare-lens="true"] footer{display:flex;justify-content:space-between;align-items:center;min-height:30px;border-top:1px solid #e5eaf0}.nnfl-fallback-link,[data-nn-fare-lens="true"] footer button{font-size:8px;color:#1769ff;font-weight:800}.nnfl-fallback-link{padding:0}.nnfl-fallback-link a{color:inherit}.nnfl-fallback-link{display:none}
    @media(max-height:650px){[data-nn-fare-lens="true"]{height:calc(100dvh - 104px)}.nnfl-route{padding:6px 0}.nnfl-route strong{font-size:23px}.nnfl-tabs button{padding:7px 1px}.nnfl-controls{padding:5px 0}.nnfl-fare{min-height:48px}.nnfl-status{padding:5px 0}}
  `;
  document.head.appendChild(style);
}

function offers(adults, children, cabin) {
  const multiplier = cabin === 'business' ? 2.45 : 1;
  const adult = 14900 * adults * multiplier;
  const child = 8650 * children * multiplier;
  const base = adult + child;
  return [
    ['✦', 'BEST OVERALL', 'Non-stop · 1h 55m', 'Bags + flexible change', Math.round(base * 1.11)],
    ['₨', 'LOWEST', '1 stop · 4h 10m', 'Cabin baggage', Math.round(base)],
    ['◷', 'FASTEST', 'Non-stop · 1h 45m', 'Checked bag', Math.round(base * 1.23)]
  ];
}

function paint(root, mode = 'flights') {
  const adults = Number(root.querySelector('[data-nnfl-adults]').value) || 1;
  const children = Number(root.querySelector('[data-nnfl-children]').value) || 0;
  const cabin = root.querySelector('[data-nnfl-cabin]').value;
  root.querySelector('[data-nnfl-travellers]').textContent = `${adults} adult${adults === 1 ? '' : 's'} · ${children} child${children === 1 ? '' : 'ren'}`;
  const box = root.querySelector('[data-nnfl-results]');
  const title = root.querySelector('[data-nnfl-title]');
  if (mode === 'hotels') {
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
      <button type="button" class="nnfl-trip-action${saved.trip ? ' is-saved' : ''}" data-nnfl-trip-action="trip"><strong>MY TRIPS</strong><span>${saved.trip ? 'Saved offline' : 'Save this journey'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.priceAlert ? ' is-saved' : ''}" data-nnfl-trip-action="priceAlert"><strong>PRICE ALERT</strong><span>${saved.priceAlert ? 'Alert saved' : 'Watch this fare'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.delayAlert ? ' is-saved' : ''}" data-nnfl-trip-action="delayAlert"><strong>FLIGHT DELAY ALERT</strong><span>${saved.delayAlert ? 'Tracking saved' : 'Requires live provider'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.offlinePass ? ' is-saved' : ''}" data-nnfl-trip-action="offlinePass"><strong>OFFLINE TRIP PASS</strong><span>${saved.offlinePass ? 'Ready on this device' : 'Save key trip details'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.hotelCompare ? ' is-saved' : ''}" data-nnfl-trip-action="hotelCompare"><strong>HOTEL COMPARE</strong><span>${saved.hotelCompare ? 'Compare saved' : 'Photos, distance, rooms'}</span></button>
      <button type="button" class="nnfl-trip-action${saved.checklist ? ' is-saved' : ''}" data-nnfl-trip-action="checklist"><strong>VISA CHECKLIST</strong><span>${saved.checklist ? 'Checklist saved' : 'Passport · visa · baggage'}</span></button>
      <p class="nnfl-trip-note">Live price and delay alerts activate only after an approved provider is connected. No fake alerts.</p>
    </section>`;
  } else {
    title.textContent = `${mode === 'flights' ? 'Family comparison' : mode === 'buses' ? 'Bus comparison' : 'Rail comparison'}`;
    box.innerHTML = offers(adults, children, cabin).map((offer, index) => `<article class="nnfl-fare"><div class="nnfl-fare-mark">${offer[0]}</div><div><small>${offer[1]}</small><strong>${offer[2]}</strong><em>${offer[3]}</em></div><div><b>${money(offer[4])}</b><button type="button" class="nn-fare-book" data-nnfl-book="fare-${index}">SELECT & BOOK</button></div></article>`).join('');
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
      active = button.dataset.nnflTab;
      root.querySelectorAll('[data-nnfl-tab]').forEach(tab => tab.classList.toggle('is-active', tab === button));
      paint(root, active);
    }));
    root.querySelector('[data-nnfl-refresh]').addEventListener('click', () => paint(root, active));
    root.querySelector('[data-nnfl-track-live]').addEventListener('click', () => {
      const flight = root.querySelector('[data-nnfl-flight-number]').value;
      root.querySelector('[data-nnfl-state]').textContent = openLiveFlightStatus(flight)
        ? 'Live flight status opened inside Nova Browser.'
        : 'Enter a valid flight number, for example PK-301.';
    });
    root.querySelector('[data-nnfl-swap]').addEventListener('click', () => {
      const cities = root.querySelectorAll('.nnfl-route>div');
      const first = cities[0].innerHTML, second = cities[1].innerHTML;
      cities[0].innerHTML = second; cities[1].innerHTML = first;
      root.querySelector('[data-nnfl-state]').textContent = 'Route swapped. Refresh comparison when ready.';
    });
    paint(root, active);
    return root;
  }
};