import { escapeHtml } from '../../core/local-store.js';

function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
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
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 45000,
      ...options
    });
  });
}

function weatherMeta(code) {
  const n = Number(code);
  if (n === 0) return { key: 'clear', label: 'Clear sky' };
  if (n === 1) return { key: 'clear', label: 'Mostly clear' };
  if (n === 2) return { key: 'clouds', label: 'Partly cloudy' };
  if (n === 3) return { key: 'clouds', label: 'Overcast' };
  if (n === 45 || n === 48) return { key: 'fog', label: 'Fog' };
  if ([51, 53, 55, 56, 57].includes(n)) return { key: 'rain', label: 'Drizzle' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(n)) return { key: 'rain', label: n === 65 || n === 82 ? 'Heavy rain' : 'Light rain' };
  if ([71, 73, 75, 77, 85, 86].includes(n)) return { key: 'snow', label: 'Snow' };
  if ([95, 96, 99].includes(n)) return { key: 'storm', label: 'Thunderstorm' };
  return { key: 'clouds', label: 'Weather' };
}

function weatherIcon(code, night = false) {
  const key = weatherMeta(code).key;
  if (key === 'clear') return night ? '☾' : '☀';
  return ({ clouds:'☁', fog:'≋', rain:'🌧', snow:'❄', storm:'⛈' })[key] || '☁';
}

function localHour(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour:'2-digit', hourCycle:'h23' }).formatToParts(new Date());
    return Number(parts.find(part => part.type === 'hour')?.value);
  } catch {
    return new Date().getHours();
  }
}

function dateParamForZone(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year:'numeric', month:'numeric', day:'numeric' }).formatToParts(new Date());
    const get = type => Number(parts.find(part => part.type === type)?.value);
    const year = get('year'), month = get('month'), day = get('day');
    if (year > 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${day}-${month}-${year}`;
  } catch {}
  const now = new Date();
  return `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
}

function phaseFor(timeZone, isDay) {
  const hour = localHour(timeZone);
  if (!Number(isDay) && (hour >= 20 || hour < 5)) return 'night';
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 17 && hour < 20) return 'evening';
  if (!Number(isDay)) return 'night';
  return 'day';
}

