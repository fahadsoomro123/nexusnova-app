const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const uid=()=>`el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const IMAGE_CACHE=new Map();

export function createDesignFromTemplate(template){
  if(!template?.canvas||!Array.isArray(template.elements))throw new Error('Invalid template');
  return {
    id:`design-${Date.now().toString(36)}`,
    templateId:template.id||'',templateMeta:{purpose:template.purpose||'',description:template.description||'',editableFields:clone(template.editableFields||[]),category:template.category||'',useCase:template.useCase||'',style:template.style||'',sizeLabel:template.sizeLabel||''},
    name:template.name||'Untitled design',width:Number(template.canvas.width)||1080,height:Number(template.canvas.height)||1080,background:template.background||'#ffffff',
    elements:clone(template.elements).map((el,i)=>({...el,id:el.id||uid(),z:i})),selection:[],updatedAt:Date.now()
  };
}

export function addDesignElement(design,element){const next=clone(design);const item={id:uid(),type:'rect',x:.1,y:.1,w:.2,h:.2,fill:'#ffffff',rotation:0,opacity:1,...clone(element)};item.x=clamp(Number(item.x)||0,0,1);item.y=clamp(Number(item.y)||0,0,1);item.w=clamp(Number(item.w)||.1,.01,1);item.h=clamp(Number(item.h)||.1,.01,1);item.z=next.elements.length;next.elements.push(item);next.selection=[item.id];next.updatedAt=Date.now();return next}
export function updateDesignElement(design,id,patch){const next=clone(design);const item=next.elements.find(x=>x.id===id);if(!item)return next;Object.assign(item,clone(patch));item.x=clamp(Number(item.x)||0,0,1);item.y=clamp(Number(item.y)||0,0,1);item.w=clamp(Number(item.w)||.01,.01,1);item.h=clamp(Number(item.h)||.01,.01,1);item.opacity=clamp(Number(item.opacity??1),0,1);next.updatedAt=Date.now();return next}
export function removeDesignElements(design,ids){const set=new Set(ids||[]),next=clone(design);next.elements=next.elements.filter(x=>!set.has(x.id)).map((x,i)=>({...x,z:i}));next.selection=next.selection.filter(id=>!set.has(id));next.updatedAt=Date.now();return next}
export function reorderDesignElement(design,id,mode='front'){const next=clone(design),idx=next.elements.findIndex(x=>x.id===id);if(idx<0)return next;const [item]=next.elements.splice(idx,1);if(mode==='back')next.elements.unshift(item);else if(mode==='forward')next.elements.splice(Math.min(next.elements.length,idx+1),0,item);else if(mode==='backward')next.elements.splice(Math.max(0,idx-1),0,item);else next.elements.push(item);next.elements=next.elements.map((x,i)=>({...x,z:i}));next.updatedAt=Date.now();return next}
export function selectDesignElements(design,ids){const next=clone(design);const valid=new Set(next.elements.map(x=>x.id));next.selection=(ids||[]).filter(id=>valid.has(id));return next}
export function serializeDesign(design){return JSON.stringify({...clone(design),selection:[]})}
export function deserializeDesign(text){const d=JSON.parse(String(text));if(!d||!Array.isArray(d.elements))throw new Error('Invalid design');return d}

function roundedRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,rr):ctx.rect(x,y,w,h)}
function line(ctx,a,b,c,d){ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke()}
function symbolPath(ctx,name,x,y,w,h){
  const cx=x+w/2,cy=y+h/2,s=Math.min(w,h),u=s/10;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(1,u*.9);
  if(name==='cup'){roundedRect(ctx,x+u,y+3*u,6*u,5*u,1.2*u);ctx.stroke();ctx.beginPath();ctx.arc(x+7*u,y+5*u,2*u,-Math.PI/2,Math.PI/2);ctx.stroke();line(ctx,x+2*u,y+u,x+2.6*u,y+2.2*u);line(ctx,x+4*u,y+u,x+4.6*u,y+2.2*u)}
  else if(name==='bolt'){ctx.beginPath();ctx.moveTo(cx+u,y);ctx.lineTo(cx-2*u,cy);ctx.lineTo(cx,cy);ctx.lineTo(cx-1.2*u,y+h);ctx.lineTo(cx+3*u,cy-u);ctx.lineTo(cx+u,cy-u);ctx.closePath();ctx.fill()}
  else if(name==='home'){ctx.beginPath();ctx.moveTo(x+u,cy);ctx.lineTo(cx,y+u);ctx.lineTo(x+9*u,cy);ctx.lineTo(x+8*u,y+9*u);ctx.lineTo(x+2*u,y+9*u);ctx.closePath();ctx.stroke();roundedRect(ctx,cx-u,y+6*u,2*u,3*u,.3*u);ctx.stroke()}
  else if(name==='game'){roundedRect(ctx,x+u,y+3*u,8*u,5*u,2*u);ctx.stroke();line(ctx,x+3*u,y+5*u,x+3*u,y+7*u);line(ctx,x+2*u,y+6*u,x+4*u,y+6*u);ctx.beginPath();ctx.arc(x+7*u,y+5.4*u,.55*u,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+8*u,y+6.6*u,.55*u,0,Math.PI*2);ctx.fill()}
  else if(name==='flower'){for(let i=0;i<6;i++){ctx.save();ctx.translate(cx,cy);ctx.rotate(i*Math.PI/3);ctx.beginPath();ctx.ellipse(0,-2.5*u,1.35*u,2.6*u,0,0,Math.PI*2);ctx.stroke();ctx.restore()}ctx.beginPath();ctx.arc(cx,cy,1.1*u,0,Math.PI*2);ctx.fill()}
  else if(name==='fork'){line(ctx,x+3*u,y+u,x+3*u,y+9*u);line(ctx,x+2*u,y+u,x+2*u,y+4*u);line(ctx,x+4*u,y+u,x+4*u,y+4*u);line(ctx,x+7*u,y+u,x+7*u,y+9*u);ctx.beginPath();ctx.arc(x+7*u,y+3*u,1.8*u,Math.PI,0);ctx.stroke()}
  else if(name==='dumbbell'){line(ctx,x+2*u,cy,x+8*u,cy);ctx.lineWidth=1.5*u;line(ctx,x+2*u,y+3*u,x+2*u,y+7*u);line(ctx,x+8*u,y+3*u,x+8*u,y+7*u);ctx.lineWidth=u;line(ctx,x+u,y+4*u,x+u,y+6*u);line(ctx,x+9*u,y+4*u,x+9*u,y+6*u)}
  else if(name==='camera'){roundedRect(ctx,x+u,y+2.5*u,8*u,6*u,1.1*u);ctx.stroke();roundedRect(ctx,x+3*u,y+u,3*u,2*u,.5*u);ctx.stroke();ctx.beginPath();ctx.arc(cx,y+5.5*u,2*u,0,Math.PI*2);ctx.stroke()}
  else if(name==='shield'){ctx.beginPath();ctx.moveTo(cx,y+u);ctx.lineTo(x+8.5*u,y+2.5*u);ctx.lineTo(x+8*u,y+6*u);ctx.quadraticCurveTo(cx,y+9.5*u,x+2*u,y+6*u);ctx.lineTo(x+1.5*u,y+2.5*u);ctx.closePath();ctx.stroke();line(ctx,x+3.5*u,cy,x+4.7*u,y+6.3*u);line(ctx,x+4.7*u,y+6.3*u,x+7*u,y+3.8*u)}
  else if(name==='diamond'){ctx.beginPath();ctx.moveTo(cx,y+u);ctx.lineTo(x+9*u,cy);ctx.lineTo(cx,y+9*u);ctx.lineTo(x+u,cy);ctx.closePath();ctx.stroke();line(ctx,x+u,cy,x+9*u,cy);line(ctx,cx,y+u,x+3*u,cy);line(ctx,cx,y+u,x+7*u,cy)}
  else{ctx.beginPath();ctx.arc(cx,cy,4*u,0,Math.PI*2);ctx.stroke()}
}
function drawPhotoPlaceholder(ctx,el,x,y,w,h){
  ctx.save();roundedRect(ctx,x,y,w,h,(Number(el.radius)||.03)*Math.min(ctx.canvas.width,ctx.canvas.height));ctx.clip();
  const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,el.fill||'#6253ff');g.addColorStop(1,'#151826');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.globalAlpha=.32;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+w*.76,y+h*.25,Math.min(w,h)*.09,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(x-w*.05,y+h*.88);ctx.lineTo(x+w*.35,y+h*.45);ctx.lineTo(x+w*.55,y+h*.65);ctx.lineTo(x+w*.72,y+h*.48);ctx.lineTo(x+w*1.05,y+h*.88);ctx.closePath();ctx.fill();
  ctx.globalAlpha=.78;ctx.fillStyle='#fff';ctx.font=`700 ${Math.max(8,Math.min(w,h)*.075)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(el.label||'REPLACE PHOTO',x+w/2,y+h*.86,w*.82);ctx.restore()
}
function imageFor(src){if(!src)return null;let entry=IMAGE_CACHE.get(src);if(entry)return entry.loaded?entry.image:null;const image=new Image();entry={image,loaded:false};IMAGE_CACHE.set(src,entry);image.onload=()=>{entry.loaded=true;globalThis.dispatchEvent?.(new CustomEvent('nx-design-image-ready',{detail:{src}}))};image.onerror=()=>IMAGE_CACHE.delete(src);image.src=src;return null}
function drawImageElement(ctx,el,x,y,w,h){const image=imageFor(el.src);if(!image){drawPhotoPlaceholder(ctx,el,x,y,w,h);return}ctx.save();roundedRect(ctx,x,y,w,h,(Number(el.radius)||.03)*Math.min(ctx.canvas.width,ctx.canvas.height));ctx.clip();const crop=el.sourceCrop;if(crop&&Number(crop.w)>0&&Number(crop.h)>0){const sx=clamp(Number(crop.x)||0,0,1)*image.naturalWidth,sy=clamp(Number(crop.y)||0,0,1)*image.naturalHeight,sw=clamp(Number(crop.w),.001,1)*image.naturalWidth,sh=clamp(Number(crop.h),.001,1)*image.naturalHeight;ctx.drawImage(image,sx,sy,Math.min(sw,image.naturalWidth-sx),Math.min(sh,image.naturalHeight-sy),x,y,w,h)}else{const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}ctx.restore()}

