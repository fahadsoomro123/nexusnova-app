import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml } from '../../core/local-store.js';

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
  const root = document.createElement('section');
  root.className = 'nx-tool-card';
  root.dataset.nnHotelRoot = '1';
  root.innerHTML = html;
  return root;
}

function futureDate(days) {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

function money(value, currency) {
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

function errorText(error) {
  return String(error?.message || error || 'Hotel search failed.')
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

function timeout(promise, ms = LIVE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Live provider timed out.')), ms))
  ]);
}

function nightsBetween(checkIn, checkOut) {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

function sorted(offers, mode) {
  const list = [...offers];
  if (mode === 'night') {
    return list.sort((a, b) => (Number(a.comparePerNight ?? a.pricePerNight) || Number.MAX_VALUE) - (Number(b.comparePerNight ?? b.pricePerNight) || Number.MAX_VALUE));
  }
  return list.sort((a, b) => (Number(a.compareTotal ?? a.stayTotal) || Number.MAX_VALUE) - (Number(b.compareTotal ?? b.stayTotal) || Number.MAX_VALUE));
}

function state(root) {
  if (!root.__nnHotelState) root.__nnHotelState = { offers: [], sort: 'total', mode: 'estimate' };
  return root.__nnHotelState;
}

function controls(root) {
  return {
    destination: root.querySelector('[data-hotel-destination]'),
    checkIn: root.querySelector('[data-hotel-checkin]'),
    checkOut: root.querySelector('[data-hotel-checkout]'),
    adults: root.querySelector('[data-hotel-adults]'),
    rooms: root.querySelector('[data-hotel-rooms]'),
    currency: root.querySelector('[data-hotel-currency]'),
    search: root.querySelector('[data-hotel-search]'),
    status: root.querySelector('[data-hotel-status]'),
    summary: root.querySelector('[data-hotel-summary]'),
    city: root.querySelector('[data-hotel-city]'),
    provider: root.querySelector('[data-hotel-provider]'),
    count: root.querySelector('[data-hotel-count]'),
    results: root.querySelector('[data-hotel-results]')
  };
}

function estimateOffers(query) {
  const nights = nightsBetween(query.checkIn, query.checkOut);
  const seed = `${query.destination}|${query.checkIn}|${query.checkOut}|${query.adults}|${query.rooms}`;
  const scale = CURRENCY_SCALE[query.currency] || 1;
  const baseNightUsd = seeded(`${seed}|base`, 34, 148);
  const variants = [
    ['Smart Stay', 0.82, 'Essential room • value-focused planning tier'],
    ['Comfort Select', 1, 'Comfort room • balanced planning tier'],
    ['Premium Choice', 1.34, 'Higher-comfort room • premium planning tier']
  ];

  return variants.map(([name, factor, description], index) => {
    const perNightUsd = baseNightUsd * factor * Math.max(1, query.rooms) * (1 + Math.max(0, query.adults - query.rooms * 2) * 0.08);
    const stayUsd = perNightUsd * nights;
    return {
      estimate: true,
      name,
      cityCode: query.destination,
      countryCode: '',
      provider: 'NexusNova Estimate',
      stayTotal: stayUsd * scale,
      pricePerNight: perNightUsd * scale,
      compareTotal: stayUsd * scale,
      comparePerNight: perNightUsd * scale,
      compareCurrency: query.currency,
      currency: query.currency,
      nights,
      rooms: query.rooms,
      adults: query.adults,
      roomDescription: description,
      cancellation: index === 0 ? 'Policy varies by property — verify before booking.' : 'Planning tier only — verify cancellation before booking.'
    };
  });
}

function paint(root) {
  const c = controls(root);
  const s = state(root);
  const offers = sorted(s.offers, s.sort);
  root.querySelectorAll('[data-hotel-sort]').forEach(button => {
    button.classList.toggle('nx-primary', button.dataset.hotelSort === s.sort);
  });

  c.results.innerHTML = offers.length ? offers.map((offer, index) => {
    const estimated = offer.estimate === true;
    const total = money(offer.stayTotal ?? offer.compareTotal, offer.currency || offer.compareCurrency || 'USD');
    const perNight = money(offer.pricePerNight ?? offer.comparePerNight, offer.currency || offer.compareCurrency || 'USD');
    const compare = !estimated && offer.fxConverted && Number(offer.compareTotal) > 0
      ? `<p class="nx-tool-meta">≈ ${escapeHtml(money(offer.compareTotal, offer.compareCurrency))} comparison total • ${escapeHtml(money(offer.comparePerNight, offer.compareCurrency))}/night</p>`
      : '';
    const badge = index === 0
      ? `<span class="nx-badge good">${s.sort === 'night' ? 'LOWEST / NIGHT' : 'LOWEST TOTAL'}</span>`
      : `<span class="nx-badge">${estimated ? 'ESTIMATE' : escapeHtml(offer.provider || 'LIVE')}</span>`;

    return `
      <article class="nx-list-card ${estimated ? 'nn-estimate-card' : 'nn-live-card'}">
        <div class="nx-list-card__head">
          <div><strong>${escapeHtml(offer.name || 'Hotel')}</strong><p class="nx-tool-meta">${escapeHtml(offer.cityCode || '')}${offer.countryCode ? ` • ${escapeHtml(offer.countryCode)}` : ''}</p></div>
          ${badge}
        </div>
        <div class="nx-summary-grid">
          <div><span>${estimated ? 'Indicative stay' : 'Stay total'}</span><strong>${escapeHtml(total)}</strong></div>
          <div><span>${estimated ? 'Indicative / night' : 'Per night'}</span><strong>${escapeHtml(perNight)}</strong></div>
          <div><span>Stay</span><strong>${Number(offer.nights) || 0} night${Number(offer.nights) === 1 ? '' : 's'}</strong></div>
        </div>
        ${compare}
        <p class="nx-tool-meta">${escapeHtml(offer.roomDescription || 'Room details supplied by provider.')}</p>
        <p class="nx-tool-meta">${escapeHtml(offer.cancellation || 'Cancellation policy not supplied.')}</p>
        <p class="nx-tool-meta">${Number(offer.rooms) || 1} room${Number(offer.rooms) === 1 ? '' : 's'} • ${Number(offer.adults) || 1} adult${Number(offer.adults) === 1 ? '' : 's'} • ${estimated ? 'Estimate only — not live inventory or a booking quote.' : `${escapeHtml(offer.provider || 'Provider')} live offer`}</p>
      </article>`;
  }).join('') : '<div class="nx-empty">No hotel result available for this search.</div>';
}

function showEstimate(root, query, reason = '') {
  const c = controls(root);
  const s = state(root);
  s.offers = estimateOffers(query);
  s.sort = 'total';
  s.mode = 'estimate';
  c.city.textContent = query.destination;
  c.provider.textContent = 'Free indicative planning estimates • no live inventory connection';
  c.count.textContent = `${s.offers.length} ESTIMATES`;
  c.summary.hidden = false;
  paint(root);
  c.status.textContent = reason
    ? `Live hotel connection unavailable (${reason}). Showing free indicative estimates instead.`
    : 'Free indicative hotel estimates ready. Live provider results will replace them automatically when available.';
}

async function searchHotels(root) {
  const c = controls(root);
  const query = {
    destination: c.destination?.value.trim() || '',
    checkIn: c.checkIn?.value || '',
    checkOut: c.checkOut?.value || '',
    adults: Number(c.adults?.value) || 1,
    rooms: Number(c.rooms?.value) || 1,
    currency: c.currency?.value || 'PKR'
  };
  const nights = nightsBetween(query.checkIn, query.checkOut);

  if (!query.destination || !query.checkIn || !query.checkOut) {
    c.status.textContent = 'Enter destination, check-in and check-out dates.';
    return;
  }
  if (nights < 1) {
    c.status.textContent = 'Check-out must be after check-in.';
    return;
  }
  if (nights > 60) {
    c.status.textContent = 'Please keep the stay to 60 nights or fewer.';
    return;
  }

  c.search.disabled = true;
  c.search.textContent = 'CHECKING LIVE + FREE OPTIONS…';
  showEstimate(root, query);
  c.status.textContent = 'Free estimate is ready. Checking secure hotel providers in the background…';

  try {
    await timeout(requireFirebaseUser(), 4500);
    const call = httpsCallable(functions, 'searchWorldwideHotels');
    const response = await timeout(call({
      destination: query.destination,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      adults: query.adults,
      rooms: query.rooms,
      currency: query.currency
    }));
    const data = response?.data || {};
    const live = data.ok === true && Array.isArray(data.offers)
      ? data.offers.filter(item => item && item.live === true)
      : [];

    if (!live.length) {
      showEstimate(root, query, data.message || 'no bookable live hotel offers returned');
      return;
    }

    const s = state(root);
    s.offers = live;
    s.sort = 'total';
    s.mode = 'live';
    c.city.textContent = data.city?.label || query.destination;
    c.provider.textContent = `${data.provider || 'Secure hotel provider'} • ${Number(data.scannedHotels) || 0} properties checked${data.providerErrors?.length ? ` • ${data.providerErrors.length} provider warning${data.providerErrors.length === 1 ? '' : 's'}` : ''}`;
    c.count.textContent = `${live.length} LIVE HOTEL${live.length === 1 ? '' : 'S'}`;
    c.summary.hidden = false;
    paint(root);
    c.status.textContent = `${live.length} live hotel offer${live.length === 1 ? '' : 's'} returned. Live data has replaced the indicative estimate.`;
  } catch (error) {
    showEstimate(root, query, errorText(error));
    console.warn('[NexusNova Fresh] worldwide hotel search:', error);
  } finally {
    c.search.disabled = false;
    c.search.textContent = 'SEARCH HOTELS';
  }
}

function installHotelDelegates() {
  if (window.__nnTravelHotelDelegatesV2) return;
  window.__nnTravelHotelDelegatesV2 = true;

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    const root = event.target.closest('[data-nn-hotel-root]');
    if (!button || !root) return;

    if (button.matches('[data-hotel-search]')) {
      event.preventDefault();
      searchHotels(root);
      return;
    }
    if (button.matches('[data-hotel-sort]')) {
      event.preventDefault();
      const s = state(root);
      s.sort = button.dataset.hotelSort || 'total';
      paint(root);
    }
  });

  document.addEventListener('change', event => {
    const root = event.target.closest('[data-nn-hotel-root]');
    if (!root || !event.target.matches('[data-hotel-checkin]')) return;
    const checkOut = root.querySelector('[data-hotel-checkout]');
    if (!checkOut) return;
    const checkInValue = event.target.value || futureDate(1);
    const base = Date.parse(`${checkInValue}T00:00:00Z`);
    const nextDay = new Date(base + DAY_MS).toISOString().slice(0, 10);
    checkOut.min = nextDay;
    if (!checkOut.value || checkOut.value <= checkInValue) {
      checkOut.value = new Date(base + 3 * DAY_MS).toISOString().slice(0, 10);
    }
  });
}

