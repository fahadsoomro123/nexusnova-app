# NexusNova Travel Provider Adapter Contract

## Boundary

```text
UI
 ↓
Travel API
 ↓
Capability Router
 ↓
Provider Adapter
 ↓
Provider API
 ↓
Normalized contract
 ↓
UI / Trip Center
```

Provider-native objects stop at the adapter boundary.

## Required normalized offer fields

```js
{
  id,
  provider,
  liveMode,
  price,
  currency,
  originCode,
  destinationCode,
  departure,
  arrival,
  durationMinutes,
  stops,
  expiresAt,
  lastUpdated
}
```

Provider-specific data may be attached only under a bounded metadata area when needed and must not become a UI contract by accident.

## Capability methods

A provider implementation should expose only capabilities it truly supports:

```text
search
getOffer / details
revalidate / quote
book
getBooking / retrieveTrip
cancel
refund
track
```

Unsupported capabilities return an explicit unavailable state; they do not synthesize data.

## Error taxonomy

Adapters should map upstream outcomes into stable application classes:

```text
invalid_request
provider_unavailable
provider_auth
provider_rate_limit
provider_timeout
provider_malformed
provider_error
booking_conflict
booking_unknown
not_found
```

The UI receives the stable class and a safe human-readable message. Raw upstream errors, credentials and sensitive request bodies are not forwarded.

## Timeouts and retries

Search/read operations use bounded timeouts. A booking request must not be blindly retried after a timeout or network interruption. Such an outcome is represented as `UNKNOWN` until the provider outcome is reconciled.

Where the provider supports idempotency, NexusNova passes an idempotency key generated for the logical booking attempt. A new user click must not silently become a second booking attempt.

## Verification gate

A configured credential means `READY FOR PROVIDER`, not `LIVE VERIFIED`. To promote a capability:

1. Use the authorized runtime.
2. Make a real request.
3. Confirm provider attribution and returned facts.
4. Verify timeout/rate-limit/error handling.
5. Verify offer freshness/revalidation behavior.
6. Record evidence without secrets or unnecessary PII.
