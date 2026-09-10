import { NEXUSNOVA_TEMPLATES } from './data/ai-photo-templates.js';
import { saveDesignProject } from './ai-photo-project-store.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const FEATURED={
  'nx-approved-featured-photo-portrait':{
    width:1080,height:1080,background:'#0a0d14',category:'Product Promo',useCase:'Premium product campaign',
    elements:[
      {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:'#0a0d14',locked:true,role:'Background'},
      {id:'glow',type:'circle',x:.58,y:-.09,w:.55,h:.55,fill:'#5d35c9',opacity:.50,role:'Accent glow'},
      {id:'eyebrow',type:'text',x:.075,y:.075,w:.40,h:.06,text:'NEW COLLECTION',fill:'#cbb7ff',fontWeight:800,fontSize:.026,role:'Eyebrow'},
      {id:'headline',type:'text',x:.075,y:.15,w:.48,h:.24,text:'DESIGNED TO\nSTAND OUT',fill:'#ffffff',fontWeight:900,fontSize:.078,lineHeight:1.02,role:'Headline'},
      {id:'copy',type:'text',x:.075,y:.41,w:.40,h:.10,text:'Premium details. Clean presentation. Built for your next launch.',fill:'#b6bbc8',fontWeight:500,fontSize:.027,lineHeight:1.25,role:'Body copy'},
      {id:'cta-bg',type:'rect',x:.075,y:.55,w:.25,h:.082,fill:'#a66cff',radius:.035,role:'CTA background'},
      {id:'cta',type:'text',x:.075,y:.572,w:.25,h:.045,text:'SHOP NOW',fill:'#160d22',fontWeight:900,fontSize:.021,align:'center',role:'Call to action'},
      {id:'photo-card',type:'rect',x:.55,y:.14,w:.38,h:.70,fill:'#171c27',radius:.045,role:'Photo frame'},
      {id:'photo',type:'photo',x:.57,y:.16,w:.34,h:.66,fill:'#332754',radius:.035,label:'REPLACE PRODUCT PHOTO',role:'Product photo'},
      {id:'badge',type:'circle',x:.49,y:.72,w:.15,h:.15,fill:'#f5d58d',role:'Offer badge'},
      {id:'badge-copy',type:'text',x:.50,y:.765,w:.13,h:.04,text:'PREMIUM',fill:'#17120b',fontWeight:900,fontSize:.018,align:'center',role:'Badge text'}
    ]
  },
  'nx-approved-featured-social-media':{
    width:1200,height:630,background:'#0d1220',category:'Facebook Post',useCase:'Social campaign',
    elements:[
      {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:'#0d1220',locked:true,role:'Background'},
      {id:'accent-a',type:'rect',x:0,y:0,w:.035,h:1,fill:'#58d7bb',role:'Accent rail'},
      {id:'photo',type:'photo',x:.55,y:.07,w:.40,h:.86,fill:'#24453f',radius:.035,label:'REPLACE CAMPAIGN PHOTO',role:'Campaign photo'},
      {id:'kicker',type:'text',x:.08,y:.13,w:.37,h:.07,text:'WEEKEND EDIT',fill:'#78e4ce',fontWeight:850,fontSize:.026,role:'Kicker'},
      {id:'headline',type:'text',x:.08,y:.25,w:.41,h:.27,text:'MAKE YOUR\nMOMENT COUNT',fill:'#ffffff',fontWeight:900,fontSize:.075,lineHeight:1.02,role:'Headline'},
      {id:'subhead',type:'text',x:.08,y:.57,w:.38,h:.10,text:'A clean social layout with a real replaceable image and editable campaign hierarchy.',fill:'#b7becd',fontWeight:500,fontSize:.024,lineHeight:1.3,role:'Subheadline'},
      {id:'cta-bg',type:'rect',x:.08,y:.75,w:.18,h:.10,fill:'#58d7bb',radius:.03,role:'CTA background'},
      {id:'cta',type:'text',x:.08,y:.785,w:.18,h:.04,text:'LEARN MORE',fill:'#092019',fontWeight:900,fontSize:.018,align:'center',role:'Call to action'},
      {id:'micro',type:'text',x:.29,y:.785,w:.20,h:.04,text:'YOURBRAND.COM',fill:'#8e96aa',fontWeight:700,fontSize:.014,role:'Website'}
    ]
  },
  'nx-approved-featured-poster-design':{
    width:1240,height:1754,background:'#100d18',category:'Poster',useCase:'Event poster',
    elements:[
      {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:'#100d18',locked:true,role:'Background'},
      {id:'beam',type:'rect',x:.66,y:-.06,w:.24,h:1.14,fill:'#6e36e8',rotation:12,opacity:.42,role:'Light beam'},
      {id:'date',type:'text',x:.075,y:.065,w:.36,h:.05,text:'SAT · 08 PM · CITY HALL',fill:'#c7adff',fontWeight:850,fontSize:.021,role:'Event details'},
      {id:'headline',type:'text',x:.07,y:.16,w:.82,h:.23,text:'NIGHT\nIN MOTION',fill:'#ffffff',fontWeight:900,fontSize:.105,lineHeight:.92,role:'Headline'},
      {id:'rule',type:'line',x:.075,y:.43,w:.29,h:.01,fill:'#b476ff',strokeWidth:.006,role:'Divider'},
      {id:'photo-frame',type:'rect',x:.075,y:.49,w:.85,h:.33,fill:'#21182f',radius:.025,role:'Photo frame'},
      {id:'photo',type:'photo',x:.095,y:.51,w:.81,h:.29,fill:'#39264d',radius:.018,label:'REPLACE EVENT PHOTO',role:'Hero photo'},
      {id:'copy',type:'text',x:.075,y:.855,w:.58,h:.07,text:'LIVE MUSIC · VISUALS · CREATIVE CULTURE',fill:'#c4c5d0',fontWeight:650,fontSize:.023,role:'Event copy'},
      {id:'ticket-bg',type:'rect',x:.70,y:.85,w:.23,h:.07,fill:'#f3cf75',radius:.022,role:'Ticket background'},
      {id:'ticket',type:'text',x:.70,y:.872,w:.23,h:.03,text:'GET TICKETS',fill:'#1a1307',fontWeight:900,fontSize:.018,align:'center',role:'Ticket CTA'}
    ]
  },
  'nx-approved-featured-instagram-post':{
    width:1080,height:1080,background:'#f4efe8',category:'Instagram Post',useCase:'Editorial social post',
    elements:[
      {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:'#f4efe8',locked:true,role:'Background'},
      {id:'photo',type:'photo',x:.07,y:.07,w:.58,h:.66,fill:'#d7c5ae',radius:.02,label:'REPLACE LIFESTYLE PHOTO',role:'Lifestyle photo'},
      {id:'accent',type:'rect',x:.61,y:.12,w:.30,h:.12,fill:'#f16f52',radius:.012,rotation:-4,role:'Accent'},
      {id:'number',type:'text',x:.70,y:.13,w:.18,h:.07,text:'01',fill:'#fff8f3',fontWeight:900,fontSize:.052,align:'center',role:'Edition number'},
      {id:'kicker',type:'text',x:.70,y:.31,w:.22,h:.05,text:'THE EDIT',fill:'#c4523d',fontWeight:850,fontSize:.021,role:'Kicker'},
      {id:'headline',type:'text',x:.69,y:.39,w:.25,h:.22,text:'STYLE\nWITH\nPURPOSE',fill:'#171411',fontWeight:900,fontSize:.055,lineHeight:1.02,role:'Headline'},
      {id:'rule',type:'line',x:.69,y:.65,w:.20,h:.01,fill:'#171411',strokeWidth:.004,role:'Divider'},
      {id:'caption',type:'text',x:.07,y:.78,w:.58,h:.10,text:'A polished editorial post with every message, image and shape ready to customize.',fill:'#4a4642',fontWeight:500,fontSize:.026,lineHeight:1.25,role:'Caption'},
      {id:'handle',type:'text',x:.70,y:.79,w:.22,h:.05,text:'@YOURBRAND',fill:'#171411',fontWeight:850,fontSize:.019,align:'right',role:'Handle'}
    ]
  }
};

