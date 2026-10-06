export function installAiPhotoContextualContrastV1(root){
  if(!root||root.__nxAiPhotoContextualContrastV1)return()=>{};
  root.__nxAiPhotoContextualContrastV1=true;
  const style=document.createElement('style');
  style.id='nx-ai-photo-contextual-contrast-v1';
  style.textContent=`
  /* Normal Photo Editor is intentionally light: dark text on light surfaces. */
  .nx-photo-editor .nx-photo-frame{
    color-scheme:light dark!important;
    color:var(--p-t)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor .nx-photo-frame :is(button,[role="button"],input,textarea,select){
    color:var(--p-t)!important;
    -webkit-text-fill-color:currentColor!important;
    caret-color:var(--p-t)!important;
  }
  .nx-photo-editor .nx-photo-frame :is(button,[role="button"]) :is(span,strong,b,small,em,i){
    color:inherit!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor .nx-photo-frame :is(select,select option,select optgroup){
    color:var(--p-t)!important;
    background-color:var(--p-s2)!important;
    -webkit-text-fill-color:var(--p-t)!important;
  }
  .nx-photo-editor .nx-photo-frame :is(input,textarea)::placeholder{
    color:var(--p-m)!important;
    -webkit-text-fill-color:var(--p-m)!important;
    opacity:1!important;
  }
  .nx-photo-editor .nx-photo-frame .nx-photo-tool,
  .nx-photo-editor .nx-photo-frame :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-close){
    color:var(--p-m)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor .nx-photo-frame :is(.nx-photo-tool,.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio).is-active{
    color:var(--p-purple)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor .nx-photo-frame :is(.nx-photo-project span,.nx-photo-field output,.nx-photo-status,.nx-photo-ai-action small,.nx-photo-metrics span,.nx-photo-empty p){
    color:var(--p-m)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor .nx-photo-frame :is(.nx-photo-export-top,.nx-photo-primary,.nx-photo-crop-actions button:last-child){
    color:#fff!important;
    -webkit-text-fill-color:#fff!important;
  }
  .nx-photo-editor .nx-photo-frame .nx-photo-crop-actions button:not(:last-child){
    color:#222!important;
    -webkit-text-fill-color:#222!important;
  }

  /* Edit / Adjust / Filters are focused editing surfaces. Their dark sheet is
     driven by the active panel itself, not by the transient slider-focus class. */
  .nx-photo-editor .nx-photo-sheet.nx-context-dark-sheet{
    color-scheme:dark!important;
    color:#f7f8ff!important;
    background:rgba(24,24,30,.96)!important;
    border-color:rgba(255,255,255,.16)!important;
    box-shadow:0 -12px 36px rgba(0,0,0,.24)!important;
    backdrop-filter:blur(14px) saturate(1.12)!important;
    --nx-photo-focus-text:#f7f8ff;
    --nx-photo-focus-muted:#c6ccda;
  }
  .nx-photo-editor .nx-photo-sheet.nx-context-dark-sheet :is(button,[role="button"],input,textarea,select,label,.nx-photo-field span,.nx-photo-sheet-head strong){
    color:#f7f8ff!important;
    -webkit-text-fill-color:#f7f8ff!important;
    caret-color:#fff!important;
  }
  .nx-photo-editor .nx-photo-sheet.nx-context-dark-sheet :is(.nx-photo-field output,.nx-photo-status,.nx-photo-ai-action small){
    color:#c6ccda!important;
    -webkit-text-fill-color:#c6ccda!important;
  }
  .nx-photo-editor .nx-photo-sheet.nx-context-dark-sheet :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio){
    border-color:rgba(255,255,255,.14)!important;
    background:rgba(38,39,48,.94)!important;
  }
  .nx-photo-editor .nx-photo-sheet.nx-context-dark-sheet :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio).is-active{
    color:#e1c5ff!important;
    -webkit-text-fill-color:#e1c5ff!important;
    border-color:#9d58ef!important;
    background:rgba(98,50,145,.46)!important;
  }
  `;
  document.head.appendChild(style);

  const sheet=root.querySelector('.nx-photo-sheet');
  const syncSheet=()=>{
    if(!sheet)return;
    const active=sheet.querySelector('[data-photo-sheet-panel].is-active')?.dataset.photoSheetPanel||'';
    sheet.classList.toggle('nx-context-dark-sheet',active==='edit'||active==='adjust'||active==='looks');
  };
  const observer=new MutationObserver(syncSheet);
  if(sheet)observer.observe(sheet,{subtree:true,attributes:true,attributeFilter:['class']});
  syncSheet();

  return()=>{
    observer.disconnect();
    sheet?.classList.remove('nx-context-dark-sheet');
    style.remove();
    delete root.__nxAiPhotoContextualContrastV1;
  };
}
