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
  if(reverse){
    for(let value=255;value>=0;value--){sum+=hist[value];if(sum>=total*fraction)return value}
    return 255;
  }
  for(let value=0;value<256;value++){sum+=hist[value];if(sum>=total*fraction)return value}
  return 0;
}

function analyzeScene(image){
  const data=image.data,pixels=image.width*image.height,stride=Math.max(1,Math.floor(pixels/90000));
  const hist=new Uint32Array(256);let samples=0,sumLum=0,sumR=0,sumG=0,sumB=0,shadow=0,highlight=0;
  for(let pixel=0;pixel<pixels;pixel+=stride){
    const i=pixel*4,r=data[i],g=data[i+1],b=data[i+2],lum=.2126*r+.7152*g+.0722*b;
    hist[Math.round(lum)]++;samples++;sumLum+=lum;sumR+=r;sumG+=g;sumB+=b;if(lum<72)shadow++;if(lum>218)highlight++;
  }
  const meanLum=sumLum/Math.max(1,samples),meanR=sumR/Math.max(1,samples),meanG=sumG/Math.max(1,samples),meanB=sumB/Math.max(1,samples);
  return{
    lo:percentile(hist,samples,.006),hi:percentile(hist,samples,.006,true),meanLum,
    gainR:clamp(meanG/Math.max(8,meanR),.90,1.10),gainB:clamp(meanG/Math.max(8,meanB),.90,1.10),
    shadowShare:shadow/Math.max(1,samples),highlightShare:highlight/Math.max(1,samples)
  };
}

const MODES={
  natural:{contrast:1.035,target:.50,warmth:0,vibrance:1,detail:1,noise:1},
  portrait:{contrast:1.018,target:.53,warmth:3.5,vibrance:.72,detail:.72,noise:1.18},
  detail:{contrast:1.055,target:.49,warmth:0,vibrance:.82,detail:1.28,noise:.82},
  lowlight:{contrast:1.025,target:.57,warmth:2,vibrance:.86,detail:.76,noise:1.45}
};

