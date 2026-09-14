# NexusNova Travel — Provider Capability Matrix

Status vocabulary is evidence-strict:

- `CODE VERIFIED` means the adapter/contract exists and automated tests cover it.
- `DEPLOYMENT VERIFIED` means the exact code revision has been deployed and the deployed endpoint has been exercised.
- `LIVE VERIFIED` means an authorized real provider request succeeded and the returned provider facts were verified. Credential presence alone never qualifies.
- `OWNER VERIFICATION REQUIRED` means the technical path is implemented but external account/credential/provisioning work is required in an authorized provider environment.
- `PROVIDER BLOCKED` means no verified provider access exists for the requested capability.

| Capability | Provider | Search | Revalidate | Book | Payment | Live Verified | Status |
|---|---|---|---|---|---|---|---|
| Flights | FlightAPI | CODE VERIFIED | PROVIDER-SUPPORTED PATH / CODE VERIFIED | PROVIDER DEEP-LINK ONLY / not NexusNOVA order | Not provided by current adapter | No | OWNER VERIFICATION REQUIRED — existing adapter path requires `FLIGHTAPI_API_KEY` and real runtime verification |
| Flights | Duffel | CODE VERIFIED | CODE VERIFIED via offer refresh | Not yet NexusNOVA order flow | Not yet wired | No | OWNER VERIFICATION REQUIRED — authorized Duffel token + real request required |
| Flights | Travelport TripServices | CODE VERIFIED | Not yet implemented | Not yet implemented | Travelport Pay available, not wired | No | OWNER VERIFICATION REQUIRED — trial/provisioning credentials required before live verification; search adapter is server-side and routed only when configured |
| Hotels | Duffel Stays | CODE VERIFIED | CODE VERIFIED via quotes | CODE VERIFIED in server adapter | Provider/payment boundary not yet verified | No | OWNER VERIFICATION REQUIRED — Stays access + authorized token required |
| Hotels | Travelport Stays | Not yet implemented | Not yet implemented | Provider supports reservation workflows | Provider Pay exists | No | OWNER VERIFICATION REQUIRED — provisioning credentials required |
| Tracking | FlightAPI | N/A | N/A | N/A | N/A | No | OWNER VERIFICATION REQUIRED — real `/airline` or `/trackbyroute` request requires authorized key |
| Tracking | Aviationstack / FlightAware | Research verified | N/A | N/A | N/A | No | OWNER VERIFICATION REQUIRED — new provider account/key not available in this runtime |
| Payments | JazzCash Sandbox | N/A | N/A | Payment API path not yet implemented | SANDBOX CAPABILITY FOUND | No | OWNER VERIFICATION REQUIRED — merchant sandbox credentials required |
| Buses | Bookme / Busbud / Distribusion / regional providers | No verified public booking API configured | — | — | — | No | PROVIDER BLOCKED — no authorized API access verified in the repository/runtime |
| Rail | Pakistan Railways / RABTA ecosystem | No verified public booking API configured | — | — | — | No | PROVIDER BLOCKED — no authorized inventory/API access verified in the repository/runtime |
| Rail information | Transitland / OpenTripPlanner | Data/routing capability researched | N/A | NO BOOKING | N/A | No | OWNER VERIFICATION REQUIRED for external hosted data access; not a ticket-booking solution |

## Current implementation evidence

### FlightAPI

`functions/flightapi-provider.js` implements one-way and round-trip search, flight tracking, route tracking, schedules and IATA lookup behind `FLIGHTAPI_API_KEY`. The adapter normalizes FlightAPI's relational response shape using `itineraries`, `leg_ids`, `segment_ids`, `pricing_options`, `carriers` and provider deep links. No API key is stored in source.

### Duffel Flights

`functions/travel-provider.js` provides server-side Duffel offer-request search, offer refresh and fare-calendar generation behind `DUFFEL_ACCESS_TOKEN`.

### Duffel Stays

`functions/duffel-stays-provider.js` provides server-side stays search, room/rate retrieval, quote and booking paths. `functions/travel-api-v2.js` requires Firebase Auth and an `Idempotency-Key` for booking and stores only a bounded provider booking record in the user's Trip Center.

### Travelport TripServices Flights

`functions/travelport-provider.js` provides a server-side OAuth 2.0 client-credentials token path and TripServices v11 air shopping request against the documented pre-production/production endpoints. `functions/travel-api-v2.js` includes Travelport in the flight provider chain after FlightAPI and Duffel by default, while remaining fail-closed when Travelport credentials are absent. The adapter currently implements search only; revalidation, booking, ticketing, payment and cancellation remain deliberately unclaimed until the corresponding provider workflow is implemented and tested with authorized credentials.

### Honest capability gating

`functions/travel-contracts.js` does not label a capability `LIVE VERIFIED` merely because an environment variable exists. Bus inventory is explicitly `BLOCKED` until a verified inventory provider is configured; rail tracking is `NOT SUPPORTED` without an operator/status feed; unconfigured flight/hotel payment is `BLOCKED`.

## External provider findings

FlightAPI currently advertises live prices, tracking, schedules and IATA capabilities. The repository still cannot treat an existing founder relationship, account or configured secret as live access without an authorized key and a successful real request.

Travelport currently advertises trial access and end-to-end Flights, Stays and Pay capabilities. Current documentation specifies OAuth 2.0, trial/provisioning credentials, and separate pre-production/production endpoints. The runtime available to this agent cannot complete third-party account creation, OTP, KYC or commercial approval.

Duffel currently supports sandbox/test access for flights and offers a separate Stays access workflow. Test/live access is external to the repository runtime and is not fabricated here.

## Required promotion gate

A row can move to `LIVE VERIFIED` only after all of these are attached to the same implementation revision:

1. Authorized credential configured server-side.
2. Real provider request succeeds.
3. Provider attribution and response facts are verified.
4. Result is normalized and displayed in Fare Lens.
5. Revalidation/offer freshness behavior is verified where supported.
6. Deployment endpoint is exercised.
7. No secret, payment credential or unnecessary traveler PII is recorded in evidence.
