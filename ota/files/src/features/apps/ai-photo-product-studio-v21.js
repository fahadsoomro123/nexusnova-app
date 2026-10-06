import { generateAiImage,getPuterImageSession,signInPuterForImages } from './ai-photo-studio-ai.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const PRESETS={
  shop:{label:'Shop 1:1',width:2000,height:2000},
  square:{label:'Social 1:1',width:1080,height:1080},
  portrait:{label:'Post 4:5',width:1080,height:1350},
  story:{label:'Story 9:16',width:1080,height:1920},
  marketplace:{label:'Marketplace',width:1200,height:1200}
};

function cloneCanvas(source,maxDim=Infinity){
  const scale=Math.min(1,maxDim/Math.max(1,source.width,source.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(source,0,0,canvas.width,canvas.height);return canvas;
}
function canvasFromImage(image,maxDim=2200){
  const scale=Math.min(1,maxDim/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round((image.naturalWidth||image.width)*scale));canvas.height=Math.max(1,Math.round((image.naturalHeight||image.height)*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas;
}
async function imageFromFile(file){
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{if(image.decode)await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});return image}finally{URL.revokeObjectURL(url)}
}
async function canvasFromDataUrl(dataUrl){
  const image=new Image();image.src=dataUrl;if(image.decode)await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});return canvasFromImage(image,4096);
}
async function fileFromCanvas(canvas,name='product.png'){
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not prepare product image.')),'image/png'));
  return new File([blob],name,{type:'image/png'});
}
function downloadCanvas(canvas,name,type='image/png',quality=.94){
  canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1200)},type,quality);
}
function aspectFor(width,height){
  const ratio=width/height;if(ratio>.9&&ratio<1.1)return'square';if(ratio<.67)return'story';if(ratio<.9)return'portrait';return'wide';
}
function coverRect(sourceW,sourceH,targetW,targetH){
  const scale=Math.max(targetW/sourceW,targetH/sourceH),w=sourceW*scale,h=sourceH*scale;return{x:(targetW-w)/2,y:(targetH-h)/2,w,h};
}
function subjectRect(subject,width,height,state){
  const fit=Math.min(width/subject.width,height/subject.height)*.72*(state.scale/100),w=subject.width*fit,h=subject.height*fit;
  return{x:(width-w)*(state.x/100),y:(height-h)*(state.y/100),w,h};
}
function drawComposite(target,state,maxDim=Infinity){
  if(!state.cutout)throw new Error('Choose a product photo first.');
  const preset=PRESETS[state.preset]||PRESETS.shop,scale=Math.min(1,maxDim/Math.max(preset.width,preset.height)),width=Math.max(1,Math.round(preset.width*scale)),height=Math.max(1,Math.round(preset.height*scale));
  target.width=width;target.height=height;const context=target.getContext('2d');context.clearRect(0,0,width,height);
  if(state.background==='white'){context.fillStyle='#ffffff';context.fillRect(0,0,width,height)}
  else if(state.background==='solid'){context.fillStyle=state.color;context.fillRect(0,0,width,height)}
  else if(state.background==='ai'&&state.aiBackground){const rect=coverRect(state.aiBackground.width,state.aiBackground.height,width,height);context.drawImage(state.aiBackground,rect.x,rect.y,rect.w,rect.h)}
  const rect=subjectRect(state.cutout,width,height,state);
  if(state.shadow>0){
    context.save();context.globalAlpha=state.shadow/100*.58;context.filter=`blur(${Math.max(1,state.shadowBlur/100*width*.035)}px)`;context.fillStyle='#000';
    const cx=rect.x+rect.w/2,cy=rect.y+rect.h+state.shadowY/100*height*.08;context.beginPath();context.ellipse(cx,cy,rect.w*.36,Math.max(2,rect.h*.045),0,0,Math.PI*2);context.fill();context.restore();
    context.save();context.globalAlpha=state.shadow/100*.20;context.filter=`blur(${Math.max(1,state.shadowBlur/100*width*.015)}px) brightness(0)`;context.drawImage(state.cutout,rect.x,rect.y+state.shadowY/100*height*.035,rect.w,rect.h);context.restore();
  }
  context.save();context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.filter=`brightness(${state.relight}%) saturate(${state.saturation}%) hue-rotate(${state.hue}deg)`;context.drawImage(state.cutout,rect.x,rect.y,rect.w,rect.h);context.restore();
  return target;
}