function minutesFromIso(value) {
  const match = String(value || '').match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function celestialTrack(currentTime, sunrise, sunset, isDay) {
  const now = minutesFromIso(currentTime);
  const rise = minutesFromIso(sunrise);
  const set = minutesFromIso(sunset);
  let sunX = 78;
  let sunY = 18;
  let moonX = 76;
  let moonY = 20;

  if (now !== null && rise !== null && set !== null && set > rise) {
    if (Number(isDay)) {
      const progress = clamp((now - rise) / (set - rise), 0, 1);
      sunX = 10 + progress * 80;
      sunY = 68 - Math.sin(Math.PI * progress) * 54;
    } else {
      const nightLength = (1440 - set) + rise;
      const elapsed = now >= set ? now - set : (1440 - set) + now;
      const progress = clamp(elapsed / nightLength, 0, 1);
      moonX = 10 + progress * 80;
      moonY = 66 - Math.sin(Math.PI * progress) * 50;
    }
  }

  return { sunX, sunY, moonX, moonY };
}

function windDirection(degrees) {
  const points = ['N','NE','E','SE','S','SW','W','NW'];
  const d = ((Number(degrees) || 0) % 360 + 360) % 360;
  return points[Math.round(d / 45) % 8];
}

function windyUrl(latitude, longitude, overlay = 'radar') {
  const params = new URLSearchParams({
    lat: String(Number(latitude).toFixed(4)), lon: String(Number(longitude).toFixed(4)),
    detailLat: String(Number(latitude).toFixed(4)), detailLon: String(Number(longitude).toFixed(4)),
    zoom: overlay === 'radar' || overlay === 'satellite' ? '7' : '5', level:'surface', overlay,
    product:'ecmwf', menu:'', message:'false', marker:'true', calendar:'now',
    pressure: overlay === 'pressure' ? 'true' : '', type:'map', location:'coordinates', detail:'',
    metricWind:'km/h', metricTemp:'°C', metricRain:'mm', radarRange:'-1'
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}

function to12Hour(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '--:--';
  const h = Number(match[1]);
  return `${String(h % 12 || 12).padStart(2, '0')}:${match[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function renderWeatherPremium() {
  const root = node(`
    <section class="nxwx-shell nxwx-shell--selected" data-wx-shell data-condition="clouds" data-phase="day">
      <header class="nxwx-locationbar">
        <div><span>LIVE WEATHER</span><strong data-wx-place>Locating…</strong></div>
        <button class="nxpi-chip" type="button" data-wx-gps>USE GPS</button>
      </header>

      <div class="nxwx-search">
        <input type="search" maxlength="100" autocomplete="off" data-wx-search placeholder="Search city, town or place">
        <button class="nxpi-action nxpi-action--compact" type="button" data-wx-search-go>SEARCH</button>
      </div>
      <select class="nxwx-results" data-wx-results hidden aria-label="Weather search results"></select>

      <section class="nxwx-hero">
        <div class="nxwx-atmosphere" aria-hidden="true">
          <i class="nxwx-sun"></i><i class="nxwx-moon"></i><i class="nxwx-stars"></i>
          <i class="nxwx-cloud nxwx-cloud--one"></i><i class="nxwx-cloud nxwx-cloud--two"></i><i class="nxwx-cloud nxwx-cloud--three"></i>
          <i class="nxwx-rain"></i><i class="nxwx-snow"></i><i class="nxwx-lightning"></i><i class="nxwx-fog"></i>
        </div>
        <div class="nxwx-hero__content">
          <div>
            <span class="nxwx-kicker" data-wx-phase>LIVE CONDITIONS</span>
            <strong class="nxwx-temp" data-wx-temp>--°</strong>
            <p><b data-wx-condition>Loading weather…</b><span data-wx-hi-low>—</span></p>
          </div>
          <div class="nxwx-hero__badge"><span data-wx-icon>☁</span><small data-wx-localtime>—</small></div>
        </div>
      </section>

      <section class="nxwx-metrics">
        <article><span>FEELS</span><strong data-wx-feels>—</strong></article>
        <article><span>HUMIDITY</span><strong data-wx-humidity>—</strong></article>
        <article><span>WIND</span><strong data-wx-wind>—</strong><small data-wx-winddir>—</small></article>
        <article><span>GUSTS</span><strong data-wx-gust>—</strong></article>
        <article><span>PRESSURE</span><strong data-wx-pressure>—</strong></article>
        <article><span>CLOUDS</span><strong data-wx-clouds>—</strong></article>
      </section>

      <section class="nxwx-forecast-panel">
        <header><span>HOURLY FORECAST</span><small>Next hours</small></header>
        <div class="nxwx-forecast" data-wx-days></div>
      </section>

      <section class="nxwx-radar" data-wx-radar-shell>
        <header>
          <div><span>LIVE WEATHER MAP</span><strong>Radar & atmospheric layers</strong></div>
          <button class="nxpi-chip" type="button" data-wx-expand>EXPAND</button>
        </header>
        <div class="nxwx-layers" data-wx-layers>
          ${[['radar','RADAR'],['rain','RAIN'],['wind','WIND'],['clouds','CLOUDS'],['temp','TEMP'],['pressure','PRESSURE'],['satellite','SATELLITE']].map(([id,label], index) => `<button type="button" data-wx-layer="${id}" class="${index === 0 ? 'is-active' : ''}">${label}</button>`).join('')}
        </div>
        <div class="nxwx-mapframe"><iframe data-wx-radar title="Live interactive weather map" loading="lazy" allow="geolocation" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
        <footer>Interactive live map by Windy • select a layer above.</footer>
      </section>

      <section class="nxwx-prayer-strip">
        <header><span>PRAYER TIMES</span><strong data-wx-prayer-place>Current weather location</strong></header>
        <div data-wx-prayers><div class="nx-empty">Loading prayer times…</div></div>
      </section>

      <div class="nxwx-footer">
        <button class="nxpi-action" type="button" data-wx-refresh>REFRESH LIVE DATA</button>
        <p data-wx-status>Live forecast uses Open-Meteo. Search or GPS can change the location.</p>
      </div>
    </section>
  `, 'nx-weather-premium');

  const shell = root.querySelector('[data-wx-shell]');
  const radarShell = root.querySelector('[data-wx-radar-shell]');
  const radar = root.querySelector('[data-wx-radar]');
  const status = root.querySelector('[data-wx-status]');
  const search = root.querySelector('[data-wx-search]');
  const results = root.querySelector('[data-wx-results]');
  const prayerPlace = root.querySelector('[data-wx-prayer-place]');
  const prayerList = root.querySelector('[data-wx-prayers]');
  const refs = Object.fromEntries(['place','phase','temp','condition','hi-low','icon','localtime','feels','humidity','wind','winddir','gust','pressure','clouds','days'].map(key => [key, root.querySelector(`[data-wx-${key}]`)]));

  let state = { lat:24.8607, lon:67.0011, place:'Karachi', layer:'radar', timezone:'Asia/Karachi' };
  let searchRows = [];
  let cancelled = false;
  let weatherRevision = 0;
  let searchRevision = 0;
  let locationIntent = 0;
  let weatherController = null;
  let searchController = null;
  let prayerController = null;

  const paintRadar = () => {
    if (cancelled) return;
    radar.src = windyUrl(state.lat, state.lon, state.layer);
  };
  const setLayer = layer => {
    if (cancelled) return;
    state.layer = layer;
    root.querySelectorAll('[data-wx-layer]').forEach(button => button.classList.toggle('is-active', button.dataset.wxLayer === layer));
    paintRadar();
  };

  const loadPrayerStrip = async (lat, lon, place, timeZone, parentRevision) => {
    if (cancelled || parentRevision !== weatherRevision) return;
    prayerController?.abort();
    const controller = new AbortController();
    prayerController = controller;
    prayerPlace.textContent = place;
    try {
      const dateParam = dateParamForZone(timeZone);
      const response = await fetch(`https://api.aladhan.com/v1/timings/${dateParam}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&method=3`, { cache:'no-store', signal:controller.signal });
      if (!response.ok) throw new Error(`Prayer HTTP ${response.status}`);
      const json = await response.json();
      if (cancelled || parentRevision !== weatherRevision || controller.signal.aborted) return;
      const timings = json?.data?.timings || {};
      const rows = [['Fajr','◒'],['Sunrise','☀'],['Dhuhr','☀'],['Asr','☀'],['Maghrib','◉'],['Isha','☾']];
      prayerList.innerHTML = rows.map(([name, icon]) => `<article><b>${icon}</b><span>${name.toUpperCase()}</span><strong>${escapeHtml(to12Hour(timings[name]))}</strong></article>`).join('');
    } catch (error) {
      if (!cancelled && parentRevision === weatherRevision && error?.name !== 'AbortError') prayerList.innerHTML = '<div class="nx-empty">Prayer times unavailable.</div>';
    } finally {
      if (prayerController === controller) prayerController = null;
    }
  };

  const loadWeather = async ({ lat, lon, place }) => {
    if (cancelled) return;
    const revision = ++weatherRevision;
    weatherController?.abort();
    prayerController?.abort();
    const controller = new AbortController();
    weatherController = controller;
    status.textContent = `Loading live weather for ${place}…`;
    try {
      const params = new URLSearchParams({
        latitude:String(lat), longitude:String(lon),
        current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,surface_pressure,is_day',
        hourly:'temperature_2m,weather_code,precipitation_probability',
        daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
        timezone:'auto', forecast_days:'7', forecast_hours:'12'
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache:'no-store', signal:controller.signal });
      if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
      const data = await response.json();
      if (cancelled || revision !== weatherRevision || controller.signal.aborted) return;

      const current = data.current || {};
      const meta = weatherMeta(current.weather_code);
      const phase = phaseFor(data.timezone, current.is_day);
      const track = celestialTrack(current.time, data.daily?.sunrise?.[0], data.daily?.sunset?.[0], current.is_day);
      state = { ...state, lat:Number(lat), lon:Number(lon), place, timezone:data.timezone || state.timezone };
      shell.dataset.condition = meta.key;
      shell.dataset.phase = phase;
      shell.style.setProperty('--sun-x', `${track.sunX.toFixed(2)}%`);
      shell.style.setProperty('--sun-y', `${track.sunY.toFixed(2)}%`);
      shell.style.setProperty('--moon-x', `${track.moonX.toFixed(2)}%`);
      shell.style.setProperty('--moon-y', `${track.moonY.toFixed(2)}%`);
      shell.style.setProperty('--wx-cloud-cover', `${clamp(Number(current.cloud_cover) || 0, 0, 100)}%`);
      refs.place.textContent = place;
      refs.phase.textContent = `${phase.toUpperCase()} • LIVE CONDITIONS`;
      refs.temp.textContent = `${Math.round(Number(current.temperature_2m) || 0)}°`;
      refs.condition.textContent = meta.label;
      refs.icon.textContent = weatherIcon(current.weather_code, phase === 'night');
      refs.feels.textContent = `${Math.round(Number(current.apparent_temperature) || 0)}°`;
      refs.humidity.textContent = `${Math.round(Number(current.relative_humidity_2m) || 0)}%`;
      refs.wind.textContent = `${Math.round(Number(current.wind_speed_10m) || 0)} km/h`;
      refs.winddir.textContent = `${windDirection(current.wind_direction_10m)} ${Math.round(Number(current.wind_direction_10m) || 0)}°`;
      refs.gust.textContent = `${Math.round(Number(current.wind_gusts_10m) || 0)} km/h`;
      refs.pressure.textContent = `${Math.round(Number(current.surface_pressure) || 0)} hPa`;
      refs.clouds.textContent = `${Math.round(Number(current.cloud_cover) || 0)}%`;

      const max = data.daily?.temperature_2m_max?.[0];
      const min = data.daily?.temperature_2m_min?.[0];
      refs['hi-low'].textContent = `Feels like ${Math.round(Number(current.apparent_temperature) || 0)}° • H ${Math.round(Number(max) || 0)}° • L ${Math.round(Number(min) || 0)}°`;
      try {
        refs.localtime.textContent = new Intl.DateTimeFormat([], { timeZone:data.timezone, hour:'2-digit', minute:'2-digit' }).format(new Date());
      } catch {
        refs.localtime.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      }

      const hours = data.hourly?.time || [];
      refs.days.innerHTML = hours.slice(0, 9).map((time, index) => {
        const hourMatch = String(time || '').match(/T(\d{2}):(\d{2})/);
        const hour = hourMatch ? Number(hourMatch[1]) : 12;
        const label = index === 0 ? 'NOW' : to12Hour(hourMatch ? `${hourMatch[1]}:${hourMatch[2]}` : '--:--').replace(/:00\s/, ' ');
        const code = data.hourly.weather_code?.[index];
        const temp = Math.round(Number(data.hourly.temperature_2m?.[index]) || 0);
        const rain = Math.round(Number(data.hourly.precipitation_probability?.[index]) || 0);
        return `<article><span>${escapeHtml(label)}</span><b>${weatherIcon(code, hour >= 20 || hour < 6)}</b><strong>${temp}°</strong><small>💧 ${rain}%</small></article>`;
      }).join('');

      paintRadar();
      void loadPrayerStrip(lat, lon, place, state.timezone, revision);
      if (!cancelled && revision === weatherRevision) status.textContent = `Updated ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} • ${meta.label} • live location weather`;
    } catch (error) {
      if (!cancelled && revision === weatherRevision && error?.name !== 'AbortError') status.textContent = 'Live weather is unavailable right now. Check the connection and try again.';
      if (error?.name !== 'AbortError') console.warn('[NexusNova Premium] weather:', error);
    } finally {
      if (weatherController === controller) weatherController = null;
    }
  };

  const useGps = async () => {
    if (cancelled) return;
    const intent = ++locationIntent;
    searchController?.abort();
    status.textContent = 'Getting your current GPS location…';
    try {
      const position = await currentPosition({ enableHighAccuracy:false });
      if (cancelled || intent !== locationIntent) return;
      await loadWeather({ lat:position.coords.latitude, lon:position.coords.longitude, place:'Current location' });
    } catch {
      if (!cancelled && intent === locationIntent) status.textContent = 'GPS permission is unavailable. Search for a city instead.';
    }
  };

  const findPlaces = async () => {
    if (cancelled) return;
    const query = search.value.trim();
    if (query.length < 2) {
      status.textContent = 'Enter at least 2 characters to search a location.';
      return;
    }
    const intent = ++locationIntent;
    const revision = ++searchRevision;
    searchController?.abort();
    const controller = new AbortController();
    searchController = controller;
    status.textContent = `Searching ${query}…`;
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`, { cache:'no-store', signal:controller.signal });
      if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`);
      const json = await response.json();
      if (cancelled || intent !== locationIntent || revision !== searchRevision || controller.signal.aborted) return;
      searchRows = Array.isArray(json.results) ? json.results : [];
      if (!searchRows.length) {
        results.hidden = true;
        status.textContent = 'No matching place found.';
        return;
      }
      results.innerHTML = searchRows.map((item, index) => `<option value="${index}">${escapeHtml([item.name, item.admin1, item.country].filter(Boolean).join(', '))}</option>`).join('');
      results.hidden = false;
      const first = searchRows[0];
      await loadWeather({ lat:first.latitude, lon:first.longitude, place:[first.name, first.country].filter(Boolean).join(', ') });
    } catch (error) {
      if (!cancelled && intent === locationIntent && revision === searchRevision && error?.name !== 'AbortError') status.textContent = 'Location search is unavailable right now.';
      if (error?.name !== 'AbortError') console.warn('[NexusNova Premium] weather geocoding:', error);
    } finally {
      if (searchController === controller) searchController = null;
    }
  };

  root.querySelector('[data-wx-gps]').addEventListener('click', useGps);
  root.querySelector('[data-wx-search-go]').addEventListener('click', findPlaces);
  search.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findPlaces(); } });
  results.addEventListener('change', () => {
    if (cancelled) return;
    locationIntent += 1;
    searchRevision += 1;
    searchController?.abort();
    const item = searchRows[Number(results.value)];
    if (!item) return;
    void loadWeather({ lat:item.latitude, lon:item.longitude, place:[item.name, item.country].filter(Boolean).join(', ') });
  });
  root.querySelector('[data-wx-refresh]').addEventListener('click', () => loadWeather(state));
  root.querySelectorAll('[data-wx-layer]').forEach(button => button.addEventListener('click', () => setLayer(button.dataset.wxLayer)));
  root.querySelector('[data-wx-expand]').addEventListener('click', event => {
    if (cancelled) return;
    const expanded = radarShell.classList.toggle('is-expanded');
    document.body.classList.toggle('nx-weather-map-open', expanded);
    event.currentTarget.textContent = expanded ? 'COLLAPSE' : 'EXPAND';
  });

  const bootstrapIntent = locationIntent;
  currentPosition({ enableHighAccuracy:false })
    .then(position => {
      if (cancelled || locationIntent !== bootstrapIntent) return;
      return loadWeather({ lat:position.coords.latitude, lon:position.coords.longitude, place:'Current location' });
    })
    .catch(() => {
      if (cancelled || locationIntent !== bootstrapIntent) return;
      return loadWeather(state);
    });

  root.__cleanup = () => {
    cancelled = true;
    locationIntent += 1;
    weatherRevision += 1;
    searchRevision += 1;
    weatherController?.abort();
    searchController?.abort();
    prayerController?.abort();
    document.body.classList.remove('nx-weather-map-open');
    radar.removeAttribute('src');
  };
  return root;
}

export const premiumWeatherRenderers = Object.freeze({ weather: renderWeatherPremium });
