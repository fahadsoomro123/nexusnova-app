import { downloadBlob, safeName } from './premium-studio-core.js';

const ACCEPTED_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const MIME_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const MAX_FILE_BYTES=40*1024*1024;
const MAX_DECODED_PIXELS=48_000_000;
const TERMINAL=new Set(['ready','failed','cancelled']);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));

function abortError(){const error=new Error('Batch item cancelled.');error.name='AbortError';return error}
function canvasToBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not encode this image.')),type,quality))}
function prettyBytes(bytes){if(bytes<1024)return`${bytes} B`;if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} KB`;return`${(bytes/1024/1024).toFixed(1)} MB`}
function resolveMime(file,requested){return requested==='keep'&&ACCEPTED_TYPES.has(file.type)?file.type:requested==='keep'?'image/png':requested}
function outputName(file,type,index){return`${safeName(file.name,'nexusnova-photo')}-batch-${String(index+1).padStart(2,'0')}.${MIME_EXT[type]||'png'}`}

async function decodeFile(file){
  if(typeof createImageBitmap==='function'){
    try{return await createImageBitmap(file,{imageOrientation:'from-image'})}
    catch{try{return await createImageBitmap(file)}catch{}}
  }
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not decode image data.'))};
    image.src=url;
  });
}

function ensureStyles(){
  if(document.getElementById('nx-ai-photo-batch-v23'))return null;
  const style=document.createElement('style');style.id='nx-ai-photo-batch-v23';style.textContent=`
  .nxbatch-workspace{position:absolute;inset:0;z-index:86;display:none;grid-template-rows:48px auto minmax(0,1fr) auto;min-width:0;overflow:hidden;background:linear-gradient(180deg,#0c1019,#080b12);color:#f7f8ff}.nxbatch-workspace.is-open{display:grid}.nxbatch-workspace *{box-sizing:border-box}.nxbatch-workspace button,.nxbatch-workspace input,.nxbatch-workspace select{font:inherit}
  .nxbatch-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.10);background:#171b25}.nxbatch-title{min-width:0;text-align:center}.nxbatch-title strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.nxbatch-title span{display:block;margin-top:2px;color:#aab2c3;font-size:8px}.nxbatch-btn{min-height:34px!important;padding:0 10px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:10px!important;background:#252a36!important;color:#f7f8ff!important;font-size:10px!important;font-weight:800!important}.nxbatch-btn.primary{border-color:transparent!important;background:linear-gradient(135deg,#8b3dff,#6826d7)!important}.nxbatch-btn.danger{border-color:rgba(255,112,132,.35)!important;color:#ffc0ca!important}.nxbatch-btn:disabled{opacity:.38!important}
  .nxbatch-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:8px;border-bottom:1px solid rgba(255,255,255,.09);background:#111620}.nxbatch-field{display:grid;gap:4px;min-width:0;color:#aeb7c8;font-size:8px;font-weight:800}.nxbatch-field select,.nxbatch-field input[type=range]{width:100%!important;min-width:0!important;height:34px!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:9px!important;background:#242a36!important;color:#f7f8ff!important}.nxbatch-field select{padding:0 7px!important}.nxbatch-field input[type=range]{height:24px!important;border:0!important;background:transparent!important;accent-color:#9d65f2}.nxbatch-check{display:flex;align-items:center;gap:7px;min-height:34px;padding:0 8px;border:1px solid rgba(255,255,255,.13);border-radius:9px;background:#242a36;color:#f7f8ff;font-size:9px}.nxbatch-check input{width:16px;height:16px;accent-color:#8b3dff}.nxbatch-quality{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:5px}.nxbatch-quality output{color:#d9c9ff;font-size:8px}
  .nxbatch-main{min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px}.nxbatch-summary{position:sticky;top:-8px;z-index:2;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;margin:-8px -8px 8px;padding:8px;background:rgba(12,16,25,.96);backdrop-filter:blur(12px)}.nxbatch-summary progress{grid-column:1/-1;width:100%;height:7px;accent-color:#8b3dff}.nxbatch-summary strong{font-size:10px}.nxbatch-summary span{color:#aeb7c8;font-size:8px}
  .nxbatch-empty{display:grid;min-height:190px;place-items:center;padding:25px;text-align:center;border:1px dashed rgba(181,149,241,.28);border-radius:15px;background:rgba(255,255,255,.025)}.nxbatch-empty b{display:block;font-size:14px}.nxbatch-empty span{display:block;margin-top:6px;color:#9ea8bb;font-size:9px;line-height:1.45}
  .nxbatch-list{display:grid;gap:7px}.nxbatch-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:#171c26}.nxbatch-icon{display:grid;width:38px;height:38px;place-items:center;border-radius:10px;background:linear-gradient(145deg,#3b275b,#183149);color:#e8dcff;font-size:15px}.nxbatch-copy{min-width:0}.nxbatch-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.nxbatch-copy small{display:block;margin-top:3px;color:#9da7ba;font-size:8px}.nxbatch-item progress{display:block;width:100%;height:5px;margin-top:6px;accent-color:#8b3dff}.nxbatch-side{display:grid;justify-items:end;gap:5px}.nxbatch-status{padding:4px 6px;border-radius:999px;background:#272e3b;color:#c9d0dd;font-size:7px;font-weight:900;text-transform:uppercase}.nxbatch-item[data-status=ready] .nxbatch-status{background:#153c32;color:#92efd0}.nxbatch-item[data-status=failed] .nxbatch-status{background:#4a2028;color:#ffc0cb}.nxbatch-item[data-status=processing] .nxbatch-status{background:#322454;color:#dac8ff}.nxbatch-item[data-status=cancelled] .nxbatch-status{background:#3b3540;color:#d1c8d4}.nxbatch-actions{display:flex;gap:4px}.nxbatch-icon-btn{min-width:30px!important;height:28px!important;padding:0 6px!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:8px!important;background:#242a35!important;color:#edf0f7!important;font-size:8px!important}.nxbatch-error{color:#ffb7c4!important}
  .nxbatch-footer{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:7px;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid rgba(255,255,255,.10);background:#151a23}.nxbatch-footer .nxbatch-btn{min-width:0;padding-inline:8px!important}
  .nxlock-recent.nxbatch-home-enabled{grid-template-columns:minmax(0,1fr) auto auto}.nxlock-recent.nxbatch-home-enabled .nxlock-recent-items{grid-column:1/-1}.nxbatch-home-launch{white-space:nowrap}
  @media(max-width:520px){.nxbatch-controls{grid-template-columns:1fr 1fr}.nxbatch-footer{grid-template-columns:1fr 1fr}.nxbatch-footer .nxbatch-btn{min-height:38px!important}.nxbatch-item{grid-template-columns:34px minmax(0,1fr) auto;padding:7px;gap:6px}.nxbatch-icon{width:34px;height:34px}.nxlock-recent.nxbatch-home-enabled{gap:5px}.nxlock-recent.nxbatch-home-enabled .nxlock-open-projects{padding-inline:8px!important}}
  @media(max-width:360px){.nxbatch-controls{gap:5px;padding:6px}.nxbatch-main{padding:6px}.nxbatch-summary{margin:-6px -6px 6px}.nxbatch-head{gap:5px}.nxbatch-btn{padding-inline:7px!important}.nxbatch-copy strong{font-size:9px}}
  @media(max-height:700px){.nxbatch-controls{padding-block:5px}.nxbatch-field{gap:2px}.nxbatch-field select{height:30px!important}.nxbatch-check{min-height:30px}.nxbatch-footer{padding-block:5px}.nxbatch-footer .nxbatch-btn{min-height:34px!important}}
  `;document.head.appendChild(style);return style;
}

export function installAiPhotoBatchV23(root){
  if(!root||root.__nxBatchV23)return()=>{};
  const style=ensureStyles(),workspace=document.createElement('section');workspace.className='nxbatch-workspace';workspace.setAttribute('aria-label','Batch photo editor');workspace.innerHTML=`
    <header class="nxbatch-head"><button class="nxbatch-btn" type="button" data-batch-back>Back</button><div class="nxbatch-title"><strong>Batch Photo Studio</strong><span data-batch-meta>Real local multi-file processing</span></div><button class="nxbatch-btn danger" type="button" data-batch-clear>Clear</button></header>
    <div class="nxbatch-controls"><label class="nxbatch-field">Output format<select data-batch-format><option value="keep">Keep type</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label><label class="nxbatch-field">Max edge<select data-batch-size><option value="0">Original</option><option value="2048">2048 px</option><option value="1600">1600 px</option><option value="1080" selected>1080 px</option><option value="720">720 px</option><option value="512">512 px</option></select></label><label class="nxbatch-field">Quality<div class="nxbatch-quality"><input type="range" min="60" max="100" value="90" data-batch-quality><output data-batch-quality-out>90%</output></div></label><label class="nxbatch-field">Pixel transform<span class="nxbatch-check"><input type="checkbox" checked data-batch-polish> Auto polish</span></label></div>
    <main class="nxbatch-main"><div class="nxbatch-summary"><strong data-batch-summary>No files queued</strong><span data-batch-overall>0%</span><progress max="100" value="0" data-batch-progress></progress></div><div class="nxbatch-list" data-batch-list><div class="nxbatch-empty"><div><b>Add several photos at once</b><span>JPG, PNG and WebP are processed one-by-one so one bad file cannot stop the rest.</span></div></div></div></main>
    <footer class="nxbatch-footer"><button class="nxbatch-btn" type="button" data-batch-add>Add photos</button><button class="nxbatch-btn primary" type="button" data-batch-run disabled>Start batch</button><button class="nxbatch-btn danger" type="button" data-batch-cancel disabled>Cancel</button><button class="nxbatch-btn" type="button" data-batch-download disabled>Download ready</button></footer>
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-batch-files>`;
  root.appendChild(workspace);
  const q=selector=>workspace.querySelector(selector),list=q('[data-batch-list]'),input=q('[data-batch-files]'),format=q('[data-batch-format]'),size=q('[data-batch-size]'),quality=q('[data-batch-quality]'),polish=q('[data-batch-polish]');
  let items=[],sequence=0,running=false,cancelRequested=false,runToken=0,currentRun=null,destroyed=false;

  const publicItem=item=>({id:item.id,name:item.file.name,inputType:item.file.type,inputSize:item.file.size,status:item.status,progress:item.progress,error:item.error||'',width:item.width||0,height:item.height||0,outputType:item.outputType||'',outputSize:item.blob?.size||0,outputName:item.outputName||''});
  const options=()=>({format:format.value,maxEdge:Number(size.value)||0,quality:clamp(Number(quality.value)/100,.6,1),polish:polish.checked});
  const overallProgress=()=>items.length?Math.round(items.reduce((sum,item)=>sum+(TERMINAL.has(item.status)?100:item.progress||0),0)/items.length):0;
  const emit=type=>workspace.dispatchEvent(new CustomEvent(`nx-batch:${type}`,{detail:getState()}));
  function getState(){const rows=items.map(publicItem);return{open:workspace.classList.contains('is-open'),running,cancelRequested,options:options(),overallProgress:overallProgress(),total:rows.length,queued:rows.filter(item=>item.status==='queued').length,processing:rows.filter(item=>item.status==='processing').length,ready:rows.filter(item=>item.status==='ready').length,failed:rows.filter(item=>item.status==='failed').length,cancelled:rows.filter(item=>item.status==='cancelled').length,items:rows}}
  function render(){
    const state=getState(),settings=workspace.querySelectorAll('.nxbatch-controls input,.nxbatch-controls select');settings.forEach(control=>control.disabled=running);
    q('[data-batch-meta]').textContent=state.total?`${state.total} file${state.total===1?'':'s'} · ${state.ready} ready · ${state.failed} failed`:'Real local multi-file processing';
    q('[data-batch-summary]').textContent=state.total?`${state.ready+state.failed+state.cancelled}/${state.total} finished${running?' · processing locally':''}`:'No files queued';q('[data-batch-overall]').textContent=`${state.overallProgress}%`;q('[data-batch-progress]').value=state.overallProgress;
    q('[data-batch-run]').disabled=running||!state.queued;q('[data-batch-cancel]').disabled=!running;q('[data-batch-download]').disabled=!state.ready;q('[data-batch-clear]').disabled=running||!state.total;
    if(!items.length){list.innerHTML='<div class="nxbatch-empty"><div><b>Add several photos at once</b><span>JPG, PNG and WebP are processed one-by-one so one bad file cannot stop the rest.</span></div></div>';emit('update');return}
    list.innerHTML=items.map(item=>`<article class="nxbatch-item" data-batch-item="${item.id}" data-status="${item.status}"><div class="nxbatch-icon" aria-hidden="true">▧</div><div class="nxbatch-copy"><strong>${escapeHtml(item.file.name)}</strong><small class="${item.status==='failed'?'nxbatch-error':''}">${escapeHtml(item.error||(item.outputName?`${item.width} × ${item.height} · ${prettyBytes(item.blob?.size||0)}`:`${prettyBytes(item.file.size)} · ${item.progress}%`))}</small><progress max="100" value="${item.progress}"></progress></div><div class="nxbatch-side"><span class="nxbatch-status">${item.status}</span><div class="nxbatch-actions">${item.status==='ready'?'<button class="nxbatch-icon-btn" type="button" data-batch-one>Save</button>':''}${item.status==='failed'||item.status==='cancelled'?'<button class="nxbatch-icon-btn" type="button" data-batch-retry>Retry</button>':''}<button class="nxbatch-icon-btn" type="button" data-batch-remove aria-label="Remove">×</button></div></div></article>`).join('');emit('update');
  }
  function addFiles(files){
    const added=[];for(const file of Array.from(files||[])){
      const item={id:`batch-${Date.now().toString(36)}-${++sequence}`,file,status:'queued',progress:0,error:'',blob:null,cancelled:false,removed:false,width:0,height:0,outputType:'',outputName:''};
      if(!(file instanceof Blob))Object.assign(item,{status:'failed',progress:100,error:'Invalid file object.'});
      else if(!ACCEPTED_TYPES.has(file.type))Object.assign(item,{status:'failed',progress:100,error:'Unsupported file type. Use JPG, PNG or WebP.'});
      else if(file.size>MAX_FILE_BYTES)Object.assign(item,{status:'failed',progress:100,error:'File is larger than the 40 MB mobile safety limit.'});
      items.push(item);added.push(item.id);
    }
    render();return added;
  }
  const shouldAbort=(item,token)=>destroyed||cancelRequested||token!==runToken||item.cancelled||item.removed;
  async function processItem(item,settings,token,index){
    item.status='processing';item.progress=4;item.error='';render();await nextPaint();if(shouldAbort(item,token))throw abortError();
    let decoded=null;try{
      decoded=await decodeFile(item.file);if(shouldAbort(item,token))throw abortError();
      const sourceWidth=decoded.width||decoded.naturalWidth,sourceHeight=decoded.height||decoded.naturalHeight;if(!sourceWidth||!sourceHeight)throw new Error('Image dimensions are unavailable.');
      if(sourceWidth*sourceHeight>MAX_DECODED_PIXELS)throw new Error('Image exceeds the 48 megapixel mobile safety limit.');
      item.progress=28;render();await nextPaint();if(shouldAbort(item,token))throw abortError();
      const scale=settings.maxEdge?Math.min(1,settings.maxEdge/Math.max(sourceWidth,sourceHeight)):1,width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{alpha:true});if(!context)throw new Error('Canvas processing is unavailable.');
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.filter=settings.polish?'contrast(1.06) saturate(1.04)':'none';context.drawImage(decoded,0,0,width,height);context.filter='none';item.progress=68;render();await nextPaint();if(shouldAbort(item,token))throw abortError();
      const type=resolveMime(item.file,settings.format),blob=await canvasToBlob(canvas,type,settings.quality);if(shouldAbort(item,token))throw abortError();
      item.blob=blob;item.width=width;item.height=height;item.outputType=blob.type||type;item.outputName=outputName(item.file,item.outputType,index);item.progress=100;item.status='ready';
    }finally{decoded?.close?.()}
  }
  async function start(){
    if(running)return currentRun;if(!items.some(item=>item.status==='queued'))return getState();
    running=true;cancelRequested=false;const token=++runToken,settings=options();render();
    currentRun=(async()=>{let index=0;try{
      while(true){
        if(cancelRequested||token!==runToken){for(const item of items)if(item.status==='queued')Object.assign(item,{status:'cancelled',progress:100,error:'Cancelled before processing.'});break}
        const item=items.find(row=>row.status==='queued');if(!item)break;const itemIndex=items.indexOf(item);index++;
        try{await processItem(item,settings,token,itemIndex)}catch(error){if(item.removed)continue;if(error?.name==='AbortError'||item.cancelled||cancelRequested)Object.assign(item,{status:'cancelled',progress:100,error:'Cancelled.'});else Object.assign(item,{status:'failed',progress:100,error:String(error?.message||error||'Processing failed.').slice(0,180),blob:null})}
        render();await nextPaint();
      }
    }finally{running=false;cancelRequested=false;currentRun=null;render();emit('complete')}return getState()})();return currentRun;
  }
  function cancel(){if(!running)return false;cancelRequested=true;for(const item of items){if(item.status==='processing')item.cancelled=true;else if(item.status==='queued')Object.assign(item,{status:'cancelled',progress:100,error:'Cancelled before processing.'})}render();return true}
  function remove(id){const item=items.find(row=>row.id===id);if(!item)return false;item.removed=true;item.cancelled=true;items=items.filter(row=>row!==item);render();return true}
  function retry(id){if(running)return false;const item=items.find(row=>row.id===id);if(!item||!['failed','cancelled'].includes(item.status))return false;Object.assign(item,{status:'queued',progress:0,error:'',blob:null,cancelled:false,removed:false,width:0,height:0,outputType:'',outputName:''});render();return true}
  function clear(){if(running)return false;items=[];render();return true}
  function downloadOne(id){const item=items.find(row=>row.id===id);if(!item?.blob||item.status!=='ready')return false;downloadBlob(item.blob,item.outputName);return true}
  function downloadReady(){const ready=items.filter(item=>item.status==='ready'&&item.blob);for(const item of ready)downloadBlob(item.blob,item.outputName);return ready.length}
  function setOptions(next={}){if(running)return false;if(next.format&&[...format.options].some(option=>option.value===next.format))format.value=next.format;if(next.maxEdge!==undefined&&[...size.options].some(option=>Number(option.value)===Number(next.maxEdge)))size.value=String(next.maxEdge);if(next.quality!==undefined)quality.value=String(Math.round(clamp(Number(next.quality),.6,1)*100));if(next.polish!==undefined)polish.checked=Boolean(next.polish);q('[data-batch-quality-out]').textContent=`${quality.value}%`;render();return true}
  function open(){root.__nxQuickTools?.close?.({silent:true});root.__nxCanvaWorkspaceV3?.close?.();const sheet=root.querySelector('[data-photo-sheet]');if(sheet?.classList.contains('is-open'))root.querySelector('[data-photo-sheet-close]')?.click();root.querySelectorAll('.nxlock-home,.nxps-home').forEach(home=>{home.hidden=true;home.setAttribute('aria-hidden','true')});workspace.classList.add('is-open');emit('navigate');return true}
  function close({silent=false}={}){workspace.classList.remove('is-open');if(!silent)emit('navigate');return true}
  function showHomeFallback(){close();const home=root.querySelector('.nxlock-home')||root.querySelector('.nxps-home');if(home){home.hidden=false;home.removeAttribute('aria-hidden')}return true}

  input.onchange=()=>{addFiles(input.files);input.value=''};q('[data-batch-add]').onclick=()=>input.click();q('[data-batch-run]').onclick=()=>start();q('[data-batch-cancel]').onclick=cancel;q('[data-batch-download]').onclick=downloadReady;q('[data-batch-clear]').onclick=clear;q('[data-batch-back]').onclick=()=>root.__nxStudioNavigation?.showHome?.({reason:'batch-back'})||showHomeFallback();quality.oninput=()=>{q('[data-batch-quality-out]').textContent=`${quality.value}%`};
  list.onclick=event=>{const row=event.target.closest('[data-batch-item]');if(!row)return;if(event.target.closest('[data-batch-one]'))downloadOne(row.dataset.batchItem);else if(event.target.closest('[data-batch-retry]'))retry(row.dataset.batchItem);else if(event.target.closest('[data-batch-remove]'))remove(row.dataset.batchItem)};
  const lockedRecent=root.querySelector('.nxlock-recent'),projectButton=lockedRecent?.querySelector('.nxlock-open-projects');let homeButton=null;if(lockedRecent&&projectButton){lockedRecent.classList.add('nxbatch-home-enabled');homeButton=document.createElement('button');homeButton.type='button';homeButton.className='nxlock-open-projects nxbatch-home-launch';homeButton.textContent='Batch';lockedRecent.insertBefore(homeButton,projectButton);homeButton.onclick=()=>root.__nxStudioNavigation?.openBatch?.({reason:'home-batch'})||open()}
  const api={open,close,addFiles,start,cancel,remove,retry,clear,downloadOne,downloadReady,setOptions,getState,getResult:id=>items.find(item=>item.id===id)||null};root.__nxBatchV23=api;root.dataset.aiPhotoBatch='v23-real';render();
  return()=>{destroyed=true;cancel();homeButton?.remove();lockedRecent?.classList.remove('nxbatch-home-enabled');workspace.remove();style?.remove();delete root.__nxBatchV23;delete root.dataset.aiPhotoBatch};
}