async function captureCutoutWithExistingEngine(root,file,onStatus){
  const api=root.__nxQuickTools;if(!api?.open)throw new Error('Remove Background engine is unavailable.');
  api.open('remove-bg');
  for(let i=0;i<100;i++){if(api.getState?.().tool==='remove-bg'&&api.getState?.().screen==='picker')break;await wait(30)}
  const input=root.querySelector('[data-nxqt-file]');if(!input)throw new Error('Remove Background picker is unavailable.');
  const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));onStatus?.('Removing background with the existing on-device subject engine…');
  let container=null;
  for(let i=0;i<900;i++){
    container=root.querySelector('.nxqt-result');const phase=container?.dataset.nxMlRemoveBg;
    if(api.getState?.().screen==='error')throw new Error(root.querySelector('[data-nxqt-error-copy]')?.textContent||'Background removal failed.');
    if(container&&(phase==='ready'||phase==='fallback'))break;
    await wait(35);
  }
  if(!container)throw new Error('Background removal did not finish.');
  const phase=container.dataset.nxMlRemoveBg;if(phase!=='ready'&&phase!=='fallback')throw new Error('Background removal timed out.');
  const wrap=container.querySelector('[data-nxqt-canvas-wrap]'),canvases=[...(wrap?.querySelectorAll('canvas')||[])],visible=canvases.find(canvas=>!canvas.hidden)||canvases.at(-1);
  if(!visible)throw new Error('Background removal returned no image.');
  const cutout=cloneCanvas(visible),detail=container.querySelector('[data-nxqt-result-detail]')?.textContent||'';api.close();return{cutout,detail,phase};
}

