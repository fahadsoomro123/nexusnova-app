const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const MAX_RESULTS = 36;
const SEARCH_TIMEOUT_MS = 24_000;
const DUFFEL_API = "https://api.duffel.com";
const TRAVEL_PROVIDER_CONFIG = defineSecret("NEXUSNOVA_TRAVEL_PROVIDERS");
let amadeusTokenCache = { token: "", expiresAt: 0, fingerprint: "" };

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  return req.auth.uid;
}

function cleanText(value, label, max = 80) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  return text;
}

function cleanDate(value, label) {
  const text = cleanText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  const time = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(time)) throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  return text;
}

function cleanAdults(value) {
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 1 || n > 9) throw new HttpsError("invalid-argument", "Adults must be between 1 and 9.");
  return n;
}

function cleanCabin(value) {
  const raw = String(value || "economy").toLowerCase();
  const allowed = new Set(["economy", "premium_economy", "business", "first"]);
  return allowed.has(raw) ? raw : "economy";
}

function cleanCurrency(value) {
  const code = String(value || "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
}

function parseProviderSecret() {
  let raw = "";
  try {
    raw = String(TRAVEL_PROVIDER_CONFIG.value() || "").trim();
  } catch {}
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpsError("internal", "Travel provider secret is invalid JSON.");
    }
  }
  const env = process.env;
  const apiBase = String(
    parsed.amadeusApiBase ||
    env.AMADEUS_API_BASE ||
    "https://api.amadeus.com"
  ).trim().replace(/\/+$/, "");
  let parsedBase;
  try {
    parsedBase = new URL(apiBase);
  } catch {
    throw new HttpsError("internal", "Amadeus API base URL is invalid.");
  }
  if (parsedBase.protocol !== "https:") {
    throw new HttpsError("internal", "Amadeus API base URL must use HTTPS.");
  }
  return {
    duffelToken: String(parsed.duffelAccessToken || env.DUFFEL_ACCESS_TOKEN || "").trim(),
    amadeusClientId: String(parsed.amadeusClientId || env.AMADEUS_CLIENT_ID || "").trim(),
    amadeusClientSecret: String(parsed.amadeusClientSecret || env.AMADEUS_CLIENT_SECRET || "").trim(),
    amadeusApiBase: apiBase
  };
}

function parseIsoDurationMinutes(value) {
  const text = String(value || "");
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?$/i.exec(text);
  if (!match) return null;
  return (Number(match[1] || 0) * 1440) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

function dateDiffMinutes(start, end) {
  const a = Date.parse(start);
  const b = Date.parse(end);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 60000) : null;
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
      const detail = data?.errors?.[0]?.detail || data?.error_description || data?.error?.message || `HTTP ${response.status}`;
      throw new Error(String(detail).slice(0, 220));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function duffelRequest(config, path, options = {}) {
  if (!config.duffelToken) throw new Error("Duffel provider is not configured.");
  return fetchJson(`${DUFFEL_API}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Duffel-Version": "v2",
      Authorization: `Bearer ${config.duffelToken}`,
      ...(options.headers || {})
    }
  });
}

async function resolveDuffelPlace(config, raw) {
  const query = cleanText(raw, "origin/destination", 80);
  if (/^[A-Za-z]{3}$/.test(query)) return { code: query.toUpperCase(), label: query.toUpperCase() };
  const json = await duffelRequest(config, `/places/suggestions?query=${encodeURIComponent(query)}`, { method: "GET" });
  const item = (json?.data || []).find(place => /^[A-Z]{3}$/i.test(String(place?.iata_code || "")));
  if (!item) throw new Error(`Duffel could not resolve "${query}" to an airport/city code.`);
  return {
    code: String(item.iata_code).toUpperCase(),
    label: `${item.name || item.city_name || query} (${String(item.iata_code).toUpperCase()})`
  };
}

function amadeusFingerprint(config) {
  return `${config.amadeusApiBase}|${config.amadeusClientId}`;
}

async function getAmadeusToken(config) {
  if (!config.amadeusClientId || !config.amadeusClientSecret) {
    throw new Error("Amadeus provider is not configured.");
  }
  const fingerprint = amadeusFingerprint(config);
  if (
    amadeusTokenCache.token &&
    amadeusTokenCache.fingerprint === fingerprint &&
    Date.now() < amadeusTokenCache.expiresAt - 60_000
  ) return amadeusTokenCache.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.amadeusClientId,
    client_secret: config.amadeusClientSecret
  });
  const json = await fetchJson(`${config.amadeusApiBase}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  }, 12_000);
  const token = String(json?.access_token || "").trim();
  const expiresIn = Math.max(300, Number(json?.expires_in) || 1200);
  if (!token) throw new Error("Amadeus authentication returned no access token.");
  amadeusTokenCache = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
    fingerprint
  };
  return token;
}