function upgradeFeaturedTemplates(){
  for(const template of NEXUSNOVA_TEMPLATES){
    const spec=FEATURED[template.id];if(!spec)continue;
    template.canvas={width:spec.width,height:spec.height};template.background=spec.background;template.elements=spec.elements.map((el,z)=>({...el,z}));
    template.label=spec.category;template.useCase=spec.useCase;template.style='Flagship Structured';
    template.purpose=`Professional editable ${spec.useCase.toLowerCase()} with independent text, photo, shape and hierarchy layers.`;
    template.description='Every visible component is a real editable design layer. No flattened showcase artwork is used.';
    template.editableFields=['Text','Photo replacement','Photo crop and focal point','Shapes','Background','Colors','Font family and weight','Opacity','Position','Size','Rotation','Layer order'];
    template.sizeLabel=`${spec.width} × ${spec.height}px`;
    template.tags=[...(template.tags||[]).filter(tag=>tag!=='approved showcase'),'structured','multi-layer','flagship','editable'];
  }
}
upgradeFeaturedTemplates();

const FONT_OPTIONS=[
  ['system-ui','Modern Sans'],
  ['Arial, sans-serif','Clean Sans'],
  ['Trebuchet MS, sans-serif','Humanist Sans'],
  ['Georgia, serif','Editorial Serif'],
  ['Courier New, monospace','Mono']
];
const imageMetaCache=new Map();
async function imageMeta(src){
  if(!src)return null;if(imageMetaCache.has(src))return imageMetaCache.get(src);
  const task=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth||image.width,height:image.naturalHeight||image.height});image.onerror=()=>reject(new Error('Could not read the selected photo.'));image.src=src});
  imageMetaCache.set(src,task);try{return await task}catch(error){imageMetaCache.delete(src);throw error}
}
function selectedElement(design){const id=design?.selection?.[0];return id?design.elements?.find(el=>el.id===id):null}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

