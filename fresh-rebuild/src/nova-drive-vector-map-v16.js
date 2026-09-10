const ROOT_ID='nxgold14';
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const LIB_JS='https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js';
const LIB_CSS='https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css';
const api=window.NexusNovaGoldV14;
if(!api) throw new Error('Nova Drive Gold UI must load before vector map');

const state={history:null,tracking:null};
const maps=new Map();
let libPromise=null;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function valid(v,a,b){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=a&&Number(v)<=b}
function point(p){if(!p)return null;const lat=p.lat??p.latitude,lng=p.lng??p.lon??p.longitude;return valid(lat,-90,90)&&valid(lng,-180,180)?{lat:Number(lat),lng:Number(lng)}:null}
function points(list){return(Array.isArray(list)?list:[]).map(point).filter(Boolean)}

function loadMapLibre(){
  if(window.maplibregl)return Promise.resolve(window.maplibregl);
  if(libPromise)return libPromise;
  libPromise=new Promise((resolve,reject)=>{
    if(!$('#nxv16-maplibre-css')){const l=document.createElement('link');l.id='nxv16-maplibre-css';l.rel='stylesheet';l.href=LIB_CSS;document.head.appendChild(l)}
    const existing=$('#nxv16-maplibre-js');
    if(existing){existing.addEventListener('load',()=>resolve(window.maplibregl),{once:true});existing.addEventListener('error',reject,{once:true});return}
    const s=document.createElement('script');s.id='nxv16-maplibre-js';s.src=LIB_JS;s.async=true;s.crossOrigin='anonymous';s.onload=()=>window.maplibregl?resolve(window.maplibregl):reject(new Error('MapLibre unavailable'));s.onerror=()=>reject(new Error('MapLibre load failed'));document.head.appendChild(s)
  });
  return libPromise;
}

function ensureStyle(){
  if($('#nxv16-style'))return;
  const s=document.createElement('style');s.id='nxv16-style';s.textContent=`
  #${ROOT_ID} .nxg-keyModal,#${ROOT_ID} [data-provider],#${ROOT_ID} [data-modes],#${ROOT_ID} .nxg-route,#${ROOT_ID} [data-beacon]{display:none!important}
  #${ROOT_ID} .nxg-map{opacity:0!important;pointer-events:none!important}
  #${ROOT_ID} .nxv16-map{position:absolute;inset:0;z-index:0;background:#061015}
  #${ROOT_ID} .nxv16-controls{position:absolute;right:10px;top:54px;z-index:12;display:grid;gap:7px}
  #${ROOT_ID} .nxv16-controls button{width:44px;height:42px;border-radius:13px;border:1px solid rgba(105,235,255,.22);background:rgba(3,10,14,.88);color:#eafaff;font-size:9px;font-weight:950;backdrop-filter:blur(12px)}
  #${ROOT_ID} .nxv16-controls button.on{color:#69ebff;border-color:rgba(105,235,255,.6)}
  #${ROOT_ID} .nxv16-tag{position:absolute;left:10px;bottom:10px;z-index:12;padding:7px 9px;border-radius:999px;border:1px solid rgba(255,216,58,.22);background:rgba(3,10,14,.82);color:#dbe9ee;font-size:7px;font-weight:900;letter-spacing:.06em;backdrop-filter:blur(12px)}
  #${ROOT_ID} .maplibregl-ctrl-attrib{font-size:7px!important;background:rgba(0,0,0,.4)!important;color:#d8e4e8!important}
  #${ROOT_ID} .maplibregl-ctrl-attrib a{color:#fff!important}
  `;document.head.appendChild(s)
}

