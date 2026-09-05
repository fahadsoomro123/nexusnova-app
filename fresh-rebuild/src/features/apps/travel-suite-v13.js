import { renderTravelSuite as renderTravelSuiteV12 } from './travel-suite-v12.js';

const HERO_B64_URL = new URL('../../../assets/travel/reference-hero-right.webp.b64', import.meta.url).href;

function ensureV13Styles(){
  if(document.getElementById('nn-travel-reference-v13')) return;
  const style=document.createElement('style');
  style.id='nn-travel-reference-v13';
  style.textContent=`
    .nn-travel-v13 .nn-panel[data-panel="flights"]{width:521px!important;justify-self:start!important}
    .nn-travel-v13 .nn-ref-title{font-size:24px!important;max-width:342px!important;white-space:nowrap!important;overflow:visible!important}
    .nn-travel-v13 .nn-locked-hero-right{opacity:0!important}
    .nn-travel-v13 .nn-locked-hero-right[data-ready="true"]{opacity:1!important}
    .nn-travel-v13 .nn-ref-sub{max-width:345px!important}
    .nn-travel-v13 .nn-results[data-flight-results]{width:100%!important}
  `;
  document.head.appendChild(style);
}

async function replaceHeroAsset(root){
  const img=root.querySelector('.nn-locked-hero-right');
  if(!img) return;
  try{
    const response=await fetch(HERO_B64_URL,{cache:'force-cache'});
    if(!response.ok) throw new Error(`hero asset ${response.status}`);
    const b64=(await response.text()).trim();
    if(!b64.startsWith('UklGR')) throw new Error('hero asset invalid');
    await new Promise((resolve,reject)=>{
      const probe=new Image();
      probe.onload=()=>resolve();
      probe.onerror=()=>reject(new Error('hero asset decode failed'));
      probe.src=`data:image/webp;base64,${b64}`;
    });
    img.src=`data:image/webp;base64,${b64}`;
    img.dataset.ready='true';
  }catch(error){
    img.removeAttribute('data-ready');
    console.warn('[travel-v13] approved hero asset unavailable',error);
  }
}

export function renderTravelSuite(){
  ensureV13Styles();
  const root=renderTravelSuiteV12();
  root.classList.add('nn-travel-v13');
  root.dataset.referenceVisual='v13-locked-asset-fetch';
  queueMicrotask(()=>replaceHeroAsset(root));
  return root;
}

export const travelSuiteRenderers=Object.freeze({travel:renderTravelSuite});
