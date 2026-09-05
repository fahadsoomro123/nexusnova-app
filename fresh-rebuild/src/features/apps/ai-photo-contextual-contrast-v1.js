export function installAiPhotoContextualContrastV1(root){
  if(!root||root.__nxAiPhotoContextualContrastV1)return()=>{};
  root.__nxAiPhotoContextualContrastV1=true;
  const style=document.createElement('style');
  style.id='nx-ai-photo-contextual-contrast-v1';
  style.textContent=`
  /* Contextual contrast: the Photo Editor is a light surface by default.
     Do not let the dark Studio readability firewall force white text onto it. */
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame{
    color-scheme:light dark!important;
    color:var(--p-t)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(button,[role="button"],input,textarea,select){
    color:var(--p-t)!important;
    -webkit-text-fill-color:currentColor!important;
    caret-color:var(--p-t)!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(button,[role="button"]) :is(span,strong,b,small,em,i){
    color:inherit!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(select,select option,select optgroup){
    color:var(--p-t)!important;
    background-color:var(--p-s2)!important;
    -webkit-text-fill-color:var(--p-t)!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(input,textarea)::placeholder{
    color:var(--p-m)!important;
    -webkit-text-fill-color:var(--p-m)!important;
    opacity:1!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame .nx-photo-tool,
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-close){
    color:var(--p-m)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(.nx-photo-tool,.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio).is-active{
    color:var(--p-purple)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(.nx-photo-project span,.nx-photo-field output,.nx-photo-status,.nx-photo-ai-action small,.nx-photo-metrics span,.nx-photo-empty p){
    color:var(--p-m)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame :is(.nx-photo-export-top,.nx-photo-primary,.nx-photo-crop-actions button:last-child){
    color:#fff!important;
    -webkit-text-fill-color:#fff!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual) .nx-photo-frame .nx-photo-crop-actions button:not(:last-child){
    color:#222!important;
    -webkit-text-fill-color:#222!important;
  }

  /* Edit/Adjust/Looks intentionally switch the sheet to a dark focus surface.
     In that state only the sheet becomes light-on-dark; the normal toolbar remains contextual. */
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual).nx-photo-focus-editing .nx-photo-sheet{
    color:#f7f8ff!important;
    --nx-photo-focus-text:#f7f8ff;
    --nx-photo-focus-muted:#c6ccda;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual).nx-photo-focus-editing .nx-photo-sheet :is(button,[role="button"],input,textarea,select,label,.nx-photo-field span,.nx-photo-sheet-head strong){
    color:var(--nx-photo-focus-text)!important;
    -webkit-text-fill-color:currentColor!important;
    caret-color:#fff!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual).nx-photo-focus-editing .nx-photo-sheet :is(.nx-photo-field output,.nx-photo-status,.nx-photo-ai-action small){
    color:var(--nx-photo-focus-muted)!important;
    -webkit-text-fill-color:currentColor!important;
  }
  .nx-photo-editor:is(.nxps-premium-studio,.nxps-locked-visual).nx-photo-focus-editing .nx-photo-sheet :is(.nx-photo-tab,.nx-photo-pill,.nx-photo-action,.nx-photo-ratio).is-active{
    color:#d9b7ff!important;
    -webkit-text-fill-color:currentColor!important;
  }
  `;
  document.head.appendChild(style);
  return()=>{style.remove();delete root.__nxAiPhotoContextualContrastV1};
}
