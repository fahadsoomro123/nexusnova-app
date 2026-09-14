const {onRequest}=require('firebase-functions/v2/https');
const {ProviderError,createFlightProvider,keylessAirportSearch}=require('./travel-provider');

const MAX_BODY=8192;
const MAX_Q=80;
function json(res,status,payload){res.status(status).set('Cache-Control','no-store').json(payload)}
function readBody(req){const raw=JSON.stringify(req.body||{});if(raw.length>MAX_BODY)throw new ProviderError('invalid_request','Request is too large.',413);return req.body&&typeof req.body==='object'?req.body:{} }
function text(value,max=MAX_Q){const s=String(value??'').trim();if(!s||s.length>max)throw new ProviderError('invalid_request','Invalid request.',400);return s}
function code(value){const s=text(value,3).toUpperCase();if(!/^[A-Z]{3}$/.test(s))throw new ProviderError('invalid_request','Invalid airport code.',400);return s}
function date(value){const s=text(value,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new ProviderError('invalid_request','Invalid date.',400);return s}
function positiveInt(value,defaultValue,max){const n=value===undefined?defaultValue:Number(value);if(!Number.isInteger(n)||n<0||n>max)throw new ProviderError('invalid_request','Invalid passenger count.',400);return n}
function cabin(value){const map={Economy:'economy','Premium Economy':'premium_economy',Business:'business',First:'first',economy:'economy',premium_economy:'premium_economy',business:'business',first:'first'};const v=map[String(value||'')];if(!v)throw new ProviderError('invalid_request','Invalid cabin class.',400);return v}
function providerOrFail(){const provider=createFlightProvider();if(!provider)throw new ProviderError('provider_unavailable','Live flight pricing requires provider availability.',503);return provider}
function handlerError(res,error){if(error instanceof ProviderError)return json(res,error.status,{code:error.code,message:error.message});return json(res,500,{code:'internal_error',message:'Travel service could not complete the request.'})}
function travelPath(req){const raw=String(req.path||req.url||'').split('?')[0];return raw.replace(/^\/api\/travel/,'')||'/'}

exports.travelApi=onRequest({timeoutSeconds:60,memory:'256MiB'},async(req,res)=>{
  res.set('X-Content-Type-Options','nosniff');
  res.set('Referrer-Policy','no-referrer');
  res.set('X-Frame-Options','DENY');
  try{
    const path=travelPath(req);
    if(path==='/capabilities'&&req.method==='GET'){
      const flight=createFlightProvider();
      return json(res,200,{flights:{live:Boolean(flight),provider:flight?'Duffel':null},airports:{publicDirectory:true,source:'OurAirports'}});
    }
    if(path==='/airports/search'&&req.method==='GET'){
      const q=text(req.query?.q,80);const rows=await keylessAirportSearch(q,{limit:12});return json(res,200,{provider:'OurAirports',keyless:true,results:rows});
    }
    if(path==='/flights/search'&&req.method==='POST'){
      const b=readBody(req);const origin=code(b.origin),destination=code(b.destination);if(origin===destination)throw new ProviderError('invalid_request','Origin and destination must differ.',400);
      const departure=date(b.departure);const tripType=b.tripType==='oneway'?'oneway':'roundtrip';const returnDate=tripType==='roundtrip'?date(b.returnDate):'';
      if(departure<new Date().toISOString().slice(0,10))throw new ProviderError('invalid_request','Departure date is in the past.',400);
      if(tripType==='roundtrip'&&returnDate<=departure)throw new ProviderError('invalid_request','Return date must be after departure.',400);
      const adults=positiveInt(b.adults,1,9)||1,children=positiveInt(b.children,0,8),provider=providerOrFail();
      const childAges=Array.isArray(b.childrenAges)?b.childrenAges.map(Number):[];
      if(childAges.length!==children||childAges.some(age=>!Number.isInteger(age)||age<2||age>17))throw new ProviderError('child_age_required','Enter a valid age (2–17) for every child before live flight search.',400);
      const result=await provider.searchFlights({origin,destination,departure,returnDate,tripType,adults,children,cabin:cabin(b.cabin),currency:text(b.currency||'PKR',3),childAges});
      return json(res,200,result);
    }
    if(path==='/flights/calendar'&&req.method==='GET'){
      const provider=providerOrFail();
      const result=await provider.fareCalendar({origin:code(req.query?.origin),destination:code(req.query?.destination),from:date(req.query?.from),tripType:'oneway',returnDate:'',adults:1,children:0,childAges:[],cabin:'economy',currency:String(req.query?.currency||'PKR').slice(0,3)});
      return json(res,200,result);
    }
    if(path==='/flights/offer'&&req.method==='GET'){
      const provider=providerOrFail();const offerId=text(req.query?.id,64);const offer=await provider.getOffer(offerId);if(!offer)return json(res,404,{code:'offer_not_found',message:'Offer is no longer available.'});return json(res,200,{provider:'Duffel',offer});
    }
    if(path==='/flights/track'&&req.method==='GET'){
      return json(res,503,{code:'provider_unavailable',message:'Live flight status requires a configured status provider. NexusNova will not guess a status.'});
    }
    if(['/buses/search','/trains/search','/hotels/search'].includes(path)&&req.method==='POST'){
      return json(res,503,{code:'provider_unavailable',message:'This travel category has no verified inventory provider configured.'});
    }
    return json(res,404,{code:'not_found',message:'Travel endpoint not found.'});
  }catch(error){return handlerError(res,error)}
});
