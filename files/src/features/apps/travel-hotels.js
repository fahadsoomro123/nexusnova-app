import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml } from '../../core/local-store.js';

const functions = getFunctions(firebaseApp, 'us-central1');

function node(html) {
  const root = document.createElement('section');
  root.className = 'nx-tool-card';
  root.innerHTML = html;
  return root;
}

function futureDate(days) {
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

function errorText(error) {
  return String(error?.message || error || 'Hotel search failed.')
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '')
    .slice(0, 280);
}

function sorted(offers, mode) {
  const list = [...offers];
  if (mode === 'night') {
    return list.sort((a, b) => (Number(a.comparePerNight) || Number.MAX_VALUE) - (Number(b.comparePerNight) || Number.MAX_VALUE));
  }
  return list.sort((a, b) => (Number(a.compareTotal) || Number.MAX_VALUE) - (Number(b.compareTotal) || Number.MAX_VALUE));
}

export function renderTravelHotelsPanel() {
  const root = node(`
    <p class="nx-eyebrow">WORLDWIDE • LIVE HOTELS</p>
    <strong>Search real hotel availability inside NexusNova</strong>
    <p class="nx-tool-meta">Real-time room availability and prices come from the secure travel backend. No browser search, scraped price or invented hotel rate is used.</p>

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

    <label class="nx-field"><span>Compare currency</span>
      <select data-hotel-currency>
        ${['PKR','USD','EUR','GBP','AED','SAR','CAD','AUD','JPY','CNY','INR','TRY'].map(code => `<option value="${code}">${code}</option>`).join('')}
      </select>
    </label>

    <button class="nx-primary" type="button" data-hotel-search>SEARCH LIVE HOTELS</button>
    <p class="nx-tool-meta" data-hotel-status>Ready for worldwide hotel search.</p>

    <div data-hotel-summary hidden style="margin-top:12px">
      <div class="nx-list-card__head">
        <div><strong data-hotel-city>—</strong><p class="nx-tool-meta" data-hotel-provider>—</p></div>
        <span class="nx-badge" data-hotel-count>0 HOTELS</span>
      </div>
      <div class="nx-action-row">
        <button class="nx-primary" type="button" data-hotel-sort="total">LOWEST TOTAL</button>
        <button type="button" data-hotel-sort="night">LOWEST / NIGHT</button>
      </div>
    </div>

    <div class="nx-stack" data-hotel-results style="margin-top:12px"></div>
  `);

  const destination = root.querySelector('[data-hotel-destination]');
  const checkIn = root.querySelector('[data-hotel-checkin]');
  const checkOut = root.querySelector('[data-hotel-checkout]');
  const adults = root.querySelector('[data-hotel-adults]');
  const rooms = root.querySelector('[data-hotel-rooms]');
  const currency = root.querySelector('[data-hotel-currency]');
  const search = root.querySelector('[data-hotel-search]');
  const status = root.querySelector('[data-hotel-status]');
  const summary = root.querySelector('[data-hotel-summary]');
  const city = root.querySelector('[data-hotel-city]');
  const provider = root.querySelector('[data-hotel-provider]');
  const count = root.querySelector('[data-hotel-count]');
  const results = root.querySelector('[data-hotel-results]');
  let liveOffers = [];
  let currentSort = 'total';

  checkIn.min = futureDate(1);
  checkIn.value = futureDate(7);
  checkOut.min = futureDate(2);
  checkOut.value = futureDate(10);
  currency.value = 'PKR';

  checkIn.addEventListener('change', () => {
    checkOut.min = checkIn.value || futureDate(2);
    if (!checkOut.value || checkOut.value <= checkOut.min) {
      const base = Date.parse(`${checkIn.value || futureDate(1)}T00:00:00Z`);
      checkOut.value = new Date(base + 3 * 86_400_000).toISOString().slice(0, 10);
    }
  });

  const paint = () => {
    const offers = sorted(liveOffers, currentSort);
    root.querySelectorAll('[data-hotel-sort]').forEach(button => {
      button.classList.toggle('nx-primary', button.dataset.hotelSort === currentSort);
    });
    results.innerHTML = offers.length ? offers.map((offer, index) => {
      const total = money(offer.stayTotal, offer.currency);
      const perNight = money(offer.pricePerNight, offer.currency);
      const compare = offer.fxConverted && Number(offer.compareTotal) > 0
        ? `<p class="nx-tool-meta">≈ ${escapeHtml(money(offer.compareTotal, offer.compareCurrency))} comparison total • ${escapeHtml(money(offer.comparePerNight, offer.compareCurrency))}/night</p>`
        : '';
      const badge = index === 0
        ? `<span class="nx-badge good">${currentSort === 'night' ? 'LOWEST / NIGHT' : 'LOWEST TOTAL'}</span>`
        : `<span class="nx-badge">${escapeHtml(offer.provider || 'LIVE')}</span>`;
      return `
        <article class="nx-list-card">
          <div class="nx-list-card__head">
            <div><strong>${escapeHtml(offer.name || 'Hotel')}</strong><p class="nx-tool-meta">${escapeHtml(offer.cityCode || '')}${offer.countryCode ? ` • ${escapeHtml(offer.countryCode)}` : ''}</p></div>
            ${badge}
          </div>
          <div class="nx-summary-grid">
            <div><span>Stay total</span><strong>${escapeHtml(total)}</strong></div>
            <div><span>Per night</span><strong>${escapeHtml(perNight)}</strong></div>
            <div><span>Stay</span><strong>${Number(offer.nights) || 0} night${Number(offer.nights) === 1 ? '' : 's'}</strong></div>
          </div>
          ${compare}
          <p class="nx-tool-meta">${escapeHtml(offer.roomDescription || 'Room details supplied by provider.')}</p>
          <p class="nx-tool-meta">${escapeHtml(offer.cancellation || 'Cancellation policy not supplied.')}</p>
          <p class="nx-tool-meta">${Number(offer.rooms) || 1} room${Number(offer.rooms) === 1 ? '' : 's'} • ${Number(offer.adults) || 1} adult${Number(offer.adults) === 1 ? '' : 's'} • ${escapeHtml(offer.provider || 'Provider')} live offer</p>
        </article>`;
    }).join('') : '<div class="nx-empty">No live hotel offers returned for this search.</div>';
  };

  root.querySelectorAll('[data-hotel-sort]').forEach(button => button.addEventListener('click', () => {
    currentSort = button.dataset.hotelSort || 'total';
    paint();
  }));

  search.addEventListener('click', async () => {
    const place = destination.value.trim();
    if (!place || !checkIn.value || !checkOut.value) {
      status.textContent = 'Enter destination, check-in and check-out dates.';
      return;
    }
    if (checkOut.value <= checkIn.value) {
      status.textContent = 'Check-out must be after check-in.';
      return;
    }

    search.disabled = true;
    search.textContent = 'SEARCHING HOTELS…';
    summary.hidden = true;
    results.innerHTML = '<div class="nx-empty">Checking live hotel availability…</div>';
    status.textContent = 'Contacting secure hotel provider…';

    try {
      await requireFirebaseUser();
      const call = httpsCallable(functions, 'searchWorldwideHotels');
      const response = await call({
        destination: place,
        checkIn: checkIn.value,
        checkOut: checkOut.value,
        adults: Number(adults.value) || 1,
        rooms: Number(rooms.value) || 1,
        currency: currency.value
      });
      const data = response?.data || {};
      if (data.ok !== true) {
        liveOffers = [];
        results.innerHTML = '<div class="nx-empty">Secure hotel provider is not connected yet. NexusNova did not substitute browser search or fake prices.</div>';
        status.textContent = data.message || 'Worldwide hotel provider is not configured yet.';
        return;
      }

      liveOffers = Array.isArray(data.offers) ? data.offers.filter(item => item && item.live === true) : [];
      city.textContent = data.city?.label || place;
      provider.textContent = `${data.provider || 'Hotel provider'} • ${Number(data.scannedHotels) || 0} properties checked${data.providerErrors?.length ? ` • ${data.providerErrors.length} provider warning${data.providerErrors.length === 1 ? '' : 's'}` : ''}`;
      count.textContent = `${liveOffers.length} HOTEL${liveOffers.length === 1 ? '' : 'S'}`;
      summary.hidden = false;
      currentSort = 'total';
      paint();
      status.textContent = liveOffers.length
        ? `${liveOffers.length} live hotel offer${liveOffers.length === 1 ? '' : 's'} returned inside NexusNova.`
        : 'Provider responded but no available hotel matched these dates.';
    } catch (error) {
      liveOffers = [];
      results.innerHTML = '<div class="nx-empty">Live hotel search is unavailable right now.</div>';
      const message = errorText(error);
      status.textContent = /not-found|searchWorldwideHotels/i.test(message)
        ? 'Worldwide hotel backend is prepared but still needs deployment/provider connection.'
        : message;
      console.warn('[NexusNova Fresh] worldwide hotel search:', error);
    } finally {
      search.disabled = false;
      search.textContent = 'SEARCH LIVE HOTELS';
    }
  });

  return root;
}
