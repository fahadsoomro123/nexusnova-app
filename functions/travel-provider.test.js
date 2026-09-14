const test=require('node:test');
const assert=require('node:assert/strict');
const {DuffelAdapter,normalizeDuffelOffer,createFlightProvider,isoMinutes}=require('./travel-provider');

test('isoMinutes parses ISO 8601 flight duration',()=>{
  assert.equal(isoMinutes('PT2H35M'),155);
  assert.equal(isoMinutes('PT45M'),45);
  assert.equal(isoMinutes('bad'),null);
});

test('normalizeDuffelOffer preserves only provider-supported facts',()=>{
  const offer=normalizeDuffelOffer({
    id:'off_abc123',total_amount:'125.50',total_currency:'USD',live_mode:true,expires_at:'2026-09-14T12:00:00Z',updated_at:'2026-09-14T10:00:00Z',
    conditions:{change_before_departure:{allowed:true}},
    slices:[{segments:[
      {departing_at:'2026-09-20T08:00:00Z',arriving_at:'2026-09-20T10:00:00Z',duration:'PT2H',origin:{iata_code:'KHI'},destination:{iata_code:'DXB'},operating_carrier:{name:'Example Air'},marketing_carrier_flight_number:'EA101'
      },
      {departing_at:'2026-09-20T11:00:00Z',arriving_at:'2026-09-20T12:00:00Z',duration:'PT1H',origin:{iata_code:'DXB'},destination:{iata_code:'AUH'},operating_carrier:{name:'Example Air'},marketing_carrier_flight_number:'EA202'}
    ]}],
  });
  assert.deepEqual(offer,{id:'off_abc123',price:125.5,currency:'USD',airline:'Example Air',flightNumber:'EA101',departure:'2026-09-20T08:00:00Z',arrival:'2026-09-20T12:00:00Z',originCode:'KHI',destinationCode:'AUH',durationMinutes:180,stops:1,baggage:null,checkedBags:null,flexible:true,flexibility:'Changes permitted before departure',familyFriendly:null,provider:'Duffel',liveMode:true,expiresAt:'2026-09-14T12:00:00Z',lastUpdated:'2026-09-14T10:00:00Z',bookingUrl:''});
});

test('provider factory fails closed without credentials',()=>{
  assert.equal(createFlightProvider({TRAVEL_PROVIDER:'duffel'}),null);
  assert.equal(createFlightProvider({TRAVEL_PROVIDER:'amadeus',DUFFEL_ACCESS_TOKEN:'x'}),null);
  assert.equal(new DuffelAdapter('').available,false);
});
