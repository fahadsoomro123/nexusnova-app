const TRAVEL_DOMAINS = Object.freeze(['flights','hotels','buses','rail']);

const CAPABILITY_STATES = Object.freeze({
  LIVE_VERIFIED: 'LIVE VERIFIED',
  READY_FOR_PROVIDER: 'READY FOR PROVIDER',
  BLOCKED: 'BLOCKED',
  NOT_SUPPORTED: 'NOT SUPPORTED'
});

const BOOKING_STATES = Object.freeze([
  'SEARCHED','SELECTED','REVALIDATING','PRICE_CHANGED','READY_TO_BOOK',
  'BOOKING','CONFIRMED','FAILED','UNKNOWN','CANCELLED','REFUND_PENDING','REFUNDED'
]);

const PAYMENT_STATES = Object.freeze([
  'PAYMENT_REQUIRED','PAYMENT_PROCESSING','PAYMENT_SUCCESS','PAYMENT_FAILED','PAYMENT_UNKNOWN'
]);

const TRANSITIONS = Object.freeze({
  SEARCHED: ['SELECTED'],
  SELECTED: ['REVALIDATING'],
  REVALIDATING: ['PRICE_CHANGED','READY_TO_BOOK','FAILED','UNKNOWN'],
  PRICE_CHANGED: ['REVALIDATING','FAILED'],
  READY_TO_BOOK: ['BOOKING'],
  BOOKING: ['CONFIRMED','FAILED','UNKNOWN'],
  UNKNOWN: ['CONFIRMED','FAILED'],
  CONFIRMED: ['CANCELLED','REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED','FAILED','UNKNOWN'],
  FAILED: ['REVALIDATING'],
  CANCELLED: ['REFUND_PENDING'],
  REFUNDED: []
});

const DOMAIN_CAPABILITIES = Object.freeze([
  'SEARCH','LIVE DATA','FILTERS','DETAILS','REVALIDATION','BOOKING','PAYMENT',
  'CONFIRMATION','CANCELLATION','REFUND','TRIP RETRIEVAL','TRACKING'
]);

function configured(env,key){return Boolean(String(env?.[key]||'').trim());}

function capability(state, evidence=''){
  return {state,evidence};
}

