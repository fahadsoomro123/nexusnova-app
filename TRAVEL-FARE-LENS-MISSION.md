# NexusNova Travel / Fare Lens Flagship

Scope: Travel/Fare Lens only.

The Travel screen is provider-truthful: returned inventory is displayed only from the configured Travel API. Missing provider capabilities render explicit unavailable states rather than synthetic fares, schedules, hotel inventory, flight positions, or booking confirmations.

Implemented in the renderer:
- edge-to-edge dark mobile shell with safe-area handling;
- compact integrated back/PK/browser actions;
- tappable origin/destination selectors with searchable airport/city/IATA choices;
- route swapping and dynamic state invalidation;
- round-trip/one-way dates with past-date prevention and return-date validation;
- passenger and cabin controls;
- provider-backed flight search contract with timeout/error/empty handling;
- offer normalization, supported recommendation labels, filtering and sorting;
- offer selection and safe HTTPS provider handoff;
- Fare Calendar provider contract with honest unavailable state;
- Disruption Rescue truthful unavailable state until supported integration exists;
- live flight-status provider contract with no Google-search masquerading as integrated tracker;
- local Trip Center planning state explicitly separated from booking confirmation;
- Flights/Buses/Trains/Hotels/Trip modes;
- clean `www.nexusnovatools.com` branding only at the bottom.

External verification limitations remain where current public source lacks the actual provider/Firebase runtime service.