export function renderDesignToCanvas(design,canvas,{pixelRatio=1}={}){
  if(!design||!canvas)throw new Error('Design and canvas required');
  const ratio=clamp(Number(pixelRatio)||1,.25,4),w=Math.max(1,Math.round(design.width*ratio)),h=Math.max(1,Math.round(design.height*ratio));canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.fillStyle=design.background||'#fff';ctx.fillRect(0,0,w,h);
  for(const el of [...design.elements].sort((a,b)=>(a.z||0)-(b.z||0))){
    if(el.hidden)continue;const x=(el.x||0)*w,y=(el.y||0)*h,ew=(el.w||0)*w,eh=(el.h||0)*h;ctx.save();ctx.globalAlpha=clamp(Number(el.opacity??1),0,1);ctx.translate(x+ew/2,y+eh/2);ctx.rotate((Number(el.rotation)||0)*Math.PI/180);ctx.translate(-(x+ew/2),-(y+eh/2));
    if(el.type==='rect'){ctx.fillStyle=el.fill||'#fff';roundedRect(ctx,x,y,ew,eh,(Number(el.radius)||0)*Math.min(w,h));ctx.fill()}
    else if(el.type==='circle'){ctx.fillStyle=el.fill||'#fff';ctx.beginPath();ctx.ellipse(x+ew/2,y+eh/2,ew/2,eh/2,0,0,Math.PI*2);ctx.fill()}
    else if(el.type==='line'){ctx.strokeStyle=el.fill||'#fff';ctx.lineWidth=Math.max(1,(Number(el.strokeWidth)||.005)*Math.min(w,h));ctx.lineCap='round';line(ctx,x,y+eh/2,x+ew,y+eh/2)}
    else if(el.type==='symbol'){ctx.fillStyle=el.fill||'#fff';ctx.strokeStyle=el.fill||'#fff';symbolPath(ctx,el.symbol,x,y,ew,eh)}
    else if(el.type==='photo'){drawImageElement(ctx,el,x,y,ew,eh)}
    else if(el.type==='text'){const size=Math.max(8,(Number(el.fontSize)||.05)*Math.min(w,h));ctx.fillStyle=el.fill||'#111';ctx.font=`${Number(el.fontWeight)||600} ${size}px ${el.fontFamily||'system-ui'}`;ctx.textBaseline='top';const align=el.align||'left';ctx.textAlign=align==='center'?'center':align==='right'?'right':'left';const tx=align==='center'?x+ew/2:align==='right'?x+ew:x;const lines=String(el.text||'').split(/\n/);const lh=size*(Number(el.lineHeight)||1.15);lines.forEach((txt,i)=>ctx.fillText(txt,tx,y+i*lh,ew))}
    ctx.restore();
  }
  return canvas;
}

export function duplicateSelection(design){let next=clone(design);const ids=new Set(next.selection||[]),copies=[];for(const el of next.elements.filter(x=>ids.has(x.id))){const copy={...clone(el),id:uid(),x:clamp((el.x||0)+.025,0,1),y:clamp((el.y||0)+.025,0,1),z:next.elements.length+copies.length};copies.push(copy)}next.elements.push(...copies);next.selection=copies.map(x=>x.id);next.updatedAt=Date.now();return next}
