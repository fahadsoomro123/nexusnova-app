# Provider Adapter Boundary

Travel provider adapters are server-only modules. They must expose normalized contracts and never expose provider credentials to Fare Lens browser code.

## Flight provider chain

Default order: `flightapi,duffel,travelport`.

The router attempts only configured adapters and fails with an explicit provider-unavailable error when none can satisfy a request. It never substitutes synthetic inventory in production.

## Travelport

`functions/travelport-provider.js` currently exposes:

- OAuth 2.0 client-credentials authentication.
- Air shopping request construction.
- Conservative response normalization.
- Provider facts attribution.
- Explicit capability declaration: search supported; revalidation/booking/payment not yet wired.

The adapter returns provider-backed facts only after a real HTTP response is received. It is not marked live solely because credentials are present.

## Promotion gate

Before enabling a capability as `LIVE VERIFIED`:

1. Authorized credential exists server-side.
2. Real request succeeds.
3. Response shape and provider facts are validated.
4. Normalized data reaches Fare Lens.
5. Deployed endpoint is exercised.
6. Failure/timeout behavior is verified.
7. No secret or unnecessary PII enters logs/evidence.
