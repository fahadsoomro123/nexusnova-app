const SCRAPPA_BASE = 'https://scrappa.co/api';
const DISTRIBUSION_DEFAULT = 'https://api.distribusion.com';
const TRAVEL_LINE_BASE = 'https://api.travellinetour.com/v1/external';
const FLYNDEAL_BASE = 'https://flyndeal.com/api/b2b';
const TIMEOUT_MS = 26000;
const RETRYABLE = new Set([429, 500, 502, 503]);
const MAX_RPC_PER_MINUTE = 40;
const rateBuckets = new Map();
let airportCache = { rows: [], expiresAt: 0 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-NexusNova-Client',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
  'X-NexusNova-Travel-Backend': 'cloudflare-only'
};
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, ...extra, 'Content-Type': 'application/json; charset=utf-8' }
});
const text = value => String(value ?? '').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const CITY_IATA = Object.freeze({
  karachi:'KHI', lahore:'LHE', islamabad:'ISB', rawalpindi:'ISB', peshawar:'PEW', multan:'MUX', sialkot:'SKT', quetta:'UET', faisalabad:'LYP',
  dubai:'DXB', jeddah:'JED', makkah:'JED', mecca:'JED', madinah:'MED', medina:'MED', riyadh:'RUH', doha:'DOH', 'abu dhabi':'AUH', sharjah:'SHJ', muscat:'MCT', istanbul:'IST',
  london:'LHR', paris:'CDG', frankfurt:'FRA', rome:'FCO', madrid:'MAD', barcelona:'BCN', amsterdam:'AMS', zurich:'ZRH', vienna:'VIE', athens:'ATH',
  'new york':'JFK', 'los angeles':'LAX', losangeles:'LAX', chicago:'ORD', toronto:'YYZ', vancouver:'YVR', sydney:'SYD', melbourne:'MEL', singapore:'SIN',
  bangkok:'BKK', tokyo:'HND', seoul:'ICN', beijing:'PEK', shanghai:'PVG', 'hong kong':'HKG', hongkong:'HKG', delhi:'DEL', 'new delhi':'DEL', mumbai:'BOM',
  dhaka:'DAC', colombo:'CMB', kathmandu:'KTM', cairo:'CAI', nairobi:'NBO', johannesburg:'JNB'
});

function clean(value, label, max = 100) {
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
function cleanCount(value, label = 'passengers', min = 1, max = 9) {
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < min || n > max) throw Object.assign(new Error(`${label} must be between ${min} and ${max}.`), { status: 400 });
  return n;
}
function cleanCurrency(value) {
  const v = text(value || 'PKR').toUpperCase();
  return /^[A-Z]{3}$/.test(v) ? v : 'PKR';
}
function cleanCabin(value) {
  const v = text(value || 'economy').toLowerCase();
  return ['economy','premium_economy','business','first'].includes(v) ? v : 'economy';
}
function providerConfig(env) {
  let packed = {};
  try { if (text(env.NEXUSNOVA_TRAVEL_PROVIDERS)) packed = JSON.parse(env.NEXUSNOVA_TRAVEL_PROVIDERS); } catch { throw new Error('Travel provider secret JSON is invalid.'); }
  return {
    scrappaApiKey: text(packed.scrappaApiKey || env.SCRAPPA_API_KEY),
    distribusionApiKey: text(packed.distribusionApiKey || env.DISTRIBUSION_API_KEY),
    distribusionApiBase: text(packed.distribusionApiBase || env.DISTRIBUSION_API_BASE || DISTRIBUSION_DEFAULT).replace(/\/+$/, ''),
    travelLineApiKey: text(packed.travelLineApiKey || env.TRAVEL_LINE_API_KEY),
    flyNDealApiKey: text(packed.flyNDealApiKey || env.FLYNDEAL_API_KEY)
  };
}

