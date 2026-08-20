import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';
import { renderTravelHotelsPanel } from './travel-hotels.js';

const TRIP_KEY = 'nexusnova_trip_plan_v1';
const functions = getFunctions(firebaseApp, 'us-central1');

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function tomorrow(days = 1) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
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
    return `${amount.toLocaleString()} ${currency}`;
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
    .slice(0, 280);
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
    const date = new Date(start.getTime() + index * 86_400_000);
    const hint = index === 0
      ? 'Arrival / check-in / local orientation'
      : index === plan.days - 1
        ? 'Final activities / return preparation'
        : 'Main activities / local travel / meals';
    return `<article class="nx-list-card"><strong>Day ${index + 1} • ${escapeHtml(date.toLocaleDateString())}</strong><p>${escapeHtml(hint)}</p></article>`;
  }).join('');
}

export function renderTravelSuite() {
  const saved = loadJson(TRIP_KEY, null);
  const root = node(`
    <section class="nx-tool-card">
      <p class="nx-eyebrow">WORLDWIDE • LIVE FARE COMPARE</p>
      <strong>Compare real flight offers inside NexusNova</strong>
      <p class="nx-tool-meta">Search by city, airport or IATA code. NexusNova asks secure travel-provider APIs and compares returned live fares. No Google search handoff and no invented prices.</p>

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

      <label class="nx-field"><span>Compare currency</span>
        <select data-flight-currency>
          ${['PKR','USD','EUR','GBP','AED','SAR','CAD','AUD','JPY','CNY','INR','TRY'].map(code => `<option value="${code}">${code}</option>`).join('')}
        </select>
      </label>

      <button class="nx-primary" type="button" data-flight-search>SEARCH & COMPARE LIVE FARES</button>
      <p class="nx-tool-meta" data-flight-status>Ready for worldwide search. Live results appear here only when secure providers return them.</p>
    </section>

    <section class="nx-tool-card" data-flight-summary hidden>
      <div class="nx-list-card__head">
        <div><p class="nx-eyebrow">COMPARISON</p><strong data-flight-route>—</strong></div>
        <span class="nx-badge" data-flight-count>0 OFFERS</span>
      </div>
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-flight-sort="cheapest">CHEAPEST</button>
        <button type="button" data-flight-sort="fastest">FASTEST</button>
        <button type="button" data-flight-sort="best">BEST VALUE</button>
      </div>
      <p class="nx-tool-meta" data-flight-provider-note></p>
    </section>

    <section class="nx-stack" data-flight-results></section>

    <section class="nx-tool-card">
      <strong>Worldwide Travel Expansion</strong>
      <p class="nx-tool-meta">Flights and hotels now use in-app secure data engines. Rail and coach/bus providers will plug into the same browser-free model.</p>
      <div class="nx-summary-grid">
        <div><span>Flights</span><strong>COMPARE ENGINE</strong></div>
        <div><span>Hotels</span><strong>LIVE SEARCH ENGINE</strong></div>
        <div><span>Rail / Bus</span><strong>NEXT PROVIDER</strong></div>
      </div>
    </section>

    <section class="nx-tool-card">
      <strong>Plan Your Trip</strong>
      <p class="nx-tool-meta">Build a private itinerary saved only on this device. The plan stays independent from live fare searches.</p>
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
      <p class="nx-tool-meta" data-trip-status>${saved?.destination ? 'Saved trip plan loaded.' : 'No saved trip plan.'}</p>
    </section>
    <section class="nx-stack" data-trip-output></section>
  `);

  const origin = root.querySelector('[data-flight-origin]');
  const destinationInput = root.querySelector('[data-flight-destination]');
  const departure = root.querySelector('[data-flight-departure]');
  const returnDate = root.querySelector('[data-flight-return]');
  const adults = root.querySelector('[data-flight-adults]');
  const cabin = root.querySelector('[data-flight-cabin]');
  const currency = root.querySelector('[data-flight-currency]');
  const search = root.querySelector('[data-flight-search]');
  const flightStatus = root.querySelector('[data-flight-status]');
  const summary = root.querySelector('[data-flight-summary]');
  const routeLabel = root.querySelector('[data-flight-route]');
  const countLabel = root.querySelector('[data-flight-count]');
  const providerNote = root.querySelector('[data-flight-provider-note]');
  const results = root.querySelector('[data-flight-results]');
  results.insertAdjacentElement('afterend', renderTravelHotelsPanel());
  let liveOffers = [];
  let currentSort = 'cheapest';

  departure.min = tomorrow(1);
  departure.value = tomorrow(7);
  returnDate.min = departure.value;
  currency.value = 'PKR';

  departure.addEventListener('change', () => {
    returnDate.min = departure.value || tomorrow(1);
    if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = '';
  });

  const paintOffers = () => {
    const offers = sortedOffers(liveOffers, currentSort);
    root.querySelectorAll('[data-flight-sort]').forEach(button => {
      button.classList.toggle('nx-primary', button.dataset.flightSort === currentSort);
    });

    results.innerHTML = offers.length ? offers.map((offer, index) => {
      const carriers = Array.isArray(offer.carriers) && offer.carriers.length
        ? offer.carriers.join(' + ')
        : 'Carrier';
      const originalPrice = cleanMoney(offer.total, offer.currency);
      const comparePrice = offer.fxConverted && Number(offer.compareTotal) > 0
        ? `<span>≈ ${escapeHtml(cleanMoney(offer.compareTotal, offer.compareCurrency))} live FX comparison</span>`
        : '';
      const rank = currentSort === 'cheapest' && index === 0
        ? '<span class="nx-badge good">CHEAPEST</span>'
        : currentSort === 'fastest' && index === 0
          ? '<span class="nx-badge good">FASTEST</span>'
          : currentSort === 'best' && index === 0
            ? '<span class="nx-badge good">BEST VALUE</span>'
            : '';
      return `
        <article class="nx-list-card">
          <div class="nx-list-card__head">
            <div><strong>${escapeHtml(carriers)}</strong><p class="nx-tool-meta">${escapeHtml(offer.provider)} • ${offer.stops === 0 ? 'Direct' : `${offer.stops} stop${offer.stops === 1 ? '' : 's'}`}</p></div>
            ${rank}
          </div>
          <div class="nx-summary-grid">
            <div><span>Depart</span><strong>${escapeHtml(timeText(offer.departingAt))}</strong></div>
            <div><span>Arrive</span><strong>${escapeHtml(timeText(offer.arrivingAt))}</strong></div>
            <div><span>Duration</span><strong>${escapeHtml(durationText(offer.durationMinutes))}</strong></div>
          </div>
          <div class="nx-list-card__head" style="margin-top:10px">
            <div><span class="nx-tool-meta">Live total for ${adults.value} adult${adults.value === '1' ? '' : 's'}</span><strong style="display:block;font-size:1.25rem">${escapeHtml(originalPrice)}</strong>${comparePrice}</div>
            <span class="nx-badge">${escapeHtml(offer.provider)}</span>
          </div>
          <p class="nx-tool-meta">${escapeHtml(offer.originLabel || offer.originCode)} → ${escapeHtml(offer.destinationLabel || offer.destinationCode)}${offer.expiresAt ? ` • offer validity ${escapeHtml(String(offer.expiresAt).slice(0, 24))}` : ''}</p>
        </article>`;
    }).join('') : '<div class="nx-empty">No live offers returned for this search.</div>';
  };

  root.querySelectorAll('[data-flight-sort]').forEach(button => button.addEventListener('click', () => {
    currentSort = button.dataset.flightSort || 'cheapest';
    paintOffers();
  }));

  search.addEventListener('click', async () => {
    const from = origin.value.trim();
    const to = destinationInput.value.trim();
    if (!from || !to || !departure.value) {
      flightStatus.textContent = 'Enter origin, destination and departure date.';
      return;
    }
    if (returnDate.value && returnDate.value < departure.value) {
      flightStatus.textContent = 'Return date must be after departure date.';
      return;
    }

    search.disabled = true;
    search.textContent = 'SEARCHING WORLDWIDE…';
    flightStatus.textContent = 'Contacting secure travel providers and comparing returned fares…';
    summary.hidden = true;
    results.innerHTML = '<div class="nx-empty">Searching live providers…</div>';

    try {
      await requireFirebaseUser();
      const call = httpsCallable(functions, 'searchWorldwideFlights');
      const response = await call({
        origin: from,
        destination: to,
        departureDate: departure.value,
        returnDate: returnDate.value || '',
        adults: Number(adults.value) || 1,
        cabin: cabin.value,
        currency: currency.value
      });
      const data = response?.data || {};

      if (data.ok !== true) {
        liveOffers = [];
        results.innerHTML = '<div class="nx-empty">No live provider is connected yet. NexusNova did not substitute web-search or fake fares.</div>';
        flightStatus.textContent = data.message || 'Secure worldwide fare providers are not configured yet.';
        providerNote.textContent = 'Provider credentials must stay on the secure backend; they are never stored inside the APK.';
        return;
      }

      liveOffers = Array.isArray(data.offers) ? data.offers.filter(item => item && item.live === true) : [];
      const configured = Object.entries(data.providers || {}).filter(([, value]) => value).map(([name]) => name.toUpperCase());
      const route = Array.isArray(data.routes) && data.routes[0] ? data.routes[0] : null;
      routeLabel.textContent = route
        ? `${route.origin?.label || from} → ${route.destination?.label || to}`
        : `${from} → ${to}`;
      countLabel.textContent = `${liveOffers.length} OFFER${liveOffers.length === 1 ? '' : 'S'}`;
      providerNote.textContent = `${configured.length ? `Live providers: ${configured.join(' + ')}` : 'No live provider'}${data.providerErrors?.length ? ` • ${data.providerErrors.length} provider warning${data.providerErrors.length === 1 ? '' : 's'}` : ''} • results timestamped ${new Date(data.searchedAt || Date.now()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}.`;
      summary.hidden = false;
      currentSort = 'cheapest';
      paintOffers();
      flightStatus.textContent = liveOffers.length
        ? `${liveOffers.length} real offer${liveOffers.length === 1 ? '' : 's'} returned. Compare cheapest, fastest or best value inside NexusNova.`
        : 'Providers responded but no bookable offer matched this search.';
    } catch (error) {
      liveOffers = [];
      results.innerHTML = '<div class="nx-empty">Live fare search is unavailable right now.</div>';
      const message = errorText(error);
      flightStatus.textContent = /not-found|searchWorldwideFlights/i.test(message)
        ? 'Worldwide travel backend is prepared in this build but still needs its secure function deployment/provider connection.'
        : message;
      console.warn('[NexusNova Fresh] worldwide travel search:', error);
    } finally {
      search.disabled = false;
      search.textContent = 'SEARCH & COMPARE LIVE FARES';
    }
  });

  const tripDestination = root.querySelector('[data-trip-destination]');
  const start = root.querySelector('[data-trip-start]');
  const days = root.querySelector('[data-trip-days]');
  const notes = root.querySelector('[data-trip-notes]');
  const status = root.querySelector('[data-trip-status]');
  const output = root.querySelector('[data-trip-output]');
  start.value = new Date().toISOString().slice(0, 10);

  const renderPlan = plan => {
    if (!plan?.destination || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start) || !(plan.days >= 1)) {
      output.innerHTML = '<div class="nx-empty">No saved trip itinerary.</div>';
      return;
    }
    output.innerHTML = `
      <article class="nx-tool-card">
        <strong>${escapeHtml(plan.destination)} • ${plan.days}-Day Trip Plan</strong>
        ${plan.notes ? `<p>${escapeHtml(plan.notes)}</p>` : ''}
        <div class="nx-stack" style="margin-top:10px">${dayRows(plan)}</div>
        <button class="nx-primary" type="button" data-trip-use-flight>USE DESTINATION IN FARE SEARCH</button>
        <p class="nx-tool-meta">Private planning aid only — not a booking confirmation.</p>
      </article>`;
    output.querySelector('[data-trip-use-flight]').addEventListener('click', () => {
      destinationInput.value = plan.destination;
      departure.value = plan.start;
      returnDate.min = plan.start;
      root.querySelector('[data-flight-origin]')?.focus();
      flightStatus.textContent = `Destination ${plan.destination} copied into worldwide fare comparison. Enter your origin and search.`;
    });
  };

  if (saved && typeof saved === 'object') {
    tripDestination.value = String(saved.destination || '').slice(0, 80);
    start.value = /^\d{4}-\d{2}-\d{2}$/.test(String(saved.start || '')) ? saved.start : start.value;
    days.value = String(Math.max(1, Math.min(30, Number(saved.days) || 3)));
    notes.value = String(saved.notes || '').slice(0, 500);
    renderPlan({ destination: tripDestination.value, start: start.value, days: Number(days.value), notes: notes.value });
  } else {
    renderPlan(null);
  }

  root.querySelector('[data-trip-create]').addEventListener('click', () => {
    const plan = {
      destination: tripDestination.value.trim().slice(0, 80),
      start: start.value,
      days: Math.max(1, Math.min(30, Math.floor(Number(days.value) || 3))),
      notes: notes.value.trim().slice(0, 500),
      createdAt: Date.now()
    };
    if (!plan.destination || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start)) {
      status.textContent = 'Choose a destination and valid start date.';
      return;
    }
    saveJson(TRIP_KEY, plan);
    status.textContent = 'Private itinerary saved on this device.';
    renderPlan(plan);
  });

  root.querySelector('[data-trip-clear]').addEventListener('click', () => {
    localStorage.removeItem(TRIP_KEY);
    tripDestination.value = '';
    notes.value = '';
    days.value = '3';
    status.textContent = 'Saved trip plan cleared.';
    renderPlan(null);
  });

  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
