const DUFFEL_API='https://api.duffel.com';
const DUFFEL_VERSION='v2';
const OUR_AIRPORTS='https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';

class ProviderError extends Error{
  constructor(code,message,status=503){super(message);this.name='ProviderError';this.code=code;this.status=status}
}

function isoMinutes(value){
  const m=String(value||'').match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if(!m)return null;
  return (Number(m[1]||0)*60)+(Number(m[2]||0))+(Number(m[3]||0)/60);
}
function safeNumber(value){const n=Number(value);return Number.isFinite(n)?n:null}
function segmentList(offer){return (offer?.slices||[]).flatMap(slice=>Array.isArray(slice?.segments)?slice.segments:[])}
function normalizeDuffelOffer(offer){
  const slices=Array.isArray(offer?.slices)?offer.slices:[];
  const segments=segmentList(offer);
  const first=segments[0],last=segments[segments.length-1];
  if(!first||!last)return null;
  const duration=sumDuration(slices);
  const stops=Math.max(0,segments.length-slices.length);
  const firstOrigin=first.departing_at?first.origin:null;
  const lastDestination=last.arriving_at?last.destination:null;
  const carrier=first.operating_carrier||first.marketing_carrier||{};
  const conditions=offer.conditions||{};
  const flexible=conditions.change_before_departure?.allowed===true;
  return {
    id:String(offer.id||''),
    price:safeNumber(offer.total_amount),
    currency:String(offer.total_currency||''),
    airline:String(carrier.name||''),
    flightNumber:String(first.marketing_carrier_flight_number||first.operating_carrier_flight_number||''),
    departure:String(first.departing_at||''),
    arrival:String(last.arriving_at||''),
    originCode:String(firstOrigin?.iata_code||''),
    destinationCode:String(lastDestination?.iata_code||''),
    durationMinutes:duration,
    stops,
    baggage:null,
    checkedBags:null,
    flexible,
    flexibility:flexible?'Changes permitted before departure':'Fare conditions apply',
    familyFriendly:null,
    provider:'Duffel',
    liveMode:offer.live_mode===true,
    expiresAt:String(offer.expires_at||''),
    lastUpdated:String(offer.updated_at||''),
    bookingUrl:typeof offer.booking_url==='string'?offer.booking_url:''
  };
}
function sumDuration(slices){
  let total=0;
  for(const slice of slices){
    const segments=Array.isArray(slice?.segments)?slice.segments:[];
    for(const segment of segments){const mins=isoMinutes(segment?.duration);if(mins!=null)total+=mins;}
  }
  return total||null;
}

class DuffelAdapter{
  constructor(token){this.token=String(token||'').trim()}
  get available(){return Boolean(this.token)}
  async request(path,{method='GET',body,timeoutMs=25000}={}){
    if(!this.available)throw new ProviderError('provider_unavailable','Live flight pricing requires provider availability.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(`${DUFFEL_API}${path}`,{
        method,signal:controller.signal,
        headers:{Accept:'application/json','Content-Type':'application/json','Duffel-Version':DUFFEL_VERSION,Authorization:`Bearer ${this.token}`},
        body:body===undefined?undefined:JSON.stringify(body)
      });
      const text=await response.text();
      let payload=null;try{payload=text?JSON.parse(text):null}catch{}
      if(!response.ok){
        if(response.status===401||response.status===403)throw new ProviderError('provider_auth','Travel provider authentication failed.',502);
        if(response.status===429)throw new ProviderError('provider_rate_limit','Travel provider rate limit reached.',429);
        throw new ProviderError('provider_error','Travel provider returned an error.',502);
      }
      return payload;
    }catch(error){
      if(error instanceof ProviderError)throw error;
      if(error?.name==='AbortError')throw new ProviderError('provider_timeout','Travel provider request timed out.',504);
      throw new ProviderError('provider_unavailable','Travel provider could not be reached.',503);
    }finally{clearTimeout(timer)}
  }
  async searchFlights(input){
    const data={
      slices:[{origin:input.origin,destination:input.destination,departure_date:input.departure}],
      passengers:[...Array(input.adults)].map(()=>({type:'adult'})).concat([...Array(input.children)].map(()=>({type:'child'}))),
      cabin_class:input.cabin,
      max_connections:3
    };
    if(input.tripType==='roundtrip'&&input.returnDate)data.slices.push({origin:input.destination,destination:input.origin,departure_date:input.returnDate});
    const payload=await this.request('/air/offer_requests?return_offers=true&supplier_timeout=12000&view=offers',{method:'POST',body:{data}});
    const offers=(payload?.data?.offers||[]).map(normalizeDuffelOffer).filter(Boolean);
    return {provider:'Duffel',live:true,requestId:String(payload?.data?.id||''),results:offers};
  }
  async getOffer(id){
    if(!/^off_[A-Za-z0-9]+$/.test(String(id||'')))throw new ProviderError('invalid_offer','Invalid offer identifier.',400);
    const payload=await this.request(`/air/offers/${encodeURIComponent(id)}?return_available_services=true`);
    return normalizeDuffelOffer(payload?.data)||null;
  }
  async fareCalendar(input){
    const start=new Date(`${input.from}T00:00:00Z`);
    if(!Number.isFinite(start.getTime()))throw new ProviderError('invalid_date','Invalid fare-calendar start date.',400);
    const dates=[-2,-1,0,1,2].map(offset=>new Date(start.getTime()+offset*86400000).toISOString().slice(0,10));
    const calendar=[];
    for(const date of dates){
      try{
        const result=await this.searchFlights({...input,departure:date,tripType:'oneway',returnDate:''});
        const prices=result.results.map(x=>x.price).filter(v=>v!=null);
        if(prices.length)calendar.push({date,fare:Math.min(...prices),currency:result.results.find(x=>x.currency)?.currency||input.currency});
      }catch(error){
        if(error.code==='provider_auth'||error.code==='provider_rate_limit')throw error;
      }
    }
    return {provider:'Duffel',live:true,calendar};
  }
}