function futurize(map){
  const style=map.getStyle();
  for(const layer of style.layers||[]){
    const id=(layer.id||'').toLowerCase();
    try{
      if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#061015');
      if(layer.type==='fill'){
        if(id.includes('water'))map.setPaintProperty(layer.id,'fill-color','#082a36');
        else if(id.includes('park')||id.includes('landuse')||id.includes('landcover'))map.setPaintProperty(layer.id,'fill-color','#0b1719');
      }
      if(layer.type==='line'){
        if(id.includes('motorway')||id.includes('trunk')){map.setPaintProperty(layer.id,'line-color','#d8b735');map.setPaintProperty(layer.id,'line-opacity',.72)}
        else if(id.includes('road')||id.includes('transport')){map.setPaintProperty(layer.id,'line-color','#315e69');map.setPaintProperty(layer.id,'line-opacity',.78)}
      }
      if(layer.type==='symbol'&&id.includes('poi'))map.setLayoutProperty(layer.id,'visibility','none');
    }catch{}
  }
  const building=(style.layers||[]).find(l=>l['source-layer']==='building');
  if(building&&!map.getLayer('nxv16-buildings')){
    try{map.addLayer({id:'nxv16-buildings',source:building.source,'source-layer':'building',type:'fill-extrusion',minzoom:14,paint:{'fill-extrusion-color':['interpolate',['linear'],['zoom'],14,'#12262d',16,'#1a3b45'],'fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],16],'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],'fill-extrusion-opacity':.82}})}catch{}
  }
}

function routeGeo(list){
  if(!Array.isArray(list)||list.length<2)return{type:'FeatureCollection',features:[]};
  return{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:list.map(p=>[p.lng,p.lat])}}
}
function liveGeo(p){return{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[p.lng,p.lat]}}}
function emptyGeo(){return{type:'FeatureCollection',features:[]}}

function updateSource(map,id,data){const src=map.getSource(id);if(src){src.setData(data);return true}return false}
function installDataLayers(map){
  if(!map.getSource('nxv16-route'))map.addSource('nxv16-route',{type:'geojson',data:emptyGeo()});
  if(!map.getLayer('nxv16-route-glow'))map.addLayer({id:'nxv16-route-glow',type:'line',source:'nxv16-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffd83d','line-width':12,'line-opacity':.2,'line-blur':5}});
  if(!map.getLayer('nxv16-route'))map.addLayer({id:'nxv16-route',type:'line',source:'nxv16-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffd83d','line-width':5.5,'line-opacity':.98}});
  if(!map.getSource('nxv16-live'))map.addSource('nxv16-live',{type:'geojson',data:emptyGeo()});
  if(!map.getLayer('nxv16-live'))map.addLayer({id:'nxv16-live',type:'circle',source:'nxv16-live',paint:{'circle-radius':7,'circle-color':'#69ebff','circle-stroke-width':3,'circle-stroke-color':'#ffffff','circle-opacity':0}})
}

function fit(map,route,live,animate=true){
  const all=[...route,...(live?[live]:[])];if(!all.length)return;
  if(all.length===1){map[animate?'flyTo':'jumpTo']({center:[all[0].lng,all[0].lat],zoom:16.2,pitch:60,bearing:-18,duration:animate?700:0});return}
  const gl=window.maplibregl;const b=new gl.LngLatBounds([all[0].lng,all[0].lat],[all[0].lng,all[0].lat]);all.slice(1).forEach(p=>b.extend([p.lng,p.lat]));map.fitBounds(b,{padding:{top:78,bottom:72,left:34,right:62},pitch:58,bearing:-18,duration:animate?700:0,maxZoom:17})
}

function enhanceShell(which){
  const root=$(`#${ROOT_ID}`),shell=$(`[data-shell="${which}"]`,root);if(!shell)return null;
  let host=$(`[data-vector-map="${which}"]`,shell);
  if(!host){host=document.createElement('div');host.className='nxv16-map';host.dataset.vectorMap=which;shell.prepend(host)}
  host.hidden=false;
  if(!$('.nxv16-controls',shell)){
    const c=document.createElement('div');c.className='nxv16-controls';c.innerHTML='<button type="button" class="on" data-nxv="3d">3D</button><button type="button" data-nxv="2d">2D</button><button type="button" data-nxv="fit">FIT</button>';
    c.addEventListener('click',e=>{const b=e.target.closest('[data-nxv]');if(!b)return;const rec=maps.get(which);if(!rec)return;if(b.dataset.nxv==='3d'){rec.map.easeTo({pitch:60,bearing:-18,duration:500});$$('[data-nxv]',c).forEach(x=>x.classList.toggle('on',x===b))}else if(b.dataset.nxv==='2d'){rec.map.easeTo({pitch:0,bearing:0,duration:500});$$('[data-nxv]',c).forEach(x=>x.classList.toggle('on',x===b))}else fit(rec.map,rec.route,rec.live,true)});shell.appendChild(c)
  }
  if(!$('.nxv16-tag',shell)){const t=document.createElement('div');t.className='nxv16-tag';t.textContent=which==='history'?'LATEST SAVED TRIP ROUTE · REAL VECTOR MAP':'AUTHORIZED VEHICLE · REAL VECTOR MAP';shell.appendChild(t)}
  return host
}