export function installAiPhotoDesignFlagshipV22(root){
  if(!root||root.__nxDesignFlagshipV22)return()=>{};root.__nxDesignFlagshipV22=true;
  const workspace=root.querySelector('.nx-canva-v3'),api=root.__nxCanvaWorkspaceV3;if(!workspace||!api){delete root.__nxDesignFlagshipV22;return()=>{}}
  const style=document.createElement('style');style.id='nx-ai-photo-design-flagship-v22';style.textContent=`.nxv22-pro{display:grid;gap:7px;margin-top:8px;padding:8px;border:1px solid rgba(183,131,255,.28);border-radius:11px;background:linear-gradient(145deg,#1e1829,#151821)}.nxv22-title{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#f5efff;font-size:9px;font-weight:900}.nxv22-title span{color:#a993ca;font-size:7px;letter-spacing:.08em}.nxv22-row{display:grid;grid-template-columns:72px minmax(0,1fr) 42px;align-items:center;gap:6px}.nxv22-row>span,.nxv22-row>output{color:#c4c7d3;font-size:8px}.nxv22-row>output{text-align:right}.nxv22-row select,.nxv22-row input{width:100%!important;height:35px!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:8px!important;background:#20242e!important;color:#f8f8fc!important;font-size:9px!important}.nxv22-row input[type=range]{height:24px!important;border:0!important;background:transparent!important;accent-color:#9a58ef}.nxv22-note{color:#9097a9;font-size:7.5px;line-height:1.4}.nxv3-card[data-template-id^="nx-approved-featured-"]{border-color:rgba(177,128,255,.42)!important}.nxv3-card[data-template-id^="nx-approved-featured-"] .nxv3-card-copy small::after{content:' · STRUCTURED';color:#8fe4c7}@media(max-width:390px){.nxv22-row{grid-template-columns:62px minmax(0,1fr) 36px}}`;document.head.appendChild(style);
  let destroyed=false,applying=false;
  function reselect(id){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(destroyed||!id)return;api.setTab('layers');requestAnimationFrame(()=>{const row=[...root.querySelectorAll('[data-layer]')].find(node=>node.dataset.layer===id);row?.querySelector('button')?.click()})
    }))
  }
  function persist(id,mutator){
    if(applying)return false;const design=api.getDesign(),element=design?.elements?.find(el=>el.id===id);if(!design||!element)return false;
    mutator(element,design);applying=true;try{saveDesignProject(design);api.openProject(design.id);reselect(id);return true}finally{setTimeout(()=>{applying=false;requestAnimationFrame(attach)},80)}
  }
  async function applyCrop(id,{zoom,focusX,focusY}){
    const design=api.getDesign(),element=design?.elements?.find(el=>el.id===id);if(!design||!element?.src)return false;
    const meta=await imageMeta(element.src),frameAspect=(element.w*design.width)/Math.max(1,element.h*design.height),imageAspect=meta.width/meta.height;
    let baseW=1,baseH=1;if(imageAspect>frameAspect)baseW=frameAspect/imageAspect;else baseH=imageAspect/frameAspect;
    const z=clamp(Number(zoom)||1,1,3),w=clamp(baseW/z,.03,1),h=clamp(baseH/z,.03,1),fx=clamp(Number(focusX)||50,0,100)/100,fy=clamp(Number(focusY)||50,0,100)/100;
    return persist(id,el=>{el.cropZoom=z;el.cropFocusX=Math.round(fx*100);el.cropFocusY=Math.round(fy*100);el.sourceCrop={x:(1-w)*fx,y:(1-h)*fy,w,h}})
  }
  function attach(){
    if(destroyed||applying)return;const host=workspace.querySelector('[data-v3-inspector]'),design=api.getDesign(),element=selectedElement(design);if(!host||!element||host.querySelector('.nxv22-pro'))return;
    const panel=document.createElement('div');panel.className='nxv22-pro';panel.innerHTML=`<div class="nxv22-title">PRO DESIGN CONTROLS <span>V22</span></div>`;
    const position=document.createElement('div');position.innerHTML=`<label class="nxv22-row"><span>Position X</span><input type="range" min="0" max="100" value="${Math.round((element.x||0)*100)}" data-v22-x><output>${Math.round((element.x||0)*100)}%</output></label><label class="nxv22-row"><span>Position Y</span><input type="range" min="0" max="100" value="${Math.round((element.y||0)*100)}" data-v22-y><output>${Math.round((element.y||0)*100)}%</output></label>`;panel.append(...position.children);
    if(element.type==='text'){
      const fonts=FONT_OPTIONS.map(([value,label])=>`<option value="${esc(value)}" ${String(element.fontFamily||'system-ui')===value?'selected':''}>${label}</option>`).join('');
      const block=document.createElement('div');block.innerHTML=`<label class="nxv22-row"><span>Font</span><select data-v22-font>${fonts}</select><output>Family</output></label><label class="nxv22-row"><span>Weight</span><select data-v22-weight>${[400,500,600,700,800,900].map(value=>`<option value="${value}" ${Number(element.fontWeight||600)===value?'selected':''}>${value}</option>`).join('')}</select><output>Weight</output></label>`;panel.append(...block.children)
    }
    if(element.type==='photo'){
      const hasPhoto=Boolean(element.src),zoom=clamp(Number(element.cropZoom)||1,1,3),fx=clamp(Number(element.cropFocusX)||50,0,100),fy=clamp(Number(element.cropFocusY)||50,0,100);
      const block=document.createElement('div');block.innerHTML=`<label class="nxv22-row"><span>Crop zoom</span><input type="range" min="1" max="3" step="0.05" value="${zoom}" data-v22-crop-zoom ${hasPhoto?'':'disabled'}><output>${zoom.toFixed(2)}×</output></label><label class="nxv22-row"><span>Focus X</span><input type="range" min="0" max="100" value="${fx}" data-v22-focus-x ${hasPhoto?'':'disabled'}><output>${Math.round(fx)}%</output></label><label class="nxv22-row"><span>Focus Y</span><input type="range" min="0" max="100" value="${fy}" data-v22-focus-y ${hasPhoto?'':'disabled'}><output>${Math.round(fy)}%</output></label><div class="nxv22-note">${hasPhoto?'Crop keeps the photo frame filled while changing zoom and focal point.':'Replace the photo first, then crop and focal controls become active.'}</div>`;panel.append(...block.children)
    }
    host.appendChild(panel);
    const id=element.id;
    const bindPosition=(selector,key)=>{const input=panel.querySelector(selector);if(!input)return;input.oninput=()=>{input.nextElementSibling.textContent=`${input.value}%`};input.onchange=()=>persist(id,el=>{el[key]=clamp(Number(input.value)/100,0,1)})};bindPosition('[data-v22-x]','x');bindPosition('[data-v22-y]','y');
    const font=panel.querySelector('[data-v22-font]');if(font)font.onchange=()=>persist(id,el=>{el.fontFamily=font.value});const weight=panel.querySelector('[data-v22-weight]');if(weight)weight.onchange=()=>persist(id,el=>{el.fontWeight=Number(weight.value)});
    const crop=panel.querySelector('[data-v22-crop-zoom]'),focusX=panel.querySelector('[data-v22-focus-x]'),focusY=panel.querySelector('[data-v22-focus-y]');
    if(crop&&focusX&&focusY){for(const input of [crop,focusX,focusY])input.oninput=()=>{const output=input.nextElementSibling;output.textContent=input===crop?`${Number(input.value).toFixed(2)}×`:`${Math.round(Number(input.value))}%`};const commit=()=>applyCrop(id,{zoom:crop.value,focusX:focusX.value,focusY:focusY.value});crop.onchange=commit;focusX.onchange=commit;focusY.onchange=commit}
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(attach));observer.observe(workspace,{subtree:true,childList:true});attach();
  root.__nxDesignFlagshipV22={featuredStructured:true,getFeatured:()=>Object.keys(FEATURED),refresh:attach};
  return()=>{destroyed=true;observer.disconnect();style.remove();delete root.__nxDesignFlagshipV22}
}