function ensureStyle(){
  if(document.getElementById('nx-ai-photo-product-studio-v21'))return;
  const style=document.createElement('style');style.id='nx-ai-photo-product-studio-v21';style.textContent=`
  .nxps-actions.nxps-has-product{grid-template-rows:repeat(2,minmax(0,1fr)) auto}.nxps-product-home{grid-column:1/-1;display:grid!important;grid-template-columns:38px minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;min-height:50px!important;padding:7px 10px!important}.nxps-product-home .nxps-action-icon{width:36px;height:36px}.nxps-product-home strong{margin:0!important}.nxps-product-home p{margin-top:3px!important}.nxps-product-home .nxps-action-tag{align-self:start;margin-top:4px}
  .nxprod{position:absolute;inset:0;z-index:108;display:grid;grid-template-rows:56px minmax(0,1fr);overflow:hidden;background:radial-gradient(circle at 88% 0,rgba(130,65,229,.2),transparent 28%),linear-gradient(180deg,#090d16,#070a11);color:#f6f3ff}.nxprod[hidden]{display:none!important}.nxprod *{box-sizing:border-box}.nxprod button,.nxprod input,.nxprod textarea{font:inherit}.nxprod-head{display:grid;grid-template-columns:72px minmax(0,1fr) 72px;align-items:center;gap:8px;padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.09);background:rgba(12,15,24,.95)}.nxprod-head strong{text-align:center;font-size:14px}.nxprod-back,.nxprod-new{height:40px!important;border:1px solid rgba(165,117,246,.28)!important;border-radius:12px!important;background:#1b1628!important;color:#eee7ff!important;font-size:9px!important;font-weight:850!important}.nxprod-body{min-height:0;overflow:auto;overscroll-behavior:contain;padding:10px}.nxprod-grid{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(260px,.82fr);gap:10px;width:min(100%,980px);margin:0 auto}.nxprod-stage,.nxprod-panel{border:1px solid rgba(255,255,255,.09);border-radius:17px;background:#111620}.nxprod-stage{display:grid;gap:8px;align-content:start;padding:10px}.nxprod-canvas-wrap{display:grid;min-height:320px;max-height:66vh;place-items:center;overflow:hidden;border-radius:14px;background-color:#1b202c;background-image:linear-gradient(45deg,#252b38 25%,transparent 25%),linear-gradient(-45deg,#252b38 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#252b38 75%),linear-gradient(-45deg,transparent 75%,#252b38 75%);background-position:0 0,0 8px,8px -8px,-8px 0;background-size:16px 16px}.nxprod-canvas{display:block;max-width:100%;max-height:66vh;box-shadow:0 18px 44px rgba(0,0,0,.32)}.nxprod-status{min-height:34px;padding:8px 9px;border-radius:10px;background:rgba(119,70,190,.12);color:#bfc2d0;font-size:8.5px;line-height:1.45}.nxprod-panel{display:grid;gap:10px;padding:11px;align-content:start}.nxprod-section{display:grid;gap:7px;padding-bottom:9px;border-bottom:1px solid rgba(255,255,255,.07)}.nxprod-section:last-child{border-bottom:0}.nxprod-label{color:#d8d3e4;font-size:9px;font-weight:850}.nxprod-chips{display:flex;gap:6px;overflow:auto;scrollbar-width:none}.nxprod-chip{flex:0 0 auto;min-height:36px!important;padding:0 10px!important;border:1px solid rgba(255,255,255,.11)!important;border-radius:10px!important;background:#191e29!important;color:#c4c7d1!important;font-size:8px!important;font-weight:800!important}.nxprod-chip.is-active{border-color:#9e59ed!important;background:#332149!important;color:#fff!important}.nxprod-field{display:grid;grid-template-columns:62px minmax(0,1fr) 38px;align-items:center;gap:6px}.nxprod-field span,.nxprod-field output{color:#aeb3c0;font-size:8px}.nxprod-field output{text-align:right}.nxprod-field input[type=range]{width:100%;accent-color:#9c54ef;touch-action:pan-y}.nxprod-color{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:7px}.nxprod-color input[type=color]{width:46px;height:38px;padding:2px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#191e29}.nxprod-ai textarea{width:100%;min-height:62px;padding:8px 9px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#181d28;color:#fff;font-size:9px;resize:none}.nxprod-primary,.nxprod-action{min-height:42px!important;padding:0 10px!important;border:1px solid rgba(165,117,246,.30)!important;border-radius:11px!important;background:#241a35!important;color:#f5efff!important;font-size:9px!important;font-weight:850!important}.nxprod-primary{border-color:transparent!important;background:linear-gradient(90deg,#a652ff,#7132e4)!important;color:#160b22!important}.nxprod-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.nxprod-picker{display:grid;min-height:58vh;place-items:center;text-align:center;padding:20px}.nxprod-picker-card{width:min(100%,470px);padding:22px;border:1px dashed rgba(169,119,247,.42);border-radius:19px;background:rgba(21,25,36,.88)}.nxprod-picker-card strong{display:block;font-size:17px}.nxprod-picker-card p{margin:8px auto 0;max-width:390px;color:#adb3c2;font-size:9px;line-height:1.5}.nxprod-picker-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:14px}.nxprod-busy{opacity:.68;pointer-events:none}
  @media(max-width:760px){.nxprod{grid-template-rows:54px minmax(0,1fr)}.nxprod-body{padding:8px}.nxprod-grid{grid-template-columns:1fr}.nxprod-canvas-wrap{min-height:260px;max-height:47vh}.nxprod-canvas{max-height:47vh}.nxprod-panel{padding:9px}.nxprod-actions{grid-template-columns:1fr 1fr}.nxprod-actions .nxprod-action:last-child{grid-column:1/-1}}@media(max-height:650px){.nxps-product-home{min-height:42px!important}.nxps-product-home p{display:none!important}.nxprod-canvas-wrap{min-height:210px;max-height:42vh}.nxprod-canvas{max-height:42vh}}
  `;document.head.appendChild(style);
}

