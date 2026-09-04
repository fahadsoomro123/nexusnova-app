import { renderAiPhotoStudio as renderFlagshipAiPhotoStudio } from './ai-photo-studio-flagship.js';
import { installSliderOnlyFocus } from './ai-photo-focus-interaction.js';
import { installAiPhotoCanvaWorkspaceV3 } from './ai-photo-canva-workspace-v3.js';
import { installPuterImageGenerator } from './ai-photo-puter-generator.js';
import { installAiPhotoStudioHome } from './ai-photo-studio-home.js';

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
  const workspaceCleanup=installAiPhotoCanvaWorkspaceV3(root);
  const puterCleanup=installPuterImageGenerator(root);
  const homeCleanup=installAiPhotoStudioHome(root);
  root.__cleanup=()=>{
    homeCleanup?.();
    puterCleanup?.();
    workspaceCleanup?.();
    focusCleanup?.();
    previousCleanup?.();
  };
  root.dataset.aiPhotoFlagship='review-v5-premium-home';
  return root;
}
