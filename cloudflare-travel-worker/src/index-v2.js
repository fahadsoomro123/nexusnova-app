import legacy from './index.js';

const SCRAPPA_BASE = 'https://scrappa.co/api';
const TIMEOUT_MS = 26000;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
});
const text = value => String(value ?? '').trim();
const CITY_IATA = Object.freeze({
  karachi: 'KHI', lahore: 'LHE', islamabad: 'ISB', rawalpindi: 'ISB', peshawar: 'PEW', multan: 'MUX', sialkot: 'SKT', quetta: 'UET', faisalabad: 'LYP',
  dubai: 'DXB', jeddah: 'JED', makkah: 'JED', mecca: 'JED', madinah: 'MED', medina: 'MED', riyadh: 'RUH', doha: 'DOH', 'abu dhabi': 'AUH', sharjah: 'SHJ', muscat: 'MCT', istanbul: 'IST',
  london: 'LHR', paris: 'CDG', frankfurt: 'FRA', rome: 'FCO', madrid: 'MAD', barcelona: 'BCN', amsterdam: 'AMS', zurich: 'ZRH', vienna: 'VIE', athens: 'ATH',
  'new york': 'JFK', losangeles: 'LAX', 'los angeles': 'LAX', chicago: 'ORD', toronto: 'YYZ', vancouver: 'YVR', sydney: 'SYD', melbourne: 'MEL', singapore: 'SIN',
  bangkok: 'BKK', tokyo: 'HND', seoul: 'ICN', beijing: 'PEK', shanghai: 'PVG', hongkong: 'HKG', 'hong kong': 'HKG', delhi: 'DEL', 'new delhi': 'DEL', mumbai: 'BOM',
  dhaka: 'DAC', colombo: 'CMB', kathmandu: 'KTM', cairo: 'CAI', nairobi: 'NBO', johannesburg: 'JNB'
});
let airportsCache = { expiresAt: 0, rows: [] };

function clean(value, label, max = 80) {
  const v = text(value);
  if (!v || v.length > max) throw Object.assign(new Error(`Invalid ${label}.`), { status: 400 });
  return v;
}
function cleanDate(value, label = 'date') {
  const v = clean(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(`${v}T00:00:00Z`))) {
    throw Object.assign(new Error(`Invalid ${label}.`), { status: 400 });
  }
  return v;
}
function cleanAdults(value) {
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 1 || n > 9) throw Object.assign(new Error('Adults must be between 1 and 9.'), { status: 400 });
  return n;
}
function cleanCabin(value) {
  const v = text(value || 'economy').toLowerCase();
  return ['economy', 'premium_economy', 'business', 'first'].includes(v) ? v : 'economy';
}
function cleanCurrency(value) {
  const v = text(value || 'PKR').toUpperCase();
  return /^[A-Z]{3}$/.test(v) ? v : 'PKR';
}

async function fetchJson(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) {
      const message = data?.message || data?.error || data?.errors?.origin?.[0] || data?.errors?.departure_date?.[0] || `HTTP ${response.status}`;
      const error = new Error(String(message).slice(0, 220));
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyFirebaseUser(request, env) {
  const auth = text(request.headers.get('Authorization'));
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Sign in first.'), { status: 401 });
  const idToken = auth.slice(7).trim();
  if (!idToken) throw Object.assign(new Error('Sign in first.'), { status: 401 });
  const data = await fetchJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
    10000
  ).catch(error => { throw Object.assign(new Error('Invalid or expired NexusNova sign-in.'), { status: 401, cause: error }); });
  if (!data?.users?.[0]?.localId) throw Object.assign(new Error('Invalid NexusNova user.'), { status: 401 });
}

async function airportRows() {
  if (airportsCache.rows.length && Date.now() < airportsCache.expiresAt) return airportsCache.rows;
  const data = await fetchJson(`${SCRAPPA_BASE}/flights/airports`, { headers: { Accept: 'application/json' } }, 15000);
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.airports) ? data.airports : (Array.isArray(data?.data) ? data.data : []));
  airportsCache = { rows, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return rows;
}

