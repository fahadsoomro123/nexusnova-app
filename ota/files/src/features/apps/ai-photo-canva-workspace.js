import {
  NEXUSNOVA_TEMPLATE_CATEGORIES,
  NEXUSNOVA_TEMPLATES,
  getTemplateById,
  searchTemplates
} from './data/ai-photo-templates.js';
import {
  createDesignFromTemplate,
  addDesignElement,
  updateDesignElement,
  removeDesignElements,
  reorderDesignElement,
  renderDesignToCanvas,
  duplicateSelection,
  selectDesignElements
} from './ai-photo-design-canvas.js';
import {
  alignElements,
  resizeElement,
  toggleLock,
  toggleHidden
} from './ai-photo-design-tools.js';
import {
  createProjectAutosave,
  listDesignProjects,
  loadDesignProject,
  deleteDesignProject
} from './ai-photo-project-store.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));

function ensureStyles(){
  if(document.getElementById('nx-canva-workspace-v2'))return;
  const style=document.createElement('style');
  style.id='nx-canva-workspace-v2';
  style.textContent=`
  .nx-photo-editor.nx-canva-enabled .nx-photo-tools{grid-template-columns:repeat(6,minmax(0,1fr))!important}
  .nx-canva-workspace{position:absolute;inset:0;z-index:30;display:none;grid-template-rows:48px 44px minmax(0,1fr);overflow:hidden;background:#0f1015;color:#f7f7fb}
  .nx-canva-workspace.is-open{display:grid}
  .nx-canva-workspace *{box-sizing:border-box}
  .nx-canva-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(20,21,28,.97)}
  .nx-canva-title{min-width:0;text-align:center}.nx-canva-title strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.nx-canva-title span{display:block;margin-top:2px;color:#a9adbd;font-size:9px}
  .nx-canva-actions{display:flex;gap:3px}.nx-canva-btn{min-height:34px!important;padding:0 9px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:9px!important;background:#242632!important;color:#f6f6fb!important;font-size:10px!important}.nx-canva-btn.is-primary{border-color:transparent!important;background:linear-gradient(135deg,#8b3dff,#6927da)!important;color:#fff!important}.nx-canva-btn:disabled{opacity:.35!important}
  .nx-canva-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.08);background:#171820}.nx-canva-tab{height:34px!important;border-radius:9px!important;color:#aeb2c4!important;font-size:10px!important}.nx-canva-tab.is-active{background:#2a2338!important;color:#d7bfff!important}
  .nx-canva-body{position:relative;min-height:0;overflow:hidden}.nx-canva-pane{display:none;height:100%;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px}.nx-canva-pane.is-active{display:block}
  .nx-canva-filter{position:sticky;top:-8px;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) 130px;gap:7px;padding:8px 0;background:#0f1015}.nx-canva-filter input,.nx-canva-filter select,.nx-canva-control input,.nx-canva-control select{width:100%!important;height:38px!important;padding:0 9px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:9px!important;background:#20222c!important;color:#f6f6fb!important;font-size:11px!important}
  .nx-canva-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nx-canva-card{overflow:hidden!important;padding:0!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:12px!important;background:#191a22!important;text-align:left!important}.nx-canva-card canvas{display:block;width:100%;aspect-ratio:1.35/1;object-fit:contain;background:#111}.nx-canva-card span{display:block;overflow:hidden;padding:7px 8px;color:#f6f6fb;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.nx-canva-more{width:100%;margin:9px 0 3px}
  .nx-canva-design-pane{overflow:hidden!important;padding:0!important}.nx-canva-design-shell{display:grid;height:100%;min-height:0;grid-template-rows:minmax(0,1fr) auto}.nx-canva-stage{position:relative;display:grid;min-height:0;place-items:center;overflow:hidden;padding:10px;background:radial-gradient(circle at center,#262832,#111218 66%)}.nx-canva-stage canvas{display:block;max-width:96%;max-height:96%;box-shadow:0 14px 44px rgba(0,0,0,.45);touch-action:none}.nx-canva-stage-note{position:absolute;top:8px;left:8px;padding:5px 7px;border-radius:7px;background:rgba(0,0,0,.5);color:#d6d9e7;font-size:9px}
  .nx-canva-inspector{max-height:43vh;overflow:auto;padding:7px;border-top:1px solid rgba(255,255,255,.1);background:#171820}.nx-canva-toolbar{display:flex;gap:5px;overflow:auto;padding-bottom:7px;scrollbar-width:none}.nx-canva-toolbar::-webkit-scrollbar{display:none}.nx-canva-toolbar .nx-canva-btn{flex:0 0 auto}.nx-canva-control{display:grid;grid-template-columns:72px minmax(0,1fr) 44px;align-items:center;gap:6px;min-height:35px}.nx-canva-control>span{color:#c2c5d4;font-size:9px}.nx-canva-control output{color:#aaaec0;font-size:9px;text-align:right}.nx-canva-control textarea{width:100%!important;min-height:58px!important;padding:8px!important;resize:vertical!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:9px!important;background:#20222c!important;color:#fff!important;font-size:11px!important}.nx-canva-control input[type=range]{height:26px!important;padding:0!important;border:0!important;background:transparent!important;accent-color:#8b3dff}
  .nx-canva-layers{display:grid;gap:6px}.nx-canva-layer{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;padding:7px 8px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#191a22}.nx-canva-layer.is-selected{border-color:#8b3dff;background:#211a2e}.nx-canva-layer button{color:#f6f6fb!important;text-align:left!important}.nx-canva-layer strong{display:block;overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.nx-canva-layer small{display:block;margin-top:2px;color:#9da1b4;font-size:8px}
  .nx-canva-projects{display:grid;gap:7px}.nx-canva-project{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;padding:9px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#191a22}.nx-canva-project strong{display:block;font-size:11px}.nx-canva-project span{display:block;margin-top:2px;color:#9da1b4;font-size:8px}.nx-canva-empty{display:grid;min-height:160px;place-items:center;color:#9fa3b5;font-size:11px;text-align:center}
  .nx-canva-workspace.nx-design-control-live .nx-canva-head,.nx-canva-workspace.nx-design-control-live .nx-canva-tabs,.nx-canva-workspace.nx-design-control-live .nx-canva-toolbar{opacity:.08!important;pointer-events:none!important}.nx-canva-workspace.nx-design-control-live .nx-canva-inspector{border-color:transparent!important;background:rgba(18,19,25,.18)!important}.nx-canva-workspace.nx-design-control-live .nx-canva-control:not(.is-live-design-control){opacity:.06!important;pointer-events:none!important}.nx-canva-workspace.nx-design-control-live .nx-canva-control.is-live-design-control{padding:4px 6px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(20,21,28,.82)!important;opacity:1!important;pointer-events:auto!important}.nx-canva-workspace.nx-design-control-live .nx-canva-stage{filter:none!important}
  @media(max-width:420px){.nx-canva-filter{grid-template-columns:minmax(0,1fr) 112px}.nx-canva-grid{gap:6px}.nx-canva-btn{padding:0 7px!important}.nx-canva-title strong{font-size:12px}}
  `;
  document.head.appendChild(style);
}

