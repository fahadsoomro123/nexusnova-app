const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeHotelValue}=require('./hotel-value');

test('value explanation is traceable to provider facts',()=>{const out=analyzeHotelValue({price:80,reviewScore:9,reviewCount:250,amenities:['WiFi','Breakfast'],rate:{name:'Deluxe King',meal:'Breakfast',cancellation:'Free cancellation'}},[{price:80},{price:110},{price:130}]);assert.equal(out.status,'complete');assert.match(out.title,/Good value/);assert(out.reasons.some(x=>x.includes('lowest supplied price')));assert(out.reasons.some(x=>x.includes('review score (9/10)')));assert(out.reasons.some(x=>x.includes('Breakfast')))});
test('value does not invent a score when provider data is insufficient',()=>{const out=analyzeHotelValue({},[]);assert.equal(out.status,'insufficient');assert.equal(out.title,'Not enough data to determine value.');assert.deepEqual(out.reasons,[])});
