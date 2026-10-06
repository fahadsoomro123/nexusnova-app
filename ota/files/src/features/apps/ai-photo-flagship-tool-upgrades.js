const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const raf=()=>new Promise(r=>requestAnimationFrame(r));

function cloneCanvas(source){
  const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
  c.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0);return c;
}
function sourceAndResult(root){
  const wrap=root.querySelector('.nxqt-canvas-wrap');
  if(!wrap)return{};
  const compare=wrap.querySelector('.nxqt-compare');
  if(compare&&wrap.querySelectorAll('canvas').length<2){
    compare.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:77,button:0,buttons:1}));
    compare.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:77,button:0,buttons:0}));
  }
  const canvases=[...wrap.querySelectorAll('canvas')];
  const visible=canvases.find(c=>!c.hidden)||canvases.at(-1);
  const original=canvases.find(c=>c!==visible);
  return {wrap,original,visible};
}
function imageDataFrom(canvas){
  return canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
}
function put(canvas,id){
  canvas.getContext('2d',{willReadFrequently:true}).putImageData(id,0,0);
}
function blend(original,processed,amount){
  const out=new ImageData(new Uint8ClampedArray(processed.data),processed.width,processed.height),a=clamp(amount,0,1);
  for(let i=0;i<out.data.length;i+=4)for(let c=0;c<3;c++)out.data[i+c]=Math.round(original.data[i+c]*(1-a)+processed.data[i+c]*a);
  return out;
}
function boxBlur(data,w,h,r){
  r=Math.max(1,Math.floor(r));const src=new Uint8ClampedArray(data),tmp=new Float32Array(data.length),out=new Uint8ClampedArray(data.length),span=r*2+1;
  for(let y=0;y<h;y++)for(let c=0;c<3;c++){let sum=0;for(let k=-r;k<=r;k++)sum+=src[(y*w+clamp(k,0,w-1))*4+c];for(let x=0;x<w;x++){tmp[(y*w+x)*4+c]=sum/span;sum-=src[(y*w+clamp(x-r,0,w-1))*4+c];sum+=src[(y*w+clamp(x+r+1,0,w-1))*4+c]}}
  for(let x=0;x<w;x++)for(let c=0;c<3;c++){let sum=0;for(let k=-r;k<=r;k++)sum+=tmp[(clamp(k,0,h-1)*w+x)*4+c];for(let y=0;y<h;y++){out[(y*w+x)*4+c]=Math.round(sum/span);sum-=tmp[(clamp(y-r,0,h-1)*w+x)*4+c];sum+=tmp[(clamp(y+r+1,0,h-1)*w+x)*4+c]}}
  for(let i=3;i<out.length;i+=4)out[i]=src[i];return out;
}
function flagshipEnhance(original,mode='natural',strength=82,detail=48,highlights=52,denoise=18){
  const id=imageDataFrom(original),d=id.data,w=id.width,h=id.height,lum=new Float32Array(w*h),hist=new Uint32Array(256);
  for(let i=0,p=0;i<d.length;i+=4,p++){const l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];lum[p]=l;hist[Math.round(l)]++}
  const total=w*h;let lo=0,hi=255,sum=0;for(let i=0;i<256;i++){sum+=hist[i];if(sum>=total*.008){lo=i;break}}sum=0;for(let i=255;i>=0;i--){sum+=hist[i];if(sum>=total*.008){hi=i;break}}
  const range=Math.max(48,hi-lo),cfg={natural:[1.04,1.06,0],portrait:[1.02,1.035,4],detail:[1.09,1.05,0],lowlight:[1.06,1.04,6]}[mode]||[1.04,1.06,0],mix=strength/100;
  for(let i=0,p=0;i<d.length;i+=4,p++){
    let r=(d[i]-lo)*255/range,g=(d[i+1]-lo)*255/range,b=(d[i+2]-lo)*255/range,l=lum[p];
    const hif=Math.pow(clamp(l/255,0,1),2),recover=highlights/100*22*hif;r-=recover;g-=recover;b-=recover;
    const nl=.2126*r+.7152*g+.0722*b;r=nl+(r-nl)*cfg[1];g=nl+(g-nl)*cfg[1];b=nl+(b-nl)*cfg[1];
    r=(r-128)*cfg[0]+128+cfg[2];g=(g-128)*cfg[0]+128+cfg[2]*.45;b=(b-128)*cfg[0]+128-cfg[2]*.3;
    d[i]=clamp(d[i]*(1-mix)+r*mix,0,255);d[i+1]=clamp(d[i+1]*(1-mix)+g*mix,0,255);d[i+2]=clamp(d[i+2]*(1-mix)+b*mix,0,255)
  }
  if(denoise>0){const blurred=boxBlur(d,w,h,1),a=denoise/100*.45;for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++)d[i+c]=Math.round(d[i+c]*(1-a)+blurred[i+c]*a)}
  if(detail>0){const blurred=boxBlur(d,w,h,1),a=detail/100*.72;for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++)d[i+c]=clamp(Math.round(d[i+c]+(d[i+c]-blurred[i+c])*a),0,255)}
  return id;
}
function stagedUpscale(original,factor=2,detail=55,cleanup=18){
  const max=4096,scale=Math.min(factor,max/Math.max(original.width,original.height)),tw=Math.max(original.width,Math.round(original.width*scale)),th=Math.max(original.height,Math.round(original.height*scale));
  let current=cloneCanvas(original);
  while(current.width<tw||current.height<th){const next=document.createElement('canvas');next.width=Math.min(tw,Math.max(current.width+1,Math.round(current.width*1.45)));next.height=Math.min(th,Math.max(current.height+1,Math.round(current.height*1.45)));const x=next.getContext('2d',{willReadFrequently:true});x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(current,0,0,next.width,next.height);current=next}
  const id=imageDataFrom(current),d=id.data,w=id.width,h=id.height;
  if(cleanup>0){const blur=boxBlur(d,w,h,1),a=cleanup/100*.22;for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++)d[i+c]=Math.round(d[i+c]*(1-a)+blur[i+c]*a)}
  if(detail>0){const blur=boxBlur(d,w,h,1),a=detail/100*.85;for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++){const edge=d[i+c]-blur[i+c];d[i+c]=clamp(Math.round(d[i+c]+clamp(edge,-22,22)*a),0,255)}}
  return current;
}
function decorateEnhance(root,result){
  if(result.dataset.flagshipEnhance)return;result.dataset.flagshipEnhance='1';
  const {original,visible}=sourceAndResult(root);if(!original||!visible)return;
  const base=cloneCanvas(original),panel=document.createElement('div');panel.className='nxqt-controls nxfs-controls';
  panel.innerHTML=`<div class="nxqt-file-summary"><strong>Flagship Enhance</strong> · scene-aware tone + detail</div><div class="nxqt-chips">${['natural','portrait','detail','lowlight'].map((m,i)=>`<button class="nxqt-chip${i?'':' is-active'}" data-nxfs-enhance-mode="${m}">${m==='lowlight'?'Low Light':m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div><label class="nxqt-field"><span>Strength</span><input type="range" min="0" max="100" value="82" data-nxfs-enhance="strength"><output>82%</output></label><label class="nxqt-field"><span>Detail</span><input type="range" min="0" max="100" value="48" data-nxfs-enhance="detail"><output>48%</output></label><label class="nxqt-field"><span>Highlights</span><input type="range" min="0" max="100" value="52" data-nxfs-enhance="highlights"><output>52%</output></label><label class="nxqt-field"><span>Noise clean</span><input type="range" min="0" max="100" value="18" data-nxfs-enhance="denoise"><output>18%</output></label>`;
  result.insertBefore(panel,result.querySelector('.nxqt-result-head'));let mode='natural',state={strength:82,detail:48,highlights:52,denoise:18},frame=0;
  const repaint=()=>{frame=0;const id=flagshipEnhance(base,mode,state.strength,state.detail,state.highlights,state.denoise);visible.width=id.width;visible.height=id.height;put(visible,id)};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(repaint)};panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.nxfsEnhanceMode;panel.querySelectorAll('[data-nxfs-enhance-mode]').forEach(x=>x.classList.toggle('is-active',x===b));schedule()});
  panel.querySelectorAll('[data-nxfs-enhance]').forEach(i=>i.oninput=()=>{state[i.dataset.nxfsEnhance]=Number(i.value);i.nextElementSibling.textContent=`${i.value}%`;schedule()});schedule();
}
function decorateUpscale(root,result){
  if(result.dataset.flagshipUpscale)return;result.dataset.flagshipUpscale='1';const {original,visible}=sourceAndResult(root);if(!original||!visible)return;
  const base=cloneCanvas(original),panel=document.createElement('div');panel.className='nxqt-controls nxfs-controls';
  panel.innerHTML=`<div class="nxqt-file-summary"><strong>Flagship Upscale</strong> · staged resampling + detail recovery</div><div class="nxqt-chips">${[2,3,4].map((n,i)=>`<button class="nxqt-chip${i?'':' is-active'}" data-nxfs-scale="${n}">${n}×</button>`).join('')}</div><label class="nxqt-field"><span>Detail recover</span><input type="range" min="0" max="100" value="55" data-nxfs-up="detail"><output>55%</output></label><label class="nxqt-field"><span>Artifact clean</span><input type="range" min="0" max="100" value="18" data-nxfs-up="cleanup"><output>18%</output></label><div class="nxqt-note" data-nxfs-up-note>2× selected · output capped at 4096 px.</div>`;
  result.insertBefore(panel,result.querySelector('.nxqt-result-head'));let factor=2,state={detail:55,cleanup:18},frame=0;
  const repaint=()=>{frame=0;const out=stagedUpscale(base,factor,state.detail,state.cleanup);visible.width=out.width;visible.height=out.height;visible.getContext('2d').drawImage(out,0,0);panel.querySelector('[data-nxfs-up-note]').textContent=`${(out.width/base.width).toFixed(2)}× actual · ${out.width} × ${out.height} · capped at 4096 px.`};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(repaint)};panel.querySelectorAll('[data-nxfs-scale]').forEach(b=>b.onclick=()=>{factor=Number(b.dataset.nxfsScale);panel.querySelectorAll('[data-nxfs-scale]').forEach(x=>x.classList.toggle('is-active',x===b));schedule()});panel.querySelectorAll('[data-nxfs-up]').forEach(i=>i.oninput=()=>{state[i.dataset.nxfsUp]=Number(i.value);i.nextElementSibling.textContent=`${i.value}%`;schedule()});schedule();
}
function decorateFilterResult(root,result){
  if(result.dataset.flagshipFilter)return;result.dataset.flagshipFilter='1';const {original,visible}=sourceAndResult(root);if(!original||!visible||original.width!==visible.width||original.height!==visible.height)return;
  const orig=imageDataFrom(original),filtered=imageDataFrom(visible),panel=document.createElement('div');panel.className='nxqt-controls nxfs-controls';
  panel.innerHTML=`<div class="nxqt-file-summary"><strong>Filter Finishing</strong> · non-destructive intensity</div><label class="nxqt-field"><span>Intensity</span><input type="range" min="0" max="100" value="100" data-nxfs-filter-intensity><output>100%</output></label>`;
  result.insertBefore(panel,result.querySelector('.nxqt-result-head'));const input=panel.querySelector('[data-nxfs-filter-intensity]');input.oninput=()=>{put(visible,blend(orig,filtered,Number(input.value)/100));input.nextElementSibling.textContent=`${input.value}%`};
}
function decorateCollage(root,result){
  if(result.dataset.flagshipCollage)return;result.dataset.flagshipCollage='1';const {visible}=sourceAndResult(root);if(!visible)return;const base=cloneCanvas(visible),panel=document.createElement('div');panel.className='nxqt-controls nxfs-controls';
  panel.innerHTML=`<div class="nxqt-file-summary"><strong>Collage Finishing</strong> · presentation controls</div><label class="nxqt-field"><span>Frame</span><input type="range" min="0" max="80" value="0" data-nxfs-collage-frame><output>0px</output></label><label class="nxqt-field wide"><span>Frame color</span><select data-nxfs-collage-color><option value="#111522">Midnight</option><option value="#ffffff">White</option><option value="#000000">Black</option><option value="#f2ece4">Warm Paper</option></select></label>`;
  result.insertBefore(panel,result.querySelector('.nxqt-result-head'));const frame=panel.querySelector('[data-nxfs-collage-frame]'),color=panel.querySelector('[data-nxfs-collage-color]');
  const repaint=()=>{const f=Number(frame.value),c=document.createElement('canvas');c.width=base.width;c.height=base.height;const x=c.getContext('2d');x.fillStyle=color.value;x.fillRect(0,0,c.width,c.height);x.drawImage(base,f,f,c.width-f*2,c.height-f*2);visible.width=c.width;visible.height=c.height;visible.getContext('2d').drawImage(c,0,0);frame.nextElementSibling.textContent=`${f}px`};frame.oninput=repaint;color.onchange=repaint;
}
function decorateText(root){
  const panel=root.querySelector('.nxqt-panel');if(!panel||panel.dataset.flagshipText)return;const preview=panel.querySelector('[data-nxqt-text-preview] canvas'),input=panel.querySelector('[data-nxqt-text]');if(!preview||!input)return;panel.dataset.flagshipText='1';
  const controls=document.createElement('div');controls.className='nxqt-controls nxfs-controls';controls.innerHTML=`<div class="nxqt-file-summary"><strong>Typography Pro</strong> · tracking, line height, alignment and glow</div><label class="nxqt-field"><span>Tracking</span><input type="range" min="-4" max="24" value="2" data-nxfs-text="tracking"><output>2px</output></label><label class="nxqt-field"><span>Line height</span><input type="range" min="80" max="150" value="105" data-nxfs-text="lineHeight"><output>105%</output></label><label class="nxqt-field"><span>Glow</span><input type="range" min="0" max="60" value="12" data-nxfs-text="glow"><output>12</output></label><div class="nxqt-chips"><button class="nxqt-chip is-active" data-nxfs-align="center">Center</button><button class="nxqt-chip" data-nxfs-align="left">Left</button><button class="nxqt-chip" data-nxfs-align="right">Right</button></div>`;
  panel.insertBefore(controls,panel.querySelector('[data-nxqt-text-preview]'));let state={tracking:2,lineHeight:105,glow:12,align:'center'},base=cloneCanvas(preview),frame=0;
  const repaint=()=>{frame=0;const c=preview,x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.drawImage(base,0,0);const text=String(input.value||'CREATE BOLDLY').trim().slice(0,90),lines=text.split(/\n/).slice(0,4),size=clamp(Number(panel.querySelector('[data-nxqt-text-size]')?.value)||124,54,190),lh=size*state.lineHeight/100,total=(lines.length-1)*lh,start=540-total/2;x.font=`900 ${size}px system-ui,sans-serif`;x.textBaseline='middle';x.textAlign=state.align;x.fillStyle='#f7f2ff';x.shadowColor='rgba(177,93,255,.9)';x.shadowBlur=state.glow;const anchor=state.align==='left'?100:state.align==='right'?980:540;for(let li=0;li<lines.length;li++){const line=lines[li]||' ',chars=[...line];if(!state.tracking){x.fillText(line,anchor,start+li*lh);continue}const widths=chars.map(ch=>x.measureText(ch).width),totalW=widths.reduce((a,b)=>a+b,0)+Math.max(0,chars.length-1)*state.tracking;let sx=state.align==='center'?anchor-totalW/2:state.align==='right'?anchor-totalW:anchor;x.textAlign='left';chars.forEach((ch,idx)=>{x.fillText(ch,sx,start+li*lh);sx+=widths[idx]+state.tracking});x.textAlign=state.align}x.shadowBlur=0};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(repaint)};controls.querySelectorAll('[data-nxfs-text]').forEach(i=>i.oninput=()=>{state[i.dataset.nxfsText]=Number(i.value);i.nextElementSibling.textContent=i.dataset.nxfsText==='lineHeight'?`${i.value}%`:i.dataset.nxfsText==='tracking'?`${i.value}px`:i.value;schedule()});controls.querySelectorAll('[data-nxfs-align]').forEach(b=>b.onclick=()=>{state.align=b.dataset.nxfsAlign;controls.querySelectorAll('[data-nxfs-align]').forEach(x=>x.classList.toggle('is-active',x===b));schedule()});
  input.addEventListener('input',()=>{requestAnimationFrame(()=>{base=cloneCanvas(preview);schedule()})});panel.querySelector('[data-nxqt-text-size]')?.addEventListener('input',()=>requestAnimationFrame(()=>{base=cloneCanvas(preview);schedule()}));panel.querySelectorAll('[data-text-style]').forEach(b=>b.addEventListener('click',()=>requestAnimationFrame(()=>{base=cloneCanvas(preview);schedule()})));schedule();
}
function decoratePhotoAi(root){
  const panel=root.querySelector('[data-photo-sheet-panel="ai"]');if(!panel||panel.dataset.flagshipAiGuard)return;panel.dataset.flagshipAiGuard='1';const buttons=[...panel.querySelectorAll('[data-photo-ai]')],status=panel.querySelector('[data-photo-ai-status]');if(!status||!buttons.length)return;
  const sync=()=>{const busy=/analyzing/i.test(status.textContent||'');buttons.forEach(b=>{b.disabled=busy;b.setAttribute('aria-busy',String(busy))})};new MutationObserver(sync).observe(status,{childList:true,subtree:true,characterData:true});sync();
}
function decorateGenerator(root){
  const wrap=root.querySelector('.nxputer-wrap');if(!wrap||wrap.dataset.flagshipPromptAssist)return;wrap.dataset.flagshipPromptAssist='1';const prompt=wrap.querySelector('[data-puter-prompt]');if(!prompt)return;const label=prompt.closest('.nxputer-label');const row=document.createElement('div');row.className='nxqt-chips nxfs-prompt-assist';row.innerHTML=`<button class="nxqt-chip" data-nxfs-prompt="photo">Pro Photo</button><button class="nxqt-chip" data-nxfs-prompt="portrait">Portrait</button><button class="nxqt-chip" data-nxfs-prompt="product">Product</button><button class="nxqt-chip" data-nxfs-prompt="cinema">Cinema</button><button class="nxqt-chip" data-nxfs-prompt="logo">Logo</button>`;label?.appendChild(row);const prefixes={photo:'Professional editorial photography, realistic lighting, natural materials, precise detail, ',portrait:'Premium portrait photography, natural skin texture, flattering controlled light, identity-consistent face, ',product:'High-end commercial product photography, studio lighting, clean material detail, advertising quality, ',cinema:'Cinematic frame, motivated lighting, controlled color grade, realistic depth, production design, ',logo:'Original clean vector-like brand mark, strong silhouette, simple geometry, scalable identity, '};row.querySelectorAll('[data-nxfs-prompt]').forEach(b=>b.onclick=()=>{const prefix=prefixes[b.dataset.nxfsPrompt];if(!prompt.value.startsWith(prefix)){prompt.value=prefix+prompt.value.trim();prompt.dispatchEvent(new Event('input',{bubbles:true}))}});
}
export function installAiPhotoFlagshipToolUpgrades(root){
  if(!root||root.__nxAiPhotoFlagshipToolUpgrades)return()=>{};root.__nxAiPhotoFlagshipToolUpgrades=true;
  const style=document.createElement('style');style.id='nx-ai-photo-flagship-tool-upgrades';style.textContent='.nxfs-controls strong{color:#fff}.nxfs-prompt-assist{margin-top:7px}.nxfs-prompt-assist .nxqt-chip{min-height:30px!important}.nxqt-controls select{color:#fff!important;background:#191f2d!important}';document.head.appendChild(style);
  let last='';const sync=()=>{decoratePhotoAi(root);decorateGenerator(root);const s=root.__nxQuickTools?.getState?.();if(!s?.open)return;const key=`${s.tool}:${s.screen}`;if(key===last&&s.screen!=='result'&&s.screen!=='text')return;last=key;if(s.screen==='result'){const result=root.querySelector('.nxqt-result');if(!result)return;if(s.tool==='enhance')decorateEnhance(root,result);else if(s.tool==='upscale')decorateUpscale(root,result);else if(s.tool==='filters')decorateFilterResult(root,result);else if(s.tool==='collage')decorateCollage(root,result)}else if(s.tool==='text-art'&&s.screen==='text')decorateText(root)};
  const observer=new MutationObserver(()=>requestAnimationFrame(sync));observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});sync();
  return()=>{observer.disconnect();style.remove();delete root.__nxAiPhotoFlagshipToolUpgrades};
}