function airportCodeOf(item) {
  return text(item?.iata_code || item?.iata || item?.code || item?.airport_code).toUpperCase();
}
function airportSearchText(item) {
  return [item?.name, item?.airport_name, item?.city, item?.city_name, item?.country, item?.country_name, airportCodeOf(item)]
    .filter(Boolean).join(' ').toLowerCase();
}
async function resolveAirport(raw) {
  const q = clean(raw, 'origin/destination');
  if (/^[A-Za-z]{3}$/.test(q)) return q.toUpperCase();
  const explicit = /\b([A-Za-z]{3})\b/.exec(q);
  if (explicit) return explicit[1].toUpperCase();
  const normalized = q.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (CITY_IATA[normalized]) return CITY_IATA[normalized];
  try {
    const rows = await airportRows();
    const exactCity = rows.find(item => text(item?.city || item?.city_name).toLowerCase() === normalized && /^[A-Z]{3}$/.test(airportCodeOf(item)));
    if (exactCity) return airportCodeOf(exactCity);
    const match = rows.find(item => airportSearchText(item).includes(normalized) && /^[A-Z]{3}$/.test(airportCodeOf(item)));
    if (match) return airportCodeOf(match);
  } catch {}
  throw Object.assign(new Error(`Could not resolve “${q}” to an airport. Use a 3-letter IATA code.`), { status: 400 });
}

function numberFrom(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return Number(value.amount ?? value.value ?? value.total ?? value.price);
  return Number(value);
}
function flightLegs(item) {
  const candidates = [item?.outbound_legs, item?.outbound?.legs, item?.legs, item?.segments, item?.outbound];
  for (const value of candidates) if (Array.isArray(value)) return value;
  return [];
}
function legAirport(leg, side) {
  const value = side === 'departure'
    ? (leg?.departure_airport || leg?.origin || leg?.from || leg?.departure?.airport || leg?.departure?.iata)
    : (leg?.arrival_airport || leg?.destination || leg?.to || leg?.arrival?.airport || leg?.arrival?.iata);
  return text(typeof value === 'object' ? (value.iata || value.code || value.iata_code) : value).toUpperCase();
}
function legTime(leg, side) {
  const value = side === 'departure'
    ? (leg?.departure_time || leg?.departing_at || leg?.departure?.time || leg?.departure?.at)
    : (leg?.arrival_time || leg?.arriving_at || leg?.arrival?.time || leg?.arrival?.at);
  return text(value);
}
function durationMinutes(leg) {
  const direct = Number(leg?.duration_minutes ?? leg?.duration);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const a = Date.parse(legTime(leg, 'departure'));
  const b = Date.parse(legTime(leg, 'arrival'));
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 60000) : 0;
}
function normalizeScrappaFlight(item, criteria, index) {
  const total = numberFrom(item?.price ?? item?.total_price ?? item?.fare?.price ?? item?.price_total);
  const cur = text(item?.currency || item?.price?.currency || item?.fare?.currency || criteria.currency).toUpperCase();
  if (!(total > 0) || !/^[A-Z]{3}$/.test(cur)) return null;
  const allLegs = flightLegs(item);
  if (!allLegs.length) return null;
  let legs = allLegs;
  if (criteria.returnDate) {
    const arrivalIndex = allLegs.findIndex(leg => legAirport(leg, 'arrival') === criteria.destinationCode);
    if (arrivalIndex >= 0) legs = allLegs.slice(0, arrivalIndex + 1);
  }
  const first = legs[0];
  const last = legs[legs.length - 1];
  const carriers = [...new Set(legs.flatMap(leg => [
    text(leg?.airline_name), text(leg?.airline), text(leg?.carrier_name), text(leg?.carrier)
  ]).filter(Boolean))];
  const stopCount = Number.isFinite(Number(item?.stops))
    ? Number(item.stops)
    : Math.max(0, legs.length - 1);
  const duration = criteria.returnDate
    ? legs.reduce((sum, leg) => sum + durationMinutes(leg), 0)
    : (Number(item?.total_duration_minutes) || legs.reduce((sum, leg) => sum + durationMinutes(leg), 0));
  return {
    id: `scrappa:${text(item?.id || item?.booking_token || index || crypto.randomUUID())}`,
    provider: 'Scrappa Google Flights',
    providerOfferId: text(item?.id || item?.booking_token),
    bookingToken: text(item?.booking_token),
    originCode: criteria.originCode,
    destinationCode: criteria.destinationCode,
    originLabel: criteria.originCode,
    destinationLabel: criteria.destinationCode,
    total,
    currency: cur,
    compareTotal: total,
    compareCurrency: cur,
    departingAt: legTime(first, 'departure'),
    arrivingAt: legTime(last, 'arrival'),
    durationMinutes: duration || null,
    stops: Math.max(0, stopCount),
    carriers: carriers.length ? carriers : ['Google Flights'],
    flightNumber: text(first?.flight_number || first?.flight_no),
    live: true,
    source: 'scrappa-google-flights'
  };
}

