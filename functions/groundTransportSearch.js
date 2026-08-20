const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const TRAVEL_PROVIDER_CONFIG = defineSecret("NEXUSNOVA_TRAVEL_PROVIDERS");
const DEFAULT_DISTRIBUSION_BASE = "https://api.distribusion.com";
const SEARCH_TIMEOUT_MS = 24_000;
const MAX_RESULTS = 40;
const SEARCH_RADIUS_METERS = 20_000;

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}

function cleanText(value, label, max = 80) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  return text;
}

function cleanDate(value) {
  const text = cleanText(value, "departure date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`))) {
    throw new HttpsError("invalid-argument", "Invalid departure date.");
  }
  return text;
}

function cleanTime(value) {
  const text = String(value || "00:00").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new HttpsError("invalid-argument", "Invalid departure time.");
  return text;
}

function cleanAdults(value) {
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 1 || n > 9) throw new HttpsError("invalid-argument", "Adults must be between 1 and 9.");
  return n;
}

function cleanCurrency(value) {
  const code = String(value || "EUR").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "EUR";
}

function providerConfig() {
  let raw = "";
  try { raw = String(TRAVEL_PROVIDER_CONFIG.value() || "").trim(); } catch {}
  let parsed = {};
  if (raw) {
    try { parsed = JSON.parse(raw); }
    catch { throw new HttpsError("internal", "Travel provider secret is invalid JSON."); }
  }
  const key = String(parsed.distribusionApiKey || "").trim();
  const base = String(parsed.distribusionApiBase || DEFAULT_DISTRIBUSION_BASE).trim().replace(/\/+$/, "");
  let url;
  try { url = new URL(base); }
  catch { throw new HttpsError("internal", "Distribusion API base URL is invalid."); }
  if (url.protocol !== "https:") throw new HttpsError("internal", "Distribusion API base must use HTTPS.");
  return { key, base };
}

async function fetchJson(url, options = {}, timeoutMs = SEARCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const detail = data?.errors?.[0]?.title || data?.errors?.[0]?.detail || data?.message || `HTTP ${response.status}`;
      throw new Error(String(detail).slice(0, 220));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function geocodePlace(raw) {
  const query = cleanText(raw, "origin/destination", 80);
  const cityCode = /^city:([A-Za-z0-9_-]{3,16})$/i.exec(query);
  if (cityCode) return { kind: "city", value: cityCode[1].toUpperCase(), label: cityCode[1].toUpperCase() };
  const stationCode = /^station:([A-Za-z0-9_-]{3,24})$/i.exec(query);
  if (stationCode) return { kind: "station", value: stationCode[1].toUpperCase(), label: stationCode[1].toUpperCase() };

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const json = await fetchJson(url.toString(), { method: "GET" }, 10_000);
  const place = Array.isArray(json?.results) ? json.results[0] : null;
  const lat = Number(place?.latitude);
  const lon = Number(place?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`Could not resolve "${query}" to a worldwide location.`);
  }
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  return {
    kind: "geo",
    value: `${lat.toFixed(6)},${lon.toFixed(6)}`,
    label: parts.join(", ") || query,
    latitude: lat,
    longitude: lon
  };
}

function addLocationParams(params, side, place) {
  if (place.kind === "city") {
    params.set(`${side}_city`, place.value);
    return;
  }
  if (place.kind === "station") {
    params.append(`${side}_stations[]`, place.value);
    return;
  }
  params.set(`${side}[type]`, "geo");
  params.set(`${side}[value]`, place.value);
  params.set(`${side}[radius]`, String(SEARCH_RADIUS_METERS));
}

function includedIndex(json) {
  const map = new Map();
  for (const item of Array.isArray(json?.included) ? json.included : []) {
    if (!item?.type || !item?.id) continue;
    map.set(`${item.type}:${item.id}`, item);
  }
  return map;
}

function relatedObject(index, parent, relation) {
  const rel = parent?.relationships?.[relation]?.data;
  if (!rel) return null;
  const ref = Array.isArray(rel) ? rel[0] : rel;
  return ref?.type && ref?.id ? index.get(`${ref.type}:${ref.id}`) || null : null;
}

function relatedObjects(index, parent, relation) {
  const rel = parent?.relationships?.[relation]?.data;
  if (!Array.isArray(rel)) return [];
  return rel.map(ref => ref?.type && ref?.id ? index.get(`${ref.type}:${ref.id}`) : null).filter(Boolean);
}

function minorExponent(currency) {
  if (["JPY", "KRW", "VND", "CLP", "PYG"].includes(currency)) return 0;
  if (["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"].includes(currency)) return 3;
  return 2;
}

function minorToMajor(value, currency) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / (10 ** minorExponent(currency));
}

function inferMode(connection, segments, carriers) {
  const values = [
    connection?.attributes?.transport_type,
    connection?.attributes?.vehicle_type,
    ...segments.flatMap(seg => [seg?.attributes?.transport_type, seg?.attributes?.vehicle_type, seg?.attributes?.mode]),
    ...carriers.flatMap(carrier => [carrier?.attributes?.transport_type, carrier?.attributes?.vehicle_type, carrier?.attributes?.name])
  ].filter(Boolean).join(" ").toLowerCase();
  if (/train|rail/.test(values)) return "Rail";
  if (/bus|coach/.test(values)) return "Bus";
  if (/ferry|boat|ship/.test(values)) return "Ferry";
  if (/shuttle|transfer/.test(values)) return "Shuttle";
  return "Ground transport";
}

