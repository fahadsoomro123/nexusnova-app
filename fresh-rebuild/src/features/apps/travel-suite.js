import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

const TRIP_KEY = 'nexusnova_trip_plan_v1';
const PROVIDERS = Object.freeze({
  flights: 'https://www.google.com/travel/flights?hl=en',
  bookme: 'https://bookme.pk/bookings',
  rail: 'https://www.pakrailways.gov.pk/buy',
  bus: 'https://bookme.pk/buy-bus-tickets-online',
  daewoo: 'https://daewoo.com.pk/home/index'
});

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function openExternal(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return false;
    if (typeof window.nexusPostNativeAction === 'function' && window.nexusPostNativeAction('openExternal', { url: parsed.href })) return true;
    window.open(parsed.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

function dayRows(plan) {
  const start = new Date(`${plan.start}T00:00:00`);
  return Array.from({ length: plan.days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    const hint = index === 0
      ? 'Arrival / check-in / local orientation'
      : index === plan.days - 1
        ? 'Final activities / return preparation'
        : 'Main activities / local travel / meals';
    return `<article class="nx-list-card"><strong>Day ${index + 1} • ${escapeHtml(date.toLocaleDateString())}</strong><p>${escapeHtml(hint)}</p></article>`;
  }).join('');
}

export function renderTravelSuite() {
  const saved = loadJson(TRIP_KEY, null);
  const root = node(`
    <section class="nx-tool-card">
      <strong>Real Travel Providers</strong>
      <p class="nx-tool-meta">Current schedules, fares, seats, payment and booking confirmation stay with the selected provider. NexusNova does not invent or resell them.</p>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-provider="flights">GOOGLE FLIGHTS</button>
        <button type="button" data-provider="bookme">BOOKME FLIGHTS</button>
      </div>
      <button type="button" data-provider="rail">PAKISTAN RAILWAYS • OFFICIAL</button>
      <div class="nx-two-col">
        <button type="button" data-provider="bus">BOOKME BUS</button>
        <button type="button" data-provider="daewoo">DAEWOO EXPRESS</button>
      </div>
      <p class="nx-tool-meta" data-travel-provider-status>Choose a real provider.</p>
    </section>

    <section class="nx-tool-card">
      <strong>Plan Your Trip</strong>
      <p class="nx-tool-meta">Build a private itinerary saved only on this device. Nothing is sent to a travel provider until you choose to open one.</p>
      <label class="nx-field"><span>Destination</span><input maxlength="80" data-trip-destination placeholder="Islamabad"></label>
      <div class="nx-two-col">
        <label class="nx-field"><span>Start date</span><input type="date" data-trip-start></label>
        <label class="nx-field"><span>Days</span><input type="number" min="1" max="30" step="1" value="3" data-trip-days></label>
      </div>
      <label class="nx-field"><span>Purpose / places / notes</span><textarea rows="3" maxlength="500" data-trip-notes></textarea></label>
      <div class="nx-two-col">
        <button class="nx-primary" type="button" data-trip-create>CREATE TRIP PLAN</button>
        <button type="button" data-trip-clear>CLEAR PLAN</button>
      </div>
      <p class="nx-tool-meta" data-trip-status>${saved?.destination ? 'Saved trip plan loaded.' : 'No saved trip plan.'}</p>
    </section>
    <section class="nx-stack" data-trip-output></section>
  `);

  const providerStatus = root.querySelector('[data-travel-provider-status]');
  root.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.provider;
    const url = PROVIDERS[key];
    if (url && openExternal(url)) providerStatus.textContent = `Opening ${button.textContent.trim()}…`;
    else providerStatus.textContent = 'Could not open that provider.';
  }));

  const destination = root.querySelector('[data-trip-destination]');
  const start = root.querySelector('[data-trip-start]');
  const days = root.querySelector('[data-trip-days]');
  const notes = root.querySelector('[data-trip-notes]');
  const status = root.querySelector('[data-trip-status]');
  const output = root.querySelector('[data-trip-output]');
  start.value = new Date().toISOString().slice(0, 10);

  const render = plan => {
    if (!plan?.destination || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start) || !(plan.days >= 1)) {
      output.innerHTML = '<div class="nx-empty">No saved trip itinerary.</div>';
      return;
    }
    output.innerHTML = `
      <article class="nx-tool-card">
        <strong>${escapeHtml(plan.destination)} • ${plan.days}-Day Trip Plan</strong>
        ${plan.notes ? `<p>${escapeHtml(plan.notes)}</p>` : ''}
        <div class="nx-stack" style="margin-top:10px">${dayRows(plan)}</div>
        <div class="nx-two-col"><button class="nx-primary" type="button" data-trip-flight>SEARCH FLIGHTS</button><button type="button" data-trip-rail>RAILWAYS</button></div>
        <button type="button" data-trip-bus>BUS TICKETS</button>
        <p class="nx-tool-meta">Planning aid only — not a booking confirmation.</p>
      </article>`;
    output.querySelector('[data-trip-flight]').addEventListener('click', () => openExternal(PROVIDERS.flights));
    output.querySelector('[data-trip-rail]').addEventListener('click', () => openExternal(PROVIDERS.rail));
    output.querySelector('[data-trip-bus]').addEventListener('click', () => openExternal(PROVIDERS.bus));
  };

  if (saved && typeof saved === 'object') {
    destination.value = String(saved.destination || '').slice(0, 80);
    start.value = /^\d{4}-\d{2}-\d{2}$/.test(String(saved.start || '')) ? saved.start : start.value;
    days.value = String(Math.max(1, Math.min(30, Number(saved.days) || 3)));
    notes.value = String(saved.notes || '').slice(0, 500);
    render({ destination: destination.value, start: start.value, days: Number(days.value), notes: notes.value });
  } else {
    render(null);
  }

  root.querySelector('[data-trip-create]').addEventListener('click', () => {
    const plan = {
      destination: destination.value.trim().slice(0, 80),
      start: start.value,
      days: Math.max(1, Math.min(30, Math.floor(Number(days.value) || 3))),
      notes: notes.value.trim().slice(0, 500),
      createdAt: Date.now()
    };
    if (!plan.destination || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start)) {
      status.textContent = 'Choose a destination and valid start date.';
      return;
    }
    saveJson(TRIP_KEY, plan);
    status.textContent = 'Private itinerary saved on this device.';
    render(plan);
  });

  root.querySelector('[data-trip-clear]').addEventListener('click', () => {
    localStorage.removeItem(TRIP_KEY);
    destination.value = '';
    notes.value = '';
    days.value = '3';
    status.textContent = 'Saved trip plan cleared.';
    render(null);
  });

  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
