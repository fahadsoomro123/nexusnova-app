const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function pointer(canvas,type,x,y,id=731){
  const Ctor=globalThis.PointerEvent||globalThis.MouseEvent;
  canvas.dispatchEvent(new Ctor(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:id,button:0,buttons:type==='pointerup'?0:1,pointerType:'touch'}));
}

function selectedDesign(root){
  const api=root.__nxCanvaWorkspaceV3,design=api?.getDesign?.();
  if(!design)return{};
  const id=design.selection?.[0],element=design.elements?.find(item=>item.id===id);
  return{api,design,element};
}

function moveSelection(root,{x=null,y=null,dx=0,dy=0}={}){
  const canvas=root.querySelector('[data-v3-canvas]'),{element}=selectedDesign(root);
  if(!canvas||!element||element.locked)return false;
  const rect=canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return false;
  const sx=rect.left+(element.x+element.w/2)*rect.width,sy=rect.top+(element.y+element.h/2)*rect.height;
  const targetX=x==null?clamp(element.x+dx,0,1-element.w):clamp(x,0,1-element.w);
  const targetY=y==null?clamp(element.y+dy,0,1-element.h):clamp(y,0,1-element.h);
  const ex=rect.left+(targetX+element.w/2)*rect.width,ey=rect.top+(targetY+element.h/2)*rect.height;
  pointer(canvas,'pointerdown',sx,sy);pointer(canvas,'pointermove',ex,ey);pointer(canvas,'pointerup',ex,ey);return true;
}

function selectionLabel(element){
  if(!element)return'Canvas ready';
  const type=element.type==='text'?'Text':element.type==='photo'?'Photo':element.type==='rect'?'Shape':String(element.type||'Layer');
  return`${type} selected${element.locked?' · Locked':''}`;
}