function downloadCanvas(canvas,type='image/png',quality=.96,name='nexusnova-design'){
  canvas.toBlob(blob=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    const ext=type==='image/jpeg'?'jpg':type==='image/webp'?'webp':'png';
    anchor.href=url;anchor.download=`${name}.${ext}`;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  },type,quality);
}

function hitElement(design,canvas,event){
  const rect=canvas.getBoundingClientRect();
  if(!design||rect.width<=0||rect.height<=0)return null;
  const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
  return [...design.elements].sort((a,b)=>(b.z||0)-(a.z||0)).find(el=>!el.hidden&&x>=el.x&&x<=el.x+el.w&&y>=el.y&&y<=el.y+el.h)||null;
}

export function installAiPhotoCanvaWorkspace(root){
  if(!root||root.__nxCanvaWorkspaceInstalled)return()=>{};
  root.__nxCanvaWorkspaceInstalled=true;
  ensureStyles();root.classList.add('nx-canva-enabled');

  const tools=root.querySelector('.nx-photo-tools');
  const designButton=document.createElement('button');
  designButton.type='button';designButton.className='nx-photo-tool';designButton.innerHTML='<b>✦</b><span>Design</span>';
  tools?.appendChild(designButton);

  const workspace=document.createElement('section');
  workspace.className='nx-canva-workspace';
  workspace.innerHTML=`
    <div class="nx-canva-head">
      <button class="nx-canva-btn" data-nx-design-close>Photo</button>
      <div class="nx-canva-title"><strong data-nx-design-name>NexusNova Design</strong><span data-nx-design-meta>${NEXUSNOVA_TEMPLATES.length} editable templates</span></div>
      <div class="nx-canva-actions"><button class="nx-canva-btn" data-nx-design-undo disabled>↶</button><button class="nx-canva-btn" data-nx-design-redo disabled>↷</button><button class="nx-canva-btn is-primary" data-nx-design-export disabled>Export</button></div>
    </div>
    <nav class="nx-canva-tabs">
      <button class="nx-canva-tab is-active" data-nx-design-tab="templates">Templates</button>
      <button class="nx-canva-tab" data-nx-design-tab="design">Design</button>
      <button class="nx-canva-tab" data-nx-design-tab="layers">Layers</button>
      <button class="nx-canva-tab" data-nx-design-tab="projects">Projects</button>
    </nav>
    <div class="nx-canva-body">
      <section class="nx-canva-pane is-active" data-nx-design-pane="templates">
        <div class="nx-canva-filter"><input type="search" placeholder="Search 1000+ templates" data-nx-template-search><select data-nx-template-category><option value="all">All categories</option>${NEXUSNOVA_TEMPLATE_CATEGORIES.map(c=>`<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}</select></div>
        <div class="nx-canva-grid" data-nx-template-grid></div>
        <button class="nx-canva-btn nx-canva-more" data-nx-template-more>Load more</button>
      </section>
      <section class="nx-canva-pane nx-canva-design-pane" data-nx-design-pane="design">
        <div class="nx-canva-design-shell">
          <div class="nx-canva-stage" data-nx-design-stage><span class="nx-canva-stage-note">Tap element · drag to move</span><canvas data-nx-design-canvas></canvas></div>
          <div class="nx-canva-inspector">
            <div class="nx-canva-toolbar">
              <button class="nx-canva-btn" data-nx-add-text>Add text</button><button class="nx-canva-btn" data-nx-add-shape>Add shape</button><button class="nx-canva-btn" data-nx-duplicate>Duplicate</button><button class="nx-canva-btn" data-nx-delete>Delete</button><button class="nx-canva-btn" data-nx-front>Front</button><button class="nx-canva-btn" data-nx-back>Back</button><button class="nx-canva-btn" data-nx-lock>Lock</button><button class="nx-canva-btn" data-nx-hide>Hide</button><button class="nx-canva-btn" data-nx-align-center>Center</button><button class="nx-canva-btn" data-nx-align-middle>Middle</button>
            </div>
            <div data-nx-design-inspector></div>
          </div>
        </div>
      </section>
      <section class="nx-canva-pane" data-nx-design-pane="layers"><div class="nx-canva-layers" data-nx-layers></div></section>
      <section class="nx-canva-pane" data-nx-design-pane="projects"><div class="nx-canva-projects" data-nx-projects></div></section>
    </div>`;
  root.appendChild(workspace);

  const q=selector=>workspace.querySelector(selector),qa=selector=>[...workspace.querySelectorAll(selector)];
  const canvas=q('[data-nx-design-canvas]'),stage=q('[data-nx-design-stage]'),grid=q('[data-nx-template-grid]');
  const undo=q('[data-nx-design-undo]'),redo=q('[data-nx-design-redo]'),exportBtn=q('[data-nx-design-export]');
  let design=null,history=[],future=[],offset=0,lastQuery='',lastCategory='all',drag=null,dragBefore=null;
  const autosave=createProjectAutosave(()=>design,{delay:650,onSaved:()=>renderProjects()});

  const syncHistory=()=>{undo.disabled=!history.length;redo.disabled=!future.length};
  const pushHistory=before=>{if(!before)return;history.push(clone(before));if(history.length>60)history.shift();future.length=0;syncHistory()};
  const selected=()=>design?.elements?.find(el=>design.selection?.includes(el.id))||null;
  const setTab=id=>{qa('[data-nx-design-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.nxDesignTab===id));qa('[data-nx-design-pane]').forEach(p=>p.classList.toggle('is-active',p.dataset.nxDesignPane===id));if(id==='design')renderDesign();if(id==='layers')renderLayers();if(id==='projects')renderProjects()};
  const mutate=(fn,{record=true}={})=>{if(!design)return;const before=record?clone(design):null,next=fn(design);if(next)design=next;if(record)pushHistory(before);autosave.schedule();renderDesign();renderLayers()};

  function renderDesign(){
    if(!design){canvas.width=1;canvas.height=1;q('[data-nx-design-inspector]').innerHTML='<div class="nx-canva-empty">Choose a template to start.</div>';exportBtn.disabled=true;return}
    const rect=stage.getBoundingClientRect(),maxW=Math.max(220,rect.width-20),maxH=Math.max(220,rect.height-20),scale=Math.min(maxW/design.width,maxH/design.height,1);
    canvas.style.width=`${Math.max(1,Math.round(design.width*scale))}px`;canvas.style.height=`${Math.max(1,Math.round(design.height*scale))}px`;
    renderDesignToCanvas(design,canvas,{pixelRatio:clamp(scale*1.35,.3,1.2)});
    exportBtn.disabled=false;q('[data-nx-design-name]').textContent=design.name||'Untitled design';q('[data-nx-design-meta]').textContent=`${design.width} × ${design.height} · ${design.elements.length} layers`;renderInspector();
  }

  function enterControl(input){const row=input.closest('.nx-canva-control');if(!row)return;workspace.querySelectorAll('.is-live-design-control').forEach(n=>n.classList.remove('is-live-design-control'));row.classList.add('is-live-design-control');workspace.classList.add('nx-design-control-live')}
  function leaveControl(input){const row=input.closest('.nx-canva-control');setTimeout(()=>{row?.classList.remove('is-live-design-control');if(!workspace.querySelector('.is-live-design-control'))workspace.classList.remove('nx-design-control-live')},170)}

  function bindInspector(){
    const host=q('[data-nx-design-inspector]');
    host.querySelectorAll('input[type="range"]').forEach(input=>{input.onpointerdown=()=>enterControl(input);input.onfocus=()=>enterControl(input);input.onpointerup=()=>leaveControl(input);input.onpointercancel=()=>leaveControl(input);input.onblur=()=>leaveControl(input)});
    host.querySelector('[data-nx-bg]')?.addEventListener('input',e=>mutate(d=>({...clone(d),background:e.target.value,updatedAt:Date.now()})));
    host.querySelector('[data-nx-fill]')?.addEventListener('input',e=>{const id=selected()?.id;if(id)mutate(d=>updateDesignElement(d,id,{fill:e.target.value}))});
    host.querySelector('[data-nx-opacity]')?.addEventListener('input',e=>{const id=selected()?.id;if(id)mutate(d=>updateDesignElement(d,id,{opacity:Number(e.target.value)}))});
    host.querySelector('[data-nx-rotation]')?.addEventListener('input',e=>{const id=selected()?.id;if(id)mutate(d=>resizeElement(d,id,{rotation:Number(e.target.value)}))});
    host.querySelector('[data-nx-width]')?.addEventListener('input',e=>{const id=selected()?.id;if(id)mutate(d=>resizeElement(d,id,{w:Number(e.target.value)}))});
    host.querySelector('[data-nx-height]')?.addEventListener('input',e=>{const id=selected()?.id;if(id)mutate(d=>resizeElement(d,id,{h:Number(e.target.value)}))});
    host.querySelector('[data-nx-text]')?.addEventListener('input',e=>{const id=selected()?.id;if(id)mutate(d=>updateDesignElement(d,id,{text:e.target.value}))});
    host.querySelector('[data-nx-font-size]')?.addEventListener('input',e=>{const id=selected()?.id;if(id)mutate(d=>updateDesignElement(d,id,{fontSize:Number(e.target.value)}))});
    host.querySelector('[data-nx-font-weight]')?.addEventListener('change',e=>{const id=selected()?.id;if(id)mutate(d=>updateDesignElement(d,id,{fontWeight:Number(e.target.value)}))});
  }

  function renderInspector(){
    const host=q('[data-nx-design-inspector]');if(!design){host.innerHTML='';return}
    const el=selected();
    if(!el){host.innerHTML=`<div class="nx-canva-control"><span>Background</span><input type="color" value="${/^#[0-9a-f]{6}$/i.test(design.background||'')?design.background:'#ffffff'}" data-nx-bg><output>Canvas</output></div>`;bindInspector();return}
    const text=el.type==='text'?`<div class="nx-canva-control" style="grid-template-columns:72px minmax(0,1fr)"><span>Text</span><textarea data-nx-text>${esc(el.text||'')}</textarea></div><div class="nx-canva-control"><span>Size</span><input type="range" min="0.018" max="0.16" step="0.002" value="${Number(el.fontSize)||.05}" data-nx-font-size><output>${Math.round((Number(el.fontSize)||.05)*1000)}</output></div><div class="nx-canva-control"><span>Weight</span><select data-nx-font-weight><option value="400">Regular</option><option value="600">Semi</option><option value="700">Bold</option><option value="800">Extra</option><option value="900">Black</option></select><output>${Number(el.fontWeight)||600}</output></div>`:'';
    host.innerHTML=`${text}<div class="nx-canva-control"><span>Color</span><input type="color" value="${/^#[0-9a-f]{6}$/i.test(el.fill||'')?el.fill:'#ffffff'}" data-nx-fill><output>${esc(el.type)}</output></div><div class="nx-canva-control"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value="${Number(el.opacity??1)}" data-nx-opacity><output>${Math.round(Number(el.opacity??1)*100)}%</output></div><div class="nx-canva-control"><span>Rotate</span><input type="range" min="-180" max="180" step="1" value="${Number(el.rotation)||0}" data-nx-rotation><output>${Math.round(Number(el.rotation)||0)}°</output></div><div class="nx-canva-control"><span>Width</span><input type="range" min="0.03" max="1" step="0.01" value="${Number(el.w)||.2}" data-nx-width><output>${Math.round((Number(el.w)||.2)*100)}%</output></div><div class="nx-canva-control"><span>Height</span><input type="range" min="0.02" max="1" step="0.01" value="${Number(el.h)||.2}" data-nx-height><output>${Math.round((Number(el.h)||.2)*100)}%</output></div>`;
    const weight=host.querySelector('[data-nx-font-weight]');if(weight)weight.value=String(Number(el.fontWeight)||600);bindInspector();
  }

  function renderLayers(){
    const host=q('[data-nx-layers]');if(!design){host.innerHTML='<div class="nx-canva-empty">Choose a template first.</div>';return}
    host.innerHTML=[...design.elements].sort((a,b)=>(b.z||0)-(a.z||0)).map(el=>`<div class="nx-canva-layer ${design.selection?.includes(el.id)?'is-selected':''}"><button data-layer-id="${esc(el.id)}"><strong>${esc(el.text||el.type||'Layer')}</strong><small>${el.locked?'Locked · ':''}${el.hidden?'Hidden · ':''}Layer ${Number(el.z)+1}</small></button><span>${el.type==='text'?'T':'◆'}</span></div>`).join('');
    host.querySelectorAll('[data-layer-id]').forEach(button=>button.onclick=()=>{design=selectDesignElements(design,[button.dataset.layerId]);setTab('design')});
  }

  function renderProjects(){
    const host=q('[data-nx-projects]'),rows=listDesignProjects();if(!rows.length){host.innerHTML='<div class="nx-canva-empty">Editable designs autosave here.</div>';return}
    host.innerHTML=rows.map(p=>`<div class="nx-canva-project"><button class="nx-canva-btn" data-project-load="${esc(p.id)}"><strong>${esc(p.name)}</strong><span>${p.width} × ${p.height} · ${p.elements} layers</span></button><button class="nx-canva-btn" data-project-delete="${esc(p.id)}">Delete</button></div>`).join('');
    host.querySelectorAll('[data-project-load]').forEach(button=>button.onclick=()=>{const loaded=loadDesignProject(button.dataset.projectLoad);if(!loaded)return;design=loaded;history=[];future=[];syncHistory();setTab('design')});
    host.querySelectorAll('[data-project-delete]').forEach(button=>button.onclick=()=>{deleteDesignProject(button.dataset.projectDelete);renderProjects()});
  }

  function makeTemplateCard(template){
    const button=document.createElement('button');button.type='button';button.className='nx-canva-card';const preview=document.createElement('canvas');preview.width=240;preview.height=Math.max(120,Math.round(240*template.canvas.height/template.canvas.width));try{renderDesignToCanvas(createDesignFromTemplate(template),preview,{pixelRatio:.22})}catch{}const label=document.createElement('span');label.textContent=template.name;button.append(preview,label);button.onclick=()=>{const source=getTemplateById(template.id);if(!source)return;design=createDesignFromTemplate(source);history=[];future=[];syncHistory();autosave.schedule();setTab('design')};return button;
  }

  function renderTemplates(reset=false){
    const query=q('[data-nx-template-search]').value.trim(),category=q('[data-nx-template-category]').value;if(reset||query!==lastQuery||category!==lastCategory){offset=0;grid.innerHTML='';lastQuery=query;lastCategory=category}const result=searchTemplates({query,category,limit:40,offset});result.items.forEach(template=>grid.appendChild(makeTemplateCard(template)));offset+=result.items.length;q('[data-nx-template-more]').hidden=offset>=result.total;
  }

  const open=()=>{workspace.classList.add('is-open');designButton.classList.add('is-active');root.classList.remove('nx-photo-focus-editing','nx-photo-control-live');if(!grid.children.length)renderTemplates(true);renderDesign()};
  const close=()=>{workspace.classList.remove('is-open','nx-design-control-live');designButton.classList.remove('is-active');autosave.flush()};
  designButton.onclick=open;q('[data-nx-design-close]').onclick=close;qa('[data-nx-design-tab]').forEach(button=>button.onclick=()=>setTab(button.dataset.nxDesignTab));q('[data-nx-template-search]').oninput=()=>renderTemplates(true);q('[data-nx-template-category]').onchange=()=>renderTemplates(true);q('[data-nx-template-more]').onclick=()=>renderTemplates(false);
  undo.onclick=()=>{if(!history.length||!design)return;future.push(clone(design));design=history.pop();syncHistory();renderDesign();renderLayers();autosave.schedule()};redo.onclick=()=>{if(!future.length||!design)return;history.push(clone(design));design=future.pop();syncHistory();renderDesign();renderLayers();autosave.schedule()};
  exportBtn.onclick=()=>{if(!design)return;const out=document.createElement('canvas');renderDesignToCanvas(design,out,{pixelRatio:1});downloadCanvas(out,'image/png',.96,(design.name||'nexusnova-design').replace(/[^a-z0-9-_]+/gi,'-').toLowerCase())};

  q('[data-nx-add-text]').onclick=()=>mutate(d=>addDesignElement(d,{type:'text',x:.12,y:.16,w:.76,h:.15,text:'Edit this text',fill:'#ffffff',fontFamily:'system-ui',fontWeight:800,fontSize:.07,align:'center'}));q('[data-nx-add-shape]').onclick=()=>mutate(d=>addDesignElement(d,{type:'rect',x:.25,y:.25,w:.5,h:.3,fill:'#8b3dff',radius:.04}));q('[data-nx-duplicate]').onclick=()=>mutate(d=>duplicateSelection(d));q('[data-nx-delete]').onclick=()=>mutate(d=>removeDesignElements(d,d.selection||[]));q('[data-nx-front]').onclick=()=>{const id=selected()?.id;if(id)mutate(d=>reorderDesignElement(d,id,'front'))};q('[data-nx-back]').onclick=()=>{const id=selected()?.id;if(id)mutate(d=>reorderDesignElement(d,id,'back'))};q('[data-nx-lock]').onclick=()=>{const id=selected()?.id;if(id)mutate(d=>toggleLock(d,id))};q('[data-nx-hide]').onclick=()=>{const id=selected()?.id;if(id)mutate(d=>toggleHidden(d,id))};q('[data-nx-align-center]').onclick=()=>{if(design?.selection?.length)mutate(d=>alignElements(d,d.selection,'center'))};q('[data-nx-align-middle]').onclick=()=>{if(design?.selection?.length)mutate(d=>alignElements(d,d.selection,'middle'))};

  canvas.addEventListener('pointerdown',event=>{if(!design)return;const hit=hitElement(design,canvas,event);if(!hit){design=selectDesignElements(design,[]);renderDesign();renderLayers();return}design=selectDesignElements(design,[hit.id]);renderDesign();renderLayers();if(hit.locked)return;const rect=canvas.getBoundingClientRect();drag={id:hit.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,w:rect.width,h:rect.height,x:hit.x,y:hit.y};dragBefore=clone(design);canvas.setPointerCapture?.(event.pointerId)});
  canvas.addEventListener('pointermove',event=>{if(!drag||drag.pointerId!==event.pointerId||!design)return;const dx=(event.clientX-drag.startX)/Math.max(1,drag.w),dy=(event.clientY-drag.startY)/Math.max(1,drag.h);design=updateDesignElement(design,drag.id,{x:clamp(drag.x+dx,0,1),y:clamp(drag.y+dy,0,1)});renderDesignToCanvas(design,canvas,{pixelRatio:clamp(canvas.getBoundingClientRect().width/design.width*1.35,.3,1.2)});autosave.schedule()});
  const endDrag=event=>{if(!drag||drag.pointerId!==event.pointerId)return;if(dragBefore)pushHistory(dragBefore);drag=null;dragBefore=null;renderDesign();renderLayers()};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);

  const onResize=()=>{if(workspace.classList.contains('is-open')&&design)renderDesign()};window.addEventListener('resize',onResize);
  return()=>{autosave.destroy();window.removeEventListener('resize',onResize);designButton.remove();workspace.remove();root.classList.remove('nx-canva-enabled');delete root.__nxCanvaWorkspaceInstalled};
}
