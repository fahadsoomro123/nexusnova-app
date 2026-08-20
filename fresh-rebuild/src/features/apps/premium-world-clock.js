import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
  root.innerHTML = html;
  return root;
}

const CLOCK_KEY = 'nexus_world_clocks_v2';

const DEFAULT_CLOCKS = [
  { label:'Karachi', zone:'Asia/Karachi' },
  { label:'Dubai', zone:'Asia/Dubai' },
  { label:'London', zone:'Europe/London' },
  { label:'New York', zone:'America/New_York' },
  { label:'Tokyo', zone:'Asia/Tokyo' },
  { label:'Istanbul', zone:'Europe/Istanbul' }
];

function readClocks() {
  const saved = loadJson(CLOCK_KEY, null);
  return Array.isArray(saved) && saved.length ? saved.filter(item => item?.label && item?.zone).slice(0, 24) : DEFAULT_CLOCKS;
}

function timeZoneAbbr(zone) {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone:zone, timeZoneName:'short' }).formatToParts(new Date());
    return parts.find(part => part.type === 'timeZoneName')?.value || zone;
  } catch {
    return zone;
  }
}

export function renderWorldClockPremium() {
  const root = node(`
    <section class="nxclock-console">
      <header><div><span>GLOBAL TIME NETWORK</span><strong>World Clock</strong></div><b data-clock-count>0 CITIES</b></header>
      <div class="nxclock-picker">
        <label><span>COUNTRY</span><select data-clock-country><option>Loading countries…</option></select></label>
        <label><span>CITY</span><select data-clock-city disabled><option>Select a country first</option></select></label>
        <button class="nxpi-action" type="button" data-clock-add disabled>ADD CLOCK</button>
      </div>
      <p class="nxpi-status" data-clock-status>Loading the global country directory…</p>
    </section>
    <section class="nxclock-grid" data-clock-list></section>
  `, 'nx-world-clock-premium');

  const country = root.querySelector('[data-clock-country]');
  const city = root.querySelector('[data-clock-city]');
  const add = root.querySelector('[data-clock-add]');
  const status = root.querySelector('[data-clock-status]');
  const list = root.querySelector('[data-clock-list]');
  const count = root.querySelector('[data-clock-count]');
  let countries = [];
  let timer = null;

  const draw = () => {
    const clocks = readClocks();
    count.textContent = `${clocks.length} ${clocks.length === 1 ? 'CITY' : 'CITIES'}`;
    const now = new Date();
    list.innerHTML = clocks.map((clock, index) => {
      let time = '—', date = '—';
      try {
        time = now.toLocaleTimeString([], { timeZone:clock.zone, hour:'2-digit', minute:'2-digit', second:'2-digit' });
        date = now.toLocaleDateString([], { timeZone:clock.zone, weekday:'short', day:'2-digit', month:'short' });
      } catch {}
      return `<article class="nxclock-card">
        <div><span>${escapeHtml(clock.label)}</span><small>${escapeHtml(date)} • ${escapeHtml(timeZoneAbbr(clock.zone))}</small></div>
        <strong>${escapeHtml(time)}</strong>
        <button type="button" data-clock-remove="${index}" aria-label="Remove ${escapeHtml(clock.label)}">×</button>
      </article>`;
    }).join('');
    list.querySelectorAll('[data-clock-remove]').forEach(button => button.addEventListener('click', () => {
      const clocks = readClocks();
      clocks.splice(Number(button.dataset.clockRemove), 1);
      saveJson(CLOCK_KEY, clocks);
      draw();
    }));
  };

  const loadCities = async () => {
    const name = country.value;
    if (!name) return;
    city.disabled = true;
    add.disabled = true;
    city.innerHTML = '<option>Loading cities…</option>';
    status.textContent = `Loading cities in ${name}…`;
    try {
      const response = await fetch(`https://countriesnow.space/api/v0.1/countries/cities/q?country=${encodeURIComponent(name)}`, { cache:'force-cache' });
      if (!response.ok) throw new Error(`Cities HTTP ${response.status}`);
      const json = await response.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      if (!rows.length) throw new Error('No city list returned');
      city.innerHTML = rows.slice().sort((a,b) => String(a).localeCompare(String(b))).map(name => `<option>${escapeHtml(String(name))}</option>`).join('');
      city.disabled = false;
      add.disabled = false;
      status.textContent = `${rows.length.toLocaleString()} cities available in ${name}.`;
    } catch (error) {
      city.innerHTML = '<option>City directory unavailable</option>';
      status.textContent = 'City directory could not be loaded. Try another country or check the connection.';
      console.warn('[NexusNova Premium] world clock cities:', error);
    }
  };

  const loadCountries = async () => {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2', { cache:'force-cache' });
      if (!response.ok) throw new Error(`Countries HTTP ${response.status}`);
      const json = await response.json();
      countries = (Array.isArray(json) ? json : [])
        .map(item => ({ name:String(item?.name?.common || '').trim(), code:String(item?.cca2 || '').trim() }))
        .filter(item => item.name)
        .sort((a,b) => a.name.localeCompare(b.name));
      if (!countries.length) throw new Error('No countries returned');
      country.innerHTML = `<option value="">Select country</option>${countries.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}`;
      status.textContent = `${countries.length} countries ready. Select a country, then a city.`;
    } catch (error) {
      country.innerHTML = '<option value="">Global directory unavailable</option>';
      status.textContent = 'Global country directory is unavailable right now.';
      console.warn('[NexusNova Premium] world clock countries:', error);
    }
  };

  country.addEventListener('change', loadCities);
  add.addEventListener('click', async () => {
    const countryName = country.value;
    const cityName = city.value;
    if (!countryName || !cityName || city.disabled) return;
    add.disabled = true;
    status.textContent = `Resolving ${cityName} time zone…`;
    try {
      const query = `${cityName}, ${countryName}`;
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`, { cache:'no-store' });
      if (!response.ok) throw new Error(`Time zone HTTP ${response.status}`);
      const json = await response.json();
      const rows = Array.isArray(json.results) ? json.results : [];
      const match = rows.find(item => String(item.country || '').toLowerCase() === countryName.toLowerCase()) || rows[0];
      const zone = String(match?.timezone || '').trim();
      if (!zone) throw new Error('No IANA time zone returned');
      const clocks = readClocks();
      if (!clocks.some(item => item.zone === zone && item.label === cityName)) {
        clocks.push({ label:cityName, zone });
        saveJson(CLOCK_KEY, clocks.slice(-24));
      }
      draw();
      status.textContent = `${cityName} added • ${zone}`;
    } catch (error) {
      status.textContent = 'Could not resolve that city time zone. Try another nearby city.';
      console.warn('[NexusNova Premium] world clock zone:', error);
    } finally {
      add.disabled = city.disabled;
    }
  });

  draw();
  timer = setInterval(draw, 1000);
  loadCountries();

  root.__cleanup = () => clearInterval(timer);
  return root;
}

export const premiumWorldClockRenderers = Object.freeze({ 'world-clock': renderWorldClockPremium });
