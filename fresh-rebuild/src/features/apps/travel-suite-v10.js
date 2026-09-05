import { renderTravelSuite as renderTravelSuiteV9 } from './travel-suite-v9.js';
import { travelHealth } from './travel-edge-client.js';

function setDot(root, key, state, title = '') {
  const dot = root.querySelector(`[data-api-dot="${key}"]`);
  if (!dot) return;
  dot.dataset.state = state;
  if (title) dot.title = title;
}

async function refreshCloudflareOnlyHealth(root) {
  const health = await travelHealth();
  const p = health?.providers || {};
  const flights = Boolean(p.scrappaFlights || p.scrappa || p.travelLine || p.flyNDeal);
  const hotels = Boolean(p.scrappaHotels || p.scrappa);
  const ground = Boolean(p.distribusion || p.pakistanBusPartner);

  setDot(root, 'flights', flights ? 'live' : 'standby', `Cloudflare only • ${flights ? 'global flight provider ready' : 'flight provider standby'}`);
  setDot(root, 'hotels', hotels ? 'live' : 'standby', `Cloudflare only • ${hotels ? 'global hotel provider ready' : 'hotel provider standby'}`);
  setDot(root, 'ground', ground ? 'live' : 'standby', `Cloudflare only • ${ground ? 'rail/bus provider ready' : 'rail/bus provider key pending'}`);

  root.dataset.backend = 'cloudflare-only';
  root.dataset.firebaseRequired = 'false';
  root.dataset.googleBillingRequired = 'false';
  root.dataset.globalFlightsReady = String(Boolean(health?.coverage?.globalFlights));
  root.dataset.globalHotelsReady = String(Boolean(health?.coverage?.globalHotels));
  root.dataset.globalGroundReady = String(Boolean(health?.coverage?.globalRailBus));
  root.dataset.pakistanBusReady = String(Boolean(health?.coverage?.pakistanBusFares));
}

export function renderTravelSuite() {
  const root = renderTravelSuiteV9();
  root.classList.add('nn-travel-v10-cloudflare-only');
  queueMicrotask(() => refreshCloudflareOnlyHealth(root).catch(() => {}));
  setTimeout(() => { if (root.isConnected) refreshCloudflareOnlyHealth(root).catch(() => {}); }, 900);
  return root;
}

export const travelSuiteRenderers = Object.freeze({ travel: renderTravelSuite });
