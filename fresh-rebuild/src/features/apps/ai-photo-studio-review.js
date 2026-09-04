import { renderAiPhotoStudio as renderFlagshipAiPhotoStudio } from './ai-photo-studio-flagship.js';
import { installSliderOnlyFocus } from './ai-photo-focus-interaction.js';
import { installAiPhotoCanvaWorkspace } from './ai-photo-canva-workspace.js';

export function renderAiPhotoStudio(){
  const root=renderFlagshipAiPhotoStudio();
  const dedicated=[
    ['maskSize',13],
    ['maskFeather',45],
    ['maskTolerance',24]
  ];
  for(const [key,value] of dedicated){
    const input=root.querySelector(`[data-photo-range="${key}"]`);
    if(!input) continue;
    input.removeAttribute('data-photo-range');
    input.setAttribute(`data-${key.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}`,'');
    input.value=String(value);
    if(input.nextElementSibling) input.nextElementSibling.textContent=String(value);
  }
  const previousCleanup=root.__cleanup;
  const focusCleanup=installSliderOnlyFocus(root);
  const workspaceCleanup=installAiPhotoCanvaWorkspace(root);
  root.__cleanup=()=>{
    workspaceCleanup?.();
    focusCleanup?.();
    previousCleanup?.();
  };
  root.dataset.aiPhotoFlagship='review-v2-canva-class';
  return root;
}