export function installAiPhotoProductStudioV21(root){
  if(!root||root.__nxProductStudioV21)return()=>{};ensureStyle();
  const homeActions=root.querySelector('.nxps-actions'),home=document.createElement('button');home.type='button';home.className='nxps-action nxps-product-home';home.dataset.nxpsProductStudio='1';home.innerHTML='<span class="nxps-action-icon">▱</span><span><strong>Product Studio</strong><p>Cutout, clean or AI backgrounds, placement, shadow, relight and marketplace sizes.</p></span><span class="nxps-action-tag">PRO</span>';homeActions?.classList.add('nxps-has-product');homeActions?.appendChild(home);
  const shell=document.createElement('section');shell.className='nxprod';shell.hidden=true;shell.setAttribute('aria-label','Product Studio');shell.innerHTML='<header class="nxprod-head"><button type="button" class="nxprod-back">Home</button><strong>Product Studio</strong><button type="button" class="nxprod-new">New</button></header><main class="nxprod-body" data-nxprod-body></main><input type="file" accept="image/jpeg,image/png,image/webp" data-nxprod-file hidden>';root.appendChild(shell);
  const body=shell.querySelector('[data-nxprod-body]'),input=shell.querySelector('[data-nxprod-file]'),preview=document.createElement('canvas');preview.className='nxprod-canvas';
  const state={preset:'shop',background:'white',color:'#f4f1ec',x:50,y:48,scale:100,shadow:55,shadowBlur:58,shadowY:18,relight:100,saturation:100,hue:0,cutout:null,aiBackground:null,sourceName:'product',engine:'',busy:false};let frame=0,destroyed=false;
  const publicState=()=>({preset:state.preset,background:state.background,color:state.color,x:state.x,y:state.y,scale:state.scale,shadow:state.shadow,shadowBlur:state.shadowBlur,shadowY:state.shadowY,relight:state.relight,saturation:state.saturation,hue:state.hue,hasCutout:Boolean(state.cutout),hasAiBackground:Boolean(state.aiBackground),sourceName:state.sourceName,engine:state.engine});
  const schedule=()=>{if(frame||!state.cutout)return;frame=requestAnimationFrame(()=>{frame=0;try{drawComposite(preview,state,760)}catch{}})};
  const setStatus=text=>{const node=body.querySelector('[data-nxprod-status]');if(node)node.textContent=text};
  const setBusy=value=>{state.busy=value;shell.classList.toggle('nxprod-busy',value)};
  const picker=()=>{body.innerHTML='<div class="nxprod-picker"><div class="nxprod-picker-card"><strong>Start with your product</strong><p>NexusNova uses the existing on-device subject engine for the cutout. Your product stays separate from any AI-generated background.</p><div class="nxprod-picker-actions"><button type="button" class="nxprod-primary" data-nxprod-choose>Choose Product</button><button type="button" class="nxprod-action" data-nxprod-current>Use Current Photo</button></div></div></div>';body.querySelector('[data-nxprod-choose]').onclick=()=>input.click();const current=body.querySelector('[data-nxprod-current]'),canvas=root.querySelector('[data-photo-canvas]');current.disabled=!canvas?.width;current.onclick=async()=>{if(!canvas?.width)return;const file=await fileFromCanvas(canvas,'current-product.png');await loadProduct(file)}};
  const controls=()=>{
    body.innerHTML=`<div class="nxprod-grid"><div class="nxprod-stage"><div class="nxprod-canvas-wrap" data-nxprod-preview></div><div class="nxprod-status" data-nxprod-status>${state.engine||'Product cutout ready.'}</div></div><div class="nxprod-panel">
      <div class="nxprod-section"><div class="nxprod-label">Canvas size</div><div class="nxprod-chips">${Object.entries(PRESETS).map(([key,p])=>`<button type="button" class="nxprod-chip${key===state.preset?' is-active':''}" data-nxprod-preset="${key}">${p.label}</button>`).join('')}</div></div>
      <div class="nxprod-section"><div class="nxprod-label">Background</div><div class="nxprod-chips"><button class="nxprod-chip${state.background==='white'?' is-active':''}" data-nxprod-bg="white">White</button><button class="nxprod-chip${state.background==='transparent'?' is-active':''}" data-nxprod-bg="transparent">Transparent</button><button class="nxprod-chip${state.background==='solid'?' is-active':''}" data-nxprod-bg="solid">Solid</button><button class="nxprod-chip${state.background==='ai'?' is-active':''}" data-nxprod-bg="ai" ${state.aiBackground?'':'disabled'}>AI Scene</button></div><div class="nxprod-color"><div class="nxprod-status">Solid color is deterministic local composition.</div><input type="color" value="${state.color}" data-nxprod-color></div></div>
      <div class="nxprod-section"><div class="nxprod-label">Placement + shadow</div>${[['x','X',0,100],['y','Y',0,100],['scale','Scale',55,145],['shadow','Shadow',0,100],['shadowBlur','Blur',0,100],['shadowY','Floor',0,100]].map(([key,label,min,max])=>`<label class="nxprod-field"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${state[key]}" data-nxprod-range="${key}"><output>${state[key]}</output></label>`).join('')}</div>
      <div class="nxprod-section"><div class="nxprod-label">Product tone</div>${[['relight','Relight',70,135],['saturation','Color',60,145],['hue','Hue',-45,45]].map(([key,label,min,max])=>`<label class="nxprod-field"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${state[key]}" data-nxprod-range="${key}"><output>${state[key]}</output></label>`).join('')}<div class="nxprod-status">Relight and recolor are real local pixel transforms, not labelled as AI.</div></div>
      <div class="nxprod-section nxprod-ai"><div class="nxprod-label">AI Background</div><textarea data-nxprod-prompt placeholder="Example: warm stone pedestal, soft luxury studio light"></textarea><button type="button" class="nxprod-primary" data-nxprod-ai>Generate Background with Puter</button></div>
      <div class="nxprod-actions"><button type="button" class="nxprod-action" data-nxprod-png>PNG</button><button type="button" class="nxprod-action" data-nxprod-jpg>JPEG</button><button type="button" class="nxprod-primary" data-nxprod-edit>Edit Photo</button></div>
    </div></div>`;
    body.querySelector('[data-nxprod-preview]').appendChild(preview);schedule();
    body.querySelectorAll('[data-nxprod-preset]').forEach(button=>button.onclick=()=>{state.preset=button.dataset.nxprodPreset;body.querySelectorAll('[data-nxprod-preset]').forEach(n=>n.classList.toggle('is-active',n===button));schedule()});
    body.querySelectorAll('[data-nxprod-bg]').forEach(button=>button.onclick=()=>{if(button.disabled)return;state.background=button.dataset.nxprodBg;body.querySelectorAll('[data-nxprod-bg]').forEach(n=>n.classList.toggle('is-active',n===button));schedule()});
    const color=body.querySelector('[data-nxprod-color]');color.oninput=()=>{state.color=color.value;state.background='solid';body.querySelectorAll('[data-nxprod-bg]').forEach(n=>n.classList.toggle('is-active',n.dataset.nxprodBg==='solid'));schedule()};
    body.querySelectorAll('[data-nxprod-range]').forEach(range=>range.oninput=()=>{state[range.dataset.nxprodRange]=Number(range.value);range.nextElementSibling.textContent=range.value;schedule()});
    body.querySelector('[data-nxprod-ai]').onclick=generateBackground;body.querySelector('[data-nxprod-png]').onclick=()=>{const out=drawComposite(document.createElement('canvas'),state);downloadCanvas(out,`${state.sourceName}-${state.preset}.png`)};body.querySelector('[data-nxprod-jpg]').onclick=()=>{const before=state.background;if(before==='transparent')state.background='white';const out=drawComposite(document.createElement('canvas'),state);state.background=before;downloadCanvas(out,`${state.sourceName}-${state.preset}.jpg`,'image/jpeg',.94)};body.querySelector('[data-nxprod-edit]').onclick=sendToEditor;
  };
  async function loadProduct(file){
    if(state.busy)return;setBusy(true);try{state.sourceName=String(file.name||'product').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-')||'product';setStatus('Preparing product…');const result=await captureCutoutWithExistingEngine(root,file,text=>setStatus(text));state.cutout=result.cutout;state.engine=result.detail||result.phase;controls()}catch(error){picker();const card=body.querySelector('.nxprod-picker-card');if(card){const note=document.createElement('p');note.textContent=error?.message||'Product cutout failed.';note.style.color='#ffb5bf';card.appendChild(note)}}finally{setBusy(false)}
  }
  async function generateBackground(){
    if(state.busy)return;const prompt=body.querySelector('[data-nxprod-prompt]')?.value.trim();if(!prompt){setStatus('Describe the background scene first.');return}setBusy(true);setStatus('Connecting to Puter for a real generated background…');
    try{let session=await getPuterImageSession();if(!session.signedIn)session=await signInPuterForImages();if(!session?.signedIn)throw new Error('Puter sign-in did not complete.');const p=PRESETS[state.preset]||PRESETS.shop,result=await generateAiImage(`Empty premium commercial product photography background only. No product, no object, no logo, no text. Leave a clean central area for a separately composited product. ${prompt}`,{aspect:aspectFor(p.width,p.height),style:'product',mode:'economy'});state.aiBackground=await canvasFromDataUrl(result.dataUrl);state.background='ai';body.querySelectorAll('[data-nxprod-bg]').forEach(n=>{if(n.dataset.nxprodBg==='ai')n.disabled=false;n.classList.toggle('is-active',n.dataset.nxprodBg==='ai')});setStatus(`AI background ready · ${result.model} · product cutout remains unchanged.`);schedule()}catch(error){setStatus(error?.message||'AI background could not be generated.')}finally{setBusy(false)}
  }
  async function sendToEditor(){
    if(state.busy)return;setBusy(true);try{const out=drawComposite(document.createElement('canvas'),state),file=await fileFromCanvas(out,`${state.sourceName}-product-studio.png`),photoInput=root.querySelector('[data-photo-file]');if(!photoInput)throw new Error('Photo Editor input is unavailable.');shell.hidden=true;const homePanel=root.querySelector('.nxps-home');if(homePanel)homePanel.hidden=true;const transfer=new DataTransfer();transfer.items.add(file);photoInput.files=transfer.files;photoInput.dispatchEvent(new Event('change',{bubbles:true}))}catch(error){setStatus(error?.message||'Could not send result to Photo Editor.')}finally{setBusy(false)}
  }
  const open=()=>{shell.hidden=false;if(state.cutout)controls();else picker()},close=()=>{shell.hidden=true;root.querySelector('.nxps-home')?.removeAttribute('hidden')},reset=()=>{state.cutout=null;state.aiBackground=null;state.background='white';state.preset='shop';state.x=50;state.y=48;state.scale=100;state.shadow=55;state.shadowBlur=58;state.shadowY=18;state.relight=100;state.saturation=100;state.hue=0;picker()};
  home.onclick=open;shell.querySelector('.nxprod-back').onclick=close;shell.querySelector('.nxprod-new').onclick=reset;input.onchange=()=>{const file=input.files?.[0];input.value='';if(file)loadProduct(file)};
  root.__nxProductStudioV21={open,close,getState:publicState,renderFull:()=>drawComposite(document.createElement('canvas'),state)};
  return()=>{destroyed=true;if(frame)cancelAnimationFrame(frame);home.remove();homeActions?.classList.remove('nxps-has-product');shell.remove();document.getElementById('nx-ai-photo-product-studio-v21')?.remove();delete root.__nxProductStudioV21};
}
