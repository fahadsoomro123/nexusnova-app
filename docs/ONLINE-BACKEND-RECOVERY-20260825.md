# NexusNova online/backend recovery — 25 Aug 2026

Status: BROKEN / NOT PHONE-VERIFIED until each provider-backed app returns real live data on the physical Android phone.

Do not call an online feature working merely because its frontend/backend source exists.

## Firebase callable contract

Region: `us-central1`
Project: `nexusnova-6ade2`
Functions entry: `functions/main.js`

Expected callables:
- `searchWorldwideFlights` -> `functions/travelSearch.js`
- `searchWorldwideHotels` -> `functions/hotelSearch.js`
- `searchWorldwideGroundTransport` -> `functions/groundTransportSearch.js`
- `searchLearningPapers` -> `functions/learningSearch.js`
- `searchEntertainment` -> `functions/entertainmentSearch.js`
- `getProviderHealth` -> `functions/providerHealth.js`

All provider callables are authenticated and use App Check enforcement. `getProviderHealth` returns readiness booleans only and never returns provider keys/tokens.

## Required Firebase Secret Manager values

### `NEXUSNOVA_TRAVEL_PROVIDERS`
JSON object. Supported fields:
- `duffelAccessToken`
- `amadeusClientId`
- `amadeusClientSecret`
- optional `amadeusApiBase`
- `distribusionApiKey`
- optional `distribusionApiBase`

Used by Flights, Hotels, Rail/Bus.

### `NEXUSNOVA_ENTERTAINMENT_PROVIDERS`
JSON object. Supported fields:
- `youtubeApiKey`
- `tmdbBearerToken`

Dailymotion discovery is keyless, so if the entire Entertainment callable is unavailable even keyless discovery cannot work; investigate deployment/App Check before blaming only provider keys.

### `NEXUSNOVA_LEARNING_PROVIDERS`
JSON object. Supported fields:
- `googleCseApiKey`
- `googleCseCx`

Used by live learning/past-paper search.

## Recovery order

1. Authenticate Firebase CLI to project `nexusnova-6ade2` on the user's trusted laptop.
2. Confirm the project billing/runtime permits Cloud Functions v2 deployment. Do not claim deployment until Firebase accepts it.
3. Confirm the three provider secrets exist in Firebase Secret Manager. Never commit or paste their values into the repository/chat.
4. Deploy the current `functions/` package.
5. Call `getProviderHealth` from an authenticated/App-Check-valid NexusNova client and record only readiness booleans.
6. Test real data in this order:
   - Entertainment discovery (keyless Dailymotion path gives a useful deployment/App Check sanity check)
   - Flights
   - Hotels
   - Rail/Bus
   - Learning search
   - Live Entertainment/YouTube
   - Other Firebase AI/provider screens
7. A feature becomes PASS only after physical-phone live result verification.

## Common failure classification

- `functions/not-found`: backend callable not deployed / wrong project or region.
- `unauthenticated`: Firebase Auth session missing.
- App Check / permission error: client App Check token missing/invalid or callable enforcement rejected it.
- `providers-not-configured` / `provider-not-configured`: function exists, but required Secret Manager provider credential is absent.
- provider HTTP/auth error: secret exists but credential/account/provider request is invalid, expired, unauthorized, quota-limited, or unsupported.

## Safety

- Provider secrets stay server-side only.
- Do not put API admin secrets into browser JS, APK resources, GitHub source or OTA payloads.
- Do not modify mining reward/accounting or Firestore mining rules during online backend recovery.
- Keep Firebase product-level App Check enforcement setting unchanged until the broader phone verification plan is complete; callable-level `enforceAppCheck:true` remains required.
