import { renderAiPhotoStudio as renderFlagshipAiPhotoStudio } from './ai-photo-adjust-editor.js';
import { installSliderOnlyFocus } from './ai-photo-slider-focus-global-v25.js';
import { installAiPhotoCanvaWorkspaceV3 } from './ai-photo-canva-workspace-v3.js';
import { installAiPhotoDesignEditorControls } from './ai-photo-design-editor-controls.js';
import { installAiPhotoDesignDelightV13 } from './ai-photo-design-delight-v13.js';
import { installAiPhotoDesignFlagshipV22 } from './ai-photo-design-flagship-v22.js';
import { installAiPhotoProjectsExportV24 } from './ai-photo-projects-export-v24.js';
import { installPuterImageGenerator } from './ai-photo-puter-generator.js';
import { installAiPhotoGenerativeEditV19 } from './ai-photo-generative-edit-v19.js';
import { installAiPhotoStudioHome } from './ai-photo-studio-home.js';
import { installAiPhotoPhoneFeedbackV1 } from './ai-photo-phone-feedback-v1.js';
import { installAiPhotoLockedVisualV1 } from './ai-photo-locked-visual-v1.js';
import { installAiPhotoLockedReferenceAssetsV1 } from './ai-photo-locked-reference-assets-v1.js';
import { installAiPhotoQuickTools } from './ai-photo-quick-tools.js';
import { installAiPhotoRemoveBgMlV16 } from './ai-photo-remove-bg-ml-v16.js';
import { installAiPhotoProductStudioV21 } from './ai-photo-product-studio-v21.js';
import { installAiPhotoBatchV23 } from './ai-photo-batch-v23.js';
import { installAiPhotoDownloadSmoothV1 } from './ai-photo-download-smooth-v1.js';
import { installAiPhotoEnhanceFlagshipV12 } from './ai-photo-enhance-flagship-v12.js';
import { installAiPhotoFlagshipToolUpgrades } from './ai-photo-flagship-tool-upgrades.js';
import { installAiPhotoGeneratorPromptAssistV1 } from './ai-photo-generator-prompt-assist-v1.js';
import { installAiPhotoContextualContrastV1 } from './ai-photo-contextual-contrast-v1.js';
import { installAiPhotoFlagshipShellV14 } from './ai-photo-flagship-shell-v14.js';
import { installAiPhotoTouchSmoothV15 } from './ai-photo-touch-smooth-v15.js';
import { installAiPhotoRetouchRepairV20 } from './ai-photo-retouch-repair-v20.js';
import { installAiPhotoNavigation } from './ai-photo-navigation.js';
import { hydrateAiPhotoTemplatePhotos } from './ai-photo-template-photo-hydrator-v1.js';
import { installAiPhotoMobileWorkspaceCleanV1 } from './ai-photo-mobile-workspace-clean-v1.js';

export function renderAiPhotoStudio(){
  hydrateAiPhotoTemplatePhotos();
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
  const designDelightCleanup=installAiPhotoDesignDelightV13(root);
  const designFlagshipCleanup=installAiPhotoDesignFlagshipV22(root);
  const projectsExportCleanup=installAiPhotoProjectsExportV24(root);
  const puterCleanup=installPuterImageGenerator(root);
  const homeCleanup=installAiPhotoStudioHome(root);
  const phoneFeedbackCleanup=installAiPhotoPhoneFeedbackV1(root);
  const mobileWorkspaceCleanup=installAiPhotoMobileWorkspaceCleanV1(root);
  const generativeEditCleanup=installAiPhotoGenerativeEditV19(root);
  const lockedVisualCleanup=installAiPhotoLockedVisualV1(root);
  const quickToolsCleanup=installAiPhotoQuickTools(root);
  const removeBgMlCleanup=installAiPhotoRemoveBgMlV16(root);
  const productStudioCleanup=installAiPhotoProductStudioV21(root);
  const downloadSmoothCleanup=installAiPhotoDownloadSmoothV1(root);
  const enhanceFlagshipCleanup=installAiPhotoEnhanceFlagshipV12(root);
  const flagshipToolUpgradesCleanup=installAiPhotoFlagshipToolUpgrades(root);
  const generatorPromptAssistCleanup=installAiPhotoGeneratorPromptAssistV1(root);
  const contextualContrastCleanup=installAiPhotoContextualContrastV1(root);
  const flagshipShellCleanup=installAiPhotoFlagshipShellV14(root);
  const touchSmoothCleanup=installAiPhotoTouchSmoothV15(root);
  const retouchRepairCleanup=installAiPhotoRetouchRepairV20(root);
  const lockedReferenceCleanup=installAiPhotoLockedReferenceAssetsV1(root);
  const batchCleanup=installAiPhotoBatchV23(root);
  const navigationCleanup=installAiPhotoNavigation(root);
  root.__cleanup=()=>{
    navigationCleanup?.();
    batchCleanup?.();
    lockedReferenceCleanup?.();
    retouchRepairCleanup?.();
    touchSmoothCleanup?.();
    flagshipShellCleanup?.();
    contextualContrastCleanup?.();
    generatorPromptAssistCleanup?.();
    flagshipToolUpgradesCleanup?.();
    enhanceFlagshipCleanup?.();
    downloadSmoothCleanup?.();
    productStudioCleanup?.();
    removeBgMlCleanup?.();
    quickToolsCleanup?.();
    lockedVisualCleanup?.();
    generativeEditCleanup?.();
    mobileWorkspaceCleanup?.();
    phoneFeedbackCleanup?.();
    homeCleanup?.();
    puterCleanup?.();
    projectsExportCleanup?.();
    designFlagshipCleanup?.();
    designDelightCleanup?.();
    designEditorControlsCleanup?.();
    workspaceCleanup?.();
    focusCleanup?.();
    previousCleanup?.();
  };
  root.dataset.aiPhotoFlagship='flagship-repair-v16';
  return root;
}