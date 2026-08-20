import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml } from '../../core/local-store.js';

const functions = getFunctions(firebaseApp, 'us-central1');

function futureDate(days = 1) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
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
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function timeText(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function durationText(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return '—';
  const h = Math.floor(value / 60);
  const m = value % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function errorText(error) {
  return String(error?.message || error || 'Ground transport search failed.')
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '')
    .slice(0, 280);
}

function sortedOffers(offers, mode) {
  const list = [...offers];
  if (mode === 'fastest') {
    return list.sort((a, b) => (Number(a.durationMinutes) || Number.MAX_VALUE) - (Number(b.durationMinutes) || Number.MAX_VALUE));
  }
  if (mode === 'earliest') {
    return list.sort((a, b) => Date.parse(a.departingAt) - Date.parse(b.departingAt));
  }
  return list.sort((a, b) => (Number(a.total) || Number.MAX_VALUE) - (Number(b.total) || Number.MAX_VALUE));
}

export function renderTravelGroundPanel() {
  const root = document.createElement('section');
  root.className = 'nx-tool-card';
  root.innerHTML = `
    <p class="nx-eyebrow">WORLDWIDE • RAIL + BUS</p>
    <strong>Compare live ground transport inside NexusNova</strong>
    <p class="nx-tool-meta">Search trains, buses and other supported ground connections through the secure partner API. City-name searches use a provider-supported geo radius; no web scraping or fake timetable is used.</p>

    <div class="nx-two-col">
      <label class="nx-field"><span>From</span><input maxlength="80" autocomplete="off" data-ground-origin placeholder="London"></label>
      <label class="nx-field"><span>To</span><input maxlength="80" autocomplete="off" data-ground-destination placeholder="Paris"></label>
    </div>

    <div class="nx-two-col">
      <label class="nx-field"><span>Date</span><input type="date" data-ground-date></label>
      <label class="nx-field"><span>From time</span><input type="time" value="06:00" data-ground-time></label>
    </div>

    <div class="nx-two-col">
      <label class="nx-field"><span>Adults</span>
        <select data-ground-adults>${Array.from({ length: 9 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('')}</select>
      </label>
      <label class="nx-field"><span>Currency</span>
        <select data-ground-currency>${['PKR','USD','EUR','GBP','AED','SAR','CAD','AUD','JPY','CNY','INR','TRY'].map(code => `<option value="${code}">${code}</option>`).join('')}</select>
      </label>
    </div>

    <button class="nx-primary" type="button" data-ground-search>SEARCH LIVE RAIL / BUS</button>
    <p class="nx-tool-meta" data-ground-status>Ready for worldwide ground-transport search.</p>

    <div data-ground-summary hidden style="margin-top:12px">
      <div class="nx-list-card__head">
        <div><strong data-ground-route>—</strong><p class="nx-tool-meta" data-ground-provider>—</p></div>
        <span class="nx-badge" data-ground-count>0 OPTIONS</span>
      </div>
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-ground-sort="cheapest">CHEAPEST</button>
        <button type="button" data-ground-sort="fastest">FASTEST</button>
        <button type="button" data-ground-sort="earliest">EARLIEST</button>
      </div>
    </div>

    <div class="nx-stack" data-ground-results style="margin-top:12px"></div>
    <p class="nx-tool-meta">Advanced partner codes are supported as <strong>city:CODE</strong> or <strong>station:CODE</strong>. City-name geo search can miss stations outside the provider's supported radius or carriers that do not support geo search.</p>
  `;

  const origin = root.querySelector('[data-ground-origin]');
  const destination = root.querySelector('[data-ground-destination]');
  const date = root.querySelector('[data-ground-date]');
  const time = root.querySelector('[data-ground-time]');
  const adults = root.querySelector('[data-ground-adults]');
  const currency = root.querySelector('[data-ground-currency]');
  const search = root.querySelector('[data-ground-search]');
  const status = root.querySelector('[data-ground-status]');
  const summary = root.querySelector('[data-ground-summary]');
  const route = root.querySelector('[data-ground-route]');
  const provider = root.querySelector('[data-ground-provider]');
  const count = root.querySelector('[data-ground-count]');
  const results = root.querySelector('[data-ground-results]');
  let liveOffers = [];
  let sortMode = 'cheapest';

  date.min = futureDate(1);
  date.value = futureDate(7);
  currency.value = 'PKR';

  const paint = () => {
    const offers = sortedOffers(liveOffers, sortMode);
    root.querySelectorAll('[data-ground-sort]').forEach(button => {
      button.classList.toggle('nx-primary', button.dataset.groundSort === sortMode);
    });
    results.innerHTML = offers.length ? offers.map((offer, index) => {
      const topBadge = index === 0
        ? `<span class="nx-badge good">${sortMode === 'fastest' ? 'FASTEST' : sortMode === 'earliest' ? 'EARLIEST' : 'CHEAPEST'}</span>`
        : `<span class="nx-badge">${escapeHtml(offer.mode || 'GROUND')}</span>`;
      const carriers = Array.isArray(offer.carrierNames) && offer.carrierNames.length
        ? offer.carrierNames.join(' + ')
        : offer.mode || 'Ground transport';
      const seats = Number.isFinite(Number(offer.seatsLeft))
        ? `${Number(offer.seatsLeft)} seat${Number(offer.seatsLeft) === 1 ? '' : 's'} left`
        : 'Seat count unavailable';
      return `
        <article class="nx-list-card">
          <div class="nx-list-card__head">
            <div><strong>${escapeHtml(carriers)}</strong><p class="nx-tool-meta">${escapeHtml(offer.provider || 'Provider')} • ${escapeHtml(offer.mode || 'Ground transport')}</p></div>
            ${topBadge}
          </div>
          <div class="nx-summary-grid">
            <div><span>Depart</span><strong>${escapeHtml(timeText(offer.departingAt))}</strong></div>
            <div><span>Arrive</span><strong>${escapeHtml(timeText(offer.arrivingAt))}</strong></div>
            <div><span>Duration</span><strong>${escapeHtml(durationText(offer.durationMinutes))}</strong></div>
          </div>
          <div class="nx-list-card__head" style="margin-top:10px">
            <div><span class="nx-tool-meta">Provider live fare</span><strong style="display:block;font-size:1.25rem">${escapeHtml(money(offer.total, offer.currency))}</strong></div>
            <span class="nx-badge">${offer.electronicTicket ? 'E-TICKET' : 'TICKET'}</span>
          </div>
          <p class="nx-tool-meta">${escapeHtml(offer.originLabel || '')} → ${escapeHtml(offer.destinationLabel || '')} • ${escapeHtml(seats)}</p>
        </article>`;
    }).join('') : '<div class="nx-empty">No live rail/bus options returned for this search.</div>';
  };

  root.querySelectorAll('[data-ground-sort]').forEach(button => button.addEventListener('click', () => {
    sortMode = button.dataset.groundSort || 'cheapest';
    paint();
  }));

  search.addEventListener('click', async () => {
    const from = origin.value.trim();
    const to = destination.value.trim();
    if (!from || !to || !date.value) {
      status.textContent = 'Enter origin, destination and travel date.';
      return;
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      status.textContent = 'Origin and destination must be different.';
      return;
    }

    search.disabled = true;
    search.textContent = 'SEARCHING RAIL / BUS…';
    summary.hidden = true;
    results.innerHTML = '<div class="nx-empty">Checking live ground-transport connections…</div>';
    status.textContent = 'Contacting secure ground-transport provider…';

    try {
      await requireFirebaseUser();
      const call = httpsCallable(functions, 'searchWorldwideGroundTransport');
      const response = await call({
        origin: from,
        destination: to,
        departureDate: date.value,
        departureTime: time.value || '00:00',
        adults: Number(adults.value) || 1,
        currency: currency.value
      });
      const data = response?.data || {};
      if (data.ok !== true) {
        liveOffers = [];
        results.innerHTML = '<div class="nx-empty">Secure rail/bus provider is not connected yet. NexusNova did not substitute browser search or fake fares.</div>';
        status.textContent = data.message || 'Worldwide ground-transport provider is not configured yet.';
        return;
      }

      liveOffers = Array.isArray(data.offers) ? data.offers.filter(item => item && item.live === true) : [];
      route.textContent = `${data.origin?.label || from} → ${data.destination?.label || to}`;
      provider.textContent = `${data.provider || 'Ground provider'}${data.geoSearch ? ` • geo search within ${Math.round((Number(data.geoRadiusMeters) || 0) / 1000)} km where supported` : ''}`;
      count.textContent = `${liveOffers.length} OPTION${liveOffers.length === 1 ? '' : 'S'}`;
      summary.hidden = false;
      sortMode = 'cheapest';
      paint();
      status.textContent = liveOffers.length
        ? `${liveOffers.length} live ground-transport option${liveOffers.length === 1 ? '' : 's'} returned inside NexusNova.`
        : 'Provider responded but no available rail/bus connection matched this search.';
    } catch (error) {
      liveOffers = [];
      results.innerHTML = '<div class="nx-empty">Live rail/bus search is unavailable right now.</div>';
      const message = errorText(error);
      status.textContent = /not-found|searchWorldwideGroundTransport/i.test(message)
        ? 'Worldwide rail/bus backend is prepared but still needs deployment/provider connection.'
        : message;
      console.warn('[NexusNova Fresh] worldwide ground transport search:', error);
    } finally {
      search.disabled = false;
      search.textContent = 'SEARCH LIVE RAIL / BUS';
    }
  });

  return root;
}