async function ensureMap(which){
  if(maps.has(which))return maps.get(which);
  const host=enhanceShell(which);if(!host)return null;
  try{
    const gl=await loadMapLibre();
    if(!document.body.contains(host))return null;
    const map=new gl.Map({container:host,style:STYLE_URL,center:[0,20],zoom:1.8,pitch:28,bearing:0,antialias:true,maxPitch:80,attributionControl:true});
    const rec={map,route:[],live:null,ready:false};maps.set(which,rec);
    map.on('load',()=>{rec.ready=true;futurize(map);installDataLayers(map);paint(which,false);setTimeout(()=>{try{map.resize()}catch{}},100)});
    map.on('error',e=>console.warn('[Nova Drive Vector Map]',e?.error||e));
    return rec;
  }catch(e){console.warn('[Nova Drive Vector Map] keyless vector renderer unavailable',e);return null}
}

async function paint(which,animate=true){
  ensureStyle();const root=$(`#${ROOT_ID}`);if(!root)return;
  const d=state[which]||{},route=points(d.routePoints),live=which==='tracking'?point(d.live):null,has=route.length>=2||!!live;
  const shell=$(`[data-shell="${which}"]`,root),empty=$(`[data-empty="${which}"]`,shell),host=enhanceShell(which);if(!host)return;
  host.hidden=false;
  const rec=await ensureMap(which);if(!rec)return;
  rec.route=route;rec.live=live;
  if(!rec.ready)return;
  try{rec.map.resize()}catch{}
  if(!has){
    if(empty)empty.style.display='block';
    updateSource(rec.map,'nxv16-route',emptyGeo());
    updateSource(rec.map,'nxv16-live',emptyGeo());
    try{rec.map.setPaintProperty('nxv16-live','circle-opacity',0)}catch{}
    return;
  }
  if(empty)empty.style.display='none';
  updateSource(rec.map,'nxv16-route',routeGeo(route));
  if(live){updateSource(rec.map,'nxv16-live',liveGeo(live));try{rec.map.setPaintProperty('nxv16-live','circle-opacity',1)}catch{}}
  else{updateSource(rec.map,'nxv16-live',emptyGeo());try{rec.map.setPaintProperty('nxv16-live','circle-opacity',0)}catch{}}
  fit(rec.map,route,live,animate);
}

function cleanup(){for(const rec of maps.values())try{rec.map.remove()}catch{}maps.clear();$('#nxv16-style')?.remove()}

ensureStyle();
const originalMount=api.mount.bind(api),originalUnmount=api.unmount.bind(api),originalHistory=api.setHistory.bind(api),originalTracker=api.setTracker.bind(api),originalResize=api.resize.bind(api);
api.mount=(opts={})=>{const r=originalMount(opts);ensureStyle();enhanceShell('history');enhanceShell('tracking');paint('history',false);paint('tracking',false);return r};
api.unmount=()=>{cleanup();return originalUnmount()};
api.setHistory=(v={})=>{state.history={...(state.history||{}),...v};const r=originalHistory(v);paint('history',false);return r};
api.setTracker=(v={})=>{state.tracking={...(state.tracking||{}),...v};const r=originalTracker(v);paint('tracking',false);return r};
api.resize=()=>{const r=originalResize();for(const rec of maps.values())try{rec.map.resize()}catch{}return r};
api.setMapKey=()=>{};
api.hasMapKey=()=>true;
try{localStorage.removeItem('nexusnova.maptiler.key')}catch{}
