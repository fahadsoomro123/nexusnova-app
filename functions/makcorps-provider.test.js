const test=require('node:test');
const assert=require('node:assert/strict');
const {MakcorpsHotelAdapter,createMakcorpsProvider,normalizeHotel,nearestCity}=require('./makcorps-provider');
test('Makcorps factory fails closed without credential',()=>assert.equal(createMakcorpsProvider({}),null));
test('Makcorps city mapping selects a supported location',()=>assert.equal(nearestCity(24.8607,67.0011),'Karachi'));
test('Makcorps normalization keeps returned price/vendor truth',()=>{const row=normalizeHotel({hotelId:'123',name:'Example Hotel',geocode:{latitude:'24.86',longitude:'67.00'},vendor1:'Booking.com',price1:'USD 180.50',vendor2:'Agoda',price2:'USD 175.00',reviews:{rating:'4.2',count:'88'}});assert.equal(row.id,'123');assert.equal(row.price,175);assert.equal(row.vendor,'Agoda');assert.equal(row.provider,'Makcorps');assert.equal(row.bookingSupported,false)});
test('Makcorps booking is explicitly unsupported',async()=>{const p=new MakcorpsHotelAdapter('test');await assert.rejects(()=>p.book({}),e=>e.code==='booking_not_supported'&&e.status===501)});
