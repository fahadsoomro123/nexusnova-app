const test=require('node:test');
const assert=require('node:assert/strict');
const {FlightAPIAdapter,createFlightApiProvider,normalizeItineraryRows}=require('./flightapi-provider');
const {DuffelStaysAdapter,createDuffelStaysProvider}=require('./duffel-stays-provider');

test('FlightAPI factory fails closed without a secret',()=>{assert.equal(createFlightApiProvider({}),null);assert.equal(new FlightAPIAdapter('').available,false)});
test('FlightAPI itinerary normalization keeps provider facts only',()=>{const rows=normalizeItineraryRows({itineraries:[{id:'it1',price:{total:120,currency:'USD'},legs:[{segments:[{departureTime:{utc:'2026-10-01T10:00:00Z'},arrivalTime:{utc:'2026-10-01T12:00:00Z'},departureAirport:{iata:'KHI'},arrivalAirport:{iata:'DXB'},flightNumber:'XY123',carrier:{name:'Example Air'}}]}],deepLink:'https://provider.example/book'}]});assert.equal(rows[0].provider,'FlightAPI');assert.equal(rows[0].price,120);assert.equal(rows[0].originCode,'KHI');assert.equal(rows[0].destinationCode,'DXB');assert.equal(rows[0].bookingUrl,'https://provider.example/book')});
test('Duffel Stays factory fails closed without access',()=>{assert.equal(createDuffelStaysProvider({}),null);assert.equal(new DuffelStaysAdapter('').available,false)});
