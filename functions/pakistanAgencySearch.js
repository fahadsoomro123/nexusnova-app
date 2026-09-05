const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');

const TRAVEL_PROVIDER_CONFIG = defineSecret('NEXUSNOVA_TRAVEL_PROVIDERS');
const TIMEOUT_MS = 18000;
const TRAVEL_LINE_BASE = 'https://api.travellinetour.com/v1/external';
const FLYNDEAL_BASE = 'https://flyndeal.com/api/b2b';

const CITY_IATA = Object.freeze({
  karachi:'KHI', lahore:'LHE', islamabad:'ISB', rawalpindi:'ISB', peshawar:'PEW', multan:'MUX', sialkot:'SKT', quetta:'UET', faisalabad:'LYP',
  dubai:'DXB', jeddah:'JED', makkah:'JED', mecca:'JED', madinah:'MED', medina:'MED', riyadh:'RUH', doha:'DOH', abu_dhabi:'AUH', 'abu dhabi':'AUH', sharjah:'SHJ', muscat:'MCT', istanbul:'IST'
});

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
}

function cleanText(value, label, max = 80) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new HttpsError('invalid-argument', `Invalid ${label}.`);
  return text;
}

function cleanDate(value) {
  const text = cleanText(value, 'departure date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`))) {
    throw new HttpsError('invalid-argument', 'Invalid departure date.');
  }
  return text;
}

function cleanPassengers(value) {
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 1 || n > 9) throw new HttpsError('invalid-argument', 'Passengers must be between 1 and 9.');
  return n;
}

function parseConfig() {
  let raw = '';
  try { raw = String(TRAVEL_PROVIDER_CONFIG.value() || '').trim(); } catch {}
  let parsed = {};
  if (raw) {
    try { parsed = JSON.parse(raw); }
    catch { throw new HttpsError('internal', 'Travel provider secret is invalid JSON.'); }
  }
  return {
    travelLineApiKey: String(parsed.travelLineApiKey || process.env.TRAVEL_LINE_API_KEY || '').trim(),
    flyNDealApiKey: String(parsed.flyNDealApiKey || process.env.FLYNDEAL_API_KEY || '').trim()
  };
}

function iata(raw) {
  const text = cleanText(raw, 'origin/destination', 80);
  if (/^[A-Za-z]{3}$/.test(text)) return text.toUpperCase();
  const normalized = text.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const explicit = /\b([A-Za-z]{3})\b/.exec(text);
  if (explicit) return explicit[1].toUpperCase();
  return CITY_IATA[normalized] || CITY_IATA[normalized.replace(/\s+/g, '_')] || '';
}

async function fetchJson(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {...options, signal: controller.signal});
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const detail = data?.message || data?.error || data?.errors?.[0]?.message || data?.errors?.[0]?.detail || `HTTP ${response.status}`;
      throw new Error(String(detail).slice(0, 220));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseDuration(text) {
  const value = String(text || '').toLowerCase();
  const h = Number((/(\d+)\s*h/.exec(value) || [])[1] || 0);
  const m = Number((/(\d+)\s*m/.exec(value) || [])[1] || 0);
  return h * 60 + m || null;
}

function mapCurrency(code) {
  const value = String(code || 'PKR').toUpperCase();
  return value === 'RS' || value === 'PKRS' ? 'PKR' : value;
}

async function searchTravelLine(config, criteria) {
  if (!config.travelLineApiKey) throw new Error('Travel Line API is not configured.');
  const origin = iata(criteria.origin), destination = iata(criteria.destination);
  if (!origin || !destination) throw new Error('Travel Line requires a supported city or IATA code.');
  const qs = new URLSearchParams({
    departure: origin,
    arrival: destination,
    departureDateFrom: criteria.date,
    departureDateTo: criteria.date,
    page: '1',
    limit: '50'
  });
  const json = await fetchJson(`${TRAVEL_LINE_BASE}/groups?${qs.toString()}`, {
    method: 'GET',
    headers: {Accept:'application/json', Authorization:`Bearer ${config.travelLineApiKey}`}
  });
  const flights = Array.isArray(json?.flights) ? json.flights : [];
  return flights.map(item => {
    const itineraries = Array.isArray(item?.itineraries) ? item.itineraries : [];
    const segments = itineraries.flatMap(x => Array.isArray(x?.segments) ? x.segments : []);
    const first = segments[0] || {}, last = segments[segments.length - 1] || {};
    const unit = Number(item?.fares?.salePrice);
    const currency = mapCurrency(item?.fares?.currencyCode);
    if (!(unit > 0) || !/^[A-Z]{3}$/.test(currency)) return null;
    return {
      id: `travelline:${String(item?._id || Math.random())}`,
      provider: 'Travel Line Travel & Tours', agency: true, live: true,
      providerOfferId: String(item?._id || ''),
      originCode: String(first?.departure?.airport?.iataCode || origin).toUpperCase(),
      destinationCode: String(last?.arrival?.airport?.iataCode || destination).toUpperCase(),
      originLabel: String(first?.departure?.airport?.city || origin),
      destinationLabel: String(last?.arrival?.airport?.city || destination),
      total: Number((unit * criteria.passengers).toFixed(2)),
      perTraveler: unit,
      currency,
      compareTotal: Number((unit * criteria.passengers).toFixed(2)),
      compareCurrency: currency,
      departingAt: String(first?.departure?.datetime || ''),
      arrivingAt: String(last?.arrival?.datetime || ''),
      durationMinutes: parseDuration(itineraries[0]?.duration),
      stops: Math.max(0, segments.length - 1),
      carriers: [String(first?.airline?.carrierName || first?.airline?.carrierCode || 'Travel Line')],
      flightNumber: String(first?.flightNumber || ''),
      seatsLeft: Number.isFinite(Number(item?.availableSeats)) ? Number(item.availableSeats) : null,
      source: 'pakistan-agency'
    };
  }).filter(Boolean);
}

