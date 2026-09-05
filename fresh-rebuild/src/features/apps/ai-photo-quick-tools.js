import { saveDesignProject } from './ai-photo-project-store.js';

const TOOL_COPY={
  'remove-bg':{title:'Remove Background',subtitle:'Local background cutout',accept:'image/jpeg,image/png,image/webp'},
  enhance:{title:'Enhance Photo',subtitle:'Automatic light, color and detail correction',accept:'image/jpeg,image/png,image/webp'},
  upscale:{title:'Upscale Photo',subtitle:'High-quality 2× local resize',accept:'image/jpeg,image/png,image/webp'},
  filters:{title:'AI Filters',subtitle:'Locally applied creative filter presets',accept:'image/jpeg,image/png,image/webp'},
  collage:{title:'Collage',subtitle:'Combine two to six photos',accept:'image/jpeg,image/png,image/webp'},
  'text-art':{title:'Text Art',subtitle:'Create editable typographic artwork',accept:''}
};

const FILTERS={
  studio:{label:'Studio',contrast:1.09,saturation:1.08,brightness:1.02,warmth:2,vignette:.08},
  natural:{label:'Natural',contrast:1.035,saturation:1.035,brightness:1.01,warmth:1,vignette:.025},
  cinematic:{label:'Cinematic',contrast:1.14,saturation:.9,brightness:.98,warmth:5,tint:-3,vignette:.22},
  vivid:{label:'Vivid',contrast:1.12,saturation:1.24,brightness:1.01,warmth:1,vignette:.08},
  warm:{label:'Golden',contrast:1.06,saturation:1.09,brightness:1.02,warmth:14,vignette:.1},
  cool:{label:'Arctic',contrast:1.07,saturation:1.04,brightness:1.01,warmth:-13,tint:3,vignette:.08},
  mono:{label:'Mono',contrast:1.16,saturation:0,brightness:1.01,warmth:0,vignette:.16},
  fade:{label:'Soft Fade',contrast:.88,saturation:.86,brightness:1.06,warmth:4,fade:.12,vignette:.05}
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
const safeName=value=>String(value||'creation').replace(/[^a-z0-9 _-]+/gi,'').trim().replace(/\s+/g,'-').toLowerCase()||'creation';
const icon=path=>`<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
const ICONS={
  home:icon('M3 10.8 12 3l9 7.8v9.7h-6v-6h-6v6H3z'),
  back:icon('M15.5 4 7.5 12l8 8'),
  cutout:icon('M5 4h6v2H7v4H5zm8 0h6v6h-2V6h-4zM5 14h2v4h4v2H5zm12 0h2v6h-6v-2h4zM9 9h6v6H9z'),
  enhance:icon('m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4zM5 13l.9 2.6L9 17l-3.1 1.4L5 21l-.9-2.6L1 17l3.1-1.4zM19 13l.9 2.6L23 17l-3.1 1.4L19 21l-.9-2.6L15 17l3.1-1.4z'),
  upscale:icon('M4 10V4h6M4 4l7 7m9-1V4h-6m6 0-7 7M4 14v6h6m-6 0 7-7m9 1v6h-6m6 0-7-7'),
  filters:icon('M4 6h10M18 6h2M4 12h3m4 0h9M4 18h8m4 0h4M14 3v6M7 9v6m5 0v6'),
  collage:icon('M3 3h8v8H3zm10 0h8v5h-8zm0 7h8v11h-8zM3 13h8v8H3z'),
  text:icon('M5 5V3h14v2m-7-2v18m-4 0h8')
};

function ensureStyles(){
  if(document.getElementById('nx-ai-photo-quick-tools'))return;
  const style=document.createElement('style');
  style.id='nx-ai-photo-quick-tools';
  style.textContent=`
    .nxqt-shell{position:absolute;inset:0;z-index:94;display:grid;grid-template-rows:58px minmax(0,1fr);overflow:hidden;background:radial-gradient(circle at 88% 4%,rgba(113,52,203,.2),transparent 28%),linear-gradient(180deg,#0a0e18,#070b13);color:#f8f5ff}
    .nxqt-shell[hidden]{display:none!important}.nxqt-shell *{box-sizing:border-box}.nxqt-shell button,.nxqt-shell input,.nxqt-shell select,.nxqt-shell textarea{font:inherit}
    .nxqt-head{display:grid;grid-template-columns:84px minmax(0,1fr) 58px;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.09);background:rgba(13,16,27,.92);backdrop-filter:blur(14px)}
    .nxqt-nav{display:flex;align-items:center;justify-content:center;gap:5px;height:42px!important;padding:0 10px!important;border:1px solid rgba(161,104,255,.5)!important;border-radius:13px!important;background:linear-gradient(145deg,#432569,#25183d)!important;color:#fff!important;font-size:11px!important;font-weight:850!important;box-shadow:0 0 18px rgba(133,66,232,.15)}.nxqt-nav svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.nxqt-nav.home svg{fill:currentColor;stroke:none}.nxqt-nav:active,.nxqt-card:active,.nxqt-primary:active,.nxqt-chip:active,.nxqt-action:active{transform:scale(.975)}
    .nxqt-title{min-width:0;text-align:center}.nxqt-title strong{display:block;overflow:hidden;font-size:15px;text-overflow:ellipsis;white-space:nowrap}.nxqt-title span{display:block;overflow:hidden;margin-top:3px;color:#aeb6ca;font-size:8px;text-overflow:ellipsis;white-space:nowrap}
    .nxqt-body{position:relative;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px}.nxqt-panel{display:grid;gap:12px;width:min(100%,680px);min-height:100%;margin:0 auto;align-content:start}
    .nxqt-intro{padding:14px;border:1px solid rgba(157,96,255,.25);border-radius:18px;background:linear-gradient(145deg,rgba(42,29,67,.84),rgba(18,22,35,.94));box-shadow:inset 0 1px rgba(255,255,255,.05)}.nxqt-intro strong{display:block;font-size:16px}.nxqt-intro p{margin:7px 0 0;color:#b7bed0;font-size:10px;line-height:1.5}
    .nxqt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.nxqt-card{display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:10px;min-height:82px!important;padding:12px!important;border:1px solid rgba(127,93,196,.35)!important;border-radius:16px!important;background:linear-gradient(145deg,#1e1831,#121827)!important;color:#fff!important;text-align:left!important}.nxqt-card-icon{display:grid;width:44px;height:44px;place-items:center;border-radius:13px;background:linear-gradient(145deg,#7438df,#47209b);box-shadow:0 0 20px rgba(138,68,244,.2)}.nxqt-card-icon svg{width:23px;height:23px;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.nxqt-card-copy strong{display:block;font-size:11px}.nxqt-card-copy small{display:block;margin-top:4px;color:#aeb5c7;font-size:8px;line-height:1.35}
    .nxqt-picker{display:grid;min-height:min(52vh,430px);place-items:center;padding:22px;border:1px dashed rgba(172,125,255,.48);border-radius:20px;background:radial-gradient(circle at 50% 26%,rgba(117,57,211,.2),transparent 32%),#111624;text-align:center}.nxqt-picker svg{width:48px;height:48px;fill:none;stroke:#cdaeff;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round}.nxqt-picker strong{display:block;margin-top:14px;font-size:17px}.nxqt-picker p{max-width:360px;margin:8px auto 0;color:#aeb6c9;font-size:10px;line-height:1.5}
    .nxqt-primary,.nxqt-action{min-height:44px!important;padding:0 14px!important;border:1px solid rgba(173,126,255,.42)!important;border-radius:13px!important;background:#241a38!important;color:#f7efff!important;font-weight:850!important}.nxqt-primary{margin-top:16px;border-color:transparent!important;background:linear-gradient(90deg,#a64eff,#7131e9)!important;color:#160b24!important;box-shadow:0 10px 28px rgba(126,48,224,.25)}.nxqt-primary:disabled,.nxqt-action:disabled{opacity:.42!important;transform:none!important}
    .nxqt-busy{display:grid;min-height:54vh;place-items:center;text-align:center}.nxqt-spinner{width:48px;height:48px;margin:0 auto;border:3px solid rgba(255,255,255,.12);border-top-color:#ad62ff;border-radius:50%;animation:nxqt-spin .8s linear infinite}.nxqt-busy strong{display:block;margin-top:16px;font-size:16px}.nxqt-busy p{margin:7px 0 0;color:#b4bbcc;font-size:10px}.nxqt-progress{width:min(270px,70vw);height:5px;margin:15px auto 0;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.09)}.nxqt-progress i{display:block;width:38%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7b36e7,#c167ff);animation:nxqt-progress 1.2s ease-in-out infinite}
    .nxqt-result{display:grid;gap:11px}.nxqt-canvas-wrap{position:relative;display:grid;min-height:270px;max-height:56vh;place-items:center;overflow:hidden;border:1px solid rgba(155,111,227,.34);border-radius:18px;background-color:#151925;background-image:linear-gradient(45deg,#202634 25%,transparent 25%),linear-gradient(-45deg,#202634 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#202634 75%),linear-gradient(-45deg,transparent 75%,#202634 75%);background-position:0 0,0 8px,8px -8px,-8px 0;background-size:16px 16px;box-shadow:0 16px 45px rgba(0,0,0,.25)}.nxqt-canvas-wrap canvas{display:block;max-width:100%;max-height:56vh;object-fit:contain}.nxqt-result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:#121724}.nxqt-result-head strong{display:block;font-size:12px}.nxqt-result-head span{display:block;margin-top:4px;color:#aeb6c7;font-size:9px;line-height:1.35}.nxqt-success{flex:0 0 auto;padding:5px 8px;border:1px solid rgba(66,219,147,.28);border-radius:999px;background:rgba(24,113,72,.18);color:#a8f1cc!important;font-size:8px!important;font-weight:850}
    .nxqt-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.nxqt-actions .nxqt-action:first-child{background:linear-gradient(90deg,#9e49ff,#7130e7)!important;color:#160b24!important;border-color:transparent!important}.nxqt-compare{position:absolute;left:10px;bottom:10px;min-height:34px!important;padding:0 10px!important;border:1px solid rgba(255,255,255,.2)!important;border-radius:10px!important;background:rgba(8,11,18,.82)!important;color:#fff!important;font-size:9px!important;font-weight:800!important;backdrop-filter:blur(8px)}
    .nxqt-controls{display:grid;gap:10px;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:#121724}.nxqt-field{display:grid;grid-template-columns:88px minmax(0,1fr) 42px;align-items:center;gap:8px}.nxqt-field>span{color:#c9ceda;font-size:9px}.nxqt-field input[type=range]{width:100%;accent-color:#9c4df3}.nxqt-field output{color:#b792eb;font-size:9px;text-align:right}.nxqt-field input[type=text],.nxqt-field textarea,.nxqt-field select{width:100%!important;min-height:42px!important;padding:9px 10px!important;border:1px solid rgba(147,106,207,.35)!important;border-radius:11px!important;background:#191f2d!important;color:#fff!important}.nxqt-field textarea{min-height:76px!important;resize:none}.nxqt-field.wide{grid-template-columns:1fr}.nxqt-field.wide>span{font-weight:800}
    .nxqt-chips{display:flex;gap:7px;overflow:auto;padding:1px;scrollbar-width:none}.nxqt-chips::-webkit-scrollbar{display:none}.nxqt-chip{flex:0 0 auto;min-height:38px!important;padding:0 12px!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:11px!important;background:#171d2a!important;color:#c8cedb!important;font-size:9px!important;font-weight:750!important}.nxqt-chip.is-active{border-color:#ab5cff!important;background:linear-gradient(145deg,#4a276d,#281b3f)!important;color:#fff!important;box-shadow:0 0 0 1px rgba(171,92,255,.25),0 0 18px rgba(132,61,224,.18)}
    .nxqt-error{display:grid;min-height:44vh;place-items:center;padding:20px;text-align:center}.nxqt-error-card{width:min(100%,430px);padding:20px;border:1px solid rgba(255,101,119,.35);border-radius:18px;background:linear-gradient(145deg,rgba(88,25,39,.46),#151722)}.nxqt-error-card strong{display:block;color:#ffd2d7;font-size:16px}.nxqt-error-card p{margin:8px 0 0;color:#d6aeb5;font-size:10px;line-height:1.5}
    .nxqt-note{padding:9px 10px;border-radius:11px;background:rgba(123,68,198,.11);color:#b9bfd0;font-size:9px;line-height:1.45}.nxqt-file-summary{color:#b9bfd0;font-size:9px;text-align:center}
    @keyframes nxqt-spin{to{transform:rotate(360deg)}}@keyframes nxqt-progress{0%{transform:translateX(-110%)}50%{transform:translateX(165%)}100%{transform:translateX(340%)}}
    @media(max-width:390px){.nxqt-shell{grid-template-rows:54px minmax(0,1fr)}.nxqt-head{grid-template-columns:75px minmax(0,1fr) 48px;padding-inline:8px}.nxqt-nav{height:39px!important;padding-inline:8px!important;font-size:9px!important}.nxqt-title strong{font-size:13px}.nxqt-body{padding:9px}.nxqt-grid{gap:7px}.nxqt-card{grid-template-columns:38px minmax(0,1fr);gap:8px;min-height:74px!important;padding:9px!important}.nxqt-card-icon{width:38px;height:38px}.nxqt-actions{grid-template-columns:1fr}.nxqt-field{grid-template-columns:74px minmax(0,1fr) 36px}.nxqt-canvas-wrap{min-height:220px}}
  `;
  document.head.appendChild(style);
}

function canvasFromImage(image,maxDimension=2048){
  const width=image.naturalWidth||image.width||1,height=image.naturalHeight||image.height||1,scale=Math.min(1,maxDimension/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,0,0,canvas.width,canvas.height);return canvas;
}

function cloneCanvas(source){const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);return canvas}

async function imageFromFile(file){
  if(!file||!/^image\/(jpeg|png|webp)$/i.test(file.type||''))throw new Error('Choose a JPG, PNG or WebP image.');
  if(file.size>30*1024*1024)throw new Error('This image is larger than 30 MB. Choose a smaller file.');
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{if(image.decode)await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject})}catch{throw new Error('This image could not be decoded. Try another JPG, PNG or WebP.')}finally{URL.revokeObjectURL(url)}
  return image;
}

function percentileBounds(data){
  const histogram=new Uint32Array(256);for(let index=0;index<data.length;index+=4)histogram[Math.round(data[index]*.2126+data[index+1]*.7152+data[index+2]*.0722)]++;
  const pixels=data.length/4,lowTarget=pixels*.012,highTarget=pixels*.988;let sum=0,low=0,high=255;
  for(let value=0;value<256;value++){sum+=histogram[value];if(sum>=lowTarget){low=value;break}}
  sum=0;for(let value=0;value<256;value++){sum+=histogram[value];if(sum>=highTarget){high=value;break}}
  return {low,high:Math.max(low+28,high)};
}

function enhanceCanvas(source){
  const output=cloneCanvas(source),context=output.getContext('2d',{willReadFrequently:true}),image=context.getImageData(0,0,output.width,output.height),data=image.data,{low,high}=percentileBounds(data),range=Math.max(28,high-low);
  for(let index=0;index<data.length;index+=4){
    let red=clamp((data[index]-low)*255/range,0,255),green=clamp((data[index+1]-low)*255/range,0,255),blue=clamp((data[index+2]-low)*255/range,0,255);
    const luminance=red*.2126+green*.7152+blue*.0722,saturationBoost=1.075;
    red=clamp(luminance+(red-luminance)*saturationBoost+2,0,255);green=clamp(luminance+(green-luminance)*saturationBoost+1,0,255);blue=clamp(luminance+(blue-luminance)*saturationBoost,0,255);
    data[index]=red;data[index+1]=green;data[index+2]=blue;
  }
  context.putImageData(image,0,0);return {canvas:output,detail:`Auto levels ${low}–${high} · gentle color recovery`};
}

function applyFilter(source,key){
  const config=FILTERS[key]||FILTERS.studio,output=cloneCanvas(source),context=output.getContext('2d',{willReadFrequently:true}),image=context.getImageData(0,0,output.width,output.height),data=image.data,cx=output.width/2,cy=output.height/2,maxDistance=Math.hypot(cx,cy);
  for(let index=0,pixel=0;index<data.length;index+=4,pixel++){
    let red=data[index]/255,green=data[index+1]/255,blue=data[index+2]/255;
    const luminance=red*.2126+green*.7152+blue*.0722;
    red=luminance+(red-luminance)*config.saturation;green=luminance+(green-luminance)*config.saturation;blue=luminance+(blue-luminance)*config.saturation;
    red=(red-.5)*config.contrast+.5;green=(green-.5)*config.contrast+.5;blue=(blue-.5)*config.contrast+.5;
    red=red*config.brightness+(config.warmth||0)/255;blue=blue*config.brightness-(config.warmth||0)/255;green=green*config.brightness+(config.tint||0)/510;
    if(config.fade){red=red*(1-config.fade)+.53*config.fade;green=green*(1-config.fade)+.5*config.fade;blue=blue*(1-config.fade)+.55*config.fade}
    if(config.vignette){const x=pixel%output.width,y=Math.floor(pixel/output.width),distance=Math.hypot(x-cx,y-cy)/maxDistance,factor=1-config.vignette*Math.pow(distance,1.7);red*=factor;green*=factor;blue*=factor}
    data[index]=clamp(red*255,0,255);data[index+1]=clamp(green*255,0,255);data[index+2]=clamp(blue*255,0,255);
  }
  context.putImageData(image,0,0);return output;
}

function removeBackground(source,tolerance=46){
  const output=cloneCanvas(source),context=output.getContext('2d',{willReadFrequently:true}),image=context.getImageData(0,0,output.width,output.height),data=image.data,width=output.width,height=output.height,total=width*height;
  const samples=[[0,0],[width-1,0],[0,height-1],[width-1,height-1],[Math.floor(width/2),0],[Math.floor(width/2),height-1],[0,Math.floor(height/2)],[width-1,Math.floor(height/2)]].map(([x,y])=>{const index=(y*width+x)*4;return [data[index],data[index+1],data[index+2]]});
  const thresholdSquared=tolerance*tolerance*3,visited=new Uint8Array(total),queue=new Uint32Array(total);let head=0,tail=0,removed=0;
  const eligible=pixel=>{const index=pixel*4,red=data[index],green=data[index+1],blue=data[index+2];let best=Infinity;for(const sample of samples){const dr=red-sample[0],dg=green-sample[1],db=blue-sample[2],distance=dr*dr+dg*dg+db*db;if(distance<best)best=distance}return best<=thresholdSquared};
  const add=pixel=>{if(visited[pixel]||!eligible(pixel))return;visited[pixel]=1;queue[tail++]=pixel};
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x)}for(let y=1;y<height-1;y++){add(y*width);add(y*width+width-1)}
  while(head<tail){const pixel=queue[head++],x=pixel%width,y=Math.floor(pixel/width);removed++;if(x>0)add(pixel-1);if(x+1<width)add(pixel+1);if(y>0)add(pixel-width);if(y+1<height)add(pixel+width)}
  if(removed/total<.004)throw new Error('No edge-connected background was found. Try a photo with a clearer or more even background.');
  for(let pixel=0;pixel<total;pixel++)if(visited[pixel])data[pixel*4+3]=0;
  context.putImageData(image,0,0);return {canvas:output,removed,percent:removed/total*100};
}

function upscaleCanvas(source,factor=2){
  const limited=Math.min(factor,4096/Math.max(source.width,source.height)),targetWidth=Math.max(source.width,Math.round(source.width*limited)),targetHeight=Math.max(source.height,Math.round(source.height*limited));
  let current=source;
  while(current.width<targetWidth||current.height<targetHeight){const next=document.createElement('canvas');next.width=Math.min(targetWidth,Math.max(current.width+1,Math.round(current.width*1.5)));next.height=Math.min(targetHeight,Math.max(current.height+1,Math.round(current.height*1.5)));const context=next.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(current,0,0,next.width,next.height);current=next}
  return {canvas:current,factor:current.width/source.width};
}

function drawCover(context,image,x,y,width,height){
  const sourceWidth=image.naturalWidth||image.width,sourceHeight=image.naturalHeight||image.height,scale=Math.max(width/sourceWidth,height/sourceHeight),cropWidth=width/scale,cropHeight=height/scale,sx=(sourceWidth-cropWidth)/2,sy=(sourceHeight-cropHeight)/2;
  context.drawImage(image,sx,sy,cropWidth,cropHeight,x,y,width,height);
}

function collageCanvas(images,layout='grid'){
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;const context=canvas.getContext('2d');context.fillStyle='#111522';context.fillRect(0,0,canvas.width,canvas.height);const gap=18,count=images.length;
  let cells=[];
  if(layout==='hero'&&count>1){cells.push([gap,gap,canvas.width*.62-gap*1.5,canvas.height-gap*2]);const x=canvas.width*.62+gap*.5,h=(canvas.height-gap*(count+1))/(count-1);for(let i=1;i<count;i++)cells.push([x,gap+(i-1)*(h+gap),canvas.width-x-gap,h])}
  else if(layout==='strip'){const width=(canvas.width-gap*(count+1))/count;for(let i=0;i<count;i++)cells.push([gap+i*(width+gap),gap,width,canvas.height-gap*2])}
  else{const columns=count===2?2:count<=4?2:3,rows=Math.ceil(count/columns),width=(canvas.width-gap*(columns+1))/columns,height=(canvas.height-gap*(rows+1))/rows;for(let i=0;i<count;i++)cells.push([gap+(i%columns)*(width+gap),gap+Math.floor(i/columns)*(height+gap),width,height])}
  cells.forEach((cell,index)=>{context.save();context.beginPath();if(context.roundRect)context.roundRect(...cell,16);else context.rect(...cell);context.clip();drawCover(context,images[index],...cell);context.restore()});return canvas;
}

function textArtCanvas({text='CREATE\nBOLDLY',style='aurora',size=124}={}){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const context=canvas.getContext('2d');const palettes={aurora:['#0b1020','#5a21bd','#49c9ff'],neon:['#080812','#ff42d0','#7b4dff'],editorial:['#f0e8da','#171717','#b33a2d'],midnight:['#070b15','#d8e1ff','#5668ff']},palette=palettes[style]||palettes.aurora;
  const background=context.createLinearGradient(0,0,1080,1080);background.addColorStop(0,palette[0]);background.addColorStop(.62,palette[0]);background.addColorStop(1,palette[2]);context.fillStyle=background;context.fillRect(0,0,1080,1080);
  context.save();context.globalAlpha=.32;context.strokeStyle=palette[2];context.lineWidth=3;for(let i=0;i<9;i++){context.beginPath();context.arc(820,240,80+i*38,0,Math.PI*2);context.stroke()}context.restore();
  const lines=String(text||'CREATE BOLDLY').trim().slice(0,90).split(/\n/).slice(0,4);context.textAlign='center';context.textBaseline='middle';context.font=`900 ${clamp(Number(size)||124,54,190)}px system-ui, sans-serif`;context.shadowColor=style==='neon'?palette[1]:'rgba(0,0,0,.42)';context.shadowBlur=style==='neon'?34:16;context.fillStyle=palette[1];const lineHeight=clamp(Number(size)||124,54,190)*1.05,start=540-(lines.length-1)*lineHeight/2;lines.forEach((line,index)=>context.fillText(line||' ',540,start+index*lineHeight,920));context.shadowBlur=0;context.fillStyle=palette[2];context.fillRect(94,820,240,8);context.font='700 28px system-ui, sans-serif';context.textAlign='left';context.fillText('NEXUSNOVA TEXT ART',94,870);return canvas;
}

function downloadCanvas(canvas,name){canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`${safeName(name)}.png`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)},'image/png')}

function canvasToFile(canvas,name){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(new File([blob],`${safeName(name)}.png`,{type:'image/png',lastModified:Date.now()})):reject(new Error('Could not prepare the processed image.')),'image/png'))}

function designFromCanvas(canvas,name,purpose){
  const max=1536,scale=Math.min(1,max/Math.max(canvas.width,canvas.height)),packed=document.createElement('canvas');packed.width=Math.max(1,Math.round(canvas.width*scale));packed.height=Math.max(1,Math.round(canvas.height*scale));packed.getContext('2d').drawImage(canvas,0,0,packed.width,packed.height);const src=packed.toDataURL('image/webp',.9),id=`design-quick-${Date.now().toString(36)}`;
  return {id,name,width:packed.width,height:packed.height,background:'#111522',templateId:'quick-tool',templateMeta:{purpose,description:'Created in NexusNova Quick Tools.',editableFields:['Processed image','Add text','Add shapes','Opacity','Position','Layers'],category:'quick-tools',useCase:purpose,style:'Processed',sizeLabel:`${packed.width} × ${packed.height}`},elements:[{id:`${id}-image`,type:'photo',x:0,y:0,w:1,h:1,src,label:'',radius:0,rotation:0,opacity:1,z:0}],selection:[],updatedAt:Date.now()};
}

export function installAiPhotoQuickTools(root){
  if(!root||root.__nxQuickTools)return()=>{};ensureStyles();
  const shell=document.createElement('section');shell.className='nxqt-shell';shell.hidden=true;shell.setAttribute('aria-label','AI Photo Studio Quick Tools');shell.innerHTML=`<header class="nxqt-head"><button type="button" class="nxqt-nav home" data-nxqt-home>${ICONS.home}<span>Home</span></button><div class="nxqt-title"><strong data-nxqt-title>Quick Tools</strong><span data-nxqt-subtitle>Choose a focused workflow</span></div><button type="button" class="nxqt-nav" data-nxqt-back aria-label="Back">${ICONS.back}</button></header><main class="nxqt-body" data-nxqt-body></main><input type="file" accept="image/jpeg,image/png,image/webp" data-nxqt-file hidden>`;root.appendChild(shell);
  const body=shell.querySelector('[data-nxqt-body]'),fileInput=shell.querySelector('[data-nxqt-file]'),title=shell.querySelector('[data-nxqt-title]'),subtitle=shell.querySelector('[data-nxqt-subtitle]');
  let tool='hub',screen='hub',fromHub=false,source=null,result=null,sourceFileName='',filterKey='studio',collageImages=[],collageLayout='grid',destroyed=false;

  const setHeader=key=>{const copy=key==='hub'?{title:'Quick Tools',subtitle:'Focused creative workflows'}:TOOL_COPY[key];title.textContent=copy?.title||'Quick Tools';subtitle.textContent=copy?.subtitle||'Focused creative workflows'};
  const clearInput=()=>{fileInput.value='';fileInput.multiple=false};
  const showBusy=async message=>{screen='busy';body.innerHTML=`<div class="nxqt-busy"><div><div class="nxqt-spinner"></div><strong>${message}</strong><p>Processing securely on this device…</p><div class="nxqt-progress"><i></i></div></div></div>`;await nextFrame();await new Promise(resolve=>setTimeout(resolve,24))};
  const showError=(message,retry=()=>showPicker())=>{screen='error';body.innerHTML=`<div class="nxqt-error"><div class="nxqt-error-card"><strong>Could not complete this action</strong><p data-nxqt-error-copy></p><button type="button" class="nxqt-primary" data-nxqt-retry>Try again</button></div></div>`;body.querySelector('[data-nxqt-error-copy]').textContent=String(message||'An unexpected error occurred.');body.querySelector('[data-nxqt-retry]').onclick=retry};

  function renderHub(){
    tool='hub';screen='hub';fromHub=false;setHeader('hub');clearInput();body.innerHTML=`<div class="nxqt-panel"><div class="nxqt-intro"><strong>One tap. One clear outcome.</strong><p>Each tool opens its own focused workflow, shows processing status, and produces an editable or downloadable result.</p></div><div class="nxqt-grid">${Object.entries(TOOL_COPY).map(([key,copy])=>`<button type="button" class="nxqt-card" data-nxqt-tool="${key}"><span class="nxqt-card-icon">${key==='remove-bg'?ICONS.cutout:key==='enhance'?ICONS.enhance:key==='upscale'?ICONS.upscale:key==='filters'?ICONS.filters:key==='collage'?ICONS.collage:ICONS.text}</span><span class="nxqt-card-copy"><strong>${copy.title}</strong><small>${copy.subtitle}</small></span></button>`).join('')}</div></div>`;
    body.querySelectorAll('[data-nxqt-tool]').forEach(button=>button.onclick=()=>open(button.dataset.nxqtTool,true));
  }

  function showPicker(){
    screen='picker';setHeader(tool);result=null;clearInput();fileInput.multiple=tool==='collage';const copy=TOOL_COPY[tool],multiple=tool==='collage';
    body.innerHTML=`<div class="nxqt-panel"><div class="nxqt-picker">${multiple?ICONS.collage:tool==='remove-bg'?ICONS.cutout:tool==='enhance'?ICONS.enhance:tool==='upscale'?ICONS.upscale:ICONS.filters}<div><strong>${multiple?'Choose 2–6 photos':'Choose a photo'}</strong><p>${tool==='remove-bg'?'Best results come from a clear, edge-connected background. Processing is local and does not pretend to be a cloud AI cutout.':tool==='upscale'?'Creates a genuine high-quality 2× resized file, capped at 4096 px. It does not invent missing detail.':multiple?'Selected images remain on this device while the collage is rendered.':'The original stays unchanged; your processed result can be compared before export.'}</p><button type="button" class="nxqt-primary" data-nxqt-choose>${multiple?'Select photos':'Select photo'}</button></div></div><div class="nxqt-note">Supported: JPG, PNG and WebP${multiple?' · minimum 2, maximum 6':''}.</div></div>`;
    body.querySelector('[data-nxqt-choose]').onclick=()=>fileInput.click();
  }

  function resultView(canvas,{name,detail,before=source,controls=null}={}){
    result=canvas;screen='result';const container=document.createElement('div');container.className='nxqt-panel nxqt-result';container.innerHTML=`${controls||''}<div class="nxqt-result-head"><div><strong>${name||'Result ready'}</strong><span data-nxqt-result-detail></span></div><span class="nxqt-success">READY</span></div><div class="nxqt-canvas-wrap" data-nxqt-canvas-wrap></div><div class="nxqt-actions"><button type="button" class="nxqt-action" data-nxqt-download>Download</button><button type="button" class="nxqt-action" data-nxqt-design>Use in Design</button><button type="button" class="nxqt-action" data-nxqt-edit>Edit Photo</button></div>`;container.querySelector('[data-nxqt-result-detail]').textContent=detail||`${canvas.width} × ${canvas.height}`;const wrap=container.querySelector('[data-nxqt-canvas-wrap]');wrap.appendChild(canvas);
    if(before){const compare=document.createElement('button');compare.type='button';compare.className='nxqt-compare';compare.textContent='Hold for original';const showOriginal=()=>{if(!before.isConnected)wrap.insertBefore(before,canvas);canvas.hidden=true;before.hidden=false;compare.textContent='Original'};const showResult=()=>{before.hidden=true;canvas.hidden=false;compare.textContent='Hold for original'};compare.onpointerdown=showOriginal;compare.onpointerup=compare.onpointercancel=compare.onpointerleave=showResult;wrap.appendChild(compare)}
    container.querySelector('[data-nxqt-download]').onclick=()=>downloadCanvas(canvas,sourceFileName?`${sourceFileName}-${tool}`:`nexusnova-${tool}`);
    container.querySelector('[data-nxqt-edit]').onclick=async event=>{const button=event.currentTarget,original=button.textContent;button.disabled=true;button.textContent='Preparing…';try{const file=await canvasToFile(canvas,sourceFileName||tool),input=root.querySelector('[data-photo-file]');if(!input)throw new Error('Photo Editor import is unavailable.');const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;close({silent:true});root.__nxStudioNavigation?.openEditor?.({pick:false});input.dispatchEvent(new Event('change',{bubbles:true}))}catch(error){button.disabled=false;button.textContent=original;showError(error?.message||'Could not open this result in Photo Editor.',()=>resultView(canvas,{name,detail,before,controls}))}};
    container.querySelector('[data-nxqt-design]').onclick=event=>{const button=event.currentTarget,original=button.textContent;button.disabled=true;button.textContent='Saving…';try{const design=designFromCanvas(canvas,`${TOOL_COPY[tool]?.title||'Quick Tool'} Result`,TOOL_COPY[tool]?.title||'Quick Tool');saveDesignProject(design);close({silent:true});const api=root.__nxCanvaWorkspaceV3;root.__nxStudioNavigation?.openWorkspace?.('projects');requestAnimationFrame(()=>api?.openProject?.(design.id))}catch(error){button.disabled=false;button.textContent=original;showError(error?.message||'Could not add this result to Design.',()=>resultView(canvas,{name,detail,before,controls}))}};
    body.replaceChildren(container);
  }

  async function processSingle(file){
    sourceFileName=String(file.name||tool).replace(/\.[^.]+$/,'');
    try{
      await showBusy(tool==='remove-bg'?'Finding the background…':tool==='enhance'?'Balancing light and color…':tool==='upscale'?'Resampling every pixel…':'Preparing smart filters…');
      const image=await imageFromFile(file);if(destroyed)return;source=canvasFromImage(image,tool==='upscale'?2048:1800);
      if(tool==='remove-bg'){const processed=removeBackground(source,46);resultView(processed.canvas,{name:'Background removed',detail:`${processed.canvas.width} × ${processed.canvas.height} · ${processed.percent.toFixed(1)}% transparent`})}
      else if(tool==='enhance'){const processed=enhanceCanvas(source);resultView(processed.canvas,{name:'Enhancement applied',detail:`${processed.canvas.width} × ${processed.canvas.height} · ${processed.detail}`})}
      else if(tool==='upscale'){const processed=upscaleCanvas(source,2);resultView(processed.canvas,{name:'Upscale complete',detail:`${source.width} × ${source.height} → ${processed.canvas.width} × ${processed.canvas.height} · ${processed.factor.toFixed(2)}×`})}
      else showFilterChooser();
    }catch(error){showError(error?.message||'The photo could not be processed.')}finally{clearInput()}
  }

  function showFilterChooser(){
    screen='filters';setHeader('filters');const panel=document.createElement('div');panel.className='nxqt-panel';panel.innerHTML=`<div class="nxqt-intro"><strong>Choose a filter</strong><p>These AI-inspired presets are deterministic local color recipes. Tap any preset to see the actual processed output.</p></div><div class="nxqt-chips">${Object.entries(FILTERS).map(([key,value])=>`<button type="button" class="nxqt-chip${key===filterKey?' is-active':''}" data-nxqt-filter="${key}" aria-pressed="${key===filterKey}">${value.label}</button>`).join('')}</div><div class="nxqt-result-head"><div><strong data-nxqt-filter-name>${FILTERS[filterKey].label}</strong><span>Applied locally · original remains unchanged</span></div><span class="nxqt-success">LIVE</span></div><div class="nxqt-canvas-wrap" data-nxqt-filter-canvas></div><div class="nxqt-actions"><button type="button" class="nxqt-action" data-nxqt-filter-use>Use this result</button><button type="button" class="nxqt-action" data-nxqt-filter-new>New photo</button></div>`;
    let preview=applyFilter(source,filterKey);const wrap=panel.querySelector('[data-nxqt-filter-canvas]');wrap.appendChild(preview);
    panel.querySelectorAll('[data-nxqt-filter]').forEach(button=>button.onclick=()=>{filterKey=button.dataset.nxqtFilter;panel.querySelectorAll('[data-nxqt-filter]').forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});panel.querySelector('[data-nxqt-filter-name]').textContent=FILTERS[filterKey].label;preview=applyFilter(source,filterKey);wrap.replaceChildren(preview)});
    panel.querySelector('[data-nxqt-filter-use]').onclick=()=>resultView(preview,{name:`${FILTERS[filterKey].label} filter applied`,detail:`${preview.width} × ${preview.height} · local preset`,before:source});panel.querySelector('[data-nxqt-filter-new]').onclick=showPicker;body.replaceChildren(panel);
  }

  async function processCollage(files){
    try{if(files.length<2)throw new Error('Choose at least two photos for a collage.');await showBusy(`Loading ${Math.min(files.length,6)} photos…`);collageImages=[];for(const file of files.slice(0,6))collageImages.push(await imageFromFile(file));sourceFileName='nexusnova-collage';showCollageChooser()}catch(error){showError(error?.message||'The collage photos could not be loaded.')}finally{clearInput()}
  }

  function showCollageChooser(){
    screen='collage';setHeader('collage');const panel=document.createElement('div');panel.className='nxqt-panel';panel.innerHTML=`<div class="nxqt-controls"><div class="nxqt-file-summary">${collageImages.length} photos selected</div><div class="nxqt-chips"><button type="button" class="nxqt-chip${collageLayout==='grid'?' is-active':''}" data-layout="grid">Balanced grid</button><button type="button" class="nxqt-chip${collageLayout==='hero'?' is-active':''}" data-layout="hero">Hero + stack</button><button type="button" class="nxqt-chip${collageLayout==='strip'?' is-active':''}" data-layout="strip">Vertical strips</button></div></div><div class="nxqt-canvas-wrap" data-nxqt-collage-preview></div><div class="nxqt-actions"><button type="button" class="nxqt-action" data-nxqt-collage-use>Use collage</button><button type="button" class="nxqt-action" data-nxqt-collage-new>Choose again</button></div>`;
    let preview=collageCanvas(collageImages,collageLayout),wrap=panel.querySelector('[data-nxqt-collage-preview]');wrap.appendChild(preview);panel.querySelectorAll('[data-layout]').forEach(button=>button.onclick=()=>{collageLayout=button.dataset.layout;panel.querySelectorAll('[data-layout]').forEach(item=>item.classList.toggle('is-active',item===button));preview=collageCanvas(collageImages,collageLayout);wrap.replaceChildren(preview)});panel.querySelector('[data-nxqt-collage-use]').onclick=()=>resultView(preview,{name:'Collage ready',detail:`${collageImages.length} photos · ${collageLayout} layout`,before:null});panel.querySelector('[data-nxqt-collage-new]').onclick=showPicker;body.replaceChildren(panel);
  }

  function showTextArt(){
    screen='text';setHeader('text-art');sourceFileName='nexusnova-text-art';const model={text:'CREATE\nBOLDLY',style:'aurora',size:124},panel=document.createElement('div');panel.className='nxqt-panel';panel.innerHTML=`<div class="nxqt-controls"><label class="nxqt-field wide"><span>Your text</span><textarea data-nxqt-text maxlength="90">CREATE\nBOLDLY</textarea></label><label class="nxqt-field"><span>Text size</span><input type="range" min="54" max="190" value="124" data-nxqt-text-size><output data-nxqt-text-output>124</output></label><div class="nxqt-chips"><button type="button" class="nxqt-chip is-active" data-text-style="aurora">Aurora</button><button type="button" class="nxqt-chip" data-text-style="neon">Neon</button><button type="button" class="nxqt-chip" data-text-style="editorial">Editorial</button><button type="button" class="nxqt-chip" data-text-style="midnight">Midnight</button></div></div><div class="nxqt-canvas-wrap" data-nxqt-text-preview></div><button type="button" class="nxqt-primary" data-nxqt-text-use>Use text art</button>`;
    const wrap=panel.querySelector('[data-nxqt-text-preview]');let preview=textArtCanvas(model);wrap.appendChild(preview);const repaint=()=>{preview=textArtCanvas(model);wrap.replaceChildren(preview)};panel.querySelector('[data-nxqt-text]').oninput=event=>{model.text=event.target.value;repaint()};panel.querySelector('[data-nxqt-text-size]').oninput=event=>{model.size=Number(event.target.value);panel.querySelector('[data-nxqt-text-output]').textContent=event.target.value;repaint()};panel.querySelectorAll('[data-text-style]').forEach(button=>button.onclick=()=>{model.style=button.dataset.textStyle;panel.querySelectorAll('[data-text-style]').forEach(item=>item.classList.toggle('is-active',item===button));repaint()});panel.querySelector('[data-nxqt-text-use]').onclick=()=>resultView(preview,{name:'Text art ready',detail:'1080 × 1080 · editable artwork',before:null});body.replaceChildren(panel);
  }

  function open(nextTool='hub',openedFromHub=false){
    tool=TOOL_COPY[nextTool]?nextTool:'hub';fromHub=openedFromHub;source=null;result=null;collageImages=[];shell.hidden=false;root.querySelector('.nxlock-home')?.setAttribute('hidden','');root.querySelector('.nxlock-home')?.setAttribute('aria-hidden','true');
    if(tool==='hub')renderHub();else if(tool==='text-art')showTextArt();else showPicker();
  }

  function close({silent=false}={}){shell.hidden=true;body.replaceChildren();clearInput();source=null;result=null;collageImages=[];tool='hub';screen='hub';if(!silent)root.__nxStudioNavigation?.showHome?.()}
  function handleBack(){
    if(shell.hidden)return false;
    if(screen==='result'){if(tool==='filters'&&source)showFilterChooser();else if(tool==='collage'&&collageImages.length)showCollageChooser();else if(tool==='text-art')showTextArt();else showPicker();return true}
    if(screen==='filters'||screen==='collage'||screen==='error'||screen==='busy'){showPicker();return true}
    if(screen==='text'||screen==='picker'){if(fromHub){renderHub();return true}close();return true}
    close();return true;
  }

  fileInput.onchange=()=>{const files=[...(fileInput.files||[])];if(tool==='collage')processCollage(files);else if(files[0])processSingle(files[0])};
  shell.querySelector('[data-nxqt-home]').onclick=()=>close();shell.querySelector('[data-nxqt-back]').onclick=handleBack;
  const quickBindings=[...root.querySelectorAll('[data-nxlock-quick]')].map(button=>{const handler=()=>open(button.dataset.nxlockQuick);button.addEventListener('click',handler);return [button,handler]});
  const viewAll=root.querySelector('[data-nxlock-quick-all]'),openAll=()=>open('hub');viewAll?.addEventListener('click',openAll);
  const api={open,close,handleBack,getState:()=>({open:!shell.hidden,tool,screen,hasSource:Boolean(source),hasResult:Boolean(result)})};root.__nxQuickTools=api;
  return()=>{destroyed=true;quickBindings.forEach(([button,handler])=>button.removeEventListener('click',handler));viewAll?.removeEventListener('click',openAll);shell.remove();delete root.__nxQuickTools};
}
