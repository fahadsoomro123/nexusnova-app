import { escapeHtml } from '../../core/local-store.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body nx-premium-instruments nx-prayer-premium';
  root.innerHTML = html;
  return root;
}

function currentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60000,
      ...options
    });
  });
}

function timeParts(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { clock: '--:--', suffix: '' };
  const h = Number(match[1]);
  return {
    clock: `${String(h % 12 || 12).padStart(2, '0')}:${match[2]}`,
    suffix: h >= 12 ? 'PM' : 'AM'
  };
}

function to12Hour(value) {
  const parts = timeParts(value);
  return `${parts.clock}${parts.suffix ? ` ${parts.suffix}` : ''}`;
}

function timeToday(value, addDays = 0) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d;
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function nextOccurrence(value, now = new Date()) {
  let at = timeToday(value);
  if (!at) return null;
  if (at <= now) at = timeToday(value, 1);
  return at;
}

const PRAYERS = [
  ['Fajr', 'FAJR'],
  ['Sunrise', 'SUNRISE'],
  ['Dhuhr', 'ZUHR'],
  ['Asr', 'ASR'],
  ['Maghrib', 'MAGHRIB'],
  ['Isha', 'ISHA']
];

const NEXT_PRAYER_SEQUENCE = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export function renderPrayerTimesPremium() {
  const root = node(`
    <section class="nxprayer-console nxprayer-console--selected">
      <header class="nxprayer-brand">
        <div class="nxprayer-brandmark" aria-hidden="true">N</div>
        <div class="nxprayer-brandcopy">
          <b>NexusNova</b>
          <strong>Prayer Times</strong>
          <span>Daily prayer schedule</span>
        </div>
        <em>MUSLIM WORLD LEAGUE</em>
      </header>

      <section class="nxprayer-citybox">
        <div class="nxprayer-locationrow">
          <label class="nxprayer-locationinput">
            <i aria-hidden="true">●</i>
            <input type="search" maxlength="100" autocomplete="off" data-prayer-search placeholder="Search city, town or country">
          </label>
          <button class="nxprayer-gps" type="button" data-prayer-gps aria-label="Use GPS">◎</button>
        </div>
        <div class="nxprayer-cityactions">
          <button class="nxpi-chip" type="button" data-prayer-search-go>SEARCH CITY</button>
          <select data-prayer-results hidden aria-label="Prayer city search results"></select>
        </div>
        <div class="nxprayer-selected"><span>LOCATION</span><strong data-prayer-place>Locating…</strong></div>
      </section>

      <div class="nxprayer-datebar">
        <span><b data-prayer-date>Loading date…</b><i>/</i><b data-prayer-hijri>—</b></span>
        <small>Calculation: <em>Muslim World League</em></small>
      </div>

      <section class="nxprayer-grid" data-prayer-list></section>

      <section class="nxprayer-next">
        <div class="nxprayer-next-icon nxprayer-icon--0" data-prayer-next-icon aria-hidden="true"></div>
        <div class="nxprayer-next-copy">
          <span>NEXT PRAYER</span>
          <strong data-prayer-next>—</strong>
          <div class="nxprayer-progress"><i data-prayer-progress></i></div>
          <small data-prayer-next-caption>Live countdown</small>
        </div>
        <b data-prayer-countdown>--:--:--</b>
      </section>

      <p class="nxpi-status" data-prayer-status>Choose a city or use GPS. Prayer times are loaded live.</p>
    </section>
  `);

  const search = root.querySelector('[data-prayer-search]');
  const results = root.querySelector('[data-prayer-results]');
  const placeEl = root.querySelector('[data-prayer-place]');
  const dateEl = root.querySelector('[data-prayer-date]');
  const hijriEl = root.querySelector('[data-prayer-hijri]');
  const list = root.querySelector('[data-prayer-list]');
  const nextEl = root.querySelector('[data-prayer-next]');
  const nextIcon = root.querySelector('[data-prayer-next-icon]');
  const nextCaption = root.querySelector('[data-prayer-next-caption]');
  const countdownEl = root.querySelector('[data-prayer-countdown]');
  const progressEl = root.querySelector('[data-prayer-progress]');
  const status = root.querySelector('[data-prayer-status]');
  let searchRows = [];
  let state = { lat:24.8607, lon:67.0011, place:'Karachi, Pakistan' };
  let timings = null;
  let timer = null;
  let busy = false;

  const paintNext = () => {
    if (!timings) return;
    const now = new Date();
    let nextName = NEXT_PRAYER_SEQUENCE.find(name => {
      const at = timeToday(timings[name]);
      return at && at > now;
    });
    let nextAt = nextName ? timeToday(timings[nextName]) : timeToday(timings.Fajr, 1);
    if (!nextName) nextName = 'Fajr';
    if (!nextAt) return;

    const previousCandidates = NEXT_PRAYER_SEQUENCE
      .map(name => ({ name, at:timeToday(timings[name]) }))
      .filter(row => row.at && row.at <= now);
    const previousAt = previousCandidates.length ? previousCandidates[previousCandidates.length - 1].at : timeToday(timings.Isha, -1);
    const span = Math.max(1, nextAt - previousAt);
    const elapsed = Math.max(0, now - previousAt);
    const progress = Math.max(0, Math.min(100, elapsed / span * 100));

    nextEl.textContent = `${nextName === 'Dhuhr' ? 'Zuhr' : nextName} at ${to12Hour(timings[nextName])}`;
    countdownEl.textContent = formatCountdown(nextAt - now);
    progressEl.style.width = `${progress.toFixed(1)}%`;
    nextCaption.textContent = `Time remaining until ${nextName === 'Dhuhr' ? 'Zuhr' : nextName}`;

    const nextIndex = Math.max(0, PRAYERS.findIndex(([key]) => key === nextName));
    nextIcon.className = `nxprayer-next-icon nxprayer-icon--${nextIndex}`;
    root.querySelectorAll('[data-prayer-key]').forEach(card => {
      card.classList.toggle('is-next', card.dataset.prayerKey === nextName);
    });

    root.querySelectorAll('[data-prayer-delta]').forEach(deltaEl => {
      const key = deltaEl.dataset.prayerDelta;
      const occurrence = nextOccurrence(timings[key], now);
      deltaEl.textContent = occurrence ? `+${formatCountdown(occurrence - now)}` : '—';
    });
  };

  const drawTimings = () => {
    list.innerHTML = PRAYERS.map(([key, label], index) => {
      const parts = timeParts(timings?.[key]);
      return `
        <article class="nxprayer-card nxprayer-card--${index}" data-prayer-key="${key}">
          <b class="nxprayer-icon nxprayer-icon--${index}" aria-hidden="true"></b>
          <span>${label}</span>
          <i class="nxprayer-divider" aria-hidden="true"></i>
          <strong><b>${escapeHtml(parts.clock)}</b><small>${escapeHtml(parts.suffix)}</small></strong>
          <em data-prayer-delta="${key}">—</em>
          <i class="nxprayer-ornament" aria-hidden="true"></i>
        </article>
      `;
    }).join('');
    paintNext();
  };

  const load = async ({ lat, lon, place }) => {
    if (busy) return;
    busy = true;
    status.textContent = `Loading prayer times for ${place}…`;
    try {
      const now = new Date();
      const dateParam = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const response = await fetch(`https://api.aladhan.com/v1/timings/${dateParam}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&method=3`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Prayer HTTP ${response.status}`);
      const json = await response.json();
      timings = json?.data?.timings || null;
      if (!timings) throw new Error('Prayer timings missing');
      state = { lat:Number(lat), lon:Number(lon), place:String(place || 'Selected city') };
      placeEl.textContent = state.place;
      dateEl.textContent = String(json?.data?.date?.readable || now.toLocaleDateString()).toUpperCase();
      const hijri = json?.data?.date?.hijri;
      hijriEl.textContent = hijri ? `${hijri.day} ${String(hijri.month?.en || '').toUpperCase()} ${hijri.year} AH` : 'LIVE CALCULATION';
      drawTimings();
      status.textContent = `${state.place} • calculation: Muslim World League`;
      clearInterval(timer);
      timer = setInterval(paintNext, 1000);
    } catch (error) {
      status.textContent = 'Prayer times are unavailable right now. Check the connection and try again.';
      console.warn('[NexusNova Premium] prayer times:', error);
    } finally {
      busy = false;
    }
  };

  const findPlaces = async () => {
    const query = search.value.trim();
    if (query.length < 2) {
      status.textContent = 'Enter at least 2 characters to search a city.';
      return;
    }
    status.textContent = `Searching ${query}…`;
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=12&language=en&format=json`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`);
      const json = await response.json();
      searchRows = Array.isArray(json.results) ? json.results : [];
      if (!searchRows.length) {
        results.hidden = true;
        status.textContent = 'No matching city found.';
        return;
      }
      results.innerHTML = searchRows.map((item, index) => {
        const detail = [item.name, item.admin1, item.country].filter(Boolean).join(', ');
        return `<option value="${index}">${escapeHtml(detail)}</option>`;
      }).join('');
      results.hidden = false;
      const first = searchRows[0];
      await load({ lat:first.latitude, lon:first.longitude, place:[first.name, first.admin1, first.country].filter(Boolean).join(', ') });
    } catch (error) {
      status.textContent = 'City search is unavailable right now.';
      console.warn('[NexusNova Premium] prayer city search:', error);
    }
  };

  root.querySelector('[data-prayer-search-go]').addEventListener('click', findPlaces);
  search.addEventListener('keydown', event => { if (event.key === 'Enter') findPlaces(); });
  results.addEventListener('change', () => {
    const item = searchRows[Number(results.value)];
    if (!item) return;
    load({ lat:item.latitude, lon:item.longitude, place:[item.name, item.admin1, item.country].filter(Boolean).join(', ') });
  });
  root.querySelector('[data-prayer-gps]').addEventListener('click', async () => {
    status.textContent = 'Getting your GPS location…';
    try {
      const pos = await currentPosition();
      await load({ lat:pos.coords.latitude, lon:pos.coords.longitude, place:'Current location' });
    } catch {
      status.textContent = 'GPS permission is unavailable. Search for a city instead.';
    }
  });

  currentPosition().then(pos => load({ lat:pos.coords.latitude, lon:pos.coords.longitude, place:'Current location' })).catch(() => load(state));

  root.__cleanup = () => clearInterval(timer);
  return root;
}

export const premiumPrayerRenderers = Object.freeze({ 'prayer-times': renderPrayerTimesPremium });
