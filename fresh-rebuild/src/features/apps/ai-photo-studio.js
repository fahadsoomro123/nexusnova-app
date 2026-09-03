import { aiModel, downloadBlob, ensureStudioStyles, fileToInline, safeName } from './premium-studio-core.js';

const DEFAULTS = Object.freeze({
  exposure:0, brightness:0, contrast:0, highlights:0, shadows:0, whites:0, blacks:0,
  temperature:0, tint:0, vibrance:0, saturation:0, clarity:0, dehaze:0,
  sharpness:0, noiseReduction:0, vignette:0, grain:0, fade:0, blur:0,
  rotation:0, straighten:0, flipX:false, flipY:false, cropRatio:'free',
  mix:{
    red:{h:0,s:0,l:0}, orange:{h:0,s:0,l:0}, yellow:{h:0,s:0,l:0}, green:{h:0,s:0,l:0},
    aqua:{h:0,s:0,l:0}, blue:{h:0,s:0,l:0}, purple:{h:0,s:0,l:0}, magenta:{h:0,s:0,l:0}
  }
});

const PRESETS = Object.freeze({
  clean:{exposure:.08,contrast:7,highlights:-8,shadows:8,vibrance:10,sharpness:8},
  vivid:{exposure:.05,contrast:14,highlights:-12,shadows:8,vibrance:28,saturation:8,clarity:10},
  cinema:{exposure:-.08,contrast:18,highlights:-22,shadows:12,temperature:5,saturation:-8,fade:5,vignette:12},
  portrait:{exposure:.12,contrast:4,highlights:-16,shadows:18,temperature:4,vibrance:8,clarity:-5,sharpness:5},
  mono:{contrast:18,saturation:-100,clarity:16,grain:8},
  soft:{exposure:.18,contrast:-8,highlights:-15,shadows:18,clarity:-10,fade:8},
  dramatic:{exposure:-.05,contrast:25,highlights:-28,shadows:10,clarity:22,dehaze:16,vignette:18},
  golden:{exposure:.12,temperature:18,tint:4,vibrance:14,highlights:-12,shadows:10},
  cool:{temperature:-18,tint:-2,contrast:8,vibrance:12},
  matte:{contrast:-4,blacks:14,fade:18,saturation:-5,grain:5},
  crisp:{contrast:10,clarity:18,sharpness:22,dehaze:8,vibrance:8},
  noir:{exposure:-.12,contrast:28,blacks:-10,saturation:-100,grain:12,vignette:20}
});

const MIX_COLORS = ['red','orange','yellow','green','aqua','blue','purple','magenta'];
const cloneState = s => JSON.parse(JSON.stringify(s));
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const clamp8 = v => clamp(Math.round(v),0,255);

