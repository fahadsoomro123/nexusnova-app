const TRAVELPORT_DEFAULT_PREPROD='https://api.pp.travelport.net/11/air';
const TRAVELPORT_DEFAULT_PROD='https://api.travelport.net/11/air';
const TOKEN_PREPROD='https://auth.pp.travelport.net/oauth/token';
const TOKEN_PROD='https://auth.travelport.net/oauth/token';

class TravelportError extends Error{
  constructor(code,message,status=502){super(message);this.name='TravelportError';this.code=code;this.status=status;}
}

function cfg(env=process.env){
  const environment=String(env.TRAVELPORT_ENVIRONMENT||'preprod').toLowerCase()==='production'?'production':'preprod';
  const configured=['TRAVELPORT_CLIENT_ID','TRAVELPORT_CLIENT_SECRET','TRAVELPORT_ACCESS_GROUP'].every(k=>String(env[k]||'').trim());
  return {environment,configured,baseUrl:String(env.TRAVELPORT_AIR_BASE_URL||(environment==='production'?TRAVELPORT_DEFAULT_PROD:TRAVELPORT_DEFAULT_PREPROD)).replace(/\/$/,''),tokenUrl:String(env.TRAVELPORT_TOKEN_URL||(environment==='production'?TOKEN_PROD:TOKEN_PREPROD))};
}

let tokenCache={token:'',expiresAt:0,scope:''};
async function token(env=process.env){
  const c=cfg(env); if(!c.configured)throw new TravelportError('provider_auth','Travelport credentials are not configured.',503);
  if(tokenCache.token&&Date.now()<tokenCache.expiresAt)return tokenCache.token;
  const body=new URLSearchParams({grant_type:'client_credentials',client_id:String(env.TRAVELPORT_CLIENT_ID),client_secret:String(env.TRAVELPORT_CLIENT_SECRET)});
  const response=await fetch(c.tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body,signal:AbortSignal.timeout(15000)}).catch(()=>{throw new TravelportError('provider_timeout','Travelport authentication timed out.',504)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.access_token)throw new TravelportError(response.status===401?'provider_auth':'provider_error','Travelport authentication failed.',502);
  tokenCache={token:String(data.access_token),expiresAt:Date.now()+Math.max(60,Number(data.expires_in||86400)-300)*1000,scope:String(data.scope||'')};
  return tokenCache.token;
}

function passengers(adults,children,childAges=[]){
  const out=[]; for(let i=0;i<adults;i++)out.push({'@type':'PassengerCriteria',number:i+1,passengerTypeCode:'ADT'});
  for(let i=0;i<children;i++)out.push({'@type':'PassengerCriteria',number:adults+i+1,age:Number(childAges[i]),passengerTypeCode:'CNN'});
  return out;
}
function payload(input){
  const legs=[{'@type':'SearchCriteriaFlight',departureDate:input.departure,From:{value:input.origin},To:{value:input.destination}}];
  if(input.tripType==='roundtrip')legs.push({'@type':'SearchCriteriaFlight',departureDate:input.returnDate,From:{value:input.destination},To:{value:input.origin}});
  return {'@type':'CatalogProductOfferingsQueryRequest',CatalogProductOfferingsRequest:{'@type':'CatalogProductOfferingsRequestAir',maxNumberOfUpsellsToReturn:3,offersPerPage:50,contentSourceList:['GDS'],PassengerCriteria:passengers(input.adults||1,input.children||0,input.childAges||[]),SearchCriteriaFlight:legs}};
}

function refIndex(data){
  const index=new Map(); for(const list of(data?.CatalogProductOfferingsResponse?.ReferenceList||[]))for(const item of(Array.isArray(list)?list:[list]))if(item?.id)index.set(String(item.id),item); return index;
}
function money(offering){
  const candidates=[offering?.TotalPrice,offering?.Price,offering?.BestCombinablePrice,offering?.termsAndConditions?.TotalPrice];
  for(const v of candidates){const n=Number(v?.value??v?.amount??v);if(Number.isFinite(n))return{amount:n,currency:String(v?.currencyCode||v?.currency||'').trim()||null};}
  return null;
}
function normalize(data){
  const root=data?.CatalogProductOfferingsResponse||{}; const cpo=root.CatalogProductOfferings||{}; const refs=refIndex(data); const offerings=Array.isArray(cpo.CatalogProductOffering)?cpo.CatalogProductOffering:[]; const results=[];
  for(const offer of offerings){
    const price=money(offer); const segments=[]; const products=Array.isArray(offer.ProductOptions)?offer.ProductOptions:[];
    for(const po of products)for(const product of(po.Product||[]))for(const ref of(product.flightRefs||product.FlightRefs||[])){const s=refs.get(String(ref));if(s)segments.push(s);}
    const unique=segments.filter((s,i,a)=>a.findIndex(x=>String(x.id)===String(s.id))===i);
    const carrier=unique.find(s=>s.carrier)?String(unique.find(s=>s.carrier).carrier):'';
    results.push({id:String(offer.id||''),provider:'Travelport',airline:carrier||null,flightNumber:unique.find(s=>s.flightNumber)?.flightNumber||null,departure:unique[0]?.departure||null,arrival:unique[unique.length-1]?.arrival||null,duration:null,stops:Math.max(0,unique.length-1),baggage:null,price:price?.amount??null,currency:price?.currency||null,rawRef:String(offer.id||'')});
  }
  return {provider:'Travelport',live:true,results,providerFacts:{transactionId:String(root.transactionId||''),correlationId:String(root.correlationId||''),reservationStatus:String(root.reservationStatus||'')}};
}

function createTravelportProvider(env=process.env){const c=cfg(env);if(!c.configured)return null;return {name:'travelport',capabilities:{search:true,revalidate:false,book:false,payment:false},async searchFlights(input){const access=await token(env);const trace=`nx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;const response=await fetch(`${c.baseUrl}/catalog/search/catalogproductofferings`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json',Accept:'application/json',TraceId:trace,'XAUTH_TRAVELPORT_ACCESSGROUP':String(env.TRAVELPORT_ACCESS_GROUP)},body:JSON.stringify(payload(input)),signal:AbortSignal.timeout(30000)}).catch(()=>{throw new TravelportError('provider_timeout','Travelport flight search timed out.',504)});const data=await response.json().catch(()=>null);if(!response.ok)throw new TravelportError(response.status===401||response.status===403?'provider_auth':'provider_error','Travelport flight search failed.',response.status===401||response.status===403?502:502);return normalize(data);}}}

module.exports={TravelportError,cfg,payload,normalize,createTravelportProvider};
