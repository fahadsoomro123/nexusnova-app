# NexusNova Travel / Fare Lens — Partner Readiness Package

## Purpose

NexusNova Travel is structured as a provider-agnostic travel workspace. The product owns the user journey, normalized contracts, honest capability states and recovery UX; authorized providers own inventory, provider pricing and provider booking/order truth.

The intended integration path is:

`Travel UI → Travel API → Capability Router → Provider Adapter → Provider API → Normalized Response → Travel UI`

A provider adapter must never expose provider-native response shapes directly to the UI.

## Capability vocabulary

- `LIVE VERIFIED`: a real provider capability has been exercised successfully in the authorized runtime and evidence is recorded.
- `READY FOR PROVIDER`: the NexusNova contract and UX path are implemented, but authorized provider access or live verification is still required.
- `BLOCKED`: the capability cannot truthfully operate with the currently verified dependencies.
- `NOT SUPPORTED`: the capability is outside the current provider/product contract.

Credential presence alone is never treated as `LIVE VERIFIED`.

## Four-domain capability matrix

| Domain | Search | Live data | Filters | Details | Revalidation | Booking | Payment | Confirmation | Cancellation | Refund | Trip retrieval | Tracking |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Flights | READY FOR PROVIDER | READY FOR PROVIDER | LIVE VERIFIED | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | BLOCKED until status provider |
| Hotels | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | BLOCKED | BLOCKED | READY FOR PROVIDER | NOT SUPPORTED |
| Buses | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER |
| Rail | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER | READY FOR PROVIDER |

Current verified provider configuration is intentionally empty from the application's public source. No inventory is fabricated to fill these gaps.

## Booking lifecycle

The canonical state machine is:

`SEARCHED → SELECTED → REVALIDATING → READY_TO_BOOK → BOOKING → CONFIRMED`

Alternative truth-preserving branches include:

- `REVALIDATING → PRICE_CHANGED`
- `BOOKING → FAILED`
- `BOOKING → UNKNOWN`
- `UNKNOWN → CONFIRMED | FAILED`
- `CONFIRMED → CANCELLED | REFUND_PENDING`
- `REFUND_PENDING → REFUNDED | FAILED | UNKNOWN`

`UNKNOWN` is a first-class state. A timeout or lost connection after a booking request must never become a false success or an automatic blind retry.

## Payment lifecycle

Payment is modeled separately from booking:

`PAYMENT_REQUIRED → PAYMENT_PROCESSING → PAYMENT_SUCCESS`

Failure/ambiguity branches are `PAYMENT_FAILED` and `PAYMENT_UNKNOWN`.

The repository does not store raw card data and does not claim payment success without authoritative confirmation.

## Provider adapter requirements

Every new provider adapter should implement or map the relevant capabilities without changing the UI contract. At minimum:

- search and normalized offer/result mapping
- provider identifier and attribution
- freshness/expiry information where supplied
- revalidation/quote path
- booking request and authoritative result mapping where supported
- cancellation/refund mapping where supported
- provider error classification and timeout handling
- idempotency-key propagation where the upstream provider supports it

Secrets are runtime configuration only. They are never placed in frontend code, HTML, tests, screenshots or logs.

## Partner/demo environment

Demo mode is an explicit environment concern, not a production fallback. It must only be enabled when `TRAVEL_DEMO_MODE=true` and `TRAVEL_ENVIRONMENT` is not `production`. All synthetic results must be labelled `DEMO / TEST DATA` and must never share the production provider path.

Production behavior when a provider is unavailable is an explicit unavailable/pending state. No synthetic inventory is returned by the production provider adapters.

## Security controls

The Travel API applies bounded request-body and field validation, provider credentials server-side, HTTPS-only external handoff validation, secure response headers, no raw provider payload interpolation into UI, and explicit generic internal errors.

Partner review should additionally verify the deployed environment's:

- Firebase Auth/App Check posture
- allowed origins/CORS policy
- CSP and other browser security headers
- rate limits and abuse controls at the edge/runtime
- webhook signature validation when webhooks are enabled
- provider callback/redirect allowlist
- PII retention/deletion policy
- payment processor PCI boundary
- audit-log access controls

These deployment controls cannot be represented as `LIVE VERIFIED` from repository source alone.

## Observability contract

Operational telemetry may contain only:

`requestId, provider, capability, latencyMs, status, errorClass, retryCount, bookingState, availabilityFailure, priceChange, timeout`

Do not log secrets, card data, authentication tokens or unnecessary traveller PII.

## Provider onboarding checklist

1. Provider sandbox/production agreement and authorized credentials.
2. Environment variable names and secret storage owner.
3. Provider capability mapping to `travel-contracts.js`.
4. Endpoint and authentication details.
5. Search → details → revalidation → booking → confirmation sequence.
6. Timeout, retry and duplicate-request policy.
7. Webhook/callback signatures and replay handling where applicable.
8. Error-code mapping.
9. Cancellation/refund semantics.
10. Attribution and freshness fields.
11. PII fields required by the provider and retention constraints.
12. Live verification procedure in a non-mocked environment.
13. Rollback and provider disable switch.

## Live verification gate

A provider is not called live merely because an environment variable exists. Before a capability is marked `LIVE VERIFIED`, record a real request and response in the authorized runtime, verify provider attribution, verify error/timeout handling, and attach CI/deployment evidence without exposing credentials or traveller PII.

## Current integration boundary

Flights have a server-side adapter path for Duffel and FlightAPI. Hotels have a server-side Duffel Stays adapter. Buses and Rail have explicit no-provider states. The current repository therefore represents a serious integration-ready product foundation, not a claim of broad live inventory coverage.
