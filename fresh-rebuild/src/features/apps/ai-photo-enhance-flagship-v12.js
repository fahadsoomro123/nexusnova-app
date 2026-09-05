import { generateAiEnhancement,getPuterImageSession,signInPuterForImages } from './ai-photo-studio-ai.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const yieldMain=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));

function cloneCanvas(source,maxDim=Infinity){
  const scale=Math.min(1,maxDim/Math.max(source.width,source.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(source.width*scale));
  canvas.height=Math.max(1,Math.round(source.height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality='high';
  context.drawImage(source,0,0,canvas.width,canvas.height);
  return canvas;
}

async function canvasFromDataUrl(dataUrl){
  const image=new Image();image.src=dataUrl;
  if(image.decode)await image.decode();
  else if(!image.complete)await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,image.naturalWidth||image.width);canvas.height=Math.max(1,image.naturalHeight||image.height);
  const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,0,0);
  return canvas;
}

function sourceAndResult(root){
  const wrap=root.querySelector('.nxqt-result .nxqt-canvas-wrap');
  if(!wrap)return{};
  const compare=wrap.querySelector('.nxqt-compare');
  if(compare&&wrap.querySelectorAll('canvas').length<2){
    compare.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:912,button:0,buttons:1}));
    compare.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:912,button:0,buttons:0}));
  }
  const canvases=[...wrap.querySelectorAll('canvas')];
  const visible=canvases.find(canvas=>!canvas.hidden)||canvases.at(-1);
  const original=canvases.find(canvas=>canvas!==visible);
  return{wrap,original,visible};
}

function percentile(hist,total,fraction,reverse=false){
  let sum=0;
  if(reverse){for(let value=255;value>=0;value--){sum+=hist[value];if(sum>=total*fraction)return value}return 255}
  for(let value=0;value<256;value++){sum+=hist[value];if(sum>=total*fraction)return value}
  return 0;
}

function analyzeScene(image){
  const data=image.data,width=image.width,height=image.height,pixels=width*height,stride=Math.max(1,Math.floor(pixels/90000));
  const hist=new Uint32Array(256);let samples=0,sumLum=0,sumR=0,sumG=0,sumB=0,shadow=0,highlight=0,noiseSum=0,noiseSamples=0;
  for(let pixel=0;pixel<pixels;pixel+=stride){
    const i=pixel*4,r=data[i],g=data[i+1],b=data[i+2],lum=.2126*r+.7152*g+.0722*b;
    hist[Math.round(lum)]++;samples++;sumLum+=lum;sumR+=r;sumG+=g;sumB+=b;if(lum<72)shadow++;if(lum>218)highlight++;
    const x=pixel%width;if(x<width-1){const j=i+4,lum2=.2126*data[j]+.7152*data[j+1]+.0722*data[j+2],delta=Math.abs(lum-lum2);if(delta<18){noiseSum+=Math.abs(r-data[j])+Math.abs(g-data[j+1])+Math.abs(b-data[j+2]);noiseSamples+=3}}
  }
  const meanLum=sumLum/Math.max(1,samples),meanR=sumR/Math.max(1,samples),meanG=sumG/Math.max(1,samples),meanB=sumB/Math.max(1,samples);
  return{
    lo:percentile(hist,samples,.006),hi:percentile(hist,samples,.006,true),meanLum,
    gainR:clamp(meanG/Math.max(8,meanR),.90,1.10),gainB:clamp(meanG/Math.max(8,meanB),.90,1.10),
    shadowShare:shadow/Math.max(1,samples),highlightShare:highlight/Math.max(1,samples),noise:clamp(noiseSum/Math.max(1,noiseSamples)/10,0,1)
  };
}

const MODES={
  natural:{label:'Auto Enhance',contrast:1.038,target:.50,warmth:0,vibrance:1,detail:1,noise:1,unblur:1},
  portrait:{label:'Portrait',contrast:1.018,target:.53,warmth:3.2,vibrance:.72,detail:.70,noise:1.18,unblur:.72},
  detail:{label:'Detail',contrast:1.052,target:.49,warmth:0,vibrance:.82,detail:1.34,noise:.76,unblur:1.28},
  lowlight:{label:'Low Light',contrast:1.024,target:.57,warmth:1.8,vibrance:.86,detail:.72,noise:1.5,unblur:.72}
};
const MODE_PRESETS={
  natural:{strength:82,shadows:45,highlights:52,vibrance:32,detail:46,denoise:20,unblur:28,wb:70},
  portrait:{strength:76,shadows:38,highlights:58,vibrance:22,detail:32,denoise:30,unblur:20,wb:70},
  detail:{strength:84,shadows:34,highlights:48,vibrance:28,detail:64,denoise:14,unblur:54,wb:70},
  lowlight:{strength:86,shadows:62,highlights:62,vibrance:26,detail:30,denoise:58,unblur:24,wb:70}
};

