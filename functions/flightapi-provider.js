const FLIGHTAPI_BASE='https://api.flightapi.io';
class FlightApiError extends Error{constructor(code,message,status=503){super(message);this.name='FlightApiError';this.code=code;this.status=status}}
const clean=(v,max=120)=>String(v??'').trim().slice(0,max);
const isoDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s);
function normalizeItineraryRows(payload){
  const data=payload?.itineraries||payload?.data?.itineraries||payload?.data||[];
  const rows=Array.isArray(data)?data:[];
  return rows.map((itinerary,index)=>{
    const legs=Array.isArray(itinerary?.legs)?itinerary.legs:[];
    const leg=legs[0]||{};
    const segments=Array.isArray(leg?.segments)?leg.segments:[];
    const first=segments[0]||{};
    const last=segments[segments.length-1]||first;
    const price=itinerary?.price||itinerary?.pricing||itinerary?.fare||{};
    const amount=Number(price?.total??price?.amount??itinerary?.price?.raw??itinerary?.price);
    const carrier=itinerary?.carriers?.[0]||itinerary?.carrier||first?.carrier||{};
    const stops=Math.max(0,segments.length-1);
    const dep=first?.departureTime?.utc||first?.departureTime?.local||first?.departure||leg?.departureTime?.utc||leg?.departureTime?.local||'';
    const arr=last?.arrivalTime?.utc||last?.arrivalTime?.local||last?.arrival||leg?.arrivalTime?.utc||leg?.arrivalTime?.local||'';
    return {id:clean(itinerary?.id||itinerary?.key||`flightapi-${index}`,120),price:Number.isFinite(amount)?amount:null,currency:clean(price?.currency||itinerary?.currency||'',3),airline:clean(carrier?.name||carrier?.short||''),flightNumber:clean(first?.flightNumber||first?.flight?.number||''),departure:clean(dep,64),arrival:clean(arr,64),originCode:clean(first?.departureAirport?.iata||first?.origin?.iata||leg?.departureAirport?.iata||'',3),destinationCode:clean(last?.arrivalAirport?.iata||last?.destination?.iata||leg?.arrivalAirport?.iata||'',3),durationMinutes:Number.isFinite(Number(leg?.durationMinutes))?Number(leg.durationMinutes):null,stops,bookingUrl:typeof itinerary?.deepLink==='string'?itinerary.deepLink:'',provider:'FlightAPI',liveMode:true,metadata:{source:'FlightAPI'}};
  }).filter(row=>row.originCode&&row.destinationCode);
}
class FlightAPIAdapter{
  constructor(apiKey){this.apiKey=clean(apiKey,512)}
  get available(){return Boolean(this.apiKey)}
  async request(endpoint,params={}){if(!this.available)throw new FlightApiError('provider_unavailable','FlightAPI is not configured.');const url=new URL(`${FLIGHTAPI_BASE}${endpoint}`);url.searchParams.set('api_key',this.apiKey);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{throw new FlightApiError('provider_malformed','FlightAPI returned malformed JSON.',502)}if(!r.ok){if(r.status===401||r.status===403)throw new FlightApiError('provider_auth','FlightAPI authentication failed.',502);if(r.status===429)throw new FlightApiError('provider_rate_limit','FlightAPI rate limit reached.',429);throw new FlightApiError('provider_error','FlightAPI returned an error.',502)}return data}catch(e){if(e instanceof FlightApiError)throw e;if(e?.name==='AbortError')throw new FlightApiError('provider_timeout','FlightAPI request timed out.',504);throw new FlightApiError('provider_unavailable','FlightAPI could not be reached.',503)}finally{clearTimeout(timer)}}
  async searchFlights(input){const base={departure_airport_code:input.origin,arrival_airport_code:input.destination,departure_date:input.departure,number_of_adults:input.adults,number_of_childrens:input.children,number_of_infants:input.infants||0,cabin_class:input.cabin==='premium_economy'?'Premium_Economy':input.cabin[0].toUpperCase()+input.cabin.slice(1),currency:input.currency,region:input.region||'PK'};const endpoint=input.tripType==='roundtrip'?'/roundtrip':'/onewaytrip';if(input.tripType==='roundtrip')base.arrival_date=input.returnDate;const payload=await this.request(endpoint,base);return{provider:'FlightAPI',live:true,requestId:clean(payload?.requestId||payload?.id||'',120),results:normalizeItineraryRows(payload)}}
  async trackFlight(input){const num=clean(input.number,16),name=clean(input.airline,8),date=clean(input.date,8);if(!num||!name||!/^\d{8}$/.test(date))throw new FlightApiError('invalid_request','Flight tracking requires flight number, airline code and YYYYMMDD date.',400);return this.request('/airline',{num,name,date,depap:clean(input.departureAirport,3)}).then(payload=>({provider:'FlightAPI',live:true,data:payload}))}
  async trackRoute(input){return this.request('/trackbyroute',{date:clean(input.date,8),airport1:clean(input.airport1,3),airport2:clean(input.airport2,3)}).then(payload=>({provider:'FlightAPI',live:true,data:payload}))}
  async airportSchedule(input){return this.request('/schedule',{mode:clean(input.mode,12),day:clean(input.day,2),iata:clean(input.iata,3),page:clean(input.page,8)}).then(payload=>({provider:'FlightAPI',live:true,data:payload}))}
  async iataSearch(input){return this.request('/iata',{name:clean(input.name,80),type:clean(input.type,12)}).then(payload=>({provider:'FlightAPI',live:true,data:payload}))}
}
function createFlightApiProvider(env=process.env){return env.FLIGHTAPI_API_KEY?new FlightAPIAdapter(env.FLIGHTAPI_API_KEY):null}
module.exports={FlightAPIAdapter,FlightApiError,createFlightApiProvider,normalizeItineraryRows};
