// NOVA 5.7 ACRM — optional Firebase registry bridge.
// The foreground chain never depends on this bridge: local routing continues if
// backend planning/learning is unavailable. Raw prompts are sent only to the
// authenticated planning callable for immediate classification and are not stored
// by the backend module; outcome reporting contains no prompt text.

import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import {
  firebaseApp,
  requireFirebaseUser,
  requireFreshAppCheck
} from './core/firebase-backend.js';

const functions = getFunctions(firebaseApp);
const planCallable = httpsCallable(functions, 'novaAtomicPlan');
const outcomeCallable = httpsCallable(functions, 'novaRecordBrainOutcome');
let backendCoolingUntil = 0;

function bounded(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`ACRM backend bridge exceeded ${timeoutMs}ms.`)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function coolDown(error) {
  const message = String(error?.message || error || '').toLowerCase();
  backendCoolingUntil = Date.now() + (/permission|app.?check|auth/.test(message) ? 60_000 : 15_000);
}

export async function getAtomicBackendPlan(prompt) {
  if (Date.now() < backendCoolingUntil) return null;
  try {
    await requireFirebaseUser();
    await requireFreshAppCheck();
    const result = await bounded(planCallable({ prompt: String(prompt || '').slice(0, 12000) }), 1150);
    const data = result?.data || null;
    if (!data || !Array.isArray(data.candidates)) return null;
    return data;
  } catch (error) {
    coolDown(error);
    console.warn('[NOVA ACRM] backend plan unavailable; local chain continues.', error);
    return null;
  }
}

export function reportAtomicOutcome(payload = {}) {
  if (Date.now() < backendCoolingUntil) return;
  const provider = String(payload.provider || '').trim();
  const modelId = String(payload.modelId || payload.model || '').trim();
  if (!provider || !modelId || provider === 'NOVA Local') return;
  const body = {
    source: String(payload.source || provider).slice(0, 80),
    provider: provider.slice(0, 80),
    modelId: modelId.slice(0, 240),
    capability: String(payload.capability || 'general').slice(0, 30),
    outcome: String(payload.outcome || 'success').slice(0, 30),
    latencyMs: Math.max(0, Math.min(120000, Number(payload.latencyMs || 0))),
    quality: Math.max(0, Math.min(1, Number(payload.quality ?? 0.8)))
  };

  // Deliberately fire-and-forget so learning can never delay a user answer.
  Promise.resolve().then(async () => {
    try {
      await requireFirebaseUser();
      await requireFreshAppCheck();
      await bounded(outcomeCallable(body), 1500);
    } catch (error) {
      coolDown(error);
      console.warn('[NOVA ACRM] learning feedback unavailable; local memory remains active.', error);
    }
  });
}