function blurPixels(canvas,radius){
  const blur=document.createElement('canvas');blur.width=canvas.width;blur.height=canvas.height;
  const context=blur.getContext('2d',{willReadFrequently:true});context.filter=`blur(${radius}px)`;context.drawImage(canvas,0,0);context.filter='none';
  return context.getImageData(0,0,blur.width,blur.height).data;
}

async function enhanceCanvas(source,mode,state,{yielding=false,isStale=()=>false}={}){
  const cfg=MODES[mode]||MODES.natural,canvas=cloneCanvas(source),context=canvas.getContext('2d',{willReadFrequently:true});
  const image=context.getImageData(0,0,canvas.width,canvas.height),data=image.data,analysis=analyzeScene(image),mix=clamp(state.strength/100,0,1);
  const autoEv=clamp(Math.log2((cfg.target*255)/Math.max(26,analysis.meanLum)),-.55,.78),exposure=Math.pow(2,autoEv*mix);
  const wbMix=clamp(state.wb/100,0,1)*mix,gainR=1+(analysis.gainR-1)*wbMix,gainB=1+(analysis.gainB-1)*wbMix;
  const range=Math.max(92,analysis.hi-analysis.lo),levelsMix=.40*mix,rowsPerYield=yielding?72:canvas.height;
  for(let y=0;y<canvas.height;y++){
    const row=y*canvas.width*4;
    for(let x=0;x<canvas.width;x++){
      const i=row+x*4,or=data[i],og=data[i+1],ob=data[i+2];
      let r=or*exposure*gainR,g=og*exposure,b=ob*exposure*gainB;
      const leveledR=(r-analysis.lo)*255/range,leveledG=(g-analysis.lo)*255/range,leveledB=(b-analysis.lo)*255/range;
      r=r*(1-levelsMix)+leveledR*levelsMix;g=g*(1-levelsMix)+leveledG*levelsMix;b=b*(1-levelsMix)+leveledB*levelsMix;
      let lum=.2126*r+.7152*g+.0722*b,n=clamp(lum/255,0,1),shadowWeight=Math.pow(1-n,2.15),highlightWeight=Math.pow(n,2.7);
      const shadowLift=state.shadows/100*(18+analysis.shadowShare*18)*shadowWeight*mix,highlightPull=state.highlights/100*(20+analysis.highlightShare*20)*highlightWeight*mix;
      r+=shadowLift-highlightPull;g+=shadowLift-highlightPull;b+=shadowLift-highlightPull;
      lum=.2126*r+.7152*g+.0722*b;
      const max=Math.max(r,g,b),min=Math.min(r,g,b),sat=max<=1?0:(max-min)/max,vib=state.vibrance/100*.38*cfg.vibrance*(1-sat*.72)*mix;
      r=lum+(r-lum)*(1+vib);g=lum+(g-lum)*(1+vib);b=lum+(b-lum)*(1+vib);
      const contrast=1+(cfg.contrast-1)*mix;r=(r-128)*contrast+128+cfg.warmth*mix;g=(g-128)*contrast+128+cfg.warmth*.22*mix;b=(b-128)*contrast+128-cfg.warmth*.45*mix;
      data[i]=clamp(Math.round(or*(1-mix)+r*mix),0,255);data[i+1]=clamp(Math.round(og*(1-mix)+g*mix),0,255);data[i+2]=clamp(Math.round(ob*(1-mix)+b*mix),0,255);
    }
    if(y&&y%rowsPerYield===0&&yielding){await yieldMain();if(isStale())return null}
  }
  context.putImageData(image,0,0);
  if((state.detail>0||state.denoise>0||state.unblur>0)&&mix>0){
    const fine=blurPixels(canvas,.65),wide=blurPixels(canvas,1.45),final=context.getImageData(0,0,canvas.width,canvas.height),out=final.data;
    const detailAmount=state.detail/100*.60*cfg.detail*mix,noiseAmount=state.denoise/100*(.34+analysis.noise*.24)*cfg.noise*mix,unblurAmount=state.unblur/100*.72*cfg.unblur*mix;
    for(let y=0;y<canvas.height;y++){
      const row=y*canvas.width*4;
      for(let x=0;x<canvas.width;x++){
        const i=row+x*4;
        const lum=.2126*out[i]+.7152*out[i+1]+.0722*out[i+2],fineLum=.2126*fine[i]+.7152*fine[i+1]+.0722*fine[i+2],wideLum=.2126*wide[i]+.7152*wide[i+1]+.0722*wide[i+2];
        const microEdge=Math.abs(lum-fineLum),wideEdge=Math.abs(lum-wideLum),flat=1-clamp(microEdge/22,0,1),haloGuard=1-clamp(Math.max(0,wideEdge-18)/28,0,1);
        for(let c=0;c<3;c++){
          const raw=out[i+c],micro=raw-fine[i+c],broad=raw-wide[i+c],cleanMix=noiseAmount*flat;
          const cleaned=raw*(1-cleanMix)+fine[i+c]*cleanMix;
          const microBoost=clamp(micro,-14,14)*detailAmount,focusBoost=clamp(broad,-12,12)*unblurAmount*haloGuard;
          out[i+c]=clamp(Math.round(cleaned+microBoost+focusBoost),0,255);
        }
      }
      if(y&&y%rowsPerYield===0&&yielding){await yieldMain();if(isStale())return null}
    }
    context.putImageData(final,0,0);
  }
  return canvas;
}