function createFlightProvider(env=process.env){
  const name=String(env.TRAVEL_PROVIDER||'duffel').trim().toLowerCase();
  if(name==='duffel'&&env.DUFFEL_ACCESS_TOKEN)return new DuffelAdapter(env.DUFFEL_ACCESS_TOKEN);
  return null;
}

let airportCache={expiresAt:0,rows:[]};
function parseCsvRow(line){
  const cells=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted;continue}
    if(ch===','&&!quoted){cells.push(value);value='';continue}
    value+=ch;
  }
  cells.push(value);return cells;
}
async function keylessAirportSearch(query,{limit=12}={}){
  const q=String(query||'').trim().toLowerCase();
  if(q.length<2)return [];
  const now=Date.now();
  if(now>=airportCache.expiresAt){
    const response=await fetch(OUR_AIRPORTS,{cache:'no-store'});
    if(!response.ok)throw new ProviderError('airport_data_unavailable','Public airport directory is temporarily unavailable.',503);
    const text=await response.text();
    const lines=text.split(/\r?\n/);
    const header=parseCsvRow(lines.shift()||'');
    const index=new Map(header.map((v,i)=>[v,i]));
    const rows=[];
    for(const line of lines){
      if(!line)continue;
      const cells=parseCsvRow(line),iata=cells[index.get('iata_code')||-1],ident=cells[index.get('ident')||-1];
      const type=cells[index.get('type')||-1]||'';
      if(!iata&& !ident)continue;
      if(type.includes('closed'))continue;
      rows.push({code:(iata||ident).toUpperCase(),iata:iata?String(iata).toUpperCase():'',city:String(cells[index.get('municipality')||-1]||''),airport:String(cells[index.get('name')||-1]||''),country:String(cells[index.get('iso_country')||-1]||''),type});
    }
    airportCache={expiresAt:now+6*60*60*1000,rows:rows.filter(x=>x.iata)};
  }
  const scored=[];
  for(const row of airportCache.rows){
    const hay=`${row.iata} ${row.city} ${row.airport} ${row.country}`.toLowerCase();
    const at=hay.indexOf(q);if(at<0)continue;
    const score=(row.iata===q?0:0)+(row.city.toLowerCase().startsWith(q)?5:0)+(row.airport.toLowerCase().startsWith(q)?4:0)+Math.min(at,50)/100;
    scored.push({score,row});
  }
  return scored.sort((a,b)=>a.score-b.score).slice(0,limit).map(x=>x.row);
}

module.exports={DuffelAdapter,ProviderError,createFlightProvider,keylessAirportSearch,normalizeDuffelOffer,isoMinutes};