export function installAiPhotoDesignDelightV13(root){
  if(!root||root.__nxDesignDelightV13)return()=>{};
  root.__nxDesignDelightV13=true;
  const workspace=root.querySelector('.nx-canva-v3'),stage=workspace?.querySelector('[data-v3-stage]'),toolbar=workspace?.querySelector('.nxv3-toolbar');
  if(!workspace||!stage||!toolbar){delete root.__nxDesignDelightV13;return()=>{}}

  const style=document.createElement('style');style.id='nx-ai-photo-design-delight-v13';style.textContent=`
    .nx-canva-v3.nxv13-premium{background:radial-gradient(circle at 82% -8%,rgba(123,74,231,.13),transparent 30%),#0b0e14!important}
    .nx-canva-v3.nxv13-premium .nxv3-head{background:rgba(17,20,29,.96)!important;backdrop-filter:blur(16px)}
    .nx-canva-v3.nxv13-premium .nxv3-tabs{padding:5px 7px!important;background:#10131b!important;gap:5px!important}
    .nx-canva-v3.nxv13-premium .nxv3-tab{height:35px!important;border:1px solid transparent!important;border-radius:10px!important;transition:transform .12s ease,background .12s ease,border-color .12s ease!important}
    .nx-canva-v3.nxv13-premium .nxv3-tab.is-active{border-color:rgba(177,124,255,.35)!important;background:linear-gradient(145deg,#36244e,#211a31)!important;color:#f1e6ff!important;box-shadow:0 6px 18px rgba(104,53,180,.16)!important}
    .nx-canva-v3.nxv13-premium .nxv3-stage{background:radial-gradient(circle at 50% 46%,#2b303b 0,#181c25 48%,#0c0f15 100%)!important}
    .nx-canva-v3.nxv13-premium .nxv3-stage::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .15s ease;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:24px 24px}
    .nx-canva-v3.nxv13-premium.nxv13-grid .nxv3-stage::before{opacity:1}
    .nx-canva-v3.nxv13-premium .nxv3-stage canvas{border-radius:4px;box-shadow:0 20px 60px rgba(0,0,0,.56),0 0 0 1px rgba(255,255,255,.06)!important}
    .nxv13-status{position:absolute;top:8px;right:8px;z-index:4;max-width:48%;padding:6px 9px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(10,12,18,.82);color:#e8eaf3;font-size:8px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;backdrop-filter:blur(10px);pointer-events:none}
    .nx-canva-v3.nxv13-premium .nxv3-inspector{max-height:40vh!important;padding:8px!important;background:linear-gradient(180deg,#151821,#11141c)!important}
    .nx-canva-v3.nxv13-premium .nxv3-toolbar{gap:6px!important;padding:0 0 8px!important;scroll-snap-type:x proximity}
    .nx-canva-v3.nxv13-premium .nxv3-toolbar .nxv3-btn{min-height:38px!important;border-radius:11px!important;scroll-snap-align:start;white-space:nowrap;touch-action:manipulation}
    .nxv13-pro{position:relative;display:flex;gap:6px;flex:0 0 auto}
    .nxv13-pro>.nxv3-btn{border-color:rgba(181,119,255,.42)!important;background:linear-gradient(145deg,#312243,#20192d)!important;color:#f2e8ff!important}
    .nxv13-pop{position:absolute;z-index:25;right:0;bottom:44px;display:none;width:226px;padding:8px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:rgba(18,21,30,.98);box-shadow:0 18px 50px rgba(0,0,0,.48);backdrop-filter:blur(18px)}
    .nxv13-pop.is-open{display:grid;gap:7px}.nxv13-pop strong{font-size:9px;color:#d7c6ef}.nxv13-align-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.nxv13-align-grid button,.nxv13-nudge button{min-height:36px!important;padding:0 7px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:9px!important;background:#20242f!important;color:#eef0f7!important;font-size:9px!important;font-weight:750!important}.nxv13-align-grid button:active,.nxv13-nudge button:active{transform:scale(.96)}
    .nxv13-nudge{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.nxv13-pop-note{color:#9299aa;font-size:8px;line-height:1.35}
    .nx-canva-v3.nxv13-focus .nxv3-inspector{max-height:50px!important;overflow:hidden!important}.nx-canva-v3.nxv13-focus .nxv3-inspector>[data-v3-inspector]{display:none!important}.nx-canva-v3.nxv13-focus .nxv3-stage canvas{max-width:98%!important;max-height:98%!important}
    @media(max-width:420px){.nxv13-pop{position:fixed;left:10px;right:10px;bottom:74px;width:auto}.nxv13-status{max-width:56%}.nx-canva-v3.nxv13-premium .nxv3-inspector{max-height:38vh!important}}
  `;document.head.appendChild(style);workspace.classList.add('nxv13-premium');

  const status=document.createElement('div');status.className='nxv13-status';status.textContent='Canvas ready';stage.appendChild(status);
  const pro=document.createElement('div');pro.className='nxv13-pro';pro.innerHTML=`<button type="button" class="nxv3-btn" data-nxv13-align>Align</button><button type="button" class="nxv3-btn" data-nxv13-grid aria-pressed="false">Grid</button><button type="button" class="nxv3-btn" data-nxv13-focus aria-pressed="false">Focus</button><div class="nxv13-pop" data-nxv13-pop><strong>Precision layout</strong><div class="nxv13-align-grid"><button data-nxv13-pos="left">Left</button><button data-nxv13-pos="hcenter">H Center</button><button data-nxv13-pos="right">Right</button><button data-nxv13-pos="top">Top</button><button data-nxv13-pos="vcenter">V Center</button><button data-nxv13-pos="bottom">Bottom</button></div><strong>Nudge 1%</strong><div class="nxv13-nudge"><button data-nxv13-nudge="left">←</button><button data-nxv13-nudge="up">↑</button><button data-nxv13-nudge="down">↓</button><button data-nxv13-nudge="right">→</button></div><div class="nxv13-pop-note">Alignment edits use the same drag/history/autosave path as normal canvas moves.</div></div>`;toolbar.appendChild(pro);
  const pop=pro.querySelector('[data-nxv13-pop]');
  pro.querySelector('[data-nxv13-align]').onclick=()=>pop.classList.toggle('is-open');
  pro.querySelector('[data-nxv13-grid]').onclick=event=>{const active=workspace.classList.toggle('nxv13-grid');event.currentTarget.setAttribute('aria-pressed',String(active))};
  pro.querySelector('[data-nxv13-focus]').onclick=event=>{const active=workspace.classList.toggle('nxv13-focus');event.currentTarget.setAttribute('aria-pressed',String(active));event.currentTarget.textContent=active?'Exit Focus':'Focus'};
  pro.querySelectorAll('[data-nxv13-pos]').forEach(button=>button.onclick=()=>{const {element}=selectedDesign(root);if(!element)return;const p=button.dataset.nxv13Pos,point={};if(p==='left')point.x=0;if(p==='hcenter')point.x=(1-element.w)/2;if(p==='right')point.x=1-element.w;if(p==='top')point.y=0;if(p==='vcenter')point.y=(1-element.h)/2;if(p==='bottom')point.y=1-element.h;moveSelection(root,point);pop.classList.remove('is-open')});
  pro.querySelectorAll('[data-nxv13-nudge]').forEach(button=>button.onclick=()=>{const d=.01,dir=button.dataset.nxv13Nudge;moveSelection(root,{dx:dir==='left'?-d:dir==='right'?d:0,dy:dir==='up'?-d:dir==='down'?d:0})});

  const sync=()=>{const state=root.__nxCanvaWorkspaceV3?.getState?.(),{element}=selectedDesign(root);status.textContent=state?.tab==='design'?selectionLabel(element):'Design Studio';status.hidden=!workspace.classList.contains('is-open')};
  const observer=new MutationObserver(()=>requestAnimationFrame(sync));observer.observe(workspace,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});workspace.addEventListener('nxv3:navigate',sync);sync();
  const outside=event=>{if(pop.classList.contains('is-open')&&!pro.contains(event.target))pop.classList.remove('is-open')};document.addEventListener('pointerdown',outside,true);

  return()=>{document.removeEventListener('pointerdown',outside,true);workspace.removeEventListener('nxv3:navigate',sync);observer.disconnect();pro.remove();status.remove();style.remove();workspace.classList.remove('nxv13-premium','nxv13-grid','nxv13-focus');delete root.__nxDesignDelightV13};
}