function ensurePhotoStyles(){
  ensureStudioStyles();
  if(document.getElementById('nx-photo-editor-v3')) return;
  const style=document.createElement('style');
  style.id='nx-photo-editor-v3';
  style.textContent=`
  .nx-photo-editor{--p-bg:#f3f3f5;--p-s:#fff;--p-s2:#f8f8fa;--p-t:#17171a;--p-m:#6f6f76;--p-l:#e2e2e7;--p-purple:#7d2ae8;position:relative!important;width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important;padding:0!important;border:0!important;border-radius:20px!important;background:var(--p-bg)!important;color:var(--p-t)!important;box-shadow:0 8px 26px rgba(20,20,25,.12)!important;color-scheme:light dark}
  .nx-photo-editor::before{display:none!important}.nx-photo-editor *{box-sizing:border-box}.nx-photo-editor button,.nx-photo-editor input,.nx-photo-editor textarea,.nx-photo-editor select{font:inherit}.nx-photo-editor button{border:0!important;background:transparent!important;box-shadow:none!important;color:var(--p-t)!important;font-size:13px!important;font-weight:650!important;letter-spacing:0!important;transform:none!important}.nx-photo-editor button:active{transform:scale(.97)!important}.nx-photo-editor button:disabled{opacity:.35!important}
  .nx-photo-frame{height:100%;display:grid;grid-template-rows:48px minmax(0,1fr) 60px;overflow:hidden}.nx-photo-top{z-index:5;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;padding:6px 8px;border-bottom:1px solid var(--p-l);background:color-mix(in srgb,var(--p-s) 94%,transparent);backdrop-filter:blur(16px)}.nx-photo-project{min-width:0;text-align:center;line-height:1.05}.nx-photo-project strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.nx-photo-project span{display:block;margin-top:3px;color:var(--p-m);font-size:10px}.nx-photo-top-actions{display:flex;gap:2px;align-items:center}.nx-photo-mini{width:34px!important;height:34px!important;padding:0!important;border-radius:9px!important}.nx-photo-add{height:36px!important;padding:0 11px!important;border:1px solid var(--p-l)!important;border-radius:9px!important;background:var(--p-s2)!important}.nx-photo-export-top{height:36px!important;padding:0 12px!important;border-radius:9px!important;background:linear-gradient(135deg,#8b3dff,#6d25df)!important;color:#fff!important;font-weight:750!important}
  .nx-photo-work{position:relative;min-height:0;overflow:hidden;display:grid;place-items:center;touch-action:none;background:linear-gradient(45deg,rgba(120,120,130,.055) 25%,transparent 25%,transparent 75%,rgba(120,120,130,.055) 75%),linear-gradient(45deg,rgba(120,120,130,.055) 25%,transparent 25%,transparent 75%,rgba(120,120,130,.055) 75%),#e9e9ec;background-size:24px 24px;background-position:0 0,12px 12px}.nx-photo-work canvas{display:block;max-width:92%;max-height:92%;object-fit:contain;border-radius:2px;box-shadow:0 14px 42px rgba(20,20,25,.22);transform-origin:center;will-change:transform}.nx-photo-empty{width:min(86%,390px);padding:28px 24px;border:1px dashed #bdbdc5;border-radius:16px;background:rgba(255,255,255,.82);text-align:center;box-shadow:0 8px 22px rgba(0,0,0,.06)}.nx-photo-empty i{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 12px;border-radius:14px;background:linear-gradient(135deg,#8b3dff,#6d25df);color:#fff;font-style:normal;font-size:25px}.nx-photo-empty strong{display:block;font-size:18px}.nx-photo-empty p{margin:7px 0 15px;color:var(--p-m);font-size:13px;line-height:1.4}.nx-photo-primary{height:44px!important;padding:0 18px!important;border-radius:10px!important;background:linear-gradient(135deg,#8b3dff,#6d25df)!important;color:#fff!important;font-size:14px!important;font-weight:750!important}.nx-photo-before{position:absolute;top:10px;right:10px;z-index:4;height:34px!important;padding:0 11px!important;border:1px solid rgba(0,0,0,.08)!important;border-radius:9px!important;background:rgba(255,255,255,.93)!important;color:#28282d!important}.nx-photo-zoomlabel{position:absolute;right:10px;bottom:10px;z-index:3;height:29px;padding:7px 9px;border:1px solid rgba(0,0,0,.08);border-radius:8px;background:rgba(255,255,255,.92);color:#444;font-size:11px;font-weight:700;pointer-events:none}.nx-photo-toast{position:absolute;z-index:9;top:10px;left:50%;max-width:78%;transform:translate(-50%,-6px);padding:8px 12px;border-radius:10px;background:rgba(24,24,28,.9);color:#fff;font-size:12px;opacity:0;pointer-events:none;transition:.18s}.nx-photo-toast.is-on{opacity:1;transform:translate(-50%,0)}
  .nx-photo-tools{z-index:6;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid var(--p-l);background:var(--p-s)}.nx-photo-tool{display:grid!important;place-items:center!important;align-content:center!important;gap:3px!important;height:60px!important;padding:3px!important;border-radius:0!important;color:var(--p-m)!important}.nx-photo-tool b{font-size:18px;font-weight:500;line-height:1}.nx-photo-tool span{font-size:10px}.nx-photo-tool.is-active{color:var(--p-purple)!important}
  .nx-photo-sheet{position:absolute;z-index:7;left:6px;right:6px;bottom:64px;max-height:min(54%,390px);overflow:hidden;border:1px solid var(--p-l);border-radius:16px;background:color-mix(in srgb,var(--p-s) 97%,transparent);box-shadow:0 -10px 35px rgba(20,20,25,.16);backdrop-filter:blur(18px);transform:translateY(12px);opacity:0;pointer-events:none;transition:.18s}.nx-photo-sheet.is-open{transform:none;opacity:1;pointer-events:auto}.nx-photo-sheet-head{height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--p-l)}.nx-photo-sheet-head strong{font-size:14px}.nx-photo-close{width:32px!important;height:32px!important;padding:0!important;font-size:19px!important;color:var(--p-m)!important}.nx-photo-panel{display:none;height:calc(100% - 42px);padding:8px 10px;overflow:auto;overscroll-behavior:contain}.nx-photo-panel.is-active{display:block}.nx-photo-row{display:flex;gap:7px;align-items:center}.nx-photo-row+.nx-photo-row{margin-top:7px}.nx-photo-action{flex:1;min-width:0;height:38px!important;padding:0 8px!important;border:1px solid var(--p-l)!important;border-radius:10px!important;background:var(--p-s2)!important;font-size:11px!important}.nx-photo-action.is-active{border-color:var(--p-purple)!important;color:var(--p-purple)!important;background:color-mix(in srgb,var(--p-purple) 8%,var(--p-s2))!important}.nx-photo-field{display:grid;grid-template-columns:82px minmax(0,1fr) 44px;align-items:center;gap:7px;min-height:33px}.nx-photo-field+.nx-photo-field{margin-top:3px}.nx-photo-field span{font-size:11px}.nx-photo-field output{font-size:10px;text-align:right;color:var(--p-m)}.nx-photo-editor input[type=range]{width:100%!important;height:25px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;accent-color:var(--p-purple)}.nx-photo-tabs{display:flex;gap:5px;overflow:auto;padding:0 0 8px;scrollbar-width:none}.nx-photo-tabs::-webkit-scrollbar{display:none}.nx-photo-tab{flex:0 0 auto;height:31px!important;padding:0 10px!important;border:1px solid var(--p-l)!important;border-radius:999px!important;background:var(--p-s2)!important;font-size:10px!important;color:var(--p-m)!important}.nx-photo-tab.is-active{border-color:var(--p-purple)!important;color:var(--p-purple)!important;background:color-mix(in srgb,var(--p-purple) 8%,var(--p-s2))!important}.nx-photo-sub{display:none}.nx-photo-sub.is-active{display:block}.nx-photo-ratios{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.nx-photo-ratio{height:34px!important;border:1px solid var(--p-l)!important;border-radius:9px!important;background:var(--p-s2)!important;font-size:10px!important}.nx-photo-ratio.is-active{border-color:var(--p-purple)!important;color:var(--p-purple)!important}.nx-photo-presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.nx-photo-preset{height:46px!important;border:1px solid var(--p-l)!important;border-radius:10px!important;background:var(--p-s2)!important;font-size:11px!important}.nx-photo-color-pills{display:flex;gap:5px;overflow:auto;padding-bottom:7px;scrollbar-width:none}.nx-photo-color-pills::-webkit-scrollbar{display:none}.nx-photo-color{flex:0 0 auto;height:31px!important;padding:0 9px!important;border:1px solid var(--p-l)!important;border-radius:999px!important;background:var(--p-s2)!important;font-size:10px!important;text-transform:capitalize}.nx-photo-color.is-active{border-color:var(--p-purple)!important;color:var(--p-purple)!important}
  .nx-photo-ai-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.nx-photo-ai-action{height:42px!important;border:1px solid var(--p-l)!important;border-radius:10px!important;background:var(--p-s2)!important;font-size:11px!important}.nx-photo-ai-action strong{display:block;font-size:11px}.nx-photo-ai-action small{display:block;margin-top:2px;color:var(--p-m);font-size:8px}.nx-photo-ai label{display:block;margin:7px 0 4px;color:var(--p-m);font-size:10px}.nx-photo-editor textarea{width:100%!important;height:72px!important;padding:9px!important;resize:none!important;overflow:auto!important;border:1px solid var(--p-l)!important;border-radius:10px!important;background:var(--p-s2)!important;box-shadow:none!important;color:var(--p-t)!important;font-size:12px!important;line-height:1.35!important;outline:none!important}.nx-photo-status{margin-top:5px;color:var(--p-m);font-size:10px;line-height:1.3;min-height:13px}.nx-photo-export-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end}.nx-photo-select label{display:block;margin-bottom:5px;color:var(--p-m);font-size:11px}.nx-photo-editor select{width:100%!important;height:39px!important;padding:0 10px!important;border:1px solid var(--p-l)!important;border-radius:9px!important;background:var(--p-s2)!important;box-shadow:none!important;color:var(--p-t)!important;font-size:13px!important}.nx-photo-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.nx-photo-metrics div{padding:7px 4px;border:1px solid var(--p-l);border-radius:9px;background:var(--p-s2);text-align:center}.nx-photo-metrics b{display:block;font-size:13px}.nx-photo-metrics span{display:block;color:var(--p-m);font-size:9px}
  @media(prefers-color-scheme:dark){.nx-photo-editor{--p-bg:#17171a;--p-s:#232326;--p-s2:#2c2c30;--p-t:#f6f6f7;--p-m:#aaaab2;--p-l:#3a3a40}.nx-photo-work{background:linear-gradient(45deg,rgba(255,255,255,.035) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.035) 75%),linear-gradient(45deg,rgba(255,255,255,.035) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.035) 75%),#111114;background-size:24px 24px;background-position:0 0,12px 12px}.nx-photo-empty{border-color:#4a4a50;background:rgba(35,35,38,.9)}.nx-photo-before,.nx-photo-zoomlabel{border-color:#3b3b40!important;background:rgba(35,35,38,.94)!important;color:#f5f5f6!important}}
  @media(max-width:520px){.nx-photo-frame{grid-template-rows:46px minmax(0,1fr) 58px}.nx-photo-top{padding:5px 6px;gap:4px}.nx-photo-add{padding:0 8px!important;font-size:12px!important}.nx-photo-mini{width:31px!important;height:34px!important}.nx-photo-export-top{height:34px!important;padding:0 9px!important;font-size:12px!important}.nx-photo-project strong{font-size:13px}.nx-photo-project span{font-size:9px}.nx-photo-tool{height:58px!important}.nx-photo-sheet{bottom:62px;left:5px;right:5px;max-height:56%}.nx-photo-panel{padding:7px 8px}.nx-photo-field{grid-template-columns:72px minmax(0,1fr) 40px}}
  @media(max-height:720px){.nx-photo-frame{grid-template-rows:42px minmax(0,1fr) 54px}.nx-photo-tool{height:54px!important}.nx-photo-sheet{bottom:58px;max-height:58%}.nx-photo-sheet-head{height:36px}.nx-photo-panel{height:calc(100% - 36px);padding:6px 8px}.nx-photo-action{height:34px!important}.nx-photo-preset{height:39px!important}}
  @media(prefers-reduced-motion:reduce){.nx-photo-sheet,.nx-photo-toast{transition:none}}
  `;
  document.head.appendChild(style);
}

