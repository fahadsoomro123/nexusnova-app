const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const TRAVEL_PROVIDER_CONFIG = defineSecret("NEXUSNOVA_TRAVEL_PROVIDERS");
const SEARCH_TIMEOUT_MS = 24_000;
const MAX_HOTEL_IDS = 24;
const MAX_RESULTS = 18;
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

function cleanCount(value, label, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpsError("invalid-argument", `${label} must be between ${min} and ${max}.`);
  }
  return number;
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
    amadeusClientId: String(parsed.amadeusClientId || env.AMADEUS_CLIENT_ID || "").trim(),
    amadeusClientSecret: String(parsed.amadeusClientSecret || env.AMADEUS_CLIENT_SECRET || "").trim(),
    amadeusApiBase: apiBase
  };
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
      const detail =
        data?.errors?.[0]?.detail ||
        data?.errors?.[0]?.title ||
        data?.error_description ||
        data?.error?.message ||
        `HTTP ${response.status}`;
      throw new Error(String(detail).slice(0, 220));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function fingerprint(config) {
  return `${config.amadeusApiBase}|${config.amadeusClientId}`;
}

async function getAmadeusToken(config) {
  if (!config.amadeusClientId || !config.amadeusClientSecret) {
    throw new Error("Amadeus provider is not configured.");
  }
  const key = fingerprint(config);
  if (
    amadeusTokenCache.token &&
    amadeusTokenCache.fingerprint === key &&
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
    fingerprint: key
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

async function resolveCity(config, raw) {
  const query = cleanText(raw, "hotel destination", 80);
  if (/^[A-Za-z]{3}$/.test(query)) {
    return { code: query.toUpperCase(), label: query.toUpperCase() };
  }
  const params = new URLSearchParams({
    subType: "CITY",
    keyword: query,
    view: "LIGHT"
  });
  params.set("page[limit]", "8");
  const json = await amadeusRequest(config, `/v1/reference-data/locations?${params.toString()}`);
  const city = (json?.data || []).find(item => /^[A-Z]{3}$/i.test(String(item?.iataCode || "")));
  if (!city) throw new Error(`Amadeus could not resolve "${query}" to a city code.`);
  const code = String(city.iataCode).toUpperCase();
  return { code, label: `${city.name || query} (${code})` };
}

async function listHotels(config, cityCode) {
  const params = new URLSearchParams({
    cityCode,
    radius: "50",
    radiusUnit: "KM",
    hotelSource: "ALL"
  });
  const json = await amadeusRequest(config, `/v1/reference-data/locations/hotels/by-city?${params.toString()}`);
  const hotels = Array.isArray(json?.data) ? json.data : [];
  return hotels
    .filter(item => item?.hotelId)
    .slice(0, MAX_HOTEL_IDS)
    .map(item => ({
      hotelId: String(item.hotelId),
      name: String(item.name || item.hotelId),
      chainCode: String(item.chainCode || ""),
      latitude: Number(item?.geoCode?.latitude),
      longitude: Number(item?.geoCode?.longitude),
      countryCode: String(item?.address?.countryCode || "")
    }));
}

function nightsBetween(checkIn, checkOut) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

function normalizeHotelOffer(item, criteria, fallbackHotel) {
  if (item?.available === false) return null;
  const offers = Array.isArray(item?.offers) ? item.offers : [];
  const offer = offers
    .filter(candidate => Number(candidate?.price?.total) > 0)
    .sort((a, b) => Number(a.price.total) - Number(b.price.total))[0];
  if (!offer) return null;

  const hotel = item?.hotel || {};
  const roomPrice = Number(offer.price.total);
  const rooms = criteria.rooms;
  const stayTotal = Number((roomPrice * rooms).toFixed(2));
  const nights = nightsBetween(criteria.checkIn, criteria.checkOut);
  const currency = String(offer?.price?.currency || criteria.currency || "").toUpperCase();
  if (!(stayTotal > 0) || !/^[A-Z]{3}$/.test(currency)) return null;

  const roomDescription = String(
    offer?.room?.description?.text ||
    offer?.room?.typeEstimated?.category ||
    "Room details supplied by provider"
  ).replace(/\s+/g, " ").trim().slice(0, 220);

  const cancellation = offer?.policies?.cancellations?.[0] || null;
  const cancellationText = cancellation
    ? cancellation?.description?.text || cancellation?.deadline || "Cancellation policy available"
    : "Cancellation policy not supplied";

  return {
    id: `amadeus-hotel:${String(offer.id || hotel.hotelId || fallbackHotel?.hotelId || Math.random())}`,
    provider: "Amadeus",
    providerOfferId: String(offer.id || ""),
    hotelId: String(hotel.hotelId || fallbackHotel?.hotelId || ""),
    name: String(hotel.name || fallbackHotel?.name || "Hotel"),
    cityCode: String(hotel.cityCode || criteria.city.code || ""),
    countryCode: String(fallbackHotel?.countryCode || ""),
    latitude: Number.isFinite(Number(hotel.latitude)) ? Number(hotel.latitude) : fallbackHotel?.latitude || null,
    longitude: Number.isFinite(Number(hotel.longitude)) ? Number(hotel.longitude) : fallbackHotel?.longitude || null,
    checkIn: String(offer.checkInDate || criteria.checkIn),
    checkOut: String(offer.checkOutDate || criteria.checkOut),
    nights,
    adults: criteria.adults,
    rooms,
    roomPrice,
    stayTotal,
    pricePerNight: Number((stayTotal / nights).toFixed(2)),
    currency,
    roomDescription,
    cancellation: String(cancellationText).replace(/\s+/g, " ").trim().slice(0, 220),
    paymentType: String(offer?.policies?.paymentType || "").slice(0, 40),
    live: true
  };
}

async function searchHotelBatch(config, hotelIds, criteria, hotelMap) {
  const params = new URLSearchParams({
    hotelIds: hotelIds.join(","),
    adults: String(criteria.adults),
    checkInDate: criteria.checkIn,
    checkOutDate: criteria.checkOut,
    roomQuantity: String(criteria.rooms)
  });
  const json = await amadeusRequest(config, `/v3/shopping/hotel-offers?${params.toString()}`);
  return (json?.data || [])
    .map(item => normalizeHotelOffer(item, criteria, hotelMap.get(String(item?.hotel?.hotelId || ""))))
    .filter(Boolean);
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
      compareTotal: rate ? Number((item.stayTotal * rate).toFixed(2)) : null,
      compareCurrency: rate ? targetCurrency : item.currency,
      comparePerNight: rate ? Number((item.pricePerNight * rate).toFixed(2)) : null,
      fxConverted: Boolean(rate && item.currency !== targetCurrency)
    };
  });
}

