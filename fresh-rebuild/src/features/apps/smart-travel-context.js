const STORAGE_KEY='nexusnova.smartTravelContext.v1';
const CONTEXT_EVENT='nexusnova:travel-context-updated';

const ROUTES=Object.freeze({
  PK:Object.freeze({country:'Pakistan',origin:'KHI',destination:'ISB',label:'Suggested for Pakistan'}),
  AE:Object.freeze({country:'UAE',origin:'DXB',destination:'AUH',label:'Suggested for UAE'}),
  GB:Object.freeze({country:'UK',origin:'LHR',destination:'MAN',label:'Suggested for UK'}),
  TR:Object.freeze({country:'Türkiye',origin:'IST',destination:'ESB',label:'Suggested for Türkiye'}),
  SA:Object.freeze({country:'Saudi Arabia',origin:'RUH',destination:'JED',label:'Suggested for Saudi Arabia'}),
  US:Object.freeze({country:'USA',origin:'JFK',destination:'LAX',label:'Suggested for USA'}),
  IN:Object.freeze({country:'India',origin:'DEL',destination:'BOM',label:'Suggested for India'})
});

const esc=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function readState(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}}catch{return{}}
}
function writeState(patch){
  const next={...readState(),...patch,updatedAt:Date.now()};
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{}
  try{window.dispatchEvent(new CustomEvent(CONTEXT_EVENT,{detail:next}))}catch{}
  return next;
}

function normalizeCountry(value){
  const v=String(value||'').trim().toUpperCase();
  if(ROUTES[v])return v;
  const aliases={UAE:'AE','EMIRATES':'AE','UNITED ARAB EMIRATES':'AE','UK':'GB','UNITED KINGDOM':'GB','TURKEY':'TR','TÜRKIYE':'TR','TURKIYE':'TR','SAUDI ARABIA':'SA','USA':'US','UNITED STATES':'US','INDIA':'IN','PAKISTAN':'PK'};
  return aliases[v]||'';
}

function detectLocaleCountry(){
  const locales=[navigator.language,...(Array.isArray(navigator.languages)?navigator.languages:[])].filter(Boolean);
  for(const locale of locales){
    const match=String(locale).match(/[-_]([A-Za-z]{2}|\d{3})$/);
    const code=normalizeCountry(match?.[1]||'');
    if(code)return{country:code,source:'browser-locale',confidence:'medium'};
  }
  return null;
}

function detectContextCountry(){
  const candidates=[
    globalThis.NexusNovaTravelContext?.country,
    globalThis.NexusNovaAppContext?.country,
    globalThis.NexusNovaDeviceContext?.country,
    globalThis.NexusNovaGeoContext?.country
  ];
  for(const candidate of candidates){
    const country=normalizeCountry(candidate);
    if(country)return{country,source:'app-device-context',confidence:'high'};
  }
  return null;
}

async function detectGrantedGeoCountry(){
  if(!navigator.permissions?.query)return null;
  try{
    const permission=await navigator.permissions.query({name:'geolocation'});
    if(permission.state!=='granted')return null;
    const country=normalizeCountry(globalThis.NexusNovaGeoContext?.country);
    return country?{country,source:'granted-device-context',confidence:'high'}:null;
  }catch{return null}
}

async function detectCountry(){
  const direct=detectContextCountry();
  if(direct)return direct;
  const locale=detectLocaleCountry();
  const granted=await detectGrantedGeoCountry();
  if(granted)return granted;
  return locale||{country:'',source:'unknown',confidence:'low'};
}

function findEnds(root){
  return [...root.querySelectorAll('.nxf-end')].slice(0,2);
}

function waitForPicker(root,code){
  return new Promise(resolve=>{
    const started=Date.now();
    const tick=()=>{
      const button=root.querySelector(`.nxf-picker [data-code="${code}"]`);
      if(button){button.click();resolve(true);return}
      if(Date.now()-started>1800){resolve(false);return}
      setTimeout(tick,50);
    };
    tick();
  });
}

let applying=false;
async function selectAirport(root,index,code){
  const ends=findEnds(root);
  if(!ends[index])return false;
  applying=true;
  try{
    ends[index].click();
    return await waitForPicker(root,code);
  }finally{
    setTimeout(()=>{applying=false},0);
  }
}

async function applySuggestion(root,route,mode='smart'){
  if(mode==='manual')return false;
  const okOrigin=await selectAirport(root,0,route.origin);
  const okDestination=okOrigin?await selectAirport(root,1,route.destination):false;
  if(!(okOrigin&&okDestination))return false;
  writeState({country:route.country,origin:route.origin,destination:route.destination,selectionMode:'smart',routeKey:`${route.origin}-${route.destination}`});
  return true;
}

