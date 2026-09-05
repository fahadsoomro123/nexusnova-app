const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const coarsePointer=()=>globalThis.matchMedia?.('(pointer: coarse)')?.matches===true;
const constrainedDevice=()=>{
  const memory=Number(globalThis.navigator?.deviceMemory)||8;
  const cores=Number(globalThis.navigator?.hardwareConcurrency)||8;
  return memory<=4||cores<=4;
};

export function previewMaxDimension(container,{min=640,max=1200}={}){
  const r=container?.getBoundingClientRect?.();
  const cssMax=Math.max(r?.width||0,r?.height||0,320);
  const coarse=coarsePointer();
  const constrained=constrainedDevice();
  const phoneCap=constrained?680:coarse?840:max;
  const effectiveMax=Math.min(max,phoneCap);
  const dpr=clamp(Number(globalThis.devicePixelRatio)||1,1,coarse?1.45:2);
  return Math.round(clamp(cssMax*dpr*1.2,min,effectiveMax));
}

export function createPreviewScheduler(render){
  let raf=0,timer=0,pending=null,destroyed=false,lastRun=0;
  const minGap=coarsePointer()?(constrainedDevice()?42:30):16;
  const run=()=>{
    raf=0;timer=0;
    if(destroyed||!pending)return;
    const payload=pending;
    pending=null;
    lastRun=performance.now();
    render(payload);
  };
  const arm=()=>{
    if(destroyed||raf||timer)return;
    const wait=Math.max(0,minGap-(performance.now()-lastRun));
    if(wait>3){
      timer=setTimeout(()=>{timer=0;if(!destroyed&&!raf)raf=requestAnimationFrame(run)},wait);
    }else raf=requestAnimationFrame(run);
  };
  return {
    schedule(payload={}){
      if(destroyed)return;
      pending=payload;
      arm();
    },
    flush(payload={}){
      if(destroyed)return;
      if(raf){cancelAnimationFrame(raf);raf=0}
      if(timer){clearTimeout(timer);timer=0}
      pending=null;
      lastRun=performance.now();
      render(payload);
    },
    cancel(){
      destroyed=true;
      pending=null;
      if(raf)cancelAnimationFrame(raf);
      if(timer)clearTimeout(timer);
      raf=0;timer=0;
    }
  };
}

export function createIntervalGate(interval=180){
  let last=0,timer=0,pending=null;
  return {
    run(fn){
      const now=performance.now();
      const wait=interval-(now-last);
      if(wait<=0){
        last=now;
        fn();
        return;
      }
      pending=fn;
      if(timer)return;
      timer=setTimeout(()=>{
        timer=0;
        last=performance.now();
        const next=pending;
        pending=null;
        next?.();
      },wait);
    },
    cancel(){if(timer)clearTimeout(timer);timer=0;pending=null}
  };
}

export function bindFocusInteraction(root,element,{holdMs=180}={}){
  if(!root||!element)return()=>{};
  const row=element.closest('.nx-photo-field,.nx-photo-preset,.nx-photo-action,.nx-photo-pill,.nx-photo-ratio')||element;
  let timer=0;
  const on=()=>{
    clearTimeout(timer);
    root.querySelectorAll('.is-live-control').forEach(n=>n.classList.remove('is-live-control'));
    row.classList.add('is-live-control');
    root.classList.add('nx-photo-control-live');
  };
  const off=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      row.classList.remove('is-live-control');
      if(!root.querySelector('.is-live-control'))root.classList.remove('nx-photo-control-live');
    },holdMs);
  };
  element.addEventListener('pointerdown',on);
  element.addEventListener('focus',on);
  element.addEventListener('pointerup',off);
  element.addEventListener('pointercancel',off);
  element.addEventListener('change',off);
  element.addEventListener('blur',off);
  return()=>{
    clearTimeout(timer);
    row.classList.remove('is-live-control');
    element.removeEventListener('pointerdown',on);
    element.removeEventListener('focus',on);
    element.removeEventListener('pointerup',off);
    element.removeEventListener('pointercancel',off);
    element.removeEventListener('change',off);
    element.removeEventListener('blur',off);
  };
}