async function enhanceCanvas(source,mode,state,{yielding=false,isStale=()=>false}={}){
  const cfg=MODES[mode]||MODES.natural,canvas=cloneCanvas(source),context=canvas.getContext('2d',{willReadFrequently:true});
  const image=context.getImageData(0,0,canvas.width,canvas.height),data=image.data,analysis=analyzeScene(image),mix=clamp(state.strength/100,0,1);
  const autoEv=clamp(Math.log2((cfg.target*255)/Math.max(26,analysis.meanLum)),-.55,.78),exposure=Math.pow(2,autoEv*mix);
  const wbMix=clamp(state.wb/100,0,1)*mix,gainR=1+(analysis.gainR-1)*wbMix,gainB=1+(analysis.gainB-1)*wbMix;
  const range=Math.max(92,analysis.hi-analysis.lo),levelsMix=.40*mix,rowsPerYield=yielding?96:canvas.height;
  for(let y=0;y<canvas.height;y++){
    const row=y*canvas.width*4;
    for(let x=0;x<canvas.width;x++){
      const i=row+x*4,or=data[i],og=data[i+1],ob=data[i+2];
      let r=or*exposure*gainR,g=og*exposure,b=ob*exposure*gainB;
      const leveledR=(r-analysis.lo)*255/range,leveledG=(g-analysis.lo)*255/range,leveledB=(b-analysis.lo)*255/range;
      r=r*(1-levelsMix)+leveledR*levelsMix;g=g*(1-levelsMix)+leveledG*levelsMix;b=b*(1-levelsMix)+leveledB*levelsMix;
      let lum=.2126*r+.7152*g+.0722*b,n=clamp(lum/255,0,1),shadowWeight=Math.pow(1-n,2.15),highlightWeight=Math.pow(n,2.7);
      const shadowLift=state.shadows/100*(18+analysis.shadowShare*18)*shadowWeight*mix;
      const highlightPull=state.highlights/100*(20+analysis.highlightShare*20)*highlightWeight*mix;
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
  if((state.detail>0||state.denoise>0)&&mix>0){
    const blur=document.createElement('canvas');blur.width=canvas.width;blur.height=canvas.height;const bx=blur.getContext('2d',{willReadFrequently:true});
    bx.filter='blur(0.8px)';bx.drawImage(canvas,0,0);bx.filter='none';
    const blurred=bx.getImageData(0,0,blur.width,blur.height).data,final=context.getImageData(0,0,canvas.width,canvas.height),out=final.data;
    const detailAmount=state.detail/100*.68*cfg.detail*mix,noiseAmount=state.denoise/100*.42*cfg.noise*mix;
    for(let y=0;y<canvas.height;y++){
      const row=y*canvas.width*4;
      for(let x=0;x<canvas.width;x++){
        const i=row+x*4;
        for(let c=0;c<3;c++){
          const edge=out[i+c]-blurred[i+c],edgeAbs=Math.abs(edge),flat=1-clamp(edgeAbs/28,0,1);
          const cleaned=out[i+c]*(1-noiseAmount*flat)+blurred[i+c]*(noiseAmount*flat);
          out[i+c]=clamp(Math.round(cleaned+clamp(edge,-18,18)*detailAmount),0,255);
        }
      }
      if(y&&y%rowsPerYield===0&&yielding){await yieldMain();if(isStale())return null}
    }
    context.putImageData(final,0,0);
  }
  return canvas;
}

function setOutput(input,value,suffix='%'){
  input.value=String(value);if(input.nextElementSibling)input.nextElementSibling.textContent=`${value}${suffix}`;
}

function decorateEnhance(root,result){
  if(result.dataset.flagshipEnhance)return;
  result.dataset.flagshipEnhance='v12-performance-safe';
  const {original,visible}=sourceAndResult(root);if(!original||!visible)return;
  const base=cloneCanvas(original),previewBase=cloneCanvas(original,640),panel=document.createElement('div');
  panel.className='nxqt-controls nxfs-controls nxfs-enhance-v12';
  panel.innerHTML=`<div class="nxqt-file-summary"><strong>Enhance Pro</strong> · adaptive tone, highlight recovery, white balance and detail</div><div class="nxqt-chips">${Object.keys(MODES).map((m,i)=>`<button type="button" class="nxqt-chip${i?'':' is-active'}" data-nxfs-enhance-mode="${m}" aria-pressed="${i?'false':'true'}">${m==='lowlight'?'Low Light':m[0].toUpperCase()+m.slice(1)}</button>`).join('')}<button type="button" class="nxqt-chip is-active" data-nxfs-enhance-wb aria-pressed="true">Auto WB</button></div><label class="nxqt-field"><span>Strength</span><input type="range" min="0" max="100" value="82" data-nxfs-enhance="strength"><output>82%</output></label><label class="nxqt-field"><span>Shadows</span><input type="range" min="0" max="100" value="45" data-nxfs-enhance="shadows"><output>45%</output></label><label class="nxqt-field"><span>Highlights</span><input type="range" min="0" max="100" value="52" data-nxfs-enhance="highlights"><output>52%</output></label><label class="nxqt-field"><span>Vibrance</span><input type="range" min="0" max="100" value="32" data-nxfs-enhance="vibrance"><output>32%</output></label><label class="nxqt-field"><span>Detail</span><input type="range" min="0" max="100" value="48" data-nxfs-enhance="detail"><output>48%</output></label><label class="nxqt-field"><span>Noise clean</span><input type="range" min="0" max="100" value="18" data-nxfs-enhance="denoise"><output>18%</output></label><div class="nxqt-actions nxfs-enhance-actions"><button type="button" class="nxqt-action" data-nxfs-enhance-reset>Reset</button><div class="nxqt-note" data-nxfs-enhance-status>Preparing full-resolution enhancement…</div></div>`;
  result.insertBefore(panel,result.querySelector('.nxqt-result-head'));
  const state={strength:82,shadows:45,highlights:52,vibrance:32,detail:48,denoise:18,wb:70},defaults={...state};let mode='natural',version=0,previewFrame=0,commitTimer=0,busy=false;
  const status=panel.querySelector('[data-nxfs-enhance-status]'),actions=[...result.querySelectorAll('[data-nxqt-download],[data-nxqt-design],[data-nxqt-edit]')];
  const setBusy=value=>{busy=value;actions.forEach(button=>button.disabled=value);panel.setAttribute('aria-busy',String(value))};
  const lockPending=()=>{actions.forEach(button=>button.disabled=true);panel.setAttribute('aria-busy','true')};
  const draw=canvas=>{visible.width=base.width;visible.height=base.height;const x=visible.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.clearRect(0,0,visible.width,visible.height);x.drawImage(canvas,0,0,visible.width,visible.height)};
  const renderPreview=()=>{
    lockPending();
    if(previewFrame)return;const localVersion=++version;previewFrame=requestAnimationFrame(async()=>{previewFrame=0;const out=await enhanceCanvas(previewBase,mode,state);if(!out||localVersion!==version||busy)return;draw(out);status.textContent='Live preview · release the slider for full-resolution processing.'});
  };
  const commit=async()=>{
    clearTimeout(commitTimer);const localVersion=++version;setBusy(true);status.textContent='Applying full-resolution enhancement · controls stay responsive…';
    try{
      await yieldMain();const out=await enhanceCanvas(base,mode,state,{yielding:true,isStale:()=>localVersion!==version});
      if(!out||localVersion!==version)return;draw(out);status.textContent=`Full-resolution ready · ${base.width} × ${base.height} · non-destructive controls.`;
    }catch(error){if(localVersion===version)status.textContent='Enhance could not finish. Adjust a control to retry.'}
    finally{if(localVersion===version){setBusy(false)}}
  };
  const queueCommit=()=>{clearTimeout(commitTimer);commitTimer=setTimeout(commit,260)};
  panel.querySelectorAll('[data-nxfs-enhance]').forEach(input=>{
    input.style.touchAction='pan-y';
    input.oninput=()=>{state[input.dataset.nxfsEnhance]=Number(input.value);if(input.nextElementSibling)input.nextElementSibling.textContent=`${input.value}%`;if(busy){version++;setBusy(false)}renderPreview();queueCommit()};
    input.onchange=commit;input.onpointerup=commit;input.onpointercancel=commit;
  });
  panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.nxfsEnhanceMode;panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});renderPreview();queueCommit()});
  panel.querySelector('[data-nxfs-enhance-wb]').onclick=event=>{state.wb=state.wb?0:70;const active=state.wb>0;event.currentTarget.classList.toggle('is-active',active);event.currentTarget.setAttribute('aria-pressed',String(active));renderPreview();queueCommit()};
  panel.querySelector('[data-nxfs-enhance-reset]').onclick=()=>{Object.assign(state,defaults);mode='natural';panel.querySelectorAll('[data-nxfs-enhance]').forEach(input=>setOutput(input,state[input.dataset.nxfsEnhance]));panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(button=>{const active=button.dataset.nxfsEnhanceMode==='natural';button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});const wb=panel.querySelector('[data-nxfs-enhance-wb]');wb.classList.add('is-active');wb.setAttribute('aria-pressed','true');renderPreview();queueCommit()};
  renderPreview();queueCommit();
}

export function installAiPhotoEnhanceFlagshipV12(root){
  if(!root||root.__nxAiPhotoEnhanceFlagshipV12)return()=>{};
  root.__nxAiPhotoEnhanceFlagshipV12=true;
  const style=document.createElement('style');style.id='nx-ai-photo-enhance-flagship-v12';style.textContent='.nxfs-enhance-v12 input[type=range]{touch-action:pan-y}.nxfs-enhance-actions{grid-template-columns:112px minmax(0,1fr)!important;align-items:stretch}.nxfs-enhance-actions .nxqt-note{display:grid;place-items:center;min-height:44px;padding:7px 9px;text-align:left}.nxfs-enhance-v12[aria-busy=true] [data-nxfs-enhance-status]{color:#d8c4ff;background:rgba(126,64,210,.16)}';document.head.appendChild(style);
  const patch=()=>{const state=root.__nxQuickTools?.getState?.();if(state?.open&&state.tool==='enhance'&&state.screen==='result'){const result=root.querySelector('.nxqt-result');if(result)decorateEnhance(root,result)}};
  const observer=new MutationObserver(patch);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});patch();
  return()=>{observer.disconnect();style.remove();delete root.__nxAiPhotoEnhanceFlagshipV12};
}