function stationLabel(index, segment, relation, fallback) {
  const station = relatedObject(index, segment, relation);
  return String(station?.attributes?.name || station?.attributes?.station_name || station?.id || fallback || "").trim();
}

function normalizeConnection(item, index, currency, origin, destination) {
  const attrs = item?.attributes || {};
  if (attrs.booked_out === true) return null;
  const price = minorToMajor(attrs.cheapest_total_adult_price, currency);
  if (!(price >= 0)) return null;

  const segments = relatedObjects(index, item, "segments");
  const firstSegment = segments[0] || null;
  const lastSegment = segments[segments.length - 1] || null;
  const carriers = [...new Set(segments.flatMap(segment => {
    const carrier = relatedObject(index, segment, "marketing_carrier") || relatedObject(index, segment, "operating_carrier");
    return carrier ? [carrier] : [];
  }))];
  const carrierNames = [...new Set(carriers.map(carrier => carrier?.attributes?.name || carrier?.id).filter(Boolean))];

  const departureAt = attrs.departure_time || firstSegment?.attributes?.departure_time || "";
  const arrivalAt = attrs.arrival_time || lastSegment?.attributes?.arrival_time || "";
  const durationSeconds = Number(attrs.duration);
  const durationMinutes = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.round(durationSeconds / 60)
    : (() => {
        const a = Date.parse(departureAt);
        const b = Date.parse(arrivalAt);
        return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 60000) : null;
      })();

  return {
    id: `distribusion:${String(item?.id || Math.random())}`,
    provider: "Distribusion",
    providerConnectionId: String(item?.id || ""),
    mode: inferMode(item, segments, carriers),
    carrierNames,
    originLabel: stationLabel(index, firstSegment, "departure_station", origin.label),
    destinationLabel: stationLabel(index, lastSegment, "arrival_station", destination.label),
    departingAt: departureAt,
    arrivingAt: arrivalAt,
    durationMinutes,
    total: price,
    currency,
    seatsLeft: Number.isFinite(Number(attrs.total_seats_left)) ? Number(attrs.total_seats_left) : null,
    electronicTicket: attrs.electronic_ticket_available === true,
    fareClassCode: String(attrs.cheapest_fare_class_code || ""),
    live: true
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = [
      item.mode,
      item.originLabel,
      item.destinationLabel,
      String(item.departingAt).slice(0, 16),
      String(item.arrivingAt).slice(0, 16),
      Math.round(Number(item.total) * 100)
    ].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchDistribusion(config, criteria) {
  const [origin, destination] = await Promise.all([
    geocodePlace(criteria.origin),
    geocodePlace(criteria.destination)
  ]);
  const params = new URLSearchParams({
    locale: "en",
    currency: criteria.currency,
    departure_date: criteria.departureDate,
    departure_start_time: criteria.departureTime,
    pax: String(criteria.adults)
  });
  addLocationParams(params, "departure", origin);
  addLocationParams(params, "arrival", destination);

  const json = await fetchJson(`${config.base}/retailers/v4/connections/find?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", "api-key": config.key }
  });
  const index = includedIndex(json);
  const responseCurrency = cleanCurrency(json?.meta?.currency || criteria.currency);
  const connections = (Array.isArray(json?.data) ? json.data : [])
    .map(item => normalizeConnection(item, index, responseCurrency, origin, destination))
    .filter(Boolean);

  return {
    origin,
    destination,
    currency: responseCurrency,
    offers: dedupe(connections)
      .sort((a, b) => (Number(a.total) || Number.MAX_VALUE) - (Number(b.total) || Number.MAX_VALUE))
      .slice(0, MAX_RESULTS)
  };
}

exports.searchWorldwideGroundTransport = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 35,
  memory: "256MiB",
  secrets: [TRAVEL_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const criteria = {
    origin: cleanText(req.data?.origin, "origin", 80),
    destination: cleanText(req.data?.destination, "destination", 80),
    departureDate: cleanDate(req.data?.departureDate),
    departureTime: cleanTime(req.data?.departureTime),
    adults: cleanAdults(req.data?.adults),
    currency: cleanCurrency(req.data?.currency)
  };
  if (criteria.origin.toLowerCase() === criteria.destination.toLowerCase()) {
    throw new HttpsError("invalid-argument", "Origin and destination must be different.");
  }

  const config = providerConfig();
  if (!config.key) {
    return {
      ok: false,
      reason: "provider-not-configured",
      provider: "Distribusion",
      message: "Worldwide rail/bus provider is not configured on the secure backend yet.",
      offers: []
    };
  }

  try {
    const result = await searchDistribusion(config, criteria);
    return {
      ok: true,
      searchedAt: Date.now(),
      provider: "Distribusion",
      origin: result.origin,
      destination: result.destination,
      currency: result.currency,
      geoSearch: result.origin.kind === "geo" || result.destination.kind === "geo",
      geoRadiusMeters: SEARCH_RADIUS_METERS,
      offers: result.offers
    };
  } catch (error) {
    const message = String(error?.message || error || "Ground transport search failed.").slice(0, 240);
    throw new HttpsError("unavailable", message);
  }
});