async function fetchJson(url, options = {}, timeoutMs = TIMEOUT_MS, retries = 0) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!response.ok) {
        const message = data?.message || data?.error || data?.errors?.[0]?.detail || data?.errors?.[0]?.title || `HTTP ${response.status}`;
        const error = Object.assign(new Error(String(message).slice(0, 240)), { status: response.status });
        if (attempt < retries && RETRYABLE.has(response.status)) { lastError = error; await sleep(700 * (2 ** attempt)); continue; }
        throw error;
      }
      return data;
    } catch (error) {
      if (attempt < retries && (error?.name === 'AbortError' || RETRYABLE.has(Number(error?.status)))) { lastError = error; await sleep(700 * (2 ** attempt)); continue; }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Provider request failed.');
}

function rateLimit(request) {
  const ip = text(request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown').split(',')[0];
  const minute = Math.floor(Date.now() / 60000);
  const key = `${ip}:${minute}`;
  const count = (rateBuckets.get(key) || 0) + 1;
  rateBuckets.set(key, count);
  if (rateBuckets.size > 1500) {
    for (const k of rateBuckets.keys()) if (!k.endsWith(`:${minute}`)) rateBuckets.delete(k);
  }
  if (count > MAX_RPC_PER_MINUTE) throw Object.assign(new Error('Too many Travel searches. Try again in a minute.'), { status: 429 });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
async function cacheKey(name, payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(payload || {})));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  return new Request(`https://travel-cache.nexusnova.invalid/${encodeURIComponent(name)}/${hex}`, { method: 'GET' });
}
async function cachedRpc(name, payload, ttlSeconds, producer) {
  try {
    const key = await cacheKey(name, payload);
    const cached = await caches.default.match(key);
    if (cached) return await cached.json();
    const data = await producer();
    if (data?.ok === true) await caches.default.put(key, json(data, 200, { 'Cache-Control': `public, max-age=${ttlSeconds}` }));
    return data;
  } catch (error) {
    if (error?.status) throw error;
    return producer();
  }
}

async function fxRate(from, to) {
  if (from === to) return 1;
  const data = await fetchJson(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {}, 9000, 1);
  const rate = Number(data?.rates?.[to]);
  return rate > 0 ? rate : null;
}