exports.searchWorldwideHotels = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 35,
  memory: "256MiB",
  secrets: [TRAVEL_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const checkIn = cleanDate(req.data?.checkIn, "check-in date");
  const checkOut = cleanDate(req.data?.checkOut, "check-out date");
  if (checkOut <= checkIn) throw new HttpsError("invalid-argument", "Check-out must be after check-in.");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > 30) throw new HttpsError("invalid-argument", "Hotel stay cannot exceed 30 nights in one search.");

  const criteria = {
    destination: cleanText(req.data?.destination, "hotel destination", 80),
    checkIn,
    checkOut,
    adults: cleanCount(req.data?.adults, "Adults", 1, 9),
    rooms: cleanCount(req.data?.rooms, "Rooms", 1, 4),
    currency: cleanCurrency(req.data?.currency)
  };

  const config = parseProviderSecret();
  const configured = Boolean(config.amadeusClientId && config.amadeusClientSecret);
  if (!configured) {
    return {
      ok: false,
      reason: "provider-not-configured",
      message: "Worldwide hotel provider is not configured on the secure backend yet.",
      provider: "Amadeus",
      offers: []
    };
  }

  const city = await resolveCity(config, criteria.destination);
  criteria.city = city;
  const hotels = await listHotels(config, city.code);
  if (!hotels.length) {
    return {
      ok: true,
      searchedAt: Date.now(),
      provider: "Amadeus",
      city,
      scannedHotels: 0,
      offers: []
    };
  }

  const hotelMap = new Map(hotels.map(hotel => [hotel.hotelId, hotel]));
  const batches = [];
  for (let index = 0; index < hotels.length; index += 8) {
    batches.push(hotels.slice(index, index + 8).map(hotel => hotel.hotelId));
  }

  const settled = await Promise.allSettled(
    batches.map(batch => searchHotelBatch(config, batch, criteria, hotelMap))
  );
  const providerErrors = [];
  let offers = [];
  for (const result of settled) {
    if (result.status === "fulfilled") offers.push(...result.value);
    else providerErrors.push(String(result.reason?.message || result.reason || "Hotel provider search failed.").slice(0, 220));
  }

  offers = (await convertForComparison(offers, criteria.currency))
    .sort((a, b) => (a.compareTotal ?? Number.MAX_VALUE) - (b.compareTotal ?? Number.MAX_VALUE))
    .slice(0, MAX_RESULTS);

  return {
    ok: true,
    searchedAt: Date.now(),
    provider: "Amadeus",
    city,
    scannedHotels: hotels.length,
    providerErrors,
    currency: criteria.currency,
    offers
  };
});
