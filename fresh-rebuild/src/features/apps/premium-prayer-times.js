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
  if (!match) return { clock:'--:--', suffix:'' };
  const h = Number(match[1]);
  return { clock:`${String(h % 12 || 12).padStart(2, '0')}:${match[2]}`, suffix:h >= 12 ? 'PM' : 'AM' };
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

function compactPlace(parts) {
  const seen = new Set();
  return parts
    .map(value => String(value || '').trim())
    .filter(value => value && !seen.has(value.toLowerCase()) && seen.add(value.toLowerCase()))
    .slice(0, 3)
    .join(', ');
}

async function reversePlace(lat, lon) {
  try {
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`, { cache:'no-store' });
    if (response.ok) {
      const json = await response.json();
      const place = compactPlace([
        json.locality || json.city || json.principalSubdivision,
        json.principalSubdivision,
        json.countryName
      ]);
      if (place) return place;
    }
  } catch (error) {
    console.warn('[NexusNova Premium] prayer reverse geocode primary:', error);
  }

  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { cache:'no-store' });
    if (response.ok) {
      const json = await response.json();
      const props = json?.features?.[0]?.properties || {};
      const place = compactPlace([
        props.city || props.town || props.village || props.name,
        props.state,
        props.country
      ]);
      if (place) return place;
    }
  } catch (error) {
    console.warn('[NexusNova Premium] prayer reverse geocode fallback:', error);
  }

  return 'Current location';
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

function controlArt(index, className = '') {
  const glyphs = [
    '<path d="M39 13 20 32l19 19" fill="none" stroke="#f3f7fb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M18 53V17l28 36V17" fill="none" stroke="#18dff2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 4l2.8 8.2L43 15l-8.2 2.8L32 26l-2.8-8.2L21 15l8.2-2.8L32 4Z" fill="#64f5ff"/><circle cx="32" cy="15" r="2.2" fill="#fff"/>',
    '<rect x="13" y="16" width="38" height="36" rx="6" fill="none" stroke="#f2f6fb" stroke-width="4"/><path d="M13 26h38M22 11v10M42 11v10" fill="none" stroke="#f2f6fb" stroke-width="4" stroke-linecap="round"/><path d="M21 34h4m7 0h4m7 0h2M21 42h4m7 0h4m7 0h2" stroke="#b9d9ee" stroke-width="3" stroke-linecap="round"/>',
    '<circle cx="32" cy="17" r="4.5" fill="#f4f7fb"/><circle cx="32" cy="32" r="4.5" fill="#f4f7fb"/><circle cx="32" cy="47" r="4.5" fill="#f4f7fb"/>',
    '<path d="M32 8c-10.8 0-19.5 8.7-19.5 19.5C12.5 42 32 57 32 57s19.5-15 19.5-29.5C51.5 16.7 42.8 8 32 8Z" fill="#5cecff"/><circle cx="32" cy="27.5" r="8" fill="#083044"/>',
    '<circle cx="32" cy="32" r="13" fill="none" stroke="#dff7ff" stroke-width="5"/><circle cx="32" cy="32" r="4" fill="#69eaff"/><path d="M32 7v11M32 46v11M7 32h11M46 32h11" stroke="#dff7ff" stroke-width="5" stroke-linecap="round"/>'
  ];
  const safe = Math.max(0, Math.min(5, Number(index) || 0));
  return `<svg class="nxprayer-control-art nxprayer-control-art--${safe}${className ? ` ${className}` : ''}" viewBox="0 0 64 64" aria-hidden="true" focusable="false" style="background:none">${glyphs[safe]}</svg>`;
}

function prayerIcon(index, className = 'nxprayer-icon', extra = '') {
  const safe = Math.max(0, Math.min(5, Number(index) || 0));
  return `<span class="${className} nxprayer-prayer-art nxprayer-prayer-art--${safe}" ${extra} aria-hidden="true"></span>`;
}

export function renderPrayerTimesPremium() {
  const root = node(`
    <section class="nxprayer-console nxprayer-console--selected">
      <header class="nxprayer-topbar">
        <button class="nxprayer-back" type="button" data-prayer-back aria-label="Back">${controlArt(0)}</button>
        <div class="nxprayer-brandmark" aria-hidden="true">${controlArt(1, 'nxprayer-brand-art')}</div>
        <div class="nxprayer-brandcopy">
          <b>NexusNova</b>
          <strong>Prayer Times</strong>
          <span>Daily prayer schedule</span>
        </div>
        <div class="nxprayer-topactions">
          <button class="nxprayer-calendar" type="button" aria-label="Prayer calendar">${controlArt(2)}</button>
          <button class="nxprayer-menu" type="button" aria-label="Prayer options">${controlArt(3)}</button>
        </div>
      </header>

      <section class="nxprayer-citybox">
        <div class="nxprayer-locationrow">
          <div class="nxprayer-locationinput">
            ${controlArt(4, 'nxprayer-location-art')}
            <input type="search" maxlength="100" autocomplete="off" data-prayer-search placeholder="Search city, town or country" aria-label="Prayer location">
            <button class="nxprayer-chevron" type="button" data-prayer-search-go aria-label="Search city"><span aria-hidden="true"></span></button>
          </div>
          <button class="nxprayer-gps" type="button" data-prayer-gps aria-label="Use GPS">${controlArt(5)}</button>
        </div>
        <select class="nxprayer-results" data-prayer-results hidden aria-label="Prayer city search results"></select>
      </section>

      <div class="nxprayer-datebar">
        <span><b data-prayer-date>Loading date…</b><i>/</i><b data-prayer-hijri>—</b></span>
        <small>Calculation: <em>Muslim World League</em></small>
      </div>

      <section class="nxprayer-grid" data-prayer-list></section>

      <section class="nxprayer-next">
        <div class="nxprayer-next-orbit">${prayerIcon(0, 'nxprayer-next-icon', 'data-prayer-next-icon')}</div>
        <div class="nxprayer-next-copy">
          <span>NEXT PRAYER</span>
          <strong data-prayer-next>—</strong>
          <div class="nxprayer-progress"><i data-prayer-progress></i><b aria-hidden="true"></b></div>
          <small data-prayer-next-caption>Live countdown</small>
        </div>
        <b data-prayer-countdown>--:--:--</b>
      </section>

      <p class="nxpi-status" data-prayer-status>Choose a city or use GPS. Prayer times are loaded live.</p>
    </section>
  `);

  document.body.classList.add('nx-prayer-immersive');
  queueMicrotask(() => root.closest('.nx-screen')?.classList.add('nx-prayer-screen'));

  const search = root.querySelector('[data-prayer-search]');
  const results = root.querySelector('[data-prayer-results]');
  const dateEl = root.querySelector('[data-prayer-date]');
  const hijriEl = root.querySelector('[data-prayer-hijri]');
  const list = root.querySelector('[data-prayer-list]');
  const nextEl = root.querySelector('[data-prayer-next]');
  const nextIcon = root.querySelector('[data-prayer-next-icon]');
  const nextCaption = root.querySelector('[data-prayer-next-caption]');
  const countdownEl = root.querySelector('[data-prayer-countdown]');
  const progressEl = root.querySelector('[data-prayer-progress]');
  const progressDot = root.querySelector('.nxprayer-progress>b');
  const status = root.querySelector('[data-prayer-status]');
  let searchRows = [];
  let state = { lat:24.8607, lon:67.0011, place:'Karachi, Pakistan' };
  let timings = null;
  let timer = null;
  let busy = false;

  const showStatus = message => {
    status.hidden = false;
    status.textContent = message;
  };

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

    const displayName = nextName === 'Dhuhr' ? 'Zuhr' : nextName;
    nextEl.textContent = `${displayName} at ${to12Hour(timings[nextName])}`;
    countdownEl.textContent = formatCountdown(nextAt - now);
    progressEl.style.width = `${progress.toFixed(1)}%`;
    progressDot.style.left = `${progress.toFixed(1)}%`;
    nextCaption.textContent = `Time remaining until ${displayName}`;

    const nextIndex = Math.max(0, PRAYERS.findIndex(([key]) => key === nextName));
    nextIcon.className = `nxprayer-next-icon nxprayer-prayer-art nxprayer-prayer-art--${nextIndex}`;
    root.querySelectorAll('[data-prayer-key]').forEach(card => card.classList.toggle('is-next', card.dataset.prayerKey === nextName));
    root.querySelectorAll('[data-prayer-delta]').forEach(deltaEl => {
      const occurrence = nextOccurrence(timings[deltaEl.dataset.prayerDelta], now);
      deltaEl.textContent = occurrence ? `+${formatCountdown(occurrence - now)}` : '—';
    });
  };

  const drawTimings = () => {
    list.innerHTML = PRAYERS.map(([key, label], index) => {
      const parts = timeParts(timings?.[key]);
      return `<article class="nxprayer-card nxprayer-card--${index}" data-prayer-key="${key}">
        ${prayerIcon(index)}
        <span>${label}</span>
        <i class="nxprayer-divider" aria-hidden="true"><b></b></i>
        <strong><b>${escapeHtml(parts.clock)}</b><small>${escapeHtml(parts.suffix)}</small></strong>
        <em data-prayer-delta="${key}">—</em>
        <i class="nxprayer-ornament" aria-hidden="true"></i>
      </article>`;
    }).join('');
    paintNext();
  };

  const load = async ({ lat, lon, place }) => {
    if (busy) return;
    busy = true;
    showStatus(`Loading prayer times for ${place}…`);
    try {
      const now = new Date();
      const dateParam = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const response = await fetch(`https://api.aladhan.com/v1/timings/${dateParam}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&method=3`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Prayer HTTP ${response.status}`);
      const json = await response.json();
      timings = json?.data?.timings || null;
      if (!timings) throw new Error('Prayer timings missing');
      state = { lat:Number(lat), lon:Number(lon), place:String(place || 'Selected city') };
      search.value = state.place;
      dateEl.textContent = String(json?.data?.date?.readable || now.toLocaleDateString()).toUpperCase();
      const hijri = json?.data?.date?.hijri;
      hijriEl.textContent = hijri ? `${hijri.day} ${String(hijri.month?.en || '').toUpperCase()} ${hijri.year} AH` : 'LIVE CALCULATION';
      drawTimings();
      status.hidden = true;
      clearInterval(timer);
      timer = setInterval(paintNext, 1000);
    } catch (error) {
      showStatus('Prayer times are unavailable right now. Check the connection and try again.');
      console.warn('[NexusNova Premium] prayer times:', error);
    } finally {
      busy = false;
    }
  };

  const loadGps = async () => {
    showStatus('Getting your GPS location…');
    try {
      const pos = await currentPosition();
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const place = await reversePlace(lat, lon);
      await load({ lat, lon, place });
    } catch (error) {
      showStatus('GPS permission is unavailable. Search for a city instead.');
      console.warn('[NexusNova Premium] prayer GPS:', error);
    }
  };

  const findPlaces = async () => {
    const query = search.value.trim();
    if (query.length < 2) {
      showStatus('Enter at least 2 characters to search a city.');
      return;
    }
    showStatus(`Searching ${query}…`);
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=12&language=en&format=json`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`);
      const json = await response.json();
      searchRows = Array.isArray(json.results) ? json.results : [];
      if (!searchRows.length) {
        results.hidden = true;
        showStatus('No matching city found.');
        return;
      }
      results.innerHTML = searchRows.map((item, index) => `<option value="${index}">${escapeHtml(compactPlace([item.name, item.admin1, item.country]))}</option>`).join('');
      results.hidden = false;
      const first = searchRows[0];
      await load({ lat:first.latitude, lon:first.longitude, place:compactPlace([first.name, first.admin1, first.country]) });
    } catch (error) {
      showStatus('City search is unavailable right now.');
      console.warn('[NexusNova Premium] prayer city search:', error);
    }
  };

  root.querySelector('[data-prayer-back]').addEventListener('click', () => root.closest('.nx-screen')?.querySelector('[data-app-back]')?.click());
  root.querySelector('[data-prayer-search-go]').addEventListener('click', findPlaces);
  search.addEventListener('keydown', event => { if (event.key === 'Enter') findPlaces(); });
  results.addEventListener('change', () => {
    const item = searchRows[Number(results.value)];
    if (!item) return;
    load({ lat:item.latitude, lon:item.longitude, place:compactPlace([item.name, item.admin1, item.country]) });
  });
  root.querySelector('[data-prayer-gps]').addEventListener('click', loadGps);

  loadGps().catch(() => load(state));

  root.__cleanup = () => {
    clearInterval(timer);
    root.closest('.nx-screen')?.classList.remove('nx-prayer-screen');
    document.body.classList.remove('nx-prayer-immersive');
  };
  return root;
}

export const premiumPrayerRenderers = Object.freeze({ 'prayer-times': renderPrayerTimesPremium });