function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
  if(max===min) return [0,0,l];
  const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);
  let h;
  if(max===r) h=(g-b)/d+(g<b?6:0);
  else if(max===g) h=(b-r)/d+2;
  else h=(r-g)/d+4;
  return [h/6,s,l];
}
function hslToRgb(h,s,l){
  if(s===0){const v=l*255;return[v,v,v]}
  const hue=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  return [hue(p,q,h+1/3)*255,hue(p,q,h)*255,hue(p,q,h-1/3)*255];
}
function colorBucket(h){
  const d=h*360;
  if(d<15||d>=345)return'red'; if(d<45)return'orange'; if(d<75)return'yellow'; if(d<165)return'green';
  if(d<195)return'aqua'; if(d<255)return'blue'; if(d<285)return'purple'; return'magenta';
}
function applyColorMix(r,g,b,mix){
  let [h,s,l]=rgbToHsl(r,g,b); const m=mix[colorBucket(h)]||{h:0,s:0,l:0};
  h=(h+m.h/360+1)%1; s=clamp(s*(1+m.s/100),0,1); l=clamp(l+m.l/200,0,1);
  return hslToRgb(h,s,l);
}
function sharpenImage(data,w,h,amount){
  if(amount<=0)return;
  const src=new Uint8ClampedArray(data),a=clamp(amount/100,0,1)*1.3;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=(y*w+x)*4;
    for(let c=0;c<3;c++){
      const center=src[i+c]*5-src[i-4+c]-src[i+4+c]-src[i-w*4+c]-src[i+w*4+c];
      data[i+c]=clamp8(src[i+c]*(1-a)+center*a);
    }
  }
}
function processPixels(imageData,state){
  const d=imageData.data,w=imageData.width,h=imageData.height;
  const exp=Math.pow(2,state.exposure||0);
  const contrast=(259*((state.contrast||0)+255))/(255*(259-(state.contrast||0)));
  const sat=1+(state.saturation||0)/100, vib=(state.vibrance||0)/100;
  const clarity=(state.clarity||0)/100, dehaze=(state.dehaze||0)/100;
  const temp=(state.temperature||0)*.75, tint=(state.tint||0)*.55;
  const fade=(state.fade||0)/100, vig=(state.vignette||0)/100, grain=(state.grain||0)/100;
  const cx=w/2,cy=h/2,maxDist=Math.hypot(cx,cy);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    let r=d[i],g=d[i+1],b=d[i+2];
    r*=exp;g*=exp;b*=exp;
    const lum=.2126*r+.7152*g+.0722*b;
    const hi=Math.pow(clamp(lum/255,0,1),2), sh=Math.pow(1-clamp(lum/255,0,1),2);
    const lift=(state.shadows||0)*1.15*sh+(state.highlights||0)*1.05*hi+(state.whites||0)*.5*hi+(state.blacks||0)*.5*sh;
    r+=lift;g+=lift;b+=lift;
    const br=(state.brightness||0)*1.2;r+=br;g+=br;b+=br;
    r=contrast*(r-128)+128;g=contrast*(g-128)+128;b=contrast*(b-128)+128;
    r+=temp+Math.max(0,tint*.35);b-=temp+Math.max(0,tint*.35);g-=tint;
    let gray=.2126*r+.7152*g+.0722*b;
    r=gray+(r-gray)*sat;g=gray+(g-gray)*sat;b=gray+(b-gray)*sat;
    const maxc=Math.max(r,g,b),minc=Math.min(r,g,b),colorfulness=(maxc-minc)/255;
    const vf=1+vib*(1-colorfulness);
    r=gray+(r-gray)*vf;g=gray+(g-gray)*vf;b=gray+(b-gray)*vf;
    [r,g,b]=applyColorMix(r,g,b,state.mix);
    const localContrast=1+clarity*.35+dehaze*.45;
    r=(r-128)*localContrast+128;g=(g-128)*localContrast+128;b=(b-128)*localContrast+128;
    if(dehaze>0){const boost=1+dehaze*.25;gray=.2126*r+.7152*g+.0722*b;r=gray+(r-gray)*boost;g=gray+(g-gray)*boost;b=gray+(b-gray)*boost}
    if(fade){r=r*(1-fade*.35)+255*fade*.08;g=g*(1-fade*.35)+255*fade*.08;b=b*(1-fade*.35)+255*fade*.08}
    if(vig){const dist=Math.hypot(x-cx,y-cy)/maxDist, f=1-vig*Math.pow(clamp((dist-.25)/.75,0,1),1.7)*.75;r*=f;g*=f;b*=f}
    if(grain){const seed=((x*73856093)^(y*19349663))&255, n=((seed/255)-.5)*grain*42;r+=n;g+=n;b+=n}
    d[i]=clamp8(r);d[i+1]=clamp8(g);d[i+2]=clamp8(b);
  }
  sharpenImage(d,w,h,state.sharpness||0);
  return imageData;
}
function ratioValue(key){
  const map={square:1,portrait:4/5,classic:3/4,story:9/16,wide:16/9,landscape:4/3};
  return map[key]||null;
}
function drawBase(canvas,image,state,original=false){
  if(!image)return;
  const max=2400,scale=Math.min(1,max/Math.max(image.naturalWidth||1,image.naturalHeight||1));
  const srcW=Math.max(1,Math.round(image.naturalWidth*scale)),srcH=Math.max(1,Math.round(image.naturalHeight*scale));
  const ratio=original?null:ratioValue(state.cropRatio);
  let cropW=srcW,cropH=srcH;
  if(ratio){
    if(srcW/srcH>ratio)cropW=Math.round(srcH*ratio);
    else cropH=Math.round(srcW/ratio);
  }
  const rot=((original?0:state.rotation)||0)+(original?0:(state.straighten||0));
  const rightAngle=Math.abs((state.rotation||0)%180)===90;
  canvas.width=rightAngle?cropH:cropW;canvas.height=rightAngle?cropW:cropH;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();
  ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rot*Math.PI/180);ctx.scale(original?1:(state.flipX?-1:1),original?1:(state.flipY?-1:1));
  const blur=original?0:(state.blur||0);ctx.filter=blur>0?`blur(${blur}px)`:'none';
  const sx=(srcW-cropW)/2/scale,sy=(srcH-cropH)/2/scale,sw=cropW/scale,sh=cropH/scale;
  ctx.drawImage(image,sx,sy,sw,sh,-cropW/2,-cropH/2,cropW,cropH);ctx.restore();
  if(!original){
    const id=ctx.getImageData(0,0,canvas.width,canvas.height);processPixels(id,state);ctx.putImageData(id,0,0);
    if((state.noiseReduction||0)>0){
      const tmp=document.createElement('canvas');tmp.width=canvas.width;tmp.height=canvas.height;
      const t=tmp.getContext('2d');t.filter=`blur(${0.15+(state.noiseReduction/100)*.65}px)`;t.drawImage(canvas,0,0);
      ctx.save();ctx.globalAlpha=clamp(state.noiseReduction/100,0,.65);ctx.drawImage(tmp,0,0);ctx.restore();
    }
  }
}
function slider(label,key,min,max,step=1,suffix=''){
  const val=key==='exposure'?'0':String(DEFAULTS[key]??0);
  return `<div class="nx-photo-field"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-photo-range="${key}"><output>${val}${suffix}</output></div>`;
}
function aiJsonPrompt(mode){
  const goals={
    auto:'balanced flagship photo enhancement with natural contrast, recovered highlights, open shadows, accurate color and crisp detail',
    relight:'natural professional relighting only; improve exposure, highlights and shadows without changing identity or scene',
    color:'accurate white balance and premium color correction without oversaturation',
    portrait:'natural portrait polish; protect skin texture and identity, use gentle light/color/detail adjustments only'
  };
  return `Analyze this image for ${goals[mode]||goals.auto}. Return ONLY valid JSON, no markdown, with numeric keys: exposure(-1..1), brightness(-20..20), contrast(-30..30), highlights(-50..50), shadows(-50..50), whites(-30..30), blacks(-30..30), temperature(-30..30), tint(-30..30), vibrance(-30..40), saturation(-25..25), clarity(-20..30), dehaze(-10..25), sharpness(0..35), noiseReduction(0..35), vignette(0..20), fade(0..15).`;
}

