const test=require('node:test');
const assert=require('node:assert/strict');
const {FlightAPIAdapter,createFlightApiProvider,normalizeItineraryRows}=require('./flightapi-provider');
const {DuffelStaysAdapter,createDuffelStaysProvider,validateBookingInput}=require('./duffel-stays-provider');
const {analyzeHotelValue}=require('./hotel-value');

test('FlightAPI factory fails closed without a secret',()=>{assert.equal(createFlightApiProvider({}),null);assert.equal(new FlightAPIAdapter('').available,false)});
test('FlightAPI itinerary normalization keeps provider facts only',()=>{const rows=normalizeItineraryRows({itineraries:[{id:'it1',price:{total:120,currency:'USD'},legs:[{segments:[{departureTime:{utc:'2026-10-01T10:00:00Z'},arrivalTime:{utc:'2026-10-01T12:00:00Z'},departureAirport:{iata:'KHI'},arrivalAirport:{iata:'DXB'},flightNumber:'XY123',carrier:{name:'Example Air'}}]}],deepLink:'https://provider.example/book'}]});assert.equal(rows[0].provider,'FlightAPI');assert.equal(rows[0].price,120);assert.equal(rows[0].originCode,'KHI');assert.equal(rows[0].destinationCode,'DXB');assert.equal(rows[0].bookingUrl,'https://provider.example/book')});
test('Duffel Stays factory fails closed without access',()=>{assert.equal(createDuffelStaysProvider({}),null);assert.equal(new DuffelStaysAdapter('').available,false)});
test('Duffel Stays booking validates guests and uses quote id',()=>{const v=validateBookingInput({quoteId:'quo_123',guests:[{givenName:'A',familyName:'B',email:'a@example.com',phone:'+1'}]});assert.equal(v.quoteId,'quo_123');assert.deepEqual(v.guests[0],{given_name:'A',family_name:'B',email:'a@example.com',phone_number:'+1'})});
test('Duffel Stays booking rejects missing guests',()=>{assert.throws(()=>validateBookingInput({quoteId:'quo_123',guests:[]}),/lead guest/)});
test('Hotel value explains only supplied facts',()=>{const a=analyzeHotelValue({price:80,reviewScore:9,reviewCount:250,amenities:['WiFi','Breakfast'],rate:{name:'Deluxe King',meal:'Breakfast',cancellation:'Free cancellation'}},[{price:80},{price:110},{price:130}]);assert.equal(a.status,'complete');assert.match(a.title,/Good value/);assert(a.reasons.some(x=>/lowest supplied price/.test(x)));assert(a.reasons.some(x=>/review score/.test(x)));});
test('Hotel value refuses arbitrary score with insufficient facts',()=>{const a=analyzeHotelValue({},[]);assert.equal(a.status,'insufficient');assert.equal(a.title,'Not enough data to determine value.')});