export function renderTravelHotelsPanel() {
  installHotelDelegates();

  const root = node(`
    <p class="nx-eyebrow">HOTELS • LIVE WHEN CONNECTED</p>
    <strong>Hotel search that remains useful offline</strong>
    <p class="nx-tool-meta">NexusNova shows a free indicative stay estimate immediately, then replaces it with real live availability if the secure hotel provider responds.</p>

    <label class="nx-field"><span>Destination</span><input maxlength="80" autocomplete="off" data-hotel-destination placeholder="Paris or PAR"></label>

    <div class="nx-two-col">
      <label class="nx-field"><span>Check-in</span><input type="date" data-hotel-checkin></label>
      <label class="nx-field"><span>Check-out</span><input type="date" data-hotel-checkout></label>
    </div>

    <div class="nx-two-col">
      <label class="nx-field"><span>Adults</span>
        <select data-hotel-adults>${Array.from({ length: 9 }, (_, index) => `<option value="${index + 1}"${index === 1 ? ' selected' : ''}>${index + 1}</option>`).join('')}</select>
      </label>
      <label class="nx-field"><span>Rooms</span>
        <select data-hotel-rooms>${Array.from({ length: 4 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('')}</select>
      </label>
    </div>

    <label class="nx-field"><span>Display currency</span>
      <select data-hotel-currency>
        ${Object.keys(CURRENCY_SCALE).map(code => `<option value="${code}">${code}</option>`).join('')}
      </select>
    </label>

    <button class="nx-primary" type="button" data-hotel-search>SEARCH HOTELS</button>
    <p class="nx-tool-meta" role="status" aria-live="polite" data-hotel-status>Ready. The free estimate path works without a paid provider.</p>

    <div data-hotel-summary hidden style="margin-top:12px">
      <div class="nx-list-card__head">
        <div><strong data-hotel-city>—</strong><p class="nx-tool-meta" data-hotel-provider>—</p></div>
        <span class="nx-badge" data-hotel-count>0 RESULTS</span>
      </div>
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-hotel-sort="total">LOWEST TOTAL</button>
        <button type="button" data-hotel-sort="night">LOWEST / NIGHT</button>
      </div>
    </div>

    <div class="nx-stack" data-hotel-results style="margin-top:12px"></div>
  `);

  const c = controls(root);
  c.checkIn.min = futureDate(1);
  c.checkIn.value = futureDate(7);
  c.checkOut.min = futureDate(8);
  c.checkOut.value = futureDate(10);
  c.currency.value = 'PKR';

  return root;
}