async function airportRows(apiKey) {
  if (airportCache.rows.length && Date.now() < airportCache.expiresAt) return airportCache.rows;
  const data = await fetchJson(`${SCRAPPA_BASE}/flights/airports`, { headers: { Accept: 'application/json', 'X-API-KEY': apiKey } }, 15000, 1);
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.airports) ? data.airports : (Array.isArray(data?.data) ? data.data : []));
  airportCache = { rows, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return rows;
}
function airportCode(item) { return text(item?.iata_code || item?.iata || item?.code || item?.airport_code).toUpperCase(); }
async function resolveAirport(raw, apiKey) {
  const q = clean(raw, 'origin/destination');
  if (/^[A-Za-z]{3}$/.test(q)) return q.toUpperCase();
  const explicit = /\b([A-Za-z]{3})\b/.exec(q);
  if (explicit) return explicit[1].toUpperCase();
  const normalized = q.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (CITY_IATA[normalized]) return CITY_IATA[normalized];
  try {
    const rows = await airportRows(apiKey);
    const exact = rows.find(x => text(x?.city || x?.city_name).toLowerCase() === normalized && /^[A-Z]{3}$/.test(airportCode(x)));
    if (exact) return airportCode(exact);
    const fuzzy = rows.find(x => [x?.name,x?.airport_name,x?.city,x?.city_name,x?.country,x?.country_name,airportCode(x)].filter(Boolean).join(' ').toLowerCase().includes(normalized) && /^[A-Z]{3}$/.test(airportCode(x)));
    if (fuzzy) return airportCode(fuzzy);
  } catch {}
  throw Object.assign(new Error(`Could not resolve “${q}” to an airport. Use a 3-letter IATA code.`), { status: 400 });
}
function numberFrom(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return Number(value.amount ?? value.value ?? value.total ?? value.price);
  return Number(value);
}
function flightLegs(item) {
  for (const v of [item?.outbound_legs,item?.outbound?.legs,item?.legs,item?.segments,item?.outbound]) if (Array.isArray(v)) return v;
  return [];
}
function legAirport(leg, side) {
  const v = side === 'departure' ? (leg?.departure_airport || leg?.origin || leg?.from || leg?.departure?.airport || leg?.departure?.iata) : (leg?.arrival_airport || leg?.destination || leg?.to || leg?.arrival?.airport || leg?.arrival?.iata);
  return text(typeof v === 'object' ? (v.iata || v.code || v.iata_code) : v).toUpperCase();
}
function legTime(leg, side) {
  const v = side === 'departure' ? (leg?.departure_time || leg?.departing_at || leg?.departure?.time || leg?.departure?.at) : (leg?.arrival_time || leg?.arriving_at || leg?.arrival?.time || leg?.arrival?.at);
  return text(v);
}
function durationMinutes(leg) {
  const direct = Number(leg?.duration_minutes ?? leg?.duration);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const a = Date.parse(legTime(leg, 'departure')), b = Date.parse(legTime(leg, 'arrival'));
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 60000) : 0;
}
async function searchFlights(cfg, p) {
  if (!cfg.scrappaApiKey) return { ok:false, reason:'provider-not-configured', provider:'Scrappa Google Flights', message:'Global flight provider is not configured yet.', offers:[] };
  const criteria = {
    origin: clean(p?.origin, 'origin'), destination: clean(p?.destination, 'destination'),
    departureDate: cleanDate(p?.departureDate, 'departure date'), returnDate: p?.returnDate ? cleanDate(p.returnDate, 'return date') : '',
    adults: cleanCount(p?.adults ?? 1, 'Adults'), cabin: cleanCabin(p?.cabin), currency: cleanCurrency(p?.currency)
  };
  if (criteria.origin.toLowerCase() === criteria.destination.toLowerCase()) throw Object.assign(new Error('Origin and destination must be different.'), { status:400 });
  if (criteria.returnDate && criteria.returnDate < criteria.departureDate) throw Object.assign(new Error('Return date must be on or after departure date.'), { status:400 });
  const [originCode, destinationCode] = await Promise.all([resolveAirport(criteria.origin, cfg.scrappaApiKey), resolveAirport(criteria.destination, cfg.scrappaApiKey)]);
  const endpoint = criteria.returnDate ? 'round-trip' : 'one-way';
  const qs = new URLSearchParams({ origin:originCode, destination:destinationCode, departure_date:criteria.departureDate, adults:String(criteria.adults), cabin_class:criteria.cabin, sort_by:'cheapest', hl:'en', gl:'pk', currency:'USD' });
  if (criteria.returnDate) qs.set('return_date', criteria.returnDate);
  const data = await fetchJson(`${SCRAPPA_BASE}/flights/${endpoint}?${qs}`, { headers:{ Accept:'application/json', 'X-API-KEY':cfg.scrappaApiKey } }, TIMEOUT_MS, 2);
  const targetRate = criteria.currency === 'USD' ? 1 : await fxRate('USD', criteria.currency).catch(() => null);
  const rows = Array.isArray(data?.flights) ? data.flights : [];
  const offers = rows.map((item, index) => {
    const usdTotal = numberFrom(item?.price ?? item?.total_price ?? item?.fare?.price ?? item?.price_total);
    if (!(usdTotal > 0)) return null;
    const legs = flightLegs(item); if (!legs.length) return null;
    const first = legs[0], last = legs[legs.length - 1];
    const compareTotal = targetRate ? Number((usdTotal * targetRate).toFixed(2)) : usdTotal;
    const compareCurrency = targetRate ? criteria.currency : 'USD';
    const carriers = [...new Set([text(item?.airline_name), ...legs.flatMap(l => [text(l?.airline_name), text(l?.airline), text(l?.carrier_name), text(l?.carrier)]).filter(Boolean)])].filter(Boolean);
    return {
      id:`scrappa:${text(item?.booking_token || item?.id || index)}`, provider:'Scrappa Google Flights', providerOfferId:text(item?.id || item?.booking_token), bookingToken:text(item?.booking_token),
      originCode, destinationCode, originLabel:originCode, destinationLabel:destinationCode,
      total:usdTotal, currency:'USD', compareTotal, compareCurrency,
      departingAt:legTime(first,'departure'), arrivingAt:legTime(last,'arrival'),
      durationMinutes:Number(item?.total_duration_minutes) || legs.reduce((s,l)=>s+durationMinutes(l),0) || null,
      stops:Number.isFinite(Number(item?.stops)) ? Math.max(0, Number(item.stops)) : Math.max(0, legs.length - 1),
      carriers:carriers.length ? carriers : ['Google Flights'], flightNumber:text(first?.flight_number || first?.flight_no),
      live:true, source:'scrappa-google-flights', priceVerifiedIn:'USD', requestedCurrency:criteria.currency
    };
  }).filter(Boolean).sort((a,b)=>a.compareTotal-b.compareTotal).slice(0,30);
  return { ok:true, searchedAt:Date.now(), provider:'Scrappa Google Flights', route:{origin:{code:originCode,label:originCode},destination:{code:destinationCode,label:destinationCode}}, currency:criteria.currency, offers };
}

