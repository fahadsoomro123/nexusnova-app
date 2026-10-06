const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function alignElements(design,ids,mode='left'){
  const next=clone(design),set=new Set(ids||[]),els=next.elements.filter(x=>set.has(x.id)&&!x.locked);if(!els.length)return next;
  const minX=Math.min(...els.map(x=>x.x)),maxX=Math.max(...els.map(x=>x.x+x.w)),minY=Math.min(...els.map(x=>x.y)),maxY=Math.max(...els.map(x=>x.y+x.h));
  for(const el of els){
    if(mode==='left')el.x=minX;else if(mode==='right')el.x=maxX-el.w;else if(mode==='center')el.x=(minX+maxX-el.w)/2;
    else if(mode==='top')el.y=minY;else if(mode==='bottom')el.y=maxY-el.h;else if(mode==='middle')el.y=(minY+maxY-el.h)/2;
    el.x=clamp(el.x,0,1-el.w);el.y=clamp(el.y,0,1-el.h);
  }
  next.updatedAt=Date.now();return next;
}

export function distributeElements(design,ids,axis='x'){
  const next=clone(design),set=new Set(ids||[]),els=next.elements.filter(x=>set.has(x.id)&&!x.locked);if(els.length<3)return next;
  els.sort((a,b)=>axis==='y'?a.y-b.y:a.x-b.x);
  if(axis==='x'){const start=els[0].x,end=els.at(-1).x,step=(end-start)/(els.length-1);els.forEach((el,i)=>el.x=clamp(start+step*i,0,1-el.w))}
  else{const start=els[0].y,end=els.at(-1).y,step=(end-start)/(els.length-1);els.forEach((el,i)=>el.y=clamp(start+step*i,0,1-el.h))}
  next.updatedAt=Date.now();return next;
}

export function nudgeElements(design,ids,dx=0,dy=0){
  const next=clone(design),set=new Set(ids||[]);for(const el of next.elements){if(!set.has(el.id)||el.locked)continue;el.x=clamp(el.x+dx,0,1-el.w);el.y=clamp(el.y+dy,0,1-el.h)}next.updatedAt=Date.now();return next;
}

export function resizeElement(design,id,{x,y,w,h,rotation}={}){
  const next=clone(design),el=next.elements.find(x=>x.id===id);if(!el||el.locked)return next;
  if(Number.isFinite(w))el.w=clamp(w,.01,1);if(Number.isFinite(h))el.h=clamp(h,.01,1);if(Number.isFinite(x))el.x=clamp(x,0,1-el.w);if(Number.isFinite(y))el.y=clamp(y,0,1-el.h);if(Number.isFinite(rotation))el.rotation=rotation%360;next.updatedAt=Date.now();return next;
}

export function toggleLock(design,id){const next=clone(design),el=next.elements.find(x=>x.id===id);if(el)el.locked=!el.locked;next.updatedAt=Date.now();return next}
export function toggleHidden(design,id){const next=clone(design),el=next.elements.find(x=>x.id===id);if(el)el.hidden=!el.hidden;next.updatedAt=Date.now();return next}