async function searchScrappaFlights(payload, env) {
  const apiKey = text(env.SCRAPPA_API_KEY);
  if (!apiKey) {
    return { ok: false, reason: 'provider-not-configured', provider: 'Scrappa Google Flights', message: 'Global flight provider is not configured yet.', offers: [] };
  }
  const criteria = {
    origin: clean(payload?.origin, 'origin'),
    destination: clean(payload?.destination, 'destination'),
    departureDate: cleanDate(payload?.departureDate, 'departure date'),
    returnDate: payload?.returnDate ? cleanDate(payload.returnDate, 'return date') : '',
    adults: cleanAdults(payload?.adults ?? 1),
    cabin: cleanCabin(payload?.cabin),
    currency: cleanCurrency(payload?.currency)
  };
  if (criteria.origin.toLowerCase() === criteria.destination.toLowerCase()) {
    throw Object.assign(new Error('Origin and destination must be different.'), { status: 400 });
  }
  if (criteria.returnDate && criteria.returnDate < criteria.departureDate) {
    throw Object.assign(new Error('Return date must be on or after departure date.'), { status: 400 });
  }
  const [originCode, destinationCode] = await Promise.all([resolveAirport(criteria.origin), resolveAirport(criteria.destination)]);
  criteria.originCode = originCode;
  criteria.destinationCode = destinationCode;
  const endpoint = criteria.returnDate ? 'round-trip' : 'one-way';
  const params = new URLSearchParams({
    origin: originCode,
    destination: destinationCode,
    departure_date: criteria.departureDate,
    adults: String(criteria.adults),
    cabin_class: criteria.cabin,
    sort_by: 'cheapest',
    hl: 'en',
    gl: 'pk',
    currency: criteria.currency
  });
  if (criteria.returnDate) params.set('return_date', criteria.returnDate);
  const data = await fetchJson(`${SCRAPPA_BASE}/flights/${endpoint}?${params.toString()}`, {
    headers: { Accept: 'application/json', 'X-API-KEY': apiKey }
  });
  const flights = Array.isArray(data?.flights) ? data.flights : [];
  const offers = flights
    .map((item, index) => normalizeScrappaFlight(item, criteria, index))
    .filter(Boolean)
    .sort((a, b) => a.compareTotal - b.compareTotal)
    .slice(0, 30);
  return {
    ok: true,
    searchedAt: Date.now(),
    provider: 'Scrappa Google Flights',
    route: { origin: { code: originCode, label: originCode }, destination: { code: destinationCode, label: destinationCode } },
    currency: criteria.currency,
    searchMetadata: data?.search_metadata || null,
    offers
  };
}

async function mergedHealth(request, env) {
  let base = { ok: true, backend: 'cloudflare-workers', providers: {} };
  try {
    const response = await legacy.fetch(new Request(new URL('/health', request.url), { method: 'GET' }), env);
    if (response?.ok) base = await response.json();
  } catch {}
  return {
    ...base,
    backend: 'cloudflare-workers',
    providers: { ...(base.providers || {}), scrappa: Boolean(text(env.SCRAPPA_API_KEY)) },
    searchedAt: Date.now()
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return json(await mergedHealth(request, env));
    if (url.pathname === '/rpc/searchWorldwideFlights' && request.method === 'POST' && text(env.SCRAPPA_API_KEY)) {
      try {
        await verifyFirebaseUser(request, env);
        let payload = {};
        try { payload = await request.json(); } catch {}
        const result = await searchScrappaFlights(payload || {}, env);
        return json(result);
      } catch (error) {
        const rawStatus = Number(error?.status);
        const status = rawStatus === 401 ? 401 : rawStatus === 402 ? 402 : rawStatus === 429 ? 429 : rawStatus >= 400 && rawStatus < 500 ? 400 : 503;
        let message = text(error?.message || 'Global flight search failed.').slice(0, 240);
        if (rawStatus === 402) message = 'Scrappa flight-search credits are exhausted.';
        if (rawStatus === 429) message = 'Flight provider is rate-limited. Please retry shortly.';
        return json({ ok: false, provider: 'Scrappa Google Flights', message, offers: [] }, status);
      }
    }
    return legacy.fetch(request, env, ctx);
  }
};
