import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';
import { renderTravelHotelsPanel } from './travel-hotels.js';

const TRIP_KEY = 'nexusnova_trip_plan_v2';
const functions = getFunctions(firebaseApp, 'us-central1');
const DAY_MS = 86_400_000;
const LIVE_TIMEOUT_MS = 9000;

const CURRENCY_SCALE = Object.freeze({
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  PKR: 279,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 148,
  CNY: 7.2,
  INR: 83,
  TRY: 32
});

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.dataset.nnTravelRoot = '1';
  root.innerHTML = html;
  return root;
}

function futureDate(days = 1) {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

function cleanMoney(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
}

function durationText(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return 'Duration unavailable';
  const h = Math.floor(value / 60);
  const m = value % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function timeText(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function errorText(error) {
  return String(error?.message || error || 'Search failed.')
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '')
    .slice(0, 220);
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded(seed, min, max) {
  const span = Math.max(1, max - min + 1);
  return min + (hashText(seed) % span);
}

function estimateMoney(usd, currency) {
  const scale = CURRENCY_SCALE[currency] || 1;
  return cleanMoney(Math.max(1, usd) * scale, currency);
}

function timeout(promise, ms = LIVE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Live provider timed out.')), ms))
  ]);
}

function bestValueScore(offer, bounds) {
  const price = Number(offer.compareTotal);
  const duration = Number(offer.durationMinutes);
  if (!(price > 0) || !(duration > 0)) return Number.MAX_VALUE;
  const priceRange = Math.max(1, bounds.maxPrice - bounds.minPrice);
  const durationRange = Math.max(1, bounds.maxDuration - bounds.minDuration);
  const priceScore = (price - bounds.minPrice) / priceRange;
  const durationScore = (duration - bounds.minDuration) / durationRange;
  const stopPenalty = Math.max(0, Number(offer.stops) || 0) * 0.08;
  return priceScore * 0.62 + durationScore * 0.38 + stopPenalty;
}

function sortedOffers(offers, mode) {
  const copy = [...offers];
  if (mode === 'fastest') {
    return copy.sort((a, b) => (Number(a.durationMinutes) || Number.MAX_VALUE) - (Number(b.durationMinutes) || Number.MAX_VALUE));
  }
  if (mode === 'best') {
    const prices = copy.map(item => Number(item.compareTotal)).filter(value => value > 0);
    const durations = copy.map(item => Number(item.durationMinutes)).filter(value => value > 0);
    const bounds = {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 1,
      minDuration: durations.length ? Math.min(...durations) : 0,
      maxDuration: durations.length ? Math.max(...durations) : 1
    };
    return copy.sort((a, b) => bestValueScore(a, bounds) - bestValueScore(b, bounds));
  }
  return copy.sort((a, b) => (Number(a.compareTotal) || Number.MAX_VALUE) - (Number(b.compareTotal) || Number.MAX_VALUE));
}

function dayRows(plan) {
  const start = new Date(`${plan.start}T00:00:00`);
  return Array.from({ length: plan.days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const hint = index === 0
      ? 'Arrival, check-in, local orientation and an easy first evening.'
      : index === plan.days - 1
        ? 'Final activities, checkout buffer and return preparation.'
        : index % 3 === 1
          ? 'Main sights, local food and a flexible evening block.'
          : index % 3 === 2
            ? 'Neighbourhood exploration, shopping or a half-day excursion.'
            : 'Culture, local travel and a relaxed meal window.';
    return `<article class="nx-list-card nn-travel-day"><strong>Day ${index + 1} • ${escapeHtml(date.toLocaleDateString())}</strong><p>${escapeHtml(hint)}</p></article>`;
  }).join('');
}

function ensureTravelStyles() {
  if (document.getElementById('nn-travel-premium-style')) return;
  const style = document.createElement('style');
  style.id = 'nn-travel-premium-style';
  style.textContent = `
    [data-nn-travel-root] {
      --nn-travel-border: rgba(148,163,184,.22);
      --nn-travel-glass: rgba(15,23,42,.74);
      --nn-travel-soft: rgba(30,41,59,.58);
      --nn-travel-accent: #60a5fa;
      --nn-travel-accent2: #a78bfa;
    }
    [data-nn-travel-root] .nn-travel-hero {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--nn-travel-border);
      border-radius: 24px;
      padding: 18px;
      background:
        radial-gradient(circle at 12% 0%, rgba(96,165,250,.24), transparent 34%),
        radial-gradient(circle at 92% 12%, rgba(167,139,250,.22), transparent 30%),
        linear-gradient(145deg, rgba(15,23,42,.96), rgba(17,24,39,.82));
      box-shadow: 0 18px 46px rgba(2,6,23,.28);
      margin-bottom: 12px;
    }
    [data-nn-travel-root] .nn-travel-hero h2 {
      margin: 4px 0 6px;
      font-size: clamp(1.35rem, 5vw, 1.9rem);
      letter-spacing: -.03em;
    }
    [data-nn-travel-root] .nn-travel-hero p { margin: 0; }
    [data-nn-travel-root] .nn-travel-pills {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 7px;
      margin-top: 14px;
    }
    [data-nn-travel-root] .nn-travel-pill {
      min-width: 0;
      padding: 9px 6px;
      border-radius: 13px;
      border: 1px solid var(--nn-travel-border);
      background: rgba(15,23,42,.52);
      text-align: center;
      font-size: .73rem;
      font-weight: 750;
      letter-spacing: .02em;
    }
    [data-nn-travel-root] .nn-travel-card {
      border: 1px solid var(--nn-travel-border);
      border-radius: 22px;
      background: linear-gradient(155deg, rgba(15,23,42,.84), rgba(15,23,42,.62));
      box-shadow: 0 12px 34px rgba(2,6,23,.18);
      backdrop-filter: blur(16px);
    }
    [data-nn-travel-root] .nn-travel-card .nx-primary {
      min-height: 46px;
      border-radius: 14px;
      font-weight: 800;
      letter-spacing: .02em;
    }
    [data-nn-travel-root] .nn-travel-card input,
    [data-nn-travel-root] .nn-travel-card select,
    [data-nn-travel-root] .nn-travel-card textarea {
      border-radius: 13px;
    }
    [data-nn-travel-root] .nn-travel-mode-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin: 8px 0 12px;
    }
    [data-nn-travel-root] .nn-travel-mode-strip .nx-badge {
      border: 1px solid var(--nn-travel-border);
    }
    [data-nn-travel-root] .nn-estimate-card {
      border: 1px solid rgba(96,165,250,.24);
      background: linear-gradient(150deg, rgba(30,41,59,.82), rgba(15,23,42,.72));
    }
    [data-nn-travel-root] .nn-live-card {
      border: 1px solid rgba(52,211,153,.3);
    }
    [data-nn-travel-root] .nn-travel-note {
      padding: 10px 12px;
      border-radius: 13px;
      border: 1px solid var(--nn-travel-border);
      background: rgba(15,23,42,.44);
    }
    [data-nn-travel-root] .nn-travel-day { position: relative; overflow: hidden; }
    [data-nn-travel-root] .nn-travel-day::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: linear-gradient(180deg, var(--nn-travel-accent), var(--nn-travel-accent2));
    }
    [data-nn-travel-root] button:disabled { opacity: .62; cursor: wait; }
    @media (max-width: 520px) {
      [data-nn-travel-root] .nn-travel-pills { grid-template-columns: repeat(2, minmax(0,1fr)); }
      [data-nn-travel-root] .nn-travel-hero { border-radius: 20px; padding: 15px; }
      [data-nn-travel-root] .nn-travel-card { border-radius: 18px; }
    }
  `;
  document.head.appendChild(style);
}

function flightState(root) {
  if (!root.__nnFlightState) {
    root.__nnFlightState = { offers: [], sort: 'cheapest', mode: 'estimate' };
  }
  return root.__nnFlightState;
}

function getFlightControls(root) {
  return {
    origin: root.querySelector('[data-flight-origin]'),
    destination: root.querySelector('[data-flight-destination]'),
    departure: root.querySelector('[data-flight-departure]'),
    returnDate: root.querySelector('[data-flight-return]'),
    adults: root.querySelector('[data-flight-adults]'),
    cabin: root.querySelector('[data-flight-cabin]'),
    currency: root.querySelector('[data-flight-currency]'),
    search: root.querySelector('[data-flight-search]'),
    status: root.querySelector('[data-flight-status]'),
    summary: root.querySelector('[data-flight-summary]'),
    route: root.querySelector('[data-flight-route]'),
    count: root.querySelector('[data-flight-count]'),
    provider: root.querySelector('[data-flight-provider-note]'),
    results: root.querySelector('[data-flight-results]')
  };
}

function flightEstimateOffers(query) {
  const baseSeed = `${query.from}|${query.to}|${query.departure}|${query.returnDate}|${query.adults}|${query.cabin}`;
  const cabinFactor = { economy: 1, premium_economy: 1.55, business: 2.85, first: 4.4 }[query.cabin] || 1;
  const roundFactor = query.returnDate ? 1.72 : 1;
  const routeBand = seeded(`${baseSeed}|distance`, 145, 780);
  const baseUsd = routeBand * cabinFactor * roundFactor * Math.max(1, query.adults);
  const labels = [
    ['Value route', 0.88, 1],
    ['Balanced route', 1.03, 0],
    ['Flexible route', 1.19, 1]
  ];

  return labels.map(([label, factor, defaultStops], index) => {
    const duration = seeded(`${baseSeed}|duration|${index}`, 110, 760);
    const stops = duration < 260 ? Math.min(defaultStops, 1) : defaultStops;
    const usd = baseUsd * factor * (1 + seeded(`${baseSeed}|fare|${index}`, 0, 12) / 100);
    return {
      estimate: true,
      provider: 'NexusNova Estimate',
      carriers: [label],
      total: usd * (CURRENCY_SCALE[query.currency] || 1),
      compareTotal: usd * (CURRENCY_SCALE[query.currency] || 1),
      currency: query.currency,
      compareCurrency: query.currency,
      durationMinutes: duration,
      stops,
      originLabel: query.from,
      destinationLabel: query.to
    };
  });
}

function paintFlightOffers(root) {
  const controls = getFlightControls(root);
  const state = flightState(root);
  if (!controls.results) return;
  const offers = sortedOffers(state.offers, state.sort);

  root.querySelectorAll('[data-flight-sort]').forEach(button => {
    button.classList.toggle('nx-primary', button.dataset.flightSort === state.sort);
  });

  controls.results.innerHTML = offers.length ? offers.map((offer, index) => {
    const estimated = offer.estimate === true;
    const carriers = Array.isArray(offer.carriers) && offer.carriers.length ? offer.carriers.join(' + ') : estimated ? 'Planning option' : 'Carrier';
    const price = cleanMoney(offer.total ?? offer.compareTotal, offer.currency || offer.compareCurrency || 'USD');
    const comparePrice = !estimated && offer.fxConverted && Number(offer.compareTotal) > 0
      ? `<p class="nx-tool-meta">≈ ${escapeHtml(cleanMoney(offer.compareTotal, offer.compareCurrency))} live FX comparison</p>`
      : '';
    const rank = index === 0
      ? `<span class="nx-badge good">${state.sort === 'fastest' ? 'FASTEST' : state.sort === 'best' ? 'BEST VALUE' : 'LOWEST'}</span>`
      : `<span class="nx-badge">${estimated ? 'ESTIMATE' : escapeHtml(offer.provider || 'LIVE')}</span>`;
    const timing = estimated
      ? `<div><span>Route time</span><strong>${escapeHtml(durationText(offer.durationMinutes))}</strong></div>
         <div><span>Stops</span><strong>${Number(offer.stops) === 0 ? 'Direct-style' : `${Number(offer.stops) || 0} stop`}</strong></div>
         <div><span>Type</span><strong>Planning estimate</strong></div>`
      : `<div><span>Depart</span><strong>${escapeHtml(timeText(offer.departingAt))}</strong></div>
         <div><span>Arrive</span><strong>${escapeHtml(timeText(offer.arrivingAt))}</strong></div>
         <div><span>Duration</span><strong>${escapeHtml(durationText(offer.durationMinutes))}</strong></div>`;

    return `
      <article class="nx-list-card ${estimated ? 'nn-estimate-card' : 'nn-live-card'}">
        <div class="nx-list-card__head">
          <div><strong>${escapeHtml(carriers)}</strong><p class="nx-tool-meta">${estimated ? 'Indicative route model' : `${escapeHtml(offer.provider || 'Live provider')} • ${offer.stops === 0 ? 'Direct' : `${offer.stops} stop${offer.stops === 1 ? '' : 's'}`}`}</p></div>
          ${rank}
        </div>
        <div class="nx-summary-grid">${timing}</div>
        <div class="nx-list-card__head" style="margin-top:10px">
          <div><span class="nx-tool-meta">${estimated ? 'Indicative total — not a bookable fare' : 'Live provider total'}</span><strong style="display:block;font-size:1.25rem">${escapeHtml(price)}</strong>${comparePrice}</div>
          <span class="nx-badge">${estimated ? 'VERIFY BEFORE BOOKING' : 'LIVE'}</span>
        </div>
        <p class="nx-tool-meta">${escapeHtml(offer.originLabel || offer.originCode || '')} → ${escapeHtml(offer.destinationLabel || offer.destinationCode || '')}${estimated ? ' • No live inventory connection used for this estimate.' : ''}</p>
      </article>`;
  }).join('') : '<div class="nx-empty">No result available for this search.</div>';
}

function showFlightEstimate(root, query, reason = '') {
  const controls = getFlightControls(root);
  const state = flightState(root);
  state.offers = flightEstimateOffers(query);
  state.sort = 'cheapest';
  state.mode = 'estimate';

  controls.route.textContent = `${query.from} → ${query.to}`;
  controls.count.textContent = `${state.offers.length} ESTIMATES`;
  controls.provider.textContent = 'Indicative planning estimates only. They are deterministic, free, and do not represent live inventory or a booking quote. Verify with an airline or booking provider before purchase.';
  controls.summary.hidden = false;
  paintFlightOffers(root);
  controls.status.textContent = reason
    ? `Live fare connection unavailable (${reason}). Showing free indicative estimates instead.`
    : 'Free indicative estimates ready. Live provider results will replace them automatically when available.';
}

async function searchFlights(root) {
  const controls = getFlightControls(root);
  const query = {
    from: controls.origin?.value.trim() || '',
    to: controls.destination?.value.trim() || '',
    departure: controls.departure?.value || '',
    returnDate: controls.returnDate?.value || '',
    adults: Number(controls.adults?.value) || 1,
    cabin: controls.cabin?.value || 'economy',
    currency: controls.currency?.value || 'PKR'
  };

  if (!query.from || !query.to || !query.departure) {
    controls.status.textContent = 'Enter origin, destination and departure date.';
    return;
  }
  if (query.from.toLowerCase() === query.to.toLowerCase()) {
    controls.status.textContent = 'Origin and destination must be different.';
    return;
  }
  if (query.returnDate && query.returnDate < query.departure) {
    controls.status.textContent = 'Return date must be after departure date.';
    return;
  }

  controls.search.disabled = true;
  controls.search.textContent = 'CHECKING LIVE + FREE OPTIONS…';
  showFlightEstimate(root, query);
  controls.status.textContent = 'Free estimate is ready. Checking secure live providers in the background…';

  try {
    await timeout(requireFirebaseUser(), 4500);
    const call = httpsCallable(functions, 'searchWorldwideFlights');
    const response = await timeout(call({
      origin: query.from,
      destination: query.to,
      departureDate: query.departure,
      returnDate: query.returnDate,
      adults: query.adults,
      cabin: query.cabin,
      currency: query.currency
    }));
    const data = response?.data || {};
    const live = data.ok === true && Array.isArray(data.offers)
      ? data.offers.filter(item => item && item.live === true)
      : [];

    if (!live.length) {
      const message = data.message || 'no bookable live offers returned';
      showFlightEstimate(root, query, message);
      return;
    }

    const state = flightState(root);
    state.offers = live;
    state.sort = 'cheapest';
    state.mode = 'live';
    const configured = Object.entries(data.providers || {}).filter(([, value]) => value).map(([name]) => name.toUpperCase());
    const route = Array.isArray(data.routes) && data.routes[0] ? data.routes[0] : null;
    controls.route.textContent = route
      ? `${route.origin?.label || query.from} → ${route.destination?.label || query.to}`
      : `${query.from} → ${query.to}`;
    controls.count.textContent = `${live.length} LIVE OFFER${live.length === 1 ? '' : 'S'}`;
    controls.provider.textContent = `${configured.length ? `Live providers: ${configured.join(' + ')}` : 'Secure live provider'} • Results timestamped ${new Date(data.searchedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    controls.summary.hidden = false;
    paintFlightOffers(root);
    controls.status.textContent = `${live.length} live offer${live.length === 1 ? '' : 's'} returned. Live data has replaced the indicative estimate.`;
  } catch (error) {
    showFlightEstimate(root, query, errorText(error));
    console.warn('[NexusNova Fresh] worldwide travel search:', error);
  } finally {
    controls.search.disabled = false;
    controls.search.textContent = 'SEARCH FARES';
  }
}

function groundEstimate(query) {
  const seed = `${query.from}|${query.to}|${query.date}|${query.passengers}`;
  const distanceBand = seeded(`${seed}|distance`, 80, 980);
  const railMinutes = Math.max(55, Math.round(distanceBand / seeded(`${seed}|rail-speed`, 2, 4) * 1.25));
  const busMinutes = Math.max(80, Math.round(railMinutes * (1.35 + seeded(`${seed}|bus`, 0, 25) / 100)));
  const railUsd = Math.max(9, distanceBand * (0.055 + seeded(`${seed}|rail-price`, 0, 18) / 1000)) * query.passengers;
  const busUsd = Math.max(5, railUsd * (0.48 + seeded(`${seed}|bus-price`, 0, 18) / 100));
  const mixedUsd = Math.max(7, (railUsd + busUsd) * 0.58);
  return [
    { name: 'Rail', price: railUsd, minutes: railMinutes, note: 'Station-to-station planning model' },
    { name: 'Coach / Bus', price: busUsd, minutes: busMinutes, note: 'Budget road-transfer planning model' },
    { name: 'Mixed transfer', price: mixedUsd, minutes: Math.round((railMinutes + busMinutes) / 2), note: 'Rail + local coach planning model' }
  ];
}

function searchGround(root) {
  const from = root.querySelector('[data-ground-origin]')?.value.trim() || '';
  const to = root.querySelector('[data-ground-destination]')?.value.trim() || '';
  const date = root.querySelector('[data-ground-date]')?.value || '';
  const passengers = Math.max(1, Math.min(9, Number(root.querySelector('[data-ground-passengers]')?.value) || 1));
  const currency = root.querySelector('[data-ground-currency]')?.value || 'PKR';
  const status = root.querySelector('[data-ground-status]');
  const results = root.querySelector('[data-ground-results]');

  if (!from || !to || !date) {
    status.textContent = 'Enter origin, destination and travel date.';
    return;
  }
  if (from.toLowerCase() === to.toLowerCase()) {
    status.textContent = 'Origin and destination must be different.';
    return;
  }

  const options = groundEstimate({ from, to, date, passengers });
  results.innerHTML = options.map((item, index) => `
    <article class="nx-list-card nn-estimate-card">
      <div class="nx-list-card__head">
        <div><strong>${escapeHtml(item.name)}</strong><p class="nx-tool-meta">${escapeHtml(item.note)}</p></div>
        <span class="nx-badge ${index === 1 ? 'good' : ''}">${index === 1 ? 'BUDGET' : 'ESTIMATE'}</span>
      </div>
      <div class="nx-summary-grid">
        <div><span>Indicative fare</span><strong>${escapeHtml(estimateMoney(item.price, currency))}</strong></div>
        <div><span>Indicative time</span><strong>${escapeHtml(durationText(item.minutes))}</strong></div>
        <div><span>Travellers</span><strong>${passengers}</strong></div>
      </div>
      <p class="nx-tool-meta">${escapeHtml(from)} → ${escapeHtml(to)} • ${escapeHtml(date)} • Estimate only, not live inventory or a booking quote.</p>
    </article>`).join('');
  status.textContent = 'Free rail / coach planning estimates ready. Verify timetable and final fare with the operator before booking.';
}

function renderPlan(root, plan) {
  const output = root.querySelector('[data-trip-output]');
  if (!output) return;
  if (!plan?.destination || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start) || !(plan.days >= 1)) {
    output.innerHTML = '<div class="nx-empty">No saved trip itinerary.</div>';
    return;
  }
  output.innerHTML = `
    <article class="nx-tool-card nn-travel-card">
      <div class="nx-list-card__head">
        <div><p class="nx-eyebrow">PRIVATE ITINERARY</p><strong>${escapeHtml(plan.destination)} • ${plan.days}-Day Trip Plan</strong></div>
        <span class="nx-badge good">ON DEVICE</span>
      </div>
      ${plan.notes ? `<p class="nn-travel-note">${escapeHtml(plan.notes)}</p>` : ''}
      <div class="nx-stack" style="margin-top:10px">${dayRows(plan)}</div>
      <button class="nx-primary" type="button" data-trip-use-flight>USE DESTINATION IN FARE SEARCH</button>
      <p class="nx-tool-meta">Private planning aid only — not a booking confirmation.</p>
    </article>`;
}

function createTrip(root) {
  const destination = root.querySelector('[data-trip-destination]');
  const start = root.querySelector('[data-trip-start]');
  const days = root.querySelector('[data-trip-days]');
  const notes = root.querySelector('[data-trip-notes]');
  const status = root.querySelector('[data-trip-status]');

  const plan = {
    destination: destination?.value.trim().slice(0, 80) || '',
    start: start?.value || '',
    days: Math.max(1, Math.min(30, Math.floor(Number(days?.value) || 3))),
    notes: notes?.value.trim().slice(0, 500) || '',
    createdAt: Date.now()
  };
  if (!plan.destination || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start)) {
    status.textContent = 'Choose a destination and valid start date.';
    return;
  }
  saveJson(TRIP_KEY, plan);
  status.textContent = 'Private itinerary saved on this device.';
  renderPlan(root, plan);
}

function clearTrip(root) {
  localStorage.removeItem(TRIP_KEY);
  const destination = root.querySelector('[data-trip-destination]');
  const notes = root.querySelector('[data-trip-notes]');
  const days = root.querySelector('[data-trip-days]');
  if (destination) destination.value = '';
  if (notes) notes.value = '';
  if (days) days.value = '3';
  root.querySelector('[data-trip-status]').textContent = 'Saved trip plan cleared.';
  renderPlan(root, null);
}

function useTripInFlight(root) {
  const saved = loadJson(TRIP_KEY, null);
  if (!saved?.destination) return;
  const destination = root.querySelector('[data-flight-destination]');
  const departure = root.querySelector('[data-flight-departure]');
  const returnDate = root.querySelector('[data-flight-return]');
  if (destination) destination.value = saved.destination;
  if (departure && saved.start) departure.value = saved.start;
  if (returnDate && saved.start) returnDate.min = saved.start;
  root.querySelector('[data-flight-origin]')?.focus();
  root.querySelector('[data-flight-status]').textContent = `Destination ${saved.destination} copied into fare search. Enter your origin and search.`;
  root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function installTravelDelegates() {
  if (window.__nnTravelSuiteDelegatesV2) return;
  window.__nnTravelSuiteDelegatesV2 = true;

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    const root = event.target.closest('[data-nn-travel-root]');
    if (!button || !root) return;

    if (button.matches('[data-flight-search]')) {
      event.preventDefault();
      searchFlights(root);
      return;
    }
    if (button.matches('[data-flight-sort]')) {
      event.preventDefault();
      const state = flightState(root);
      state.sort = button.dataset.flightSort || 'cheapest';
      paintFlightOffers(root);
      return;
    }
    if (button.matches('[data-ground-search]')) {
      event.preventDefault();
      searchGround(root);
      return;
    }
    if (button.matches('[data-trip-create]')) {
      event.preventDefault();
      createTrip(root);
      return;
    }
    if (button.matches('[data-trip-clear]')) {
      event.preventDefault();
      clearTrip(root);
      return;
    }
    if (button.matches('[data-trip-use-flight]')) {
      event.preventDefault();
      useTripInFlight(root);
    }
  });

  document.addEventListener('change', event => {
    const root = event.target.closest('[data-nn-travel-root]');
    if (!root) return;
    if (event.target.matches('[data-flight-departure]')) {
      const returnDate = root.querySelector('[data-flight-return]');
      if (!returnDate) return;
      returnDate.min = event.target.value || futureDate(1);
      if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = '';
    }
  });
}

export function renderTravelSuite() {
  ensureTravelStyles();
  installTravelDelegates();
  const saved = loadJson(TRIP_KEY, loadJson('nexusnova_trip_plan_v1', null));

  const root = node(`
    <section class="nn-travel-hero">
      <p class="nx-eyebrow">NEXUSNOVA • TRAVEL INTELLIGENCE</p>
      <h2>Plan smarter. Compare clearly.</h2>
      <p class="nx-tool-meta">Live providers are used when available. Every search still works without a paid key through clearly labelled, non-bookable planning estimates.</p>
      <div class="nn-travel-pills" aria-label="Travel capabilities">
        <div class="nn-travel-pill">✈ Flights</div>
        <div class="nn-travel-pill">▣ Hotels</div>
        <div class="nn-travel-pill">↔ Rail / Bus</div>
        <div class="nn-travel-pill">✓ Trip Plan</div>
      </div>
    </section>

    <section class="nx-tool-card nn-travel-card">
      <p class="nx-eyebrow">FLIGHTS • LIVE WHEN CONNECTED</p>
      <strong>Fare comparison that never becomes a dead button</strong>
      <p class="nx-tool-meta">NexusNova first gives a free indicative planning range, then upgrades the screen to real live offers if the secure provider returns bookable inventory.</p>

      <div class="nx-two-col">
        <label class="nx-field"><span>From</span><input maxlength="80" autocomplete="off" data-flight-origin placeholder="Karachi or KHI"></label>
        <label class="nx-field"><span>To</span><input maxlength="80" autocomplete="off" data-flight-destination placeholder="Dubai or DXB"></label>
      </div>

      <div class="nx-two-col">
        <label class="nx-field"><span>Departure</span><input type="date" data-flight-departure></label>
        <label class="nx-field"><span>Return (optional)</span><input type="date" data-flight-return></label>
      </div>

      <div class="nx-two-col">
        <label class="nx-field"><span>Adults</span>
          <select data-flight-adults>${Array.from({ length: 9 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('')}</select>
        </label>
        <label class="nx-field"><span>Cabin</span>
          <select data-flight-cabin>
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium Economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </label>
      </div>

      <label class="nx-field"><span>Display currency</span>
        <select data-flight-currency>
          ${Object.keys(CURRENCY_SCALE).map(code => `<option value="${code}">${code}</option>`).join('')}
        </select>
      </label>

      <button class="nx-primary" type="button" data-flight-search>SEARCH FARES</button>
      <p class="nx-tool-meta" role="status" aria-live="polite" data-flight-status>Ready. The free estimate path works without a paid provider.</p>
    </section>

    <section class="nx-tool-card nn-travel-card" data-flight-summary hidden>
      <div class="nx-list-card__head">
        <div><p class="nx-eyebrow">COMPARISON</p><strong data-flight-route>—</strong></div>
        <span class="nx-badge" data-flight-count>0 RESULTS</span>
      </div>
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-flight-sort="cheapest">LOWEST</button>
        <button type="button" data-flight-sort="fastest">FASTEST</button>
        <button type="button" data-flight-sort="best">BEST VALUE</button>
      </div>
      <p class="nx-tool-meta" data-flight-provider-note></p>
    </section>

    <section class="nx-stack" data-flight-results></section>

    <section class="nx-tool-card nn-travel-card">
      <p class="nx-eyebrow">RAIL + COACH • FREE PLANNER</p>
      <strong>Ground travel estimator</strong>
      <p class="nx-tool-meta">Works locally with no provider key. Results are planning estimates, never disguised as live fares.</p>
      <div class="nx-two-col">
        <label class="nx-field"><span>From</span><input maxlength="80" data-ground-origin placeholder="City / station"></label>
        <label class="nx-field"><span>To</span><input maxlength="80" data-ground-destination placeholder="City / station"></label>
      </div>
      <div class="nx-two-col">
        <label class="nx-field"><span>Date</span><input type="date" data-ground-date></label>
        <label class="nx-field"><span>Travellers</span><select data-ground-passengers>${Array.from({ length: 9 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('')}</select></label>
      </div>
      <label class="nx-field"><span>Display currency</span>
        <select data-ground-currency>${Object.keys(CURRENCY_SCALE).map(code => `<option value="${code}">${code}</option>`).join('')}</select>
      </label>
      <button class="nx-primary" type="button" data-ground-search>COMPARE RAIL / BUS</button>
      <p class="nx-tool-meta" role="status" aria-live="polite" data-ground-status>Ready for a free indicative comparison.</p>
      <div class="nx-stack" data-ground-results style="margin-top:12px"></div>
    </section>

    <section class="nx-tool-card nn-travel-card">
      <p class="nx-eyebrow">PRIVATE • ON-DEVICE</p>
      <strong>Plan Your Trip</strong>
      <p class="nx-tool-meta">Build a day-by-day itinerary saved only on this device. No network or account is required.</p>
      <label class="nx-field"><span>Destination</span><input maxlength="80" data-trip-destination placeholder="Any city worldwide"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Start date</span><input type="date" data-trip-start></label>
        <label class="nx-field"><span>Days</span><input type="number" min="1" max="30" step="1" value="3" data-trip-days></label>
      </div>
      <label class="nx-field"><span>Purpose / places / notes</span><textarea rows="3" maxlength="500" data-trip-notes></textarea></label>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-trip-create>CREATE TRIP PLAN</button>
        <button type="button" data-trip-clear>CLEAR PLAN</button>
      </div>
      <p class="nx-tool-meta" role="status" aria-live="polite" data-trip-status>${saved?.destination ? 'Saved trip plan loaded.' : 'No saved trip plan.'}</p>
    </section>
    <section class="nx-stack" data-trip-output></section>
  `);

  const departure = root.querySelector('[data-flight-departure]');
  const returnDate = root.querySelector('[data-flight-return]');
  const flightCurrency = root.querySelector('[data-flight-currency]');
  const groundDate = root.querySelector('[data-ground-date]');
  const groundCurrency = root.querySelector('[data-ground-currency]');
  departure.min = futureDate(1);
  departure.value = futureDate(7);
  returnDate.min = departure.value;
  flightCurrency.value = 'PKR';
  groundDate.min = futureDate(0);
  groundDate.value = futureDate(1);
  groundCurrency.value = 'PKR';

  const flightResults = root.querySelector('[data-flight-results]');
  const hotelPanel = renderTravelHotelsPanel();
  hotelPanel.classList.add('nn-travel-card');
  flightResults.insertAdjacentElement('afterend', hotelPanel);

  const tripDestination = root.querySelector('[data-trip-destination]');
  const start = root.querySelector('[data-trip-start]');
  const days = root.querySelector('[data-trip-days]');
  const notes = root.querySelector('[data-trip-notes]');
  start.value = new Date().toISOString().slice(0, 10);

  if (saved && typeof saved === 'object') {
    tripDestination.value = String(saved.destination || '').slice(0, 80);
    start.value = /^\d{4}-\d{2}-\d{2}$/.test(String(saved.start || '')) ? saved.start : start.value;
    days.value = String(Math.max(1, Math.min(30, Number(saved.days) || 3)));
    notes.value = String(saved.notes || '').slice(0, 500);
    const normalized = {
      destination: tripDestination.value,
      start: start.value,
      days: Number(days.value),
      notes: notes.value
    };
    saveJson(TRIP_KEY, normalized);
    renderPlan(root, normalized);
  } else {
    renderPlan(root, null);
  }

  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
