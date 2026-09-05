import { renderAiPhotoStudio as renderFlagshipAiPhotoStudio } from './ai-photo-studio-flagship.js';
import { installSliderOnlyFocus } from './ai-photo-focus-interaction.js';
import { installAiPhotoCanvaWorkspaceV3 } from './ai-photo-canva-workspace-v3.js';
import { installAiPhotoDesignEditorControls } from './ai-photo-design-editor-controls.js';
import { installPuterImageGenerator } from './ai-photo-puter-generator.js';
import { installAiPhotoStudioHome } from './ai-photo-studio-home.js';
import { installAiPhotoPhoneFeedbackV1 } from './ai-photo-phone-feedback-v1.js';
import { installAiPhotoLockedVisualV1 } from './ai-photo-locked-visual-v1.js';
import { installAiPhotoLockedReferenceAssetsV1 } from './ai-photo-locked-reference-assets-v1.js';
import { installAiPhotoQuickTools } from './ai-photo-quick-tools.js';
import { installAiPhotoEnhanceFlagshipV12 } from './ai-photo-enhance-flagship-v12.js';
import { installAiPhotoFlagshipToolUpgrades } from './ai-photo-flagship-tool-upgrades.js';
import { installAiPhotoGeneratorPromptAssistV1 } from './ai-photo-generator-prompt-assist-v1.js';
import { installAiPhotoNavigation } from './ai-photo-navigation.js';

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
  const designEditorControlsCleanup=installAiPhotoDesignEditorControls(root);
  const puterCleanup=installPuterImageGenerator(root);
  const homeCleanup=installAiPhotoStudioHome(root);
  const phoneFeedbackCleanup=installAiPhotoPhoneFeedbackV1(root);
  const lockedVisualCleanup=installAiPhotoLockedVisualV1(root);
  const quickToolsCleanup=installAiPhotoQuickTools(root);
  const enhanceFlagshipCleanup=installAiPhotoEnhanceFlagshipV12(root);
  const flagshipToolUpgradesCleanup=installAiPhotoFlagshipToolUpgrades(root);
  const generatorPromptAssistCleanup=installAiPhotoGeneratorPromptAssistV1(root);
  const lockedReferenceCleanup=installAiPhotoLockedReferenceAssetsV1(root);
  const navigationCleanup=installAiPhotoNavigation(root);
  root.__cleanup=()=>{
    navigationCleanup?.();
    lockedReferenceCleanup?.();
    generatorPromptAssistCleanup?.();
    flagshipToolUpgradesCleanup?.();
    enhanceFlagshipCleanup?.();
    quickToolsCleanup?.();
    lockedVisualCleanup?.();
    phoneFeedbackCleanup?.();
    homeCleanup?.();
    puterCleanup?.();
    designEditorControlsCleanup?.();
    workspaceCleanup?.();
    focusCleanup?.();
    previousCleanup?.();
  };
  root.dataset.aiPhotoFlagship='flagship-repair-v12';
  return root;
}