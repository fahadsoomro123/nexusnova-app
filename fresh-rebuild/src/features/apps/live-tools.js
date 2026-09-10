import { createGauge } from '../../components/instrument-gauge.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function currentPosition(options = {}) {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 60_000,
    ...options
  }));
}

function weatherLabel(code) {
  const labels = { 0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast', 45:'Fog', 48:'Rime fog', 51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle', 61:'Light rain', 63:'Rain', 65:'Heavy rain', 71:'Snow', 80:'Rain showers', 81:'Showers', 82:'Heavy showers', 95:'Thunderstorm' };
  return labels[code] || 'Weather';
}

function weatherGlyph(code) {
  if (code <= 1) return '☀';
  if (code <= 3) return '◒';
  if (code >= 45 && code <= 48) return '≋';
  if (code >= 71 && code < 80) return '❄';
  if (code >= 95) return 'ϟ';
  if (code >= 51) return '⌁';
  return '◌';
}

export function renderWeather() {
  const root = node(`
    <section class="nx-weather-hero nx-panel">
      <div><p class="nx-eyebrow">LIVE CONDITIONS</p><strong data-wx-temp>--°</strong><span data-wx-label>Locating…</span></div>
      <div class="nx-weather-symbol" data-wx-symbol>◌</div>
    </section>
    <div class="nx-summary-grid nx-weather-metrics">
      <div><span>Feels</span><strong data-wx-feels>--°</strong></div>
      <div><span>Humidity</span><strong data-wx-humidity>--%</strong></div>
      <div><span>Wind</span><strong data-wx-wind>--</strong></div>
    </div>
    <section class="nx-stack" data-wx-days></section>
    <button class="nx-secondary" type="button" data-wx-refresh>REFRESH WEATHER</button>
    <p class="nx-tool-meta" data-wx-status>Uses device location when permitted, with Karachi as a safe fallback.</p>
  `);
  const refs = Object.fromEntries(['temp','label','symbol','feels','humidity','wind','days','status'].map(key => [key, root.querySelector(`[data-wx-${key}]`)]));
  let busy = false;
  const load = async () => {
    if (busy) return;
    busy = true;
    refs.status.textContent = 'Loading live weather…';
    let lat = 24.8607, lon = 67.0011, place = 'Karachi fallback';
    try {
      const pos = await currentPosition({ enableHighAccuracy: false });
      lat = pos.coords.latitude; lon = pos.coords.longitude; place = 'Your location';
    } catch {}
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=5`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
      const data = await response.json();
      const c = data.current || {};
      refs.temp.textContent = `${Math.round(c.temperature_2m)}°`;
      refs.feels.textContent = `${Math.round(c.apparent_temperature)}°`;
      refs.humidity.textContent = `${Math.round(c.relative_humidity_2m)}%`;
      refs.wind.textContent = `${Math.round(c.wind_speed_10m)} km/h`;
      refs.label.textContent = `${weatherLabel(c.weather_code)} • ${place}`;
      refs.symbol.textContent = weatherGlyph(c.weather_code);
      refs.days.innerHTML = (data.daily?.time || []).map((date, index) => {
        const day = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
        return `<article class="nx-world-row"><span>${day} ${weatherGlyph(data.daily.weather_code[index])}</span><strong>${Math.round(data.daily.temperature_2m_max[index])}° / ${Math.round(data.daily.temperature_2m_min[index])}°</strong></article>`;
      }).join('');
      refs.status.textContent = `Updated ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
    } catch (error) {
      refs.status.textContent = 'Weather is unavailable right now. Check your connection.';
      console.warn('[NexusNova Fresh] weather:', error);
    } finally { busy = false; }
  };
  root.querySelector('[data-wx-refresh]').addEventListener('click', load);
  load();
  return root;
}