function currentRoute(root){
  const ends=findEnds(root);
  return {origin:String(ends[0]?.querySelector('b')?.textContent||'').trim(),destination:String(ends[1]?.querySelector('b')?.textContent||'').trim()};
}

function removeExisting(root){root.querySelector('[data-smart-travel-context]')?.remove()}

function renderContext(root,detected,route,state,{showChangePrompt=false}={}){
  removeExisting(root);
  const host=document.createElement('section');
  host.dataset.smartTravelContext='1';
  host.setAttribute('aria-label','Smart Travel Context');
  host.style.cssText='display:grid;gap:8px;grid-column:1/-1;padding:9px 10px;border:1px solid rgba(83,126,188,.24);border-radius:12px;background:linear-gradient(135deg,rgba(20,45,78,.66),rgba(7,16,28,.72));';
  const title=detected?.country&&route?`${route.label}`:'Smart Travel suggestion';
  const confidence=detected?.confidence==='high'?'App context':detected?.confidence==='medium'?'Browser locale':'Context uncertain';
  host.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><strong style="display:block;font-size:9px;letter-spacing:.04em">${esc(title)}</strong><span style="display:block;margin-top:3px;color:#8ba0bc;font-size:7px">${esc(confidence)}${detected?.country?` · ${esc(ROUTES[detected.country]?.country||detected.country)}`:''}</span></div><span style="padding:4px 7px;border-radius:999px;border:1px solid rgba(107,146,198,.18);color:#9cb7d6;font-size:6.5px;font-weight:800">SMART DEFAULT</span></div>`;

  if(showChangePrompt&&route){
    const copy=document.createElement('div');
    copy.style.cssText='color:#b9c7d8;font-size:7px;line-height:1.45';
    copy.textContent=`Travel context changed to ${route.country}. Keep your current route or use this suggestion.`;
    const actions=document.createElement('div');
    actions.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
    const use=document.createElement('button');use.type='button';use.textContent=`Use ${route.origin} → ${route.destination}`;use.style.cssText='min-height:32px;padding:0 9px;border:0;border-radius:9px;background:#1959a7;color:#fff;font-size:7.5px;font-weight:900';
    const keep=document.createElement('button');keep.type='button';keep.textContent='Keep current';keep.style.cssText='min-height:32px;padding:0 9px;border:1px solid #28405f;border-radius:9px;background:#08121f;color:#c1d0e3;font-size:7.5px;font-weight:800';
    use.onclick=async()=>{const ok=await applySuggestion(root,route);if(ok){renderContext(root,detected,route,readState());}};
    keep.onclick=()=>{writeState({country:detected?.country||'',selectionMode:'manual'});renderContext(root,detected,route,readState());};
    actions.append(use,keep);host.append(copy,actions);
  }
  root.querySelector('.nxf-hero')?.insertAdjacentElement('afterend',host);
}

function observeManualRoute(root){
  root.addEventListener('pointerdown',event=>{
    const target=event.target?.closest?.('.nxf-end');
    if(target&&!applying)writeState({selectionMode:'manual'});
  },{capture:true});
  root.addEventListener('click',event=>{
    const option=event.target?.closest?.('.nxf-picker [data-code]');
    if(option&&!applying)writeState({selectionMode:'manual'});
  },{capture:true});
}

export async function enhanceSmartTravelContext(id,root){
  if(id!=='travel'||!root)return()=>{};
  const detected=await detectCountry();
  const route=detected.country?ROUTES[detected.country]:null;
  const state=readState();
  observeManualRoute(root);

  if(!route)return()=>{};
  const previousCountry=normalizeCountry(state.lastDetectedCountry||'');
  const manual=state.selectionMode==='manual';
  writeState({lastDetectedCountry:detected.country});

  if(manual){
    renderContext(root,detected,route,state,{showChangePrompt:previousCountry&&previousCountry!==detected.country});
    return()=>removeExisting(root);
  }

  if(state.selectionMode!=='manual'&&state.country===detected.country&&state.origin===route.origin&&state.destination===route.destination){
    renderContext(root,detected,route,state);
    return()=>removeExisting(root);
  }

  const applied=await applySuggestion(root,route);
  const next=readState();
  if(applied)renderContext(root,detected,route,next);
  else renderContext(root,detected,route,state);
  return()=>removeExisting(root);
}
