const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const uid=()=>`el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

export function createDesignFromTemplate(template){
  if(!template?.canvas||!Array.isArray(template.elements))throw new Error('Invalid template');
  return {
    id:`design-${Date.now().toString(36)}`,
    name:template.name||'Untitled design',
    width:Number(template.canvas.width)||1080,
    height:Number(template.canvas.height)||1080,
    background:template.background||'#ffffff',
    elements:clone(template.elements).map((el,i)=>({...el,id:el.id||uid(),z:i})),
    selection:[],
    updatedAt:Date.now()
  };
}

export function addDesignElement(design,element){
  const next=clone(design);const item={id:uid(),type:'rect',x:.1,y:.1,w:.2,h:.2,fill:'#ffffff',rotation:0,opacity:1,...clone(element)};
  item.x=clamp(Number(item.x)||0,0,1);item.y=clamp(Number(item.y)||0,0,1);item.w=clamp(Number(item.w)||.1,.01,1);item.h=clamp(Number(item.h)||.1,.01,1);item.z=next.elements.length;
  next.elements.push(item);next.selection=[item.id];next.updatedAt=Date.now();return next;
}

export function updateDesignElement(design,id,patch){
  const next=clone(design);const item=next.elements.find(x=>x.id===id);if(!item)return next;Object.assign(item,clone(patch));
  item.x=clamp(Number(item.x)||0,0,1);item.y=clamp(Number(item.y)||0,0,1);item.w=clamp(Number(item.w)||.01,.01,1);item.h=clamp(Number(item.h)||.01,.01,1);item.opacity=clamp(Number(item.opacity??1),0,1);next.updatedAt=Date.now();return next;
}

export function removeDesignElements(design,ids){
  const set=new Set(ids||[]),next=clone(design);next.elements=next.elements.filter(x=>!set.has(x.id)).map((x,i)=>({...x,z:i}));next.selection=next.selection.filter(id=>!set.has(id));next.updatedAt=Date.now();return next;
}

export function reorderDesignElement(design,id,mode='front'){
  const next=clone(design),idx=next.elements.findIndex(x=>x.id===id);if(idx<0)return next;const [item]=next.elements.splice(idx,1);
  if(mode==='back')next.elements.unshift(item);else if(mode==='forward')next.elements.splice(Math.min(next.elements.length,idx+1),0,item);else if(mode==='backward')next.elements.splice(Math.max(0,idx-1),0,item);else next.elements.push(item);
  next.elements=next.elements.map((x,i)=>({...x,z:i}));next.updatedAt=Date.now();return next;
}

export function selectDesignElements(design,ids){const next=clone(design);const valid=new Set(next.elements.map(x=>x.id));next.selection=(ids||[]).filter(id=>valid.has(id));return next}

export function serializeDesign(design){return JSON.stringify({...clone(design),selection:[]})}
export function deserializeDesign(text){const d=JSON.parse(String(text));if(!d||!Array.isArray(d.elements))throw new Error('Invalid design');return d}

function roundedRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,rr):(ctx.rect(x,y,w,h));}

export function renderDesignToCanvas(design,canvas,{pixelRatio=1}={}){
  if(!design||!canvas)throw new Error('Design and canvas required');
  const ratio=clamp(Number(pixelRatio)||1,.25,4),w=Math.max(1,Math.round(design.width*ratio)),h=Math.max(1,Math.round(design.height*ratio));canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.fillStyle=design.background||'#fff';ctx.fillRect(0,0,w,h);
  const sx=w/design.width,sy=h/design.height;
  for(const el of [...design.elements].sort((a,b)=>(a.z||0)-(b.z||0))){
    if(el.hidden)continue;const x=(el.x||0)*w,y=(el.y||0)*h,ew=(el.w||0)*w,eh=(el.h||0)*h;ctx.save();ctx.globalAlpha=clamp(Number(el.opacity??1),0,1);ctx.translate(x+ew/2,y+eh/2);ctx.rotate((Number(el.rotation)||0)*Math.PI/180);ctx.translate(-(x+ew/2),-(y+eh/2));
    if(el.type==='rect'){ctx.fillStyle=el.fill||'#fff';roundedRect(ctx,x,y,ew,eh,(Number(el.radius)||0)*Math.min(w,h));ctx.fill()}
    else if(el.type==='circle'){ctx.fillStyle=el.fill||'#fff';ctx.beginPath();ctx.ellipse(x+ew/2,y+eh/2,ew/2,eh/2,0,0,Math.PI*2);ctx.fill()}
    else if(el.type==='text'){
      const size=Math.max(10,(Number(el.fontSize)||.05)*Math.min(w,h));ctx.fillStyle=el.fill||'#111';ctx.font=`${Number(el.fontWeight)||600} ${size}px ${el.fontFamily||'system-ui'}`;ctx.textBaseline='top';const align=el.align||'left';ctx.textAlign=align==='center'?'center':align==='right'?'right':'left';const tx=align==='center'?x+ew/2:align==='right'?x+ew:x;const lines=String(el.text||'').split(/\n/);const lh=size*(Number(el.lineHeight)||1.15);lines.forEach((line,i)=>ctx.fillText(line,tx,y+i*lh,ew));
    }
    ctx.restore();
  }
  return canvas;
}

export function duplicateSelection(design){let next=clone(design);const ids=new Set(next.selection||[]),copies=[];for(const el of next.elements.filter(x=>ids.has(x.id))){const copy={...clone(el),id:uid(),x:clamp((el.x||0)+.025,0,1),y:clamp((el.y||0)+.025,0,1),z:next.elements.length+copies.length};copies.push(copy)}next.elements.push(...copies);next.selection=copies.map(x=>x.id);next.updatedAt=Date.now();return next}