async function searchFlyNDeal(config, criteria) {
  if (!config.flyNDealApiKey) throw new Error('FlyNDeal API is not configured.');
  const origin = iata(criteria.origin), destination = iata(criteria.destination);
  if (!origin || !destination) throw new Error('FlyNDeal requires a supported city or IATA code.');
  const json = await fetchJson(`${FLYNDEAL_BASE}/tickets/search`, {
    method: 'POST',
    headers: {'Content-Type':'application/json', Accept:'application/json', 'x-api-key':config.flyNDealApiKey},
    body: JSON.stringify({from:origin, to:destination, date:criteria.date, passengers:criteria.passengers})
  });
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(item => {
    const total = Number(item?.pricing?.total);
    const currency = mapCurrency(item?.pricing?.currency || 'PKR');
    if (!(total > 0) || !/^[A-Z]{3}$/.test(currency)) return null;
    return {
      id: `flyndeal:${String(item?.id || Math.random())}`,
      provider: 'FlyNDeal', agency: true, live: true,
      providerOfferId: String(item?.id || ''),
      originCode: String(item?.sector?.from || origin).toUpperCase(),
      destinationCode: String(item?.sector?.to || destination).toUpperCase(),
      originLabel: String(item?.sector?.from || origin),
      destinationLabel: String(item?.sector?.to || destination),
      total, currency, compareTotal: total, compareCurrency: currency,
      departingAt: `${criteria.date}T${String(item?.departureTime || '00:00').slice(0,5)}:00`,
      arrivingAt: item?.arrivalTime ? `${criteria.date}T${String(item.arrivalTime).slice(0,8)}` : '',
      durationMinutes: null,
      stops: 0,
      carriers: [String(item?.airline?.name || item?.airline?.code || 'FlyNDeal')],
      flightNumber: String(item?.flightNo || ''),
      seatsLeft: Number.isFinite(Number(item?.seatsAvailable)) ? Number(item.seatsAvailable) : null,
      source: 'pakistan-agency'
    };
  }).filter(Boolean);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = [item.provider,item.originCode,item.destinationCode,String(item.departingAt).slice(0,16),Math.round(Number(item.total)||0),item.currency].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

exports.searchPakistanAgencyFlights = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 30,
  memory: '256MiB',
  secrets: [TRAVEL_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const criteria = {
    origin: cleanText(req.data?.origin, 'origin', 80),
    destination: cleanText(req.data?.destination, 'destination', 80),
    date: cleanDate(req.data?.departureDate),
    passengers: cleanPassengers(req.data?.adults)
  };
  if (criteria.origin.toLowerCase() === criteria.destination.toLowerCase()) throw new HttpsError('invalid-argument', 'Origin and destination must be different.');
  const config = parseConfig();
  const configured = {travelLine:Boolean(config.travelLineApiKey), flyNDeal:Boolean(config.flyNDealApiKey)};
  const jobs = [];
  if (configured.travelLine) jobs.push(searchTravelLine(config, criteria));
  if (configured.flyNDeal) jobs.push(searchFlyNDeal(config, criteria));
  if (!jobs.length) return {ok:false, reason:'pakistan-agencies-not-configured', providers:configured, offers:[]};
  const settled = await Promise.allSettled(jobs);
  const providerErrors = [];
  let offers = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') offers.push(...result.value);
    else providerErrors.push(String(result.reason?.message || result.reason || 'Agency search failed.').slice(0,220));
  }
  offers = dedupe(offers).sort((a,b)=>(Number(a.compareTotal)||1e15)-(Number(b.compareTotal)||1e15)).slice(0,36);
  return {ok:true, searchedAt:Date.now(), providers:configured, providerErrors, offers};
});

exports.searchPakistanUmrahPackages = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 25,
  memory: '256MiB',
  secrets: [TRAVEL_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const config = parseConfig();
  if (!config.travelLineApiKey) return {ok:false, reason:'package-provider-not-configured', providers:{travelLine:false}, packages:[]};
  const json = await fetchJson(`${TRAVEL_LINE_BASE}/umrah/packages`, {
    method:'GET', headers:{Accept:'application/json', Authorization:`Bearer ${config.travelLineApiKey}`}
  });
  const rows = Array.isArray(json) ? json : [];
  const packages = rows.map(item => ({
    id:String(item?.id || item?._id || item?.slug || Math.random()),
    provider:'Travel Line Travel & Tours', agency:true, live:true,
    title:String(item?.title || 'Umrah package'),
    price:Number(item?.price)||null,
    currency:mapCurrency(item?.currency || 'PKR'),
    durationDays:Number(item?.durationDays)||null,
    durationNights:Number(item?.durationNights)||null,
    fromCity:String(item?.fromCity || ''), toCity:String(item?.toCity || ''),
    airline:String(item?.airline || ''), departureDate:String(item?.departureDate || ''), returnDate:String(item?.returnDate || ''),
    seatsAvailable:Number.isFinite(Number(item?.seatsAvailable)) ? Number(item.seatsAvailable) : null,
    inclusions:Array.isArray(item?.inclusions) ? item.inclusions.slice(0,12).map(String) : [],
    hotel:item?.hotel || null,
    pricingOptions:item?.pricingOptions || null,
    source:'pakistan-agency'
  })).filter(item => item.price && item.currency);
  packages.sort((a,b)=>a.price-b.price);
  return {ok:true, searchedAt:Date.now(), providers:{travelLine:true}, packages};
});
