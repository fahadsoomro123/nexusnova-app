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
  if (!value) return '—';
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
    .slice(0, 180);
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
  return cleanMoney(Math.max(1, usd) * (CURRENCY_SCALE[currency] || 1), currency);
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
  return ((price - bounds.minPrice) / priceRange) * 0.62
    + ((duration - bounds.minDuration) / durationRange) * 0.38
    + Math.max(0, Number(offer.stops) || 0) * 0.08;
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

function ensureTravelStyles() {
  const existing = document.getElementById('nn-travel-premium-style');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'nn-travel-premium-style';
  style.textContent = `
    [data-nn-travel-root] {
      --nn-border: rgba(148,163,184,.2);
      --nn-soft: rgba(15,23,42,.74);
      --nn-soft2: rgba(30,41,59,.58);
      --nn-blue: #60a5fa;
      --nn-violet: #a78bfa;
      height: calc(100dvh - 154px);
      min-height: 450px;
      max-height: 820px;
      overflow: hidden !important;
      display: grid;
      grid-template-rows: auto minmax(0,1fr);
      gap: 8px;
      padding-bottom: 0 !important;
    }
    [data-nn-travel-root] .nn-travel-command {
      border: 1px solid var(--nn-border);
      border-radius: 18px;
      padding: 8px;
      background:
        radial-gradient(circle at 12% 0%, rgba(96,165,250,.18), transparent 34%),
        radial-gradient(circle at 92% 0%, rgba(167,139,250,.16), transparent 30%),
        linear-gradient(145deg, rgba(15,23,42,.96), rgba(17,24,39,.84));
      box-shadow: 0 12px 34px rgba(2,6,23,.22);
    }
    [data-nn-travel-root] .nn-travel-command-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 3px 7px;
    }
    [data-nn-travel-root] .nn-travel-title {
      min-width: 0;
      display: flex;
      align-items: baseline;
      gap: 7px;
    }
    [data-nn-travel-root] .nn-travel-title strong {
      font-size: 1rem;
      letter-spacing: -.02em;
      white-space: nowrap;
    }
    [data-nn-travel-root] .nn-travel-title span {
      color: var(--nx-muted, #94a3b8);
      font-size: .68rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    [data-nn-travel-root] .nn-travel-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 5px;
    }
    [data-nn-travel-root] .nn-travel-tab {
      min-width: 0;
      min-height: 40px;
      border-radius: 12px;
      border: 1px solid var(--nn-border);
      background: rgba(15,23,42,.55);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 6px;
      font-size: .72rem;
      font-weight: 800;
      letter-spacing: .01em;
    }
    [data-nn-travel-root] .nn-travel-tab.is-active {
      border-color: rgba(96,165,250,.58);
      background: linear-gradient(135deg, rgba(37,99,235,.28), rgba(124,58,237,.22));
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 8px 20px rgba(37,99,235,.12);
    }
    [data-nn-travel-root] .nn-travel-workspace {
      min-height: 0;
      overflow: hidden;
    }
    [data-nn-travel-root] .nn-travel-panel {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    [data-nn-travel-root] .nn-travel-panel[hidden] { display: none !important; }
    [data-nn-travel-root] .nn-travel-card {
      margin: 0 !important;
      padding: 10px !important;
      border: 1px solid var(--nn-border);
      border-radius: 16px;
      background: linear-gradient(155deg, rgba(15,23,42,.86), rgba(15,23,42,.64));
      box-shadow: 0 10px 26px rgba(2,6,23,.14);
      backdrop-filter: blur(14px);
    }
    [data-nn-travel-root] .nn-travel-form {
      flex: 0 0 auto;
    }
    [data-nn-travel-root] .nn-travel-headline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 7px;
    }
    [data-nn-travel-root] .nn-travel-headline > div { min-width: 0; }
    [data-nn-travel-root] .nn-travel-headline strong {
      display: block;
      font-size: .88rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    [data-nn-travel-root] .nn-travel-headline .nx-eyebrow { margin: 0 0 1px; font-size: .59rem; }
    [data-nn-travel-root] .nn-travel-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 6px;
      align-items: end;
    }
    [data-nn-travel-root] .nn-travel-span-2 { grid-column: 1 / -1; }
    [data-nn-travel-root] .nx-field { margin: 0 !important; min-width: 0; }
    [data-nn-travel-root] .nx-field > span {
      display: block;
      margin-bottom: 3px;
      font-size: .64rem;
      line-height: 1;
      letter-spacing: .025em;
    }
    [data-nn-travel-root] input,
    [data-nn-travel-root] select,
    [data-nn-travel-root] textarea {
      min-height: 36px !important;
      height: 36px;
      border-radius: 11px !important;
      padding: 6px 9px !important;
      font-size: .78rem !important;
    }
    [data-nn-travel-root] textarea {
      height: 56px !important;
      min-height: 56px !important;
      resize: none;
    }
    [data-nn-travel-root] .nn-travel-search,
    [data-nn-travel-root] .nn-travel-card .nx-primary {
      min-height: 36px !important;
      height: 36px;
      border-radius: 11px !important;
      padding: 6px 9px !important;
      font-size: .7rem !important;
      font-weight: 850;
      letter-spacing: .015em;
    }
    [data-nn-travel-root] .nn-travel-status {
      margin: 6px 1px 0 !important;
      min-height: 16px;
      font-size: .64rem !important;
      line-height: 1.25;
    }
    [data-nn-travel-root] .nn-travel-summary {
      flex: 0 0 auto;
      padding: 8px 9px !important;
    }
    [data-nn-travel-root] .nn-travel-summary .nx-action-row { margin-top: 6px; gap: 5px; }
    [data-nn-travel-root] .nn-travel-summary .nx-action-row button {
      min-height: 31px !important;
      height: 31px;
      padding: 4px 7px !important;
      font-size: .64rem !important;
      border-radius: 9px !important;
    }
    [data-nn-travel-root] .nn-travel-results,
    [data-nn-travel-root] [data-hotel-results],
    [data-nn-travel-root] [data-ground-results],
    [data-nn-travel-root] [data-trip-output] {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      padding-right: 2px;
    }
    [data-nn-travel-root] .nx-list-card {
      padding: 9px !important;
      border-radius: 13px !important;
      margin: 0 0 6px !important;
    }
    [data-nn-travel-root] .nx-list-card__head { gap: 8px; }
    [data-nn-travel-root] .nx-list-card strong { font-size: .78rem; }
    [data-nn-travel-root] .nx-tool-meta { font-size: .65rem; line-height: 1.3; }
    [data-nn-travel-root] .nx-summary-grid {
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 5px;
      margin-top: 6px;
    }
    [data-nn-travel-root] .nx-summary-grid > div { padding: 6px !important; }
    [data-nn-travel-root] .nx-summary-grid span { font-size: .55rem; }
    [data-nn-travel-root] .nx-summary-grid strong { font-size: .68rem; }
    [data-nn-travel-root] .nn-estimate-card {
      border: 1px solid rgba(96,165,250,.24);
      background: linear-gradient(150deg, rgba(30,41,59,.82), rgba(15,23,42,.72));
    }
    [data-nn-travel-root] .nn-live-card { border: 1px solid rgba(52,211,153,.3); }
    [data-nn-travel-root] .nn-travel-day { position: relative; overflow: hidden; }
    [data-nn-travel-root] .nn-travel-day::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: linear-gradient(180deg, var(--nn-blue), var(--nn-violet));
    }
    [data-nn-travel-root] .nn-travel-note {
      margin: 6px 0;
      padding: 7px 9px;
      border-radius: 10px;
      border: 1px solid var(--nn-border);
      background: rgba(15,23,42,.44);
      font-size: .68rem;
    }
    [data-nn-travel-root] button:disabled { opacity: .62; cursor: wait; }

    [data-nn-travel-root] [data-nn-hotel-root] {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      grid-template-rows: auto auto auto auto auto minmax(0,1fr);
      gap: 6px;
      align-content: start;
    }
    [data-nn-travel-root] [data-nn-hotel-root] > .nx-eyebrow,
    [data-nn-travel-root] [data-nn-hotel-root] > strong,
    [data-nn-travel-root] [data-nn-hotel-root] > [data-hotel-summary],
    [data-nn-travel-root] [data-nn-hotel-root] > [data-hotel-results] {
      grid-column: 1 / -1;
    }
    [data-nn-travel-root] [data-nn-hotel-root] > strong { font-size: .88rem; }
    [data-nn-travel-root] [data-nn-hotel-root] > p.nx-tool-meta:not([data-hotel-status]) { display: none; }
    [data-nn-travel-root] [data-nn-hotel-root] > .nx-field:first-of-type { grid-column: 1 / -1; }
    [data-nn-travel-root] [data-nn-hotel-root] > .nx-two-col { display: contents; }
    [data-nn-travel-root] [data-nn-hotel-root] > .nx-field:last-of-type { grid-column: 1 / 2; }
    [data-nn-travel-root] [data-nn-hotel-root] > [data-hotel-search] { grid-column: 2 / 3; align-self: end; }
    [data-nn-travel-root] [data-nn-hotel-root] > [data-hotel-status] { grid-column: 1 / -1; margin: 0 !important; }
    [data-nn-travel-root] [data-nn-hotel-root] > [data-hotel-summary] { margin-top: 0 !important; }
    [data-nn-travel-root] [data-nn-hotel-root] > [data-hotel-results] { margin-top: 0 !important; }

    @media (max-height: 690px) {
      [data-nn-travel-root] { height: calc(100dvh - 136px); min-height: 420px; gap: 6px; }
      [data-nn-travel-root] .nn-travel-command { padding: 6px; border-radius: 15px; }
      [data-nn-travel-root] .nn-travel-command-top { padding-bottom: 5px; }
      [data-nn-travel-root] .nn-travel-tab { min-height: 34px; height: 34px; }
      [data-nn-travel-root] .nn-travel-card { padding: 8px !important; }
      [data-nn-travel-root] input,
      [data-nn-travel-root] select { min-height: 32px !important; height: 32px; }
      [data-nn-travel-root] textarea { min-height: 46px !important; height: 46px !important; }
      [data-nn-travel-root] .nn-travel-search,
      [data-nn-travel-root] .nn-travel-card .nx-primary { min-height: 32px !important; height: 32px; }
    }
    @media (max-width: 390px) {
      [data-nn-travel-root] { height: calc(100dvh - 146px); }
      [data-nn-travel-root] .nn-travel-tab { font-size: .66rem; gap: 3px; padding: 4px; }
      [data-nn-travel-root] .nn-travel-title span { display: none; }
      [data-nn-travel-root] input,
      [data-nn-travel-root] select { font-size: .72rem !important; padding-inline: 7px !important; }
    }
  `;
  document.head.appendChild(style);
}

