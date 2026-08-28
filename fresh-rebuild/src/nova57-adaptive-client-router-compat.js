// NOVA 5.7 Sol — adaptive client gateway.
// This wrapper activates the private server-side adaptive router only when it
// has been positively health-checked. If the callable is absent, slow or
// unavailable, foreground generation immediately stays on the existing
// runtime-recovery router. No user request waits for background discovery.

import {
  GoogleAIBackend as BaseGoogleAIBackend,
  getAI as baseGetAI,
  getGenerativeModel as baseGetGenerativeModel
} from './nova57-runtime-recovery-router-compat.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';

const PROBE_SOFT_WAIT_MS = 260;
const PROBE_HARD_TIMEOUT_MS = 2_500;
const CALL_TIMEOUT_MS = 18_000;
const UNAVAILABLE_TTL_MS = 5 * 60_000;
const AVAILABLE_TTL_MS = 60_000;
const stateByApp = new WeakMap();

function withTimeout(promise, ms, label) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
    })
  ]);
}

function latestUserRequest(prompt) {
  const text = String(prompt || '');
  const marker = '\nUser request:\n';
  const index = text.lastIndexOf(marker);
  return (index >= 0 ? text.slice(index + marker.length) : text).trim();
}

function obviouslySensitive(prompt) {
  const request = latestUserRequest(prompt);
  return /\b(password|passcode|seed phrase|private key|secret key|api key|token|otp|cvv|credit card|debit card|bank account|wallet key)\b/i.test(request)
    || /\b(my|mera|meri)\b.{0,40}\b(email|phone|address|profile|balance|wallet|account)\b/i.test(request);
}

function cleanText(value) {
  let text = String(value || '').trim();
  text = text.replace(/^(?:NOVA\s*5\.7\s*Sol\s*:\s*){1,3}/i, '').trim();
  if (!text) throw new Error('Adaptive gateway returned no usable text.');
  return text;
}

function appState(app) {
  let state = stateByApp.get(app);
  if (!state) {
    state = {
      status: 'unknown',
      checkedAt: 0,
      probe: null,
      statusFn: null,
      generateFn: null
    };
    stateByApp.set(app, state);
  }
  return state;
}

function functionsFor(app, state) {
  const functions = getFunctions(app);
  if (!state.statusFn) {
    state.statusFn = httpsCallable(functions, 'getNovaAdaptiveRouterStatus', { timeout: PROBE_HARD_TIMEOUT_MS });
  }
  if (!state.generateFn) {
    state.generateFn = httpsCallable(functions, 'novaGenerateAdaptive', { timeout: CALL_TIMEOUT_MS });
  }
  return state;
}

async function runProbe(app) {
  const state = functionsFor(app, appState(app));
  const now = Date.now();
  const ttl = state.status === 'available' ? AVAILABLE_TTL_MS : UNAVAILABLE_TTL_MS;
  if (state.checkedAt && now - state.checkedAt < ttl) return state.status === 'available';
  if (state.probe) return state.probe;

  state.probe = (async () => {
    try {
      const result = await withTimeout(state.statusFn({}), PROBE_HARD_TIMEOUT_MS, 'Adaptive gateway probe');
      const ok = result?.data?.ok === true && result?.data?.foregroundIsolation === true;
      state.status = ok ? 'available' : 'unavailable';
      state.checkedAt = Date.now();
      globalThis.__NOVA_ADAPTIVE_GATEWAY__ = {
        available: ok,
        architecture: String(result?.data?.architecture || ''),
        checkedAt: new Date().toISOString()
      };
      return ok;
    } catch (error) {
      state.status = 'unavailable';
      state.checkedAt = Date.now();
      globalThis.__NOVA_ADAPTIVE_GATEWAY__ = {
        available: false,
        error: String(error?.message || error).slice(0, 220),
        checkedAt: new Date().toISOString()
      };
      return false;
    } finally {
      state.probe = null;
    }
  })();
  return state.probe;
}

async function adaptiveReadyWithoutForegroundDelay(app) {
  const state = appState(app);
  const now = Date.now();
  if (state.status === 'available' && now - state.checkedAt < AVAILABLE_TTL_MS) return true;
  if (state.status === 'unavailable' && now - state.checkedAt < UNAVAILABLE_TTL_MS) return false;

  const probe = runProbe(app);
  try {
    return await Promise.race([
      probe,
      new Promise(resolve => setTimeout(() => resolve(false), PROBE_SOFT_WAIT_MS))
    ]);
  } catch {
    return false;
  }
}

async function adaptiveGenerate(app, prompt) {
  const state = functionsFor(app, appState(app));
  const request = latestUserRequest(prompt);
  const cacheable = request.length <= 1200 && !/\b(latest|current|today|news|price|weather|github|repo|search|research)\b/i.test(request);
  const started = performance.now();
  const result = await withTimeout(state.generateFn({
    prompt: String(prompt || ''),
    history: [],
    dataClass: 'public',
    cacheable
  }), CALL_TIMEOUT_MS, 'Adaptive generation');
  const data = result?.data || {};
  const text = cleanText(data.text);
  globalThis.__NOVA_BRAIN_LAST__ = {
    provider: String(data?.route?.provider || 'adaptive'),
    model: String(data?.route?.model || 'unknown'),
    mode: `adaptive-${String(data.reasoningMode || 'unknown')}`,
    taskClass: String(data.taskClass || 'unknown'),
    latencyMs: Number(data.latencyMs || Math.round(performance.now() - started)),
    cached: data.cached === true,
    hedged: data.hedged === true,
    discoveredPool: Number(data.discoveredPool || 0),
    verifiedLive: Number(data.verifiedLive || 0),
    at: new Date().toISOString()
  };
  return text;
}

function textResult(text) {
  const cleaned = cleanText(text);
  return { response: { text: () => cleaned } };
}

export class GoogleAIBackend extends BaseGoogleAIBackend {}

export function getAI(firebaseApp, config = {}) {
  const base = baseGetAI(firebaseApp, config);
  // Start a non-blocking capability probe. The first user request never waits
  // beyond the tiny soft budget above; unavailable deployments are cached.
  queueMicrotask(() => { runProbe(firebaseApp).catch(() => {}); });
  return { ...base, firebaseApp, __novaAdaptiveClientGateway: true };
}

export function getGenerativeModel(ai, options = {}) {
  const baseModel = baseGetGenerativeModel(ai, options);
  return {
    async generateContent(prompt) {
      const app = ai?.firebaseApp;
      // Sensitive-looking requests are never promoted to the public adaptive
      // registry. They stay on the existing app path until trusted-private
      // routes are explicitly implemented and verified.
      if (!app || obviouslySensitive(prompt)) return baseModel.generateContent(prompt);

      const ready = await adaptiveReadyWithoutForegroundDelay(app);
      if (!ready) return baseModel.generateContent(prompt);

      try {
        return textResult(await adaptiveGenerate(app, prompt));
      } catch (error) {
        console.warn('[NOVA Adaptive Client] server fast lane failed; keeping foreground available.', error);
        const state = appState(app);
        state.status = 'unavailable';
        state.checkedAt = Date.now();
        return baseModel.generateContent(prompt);
      }
    }
  };
}
