const coarsePointer=()=>globalThis.matchMedia?.('(pointer: coarse)')?.matches===true;

export function installAiPhotoFlagshipShellV14(root){
  if(!root||root.__nxAiPhotoFlagshipShellV14)return()=>{};
  root.__nxAiPhotoFlagshipShellV14=true;
  root.classList.add('nx-photo-v14');
  if(coarsePointer())root.classList.add('nx-photo-coarse');

  const style=document.createElement('style');
  style.id='nx-ai-photo-flagship-shell-v14';
  style.textContent=`
  /* v14 is deliberately root-scoped instead of depending on the outer route.
     The same visual contract therefore applies in Android, QA mounts and nested
     editor launches. */
  .nx-photo-editor.nx-photo-v14 .nx-photo-frame{
    --p-bg:#080b12!important;
    --p-s:#101620!important;
    --p-s2:#171e2a!important;
    --p-t:#f7f9ff!important;
    --p-m:#aab4c5!important;
    --p-l:rgba(255,255,255,.115)!important;
    --p-purple:#a45cff!important;
    color-scheme:dark!important;
    color:#f7f9ff!important;
    background:#080b12!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-frame :is(button,[role="button"],label,span,strong,b,small,em,i,input,textarea,select,option,optgroup,output){
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-top{
    border-bottom-color:rgba(255,255,255,.10)!important;
    background:linear-gradient(180deg,#131924,#0e141d)!important;
    color:#f7f9ff!important;
    box-shadow:0 7px 24px rgba(0,0,0,.26)!important;
    backdrop-filter:none!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-top :is(button,span,strong){color:#f7f9ff!important}
  .nx-photo-editor.nx-photo-v14 :is(.nx-photo-add,.nx-photo-mini){
    border:1px solid rgba(255,255,255,.11)!important;
    background:#19212d!important;
    color:#eef2fb!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-export-top,
  .nx-photo-editor.nx-photo-v14 .nx-photo-primary{
    background:linear-gradient(135deg,#a85cff,#7134e9)!important;
    color:#fff!important;
    box-shadow:0 7px 18px rgba(126,59,224,.24)!important;
  }

  .nx-photo-editor.nx-photo-v14 .nx-photo-work{
    background-color:#d2d5db!important;
    background-image:linear-gradient(45deg,rgba(70,74,84,.09) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(70,74,84,.09) 75%),linear-gradient(45deg,transparent 75%,rgba(70,74,84,.09) 75%),linear-gradient(45deg,rgba(70,74,84,.09) 25%,transparent 25%)!important;
    background-size:22px 22px!important;
    background-position:0 0,0 0,11px -11px,-11px 11px!important;
    contain:layout paint style!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-work>canvas[data-photo-canvas]{
    max-width:94%!important;max-height:94%!important;
    box-shadow:0 18px 52px rgba(5,7,12,.34),0 0 0 1px rgba(0,0,0,.08)!important;
    will-change:auto!important;
  }
  .nx-photo-editor.nx-photo-v14.nx-photo-control-live .nx-photo-work>canvas[data-photo-canvas]{will-change:transform!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-empty{
    border-color:rgba(130,91,190,.34)!important;
    background:rgba(249,250,252,.98)!important;
    color:#17191f!important;
    box-shadow:0 18px 48px rgba(12,14,20,.18)!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-empty strong{color:#17191f!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-empty p{color:#626875!important}
  .nx-photo-editor.nx-photo-v14 :is(.nx-photo-before,.nx-photo-zoomlabel){
    border:1px solid rgba(255,255,255,.12)!important;
    background:rgba(13,17,25,.94)!important;
    color:#fff!important;
    backdrop-filter:none!important;
  }

  .nx-photo-editor.nx-photo-v14 .nx-photo-tools{
    border-top-color:rgba(255,255,255,.10)!important;
    background:linear-gradient(180deg,#111821,#0c1118)!important;
    box-shadow:0 -8px 24px rgba(0,0,0,.24)!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-tool{
    color:#aeb8c9!important;
    border-radius:10px!important;
    transition:color .12s ease,background .12s ease!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-tool :is(b,span){color:inherit!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-tool.is-active{
    color:#f7edff!important;
    background:linear-gradient(180deg,rgba(164,92,255,.27),rgba(116,52,224,.13))!important;
  }

  .nx-photo-editor.nx-photo-v14 .nx-photo-sheet{
    left:8px!important;right:8px!important;bottom:66px!important;
    height:min(54vh,430px)!important;max-height:min(54vh,430px)!important;
    border-color:rgba(255,255,255,.12)!important;
    background:linear-gradient(180deg,#181f2b,#10161f)!important;
    color:#f7f9ff!important;
    box-shadow:0 -16px 46px rgba(0,0,0,.44)!important;
    backdrop-filter:none!important;
    contain:layout paint style!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-sheet-head{
    border-bottom-color:rgba(255,255,255,.09)!important;
    background:#151c27!important;
    color:#f7f9ff!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-sheet-head :is(strong,button){color:#f7f9ff!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-panel{
    height:calc(100% - 42px)!important;
    padding:10px 11px 14px!important;
    color:#f7f9ff!important;
    scrollbar-color:#665085 transparent!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-panel.is-active{display:block!important;visibility:visible!important;opacity:1!important}
  .nx-photo-editor.nx-photo-v14 :is(.nx-photo-tabs,.nx-photo-pills){gap:6px!important;padding:1px 0 9px!important}
  .nx-photo-editor.nx-photo-v14 :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio,.nx-photo-preset,.nx-photo-ai-action){
    border-color:rgba(255,255,255,.11)!important;
    background:#1b2330!important;
    color:#dce2ee!important;
  }
  .nx-photo-editor.nx-photo-v14 :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio,.nx-photo-preset,.nx-photo-ai-action).is-active{
    border-color:#a45cff!important;
    background:rgba(119,58,209,.25)!important;
    color:#f2e5ff!important;
    box-shadow:inset 0 0 0 1px rgba(164,92,255,.15)!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-field{
    grid-template-columns:86px minmax(0,1fr) 46px!important;
    min-height:35px!important;
    gap:8px!important;
  }
  .nx-photo-editor.nx-photo-v14 .nx-photo-field span{color:#d9dfeb!important;font-size:10.5px!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-field output{color:#c2a7eb!important;font-size:10px!important}
  .nx-photo-editor.nx-photo-v14 input[type=range]{
    height:30px!important;
    accent-color:#a45cff!important;
    touch-action:pan-y!important;
    transition:none!important;
  }
  .nx-photo-editor.nx-photo-v14 :is(textarea,select,input[type=text]){
    border-color:rgba(255,255,255,.12)!important;
    background:#0f151f!important;
    color:#f7f9ff!important;
    caret-color:#fff!important;
  }
  .nx-photo-editor.nx-photo-v14 :is(select option,select optgroup){background:#0f151f!important;color:#f7f9ff!important}
  .nx-photo-editor.nx-photo-v14 :is(textarea,input)::placeholder{color:#8390a4!important}
  .nx-photo-editor.nx-photo-v14 :is(.nx-photo-status,.nx-photo-ai-action small,.nx-photo-metrics span){color:#9faabc!important}
  .nx-photo-editor.nx-photo-v14 :is(.nx-photo-hist,.nx-photo-curve){border-color:rgba(255,255,255,.11)!important;background:#0d131c!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-metrics div{border-color:rgba(255,255,255,.10)!important;background:#171e29!important;color:#eef2fb!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-crop-actions button:not(:last-child){background:#151c27!important;color:#fff!important;border:1px solid rgba(255,255,255,.14)!important}
  .nx-photo-editor.nx-photo-v14 .nx-photo-crop-actions button:last-child{background:linear-gradient(135deg,#a45cff,#7134e9)!important;color:#fff!important}

  /* Quick Tools: compact vertical density, no giant control blocks. */
  .nx-photo-v14 .nxqt-head{backdrop-filter:none!important}
  .nx-photo-v14 .nxqt-body{padding:9px!important}
  .nx-photo-v14 .nxqt-panel,.nx-photo-v14 .nxqt-result{gap:8px!important}
  .nx-photo-v14 .nxqt-controls{gap:7px!important;padding:10px!important;border-radius:14px!important}
  .nx-photo-v14 .nxqt-field{grid-template-columns:78px minmax(0,1fr) 40px!important;gap:7px!important;min-height:31px!important}
  .nx-photo-v14 .nxqt-field input[type=range]{height:28px!important;touch-action:pan-y!important;transition:none!important}
  .nx-photo-v14 .nxqt-chip{min-height:34px!important;padding-inline:10px!important}
  .nx-photo-v14 .nxqt-canvas-wrap{min-height:200px!important;max-height:44vh!important}
  .nx-photo-v14 .nxqt-canvas-wrap canvas{max-height:44vh!important}
  .nx-photo-v14 .nxqt-compare{backdrop-filter:none!important}

  /* Design Studio keeps the premium structure but avoids costly phone blur. */
  .nx-photo-v14 .nx-canva-v3.nxv13-premium :is(.nxv3-head,.nxv13-pop,.nxv13-status){backdrop-filter:none!important}
  .nx-photo-v14 .nx-canva-v3.nxv13-premium .nxv3-toolbar .nxv3-btn{transition:none!important;touch-action:manipulation!important}

  @media(pointer:coarse){
    .nx-photo-editor.nx-photo-v14 *{scroll-behavior:auto!important}
    .nx-photo-editor.nx-photo-v14 :is(.nx-photo-sheet,.nx-photo-top,.nxqt-head,.nxv3-head){backdrop-filter:none!important}
    .nx-photo-editor.nx-photo-v14 :is(button,.nx-photo-tool,.nx-photo-tab,.nx-photo-pill,.nx-photo-action){transition:none!important}
  }
  @media(max-width:390px){
    .nx-photo-editor.nx-photo-v14 .nx-photo-sheet{left:5px!important;right:5px!important;height:min(52vh,390px)!important;max-height:min(52vh,390px)!important}
    .nx-photo-editor.nx-photo-v14 .nx-photo-field{grid-template-columns:78px minmax(0,1fr) 40px!important}
    .nx-photo-v14 .nxqt-field{grid-template-columns:72px minmax(0,1fr) 38px!important}
  }
  @media(max-height:700px){
    .nx-photo-editor.nx-photo-v14 .nx-photo-sheet{height:min(47vh,320px)!important;max-height:min(47vh,320px)!important}
  }
  `;
  document.head.appendChild(style);

  const sync=()=>{
    const sheet=root.querySelector('.nx-photo-sheet');
    sheet?.setAttribute('aria-hidden',String(!sheet.classList.contains('is-open')));
  };
  const observer=new MutationObserver(sync);
  observer.observe(root,{subtree:true,attributes:true,attributeFilter:['class']});
  sync();

  return()=>{
    observer.disconnect();
    style.remove();
    root.classList.remove('nx-photo-v14','nx-photo-coarse');
    delete root.__nxAiPhotoFlagshipShellV14;
  };
}
