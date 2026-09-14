# NexusNova Travel / Fare Lens — Provider Acquisition Execution

Date: 2026-09-14
Branch: `travel-fare-lens-final`
PR: #70

## Evidence policy

`CODE VERIFIED`, `DEPLOYMENT VERIFIED`, and `LIVE VERIFIED` are independent. A passing browser harness does not establish provider inventory, pricing, booking or payment.

## FlightAPI

- Existing founder email relationship is treated as a provider lead, not proof of technical access.
- Existing adapter: `functions/flightapi-provider.js`.
- Supported adapter paths include flight search, tracking, route tracking, schedules and IATA metadata.
- Live-gate workflow: `.github/workflows/travel-flightapi-live-verification.yml`.
- Latest observed live-gate run: `34876585941`, run #8, SUCCESS.
- Job log explicitly reported `LIVE_VERIFICATION_BLOCKED missing GitHub Actions secret: FLIGHTAPI_API_KEY` and `No provider request was attempted.` Therefore this is NOT LIVE VERIFIED.
- Owner action: configure the existing authorized FlightAPI credential as the GitHub Actions secret `FLIGHTAPI_API_KEY` (without placing its value in chat or source), then rerun the live gate.

## Duffel

- Flight adapter remains in `functions/travel-provider.js`.
- Stays adapter remains in `functions/duffel-stays-provider.js`.
- Both fail closed without authorized provider access.
- No production booking claim is made.

## Travelport

- Current official documentation supports TripServices Flights, Stays and Pay with OAuth 2.0 and pre-production/production endpoints.
- New server-side adapter: `functions/travelport-provider.js`.
- Adapter uses OAuth 2.0 client credentials and the documented TripServices v11 air shopping endpoint.
- Flight search routing now includes Travelport after FlightAPI and Duffel when configured.
- Contract coverage: `functions/travelport-provider.test.js`.
- CI coverage was added for syntax, tests and contract checks.
- Current scope is intentionally search-only. Revalidation, booking, ticketing, payment and cancellation are not represented as live capabilities until implemented and tested against authorized provider access.
- Required external owner action: obtain legitimate Travelport trial/provisioning credentials and configure them server-side as `TRAVELPORT_CLIENT_ID`, `TRAVELPORT_CLIENT_SECRET`, and `TRAVELPORT_ACCESS_GROUP` (plus environment/base URL only where needed).

## Bus / Rail

- No verified public Pakistan bus inventory/booking API is configured.
- No verified Pakistan Railways ticket-booking API is configured.
- Production inventory is not fabricated.
- Capability remains provider-blocked until authorized access is obtained.
- Transitland/OpenTripPlanner are information/routing technologies, not a substitute for ticket-booking inventory.

## CI evidence on current head

Current PR head at the time of this document: `dc0133afaacaf6907c91b9eb285ea8506ff1c24d`.

- Travel Fare Lens Validation: run `34876591888`, run #122 — SUCCESS. Includes Travelport syntax/contract tests and real Chromium validation.
- Partner Readiness Validation: run `34876591945`, run #38 — SUCCESS.
- Android Travel Build Validation: run `34876591939`, run #85 — build was still running at the last observation; no physical-device QA is claimed.

## Deployment / live production gate

No production deployment or live provider result is claimed from this execution. PR #70 remains open and unmerged. This prevents confusing branch CI/browser success with production verification.