function setTravelTab(root, name) {
  const allowed = new Set(['flights', 'hotels', 'ground', 'plan']);
  const active = allowed.has(name) ? name : 'flights';
  root.dataset.nnActiveTravelTab = active;
  root.querySelectorAll('[data-travel-tab]').forEach(button => {
    const selected = button.dataset.travelTab === active;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
  });
  root.querySelectorAll('[data-travel-panel]').forEach(panel => {
    panel.hidden = panel.dataset.travelPanel !== active;
  });
}

function flightState(root) {
  if (!root.__nnFlightState) root.__nnFlightState = { offers: [], sort: 'cheapest', mode: 'estimate' };
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
  const seed = `${query.from}|${query.to}|${query.departure}|${query.returnDate}|${query.adults}|${query.cabin}`;
  const cabinFactor = { economy: 1, premium_economy: 1.55, business: 2.85, first: 4.4 }[query.cabin] || 1;
  const roundFactor = query.returnDate ? 1.72 : 1;
  const baseUsd = seeded(`${seed}|route`, 145, 780) * cabinFactor * roundFactor * query.adults;
  const labels = [
    ['Value route', 0.88, 1],
    ['Balanced route', 1.03, 0],
    ['Flexible route', 1.19, 1]
  ];
  return labels.map(([label, factor, stops], index) => {
    const duration = seeded(`${seed}|duration|${index}`, 110, 760);
    const usd = baseUsd * factor * (1 + seeded(`${seed}|fare|${index}`, 0, 12) / 100);
    const total = usd * (CURRENCY_SCALE[query.currency] || 1);
    return {
      estimate: true,
      provider: 'NexusNova Estimate',
      carriers: [label],
      total,
      compareTotal: total,
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
  const c = getFlightControls(root);
  const state = flightState(root);
  const offers = sortedOffers(state.offers, state.sort);
  root.querySelectorAll('[data-flight-sort]').forEach(button => {
    button.classList.toggle('nx-primary', button.dataset.flightSort === state.sort);
  });
  c.results.innerHTML = offers.length ? offers.map((offer, index) => {
    const estimated = offer.estimate === true;
    const carriers = Array.isArray(offer.carriers) && offer.carriers.length ? offer.carriers.join(' + ') : estimated ? 'Planning option' : 'Carrier';
    const price = cleanMoney(offer.total ?? offer.compareTotal, offer.currency || offer.compareCurrency || 'USD');
    const badge = index === 0
      ? `<span class="nx-badge good">${state.sort === 'fastest' ? 'FASTEST' : state.sort === 'best' ? 'BEST' : 'LOWEST'}</span>`
      : `<span class="nx-badge">${estimated ? 'ESTIMATE' : escapeHtml(offer.provider || 'LIVE')}</span>`;
    const timing = estimated
      ? `<div><span>Time</span><strong>${escapeHtml(durationText(offer.durationMinutes))}</strong></div><div><span>Stops</span><strong>${Number(offer.stops) || 0}</strong></div><div><span>Mode</span><strong>Estimate</strong></div>`
      : `<div><span>Depart</span><strong>${escapeHtml(timeText(offer.departingAt))}</strong></div><div><span>Arrive</span><strong>${escapeHtml(timeText(offer.arrivingAt))}</strong></div><div><span>Time</span><strong>${escapeHtml(durationText(offer.durationMinutes))}</strong></div>`;
    return `<article class="nx-list-card ${estimated ? 'nn-estimate-card' : 'nn-live-card'}">
      <div class="nx-list-card__head"><div><strong>${escapeHtml(carriers)}</strong><p class="nx-tool-meta">${estimated ? 'Planning estimate' : escapeHtml(offer.provider || 'Live provider')}</p></div>${badge}</div>
      <div class="nx-summary-grid">${timing}</div>
      <div class="nx-list-card__head" style="margin-top:6px"><div><span class="nx-tool-meta">${estimated ? 'Indicative total' : 'Live total'}</span><strong>${escapeHtml(price)}</strong></div><span class="nx-badge">${estimated ? 'VERIFY' : 'LIVE'}</span></div>
      <p class="nx-tool-meta">${escapeHtml(offer.originLabel || offer.originCode || '')} → ${escapeHtml(offer.destinationLabel || offer.destinationCode || '')}${estimated ? ' • Not a booking quote.' : ''}</p>
    </article>`;
  }).join('') : '<div class="nx-empty">No result available.</div>';
}

function showFlightEstimate(root, query, reason = '') {
  const c = getFlightControls(root);
  const state = flightState(root);
  state.offers = flightEstimateOffers(query);
  state.sort = 'cheapest';
  state.mode = 'estimate';
  c.route.textContent = `${query.from} → ${query.to}`;
  c.count.textContent = `${state.offers.length} ESTIMATES`;
  c.provider.textContent = 'Free planning estimates. Verify final fare before booking.';
  c.summary.hidden = false;
  paintFlightOffers(root);
  c.status.textContent = reason
    ? `Live connection unavailable. Estimate shown: ${reason}`
    : 'Estimate ready. Checking live providers…';
}

async function searchFlights(root) {
  const c = getFlightControls(root);
  const query = {
    from: c.origin?.value.trim() || '',
    to: c.destination?.value.trim() || '',
    departure: c.departure?.value || '',
    returnDate: c.returnDate?.value || '',
    adults: Number(c.adults?.value) || 1,
    cabin: c.cabin?.value || 'economy',
    currency: c.currency?.value || 'PKR'
  };
  if (!query.from || !query.to || !query.departure) {
    c.status.textContent = 'Enter origin, destination and departure date.';
    return;
  }
  if (query.from.toLowerCase() === query.to.toLowerCase()) {
    c.status.textContent = 'Origin and destination must be different.';
    return;
  }
  if (query.returnDate && query.returnDate < query.departure) {
    c.status.textContent = 'Return date must be after departure.';
    return;
  }

  c.search.disabled = true;
  c.search.textContent = 'CHECKING…';
  showFlightEstimate(root, query);
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
      showFlightEstimate(root, query, data.message || 'no live offers returned');
      return;
    }
    const state = flightState(root);
    state.offers = live;
    state.sort = 'cheapest';
    state.mode = 'live';
    const route = Array.isArray(data.routes) && data.routes[0] ? data.routes[0] : null;
    c.route.textContent = route ? `${route.origin?.label || query.from} → ${route.destination?.label || query.to}` : `${query.from} → ${query.to}`;
    c.count.textContent = `${live.length} LIVE`;
    c.provider.textContent = `Live provider results • ${new Date(data.searchedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    c.summary.hidden = false;
    paintFlightOffers(root);
    c.status.textContent = `${live.length} live offer${live.length === 1 ? '' : 's'} loaded.`;
  } catch (error) {
    showFlightEstimate(root, query, errorText(error));
    console.warn('[NexusNova Fresh] worldwide travel search:', error);
  } finally {
    c.search.disabled = false;
    c.search.textContent = 'SEARCH FARES';
  }
}

function groundEstimate(query) {
  const seed = `${query.from}|${query.to}|${query.date}|${query.passengers}`;
  const distanceBand = seeded(`${seed}|distance`, 80, 980);
  const railMinutes = Math.max(55, Math.round(distanceBand / seeded(`${seed}|speed`, 2, 4) * 1.25));
  const busMinutes = Math.max(80, Math.round(railMinutes * (1.35 + seeded(`${seed}|bus`, 0, 25) / 100)));
  const railUsd = Math.max(9, distanceBand * (0.055 + seeded(`${seed}|rail-price`, 0, 18) / 1000)) * query.passengers;
  const busUsd = Math.max(5, railUsd * (0.48 + seeded(`${seed}|bus-price`, 0, 18) / 100));
  return [
    { name: 'Rail', price: railUsd, minutes: railMinutes, note: 'Station planning model' },
    { name: 'Coach / Bus', price: busUsd, minutes: busMinutes, note: 'Budget road model' },
    { name: 'Mixed transfer', price: (railUsd + busUsd) * 0.58, minutes: Math.round((railMinutes + busMinutes) / 2), note: 'Rail + coach model' }
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
    status.textContent = 'Enter origin, destination and date.';
    return;
  }
  if (from.toLowerCase() === to.toLowerCase()) {
    status.textContent = 'Origin and destination must be different.';
    return;
  }
  results.innerHTML = groundEstimate({ from, to, date, passengers }).map((item, index) => `<article class="nx-list-card nn-estimate-card">
    <div class="nx-list-card__head"><div><strong>${escapeHtml(item.name)}</strong><p class="nx-tool-meta">${escapeHtml(item.note)}</p></div><span class="nx-badge ${index === 1 ? 'good' : ''}">${index === 1 ? 'BUDGET' : 'ESTIMATE'}</span></div>
    <div class="nx-summary-grid"><div><span>Fare</span><strong>${escapeHtml(estimateMoney(item.price, currency))}</strong></div><div><span>Time</span><strong>${escapeHtml(durationText(item.minutes))}</strong></div><div><span>People</span><strong>${passengers}</strong></div></div>
    <p class="nx-tool-meta">${escapeHtml(from)} → ${escapeHtml(to)} • Estimate only.</p>
  </article>`).join('');
  status.textContent = 'Free rail / bus planning comparison ready.';
}

function dayRows(plan) {
  const start = new Date(`${plan.start}T00:00:00`);
  return Array.from({ length: plan.days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const hint = index === 0
      ? 'Arrival, check-in and easy local orientation.'
      : index === plan.days - 1
        ? 'Final activities, checkout buffer and return.'
        : index % 2
          ? 'Main sights, local food and flexible evening.'
          : 'Neighbourhoods, culture and local travel.';
    return `<article class="nx-list-card nn-travel-day"><strong>Day ${index + 1} • ${escapeHtml(date.toLocaleDateString())}</strong><p class="nx-tool-meta">${escapeHtml(hint)}</p></article>`;
  }).join('');
}

function renderPlan(root, plan) {
  const output = root.querySelector('[data-trip-output]');
  if (!output) return;
  if (!plan?.destination || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start) || !(plan.days >= 1)) {
    output.innerHTML = '<div class="nx-empty">No saved itinerary.</div>';
    return;
  }
  output.innerHTML = `<article class="nx-tool-card nn-travel-card">
    <div class="nx-list-card__head"><div><strong>${escapeHtml(plan.destination)} • ${plan.days} days</strong><p class="nx-tool-meta">Private on-device itinerary</p></div><span class="nx-badge good">SAVED</span></div>
    ${plan.notes ? `<p class="nn-travel-note">${escapeHtml(plan.notes)}</p>` : ''}
    <div class="nx-stack">${dayRows(plan)}</div>
    <button class="nx-primary" type="button" data-trip-use-flight>USE IN FLIGHT SEARCH</button>
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
    status.textContent = 'Choose a destination and valid date.';
    return;
  }
  saveJson(TRIP_KEY, plan);
  status.textContent = 'Trip saved on this device.';
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
  root.querySelector('[data-trip-status]').textContent = 'Saved trip cleared.';
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
  setTravelTab(root, 'flights');
  root.querySelector('[data-flight-status]').textContent = `${saved.destination} copied. Enter origin and search.`;
  requestAnimationFrame(() => root.querySelector('[data-flight-origin]')?.focus({ preventScroll: true }));
}

function installTravelDelegates() {
  if (window.__nnTravelSuiteDelegatesV3) return;
  window.__nnTravelSuiteDelegatesV3 = true;

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    const root = event.target.closest('[data-nn-travel-root]');
    if (!button || !root) return;

    if (button.matches('[data-travel-tab]')) {
      event.preventDefault();
      setTravelTab(root, button.dataset.travelTab);
      return;
    }
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

  document.addEventListener('keydown', event => {
    const button = event.target.closest('[data-travel-tab]');
    const root = event.target.closest('[data-nn-travel-root]');
    if (!button || !root || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...root.querySelectorAll('[data-travel-tab]')];
    const current = tabs.indexOf(button);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(current + step + tabs.length) % tabs.length];
    setTravelTab(root, next.dataset.travelTab);
    next.focus({ preventScroll: true });
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
    <section class="nn-travel-command">
      <div class="nn-travel-command-top">
        <div class="nn-travel-title"><strong>Travel Desk</strong><span>single-screen flagship workspace</span></div>
        <span class="nx-badge good">READY</span>
      </div>
      <nav class="nn-travel-tabs" role="tablist" aria-label="Travel tools">
        <button class="nn-travel-tab is-active" type="button" role="tab" aria-selected="true" data-travel-tab="flights">✈ Flights</button>
        <button class="nn-travel-tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-travel-tab="hotels">▣ Hotels</button>
        <button class="nn-travel-tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-travel-tab="ground">↔ Rail/Bus</button>
        <button class="nn-travel-tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-travel-tab="plan">✓ Trip Plan</button>
      </nav>
    </section>

    <div class="nn-travel-workspace">
      <section class="nn-travel-panel" data-travel-panel="flights">
        <section class="nx-tool-card nn-travel-card nn-travel-form">
          <div class="nn-travel-headline"><div><p class="nx-eyebrow">FLIGHTS</p><strong>Fare Compare</strong></div><span class="nx-badge">LIVE + FREE</span></div>
          <div class="nn-travel-grid">
            <label class="nx-field"><span>From</span><input maxlength="80" autocomplete="off" data-flight-origin placeholder="Karachi / KHI"></label>
            <label class="nx-field"><span>To</span><input maxlength="80" autocomplete="off" data-flight-destination placeholder="Dubai / DXB"></label>
            <label class="nx-field"><span>Departure</span><input type="date" data-flight-departure></label>
            <label class="nx-field"><span>Return</span><input type="date" data-flight-return></label>
            <label class="nx-field"><span>Adults</span><select data-flight-adults>${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></label>
            <label class="nx-field"><span>Cabin</span><select data-flight-cabin><option value="economy">Economy</option><option value="premium_economy">Premium Economy</option><option value="business">Business</option><option value="first">First</option></select></label>
            <label class="nx-field"><span>Currency</span><select data-flight-currency>${Object.keys(CURRENCY_SCALE).map(code => `<option value="${code}">${code}</option>`).join('')}</select></label>
            <button class="nx-primary nn-travel-search" type="button" data-flight-search>SEARCH FARES</button>
          </div>
          <p class="nx-tool-meta nn-travel-status" role="status" aria-live="polite" data-flight-status>Ready • live when connected, free estimate fallback.</p>
        </section>

        <section class="nx-tool-card nn-travel-card nn-travel-summary" data-flight-summary hidden>
          <div class="nx-list-card__head"><div><strong data-flight-route>—</strong><p class="nx-tool-meta" data-flight-provider-note></p></div><span class="nx-badge" data-flight-count>0</span></div>
          <div class="nx-action-row"><button class="nx-primary" type="button" data-flight-sort="cheapest">LOWEST</button><button type="button" data-flight-sort="fastest">FASTEST</button><button type="button" data-flight-sort="best">BEST</button></div>
        </section>
        <section class="nx-stack nn-travel-results" data-flight-results></section>
      </section>

      <section class="nn-travel-panel" data-travel-panel="hotels" hidden></section>

      <section class="nn-travel-panel" data-travel-panel="ground" hidden>
        <section class="nx-tool-card nn-travel-card nn-travel-form">
          <div class="nn-travel-headline"><div><p class="nx-eyebrow">GROUND</p><strong>Rail + Bus Compare</strong></div><span class="nx-badge">FREE</span></div>
          <div class="nn-travel-grid">
            <label class="nx-field"><span>From</span><input maxlength="80" data-ground-origin placeholder="City / station"></label>
            <label class="nx-field"><span>To</span><input maxlength="80" data-ground-destination placeholder="City / station"></label>
            <label class="nx-field"><span>Date</span><input type="date" data-ground-date></label>
            <label class="nx-field"><span>Travellers</span><select data-ground-passengers>${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></label>
            <label class="nx-field"><span>Currency</span><select data-ground-currency>${Object.keys(CURRENCY_SCALE).map(code => `<option value="${code}">${code}</option>`).join('')}</select></label>
            <button class="nx-primary nn-travel-search" type="button" data-ground-search>COMPARE</button>
          </div>
          <p class="nx-tool-meta nn-travel-status" role="status" aria-live="polite" data-ground-status>Ready • free planning comparison.</p>
        </section>
        <div class="nx-stack nn-travel-results" data-ground-results></div>
      </section>

      <section class="nn-travel-panel" data-travel-panel="plan" hidden>
        <section class="nx-tool-card nn-travel-card nn-travel-form">
          <div class="nn-travel-headline"><div><p class="nx-eyebrow">PRIVATE</p><strong>Trip Planner</strong></div><span class="nx-badge good">ON DEVICE</span></div>
          <div class="nn-travel-grid">
            <label class="nx-field nn-travel-span-2"><span>Destination</span><input maxlength="80" data-trip-destination placeholder="Any city worldwide"></label>
            <label class="nx-field"><span>Start</span><input type="date" data-trip-start></label>
            <label class="nx-field"><span>Days</span><input type="number" min="1" max="30" step="1" value="3" data-trip-days></label>
            <label class="nx-field nn-travel-span-2"><span>Notes / places</span><textarea maxlength="500" data-trip-notes></textarea></label>
            <button class="nx-primary nn-travel-search" type="button" data-trip-create>CREATE / SAVE</button>
            <button class="nn-travel-search" type="button" data-trip-clear>CLEAR</button>
          </div>
          <p class="nx-tool-meta nn-travel-status" role="status" aria-live="polite" data-trip-status>${saved?.destination ? 'Saved trip loaded.' : 'No saved trip.'}</p>
        </section>
        <section class="nx-stack nn-travel-results" data-trip-output></section>
      </section>
    </div>
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

  const hotelHost = root.querySelector('[data-travel-panel="hotels"]');
  const hotelPanel = renderTravelHotelsPanel();
  hotelPanel.classList.add('nn-travel-card');
  hotelHost.appendChild(hotelPanel);

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
    const normalized = { destination: tripDestination.value, start: start.value, days: Number(days.value), notes: notes.value };
    saveJson(TRIP_KEY, normalized);
    renderPlan(root, normalized);
  } else {
    renderPlan(root, null);
  }

  setTravelTab(root, 'flights');
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });