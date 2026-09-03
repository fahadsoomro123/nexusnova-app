// OTA release marker: NexusNova Premium Studio six-tool production publish.
import { renderAiPhotoStudio } from './ai-photo-studio.js';
import { renderAiVideoStudio } from './ai-video-studio.js';
import { renderPdfProStudio } from './pdf-pro-studio.js';
import { renderAiTranscribeStudio } from './ai-transcribe-studio.js';
import { renderAiWritingStudio } from './ai-writing-studio.js';
import { renderDigitalSignStudio } from './digital-sign-studio.js';

export const premiumStudioRenderers = Object.freeze({
  'ai-photo-studio': renderAiPhotoStudio,
  'ai-video-studio': renderAiVideoStudio,
  'pdf-pro': renderPdfProStudio,
  'ai-transcribe': renderAiTranscribeStudio,
  'ai-writing-pro': renderAiWritingStudio,
  'digital-sign': renderDigitalSignStudio
});
