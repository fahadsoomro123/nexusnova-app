/* NexusNova Travel Live v1
   Genuine travel launcher + local itinerary planner.
   No fake schedules, fares, seats or booking confirmations. */
(() => {
  'use strict';
  if (window.__nxTravelLiveV1) return;
  window.__nxTravelLiveV1 = true;

  const $ = id => document.getElementById(id);
  const PROVIDERS = {
    flights: 'https://www.google.com/travel/flights?hl=en',
    rail: 'https://www.pakrailways.gov.pk/buy',
    bus: 'https://bookme.pk/buy-bus-tickets-online',
    daewoo: 'https://daewoo.com.pk/home/index'
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  function openUrl(url) {
    if (typeof window.nxOpenExternal === 'function') {
      window.nxOpenExternal(url);
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function findButton(label) {
    return Array.from(document.querySelectorAll('#tab-travel button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === label.toLowerCase()
    );
  }

  function claim(label, id, handler) {
    const button = findButton(label);
    if (!button || button.dataset.nxTravelReady === '1') return false;
    button.onclick = null;
    button.id = id;
    button.dataset.nxTravelReady = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    return true;
  }

  function output() {
    const tab = $('tab-travel');
    if (!tab) return null;
    let out = $('nxTravelLiveOut');
    if (out) return out;
    out = document.createElement('div');
    out.id = 'nxTravelLiveOut';
    out.className = 'card tool-result';
    out.style.marginTop = '12px';
    tab.appendChild(out);
    return out;
  }

  function showProvider(title, description, links) {
    const out = output();
    if (!out) return;
    out.innerHTML = `<b>${esc(title)}</b><div style="margin-top:7px">${esc(description)}</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">` +
      links.map((item,index) => `<button type="button" class="tool-btn ${index===0?'primary':''}" data-travel-link="${index}">${esc(item.label)}</button>`).join('') +
      `</div><div class="nxmega-muted" style="margin-top:9px">Availability, fare, seat and payment are shown by the real provider. NexusNova does not fabricate them.</div>`;
    out.querySelectorAll('[data-travel-link]').forEach(btn => {
      btn.addEventListener('click', () => openUrl(links[Number(btn.dataset.travelLink)]?.url));
    });
  }

  function flights() {
    showProvider(
      'Live Flight Search',
      'Open a real flight search to compare current routes, dates and fares.',
      [{label:'Open Google Flights', url:PROVIDERS.flights}]
    );
  }

  function railway() {
    showProvider(
      'Pakistan Railways — Official RABTA',
      'Use Pakistan Railways official search/e-ticketing for current trains, times and seats.',
      [{label:'Open Pakistan Railways', url:PROVIDERS.rail}]
    );
  }

  function buses() {
    showProvider(
      'Pakistan Bus Search',
      'Choose a real booking provider for routes, schedules, seats and current fares.',
      [
        {label:'Open Bookme', url:PROVIDERS.bus},
        {label:'Open Daewoo', url:PROVIDERS.daewoo}
      ]
    );
  }

  function planTrip() {
    const destination = prompt('Destination:');
    if (!destination) return;
    const start = prompt('Start date (YYYY-MM-DD):', new Date().toISOString().slice(0,10));
    if (!start) return;
    const daysRaw = Number(prompt('How many days?', '3'));
    const days = Math.max(1, Math.min(30, Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 3));
    const notes = prompt('Main purpose / places / notes (optional):') || '';
    const base = new Date(start + 'T00:00:00');
    if (!Number.isFinite(base.getTime())) return alert('Invalid start date.');

    const rows = Array.from({length:days}, (_,i) => {
      const date = new Date(base.getTime() + i*86400000);
      return `<div class="nxmega-item" style="margin-top:8px"><div><b>Day ${i+1} — ${esc(date.toLocaleDateString())}</b><small>${i===0?'Arrival / check-in / local orientation':i===days-1?'Final activities / return preparation':'Main activities / local travel / meals'}</small></div></div>`;
    }).join('');

    const out = output();
    if (!out) return;
    out.innerHTML = `<b>${esc(destination)} — ${days}-Day Trip Plan</b>` +
      (notes ? `<div style="margin-top:7px">${esc(notes)}</div>` : '') + rows +
      `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">` +
      `<button type="button" class="tool-btn primary" data-trip-flight>Search Flights</button>` +
      `<button type="button" class="tool-btn" data-trip-rail>Pakistan Railways</button>` +
      `<button type="button" class="tool-btn" data-trip-bus>Bus Tickets</button></div>`;
    out.querySelector('[data-trip-flight]')?.addEventListener('click', () => openUrl(PROVIDERS.flights));
    out.querySelector('[data-trip-rail]')?.addEventListener('click', () => openUrl(PROVIDERS.rail));
    out.querySelector('[data-trip-bus]')?.addEventListener('click', () => openUrl(PROVIDERS.bus));

    try {
      localStorage.setItem('nexusnova_trip_plan_v1', JSON.stringify({destination,start,days,notes,createdAt:Date.now()}));
    } catch (_) {}
  }

  function install() {
    if (!$('tab-travel')) return;
    claim('Flight Search','nxTravelFlightLive',flights);
    claim('Train Search','nxTravelRailLive',railway);
    claim('Bus Search','nxTravelBusLive',buses);
    claim('Plan Trip','nxTravelPlanLive',planTrip);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install,1200), {once:true});
  else setTimeout(install,1200);
  [2200,4000,7000].forEach(ms => setTimeout(install,ms));
})();