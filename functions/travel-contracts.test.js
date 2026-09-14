const test=require('node:test');
const assert=require('node:assert/strict');
const {
  BOOKING_STATES,PAYMENT_STATES,buildCapabilityMatrix,canTransition,transitionBooking,
  createBookingState,applyBookingTransition,demoModeEnabled,demoLabel,redactTelemetry
}=require('./travel-contracts');

test('booking state machine exposes the complete safe state set',()=>{
  assert.deepEqual(BOOKING_STATES,['SEARCHED','SELECTED','REVALIDATING','PRICE_CHANGED','READY_TO_BOOK','BOOKING','CONFIRMED','FAILED','UNKNOWN','CANCELLED','REFUND_PENDING','REFUNDED']);
  assert.deepEqual(PAYMENT_STATES,['PAYMENT_REQUIRED','PAYMENT_PROCESSING','PAYMENT_SUCCESS','PAYMENT_FAILED','PAYMENT_UNKNOWN']);
  assert.equal(canTransition('SEARCHED','SELECTED'),true);
  assert.equal(canTransition('SELECTED','CONFIRMED'),false);
  assert.equal(canTransition('BOOKING','CONFIRMED'),true);
  assert.equal(canTransition('BOOKING','UNKNOWN'),true);
});

test('booking flow handles price change, unknown outcome and recovery',()=>{
  let record=createBookingState();
  record=applyBookingTransition(record,'SELECTED',{requestId:'r1'});
  record=applyBookingTransition(record,'REVALIDATING',{requestId:'r2'});
  record=applyBookingTransition(record,'PRICE_CHANGED',{reason:'provider price changed',requestId:'r3'});
  record=applyBookingTransition(record,'REVALIDATING',{requestId:'r4'});
  record=applyBookingTransition(record,'READY_TO_BOOK',{requestId:'r5'});
  record=applyBookingTransition(record,'BOOKING',{requestId:'r6'});
  record=applyBookingTransition(record,'UNKNOWN',{reason:'provider timeout',requestId:'r7'});
  record=applyBookingTransition(record,'CONFIRMED',{requestId:'r8'});
  assert.equal(record.state,'CONFIRMED');
  assert.equal(record.history.at(-1).requestId,'r8');
});

test('illegal booking transition fails closed',()=>{
  assert.throws(()=>transitionBooking('SEARCHED','CONFIRMED'),/Invalid booking transition/);
});

test('demo mode is impossible in production',()=>{
  assert.equal(demoModeEnabled({TRAVEL_DEMO_MODE:'true',TRAVEL_ENVIRONMENT:'staging'}),true);
  assert.equal(demoModeEnabled({TRAVEL_DEMO_MODE:'true',TRAVEL_ENVIRONMENT:'production'}),false);
  assert.equal(demoLabel(),'DEMO / TEST DATA');
});

test('telemetry redaction keeps operational fields but drops sensitive data',()=>{
  const clean=redactTelemetry({requestId:'r',provider:'Duffel',capability:'search',latencyMs:120,status:'success',errorClass:'',retryCount:1,bookingState:'SEARCHED',availabilityFailure:false,priceChange:false,timeout:false,token:'SECRET',cardNumber:'4111111111111111',email:'a@example.com'});
  assert.deepEqual(Object.keys(clean).sort(),['availabilityFailure','bookingState','capability','errorClass','latencyMs','priceChange','provider','requestId','retryCount','status','timeout']);
  assert.equal(clean.token,undefined);
  assert.equal(clean.cardNumber,undefined);
});
