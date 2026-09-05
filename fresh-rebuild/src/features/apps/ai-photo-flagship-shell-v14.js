const coarsePointer=()=>globalThis.matchMedia?.('(pointer: coarse)')?.matches===true;

export function installAiPhotoFlagshipShellV14(root){
  if(!root||root.__nxAiPhotoFlagshipShellV14)return()=>{};
  root.__nxAiPhotoFlagshipShellV14=true;
  root.classList.add('nx-photo-v14');
  if(coarsePointer())root.classList.add('nx-photo-coarse');

  const style=document.createElement('style');
  style.id='nx-ai-photo-flagship-shell-v14';
  style.textContent=`
  /* Flagship v14: the Photo Editor uses dark professional chrome around the
     image canvas. This intentionally removes the white-on-white failure mode. */
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-frame{
    --p-bg:#080b12!important;
    --p-s:#0f141d!important;
    --p-s2:#151b26!important;
    --p-t:#f7f9ff!important;
    --p-m:#aab4c5!important;
    --p-l:rgba(255,255,255,.115)!important;
    --p-purple:#a45cff!important;
    color-scheme:dark!important;
    color:#f7f9ff!important;
    background:#080b12!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-frame :is(
    button,[role="button"],label,span,strong,b,small,em,i,input,textarea,select,option,optgroup,output
  ){
    -webkit-text-fill-color:currentColor!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-top{
    border-bottom-color:rgba(255,255,255,.10)!important;
    background:linear-gradient(180deg,#121722,#0e131c)!important;
    color:#f7f9ff!important;
    box-shadow:0 7px 24px rgba(0,0,0,.24)!important;
    backdrop-filter:none!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-top :is(button,span,strong){color:#f7f9ff!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-add,.nx-photo-mini){
    border:1px solid rgba(255,255,255,.10)!important;
    background:#171d28!important;
    color:#edf1fb!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-export-top{
    background:linear-gradient(135deg,#a85cff,#7134e9)!important;
    color:#fff!important;
    box-shadow:0 7px 18px rgba(126,59,224,.26)!important;
  }

  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-work{
    background-color:#cfd2d8!important;
    background-image:linear-gradient(45deg,rgba(70,74,84,.09) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(70,74,84,.09) 75%),linear-gradient(45deg,transparent 75%,rgba(70,74,84,.09) 75%),linear-gradient(45deg,rgba(70,74,84,.09) 25%,transparent 25%)!important;
    background-size:22px 22px!important;
    background-position:0 0,0 0,11px -11px,-11px 11px!important;
    contain:layout paint style!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-work>canvas[data-photo-canvas]{
    max-width:94%!important;max-height:94%!important;
    box-shadow:0 18px 52px rgba(5,7,12,.35),0 0 0 1px rgba(0,0,0,.08)!important;
    will-change:auto!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14.nx-photo-control-live .nx-photo-work>canvas[data-photo-canvas]{will-change:transform!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-empty{
    border-color:rgba(130,91,190,.34)!important;
    background:rgba(248,249,252,.97)!important;
    color:#17191f!important;
    box-shadow:0 18px 48px rgba(12,14,20,.18)!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-empty :is(strong){color:#17191f!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-empty p{color:#626875!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-before,.nx-photo-zoomlabel){
    border:1px solid rgba(255,255,255,.12)!important;
    background:rgba(13,17,25,.92)!important;
    color:#fff!important;
    backdrop-filter:none!important;
  }

  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-tools{
    border-top-color:rgba(255,255,255,.10)!important;
    background:linear-gradient(180deg,#111720,#0c1118)!important;
    box-shadow:0 -8px 24px rgba(0,0,0,.24)!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-tool{
    color:#aab4c5!important;
    border-radius:10px!important;
    transition:color .12s ease,background .12s ease!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-tool :is(b,span){color:inherit!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-tool.is-active{
    color:#f6edff!important;
    background:linear-gradient(180deg,rgba(164,92,255,.25),rgba(116,52,224,.12))!important;
  }

  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-sheet{
    left:8px!important;right:8px!important;bottom:66px!important;
    height:min(54vh,430px)!important;max-height:min(54vh,430px)!important;
    border-color:rgba(255,255,255,.12)!important;
    background:linear-gradient(180deg,#171d28,#10151e)!important;
    color:#f7f9ff!important;
    box-shadow:0 -16px 46px rgba(0,0,0,.42)!important;
    backdrop-filter:none!important;
    contain:layout paint style!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-sheet-head{
    border-bottom-color:rgba(255,255,255,.09)!important;background:#151b25!important;color:#f7f9ff!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-sheet-head :is(strong,button){color:#f7f9ff!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-panel{
    height:calc(100% - 42px)!important;padding:10px 11px 14px!important;color:#f7f9ff!important;scrollbar-color:#5d4a7d transparent!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-panel.is-active{display:block!important;visibility:visible!important;opacity:1!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-tabs,.nx-photo-pills){gap:6px!important;padding:1px 0 9px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio,.nx-photo-preset,.nx-photo-ai-action){
    border-color:rgba(255,255,255,.11)!important;
    background:#1a202c!important;
    color:#dce2ee!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio,.nx-photo-preset,.nx-photo-ai-action).is-active{
    border-color:#a45cff!important;background:rgba(119,58,209,.24)!important;color:#f1e3ff!important;box-shadow:inset 0 0 0 1px rgba(164,92,255,.14)!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-field{
    grid-template-columns:86px minmax(0,1fr) 46px!important;min-height:35px!important;gap:8px!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-field span{color:#d9dfeb!important;font-size:10.5px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-field output{color:#bfa4e8!important;font-size:10px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 input[type=range]{
    height:30px!important;accent-color:#a45cff!important;touch-action:pan-y!important;transition:none!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 input[type=range]::-webkit-slider-thumb{
    width:20px!important;height:20px!important;box-shadow:0 0 0 4px rgba(164,92,255,.16)!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(textarea,select,input[type=text]){
    border-color:rgba(255,255,255,.12)!important;background:#0e141e!important;color:#f7f9ff!important;caret-color:#fff!important;
  }
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(select option,select optgroup){background:#0e141e!important;color:#f7f9ff!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(textarea,input)::placeholder{color:#7f8a9d!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-status,.nx-photo-ai-action small,.nx-photo-metrics span){color:#9da8ba!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-hist,.nx-photo-curve){border-color:rgba(255,255,255,.11)!important;background:#0d131c!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-metrics div{border-color:rgba(255,255,255,.10)!important;background:#171d28!important;color:#eef2fb!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-crop-actions button:not(:last-child){background:#151b25!important;color:#fff!important;border:1px solid rgba(255,255,255,.14)!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-crop-actions button:last-child{background:linear-gradient(135deg,#a45cff,#7134e9)!important;color:#fff!important}

  /* Quick tools: tighter professional density without hiding controls. */
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-head{backdrop-filter:none!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-body{padding:9px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-panel{gap:8px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-result{gap:8px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-controls{gap:7px!important;padding:10px!important;border-radius:14px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-field{grid-template-columns:78px minmax(0,1fr) 40px!important;gap:7px!important;min-height:31px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-field input[type=range]{height:28px!important;touch-action:pan-y!important;transition:none!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-chip{min-height:34px!important;padding-inline:10px!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-canvas-wrap{min-height:220px!important;max-height:48vh!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-canvas-wrap canvas{max-height:48vh!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-compare{backdrop-filter:none!important}

  /* Design Studio: keep the premium chrome but remove expensive blur on phones. */
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nx-canva-v3.nxv13-premium :is(.nxv3-head,.nxv13-pop,.nxv13-status){backdrop-filter:none!important}
  body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nx-canva-v3.nxv13-premium .nxv3-toolbar .nxv3-btn{transition:none!important;touch-action:manipulation!important}

  @media(pointer:coarse){
    body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 *{scroll-behavior:auto!important}
    body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(.nx-photo-sheet,.nx-photo-top,.nxqt-head,.nxv3-head){backdrop-filter:none!important}
    body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 :is(button,.nx-photo-tool,.nx-photo-tab,.nx-photo-pill,.nx-photo-action){transition:none!important}
  }
  @media(max-width:390px){
    body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-sheet{left:5px!important;right:5px!important;height:min(52vh,390px)!important;max-height:min(52vh,390px)!important}
    body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-field{grid-template-columns:78px minmax(0,1fr) 40px!important}
    body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-v14 .nxqt-field{grid-template-columns:72px minmax(0,1fr) 38px!important}
  }
  @media(max-height:700px){
    body.nx-ai-photo-route-active .nx-ai-photo-route-screen .nx-photo-editor.nx-photo-v14 .nx-photo-sheet{height:min(47vh,320px)!important;max-height:min(47vh,320px)!important}
  }
  `;
  document.head.appendChild(style);

  const observer=new MutationObserver(()=>{
    const sheet=root.querySelector('.nx-photo-sheet');
    if(sheet?.classList.contains('is-open'))sheet.setAttribute('aria-hidden','false');
    else sheet?.setAttribute('aria-hidden','true');
  });
  observer.observe(root,{subtree:true,attributes:true,attributeFilter:['class']});

  return()=>{
    observer.disconnect();
    style.remove();
    root.classList.remove('nx-photo-v14','nx-photo-coarse');
    delete root.__nxAiPhotoFlagshipShellV14;
  };
}
