const STORAGE_KEY='nexusnova.travel.context.v1';
const CONTEXT_VERSION=1;
const COUNTRY_ROUTES=Object.freeze({
  PK:{label:'Pakistan',origin:'KHI',destination:'ISB'},
  AE:{label:'UAE',origin:'DXB',destination:'AUH'},
  GB:{label:'United Kingdom',origin:'LHR',destination:'MAN'},
  TR:{label:'Türkiye',origin:'IST',destination:'ESB'},
  SA:{label:'Saudi Arabia',origin:'RUH',destination:'JED'},
  US:{label:'United States',origin:'JFK',destination:'LAX'},
  IN:{label:'India',origin:'DEL',destination:'BOM'}
});
const REGION_ALIASES=Object.freeze({UK:'GB',UKA:'GB',EN:'',AR:'',TR:'TR',PK:'PK',AE:'AE',SA:'SA',US:'US',IN:'IN'});
const clean=s=>String(s||'').trim().toUpperCase();
function readStore(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return x&&x.v===CONTEXT_VERSION?x:{};}catch{return{};}}
function writeStore(v){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...v,v:CONTEXT_VERSION}));}catch{}}
function configuredCountry(){
  const candidates=[
    globalThis.NexusNovaContext?.country,
    globalThis.NexusNovaDeviceContext?.country,
    globalThis.NexusNovaTravelConfig?.country,
    globalThis.NexusNovaTravelConfig?.region
  ];
  for(const c of candidates){const code=clean(c);if(COUNTRY_ROUTES[code])return{code,confidence:'high',method:'app/device context'};}
  return null;
}
function localeCountry(){
  const locales=[navigator.language,...(navigator.languages||[])].filter(Boolean);
  for(const locale of locales){
    const m=String(locale).match(/[-_]([A-Za-z]{2}|[0-9]{3})$/);const code=m?clean(m[1]):'';
    if(COUNTRY_ROUTES[code])return{code,confidence:'medium',method:'browser locale'};
  }
  return null;
}
function serverCountry(){
  const endpoint=String(globalThis.NexusNovaTravelConfig?.contextEndpoint||'').trim();
  return endpoint&&/^https?:\/\//.test(endpoint)?fetch(endpoint,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}}).then(async r=>{if(!r.ok)return null;const x=await r.json();const code=clean(x?.country||x?.region);return COUNTRY_ROUTES[code]?{code,confidence:'medium',method:'server context'}:null;}).catch(()=>null):Promise.resolve(null);
}
async function grantedLocationContext(){
  try{
    if(!navigator.permissions?.query||!navigator.geolocation)return null;
    const p=await navigator.permissions.query({name:'geolocation'});
    if(p.state!=='granted')return null;
    const preset=globalThis.NexusNovaGeoContext?.country||globalThis.NexusNovaDeviceContext?.country;
    const code=clean(preset);return COUNTRY_ROUTES[code]?{code,confidence:'medium',method:'previously granted device context'}:null;
  }catch{return null;}
}
async function detectCountry(){
  return configuredCountry()||localeCountry()||await serverCountry()||await grantedLocationContext();
}
function airportData(body){
  return [...body.querySelectorAll('.nxf-end')].map((el,index)=>({el,index,text:el.textContent.trim()}));
}
function currentCode(el){const m=String(el?.textContent||'').match(/\b[A-Z]{3}\b/);return m?m[0]:'';}
function endpoint(root,index){return root.querySelectorAll('.nxf-end')[index]||null;}
function routePanel(body){return body.querySelector('.nxf-route')?.closest('.nxf-panel')||body.querySelector('.nxf-route')?.parentElement||body.firstElementChild;}
function smartCard(body){return body.querySelector('[data-smart-travel-context]');}
function renderCard(body,ctx,status='smart'){
  const route=COUNTRY_ROUTES[ctx.code];if(!route)return;
  const host=routePanel(body);if(!host)return;
  const existing=smartCard(body);if(existing)existing.remove();
  const el=document.createElement('aside');el.dataset.smartTravelContext='1';el.className='nxf-smart-context';
  const title=status==='prompt'?`Travel context changed to ${ctx.label}.`:`${ctx.label} detected`;
  const action=status==='prompt'?`<div class="nxf-smart-actions"><button type="button" data-smart-use>Use suggestion</button><button type="button" class="secondary" data-smart-keep>Keep current</button></div>`:'';
  el.innerHTML=`<div class="nxf-smart-kicker">✈ SMART TRAVEL CONTEXT</div><b>${title}</b><span>${status==='prompt'?'Use the local suggestion without changing your existing route.':'Smart default · ${route.origin} → ${route.destination}'}</span>${action}`;
  host.insertAdjacentElement('afterend',el);
  return el;
}
async function chooseAirport(body,index,code,silent=true){
  const btn=endpoint(body,index);if(!btn)return false;
  const root=body.closest('.nx-screen')||body;btn.scrollIntoView?.({block:'nearest'});globalThis.__nxSmartTravelApplying=!!silent;btn.click();
  for(let i=0;i<20;i++){
    const pick=root.querySelector(`.nxf-picker [data-code="${code}"]`);
    if(pick){pick.click();await new Promise(r=>setTimeout(r,20));globalThis.__nxSmartTravelApplying=false;return true;}
    await new Promise(r=>setTimeout(r,25));
  }
  globalThis.__nxSmartTravelApplying=false;return false;
}
async function applySuggestion(body,ctx){
  const route=COUNTRY_ROUTES[ctx.code];if(!route)return false;
  let ok=await chooseAirport(body,0,route.origin,true);
  if(!ok)return false;
  await new Promise(r=>setTimeout(r,30));
  ok=await chooseAirport(body,1,route.destination,true);
  if(ok){const now=readStore();writeStore({lastCountry:ctx.code,origin:route.origin,destination:route.destination,manual:false,v:CONTEXT_VERSION});renderCard(body,ctx,'smart');}
  return ok;
}
function rememberManualRoute(body,ctx){
  if(globalThis.__nxSmartTravelApplying)return;
  const els=airportData(body);if(els.length<2)return;
  const origin=currentCode(els[0].el),destination=currentCode(els[1].el);
  if(origin&&destination){const now=readStore();writeStore({lastCountry:ctx?.code||now.lastCountry||'',origin,destination,manual:true,v:CONTEXT_VERSION});const c=smartCard(body);if(c)c.querySelector('.nxf-smart-kicker')&&(c.querySelector('.nxf-smart-kicker').textContent='✈ USER SELECTED ROUTE');}
}
async function install(body){
  const country=await detectCountry();
  if(!country||!COUNTRY_ROUTES[country.code])return;
  const saved=readStore();
  const els=airportData(body);const existingOrigin=currentCode(els[0]?.el),existingDestination=currentCode(els[1]?.el);
  const hasExisting=!!(existingOrigin||existingDestination);
  const sameSuggested=existingOrigin===COUNTRY_ROUTES[country.code].origin&&existingDestination===COUNTRY_ROUTES[country.code].destination;
  if(saved.manual&&saved.origin&&saved.destination){
    if(saved.lastCountry&&saved.lastCountry!==country.code){
      const card=renderCard(body,country,'prompt');
      card?.querySelector('[data-smart-use]')?.addEventListener('click',async()=>{card.querySelector('.nxf-smart-actions').textContent='Applying suggestion…';await applySuggestion(body,country);});
      card?.querySelector('[data-smart-keep]')?.addEventListener('click',()=>{writeStore({...saved,lastCountry:country.code});card.remove();});
    }
  } else if(!hasExisting||sameSuggested===false){
    const applied=await applySuggestion(body,country);
    if(!applied)renderCard(body,country,'smart');
  } else renderCard(body,country,'smart');
  const mark=()=>setTimeout(()=>rememberManualRoute(body,country),120);
  body.addEventListener('click',event=>{
    if(globalThis.__nxSmartTravelApplying)return;
    if(event.target.closest('.nxf-end,.nxf-swap'))mark();
  });
  const observer=new MutationObserver(()=>{if(!smartCard(body))renderCard(body,country,'smart');});
  observer.observe(body,{childList:true,subtree:true});
  body.__smartTravelCleanup=()=>observer.disconnect();
}
export async function enhanceSmartTravelContext(id,body){
  if(id!=='travel'||!body)return;
  if(!body.querySelector('.nxf-route'))return;
  if(body.dataset.smartTravelInstalled==='1')return;
  body.dataset.smartTravelInstalled='1';
  await install(body);
}
