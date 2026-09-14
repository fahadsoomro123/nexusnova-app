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
  SEARCHED: ['SELECTED'], SELECTED: ['REVALIDATING'],
  REVALIDATING: ['PRICE_CHANGED','READY_TO_BOOK','FAILED','UNKNOWN'],
  PRICE_CHANGED: ['REVALIDATING','FAILED'], READY_TO_BOOK: ['BOOKING'],
  BOOKING: ['CONFIRMED','FAILED','UNKNOWN'], UNKNOWN: ['CONFIRMED','FAILED'],
  CONFIRMED: ['CANCELLED','REFUND_PENDING'], REFUND_PENDING: ['REFUNDED','FAILED','UNKNOWN'],
  FAILED: ['REVALIDATING'], CANCELLED: ['REFUND_PENDING'], REFUNDED: []
});

const DOMAIN_CAPABILITIES = Object.freeze([
  'SEARCH','LIVE DATA','FILTERS','DETAILS','REVALIDATION','BOOKING','PAYMENT',
  'CONFIRMATION','CANCELLATION','REFUND','TRIP RETRIEVAL','TRACKING'
]);

function configured(env,key){return Boolean(String(env?.[key]||'').trim());}
function capability(state,evidence=''){return {state,evidence};}

function buildCapabilityMatrix(env=process.env){
  const flightConfigured=configured(env,'FLIGHTAPI_API_KEY')||configured(env,'DUFFEL_ACCESS_TOKEN');
  const staysConfigured=configured(env,'DUFFEL_ACCESS_TOKEN');
  const statusConfigured=configured(env,'FLIGHT_STATUS_PROVIDER');
  const paymentConfigured=configured(env,'TRAVEL_PAYMENT_PROVIDER');
  const readyLive='Configured credential may enable the adapter, but a successful authorized runtime request is required before LIVE VERIFIED.';
  return {
    flights:{
      'SEARCH':capability(flightConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.READY_FOR_PROVIDER,flightConfigured?readyLive:'Flight adapters are implemented; authorized provider credential required.'),
      'LIVE DATA':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Real provider response verification is still required.'),
      'FILTERS':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Filtering/sorting is applied only to normalized provider-returned fields; live-data verification remains required.'),
      'DETAILS':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Offer/detail contract exists; provider-backed verification required.'),
      'REVALIDATION':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Offer refresh path exists; provider-backed verification required.'),
      'BOOKING':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'No NexusNova flight order creation is enabled yet.'),
      'PAYMENT':capability(paymentConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,paymentConfigured?'Payment provider is configured but not live-verified.':'No verified flight payment processor is configured.'),
      'CONFIRMATION':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Confirmation must be authoritative from a provider order response.'),
      'CANCELLATION':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Flight cancellation contract is not wired.'),
      'REFUND':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Flight refund contract is not wired.'),
      'TRIP RETRIEVAL':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Provider retrieval contract is not yet wired.'),
      'TRACKING':capability(statusConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,statusConfigured?'Status provider is configured but not live-verified.':'No verified status provider is configured.')
    },
    hotels:{
      'SEARCH':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,staysConfigured?readyLive:'Duffel Stays access/credential is not configured.'),
      'LIVE DATA':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,staysConfigured?'Real hotel inventory must be verified from the authorized runtime.':'No verified hotel inventory provider is configured.'),
      'FILTERS':capability(CAPABILITY_STATES.READY_FOR_PROVIDER,'Normalization and value analysis exist; verified inventory is required.'),
      'DETAILS':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,'Accommodation/rate normalization exists.'),
      'REVALIDATION':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,'Quote endpoint exists; live verification required.'),
      'BOOKING':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,'Provider booking adapter exists; authoritative confirmation required.'),
      'PAYMENT':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,'Payment details may only traverse an authorized provider payment boundary.'),
      'CONFIRMATION':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,'Unknown outcomes remain unknown until reconciled.'),
      'CANCELLATION':capability(CAPABILITY_STATES.BLOCKED,'Provider-specific cancellation workflow is not wired.'),
      'REFUND':capability(CAPABILITY_STATES.BLOCKED,'Provider-specific refund workflow is not wired.'),
      'TRIP RETRIEVAL':capability(staysConfigured?CAPABILITY_STATES.READY_FOR_PROVIDER:CAPABILITY_STATES.BLOCKED,'Trip persistence exists; provider retrieval is not yet wired.'),
      'TRACKING':capability(CAPABILITY_STATES.NOT_SUPPORTED,'Hotel stay tracking is not a defined live capability.')
    },
    buses:Object.fromEntries(DOMAIN_CAPABILITIES.map(k=>[k,capability(CAPABILITY_STATES.BLOCKED,'No verified bus inventory provider is configured; no schedule, seat or fare data is fabricated.')])),
    rail:Object.fromEntries(DOMAIN_CAPABILITIES.map(k=>[k,capability(k==='TRACKING'?CAPABILITY_STATES.NOT_SUPPORTED:CAPABILITY_STATES.BLOCKED,k==='TRACKING'?'Rail tracking is not a defined live capability without a verified operator feed.':'No verified rail inventory provider is configured; no schedule, availability or fare data is fabricated.')]))
  };
}

