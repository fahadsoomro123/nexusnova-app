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
const FALLBACK_ZONES = [
  'UTC','Africa/Cairo','Africa/Johannesburg','America/Anchorage','America/Argentina/Buenos_Aires','America/Chicago','America/Denver','America/Los_Angeles','America/Mexico_City','America/New_York','America/Sao_Paulo','America/Toronto','America/Vancouver','Asia/Baghdad','Asia/Bangkok','Asia/Dhaka','Asia/Dubai','Asia/Hong_Kong','Asia/Jakarta','Asia/Karachi','Asia/Kathmandu','Asia/Kolkata','Asia/Kuala_Lumpur','Asia/Riyadh','Asia/Seoul','Asia/Shanghai','Asia/Singapore','Asia/Tehran','Asia/Tokyo','Asia/Yangon','Australia/Adelaide','Australia/Brisbane','Australia/Melbourne','Australia/Perth','Australia/Sydney','Europe/Amsterdam','Europe/Athens','Europe/Berlin','Europe/Istanbul','Europe/London','Europe/Madrid','Europe/Moscow','Europe/Paris','Europe/Rome','Pacific/Auckland','Pacific/Honolulu'
];

function readClocks() {
  const saved = loadJson(CLOCK_KEY, null);
  if (Array.isArray(saved)) return saved.filter(item => item?.label && item?.zone).slice(0, 24);
  return DEFAULT_CLOCKS.map(item => ({ ...item }));
}

function supportedZones() {
  try {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set(['UTC', ...zones])].sort((a, b) => a.localeCompare(b));
  } catch {
    return FALLBACK_ZONES.slice();
  }
}

function cityLabel(zone) {
  if (zone === 'UTC') return 'UTC';
  const parts = String(zone).split('/');
  return String(parts[parts.length - 1] || zone).replaceAll('_', ' ');
}

function zoneSearchText(zone) {
  return `${zone} ${cityLabel(zone)} ${String(zone).replaceAll('_', ' ')}`.toLowerCase();
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
  const zones = supportedZones();
  const root = node(`
    <section class="nxclock-console">
      <header><div><span>GLOBAL TIME NETWORK</span><strong>World Clock</strong></div><b data-clock-count>0 CITIES</b></header>
      <div class="nxclock-picker">
        <label><span>SEARCH CITY / TIME ZONE</span><input class="nxwx-results" type="search" autocomplete="off" data-clock-search placeholder="Karachi, London, Asia…"></label>
        <label><span>TIME ZONE</span><select data-clock-zone aria-label="World time zone"></select></label>
        <button class="nxpi-action" type="button" data-clock-add>ADD CLOCK</button>
      </div>
      <p class="nxpi-status" data-clock-status>${zones.length.toLocaleString()} browser-supported IANA time zones ready.</p>
    </section>
    <section class="nxclock-grid" data-clock-list></section>
  `, 'nx-world-clock-premium');

  const search = root.querySelector('[data-clock-search]');
  const zoneSelect = root.querySelector('[data-clock-zone]');
  const add = root.querySelector('[data-clock-add]');
  const status = root.querySelector('[data-clock-status]');
  const list = root.querySelector('[data-clock-list]');
  const count = root.querySelector('[data-clock-count]');
  let timer = null;

  const renderZoneOptions = query => {
    const needle = String(query || '').trim().toLowerCase();
    const matches = (needle ? zones.filter(zone => zoneSearchText(zone).includes(needle)) : zones).slice(0, 500);
    zoneSelect.innerHTML = matches.length
      ? matches.map(zone => `<option value="${escapeHtml(zone)}">${escapeHtml(cityLabel(zone))} • ${escapeHtml(zone)}</option>`).join('')
      : '<option value="">No matching time zone</option>';
    zoneSelect.disabled = !matches.length;
    add.disabled = !matches.length;
    status.textContent = matches.length
      ? `${matches.length.toLocaleString()} matching time zone${matches.length === 1 ? '' : 's'} • live browser Intl data.`
      : 'No matching city or time zone. Try a broader search.';
  };

  const draw = () => {
    const clocks = readClocks();
    count.textContent = `${clocks.length} ${clocks.length === 1 ? 'CITY' : 'CITIES'}`;
    const now = new Date();
    list.innerHTML = clocks.length ? clocks.map((clock, index) => {
      let time = '—', date = '—';
      try {
        time = now.toLocaleTimeString([], { timeZone:clock.zone, hour:'2-digit', minute:'2-digit', second:'2-digit' });
        date = now.toLocaleDateString([], { timeZone:clock.zone, weekday:'short', day:'2-digit', month:'short' });
      } catch {}
      return `<article class="nxclock-card">
        <div><span>${escapeHtml(clock.label)}</span><small>${escapeHtml(date)} • ${escapeHtml(clock.zone)} • ${escapeHtml(timeZoneAbbr(clock.zone))}</small></div>
        <strong>${escapeHtml(time)}</strong>
        <button type="button" data-clock-remove="${index}" aria-label="Remove ${escapeHtml(clock.label)}">×</button>
      </article>`;
    }).join('') : '<div class="nx-empty">No clocks added. Search a city or IANA time zone above.</div>';
    list.querySelectorAll('[data-clock-remove]').forEach(button => button.addEventListener('click', () => {
      const clocks = readClocks();
      clocks.splice(Number(button.dataset.clockRemove), 1);
      saveJson(CLOCK_KEY, clocks);
      draw();
    }));
  };

  search.addEventListener('input', () => renderZoneOptions(search.value));
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !add.disabled) add.click();
  });
  zoneSelect.addEventListener('change', () => {
    const zone = zoneSelect.value;
    if (zone) status.textContent = `${cityLabel(zone)} • ${zone} selected.`;
  });
  add.addEventListener('click', () => {
    const zone = String(zoneSelect.value || '').trim();
    if (!zone) return;
    const clocks = readClocks();
    if (clocks.some(item => item.zone === zone)) {
      status.textContent = `${cityLabel(zone)} is already in your clocks.`;
      return;
    }
    clocks.push({ label:cityLabel(zone), zone });
    saveJson(CLOCK_KEY, clocks.slice(-24));
    draw();
    status.textContent = `${cityLabel(zone)} added • ${zone}`;
  });

  renderZoneOptions('');
  draw();
  timer = setInterval(draw, 1000);
  root.__cleanup = () => clearInterval(timer);
  return root;
}

export const premiumWorldClockRenderers = Object.freeze({ 'world-clock': renderWorldClockPremium });
