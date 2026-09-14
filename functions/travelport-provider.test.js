const assert=require('node:assert/strict');
const {cfg,payload,normalize,createTravelportProvider}=require('./travelport-provider');

assert.equal(cfg({TRAVELPORT_CLIENT_ID:'x',TRAVELPORT_CLIENT_SECRET:'y',TRAVELPORT_ACCESS_GROUP:'z'}).configured,true);
assert.equal(cfg({TRAVELPORT_CLIENT_ID:'x',TRAVELPORT_CLIENT_SECRET:'y'}).configured,false);

const request=payload({origin:'KHI',destination:'ISB',departure:'2026-10-20',tripType:'roundtrip',returnDate:'2026-10-25',adults:2,children:1,childAges:[9]});
assert.equal(request['@type'],'CatalogProductOfferingsQueryRequest');
assert.equal(request.CatalogProductOfferingsRequest.SearchCriteriaFlight.length,2);
assert.equal(request.CatalogProductOfferingsRequest.PassengerCriteria.length,3);
assert.equal(request.CatalogProductOfferingsRequest.PassengerCriteria[2].age,9);
assert.equal(request.CatalogProductOfferingsRequest.SearchCriteriaFlight[0].From.value,'KHI');

const normalized=normalize({CatalogProductOfferingsResponse:{transactionId:'tx',reservationStatus:'Success',CatalogProductOfferings:{CatalogProductOffering:[{id:'offer-1',TotalPrice:{value:'123.45',currencyCode:'USD'}}]},ReferenceList:[]}});
assert.equal(normalized.provider,'Travelport');
assert.equal(normalized.results.length,1);
assert.equal(normalized.results[0].price,123.45);
assert.equal(normalized.results[0].currency,'USD');
assert.equal(normalized.results[0].id,'offer-1');

assert.equal(createTravelportProvider({TRAVELPORT_CLIENT_ID:'x',TRAVELPORT_CLIENT_SECRET:'y'}),null);
const provider=createTravelportProvider({TRAVELPORT_CLIENT_ID:'x',TRAVELPORT_CLIENT_SECRET:'y',TRAVELPORT_ACCESS_GROUP:'z'});
assert.equal(provider.name,'travelport');
assert.equal(provider.capabilities.search,true);
assert.equal(provider.capabilities.revalidate,false);
assert.equal(provider.capabilities.book,false);

console.log('Travelport provider contract tests: PASS');
