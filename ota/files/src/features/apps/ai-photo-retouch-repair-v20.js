const TOOL_PRESETS={
  blemish:{tool:'heal',size:7,strength:62,label:'Blemish Cleanup',status:'Blemish Cleanup uses the source-aware Healing brush with a small natural patch.'},
  distraction:{tool:'heal',size:22,strength:78,label:'Distraction Repair',status:'Distraction Repair uses the source-aware Healing brush. Paint over the unwanted area in short strokes.'},
  heal:{size:12,strength:70,status:'Healing samples nearby source texture and blends it into the painted area.'},
  clone:{size:12,strength:72,status:'Clone: tap a clean source point first, then paint the destination.'},
  smooth:{size:14,strength:38,status:'Skin Smooth is selective and intentionally gentle to preserve natural texture.'},
  whiten:{size:9,strength:32,status:'Teeth Whiten is a manual selective brush with restrained luminance/desaturation.'},
  brighten:{size:8,strength:30,status:'Eye Brighten applies a restrained local lift. Paint only the iris/eye highlight area.'},
  redeye:{size:8,strength:72,status:'Red Eye reduces dominant red locally while preserving surrounding luminance.'},
  sharpen:{size:11,strength:48,status:'Local Detail adds selective edge definition without changing the full photo.'}
};

function setRange(input,value){
  if(!input)return;
  input.value=String(value);
  input.dispatchEvent(new Event('input',{bubbles:true}));
}

function makeMirror(label,source,key){
  const wrap=document.createElement('label');
  wrap.className='nx-photo-field nxrt-field';
  const value=source?.value||'0';
  wrap.innerHTML=`<span>${label}</span><input type="range" min="${source?.min||0}" max="${source?.max||100}" step="${source?.step||1}" value="${value}" data-nxrt-${key}><output>${value}</output>`;
  const mirror=wrap.querySelector('input');
  const output=wrap.querySelector('output');
  mirror.addEventListener('input',()=>{setRange(source,mirror.value);output.textContent=mirror.value});
  source?.addEventListener('input',()=>{mirror.value=source.value;output.textContent=source.value});
  return wrap;
}

function decorateEditor(editor){
  if(!editor||editor.dataset.nxRetouchRepair==='v20')return;
  const repair=editor.querySelector('[data-photo-sub="repair"]');
  const retouch=editor.querySelector('[data-photo-sub="retouch"]');
  const size=editor.querySelector('[data-local-size]');
  const strength=editor.querySelector('[data-local-strength]');
  const heal=editor.querySelector('[data-local-tool="heal"]');
  const undo=editor.querySelector('[data-history-undo]');
  const redo=editor.querySelector('[data-history-redo]');
  if(!repair||!retouch||!size||!strength||!heal||!undo||!redo)return;
  editor.dataset.nxRetouchRepair='v20';

  const repairPills=repair.querySelector('.nx-photo-pills');
  for(const key of['blemish','distraction']){
    const cfg=TOOL_PRESETS[key],button=document.createElement('button');
    button.type='button';button.className='nx-photo-pill';button.dataset.nxrtPreset=key;button.textContent=cfg.label;
    button.addEventListener('click',()=>{
      heal.click();setRange(size,cfg.size);setRange(strength,cfg.strength);
      repair.querySelectorAll('[data-nxrt-preset]').forEach(item=>item.classList.toggle('is-active',item===button));
      const localStatus=repair.querySelector('[data-local-status]');if(localStatus)localStatus.textContent=cfg.status;
      const retouchStatus=retouch.querySelector('[data-nxrt-status]');if(retouchStatus)retouchStatus.textContent=cfg.status;
    });
    repairPills.appendChild(button);
  }

  const retouchControls=document.createElement('div');
  retouchControls.className='nxrt-retouch-controls';
  retouchControls.append(makeMirror('Brush size',size,'size'),makeMirror('Strength',strength,'strength'));
  const quick=document.createElement('div');quick.className='nx-photo-row nxrt-history';
  quick.innerHTML='<button type="button" class="nx-photo-action" data-nxrt-undo>Undo brush</button><button type="button" class="nx-photo-action" data-nxrt-redo>Redo brush</button>';
  const status=document.createElement('div');status.className='nx-photo-status nxrt-status';status.dataset.nxrtStatus='';status.textContent='Choose a local retouch brush. All retouch stays manual, selective and identity-preserving.';
  retouch.append(retouchControls,quick,status);
  quick.querySelector('[data-nxrt-undo]').onclick=()=>undo.click();
  quick.querySelector('[data-nxrt-redo]').onclick=()=>redo.click();

  const repairHistory=document.createElement('div');repairHistory.className='nx-photo-row nxrt-history';
  repairHistory.innerHTML='<button type="button" class="nx-photo-action" data-nxrt-repair-undo>Undo brush</button><button type="button" class="nx-photo-action" data-nxrt-repair-redo>Redo brush</button>';
  repair.appendChild(repairHistory);repairHistory.querySelector('[data-nxrt-repair-undo]').onclick=()=>undo.click();repairHistory.querySelector('[data-nxrt-repair-redo]').onclick=()=>redo.click();

  editor.querySelectorAll('[data-local-tool]').forEach(button=>button.addEventListener('click',()=>{
    const tool=button.dataset.localTool,cfg=TOOL_PRESETS[tool];
    repair.querySelectorAll('[data-nxrt-preset]').forEach(item=>item.classList.remove('is-active'));
    if(cfg){setRange(size,cfg.size);setRange(strength,cfg.strength);status.textContent=cfg.status}
  }));
}

export function installAiPhotoRetouchRepairV20(root){
  if(!root||root.__nxAiPhotoRetouchRepairV20)return()=>{};
  root.__nxAiPhotoRetouchRepairV20=true;
  const style=document.createElement('style');style.id='nx-ai-photo-retouch-repair-v20';style.textContent=`
    .nx-photo-editor .nxrt-retouch-controls{display:grid;gap:3px;margin-top:8px;padding-top:7px;border-top:1px solid var(--p-l)}
    .nx-photo-editor .nxrt-history{margin-top:7px}
    .nx-photo-editor .nxrt-history .nx-photo-action{min-height:38px!important}
    .nx-photo-editor .nxrt-status{margin-top:7px;padding:7px 8px;border:1px solid var(--p-l);border-radius:9px;background:var(--p-s2);color:var(--p-m)!important}
    .nx-photo-editor [data-nxrt-preset].is-active{border-color:var(--p-purple)!important;color:var(--p-purple)!important;background:color-mix(in srgb,var(--p-purple) 8%,var(--p-s2))!important}
    @media(pointer:coarse){.nx-photo-editor .nxrt-history .nx-photo-action,.nx-photo-editor [data-nxrt-preset]{min-height:42px!important}}
  `;document.head.appendChild(style);
  const patch=()=>decorateEditor(root.matches?.('.nx-photo-editor')?root:root.querySelector('.nx-photo-editor'));
  patch();const observer=new MutationObserver(patch);observer.observe(root,{childList:true,subtree:true});
  return()=>{observer.disconnect();style.remove();delete root.__nxAiPhotoRetouchRepairV20};
}
