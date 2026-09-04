const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function previewMaxDimension(container,{min=640,max=1200}={}){
  const r=container?.getBoundingClientRect?.();
  const cssMax=Math.max(r?.width||0,r?.height||0,320);
  const dpr=clamp(Number(globalThis.devicePixelRatio)||1,1,2);
  return Math.round(clamp(cssMax*dpr*1.35,min,max));
}

export function createPreviewScheduler(render){
  let raf=0,pending=null,destroyed=false;
  const run=()=>{
    raf=0;
    if(destroyed||!pending)return;
    const payload=pending;
    pending=null;
    render(payload);
  };
  return {
    schedule(payload={}){
      if(destroyed)return;
      pending=payload;
      if(!raf)raf=requestAnimationFrame(run);
    },
    flush(payload={}){
      if(destroyed)return;
      if(raf){cancelAnimationFrame(raf);raf=0}
      pending=null;
      render(payload);
    },
    cancel(){
      destroyed=true;
      pending=null;
      if(raf)cancelAnimationFrame(raf);
      raf=0;
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