function setOutput(input,value,suffix='%'){input.value=String(value);if(input.nextElementSibling)input.nextElementSibling.textContent=`${value}${suffix}`}

function decorateEnhance(root,result){
  if(result.dataset.flagshipEnhance)return;
  result.dataset.flagshipEnhance='v12-performance-safe';
  const {original,visible}=sourceAndResult(root);if(!original||!visible)return;
  let base=cloneCanvas(original),previewBase=cloneCanvas(base,640),lastFullCanvas=cloneCanvas(base);
  const panel=document.createElement('div');panel.className='nxqt-controls nxfs-controls nxfs-enhance-v12';
  panel.innerHTML=`<div class="nxqt-file-summary"><strong>Enhance Pro</strong> · adaptive tone, edge-aware noise cleanup and halo-limited unblur</div><div class="nxqt-chips">${Object.entries(MODES).map(([key,cfg],i)=>`<button type="button" class="nxqt-chip${i?'':' is-active'}" data-nxfs-enhance-mode="${key}" aria-pressed="${i?'false':'true'}">${cfg.label}</button>`).join('')}<button type="button" class="nxqt-chip is-active" data-nxfs-enhance-wb aria-pressed="true">Auto WB</button></div><label class="nxqt-field"><span>Strength</span><input type="range" min="0" max="100" value="82" data-nxfs-enhance="strength"><output>82%</output></label><label class="nxqt-field"><span>Shadows</span><input type="range" min="0" max="100" value="45" data-nxfs-enhance="shadows"><output>45%</output></label><label class="nxqt-field"><span>Highlights</span><input type="range" min="0" max="100" value="52" data-nxfs-enhance="highlights"><output>52%</output></label><label class="nxqt-field"><span>Vibrance</span><input type="range" min="0" max="100" value="32" data-nxfs-enhance="vibrance"><output>32%</output></label><label class="nxqt-field"><span>Detail</span><input type="range" min="0" max="100" value="46" data-nxfs-enhance="detail"><output>46%</output></label><label class="nxqt-field"><span>Noise clean</span><input type="range" min="0" max="100" value="20" data-nxfs-enhance="denoise"><output>20%</output></label><label class="nxqt-field"><span>Unblur</span><input type="range" min="0" max="100" value="28" data-nxfs-enhance="unblur"><output>28%</output></label><div class="nxfs-ai-detail"><div><strong>AI Detail</strong><span>Generative detail reconstruction through Puter Gemini. Uses your Puter allowance; it is not a resize filter.</span></div><div class="nxfs-ai-detail-buttons"><button type="button" class="nxqt-action" data-nxfs-ai-detail="2K">AI Detail 2K</button><button type="button" class="nxqt-action" data-nxfs-ai-detail="4K">AI Detail 4K</button></div></div><div class="nxqt-actions nxfs-enhance-actions"><button type="button" class="nxqt-action" data-nxfs-enhance-reset>Reset</button><div class="nxqt-note" data-nxfs-enhance-status>Preparing full-resolution enhancement…</div></div>`;
  result.insertBefore(panel,result.querySelector('.nxqt-result-head'));
  const state={...MODE_PRESETS.natural},defaults={...MODE_PRESETS.natural};let mode='natural',version=0,previewFrame=0,commitTimer=0,busy=false;
  const status=panel.querySelector('[data-nxfs-enhance-status]'),exportActions=[...result.querySelectorAll('[data-nxqt-download],[data-nxqt-design],[data-nxqt-edit]')],aiButtons=[...panel.querySelectorAll('[data-nxfs-ai-detail]')],controls=[...panel.querySelectorAll('input,button[data-nxfs-enhance-mode],button[data-nxfs-enhance-wb],button[data-nxfs-enhance-reset]')];
  const setBusy=value=>{busy=value;exportActions.forEach(button=>button.disabled=value);aiButtons.forEach(button=>button.disabled=value);controls.forEach(control=>control.disabled=value);panel.setAttribute('aria-busy',String(value))};
  const lockPending=()=>{exportActions.forEach(button=>button.disabled=true);aiButtons.forEach(button=>button.disabled=true);panel.setAttribute('aria-busy','true')};
  const unlockPending=()=>{if(!busy){exportActions.forEach(button=>button.disabled=false);aiButtons.forEach(button=>button.disabled=false);panel.setAttribute('aria-busy','false')}};
  const drawExact=canvas=>{visible.width=canvas.width;visible.height=canvas.height;const context=visible.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.clearRect(0,0,visible.width,visible.height);context.drawImage(canvas,0,0)};
  const syncStateUi=()=>{panel.querySelectorAll('[data-nxfs-enhance]').forEach(input=>setOutput(input,state[input.dataset.nxfsEnhance]));const wb=panel.querySelector('[data-nxfs-enhance-wb]'),wbOn=state.wb>0;wb.classList.toggle('is-active',wbOn);wb.setAttribute('aria-pressed',String(wbOn))};
  const renderPreview=()=>{
    lockPending();if(previewFrame)return;
    const localVersion=++version;previewFrame=requestAnimationFrame(async()=>{previewFrame=0;const out=await enhanceCanvas(previewBase,mode,state);if(!out||localVersion!==version||busy)return;drawExact(out);status.textContent='Live low-resolution preview · release for full-resolution processing.'});
  };
  const commit=async()=>{
    clearTimeout(commitTimer);const localVersion=++version;setBusy(true);status.textContent='Applying full-resolution enhancement · controls stay responsive…';
    try{await yieldMain();const out=await enhanceCanvas(base,mode,state,{yielding:true,isStale:()=>localVersion!==version});if(!out||localVersion!==version)return null;lastFullCanvas=out;drawExact(out);status.textContent=`Full-resolution ready · ${out.width} × ${out.height} · edge-aware detail and noise cleanup.`;return out}
    catch(error){if(localVersion===version)status.textContent='Enhance could not finish. Adjust a control to retry.';return null}
    finally{if(localVersion===version)setBusy(false)}
  };
  const queueCommit=()=>{clearTimeout(commitTimer);commitTimer=setTimeout(commit,280)};
  panel.querySelectorAll('[data-nxfs-enhance]').forEach(input=>{
    input.style.touchAction='pan-y';
    input.oninput=()=>{state[input.dataset.nxfsEnhance]=Number(input.value);if(input.nextElementSibling)input.nextElementSibling.textContent=`${input.value}%`;if(busy){version++;setBusy(false)}renderPreview();queueCommit()};
    input.onchange=commit;input.onpointerup=commit;input.onpointercancel=commit;
  });
  panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(button=>button.onclick=()=>{
    mode=button.dataset.nxfsEnhanceMode;Object.assign(state,MODE_PRESETS[mode]||MODE_PRESETS.natural);syncStateUi();
    panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});renderPreview();queueCommit();
  });
  panel.querySelector('[data-nxfs-enhance-wb]').onclick=event=>{state.wb=state.wb?0:70;const active=state.wb>0;event.currentTarget.classList.toggle('is-active',active);event.currentTarget.setAttribute('aria-pressed',String(active));renderPreview();queueCommit()};
  panel.querySelector('[data-nxfs-enhance-reset]').onclick=()=>{Object.assign(state,defaults);mode='natural';syncStateUi();panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(button=>{const active=button.dataset.nxfsEnhanceMode==='natural';button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});renderPreview();queueCommit()};
  aiButtons.forEach(button=>button.onclick=async()=>{
    if(busy)return;clearTimeout(commitTimer);version++;setBusy(true);const quality=button.dataset.nxfsAiDetail==='4K'?'4K':'2K';status.textContent=`Preparing ${quality} AI Detail with Puter…`;
    try{
      let session=await getPuterImageSession();if(!session.signedIn){status.textContent='Connect Puter to use AI Detail…';session=await signInPuterForImages()}if(!session?.signedIn)throw new Error('Puter sign-in did not complete.');
      await yieldMain();const localSource=await enhanceCanvas(base,mode,state,{yielding:true});if(!localSource)throw new Error('Could not prepare the enhanced source.');lastFullCanvas=localSource;drawExact(localSource);
      status.textContent=`Generating real ${quality} AI Detail · Puter Gemini is reconstructing detail…`;
      const transfer=cloneCanvas(localSource,2048),out=await generateAiEnhancement(transfer.toDataURL('image/png'),{quality,mode:mode==='natural'?'detail':mode}),aiCanvas=await canvasFromDataUrl(out.dataUrl);
      base=cloneCanvas(aiCanvas);previewBase=cloneCanvas(base,640);lastFullCanvas=cloneCanvas(base);drawExact(base);
      Object.assign(state,{strength:0,shadows:0,highlights:0,vibrance:0,detail:0,denoise:0,unblur:0,wb:0});syncStateUi();
      status.textContent=`AI Detail ${quality} ready · actual ${base.width} × ${base.height} · ${out.model}. Review Before/After before export.`;
    }catch(error){drawExact(lastFullCanvas);status.textContent=error?.message||'AI Detail could not finish.'}
    finally{setBusy(false);unlockPending()}
  });
  renderPreview();queueCommit();
}