function nights(a,b) { return Math.max(1, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)); }
async function searchHotels(cfg, p) {
  if (!cfg.scrappaApiKey) return { ok:false, reason:'provider-not-configured', provider:'Scrappa Google Hotels', message:'Global hotel provider is not configured yet.', offers:[] };
  const criteria = {
    destination:clean(p?.destination,'hotel destination'), checkIn:cleanDate(p?.checkIn,'check-in'), checkOut:cleanDate(p?.checkOut,'check-out'),
    adults:cleanCount(p?.adults ?? 1,'Adults',1,10), rooms:cleanCount(p?.rooms ?? 1,'Rooms',1,4), currency:cleanCurrency(p?.currency)
  };
  if (criteria.checkOut <= criteria.checkIn) throw Object.assign(new Error('Check-out must be after check-in.'), { status:400 });
  if (nights(criteria.checkIn, criteria.checkOut) > 30) throw Object.assign(new Error('Hotel stay cannot exceed 30 nights.'), { status:400 });
  if (criteria.rooms !== 1) throw Object.assign(new Error('Live Google Hotels pricing is currently verified for one room per search. Search one room at a time to avoid invented totals.'), { status:400 });
  const qs = new URLSearchParams({ q:criteria.destination, check_in_date:criteria.checkIn, check_out_date:criteria.checkOut, adults:String(criteria.adults), currency:criteria.currency, gl:'pk', hl:'en', sort_by:'3' });
  const data = await fetchJson(`${SCRAPPA_BASE}/google-hotels/search?${qs}`, { headers:{ Accept:'application/json', 'X-API-KEY':cfg.scrappaApiKey } }, TIMEOUT_MS, 2);
  const stayNights = nights(criteria.checkIn, criteria.checkOut);
  const properties = Array.isArray(data?.properties) ? data.properties : [];
  const offers = properties.map((item, index) => {
    const total = Number(item?.total_rate?.extracted_lowest ?? item?.total_rate?.extracted_before_taxes_fees);
    const perNight = Number(item?.rate_per_night?.extracted_lowest ?? item?.rate_per_night?.extracted_before_taxes_fees);
    if (!(total > 0) || !(perNight > 0)) return null;
    const amenities = Array.isArray(item?.amenities) ? item.amenities.map(String) : [];
    const prices = Array.isArray(item?.prices) ? item.prices.slice(0,8).map(x => ({ source:text(x?.source || x?.name || x?.provider), price:text(x?.rate_per_night?.lowest || x?.price || x?.total_rate?.lowest), link:text(x?.link) })).filter(x=>x.source||x.price||x.link) : [];
    return {
      id:`scrappa-hotel:${text(item?.property_token || index)}`, provider:'Scrappa Google Hotels', providerOfferId:text(item?.property_token), propertyToken:text(item?.property_token),
      name:text(item?.name || 'Hotel'), cityCode:'', countryCode:'', checkIn:criteria.checkIn, checkOut:criteria.checkOut, nights:stayNights, adults:criteria.adults, rooms:1,
      roomPrice:perNight, stayTotal:total, pricePerNight:perNight, currency:criteria.currency, compareTotal:total, compareCurrency:criteria.currency, comparePerNight:perNight,
      roomDescription:text(item?.description || item?.essential_info || `${item?.hotel_class || item?.extracted_hotel_class || 'Hotel'} • Google Hotels live comparison`).replace(/\s+/g,' ').slice(0,220),
      cancellation:amenities.some(x=>/free cancellation/i.test(x)) ? 'Free cancellation shown by provider' : 'Cancellation terms vary by booking provider',
      hotelClass:text(item?.hotel_class || item?.extracted_hotel_class), rating:Number(item?.overall_rating)||null, reviews:Number(item?.reviews)||null,
      imageUrl:text(item?.images?.[0]?.thumbnail || item?.images?.[0]?.original_image), bookingOptions:prices, live:true, source:'scrappa-google-hotels'
    };
  }).filter(Boolean).sort((a,b)=>a.stayTotal-b.stayTotal).slice(0,24);
  return { ok:true, searchedAt:Date.now(), provider:'Scrappa Google Hotels', destination:criteria.destination, currency:criteria.currency, offers };
}

