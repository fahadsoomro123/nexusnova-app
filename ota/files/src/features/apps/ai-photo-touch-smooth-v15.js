export function installAiPhotoTouchSmoothV15(root){
  if(!root||root.__nxAiPhotoTouchSmoothV15)return()=>{};
  root.__nxAiPhotoTouchSmoothV15=true;
  const style=document.createElement('style');
  style.id='nx-ai-photo-touch-smooth-v15';
  style.textContent=`
    /* The legacy focus mode faded most controls and applied multiple live blur
       layers while a range control was touched. On low/mid Android phones that
       made labels look missing and forced expensive compositing during every
       slider gesture. v15 keeps context visible and uses a single cheap active
       control highlight instead. */
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-top{
      opacity:1!important;filter:none!important;transition:none!important;
    }
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-work{
      background-color:#d2d5db!important;
      background-image:linear-gradient(45deg,rgba(70,74,84,.09) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(70,74,84,.09) 75%),linear-gradient(45deg,transparent 75%,rgba(70,74,84,.09) 75%),linear-gradient(45deg,rgba(70,74,84,.09) 25%,transparent 25%)!important;
      background-size:22px 22px!important;background-position:0 0,0 0,11px -11px,-11px 11px!important;
    }
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-work>canvas[data-photo-canvas]{max-width:94%!important;max-height:94%!important;box-shadow:0 18px 52px rgba(5,7,12,.34),0 0 0 1px rgba(0,0,0,.08)!important}
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-tools{
      background:linear-gradient(180deg,#111821,#0c1118)!important;
      border-color:rgba(255,255,255,.10)!important;
      backdrop-filter:none!important;
    }
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-tool,
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-tool.is-active{
      opacity:1!important;transition:none!important;
    }
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-sheet{
      left:8px!important;right:8px!important;bottom:66px!important;
      max-height:min(54vh,430px)!important;
      background:linear-gradient(180deg,#181f2b,#10161f)!important;
      border-color:rgba(255,255,255,.12)!important;
      box-shadow:0 -16px 46px rgba(0,0,0,.44)!important;
      backdrop-filter:none!important;
    }
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-sheet-head{
      opacity:1!important;pointer-events:auto!important;background:#151c27!important;
    }
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing .nx-photo-panel{background:transparent!important}
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing :is(.nx-photo-field,.nx-photo-action,.nx-photo-pill,.nx-photo-ratio,.nx-photo-preset){backdrop-filter:none!important}
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing.nx-photo-control-live :is(.nx-photo-sheet-head,.nx-photo-tabs,.nx-photo-status){opacity:1!important;pointer-events:auto!important}
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing.nx-photo-control-live :is(.nx-photo-field,.nx-photo-action,.nx-photo-pill,.nx-photo-ratio,.nx-photo-preset){opacity:1!important;pointer-events:auto!important}
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing.nx-photo-control-live .is-live-control{
      opacity:1!important;pointer-events:auto!important;
      background:#1d2634!important;
      border:1px solid rgba(164,92,255,.55)!important;
      border-radius:10px!important;
      box-shadow:inset 0 0 0 1px rgba(164,92,255,.10)!important;
    }
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing.nx-photo-control-live .nx-photo-field.is-live-control{padding:3px 7px!important}
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing :is(.nx-photo-before,.nx-photo-zoomlabel),
    .nx-photo-editor.nx-photo-v14.nx-photo-focus-editing.nx-photo-control-live :is(.nx-photo-before,.nx-photo-zoomlabel){opacity:1!important}
    .nx-photo-editor.nx-photo-v14 input[type=range]{contain:layout style!important;will-change:auto!important}
    .nx-photo-editor.nx-photo-v14.nx-photo-control-live input[type=range]{will-change:contents!important}
    @media(pointer:coarse){
      .nx-photo-editor.nx-photo-v14 :is(.nx-photo-top,.nx-photo-tools,.nx-photo-sheet,.nx-photo-field,.nx-photo-action,.nx-photo-pill,.nx-photo-ratio,.nx-photo-preset){transition:none!important;filter:none!important}
    }
  `;
  document.head.appendChild(style);
  return()=>{style.remove();delete root.__nxAiPhotoTouchSmoothV15};
}
