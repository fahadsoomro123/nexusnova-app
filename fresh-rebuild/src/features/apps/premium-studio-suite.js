// OTA release marker: NexusNova Premium Studio six-tool production publish.
import { renderAiPhotoStudio } from './ai-photo-studio-review.js';
import { renderPdfProStudio } from './pdf-pro-studio.js';
import { renderAiTranscribeStudio } from './ai-transcribe-studio.js';
import { renderAiWritingStudio } from './ai-writing-studio.js';
import { renderDigitalSignStudio } from './digital-sign-studio.js';

function renderNovaCut() {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.dataset.novacut = 'hollow';
  return root;
}

export const premiumStudioRenderers = Object.freeze({
  'ai-photo-studio': renderAiPhotoStudio,
  'ai-video-studio': renderNovaCut,
  'pdf-pro': renderPdfProStudio,
  'ai-transcribe': renderAiTranscribeStudio,
  'ai-writing-pro': renderAiWritingStudio,
  'digital-sign': renderDigitalSignStudio
});
