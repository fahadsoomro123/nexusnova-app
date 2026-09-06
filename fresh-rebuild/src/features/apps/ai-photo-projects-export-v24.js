import { renderDesignToCanvas } from './ai-photo-design-canvas.js';
import { saveDesignProject,loadDesignProject,listDesignProjects } from './ai-photo-project-store.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const safeBase=value=>String(value||'nexusnova-design').trim().replace(/[^a-z0-9-_]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'nexusnova-design';
const stableDesign=value=>{if(!value)return null;const copy=clone(value);copy.selection=[];delete copy.updatedAt;return copy};
const sameDesign=(a,b)=>JSON.stringify(stableDesign(a))===JSON.stringify(stableDesign(b));
const blobFromCanvas=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Export encoding failed.')),type,quality));

function storageAvailable(){
  try{const key='__nx_project_v24_probe__';localStorage.setItem(key,'1');localStorage.removeItem(key);return true}catch{return false}
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)
}

export function installAiPhotoProjectsExportV24(root){
  if(!root||root.__nxProjectsExportV24)return()=>{};
  const workspace=root.querySelector('.nx-canva-v3'),api=root.__nxCanvaWorkspaceV3;if(!workspace||!api)return()=>{};
  const exportButton=workspace.querySelector('[data-v3-export]'),projectsPane=workspace.querySelector('[data-v3-pane="projects"]'),projectsList=workspace.querySelector('[data-v3-projects]');if(!exportButton||!projectsPane||!projectsList)return()=>{};
  const style=document.createElement('style');style.id='nx-ai-photo-projects-export-v24';style.textContent=`.nxv24-export-format{width:66px!important;height:34px!important;margin-right:5px!important;padding:0 5px!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:9px!important;background:#252834!important;color:#f7f8fc!important;font-size:9px!important;font-weight:800!important}.nxv24-project-tools{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:7px;margin-bottom:8px;padding:8px;border:1px solid rgba(146,216,190,.22);border-radius:11px;background:#141d1c}.nxv24-project-tools button{min-height:34px!important}.nxv24-save-status{min-width:0;color:#b9c5c3;font-size:8px;line-height:1.35}.nxv24-save-status strong{display:block;color:#e8fff7;font-size:9px}.nxv24-storage-bad{color:#ffc3ca!important}@media(max-width:380px){.nxv24-export-format{width:58px!important;margin-right:3px!important}.nxv24-project-tools{grid-template-columns:1fr}.nxv3-head{gap:4px!important}}`;document.head.appendChild(style);
  const format=document.createElement('select');format.className='nxv24-export-format';format.setAttribute('aria-label','Export format');format.dataset.v24ExportFormat='';format.innerHTML='<option value="image/png">PNG</option><option value="image/jpeg">JPEG</option>';exportButton.parentElement?.insertBefore(format,exportButton);
  const tools=document.createElement('div');tools.className='nxv24-project-tools';tools.innerHTML='<button type="button" class="nxv3-btn" data-v24-save>Save now</button><div class="nxv24-save-status" data-v24-status><strong>Local project storage</strong><span>Checking this device…</span></div>';projectsPane.insertBefore(tools,projectsList);
  const saveButton=tools.querySelector('[data-v24-save]'),status=tools.querySelector('[data-v24-status]'),oldExport=exportButton.onclick;let lastSavedAt=0,lastExport=null,busy=false;
  function updateStatus(message=''){
    const current=api.getDesign(),saved=current?.id?loadDesignProject(current.id):null,ready=storageAvailable(),persisted=Boolean(current&&saved&&sameDesign(current,saved));
    status.classList.toggle('nxv24-storage-bad',!ready);status.innerHTML=`<strong>${ready?'Local project storage ready':'Local storage unavailable'}</strong><span>${message||(!current?'Open a design to save it.':persisted?'Current design is saved on this device.':'Current design has unsaved changes.')}</span>`;saveButton.disabled=!ready||!current||busy;return{ready,persisted,currentId:current?.id||null,savedCount:listDesignProjects().length}
  }
  function saveNow(){
    if(busy)throw new Error('Project save is already running.');const current=api.getDesign();if(!current)throw new Error('Open a design before saving.');if(!storageAvailable())throw new Error('Local project storage is unavailable.');busy=true;try{const saved=saveDesignProject(current);lastSavedAt=saved.updatedAt||Date.now();api.refreshProjects?.();updateStatus('Saved now on this device.');workspace.dispatchEvent(new CustomEvent('nx-project-v24:saved',{detail:{id:saved.id,updatedAt:lastSavedAt,elements:saved.elements?.length||0}}));return clone(saved)}finally{busy=false;updateStatus()}
  }
  async function exportCurrent(type=format.value){
    if(busy)throw new Error('Another project action is running.');const design=api.getDesign();if(!design)throw new Error('Open a design before exporting.');const mime=type==='image/jpeg'?'image/jpeg':'image/png',extension=mime==='image/jpeg'?'jpg':'png';busy=true;exportButton.disabled=true;saveButton.disabled=true;
    try{
      const rendered=document.createElement('canvas');renderDesignToCanvas(design,rendered,{pixelRatio:1});if(rendered.width!==design.width||rendered.height!==design.height)throw new Error('Export dimensions do not match the project canvas.');
      let target=rendered;if(mime==='image/jpeg'){target=document.createElement('canvas');target.width=rendered.width;target.height=rendered.height;const context=target.getContext('2d');if(!context)throw new Error('JPEG export canvas is unavailable.');context.fillStyle='#ffffff';context.fillRect(0,0,target.width,target.height);context.drawImage(rendered,0,0)}
      const blob=await blobFromCanvas(target,mime,mime==='image/jpeg'?.92:.98),name=`${safeBase(design.name)}.${extension}`;downloadBlob(blob,name);lastExport={mime:blob.type||mime,name,width:target.width,height:target.height,size:blob.size,at:Date.now()};workspace.dispatchEvent(new CustomEvent('nx-project-v24:exported',{detail:{...lastExport}}));return{...lastExport}
    }finally{busy=false;exportButton.disabled=!api.getDesign();updateStatus()}
  }
  exportButton.onclick=()=>{exportCurrent(format.value).catch(error=>updateStatus(String(error?.message||error)))};saveButton.onclick=()=>{try{saveNow()}catch(error){updateStatus(String(error?.message||error))}};
  const onNavigate=event=>{if(event.detail?.tab==='projects')requestAnimationFrame(()=>updateStatus())};workspace.addEventListener('nxv3:navigate',onNavigate);const observer=new MutationObserver(()=>{if(workspace.querySelector('[data-v3-pane="projects"].is-active'))requestAnimationFrame(()=>updateStatus())});observer.observe(projectsList,{childList:true,subtree:true});updateStatus();
  const v24={saveNow,exportCurrent,getState:()=>({...updateStatus(),format:format.value,lastSavedAt,lastExport:lastExport?{...lastExport}:null,busy})};root.__nxProjectsExportV24=v24;root.dataset.aiPhotoProjects='v24-durable-export';
  return()=>{observer.disconnect();workspace.removeEventListener('nxv3:navigate',onNavigate);exportButton.onclick=oldExport;format.remove();tools.remove();style.remove();delete root.__nxProjectsExportV24;delete root.dataset.aiPhotoProjects}
}