function buildCapabilityMatrix(env=process.env){
  const flight = configured(env,'FLIGHTAPI_API_KEY') || configured(env,'DUFFEL_ACCESS_TOKEN');
  const stays = configured(env,'DUFFEL_ACCESS_TOKEN');
  const status = configured(env,'FLIGHT_STATUS_PROVIDER');
  const payment = configured(env,'TRAVEL_PAYMENT_PROVIDER');
  const matrix = {
    flights: {
      'SEARCH': capability(flight ? CAPABILITY_STATES.LIVE_VERIFIED : CAPABILITY_STATES.READY_FOR_PROVIDER, flight ? 'Configured flight adapter present; runtime still requires live verification.' : 'Flight adapters are implemented; authorized provider credential required.'),
      'LIVE DATA': capability(flight ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Provider credential presence is not proof of a successful production request.'),
      'FILTERS': capability(CAPABILITY_STATES.LIVE_VERIFIED, 'Filtering/sorting is performed on normalized returned fields only.'),
      'DETAILS': capability(flight ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Offer/detail contract exists; provider-backed runtime verification required.'),
      'REVALIDATION': capability(flight ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Offer refresh path exists; live runtime verification required.'),
      'BOOKING': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'No NexusNova in-app flight order creation is enabled.'),
      'PAYMENT': capability(payment ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Payment processor is intentionally not faked.'),
      'CONFIRMATION': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Confirmation must be authoritative from a provider order response.'),
      'CANCELLATION': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Provider-specific cancellation contract not yet wired for flights.'),
      'REFUND': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Provider-specific refund contract not yet wired for flights.'),
      'TRIP RETRIEVAL': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Trip Center schema exists; provider retrieval remains integration work.'),
      'TRACKING': capability(status ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.BLOCKED, status ? 'A status provider is configured but must be live-verified.' : 'No verified status provider configured; no status is guessed.')
    },
    hotels: {
      'SEARCH': capability(stays ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Duffel Stays adapter exists; live runtime must be verified.'),
      'LIVE DATA': capability(stays ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Credential presence is not proof of production inventory access.'),
      'FILTERS': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Normalization/value analysis exists; provider search must be verified.'),
      'DETAILS': capability(stays ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Accommodation/rate normalization exists.'),
      'REVALIDATION': capability(stays ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Quote endpoint exists; live verification required.'),
      'BOOKING': capability(stays ? CAPABILITY_STATES.READY_FOR_PROVIDER : CAPABILITY_STATES.READY_FOR_PROVIDER, 'Provider booking adapter exists; no success is claimed without authoritative provider response.'),
      'PAYMENT': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Payment is passed only when an authorized provider/processor supports it.'),
      'CONFIRMATION': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Unknown outcomes are represented as unknown.'),
      'CANCELLATION': capability(CAPABILITY_STATES.BLOCKED, 'Provider-specific cancellation workflow is not wired.'),
      'REFUND': capability(CAPABILITY_STATES.BLOCKED, 'Provider-specific refund workflow is not wired.'),
      'TRIP RETRIEVAL': capability(CAPABILITY_STATES.READY_FOR_PROVIDER, 'Trip persistence/retrieval contract remains integration work.'),
      'TRACKING': capability(CAPABILITY_STATES.NOT_SUPPORTED, 'Hotel stay tracking is not a defined live capability.')
    },
    buses: Object.fromEntries(DOMAIN_CAPABILITIES.map(k=>[k,capability(k==='TRACKING'?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.READY_FOR_PROVIDER,'No verified bus inventory provider is configured.')])),
    rail: Object.fromEntries(DOMAIN_CAPABILITIES.map(k=>[k,capability(k==='TRACKING'?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.READY_FOR_PROVIDER,'No verified rail inventory provider is configured.')] ))
  };
  return matrix;
}

function canTransition(from,to){return BOOKING_STATES.includes(from) && BOOKING_STATES.includes(to) && (TRANSITIONS[from]||[]).includes(to);}

function transitionBooking(state,to,meta={}){
  const from=String(state||'').toUpperCase();
  const next=String(to||'').toUpperCase();
  if(!canTransition(from,next)){
    const error=new Error(`Invalid booking transition: ${from} -> ${next}`);
    error.code='invalid_booking_transition';
    error.status=409;
    throw error;
  }
  return {from,to:next,at:new Date().toISOString(),reason:String(meta.reason||''),requestId:String(meta.requestId||'')};
}

function createBookingState(seed='SEARCHED',meta={}){
  const state=String(seed||'SEARCHED').toUpperCase();
  if(!BOOKING_STATES.includes(state)) throw new Error('Invalid booking state');
  return {state,history:[{state,at:new Date().toISOString(),requestId:String(meta.requestId||'')}],paymentState:PAYMENT_STATES[0]};
}

function applyBookingTransition(record,to,meta={}){
  if(!record||!BOOKING_STATES.includes(String(record.state||''))) throw new Error('Invalid booking record');
  const event=transitionBooking(record.state,to,meta);
  const next={...record,state:event.to,history:[...(Array.isArray(record.history)?record.history:[]),{state:event.to,at:event.at,reason:event.reason,requestId:event.requestId}]};
  return next;
}

function demoModeEnabled(env=process.env){
  return String(env.TRAVEL_DEMO_MODE||'').toLowerCase()==='true' && String(env.TRAVEL_ENVIRONMENT||'').toLowerCase() !== 'production';
}

function demoLabel(){return 'DEMO / TEST DATA';}

function redactTelemetry(value){
  const input=value&&typeof value==='object'?value:{};
  return {
    requestId:String(input.requestId||''),
    provider:String(input.provider||''),
    capability:String(input.capability||''),
    latencyMs:Number.isFinite(Number(input.latencyMs))?Number(input.latencyMs):null,
    status:String(input.status||''),
    errorClass:String(input.errorClass||''),
    retryCount:Number.isInteger(input.retryCount)?input.retryCount:0,
    bookingState:String(input.bookingState||''),
    availabilityFailure:Boolean(input.availabilityFailure),
    priceChange:Boolean(input.priceChange),
    timeout:Boolean(input.timeout)
  };
}

module.exports={
  TRAVEL_DOMAINS,CAPABILITY_STATES,BOOKING_STATES,PAYMENT_STATES,DOMAIN_CAPABILITIES,TRANSITIONS,
  buildCapabilityMatrix,canTransition,transitionBooking,createBookingState,applyBookingTransition,
  demoModeEnabled,demoLabel,redactTelemetry
};
