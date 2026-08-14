/* NexusNova Travel Live v2
   Real provider handoff + privacy-safe local itinerary planner.
   No fake schedules, fares, seats or booking confirmations. */
(() => {
  'use strict';
  if (window.__nxTravelLiveV2) return;
  window.__nxTravelLiveV2 = true;
  window.__nxTravelLiveV1 = true;
  window.nexusTravelLiveVersion = 'provider-handoff-v2';

  const $ = id => document.getElementById(id);
  const PROVIDERS = Object.freeze({
    flights: 'https://www.google.com/travel/flights?hl=en',
    bookme: 'https://bookme.pk/bookings',
    rail: 'https://www.pakrailways.gov.pk/buy',
    bus: 'https://bookme.pk/buy-bus-tickets-online',
    daewoo: 'https://daewoo.com.pk/home/index'
  });
  let uiPromise = null;

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

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise((resolve,reject) => {
      const existing = document.querySelector('script[data-nx-premium-ui]');
      const done = () => window.NexusNovaUI
        ? resolve(window.NexusNovaUI)
        : reject(new Error('Premium UI did not initialize.'));
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done,1200);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = () => reject(new Error('Premium UI could not be loaded.'));
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
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
      Promise.resolve(handler()).catch(error => console.warn('NexusNova travel action:', error));
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
    out.className = 'card tool-result nx-premium-result-host';
    out.style.marginTop = '12px';
    tab.appendChild(out);
    return out;
  }

  function updateIntegrationNote() {
    const note = document.querySelector('#tab-travel .integration-note');
    if (!note) return;
    note.dataset.nxTravelLive = '1';
    note.textContent = 'Real provider handoff is active. Current schedules, fares, seats, payment and booking confirmation stay with the selected travel provider; NexusNova does not invent or resell them.';
  }

  function showProvider(title, description, links) {
    const out = output();
    if (!out) return;
    out.innerHTML = `<b>${esc(title)}</b><div style="margin-top:7px">${esc(description)}</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">` +
      links.map((item,index) => `<button type="button" class="tool-btn ${index===0?'primary':''}" data-travel-link="${index}">${esc(item.label)}</button>`).join('') +
      `</div><div class="nxmega-muted" style="margin-top:9px">Availability, fare, seat selection, payment and confirmation are shown by the real provider. NexusNova does not fabricate them.</div>`;
    out.querySelectorAll('[data-travel-link]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = links[Number(btn.dataset.travelLink)];
        if (item?.url) openUrl(item.url);
      });
    });
  }

  function flights() {
    showProvider(
      'Live Flight Search',
      'Compare current routes and fares using a real travel search or Pakistan e-ticketing provider.',
      [
        {label:'Open Google Flights', url:PROVIDERS.flights},
        {label:'Open Bookme Flights', url:PROVIDERS.bookme}
      ]
    );
  }

  function railway() {
    showProvider(
      'Pakistan Railways — Official RABTA',
      'Use Pakistan Railways official search/e-ticketing for current trains, timings, availability and seats.',
      [{label:'Open Pakistan Railways', url:PROVIDERS.rail}]
    );
  }

  function buses() {
    showProvider(
      'Pakistan Bus Search',
      'Choose a real booking provider for routes, schedules, available seats and current fares.',
      [
        {label:'Open Bookme', url:PROVIDERS.bus},
        {label:'Open Daewoo Express', url:PROVIDERS.daewoo}
      ]
    );
  }

  async function fallbackTripForm() {
    const out = output();
    if (!out) return null;
    const today = new Date().toISOString().slice(0,10);
    return new Promise(resolve => {
      out.innerHTML = `<b>Plan Your Trip</b><div class="nxmega-muted" style="margin-top:6px">Build a private itinerary saved only on this device.</div>
        <form data-nx-trip-form style="display:grid;gap:9px;margin-top:12px">
          <input class="tool-input" name="destination" required maxlength="80" placeholder="Destination">
          <input class="tool-input" name="start" type="date" required value="${today}">
          <input class="tool-input" name="days" type="number" min="1" max="30" required value="3" placeholder="Days">
          <textarea class="tool-input" name="notes" maxlength="500" rows="3" placeholder="Places, purpose or notes (optional)"></textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="tool-btn primary" type="submit">Create Trip Plan</button><button class="tool-btn" type="button" data-trip-cancel>Cancel</button></div>
        </form>`;
      const form = out.querySelector('[data-nx-trip-form]');
      const finish = value => resolve(value);
      form?.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        finish({
          destination:String(data.get('destination') || '').trim(),
          start:String(data.get('start') || ''),
          days:Number(data.get('days') || 3),
          notes:String(data.get('notes') || '').trim()
        });
      }, {once:true});
      out.querySelector('[data-trip-cancel]')?.addEventListener('click', () => finish(null), {once:true});
    });
  }

  async function requestTripData() {
    const today = new Date().toISOString().slice(0,10);
    try {
      const ui = await getUI();
      const data = await ui.form({
        eyebrow:'TRAVEL HUB',
        title:'Plan Your Trip',
        subtitle:'Build a private itinerary. NexusNova saves the plan on this device and sends no itinerary data to a booking provider until you choose to open one.',
        icon:'travel',
        submitText:'Create Trip Plan',
        fields:[
          {name:'destination',label:'Destination',icon:'location',placeholder:'e.g. Islamabad',required:true,wide:true},
          {name:'start',label:'Start Date',icon:'calendar',type:'date',value:today,required:true},
          {name:'days',label:'Number of Days',icon:'duration',type:'number',value:'3',min:1,max:30,required:true},
          {name:'notes',label:'Purpose / Places / Notes',icon:'subject',placeholder:'Optional travel notes',wide:true}
        ]
      });
      return data || null;
    } catch (_) {
      return fallbackTripForm();
    }
  }

  function renderTripPlan(data) {
    const destination = String(data?.destination || '').trim().slice(0,80);
    const start = String(data?.start || '');
    const daysRaw = Number(data?.days);
    const days = Math.max(1, Math.min(30, Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 3));
    const notes = String(data?.notes || '').trim().slice(0,500);
    if (!destination || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
    const base = new Date(start + 'T00:00:00');
    if (!Number.isFinite(base.getTime())) return false;

    const rows = Array.from({length:days}, (_,i) => {
      const date = new Date(base.getTime() + i*86400000);
      const hint = i===0
        ? 'Arrival / check-in / local orientation'
        : i===days-1
          ? 'Final activities / return preparation'
          : 'Main activities / local travel / meals';
      return `<div class="nxmega-item" style="margin-top:8px"><div><b>Day ${i+1} — ${esc(date.toLocaleDateString())}</b><small>${hint}</small></div></div>`;
    }).join('');

    const out = output();
    if (!out) return false;
    out.innerHTML = `<b>${esc(destination)} — ${days}-Day Trip Plan</b>` +
      (notes ? `<div style="margin-top:7px">${esc(notes)}</div>` : '') + rows +
      `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">` +
      `<button type="button" class="tool-btn primary" data-trip-flight>Search Flights</button>` +
      `<button type="button" class="tool-btn" data-trip-rail>Pakistan Railways</button>` +
      `<button type="button" class="tool-btn" data-trip-bus>Bus Tickets</button></div>` +
      `<div class="nxmega-muted" style="margin-top:9px">This itinerary is a planning aid, not a booking confirmation.</div>`;
    out.querySelector('[data-trip-flight]')?.addEventListener('click', () => openUrl(PROVIDERS.flights));
    out.querySelector('[data-trip-rail]')?.addEventListener('click', () => openUrl(PROVIDERS.rail));
    out.querySelector('[data-trip-bus]')?.addEventListener('click', () => openUrl(PROVIDERS.bus));

    try {
      localStorage.setItem('nexusnova_trip_plan_v1', JSON.stringify({destination,start,days,notes,createdAt:Date.now()}));
    } catch (_) {}
    return true;
  }

  async function planTrip() {
    const data = await requestTripData();
    if (!data) return;
    if (!renderTripPlan(data)) {
      const out = output();
      if (out) out.textContent = 'Choose a valid destination, start date and trip length.';
    }
  }

  function install() {
    if (!$('tab-travel')) return;
    claim('Flight Search','nxTravelFlightLive',flights);
    claim('Train Search','nxTravelRailLive',railway);
    claim('Bus Search','nxTravelBusLive',buses);
    claim('Plan Trip','nxTravelPlanLive',planTrip);
    updateIntegrationNote();
  }

  window.nexusTravel = Object.freeze({
    version:'provider-handoff-v2',
    providers:{...PROVIDERS},
    install,
    renderTripPlan
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install,500), {once:true});
  else setTimeout(install,500);
  [1200,2400,4500].forEach(ms => setTimeout(install,ms));
})();