async function geocode(raw) {
  const q = clean(raw,'origin/destination');
  const city=/^city:([A-Za-z0-9_-]{3,16})$/i.exec(q); if(city)return {kind:'city',value:city[1].toUpperCase(),label:city[1].toUpperCase()};
  const station=/^station:([A-Za-z0-9_-]{3,24})$/i.exec(q); if(station)return {kind:'station',value:station[1].toUpperCase(),label:station[1].toUpperCase()};
  const u=new URL('https://geocoding-api.open-meteo.com/v1/search'); u.searchParams.set('name',q); u.searchParams.set('count','1'); u.searchParams.set('language','en'); u.searchParams.set('format','json');
  const data=await fetchJson(u.toString(),{},10000,1); const x=data?.results?.[0],lat=Number(x?.latitude),lon=Number(x?.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) throw Object.assign(new Error(`Could not resolve “${q}”.`),{status:400});
  return {kind:'geo',value:`${lat.toFixed(6)},${lon.toFixed(6)}`,label:[x.name,x.admin1,x.country].filter(Boolean).join(', ')||q,latitude:lat,longitude:lon};
}
function addLoc(q,side,p){if(p.kind==='city')q.set(`${side}_city`,p.value);else if(p.kind==='station')q.append(`${side}_stations[]`,p.value);else{q.set(`${side}[type]`,'geo');q.set(`${side}[value]`,p.value);q.set(`${side}[radius]`,'20000')}}
function idx(data){const m=new Map();for(const x of data?.included||[])if(x?.type&&x?.id)m.set(`${x.type}:${x.id}`,x);return m}
function rel(m,p,n){const r=p?.relationships?.[n]?.data;const x=Array.isArray(r)?r[0]:r;return x?.type&&x?.id?m.get(`${x.type}:${x.id}`):null}
function rels(m,p,n){const r=p?.relationships?.[n]?.data;return Array.isArray(r)?r.map(x=>x?.type&&x?.id?m.get(`${x.type}:${x.id}`):null).filter(Boolean):[]}
function exponent(c){return ['JPY','KRW','VND','CLP','PYG'].includes(c)?0:['BHD','IQD','JOD','KWD','LYD','OMR','TND'].includes(c)?3:2}
function groundMode(item,segs,carriers){const v=[item?.attributes?.transport_type,item?.attributes?.vehicle_type,...segs.flatMap(s=>[s?.attributes?.transport_type,s?.attributes?.vehicle_type,s?.attributes?.mode]),...carriers.map(c=>c?.attributes?.name)].filter(Boolean).join(' ').toLowerCase();return /train|rail/.test(v)?'Rail':/bus|coach/.test(v)?'Bus':/ferry|boat|ship/.test(v)?'Ferry':/shuttle|transfer/.test(v)?'Shuttle':'Ground transport'}
function diffMinutes(a,b){const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)&&y>=x?Math.round((y-x)/60000):null}
async function searchGround(cfg,p){
  const criteria={origin:clean(p?.origin,'origin'),destination:clean(p?.destination,'destination'),departureDate:cleanDate(p?.departureDate,'departure date'),departureTime:/^([01]\d|2[0-3]):[0-5]\d$/.test(text(p?.departureTime||'08:00'))?text(p?.departureTime||'08:00'):'08:00',adults:cleanCount(p?.adults??1,'Adults'),currency:cleanCurrency(p?.currency||'EUR')};
  if(criteria.origin.toLowerCase()===criteria.destination.toLowerCase())throw Object.assign(new Error('Origin and destination must be different.'),{status:400});
  if(!cfg.distribusionApiKey)return {ok:false,reason:'provider-not-configured',provider:'Distribusion',message:'Worldwide rail/bus provider is ready in Cloudflare but its partner API key is not configured yet.',offers:[]};
  const [origin,destination]=await Promise.all([geocode(criteria.origin),geocode(criteria.destination)]);
  const q=new URLSearchParams({locale:'en',currency:criteria.currency,departure_date:criteria.departureDate,departure_start_time:criteria.departureTime,pax:String(criteria.adults)}); addLoc(q,'departure',origin); addLoc(q,'arrival',destination);
  const data=await fetchJson(`${cfg.distribusionApiBase}/retailers/v4/connections/find?${q}`,{headers:{Accept:'application/json','api-key':cfg.distribusionApiKey}},TIMEOUT_MS,1);
  const m=idx(data),cur=cleanCurrency(data?.meta?.currency||criteria.currency); const offers=[];
  for(const item of data?.data||[]){const a=item?.attributes||{};if(a.booked_out===true)continue;const total=Number(a.cheapest_total_adult_price)/(10**exponent(cur));if(!(total>=0))continue;const segs=rels(m,item,'segments'),first=segs[0]||{},last=segs.at(-1)||{},carriers=[...new Set(segs.map(s=>rel(m,s,'marketing_carrier')||rel(m,s,'operating_carrier')).filter(Boolean))],names=[...new Set(carriers.map(c=>c?.attributes?.name||c?.id).filter(Boolean))],dep=a.departure_time||first?.attributes?.departure_time||'',arr=a.arrival_time||last?.attributes?.arrival_time||'';offers.push({id:`distribusion:${item?.id||crypto.randomUUID()}`,provider:'Distribusion',mode:groundMode(item,segs,carriers),carrierNames:names,originLabel:text(rel(m,first,'departure_station')?.attributes?.name||origin.label),destinationLabel:text(rel(m,last,'arrival_station')?.attributes?.name||destination.label),departingAt:dep,arrivingAt:arr,durationMinutes:Number(a.duration)>0?Math.round(Number(a.duration)/60):diffMinutes(dep,arr),total,currency:cur,seatsLeft:Number.isFinite(Number(a.total_seats_left))?Number(a.total_seats_left):null,electronicTicket:a.electronic_ticket_available===true,live:true,source:'distribusion-ground'});}
  offers.sort((a,b)=>a.total-b.total); return {ok:true,searchedAt:Date.now(),provider:'Distribusion',origin,destination,currency:cur,offers:offers.slice(0,40)};
}

