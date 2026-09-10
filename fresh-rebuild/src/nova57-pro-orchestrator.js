// NOVA 5.7 — direct Firebase Gemini compatibility layer.
// The ARIM/keyless/200K routing mesh is intentionally not used by the active NOVA chat.
// Keep this module path so the existing UI can stay unchanged while requests go straight
// to the same Firebase Gemini provider used before the ARIM wiring.

import {
  GoogleAIBackend as FirebaseGoogleAIBackend,
  getAI as firebaseGetAI,
  getGenerativeModel as firebaseGetGenerativeModel
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js?nova-direct-gemini=1';

const DIRECT_GEMINI_MODEL = 'gemini-3.6-flash';

export const GoogleAIBackend = FirebaseGoogleAIBackend;

export function getAI(firebaseApp, config = {}) {
  return firebaseGetAI(firebaseApp, {
    ...config,
    backend: new FirebaseGoogleAIBackend()
  });
}

export function getGenerativeModel(ai, options = {}) {
  const directOptions = {
    ...options,
    model: DIRECT_GEMINI_MODEL
  };
  const model = firebaseGetGenerativeModel(ai, directOptions);
  globalThis.__NOVA_BRAIN_LAST__ = {
    provider: 'Firebase AI',
    model: DIRECT_GEMINI_MODEL,
    profile: 'direct-gemini',
    arim: false,
    brain200k: false,
    at: new Date().toISOString()
  };
  return model;
}

globalThis.__NOVA_DIRECT_GEMINI__ = {
  active: true,
  model: DIRECT_GEMINI_MODEL,
  arim: false,
  brain200k: false,
  startedAt: new Date().toISOString()
};