function canTransition(from,to){return BOOKING_STATES.includes(from)&&BOOKING_STATES.includes(to)&&(TRANSITIONS[from]||[]).includes(to);}
function transitionBooking(state,to,meta={}){const from=String(state||'').toUpperCase(),next=String(to||'').toUpperCase();if(!canTransition(from,next)){const error=new Error(`Invalid booking transition: ${from} -> ${next}`);error.code='invalid_booking_transition';error.status=409;throw error;}return{from,to:next,at:new Date().toISOString(),reason:String(meta.reason||''),requestId:String(meta.requestId||'')};}
function createBookingState(seed='SEARCHED',meta={}){const state=String(seed||'SEARCHED').toUpperCase();if(!BOOKING_STATES.includes(state))throw new Error('Invalid booking state');return{state,history:[{state,at:new Date().toISOString(),requestId:String(meta.requestId||'')}],paymentState:PAYMENT_STATES[0]};}
function applyBookingTransition(record,to,meta={}){if(!record||!BOOKING_STATES.includes(String(record.state||'')))throw new Error('Invalid booking record');const event=transitionBooking(record.state,to,meta);return{...record,state:event.to,history:[...(Array.isArray(record.history)?record.history:[]),{state:event.to,at:event.at,reason:event.reason,requestId:event.requestId}]};}
function demoModeEnabled(env=process.env){return String(env.TRAVEL_DEMO_MODE||'').toLowerCase()==='true'&&String(env.TRAVEL_ENVIRONMENT||'').toLowerCase()!=='production';}
function demoLabel(){return'DEMO / TEST DATA';}
function redactTelemetry(value){const input=value&&typeof value==='object'?value:{};return{requestId:String(input.requestId||''),provider:String(input.provider||''),capability:String(input.capability||''),latencyMs:Number.isFinite(Number(input.latencyMs))?Number(input.latencyMs):null,status:String(input.status||''),errorClass:String(input.errorClass||''),retryCount:Number.isInteger(input.retryCount)?input.retryCount:0,bookingState:String(input.bookingState||''),availabilityFailure:Boolean(input.availabilityFailure),priceChange:Boolean(input.priceChange),timeout:Boolean(input.timeout)};}
module.exports={TRAVEL_DOMAINS,CAPABILITY_STATES,BOOKING_STATES,PAYMENT_STATES,DOMAIN_CAPABILITIES,TRANSITIONS,buildCapabilityMatrix,canTransition,transitionBooking,createBookingState,applyBookingTransition,demoModeEnabled,demoLabel,redactTelemetry};