function iata(raw){const q=clean(raw,'origin/destination');if(/^[A-Za-z]{3}$/.test(q))return q.toUpperCase();const explicit=/\b([A-Za-z]{3})\b/.exec(q);if(explicit)return explicit[1].toUpperCase();const n=q.toLowerCase().replace(/[()]/g,' ').replace(/\s+/g,' ').trim();return CITY_IATA[n]||CITY_IATA[n.replace(/\s+/g,'_')]||''}
function mapCur(v){const x=text(v||'PKR').toUpperCase();return x==='RS'||x==='PKRS'?'PKR':x}
function parseDuration(v){const s=text(v).toLowerCase();return Number((/(\d+)\s*h/.exec(s)||[])[1]||0)*60+Number((/(\d+)\s*m/.exec(s)||[])[1]||0)||null}
async function pakistanFlights(cfg,p){
  const criteria={origin:clean(p?.origin,'origin'),destination:clean(p?.destination,'destination'),date:cleanDate(p?.departureDate,'departure date'),passengers:cleanCount(p?.adults??1,'Adults')};const origin=iata(criteria.origin),destination=iata(criteria.destination);if(!origin||!destination)throw Object.assign(new Error('Pakistan agency search requires a supported city or IATA code.'),{status:400});const jobs=[];
  if(cfg.travelLineApiKey)jobs.push((async()=>{const q=new URLSearchParams({departure:origin,arrival:destination,departureDateFrom:criteria.date,departureDateTo:criteria.date,page:'1',limit:'50'});const data=await fetchJson(`${TRAVEL_LINE_BASE}/groups?${q}`,{headers:{Accept:'application/json',Authorization:`Bearer ${cfg.travelLineApiKey}`}},TIMEOUT_MS,1);return (data?.flights||[]).map(item=>{const its=item?.itineraries||[],segs=its.flatMap(x=>x?.segments||[]),first=segs[0]||{},last=segs.at(-1)||{},unit=Number(item?.fares?.salePrice),cur=mapCur(item?.fares?.currencyCode);if(!(unit>0))return null;return {id:`travelline:${item?._id||crypto.randomUUID()}`,provider:'Travel Line Travel & Tours',agency:true,live:true,originCode:text(first?.departure?.airport?.iataCode||origin).toUpperCase(),destinationCode:text(last?.arrival?.airport?.iataCode||destination).toUpperCase(),originLabel:text(first?.departure?.airport?.city||origin),destinationLabel:text(last?.arrival?.airport?.city||destination),total:Number((unit*criteria.passengers).toFixed(2)),perTraveler:unit,currency:cur,compareTotal:Number((unit*criteria.passengers).toFixed(2)),compareCurrency:cur,departingAt:text(first?.departure?.datetime),arrivingAt:text(last?.arrival?.datetime),durationMinutes:parseDuration(its[0]?.duration),stops:Math.max(0,segs.length-1),carriers:[text(first?.airline?.carrierName||first?.airline?.carrierCode||'Travel Line')],flightNumber:text(first?.flightNumber),seatsLeft:Number.isFinite(Number(item?.availableSeats))?Number(item.availableSeats):null,source:'pakistan-agency'}}).filter(Boolean)})());
  if(cfg.flyNDealApiKey)jobs.push((async()=>{const data=await fetchJson(`${FLYNDEAL_BASE}/tickets/search`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','x-api-key':cfg.flyNDealApiKey},body:JSON.stringify({from:origin,to:destination,date:criteria.date,passengers:criteria.passengers})},TIMEOUT_MS,1);return (data?.data||[]).map(item=>{const total=Number(item?.pricing?.total),cur=mapCur(item?.pricing?.currency||'PKR');if(!(total>0))return null;return {id:`flyndeal:${item?.id||crypto.randomUUID()}`,provider:'FlyNDeal',agency:true,live:true,originCode:text(item?.sector?.from||origin).toUpperCase(),destinationCode:text(item?.sector?.to||destination).toUpperCase(),originLabel:text(item?.sector?.from||origin),destinationLabel:text(item?.sector?.to||destination),total,currency:cur,compareTotal:total,compareCurrency:cur,departingAt:`${criteria.date}T${text(item?.departureTime||'00:00').slice(0,5)}:00`,arrivingAt:item?.arrivalTime?`${criteria.date}T${text(item.arrivalTime).slice(0,8)}`:'',durationMinutes:null,stops:0,carriers:[text(item?.airline?.name||item?.airline?.code||'FlyNDeal')],flightNumber:text(item?.flightNo),seatsLeft:Number.isFinite(Number(item?.seatsAvailable))?Number(item.seatsAvailable):null,source:'pakistan-agency'}}).filter(Boolean)})());
  if(!jobs.length)return {ok:false,reason:'pakistan-agencies-not-configured',providers:{travelLine:false,flyNDeal:false},offers:[]};const settled=await Promise.allSettled(jobs);let offers=[],providerErrors=[];for(const r of settled){if(r.status==='fulfilled')offers.push(...r.value);else providerErrors.push(text(r.reason?.message||r.reason).slice(0,220))}offers.sort((a,b)=>(a.compareTotal||1e15)-(b.compareTotal||1e15));return {ok:true,searchedAt:Date.now(),providers:{travelLine:Boolean(cfg.travelLineApiKey),flyNDeal:Boolean(cfg.flyNDealApiKey)},providerErrors,offers:offers.slice(0,36)};
}
async function pakistanPackages(cfg){if(!cfg.travelLineApiKey)return {ok:false,reason:'package-provider-not-configured',providers:{travelLine:false},packages:[]};const data=await fetchJson(`${TRAVEL_LINE_BASE}/umrah/packages`,{headers:{Accept:'application/json',Authorization:`Bearer ${cfg.travelLineApiKey}`}},TIMEOUT_MS,1);const rows=Array.isArray(data)?data:[];const packages=rows.map(item=>({id:text(item?.id||item?._id||item?.slug||crypto.randomUUID()),provider:'Travel Line Travel & Tours',agency:true,live:true,title:text(item?.title||'Umrah package'),price:Number(item?.price)||null,currency:mapCur(item?.currency||'PKR'),durationDays:Number(item?.durationDays)||null,durationNights:Number(item?.durationNights)||null,fromCity:text(item?.fromCity),toCity:text(item?.toCity),airline:text(item?.airline),departureDate:text(item?.departureDate),returnDate:text(item?.returnDate),seatsAvailable:Number.isFinite(Number(item?.seatsAvailable))?Number(item.seatsAvailable):null,inclusions:Array.isArray(item?.inclusions)?item.inclusions.slice(0,12).map(String):[],hotel:item?.hotel||null,pricingOptions:item?.pricingOptions||null,source:'pakistan-agency'})).filter(x=>x.price&&x.currency).sort((a,b)=>a.price-b.price);return {ok:true,searchedAt:Date.now(),providers:{travelLine:true},packages};}

function health(env){const p=providerConfig(env);return {ok:true,backend:'cloudflare-workers',architecture:'cloudflare-only',firebaseRequired:false,googleBillingRequired:false,providers:{scrappa:Boolean(p.scrappaApiKey),scrappaFlights:Boolean(p.scrappaApiKey),scrappaHotels:Boolean(p.scrappaApiKey),distribusion:Boolean(p.distribusionApiKey),travelLine:Boolean(p.travelLineApiKey),flyNDeal:Boolean(p.flyNDealApiKey),pakistanBusPartner:false},coverage:{globalFlights:Boolean(p.scrappaApiKey),globalHotels:Boolean(p.scrappaApiKey),globalRailBus:Boolean(p.distribusionApiKey),pakistanAgencyFlights:Boolean(p.travelLineApiKey||p.flyNDealApiKey),pakistanTours:Boolean(p.travelLineApiKey),pakistanBusFares:false,bookmePartnershipRequired:true},searchedAt:Date.now()};}
async function dispatch(name,payload,env){const cfg=providerConfig(env);switch(name){case 'searchWorldwideFlights':return cachedRpc(name,payload,90,()=>searchFlights(cfg,payload));case 'searchWorldwideHotels':return cachedRpc(name,payload,120,()=>searchHotels(cfg,payload));case 'searchWorldwideGroundTransport':return cachedRpc(name,payload,60,()=>searchGround(cfg,payload));case 'searchPakistanAgencyFlights':return cachedRpc(name,payload,60,()=>pakistanFlights(cfg,payload));case 'searchPakistanUmrahPackages':return cachedRpc(name,payload,120,()=>pakistanPackages(cfg));case 'getProviderHealth':return health(env);case 'searchPakistanGroundTransport':return {ok:false,reason:'pakistan-bus-partner-contract-required',message:'Pakistan bus/train live fares require an approved local B2B inventory contract. Bookme adapter slot is reserved; no unofficial scraping is used.',offers:[]};default:throw Object.assign(new Error('Unknown Travel RPC.'),{status:404});}}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const url=new URL(request.url);
    if(url.pathname==='/health'&&request.method==='GET')return json(health(env));
    if(!url.pathname.startsWith('/rpc/')||request.method!=='POST')return json({ok:false,message:'Not found.'},404);
    try{rateLimit(request);let payload={};try{payload=await request.json()}catch{}const name=decodeURIComponent(url.pathname.slice(5));const data=await dispatch(name,payload||{},env);return json(data);}
    catch(error){const raw=Number(error?.status);const status=raw===401?401:raw===402?402:raw===429?429:raw>=400&&raw<500?400:503;return json({ok:false,message:text(error?.message||'Travel edge request failed.').slice(0,240)},status);}
  }
};
