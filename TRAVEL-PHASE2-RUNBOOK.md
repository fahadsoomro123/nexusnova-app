# NexusNova Travel / Fare Lens — Phase 2 Runbook

## Runtime architecture

`fresh-rebuild` Travel UI → Firebase Hosting `/api/travel/**` rewrite → Firebase Functions `travelApi` → `TravelProvider` adapter → normalized offers → Fare Lens renderer.

The browser/mobile client never receives provider credentials. This is required for Duffel: its API documentation requires an access token and recommends that the API be called from a backend rather than directly from a browser/mobile client.

## Live flights

The current adapter is `DuffelAdapter` in `functions/travel-provider.js`.

Required Firebase Functions environment configuration:

- `TRAVEL_PROVIDER=duffel`
- `DUFFEL_ACCESS_TOKEN=<secret value>`

Do not commit either value. Configure them in the authorized Firebase/CI secret environment used to deploy Functions.

When the credential is absent, the API returns a provider-unavailable state. The frontend does not synthesize fares.

## Keyless airport directory

`GET /api/travel/airports/search?q=...` uses the public OurAirports `airports.csv` dataset with a six-hour in-memory cache. The dataset is used only for airport/city lookup; it is not a source of live fare inventory.

The Travel UI keeps its existing curated airport list as a local fallback. The global backend directory is available for future picker expansion without changing the provider architecture.

## Verified endpoint contract

- `GET /api/travel/capabilities`
- `GET /api/travel/airports/search?q=...`
- `POST /api/travel/flights/search`
- `GET /api/travel/flights/calendar`
- `GET /api/travel/flights/offer?id=...`
- `GET /api/travel/flights/track?flight=...` — explicit unavailable until a verified status provider is connected
- `POST /api/travel/buses/search` — explicit unavailable
- `POST /api/travel/trains/search` — explicit unavailable
- `POST /api/travel/hotels/search` — explicit unavailable

## Passenger ages

Duffel recommends sending ages for passengers under 18. The API therefore requires `childrenAges` with one valid age (2–17) per selected child. The current Travel UI does not yet expose child-age fields; keep the child count at zero until that UI is added rather than silently guessing ages.

## Booking

The current implementation supports secure provider-offer refresh through `/flights/offer` and HTTPS-only handoff when the provider supplies a booking URL. NexusNova does not claim to create a booking unless a real provider order workflow is separately implemented and verified.

## Android

`NexusNovaAndroid` builds the canonical `fresh-rebuild` web source into the APK assets. The project uses Android Gradle Plugin 8.13.2, Gradle 8.13, JDK 17, compile/target SDK 35, and application ID `com.nexusnova.app`.

The Phase 2 Android workflow builds `:app:assembleDebug` in GitHub Actions and uploads the resulting APK as an artifact. It intentionally does not require or expose release signing credentials.

## Deployment gate

Before describing flight search as live:

1. Configure `DUFFEL_ACCESS_TOKEN` in the authorized Firebase Functions runtime.
2. Deploy Functions and Hosting so the `/api/travel/**` rewrite reaches `travelApi`.
3. Call `GET /api/travel/capabilities` and confirm `flights.live=true` and `provider=Duffel`.
4. Perform a real search and confirm `live=true`, provider IDs, expiry, and returned offer facts.
5. Re-fetch a selected offer before any order workflow because offers can expire.

Until those steps are verified in the actual runtime, the correct product state is `READY — provider credential required`, not `LIVE`.