function bearingToKaaba(latitude, longitude) {
  const φ1 = latitude * Math.PI / 180;
  const φ2 = 21.4225 * Math.PI / 180;
  const λ1 = longitude * Math.PI / 180;
  const λ2 = 39.8262 * Math.PI / 180;
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function renderQibla() {
  const root = node(`
    <section class="nx-tool-card nx-compass-card">
      <div class="nx-compass" data-compass>
        <div class="nx-compass__ring"><span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">W</span></div>
        <div class="nx-compass__arrow" data-qibla-arrow><i></i></div>
        <div class="nx-compass__hub"></div>
      </div>
      <div class="nx-result" data-qibla-result>Finding Qibla…</div>
      <p class="nx-tool-meta" data-qibla-status>Location and device orientation are used only while this screen is open.</p>
      <button class="nx-secondary" type="button" data-qibla-enable>ENABLE LIVE COMPASS</button>
    </section>
  `);
  const arrow = root.querySelector('[data-qibla-arrow]');
  const result = root.querySelector('[data-qibla-result]');
  const status = root.querySelector('[data-qibla-status]');
  let bearing = null, heading = 0, listening = false;

  const paint = () => {
    if (!Number.isFinite(bearing)) return;
    const rotation = (bearing - heading + 360) % 360;
    arrow.style.transform = `rotate(${rotation}deg)`;
    result.textContent = `Qibla ${bearing.toFixed(1)}° • Heading ${heading.toFixed(1)}°`;
  };

  const onOrientation = event => {
    const raw = Number(event.webkitCompassHeading);
    if (Number.isFinite(raw)) heading = raw;
    else if (Number.isFinite(Number(event.alpha))) heading = (360 - Number(event.alpha)) % 360;
    paint();
  };

  const enableOrientation = async () => {
    try {
      if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Motion permission was not granted.');
      }
      if (!listening) {
        window.addEventListener('deviceorientationabsolute', onOrientation, true);
        window.addEventListener('deviceorientation', onOrientation, true);
        listening = true;
      }
      status.textContent = 'Live compass active. Hold the phone flat and away from magnets.';
    } catch (error) { status.textContent = error.message || 'Orientation is unavailable.'; }
  };

  currentPosition().then(pos => {
    bearing = bearingToKaaba(pos.coords.latitude, pos.coords.longitude);
    status.textContent = `Location locked • accuracy about ${Math.round(pos.coords.accuracy || 0)} m. Enable live compass for phone heading.`;
    paint();
  }).catch(() => { status.textContent = 'Location permission is required to calculate Qibla.'; result.textContent = 'Location unavailable'; });

  root.querySelector('[data-qibla-enable]').addEventListener('click', enableOrientation);
  root.__cleanup = () => {
    window.removeEventListener('deviceorientationabsolute', onOrientation, true);
    window.removeEventListener('deviceorientation', onOrientation, true);
  };
  return root;
}