async function amadeusRequest(config, path) {
  const token = await getAmadeusToken(config);
  return fetchJson(`${config.amadeusApiBase}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
  });
}

async function resolveAmadeusPlace(config, raw) {
  const query = cleanText(raw, "origin/destination", 80);
  if (/^[A-Za-z]{3}$/.test(query)) return { code: query.toUpperCase(), label: query.toUpperCase() };
  const qs = new URLSearchParams({
    subType: "CITY,AIRPORT",
    keyword: query,
    view: "LIGHT"
  });
  qs.set("page[limit]", "8");
  const json = await amadeusRequest(config, `/v1/reference-data/locations?${qs.toString()}`);
  const item = (json?.data || []).find(place => /^[A-Z]{3}$/i.test(String(place?.iataCode || "")));
  if (!item) throw new Error(`Amadeus could not resolve "${query}" to an airport/city code.`);
  return {
    code: String(item.iataCode).toUpperCase(),
    label: `${item.name || query} (${String(item.iataCode).toUpperCase()})`
  };
}

function firstLastSegments(slices) {
  const all = [];
  for (const slice of slices || []) for (const segment of slice?.segments || []) all.push(segment);
  return { first: all[0] || null, last: all[all.length - 1] || null, all };
}

function normalizeDuffelOffer(offer, route) {
  const amount = Number(offer?.total_amount);
  const currency = String(offer?.total_currency || "").toUpperCase();
  if (!(amount > 0) || !/^[A-Z]{3}$/.test(currency)) return null;
  const slices = Array.isArray(offer?.slices) ? offer.slices : [];
  const { first, last, all } = firstLastSegments(slices);
  if (!first || !last) return null;
  const carriers = [...new Set(all.map(seg => seg?.operating_carrier?.name || seg?.marketing_carrier?.name).filter(Boolean))];
  const durationMinutes = slices.reduce((sum, slice) => {
    const parsed = parseIsoDurationMinutes(slice?.duration);
    if (Number.isFinite(parsed)) return sum + parsed;
    const segs = Array.isArray(slice?.segments) ? slice.segments : [];
    if (!segs.length) return sum;
    return sum + (dateDiffMinutes(segs[0]?.departing_at, segs[segs.length - 1]?.arriving_at) || 0);
  }, 0);
  const stops = slices.reduce((sum, slice) => sum + Math.max(0, (slice?.segments?.length || 1) - 1), 0);
  return {
    id: `duffel:${String(offer?.id || Math.random())}`,
    provider: "Duffel",
    providerOfferId: String(offer?.id || ""),
    originCode: route.origin.code,
    destinationCode: route.destination.code,
    originLabel: route.origin.label,
    destinationLabel: route.destination.label,
    total: amount,
    currency,
    compareTotal: amount,
    compareCurrency: currency,
    departingAt: first.departing_at || "",
    arrivingAt: last.arriving_at || "",
    durationMinutes: durationMinutes || dateDiffMinutes(first.departing_at, last.arriving_at),
    stops,
    carriers,
    expiresAt: offer?.expires_at || null,
    live: true
  };
}

async function searchDuffel(config, criteria) {
  const [origin, destination] = await Promise.all([
    resolveDuffelPlace(config, criteria.origin),
    resolveDuffelPlace(config, criteria.destination)
  ]);
  const slices = [{ origin: origin.code, destination: destination.code, departure_date: criteria.departureDate }];
  if (criteria.returnDate) slices.push({ origin: destination.code, destination: origin.code, departure_date: criteria.returnDate });
  const passengers = Array.from({ length: criteria.adults }, () => ({ type: "adult" }));
  const body = { data: { slices, passengers, cabin_class: criteria.cabin } };
  const json = await duffelRequest(config, "/air/offer_requests?return_offers=true&supplier_timeout=12000", {
    method: "POST",
    body: JSON.stringify(body)
  });
  const offers = Array.isArray(json?.data?.offers) ? json.data.offers : [];
  return {
    provider: "Duffel",
    route: { origin, destination },
    offers: offers.map(offer => normalizeDuffelOffer(offer, { origin, destination })).filter(Boolean).slice(0, 24)
  };
}

function normalizeAmadeusOffer(offer, dictionaries, route) {
  const amount = Number(offer?.price?.grandTotal || offer?.price?.total);
  const currency = String(offer?.price?.currency || "").toUpperCase();
  if (!(amount > 0) || !/^[A-Z]{3}$/.test(currency)) return null;
  const itineraries = Array.isArray(offer?.itineraries) ? offer.itineraries : [];
  const allSegments = itineraries.flatMap(item => Array.isArray(item?.segments) ? item.segments : []);
  const first = allSegments[0], last = allSegments[allSegments.length - 1];
  if (!first || !last) return null;
  const carrierCodes = [...new Set(allSegments.map(seg => seg?.operating?.carrierCode || seg?.carrierCode).filter(Boolean))];
  const carriers = carrierCodes.map(code => dictionaries?.carriers?.[code] || code);
  const durationMinutes = itineraries.reduce((sum, item) => sum + (parseIsoDurationMinutes(item?.duration) || 0), 0);
  const stops = itineraries.reduce((sum, item) => sum + Math.max(0, (item?.segments?.length || 1) - 1), 0);
  return {
    id: `amadeus:${String(offer?.id || Math.random())}`,
    provider: "Amadeus",
    providerOfferId: String(offer?.id || ""),
    originCode: route.origin.code,
    destinationCode: route.destination.code,
    originLabel: route.origin.label,
    destinationLabel: route.destination.label,
    total: amount,
    currency,
    compareTotal: amount,
    compareCurrency: currency,
    departingAt: first?.departure?.at || "",
    arrivingAt: last?.arrival?.at || "",
    durationMinutes: durationMinutes || dateDiffMinutes(first?.departure?.at, last?.arrival?.at),
    stops,
    carriers,
    expiresAt: offer?.lastTicketingDate || null,
    live: true
  };
}

async function searchAmadeus(config, criteria) {
  const [origin, destination] = await Promise.all([
    resolveAmadeusPlace(config, criteria.origin),
    resolveAmadeusPlace(config, criteria.destination)
  ]);
  const params = new URLSearchParams({
    originLocationCode: origin.code,
    destinationLocationCode: destination.code,
    departureDate: criteria.departureDate,
    adults: String(criteria.adults),
    travelClass: criteria.cabin.toUpperCase(),
    currencyCode: criteria.currency,
    max: "24"
  });
  if (criteria.returnDate) params.set("returnDate", criteria.returnDate);
  const json = await amadeusRequest(config, `/v2/shopping/flight-offers?${params.toString()}`);
  return {
    provider: "Amadeus",
    route: { origin, destination },
    offers: (json?.data || []).map(offer => normalizeAmadeusOffer(offer, json?.dictionaries || {}, { origin, destination })).filter(Boolean).slice(0, 24)
  };
}

async function fxRate(from, to) {
  if (from === to) return 1;
  const json = await fetchJson(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, { method: "GET" }, 8_000);
  const rate = Number(json?.rates?.[to]);
  return rate > 0 ? rate : null;
}

async function convertForComparison(offers, targetCurrency) {
  const currencies = [...new Set(offers.map(item => item.currency).filter(code => code && code !== targetCurrency))];
  const rates = new Map([[targetCurrency, 1]]);
  await Promise.all(currencies.map(async code => {
    try {
      const rate = await fxRate(code, targetCurrency);
      if (rate) rates.set(code, rate);
    } catch {}
  }));
  return offers.map(item => {
    const rate = rates.get(item.currency);
    return {
      ...item,
      compareTotal: rate ? Number((item.total * rate).toFixed(2)) : null,
      compareCurrency: rate ? targetCurrency : item.currency,
      fxConverted: Boolean(rate && item.currency !== targetCurrency)
    };
  });
}

function dedupeOffers(offers) {
  const seen = new Set();
  return offers.filter(item => {
    const minute = String(item.departingAt || "").slice(0, 16);
    const carrier = String(item.carriers?.[0] || "").toLowerCase();
    const rounded = Number.isFinite(item.compareTotal) ? Math.round(item.compareTotal) : Math.round(item.total);
    const key = `${item.originCode}|${item.destinationCode}|${minute}|${carrier}|${item.compareCurrency}|${rounded}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

exports.searchWorldwideFlights = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 35,
  memory: "256MiB",
  secrets: [TRAVEL_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const departureDate = cleanDate(req.data?.departureDate, "departure date");
  const returnRaw = String(req.data?.returnDate || "").trim();
  const returnDate = returnRaw ? cleanDate(returnRaw, "return date") : "";
  if (returnDate && returnDate < departureDate) {
    throw new HttpsError("invalid-argument", "Return date must be after departure date.");
  }

  const criteria = {
    origin: cleanText(req.data?.origin, "origin", 80),
    destination: cleanText(req.data?.destination, "destination", 80),
    departureDate,
    returnDate,
    adults: cleanAdults(req.data?.adults),
    cabin: cleanCabin(req.data?.cabin),
    currency: cleanCurrency(req.data?.currency)
  };

  const config = parseProviderSecret();
  const configured = {
    duffel: Boolean(config.duffelToken),
    amadeus: Boolean(config.amadeusClientId && config.amadeusClientSecret)
  };

  const jobs = [];
  if (configured.duffel) jobs.push(searchDuffel(config, criteria));
  if (configured.amadeus) jobs.push(searchAmadeus(config, criteria));

  if (!jobs.length) {
    return {
      ok: false,
      reason: "providers-not-configured",
      message: "Worldwide fare providers are not configured on the secure backend yet.",
      providers: configured,
      offers: []
    };
  }

  const settled = await Promise.allSettled(jobs);
  const providerErrors = [];
  let offers = [];
  const routes = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      offers.push(...result.value.offers);
      routes.push({ provider: result.value.provider, ...result.value.route });
    } else {
      providerErrors.push(String(result.reason?.message || result.reason || "Provider search failed.").slice(0, 240));
    }
  }

  offers = dedupeOffers(await convertForComparison(offers, criteria.currency))
    .sort((a, b) => (a.compareTotal ?? Number.MAX_VALUE) - (b.compareTotal ?? Number.MAX_VALUE))
    .slice(0, MAX_RESULTS);

  return {
    ok: true,
    searchedAt: Date.now(),
    providers: configured,
    providerErrors,
    routes,
    currency: criteria.currency,
    offers
  };
});