export function installAiPhotoEnhanceFlagshipV12(root){
  if(!root||root.__nxAiPhotoEnhanceFlagshipV12)return()=>{};
  root.__nxAiPhotoEnhanceFlagshipV12=true;
  const style=document.createElement('style');style.id='nx-ai-photo-enhance-flagship-v12';style.textContent='.nxfs-enhance-v12 input[type=range]{touch-action:pan-y}.nxfs-enhance-actions{grid-template-columns:112px minmax(0,1fr)!important;align-items:stretch}.nxfs-enhance-actions .nxqt-note{display:grid;place-items:center;min-height:44px;padding:7px 9px;text-align:left}.nxfs-enhance-v12[aria-busy=true] [data-nxfs-enhance-status]{color:#d8c4ff;background:rgba(126,64,210,.16)}.nxfs-ai-detail{display:grid;gap:8px;padding:10px;border:1px solid rgba(173,137,255,.24);border-radius:12px;background:rgba(31,24,50,.72)}.nxfs-ai-detail strong{display:block;color:#fff;font-size:11px}.nxfs-ai-detail span{display:block;margin-top:3px;color:#b8b7c5;font-size:8px;line-height:1.45}.nxfs-ai-detail-buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px}.nxfs-ai-detail-buttons .nxqt-action{min-height:40px;color:#fff!important;-webkit-text-fill-color:#fff!important}.nxfs-enhance-v12 button:disabled{opacity:.58!important;color:#c9c7d2!important;-webkit-text-fill-color:#c9c7d2!important}@media(max-width:390px){.nxfs-ai-detail-buttons{grid-template-columns:1fr}}';document.head.appendChild(style);
  const patch=()=>{const state=root.__nxQuickTools?.getState?.();if(state?.open&&state.tool==='enhance'&&state.screen==='result'){const result=root.querySelector('.nxqt-result');if(result)decorateEnhance(root,result)}};
  const observer=new MutationObserver(patch);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});patch();
  return()=>{observer.disconnect();style.remove();delete root.__nxAiPhotoEnhanceFlagshipV12};
}