export function renderAiPhotoStudio(){
  ensurePhotoStyles();
  const root=document.createElement('div');root.className='nx-app-body nx-studio nx-photo-editor';
  root.innerHTML=`<div class="nx-photo-frame">
    <header class="nx-photo-top"><button class="nx-photo-add" type="button" data-photo-import-top>＋ Add</button><div class="nx-photo-project"><strong data-photo-name>AI Photo Studio</strong><span data-photo-meta>Canva-style mobile workspace</span></div><div class="nx-photo-top-actions"><button class="nx-photo-mini" type="button" data-photo-undo disabled aria-label="Undo">↶</button><button class="nx-photo-mini" type="button" data-photo-redo disabled aria-label="Redo">↷</button><button class="nx-photo-export-top" type="button" data-photo-export-open>Export</button></div></header>
    <main class="nx-photo-work" data-photo-work><canvas data-photo-canvas hidden></canvas><div class="nx-photo-empty" data-photo-empty><i>＋</i><strong>Start with a photo</strong><p>JPG, PNG or WebP. Pro edits run locally; NexusNova AI analyzes only when you choose an AI action.</p><button class="nx-photo-primary" type="button" data-photo-import-empty>Add photo</button></div><button class="nx-photo-before" type="button" data-photo-before hidden>Hold for original</button><div class="nx-photo-zoomlabel" data-photo-zoomlabel hidden>100%</div><div class="nx-photo-toast" data-photo-toast></div></main>
    <nav class="nx-photo-tools"><button class="nx-photo-tool" type="button" data-photo-panel-open="edit"><b>✦</b><span>Edit</span></button><button class="nx-photo-tool" type="button" data-photo-panel-open="adjust"><b>☷</b><span>Adjust</span></button><button class="nx-photo-tool" type="button" data-photo-panel-open="looks"><b>◐</b><span>Filters</span></button><button class="nx-photo-tool" type="button" data-photo-panel-open="ai"><b>✧</b><span>AI</span></button><button class="nx-photo-tool" type="button" data-photo-panel-open="export"><b>⇩</b><span>Export</span></button></nav>
  </div><input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file hidden>
  <aside class="nx-photo-sheet" data-photo-sheet><div class="nx-photo-sheet-head"><strong data-photo-sheet-title>Edit</strong><button class="nx-photo-close" type="button" data-photo-sheet-close>×</button></div>
    <section class="nx-photo-panel" data-photo-sheet-panel="edit">
      <div class="nx-photo-tabs"><button class="nx-photo-tab is-active" data-photo-subtab="transform">Transform</button><button class="nx-photo-tab" data-photo-subtab="geometry">Geometry</button><button class="nx-photo-tab" data-photo-subtab="detail">Detail</button></div>
      <div class="nx-photo-sub is-active" data-photo-sub="transform"><div class="nx-photo-row"><button class="nx-photo-action" data-photo-replace>Replace</button><button class="nx-photo-action" data-photo-rotate>Rotate</button><button class="nx-photo-action" data-photo-fliph>Flip H</button><button class="nx-photo-action" data-photo-flipv>Flip V</button></div><div class="nx-photo-status">Crop ratio</div><div class="nx-photo-ratios"><button class="nx-photo-ratio is-active" data-photo-ratio="free">Free</button><button class="nx-photo-ratio" data-photo-ratio="square">1:1</button><button class="nx-photo-ratio" data-photo-ratio="portrait">4:5</button><button class="nx-photo-ratio" data-photo-ratio="classic">3:4</button><button class="nx-photo-ratio" data-photo-ratio="story">9:16</button><button class="nx-photo-ratio" data-photo-ratio="wide">16:9</button><button class="nx-photo-ratio" data-photo-ratio="landscape">4:3</button><button class="nx-photo-ratio" data-photo-reset>Reset</button></div><div class="nx-photo-field" style="margin-top:7px"><span>Zoom</span><input type="range" min="60" max="300" value="100" data-photo-zoom><output data-photo-zoom-output>100%</output></div></div>
      <div class="nx-photo-sub" data-photo-sub="geometry">${slider('Straighten','straighten',-15,15,.1,'°')}<div class="nx-photo-status">Fine rotation keeps the approved workspace unchanged while correcting horizons.</div></div>
      <div class="nx-photo-sub" data-photo-sub="detail">${slider('Sharpness','sharpness',0,100)}${slider('Noise reduce','noiseReduction',0,100)}${slider('Soft blur','blur',0,12,.1,'px')}${slider('Clarity','clarity',-50,50)}${slider('Dehaze','dehaze',-30,50)}</div>
    </section>
    <section class="nx-photo-panel" data-photo-sheet-panel="adjust">
      <div class="nx-photo-tabs"><button class="nx-photo-tab is-active" data-photo-subtab="light">Light</button><button class="nx-photo-tab" data-photo-subtab="color">Color</button><button class="nx-photo-tab" data-photo-subtab="mix">Color Mix</button><button class="nx-photo-tab" data-photo-subtab="effects">Effects</button></div>
      <div class="nx-photo-sub is-active" data-photo-sub="light">${slider('Exposure','exposure',-2,2,.05)}${slider('Brightness','brightness',-100,100)}${slider('Contrast','contrast',-100,100)}${slider('Highlights','highlights',-100,100)}${slider('Shadows','shadows',-100,100)}${slider('Whites','whites',-100,100)}${slider('Blacks','blacks',-100,100)}</div>
      <div class="nx-photo-sub" data-photo-sub="color">${slider('Temperature','temperature',-100,100)}${slider('Tint','tint',-100,100)}${slider('Vibrance','vibrance',-100,100)}${slider('Saturation','saturation',-100,100)}</div>
      <div class="nx-photo-sub" data-photo-sub="mix"><div class="nx-photo-color-pills">${MIX_COLORS.map((c,i)=>`<button class="nx-photo-color${i===0?' is-active':''}" data-photo-mix-color="${c}">${c}</button>`).join('')}</div><div class="nx-photo-field"><span>Hue</span><input type="range" min="-60" max="60" value="0" data-photo-mix="h"><output>0</output></div><div class="nx-photo-field"><span>Saturation</span><input type="range" min="-100" max="100" value="0" data-photo-mix="s"><output>0</output></div><div class="nx-photo-field"><span>Luminance</span><input type="range" min="-100" max="100" value="0" data-photo-mix="l"><output>0</output></div></div>
      <div class="nx-photo-sub" data-photo-sub="effects">${slider('Vignette','vignette',0,100)}${slider('Grain','grain',0,100)}${slider('Fade','fade',0,100)}${slider('Clarity','clarity',-50,50)}${slider('Dehaze','dehaze',-30,50)}</div>
    </section>
    <section class="nx-photo-panel" data-photo-sheet-panel="looks"><div class="nx-photo-presets">${Object.keys(PRESETS).map(k=>`<button class="nx-photo-preset" type="button" data-photo-preset="${k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div></section>
    <section class="nx-photo-panel" data-photo-sheet-panel="ai"><div class="nx-photo-ai"><div class="nx-photo-ai-actions"><button class="nx-photo-ai-action" data-photo-ai="auto"><strong>Auto Enhance</strong><small>AI-guided full correction</small></button><button class="nx-photo-ai-action" data-photo-ai="relight"><strong>Relight</strong><small>Light & shadow balance</small></button><button class="nx-photo-ai-action" data-photo-ai="color"><strong>Color Fix</strong><small>White balance & color</small></button><button class="nx-photo-ai-action" data-photo-ai="portrait"><strong>Portrait Polish</strong><small>Natural, identity-safe tuning</small></button></div><label>AI analysis / creative brief</label><textarea data-photo-prompt placeholder="Optional intent, e.g. natural premium portrait"></textarea><div class="nx-photo-row" style="margin-top:6px"><button class="nx-photo-primary" type="button" data-photo-analyze>Analyze</button><button class="nx-photo-action" type="button" data-photo-copy>Copy</button></div><div class="nx-photo-status" data-photo-ai-status>NexusNova AI ready. No external website redirect.</div></div></section>
    <section class="nx-photo-panel" data-photo-sheet-panel="export"><div class="nx-photo-export-grid"><div><div class="nx-photo-select"><label>Format</label><select data-photo-format><option value="image/webp">WebP</option><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></div><div class="nx-photo-field" style="grid-template-columns:52px 1fr 38px;margin-top:7px"><span>Quality</span><input type="range" min="60" max="100" value="94" data-photo-quality><output data-photo-quality-output>94%</output></div></div><button class="nx-photo-primary" type="button" data-photo-export disabled>Export photo</button></div><div class="nx-photo-metrics"><div><b data-photo-width>—</b><span>WIDTH</span></div><div><b data-photo-height>—</b><span>HEIGHT</span></div><div><b data-photo-mp>—</b><span>MP</span></div></div><div class="nx-photo-status" data-photo-export-status>No photo loaded.</div></section>
  </aside>`;

  const file=root.querySelector('[data-photo-file]'),canvas=root.querySelector('[data-photo-canvas]'),empty=root.querySelector('[data-photo-empty]'),work=root.querySelector('[data-photo-work]'),sheet=root.querySelector('[data-photo-sheet]'),exportBtn=root.querySelector('[data-photo-export]'),undoBtn=root.querySelector('[data-photo-undo]'),redoBtn=root.querySelector('[data-photo-redo]'),beforeBtn=root.querySelector('[data-photo-before]'),zoomInput=root.querySelector('[data-photo-zoom]'),zoomOut=root.querySelector('[data-photo-zoom-output]'),zoomLabel=root.querySelector('[data-photo-zoomlabel]');
  let state=cloneState(DEFAULTS),image=null,sourceFile=null,toastTimer=0,mixColor='red',pinchStart=0,pinchZoom=1,panId=null,panLast=null,busy=false;
  const view={zoom:1,x:0,y:0},history=[],redo=[],pointers=new Map();
  const snap=()=>cloneState(state),historyButtons=()=>{undoBtn.disabled=!history.length;redoBtn.disabled=!redo.length};
  const push=previous=>{history.push(previous||snap());if(history.length>30)history.shift();redo.length=0;historyButtons()};
  const toast=text=>{const n=root.querySelector('[data-photo-toast]');n.textContent=String(text).slice(0,160);n.classList.add('is-on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('is-on'),2100)};
  const applyView=()=>{canvas.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.zoom})`;const p=`${Math.round(view.zoom*100)}%`;zoomInput.value=Math.round(view.zoom*100);zoomOut.textContent=p;zoomLabel.textContent=p};
  const resetView=()=>{view.zoom=1;view.x=0;view.y=0;applyView()};
  const formatValue=(key,v)=>key==='exposure'?Number(v).toFixed(2):key==='straighten'?`${Number(v).toFixed(1)}°`:key==='blur'?`${Number(v).toFixed(1)}px`:`${Math.round(v)}`;
  const sync=()=>{
    root.querySelectorAll('[data-photo-range]').forEach(i=>{const k=i.dataset.photoRange;i.value=state[k];i.nextElementSibling.textContent=formatValue(k,state[k])});
    root.querySelectorAll('[data-photo-ratio]').forEach(b=>b.classList.toggle('is-active',b.dataset.photoRatio===state.cropRatio));
    root.querySelectorAll('[data-photo-mix]').forEach(i=>{i.value=state.mix[mixColor][i.dataset.photoMix];i.nextElementSibling.textContent=Math.round(i.value)});
  };
  const paint=(original=false)=>{if(!image)return;drawBase(canvas,image,state,original);if(!original){root.querySelector('[data-photo-width]').textContent=canvas.width;root.querySelector('[data-photo-height]').textContent=canvas.height;root.querySelector('[data-photo-mp]').textContent=((canvas.width*canvas.height)/1e6).toFixed(1)}applyView()};
  const closeSheet=()=>{sheet.classList.remove('is-open');root.querySelectorAll('[data-photo-panel-open]').forEach(b=>b.classList.remove('is-active'))};
  const openSheet=id=>{const titles={edit:'Edit',adjust:'Adjust',looks:'Filters',ai:'NexusNova AI',export:'Export'};root.querySelector('[data-photo-sheet-title]').textContent=titles[id]||'Edit';root.querySelectorAll('[data-photo-sheet-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.photoSheetPanel===id));root.querySelectorAll('[data-photo-panel-open]').forEach(b=>b.classList.toggle('is-active',b.dataset.photoPanelOpen===id));sheet.classList.add('is-open')};
  const importPhoto=()=>file.click();root.querySelector('[data-photo-import-top]').onclick=importPhoto;root.querySelector('[data-photo-import-empty]').onclick=importPhoto;root.querySelector('[data-photo-replace]').onclick=importPhoto;
  root.querySelector('[data-photo-sheet-close]').onclick=closeSheet;root.querySelector('[data-photo-export-open]').onclick=()=>openSheet('export');root.querySelectorAll('[data-photo-panel-open]').forEach(b=>b.onclick=()=>sheet.classList.contains('is-open')&&b.classList.contains('is-active')?closeSheet():openSheet(b.dataset.photoPanelOpen));
  root.querySelectorAll('[data-photo-subtab]').forEach(b=>b.onclick=()=>{const panel=b.closest('[data-photo-sheet-panel]');panel.querySelectorAll('[data-photo-subtab]').forEach(x=>x.classList.toggle('is-active',x===b));panel.querySelectorAll('[data-photo-sub]').forEach(x=>x.classList.toggle('is-active',x.dataset.photoSub===b.dataset.photoSubtab))});

  file.addEventListener('change',()=>{const selected=file.files?.[0];if(!selected)return;if(!/^image\/(jpeg|png|webp)$/i.test(selected.type)){toast('Use JPG, PNG or WebP.');return}const url=URL.createObjectURL(selected),next=new Image();next.onload=()=>{if(sourceFile?.__url)URL.revokeObjectURL(sourceFile.__url);sourceFile=selected;sourceFile.__url=url;image=next;state=cloneState(DEFAULTS);history.length=0;redo.length=0;historyButtons();sync();resetView();canvas.hidden=false;empty.hidden=true;beforeBtn.hidden=false;zoomLabel.hidden=false;exportBtn.disabled=false;root.querySelector('[data-photo-name]').textContent=selected.name;root.querySelector('[data-photo-meta]').textContent=`${next.naturalWidth} × ${next.naturalHeight}`;root.querySelector('[data-photo-export-status]').textContent='Ready to export.';paint();closeSheet();toast('Photo ready')};next.onerror=()=>{URL.revokeObjectURL(url);toast('Could not open image.')};next.src=url});

  root.querySelectorAll('[data-photo-range]').forEach(input=>{let before=null;const remember=()=>{before=snap()};input.onpointerdown=remember;input.onfocus=()=>{if(!before)remember()};input.oninput=()=>{const k=input.dataset.photoRange;state[k]=Number(input.value);input.nextElementSibling.textContent=formatValue(k,state[k]);paint()};input.onchange=()=>{if(before)push(before);before=null}});
  root.querySelectorAll('[data-photo-mix-color]').forEach(b=>b.onclick=()=>{mixColor=b.dataset.photoMixColor;root.querySelectorAll('[data-photo-mix-color]').forEach(x=>x.classList.toggle('is-active',x===b));sync()});
  root.querySelectorAll('[data-photo-mix]').forEach(input=>{let before=null;input.onpointerdown=()=>{before=snap()};input.oninput=()=>{state.mix[mixColor][input.dataset.photoMix]=Number(input.value);input.nextElementSibling.textContent=Math.round(input.value);paint()};input.onchange=()=>{if(before)push(before);before=null}});
  root.querySelectorAll('[data-photo-ratio]').forEach(b=>b.onclick=()=>{if(!image)return;push();state.cropRatio=b.dataset.photoRatio;sync();resetView();paint()});
  root.querySelector('[data-photo-rotate]').onclick=()=>{if(!image)return;push();state.rotation=(state.rotation+90)%360;resetView();paint()};
  root.querySelector('[data-photo-fliph]').onclick=()=>{if(!image)return;push();state.flipX=!state.flipX;paint()};
  root.querySelector('[data-photo-flipv]').onclick=()=>{if(!image)return;push();state.flipY=!state.flipY;paint()};
  root.querySelectorAll('[data-photo-reset]').forEach(b=>b.onclick=()=>{if(!image)return;push();state=cloneState(DEFAULTS);sync();resetView();paint();toast('Edits reset')});
  root.querySelectorAll('[data-photo-preset]').forEach(b=>b.onclick=()=>{if(!image){toast('Add a photo first.');return}push();const p=PRESETS[b.dataset.photoPreset]||PRESETS.clean;Object.entries(p).forEach(([k,v])=>{if(k in state)state[k]=v});sync();paint();toast(`${b.textContent} applied`)});
  undoBtn.onclick=()=>{if(!history.length)return;redo.push(snap());state=history.pop();sync();paint();historyButtons()};redoBtn.onclick=()=>{if(!redo.length)return;history.push(snap());state=redo.pop();sync();paint();historyButtons()};
  beforeBtn.onpointerdown=()=>image&&paint(true);['pointerup','pointercancel','pointerleave'].forEach(e=>beforeBtn.addEventListener(e,()=>image&&paint()));
  zoomInput.oninput=()=>{view.zoom=clamp(Number(zoomInput.value)/100,.6,3);if(view.zoom<=1){view.x=0;view.y=0}applyView()};work.ondblclick=resetView;
  work.addEventListener('pointerdown',e=>{if(!image||e.target.closest('button'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});work.setPointerCapture?.(e.pointerId);if(pointers.size===2){const[a,b]=[...pointers.values()];pinchStart=Math.hypot(a.x-b.x,a.y-b.y)||1;pinchZoom=view.zoom;panId=null;panLast=null}else if(view.zoom>1){panId=e.pointerId;panLast={x:e.clientX,y:e.clientY}}});
  work.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1;view.zoom=clamp(pinchZoom*d/pinchStart,.6,3);if(view.zoom<=1){view.x=0;view.y=0}applyView()}else if(panId===e.pointerId&&panLast&&view.zoom>1){view.x+=e.clientX-panLast.x;view.y+=e.clientY-panLast.y;panLast={x:e.clientX,y:e.clientY};applyView()}});
  const release=e=>{pointers.delete(e.pointerId);if(panId===e.pointerId){panId=null;panLast=null}};work.onpointerup=release;work.onpointercancel=release;

  const aiStatus=root.querySelector('[data-photo-ai-status]'),prompt=root.querySelector('[data-photo-prompt]');
  const runAiAdjust=async mode=>{if(!sourceFile){toast('Add a photo first.');return}if(busy)return;busy=true;aiStatus.textContent='NexusNova AI analyzing image…';try{const[model,data]=await Promise.all([aiModel('You are NexusNova Photo AI. Analyze visible image content only. Never invent objects. For edit actions return only the requested JSON adjustment values.'),fileToInline(sourceFile,12)]);const result=await model.generateContent([{inlineData:data},{text:aiJsonPrompt(mode)}]);let text=String(result?.response?.text?.()||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();const obj=JSON.parse(text);const limits={exposure:[-1,1],brightness:[-20,20],contrast:[-30,30],highlights:[-50,50],shadows:[-50,50],whites:[-30,30],blacks:[-30,30],temperature:[-30,30],tint:[-30,30],vibrance:[-30,40],saturation:[-25,25],clarity:[-20,30],dehaze:[-10,25],sharpness:[0,35],noiseReduction:[0,35],vignette:[0,20],fade:[0,15]};push();for(const[k,[lo,hi]]of Object.entries(limits))if(Number.isFinite(Number(obj[k])))state[k]=clamp(Number(obj[k]),lo,hi);sync();paint();aiStatus.textContent=`${mode==='auto'?'Auto Enhance':mode==='relight'?'Relight':mode==='color'?'Color Fix':'Portrait Polish'} applied in-app.`;toast('NexusNova AI edit applied')}catch(error){aiStatus.textContent=String(error?.message||'NexusNova AI unavailable.').slice(0,220)}finally{busy=false}};
  root.querySelectorAll('[data-photo-ai]').forEach(b=>b.onclick=()=>runAiAdjust(b.dataset.photoAi));
  root.querySelector('[data-photo-analyze]').onclick=async()=>{if(!sourceFile){aiStatus.textContent='Add a photo first.';toast('Add a photo first.');return}if(busy)return;busy=true;aiStatus.textContent='Analyzing visible image content…';try{const[model,data]=await Promise.all([aiModel('You are NexusNova Photo AI, a professional photo art director. Analyze only visible content. Give concise practical lighting, color, crop and detail recommendations. Do not claim edits were applied.'),fileToInline(sourceFile,12)]);const result=await model.generateContent([{inlineData:data},{text:`User intent: ${prompt.value.trim()||'premium natural enhancement'}. Return a concise professional edit brief.`}]);const text=String(result?.response?.text?.()||'').trim();if(!text)throw new Error('AI returned no direction.');prompt.value=text.slice(0,1800);aiStatus.textContent='NexusNova AI analysis ready.';toast('AI analysis ready')}catch(error){aiStatus.textContent=String(error?.message||'NexusNova AI unavailable.').slice(0,220)}finally{busy=false}};
  root.querySelector('[data-photo-copy]').onclick=async()=>{if(!prompt.value.trim())return;try{await navigator.clipboard.writeText(prompt.value);aiStatus.textContent='Analysis copied.';toast('Copied')}catch{aiStatus.textContent='Clipboard permission unavailable.'}};

  const quality=root.querySelector('[data-photo-quality]');quality.oninput=()=>root.querySelector('[data-photo-quality-output]').textContent=`${quality.value}%`;exportBtn.onclick=()=>{if(!image){toast('Add a photo first.');return}const type=root.querySelector('[data-photo-format]').value,q=clamp(Number(quality.value)/100,.6,1),status=root.querySelector('[data-photo-export-status]');status.textContent='Preparing export…';canvas.toBlob(blob=>{if(!blob){status.textContent='Export failed.';return}const ext=type==='image/png'?'png':type==='image/jpeg'?'jpg':'webp';downloadBlob(blob,`${safeName(sourceFile?.name,'nexusnova-photo')}-edited.${ext}`);status.textContent=`${ext.toUpperCase()} exported locally.`;toast('Export complete')},type,q)};
  root.__cleanup=()=>{clearTimeout(toastTimer);if(sourceFile?.__url)URL.revokeObjectURL(sourceFile.__url)};
  return root;
}
