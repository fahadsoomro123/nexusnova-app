const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const TASKS_VERSION='1.0.1';
const TASKS_ESM=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/+esm`;
const WASM_ROOT=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const SELFIE_MODEL='https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const DEEPLAB_MODEL='https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite';

let visionPromise=null,selfiePromise=null,semanticPromise=null;
const delay=ms=>new Promise(r=>setTimeout(r,ms));

function cloneCanvas(source){const c=document.createElement('canvas');c.width=source.width;c.height=source.height;c.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0);return c}
function findCanvases(root){
  const wrap=root.querySelector('[data-nxqt-canvas-wrap]');if(!wrap)return{};
  const compare=wrap.querySelector('.nxqt-compare');
  if(compare&&wrap.querySelectorAll('canvas').length<2){
    compare.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:901,button:0,buttons:1}));
    compare.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:901,button:0,buttons:0}));
  }
  const all=[...wrap.querySelectorAll('canvas')],visible=all.find(c=>!c.hidden)||all.at(-1),source=all.find(c=>c!==visible);
  return{wrap,compare,visible,source};
}
async function getVision(){
  if(!visionPromise)visionPromise=(async()=>{
    const mod=await import(TASKS_ESM);
    const fileset=await mod.FilesetResolver.forVisionTasks(WASM_ROOT);
    return{...mod,fileset};
  })().catch(error=>{visionPromise=null;throw error});
  return visionPromise;
}
async function createSegmenter(modelAssetPath,{confidence=false}={}){
  const {ImageSegmenter,fileset}=await getVision();
  const options={baseOptions:{modelAssetPath,delegate:'GPU'},runningMode:'IMAGE',outputCategoryMask:!confidence,outputConfidenceMasks:confidence};
  try{return await ImageSegmenter.createFromOptions(fileset,options)}catch(_){
    options.baseOptions.delegate='CPU';
    return ImageSegmenter.createFromOptions(fileset,options);
  }
}
function getSelfie(){if(!selfiePromise)selfiePromise=createSegmenter(SELFIE_MODEL,{confidence:true}).catch(e=>{selfiePromise=null;throw e});return selfiePromise}
function getSemantic(){if(!semanticPromise)semanticPromise=createSegmenter(DEEPLAB_MODEL,{confidence:false}).catch(e=>{semanticPromise=null;throw e});return semanticPromise}

function segment(segmenter,input){
  return new Promise((resolve,reject)=>{
    let done=false,timer=setTimeout(()=>{if(!done){done=true;reject(new Error('AI matting timed out'))}},16000);
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)};
    try{
      const maybe=segmenter.segment(input,result=>finish(result));
      if(maybe?.confidenceMasks||maybe?.categoryMask)finish(maybe);
      else if(maybe&&typeof maybe.then==='function')maybe.then(finish,reject);
    }catch(error){clearTimeout(timer);reject(error)}
  });
}
function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
function dilateFloat(input,w,h){
  const out=new Float32Array(input.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let m=input[y*w+x];
    for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++)m=Math.max(m,input[yy*w+xx]*.96);
    out[y*w+x]=m;
  }
  return out;
}
function confidenceAlpha(mask){
  const raw=mask.getAsFloat32Array(),w=mask.width,h=mask.height,soft=new Float32Array(raw.length);let high=0,mean=0;
  for(let i=0;i<raw.length;i++){const p=clamp(raw[i],0,1);mean+=p;if(p>.5)high++;soft[i]=smoothstep(.13,.72,p)}
  const coverage=high/raw.length,avg=mean/raw.length;
  if(coverage<.012||coverage>.94||avg<.018)throw new Error('No confident portrait subject found');
  return{alpha:dilateFloat(soft,w,h),w,h,coverage,engine:'Portrait AI'};
}
function categoryAlpha(mask){
  const raw=mask.getAsUint8Array?mask.getAsUint8Array():mask.getAsFloat32Array(),w=mask.width,h=mask.height,hard=new Float32Array(raw.length);let fg=0;
  for(let i=0;i<raw.length;i++){const yes=Number(raw[i])!==0;hard[i]=yes?1:0;if(yes)fg++}
  const coverage=fg/raw.length;if(coverage<.012||coverage>.94)throw new Error('No confident semantic subject found');
  const dilated=dilateFloat(hard,w,h),soft=new Float32Array(raw.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;if(dilated[i]>=.99){soft[i]=1;continue}
    let around=0,count=0;for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){around+=dilated[yy*w+xx];count++}
    soft[i]=around/count;
  }
  return{alpha:soft,w,h,coverage,engine:'Object AI'};
}
async function mlAlpha(source,status){
  try{
    status?.('Loading on-device portrait matting…');
    const selfie=await getSelfie(),portrait=await segment(selfie,source),mask=portrait?.confidenceMasks?.[0];
    if(mask){try{return confidenceAlpha(mask)}finally{portrait?.close?.()}}
  }catch(error){console.warn('NexusNova portrait matting fallback',error)}
  status?.('Checking object segmentation…');
  const semantic=await getSemantic(),result=await segment(semantic,source),mask=result?.categoryMask;
  if(!mask)throw new Error('AI segmentation mask unavailable');
  try{return categoryAlpha(mask)}finally{result?.close?.()}
}
function maskCanvas(meta){
  const c=document.createElement('canvas');c.width=meta.w;c.height=meta.h;const x=c.getContext('2d'),id=x.createImageData(meta.w,meta.h);
  for(let i=0;i<meta.alpha.length;i++){const a=Math.round(clamp(meta.alpha[i],0,1)*255),p=i*4;id.data[p]=255;id.data[p+1]=255;id.data[p+2]=255;id.data[p+3]=a}
  x.putImageData(id,0,0);return c;
}
function applyMatte(source,meta){
  const out=cloneCanvas(source),x=out.getContext('2d');x.globalCompositeOperation='destination-in';x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(maskCanvas(meta),0,0,out.width,out.height);x.globalCompositeOperation='source-over';return out;
}
function installCompare(wrap,source,result){
  wrap.querySelector('.nxqt-compare')?.remove();source.hidden=true;result.hidden=false;
  const b=document.createElement('button');b.type='button';b.className='nxqt-compare';b.textContent='Hold for original';
  const original=()=>{result.hidden=true;source.hidden=false;b.textContent='Original'};
  const processed=()=>{source.hidden=true;result.hidden=false;b.textContent='Hold for original'};
  b.onpointerdown=original;b.onpointerup=b.onpointercancel=b.onpointerleave=processed;wrap.appendChild(b);
}
function blurAlpha(input,w,h,radius){
  if(radius<=0)return input;const temp=new Float32Array(input.length),out=new Uint8ClampedArray(input.length),span=radius*2+1;
  for(let y=0;y<h;y++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=input[y*w+clamp(k,0,w-1)];for(let x=0;x<w;x++){temp[y*w+x]=sum/span;sum-=input[y*w+clamp(x-radius,0,w-1)];sum+=input[y*w+clamp(x+radius+1,0,w-1)]}}
  for(let x=0;x<w;x++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=temp[clamp(k,0,h-1)*w+x];for(let y=0;y<h;y++){out[y*w+x]=Math.round(sum/span);sum-=temp[clamp(y-radius,0,h-1)*w+x];sum+=temp[clamp(y+radius+1,0,h-1)*w+x]}}
  return out;
}
function installRefiner(container,source,pro,exportCanvas){
  container.querySelector('[data-nxqt-refine]')?.closest('.nxqt-controls')?.remove();
  const controls=document.createElement('div');controls.className='nxqt-controls nx-ml-refine';controls.innerHTML=`<div class="nxqt-file-summary"><strong>AI Edge Refine</strong> · non-destructive subject repair</div><div class="nxqt-chips"><button type="button" class="nxqt-chip is-active" data-nxqt-refine="restore" aria-pressed="true">Restore subject</button><button type="button" class="nxqt-chip" data-nxqt-refine="erase" aria-pressed="false">Erase background</button></div><label class="nxqt-field"><span>Brush</span><input type="range" min="3" max="32" value="10" data-nxqt-refine-size><output>10%</output></label><label class="nxqt-field"><span>Softness</span><input type="range" min="0" max="100" value="78" data-nxqt-refine-soft><output>78%</output></label><label class="nxqt-field"><span>Edge feather</span><input type="range" min="0" max="3" value="1" data-nxqt-refine-feather><output>1px</output></label><div class="nxqt-actions"><button type="button" class="nxqt-action" data-nxqt-refine-undo disabled>Undo</button><button type="button" class="nxqt-action" data-nxqt-refine-reset>Reset AI</button></div><div class="nxqt-note" data-nxqt-refine-status>AI matte active. Restore protects hair, face, hands and clothing; Erase cleans residual background.</div>`;
  container.insertBefore(controls,container.querySelector('.nxqt-result-head'));
  const w=pro.width,h=pro.height,total=w*h,sourceData=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),initial=pro.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),alpha=new Uint8ClampedArray(total),auto=new Uint8ClampedArray(total),history=[];
  for(let i=0;i<total;i++){alpha[i]=initial.data[i*4+3];auto[i]=alpha[i]}
  let mode='restore',size=10,softness=78,feather=1,drawing=false,frame=0;
  pro.style.touchAction='none';
  const repaint=()=>{frame=0;const display=feather?blurAlpha(alpha,w,h,feather):alpha,id=new ImageData(new Uint8ClampedArray(sourceData.data),w,h);for(let i=0;i<total;i++)id.data[i*4+3]=display[i];pro.getContext('2d',{willReadFrequently:true}).putImageData(id,0,0);exportCanvas.width=w;exportCanvas.height=h;exportCanvas.getContext('2d').drawImage(pro,0,0)};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(repaint)};
  const save=()=>{history.push(alpha.slice());if(history.length>24)history.shift();controls.querySelector('[data-nxqt-refine-undo]').disabled=!history.length};
  const paint=(clientX,clientY)=>{const r=pro.getBoundingClientRect();if(!r.width||!r.height)return;const cx=clamp((clientX-r.left)/r.width,0,1)*w,cy=clamp((clientY-r.top)/r.height,0,1)*h,rad=Math.max(2,size/100*Math.min(w,h)),hard=clamp(1-softness/100,0,.95),target=mode==='restore'?255:0;for(let y=Math.max(0,Math.floor(cy-rad));y<=Math.min(h-1,Math.ceil(cy+rad));y++)for(let x=Math.max(0,Math.floor(cx-rad));x<=Math.min(w-1,Math.ceil(cx+rad));x++){const d=Math.hypot(x-cx,y-cy)/rad;if(d>1)continue;const weight=d<=hard?1:clamp((1-d)/Math.max(.05,1-hard),0,1),i=y*w+x;alpha[i]=Math.round(alpha[i]*(1-weight)+target*weight)}schedule()};
  controls.querySelectorAll('[data-nxqt-refine]').forEach(b=>b.onclick=()=>{mode=b.dataset.nxqtRefine;controls.querySelectorAll('[data-nxqt-refine]').forEach(n=>{const on=n===b;n.classList.toggle('is-active',on);n.setAttribute('aria-pressed',String(on))})});
  const sz=controls.querySelector('[data-nxqt-refine-size]'),soft=controls.querySelector('[data-nxqt-refine-soft]'),fea=controls.querySelector('[data-nxqt-refine-feather]');
  sz.oninput=()=>{size=Number(sz.value);sz.nextElementSibling.textContent=`${size}%`};soft.oninput=()=>{softness=Number(soft.value);soft.nextElementSibling.textContent=`${softness}%`};fea.oninput=()=>{feather=Number(fea.value);fea.nextElementSibling.textContent=`${feather}px`;schedule()};
  const undo=controls.querySelector('[data-nxqt-refine-undo]');undo.onclick=()=>{const p=history.pop();if(!p)return;alpha.set(p);undo.disabled=!history.length;schedule()};controls.querySelector('[data-nxqt-refine-reset]').onclick=()=>{save();alpha.set(auto);feather=1;fea.value='1';fea.nextElementSibling.textContent='1px';schedule()};
  pro.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;save();drawing=true;pro.setPointerCapture?.(e.pointerId);paint(e.clientX,e.clientY);e.preventDefault()});pro.addEventListener('pointermove',e=>{if(!drawing)return;paint(e.clientX,e.clientY);e.preventDefault()});const end=()=>drawing=false;pro.addEventListener('pointerup',end);pro.addEventListener('pointercancel',end);pro.addEventListener('pointerleave',e=>{if(!(e.buttons&1))drawing=false});
  repaint();
}
async function upgrade(root,container){
  if(container.dataset.nxMlRemoveBg)return;container.dataset.nxMlRemoveBg='loading';
  const state=root.__nxQuickTools?.getState?.();if(state?.tool!=='remove-bg'||state?.screen!=='result'){delete container.dataset.nxMlRemoveBg;return}
  const {wrap,compare,visible,source}=findCanvases(root);if(!wrap||!visible||!source){delete container.dataset.nxMlRemoveBg;return}
  const oldCanvas=visible,original=cloneCanvas(source),head=container.querySelector('.nxqt-result-head'),detail=head?.querySelector('[data-nxqt-result-detail]'),badge=head?.querySelector('.nxqt-success');
  if(badge){badge.textContent='AI';badge.classList.add('nx-ml-busy')}
  if(detail)detail.textContent='Loading on-device AI matting…';
  try{
    const meta=await mlAlpha(original,text=>{if(detail)detail.textContent=text});
    if(root.__nxQuickTools?.getState?.()?.tool!=='remove-bg'||!container.isConnected)return;
    const matte=applyMatte(original,meta),pro=cloneCanvas(matte);oldCanvas.replaceWith(pro);oldCanvas.width=pro.width;oldCanvas.height=pro.height;oldCanvas.getContext('2d').drawImage(pro,0,0);source.hidden=true;installCompare(wrap,source,pro);installRefiner(container,original,pro,oldCanvas);
    if(detail)detail.textContent=`${pro.width} × ${pro.height} · ${meta.engine} matte · ${(meta.coverage*100).toFixed(1)}% subject confidence area`;
    if(badge){badge.textContent='AI READY';badge.classList.remove('nx-ml-busy')}
    container.dataset.nxMlRemoveBg='ready';
  }catch(error){
    console.warn('NexusNova AI Remove BG unavailable; keeping protected local fallback',error);
    if(detail)detail.textContent=`${oldCanvas.width} × ${oldCanvas.height} · protected local fallback · AI matting unavailable`;
    if(badge){badge.textContent='FALLBACK';badge.classList.remove('nx-ml-busy')}
    container.dataset.nxMlRemoveBg='fallback';
  }
}
export function installAiPhotoRemoveBgMlV16(root){
  if(!root||root.__nxAiPhotoRemoveBgMlV16)return()=>{};root.__nxAiPhotoRemoveBgMlV16=true;
  const style=document.createElement('style');style.id='nx-ai-photo-remove-bg-ml-v16';style.textContent=`.nx-ml-busy{animation:nxMlPulse 1s ease-in-out infinite}.nx-ml-refine{border-color:rgba(90,215,164,.24)!important}.nx-ml-refine .nxqt-file-summary strong{color:#9af0ca!important}@keyframes nxMlPulse{50%{opacity:.55}}@media(prefers-reduced-motion:reduce){.nx-ml-busy{animation:none}}`;document.head.appendChild(style);
  let timer=0,destroyed=false;
  const scan=()=>{timer=0;if(destroyed)return;const state=root.__nxQuickTools?.getState?.();if(state?.tool==='remove-bg'&&state?.screen==='result'){const container=root.querySelector('.nxqt-result');if(container&&!container.dataset.nxMlRemoveBg)upgrade(root,container)} };
  const observer=new MutationObserver(()=>{if(!timer)timer=setTimeout(scan,0)});observer.observe(root,{subtree:true,childList:true});scan();
  return()=>{destroyed=true;observer.disconnect();if(timer)clearTimeout(timer);style.remove();delete root.__nxAiPhotoRemoveBgMlV16};
}