export function renderPrayerTimes() {
  const root = node(`
    <section class="nx-tool-card">
      <p class="nx-eyebrow">TODAY</p>
      <div class="nx-result" data-prayer-date>Loading prayer times…</div>
      <div class="nx-stack" data-prayer-list></div>
      <button class="nx-secondary" type="button" data-prayer-refresh>REFRESH</button>
      <p class="nx-tool-meta" data-prayer-status>Prayer times use your location when allowed.</p>
    </section>
  `);
  const list = root.querySelector('[data-prayer-list]');
  const date = root.querySelector('[data-prayer-date]');
  const status = root.querySelector('[data-prayer-status]');
  let busy = false;
  const load = async () => {
    if (busy) return; busy = true;
    status.textContent = 'Loading prayer times…';
    let lat = 24.8607, lon = 67.0011, place = 'Karachi fallback';
    try { const pos = await currentPosition({ enableHighAccuracy:false }); lat = pos.coords.latitude; lon = pos.coords.longitude; place = 'Your location'; } catch {}
    try {
      const now = new Date();
      const dateParam = `${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}`;
      const response = await fetch(`https://api.aladhan.com/v1/timings/${dateParam}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&method=1`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Prayer HTTP ${response.status}`);
      const json = await response.json();
      const timings = json?.data?.timings || {};
      date.textContent = json?.data?.date?.readable || now.toLocaleDateString();
      list.innerHTML = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'].map(name => `<article class="nx-world-row"><span>${name}</span><strong>${String(timings[name] || '--').slice(0,5)}</strong></article>`).join('');
      status.textContent = `${place} • calculation method 1`;
    } catch (error) {
      date.textContent = 'Prayer times unavailable';
      status.textContent = 'Check your connection and try again.';
      console.warn('[NexusNova Fresh] prayer:', error);
    } finally { busy = false; }
  };
  root.querySelector('[data-prayer-refresh]').addEventListener('click', load);
  load();
  return root;
}

const DOWNLOAD_BYTES = 4_000_000;
const UPLOAD_BYTES = 1_500_000;

function median(values) {
  const sorted = [...values].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function jitter(values) {
  if (values.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < values.length; i++) total += Math.abs(values[i] - values[i-1]);
  return total / (values.length - 1);
}

function speedRatio(value) {
  return Math.log10(1 + Math.max(0, Math.min(1000, Number(value) || 0))) / Math.log10(1001);
}

export function renderSpeedTest() {
  const root = node(`
    <section class="nx-tool-card nx-speed-tool">
      <div data-speed-gauge>${createGauge({ value:0, ratio:0, displayValue:'0.00', unit:'MBPS', decimals:2, ariaLabel:'Internet speed 0 Mbps' })}</div>
      <div class="nx-summary-grid nx-speed-metrics"><div><span>Download</span><strong data-speed-down>—</strong></div><div><span>Upload</span><strong data-speed-up>—</strong></div><div><span>Ping</span><strong data-speed-ping>—</strong></div></div>
      <div class="nx-progress"><i data-speed-progress></i></div>
      <button class="nx-primary" type="button" data-speed-start>START SPEED TEST</button>
      <p class="nx-tool-meta" data-speed-status>Cloudflare Edge measurement • about 5.5 MB per full test.</p>
    </section>
  `);
  const gauge = root.querySelector('[data-speed-gauge]');
  const down = root.querySelector('[data-speed-down]');
  const up = root.querySelector('[data-speed-up]');
  const ping = root.querySelector('[data-speed-ping]');
  const progress = root.querySelector('[data-speed-progress]');
  const start = root.querySelector('[data-speed-start]');
  const status = root.querySelector('[data-speed-status]');
  let running = false;

  const setSpeed = value => {
    const n = Math.max(0, Number(value) || 0);
    const shown = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0);
    gauge.innerHTML = createGauge({ value:n, min:0, max:1000, ratio:speedRatio(n), displayValue:shown, unit:'MBPS', ariaLabel:`Internet speed ${shown} megabits per second` });
  };
  const setProgress = value => { progress.style.width = `${Math.max(0, Math.min(100, value))}%`; };

  const latency = async () => {
    const samples = [];
    for (let i=0; i<5; i++) {
      const t = performance.now();
      const response = await fetch(`https://speed.cloudflare.com/__down?bytes=0&nx=${Date.now()}-${i}`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Ping HTTP ${response.status}`);
      await response.arrayBuffer();
      samples.push(performance.now() - t);
      setProgress(5 + (i+1) * 3);
    }
    return { ping: median(samples), jitter: jitter(samples) };
  };

  const download = async () => {
    const response = await fetch(`https://speed.cloudflare.com/__down?bytes=${DOWNLOAD_BYTES}&nx=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    const started = performance.now();
    let bytes = 0;
    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      return (buffer.byteLength * 8) / ((performance.now() - started) / 1000) / 1e6;
    }
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value?.byteLength || 0;
      const current = (bytes * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
      down.textContent = `${current < 10 ? current.toFixed(2) : current.toFixed(1)} Mbps`;
      setSpeed(current);
      setProgress(22 + Math.min(46, bytes / DOWNLOAD_BYTES * 46));
    }
    return (bytes * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
  };

  const upload = () => new Promise((resolve, reject) => {
    const payload = new Uint8Array(UPLOAD_BYTES);
    const xhr = new XMLHttpRequest();
    const started = performance.now();
    xhr.open('POST', `https://speed.cloudflare.com/__up?bytes=${UPLOAD_BYTES}&nx=${Date.now()}`, true);
    xhr.timeout = 26_000;
    xhr.upload.onprogress = event => {
      const current = (event.loaded * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6;
      up.textContent = `${current < 10 ? current.toFixed(2) : current.toFixed(1)} Mbps`;
      setSpeed(current);
      setProgress(70 + Math.min(28, event.loaded / (event.total || UPLOAD_BYTES) * 28));
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.ontimeout = () => reject(new Error('Upload timeout'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Upload HTTP ${xhr.status}`));
      resolve((UPLOAD_BYTES * 8) / (Math.max(1, performance.now() - started) / 1000) / 1e6);
    };
    xhr.send(payload);
  });

  start.addEventListener('click', async () => {
    if (running) return; running = true; start.disabled = true; start.textContent = 'TESTING…';
    down.textContent = up.textContent = ping.textContent = '—'; setSpeed(0); setProgress(3);
    try {
      status.textContent = 'PING • measuring latency and jitter…';
      const l = await latency(); ping.textContent = `${l.ping.toFixed(0)} ms`; setProgress(20);
      status.textContent = 'DOWNLOAD • measuring live throughput…';
      const d = await download(); down.textContent = `${d < 10 ? d.toFixed(2) : d.toFixed(1)} Mbps`; setProgress(69);
      status.textContent = 'UPLOAD • measuring sending speed…';
      const u = await upload(); up.textContent = `${u < 10 ? u.toFixed(2) : u.toFixed(1)} Mbps`; setProgress(100); setSpeed(d);
      const quality = d >= 300 && u >= 80 && l.ping <= 35 ? 'Excellent' : d >= 100 ? 'Very fast' : d >= 25 ? 'Good' : d >= 8 ? 'Usable' : 'Slow';
      status.textContent = `${quality} connection • jitter ${l.jitter.toFixed(1)} ms`;
      start.textContent = 'TEST AGAIN';
    } catch (error) {
      status.textContent = 'Speed test interrupted. Check the connection and try again.';
      start.textContent = 'TRY AGAIN';
      console.warn('[NexusNova Fresh] speed test:', error);
    } finally { running = false; start.disabled = false; setTimeout(() => setProgress(0), 1200); }
  });
  return root;
}

export const liveRenderers = Object.freeze({
  weather: renderWeather,
  qibla: renderQibla,
  'prayer-times': renderPrayerTimes,
  'speed-test': renderSpeedTest
});
