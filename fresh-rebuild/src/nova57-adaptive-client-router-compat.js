// NOVA 5.7 Sol — adaptive client gateway v2.
// Foreground chat is isolated from background brain discovery. The gateway keeps
// a sticky winner, uses task/speed-aware hedging, avoids starting a losing lane
// when a fast winner already returned, and caches only exact non-fresh prompts.

import {
  GoogleAIBackend as BaseGoogleAIBackend,
  getAI as baseGetAI,
  getGenerativeModel as baseGetGenerativeModel
} from './nova57-runtime-recovery-router-compat.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';

const PROBE_SOFT_WAIT_MS = 80;
const PROBE_HARD_TIMEOUT_MS = 1_800;
const ADAPTIVE_CALL_TIMEOUT_MS = 7_200;
const FAST_HEDGE_DELAY_MS = 220;
const STANDARD_HEDGE_DELAY_MS = 480;
const RECOVERY_FIRST_ADAPTIVE_DELAY_MS = 120;
const SLOW_ADAPTIVE_MS = 3_600;
const SLOW_COOLDOWN_MS = 90_000;
const FAILURE_COOLDOWN_MS = 25_000;
const UNAVAILABLE_TTL_MS = 3 * 60_000;
const AVAILABLE_TTL_MS = 60_000;
const STICKY_WINNER_TTL_MS = 2 * 60_000;
const EXACT_CACHE_TTL_MS = 20_000;
const EXACT_CACHE_LIMIT = 24;
const stateByApp = new WeakMap();
const exactResponseCache = new Map();

function withTimeout(promise, ms, label) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
    })
  ]);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function latestUserRequest(prompt) {
  const text = String(prompt || '');
  const marker = '\nUser request:\n';
  const index = text.lastIndexOf(marker);
  return (index >= 0 ? text.slice(index + marker.length) : text).trim();
}

function promptProfile(prompt) {
  const full = String(prompt || '');
  const request = latestUserRequest(full);
  const fast = /speed preference is Fast/i.test(full);
  const fresh = /\b(latest|current|today|tonight|news|price|weather|github|repo|search|research|live|recent)\b/i.test(request)
    || /(aaj|abhi|latest|live|search|research).{0,18}(kar|karo|dekho|bata)/i.test(request);
  const complex = request.length > 1200
    || /\b(deep|thorough|comprehensive|architecture|audit|root cause|production|complex|debug|coding|code|research)\b/i.test(request);
  return {
    fast,
    fresh,
    complex,
    cacheable: request.length > 0 && request.length <= 1200 && !fresh
  };
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

function cacheKey(prompt) {
  const text = String(prompt || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`;
}

function cacheGet(prompt) {
  const key = cacheKey(prompt);
  const hit = exactResponseCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > EXACT_CACHE_TTL_MS) {
    exactResponseCache.delete(key);
    return null;
  }
  exactResponseCache.delete(key);
  exactResponseCache.set(key, hit);
  return hit.result;
}

function cacheSet(prompt, result) {
  const key = cacheKey(prompt);
  exactResponseCache.set(key, {at: Date.now(), result});
  while (exactResponseCache.size > EXACT_CACHE_LIMIT) {
    const oldest = exactResponseCache.keys().next().value;
    exactResponseCache.delete(oldest);
  }
}

function ema(previous, next, weight = .28) {
  const n = Number(next || 0);
  if (!n) return Number(previous || 0);
  const p = Number(previous || 0);
  return p ? Math.round(p * (1 - weight) + n * weight) : Math.round(n);
}

function appState(app) {
  let state = stateByApp.get(app);
  if (!state) {
    state = {
      status: 'unknown',
      checkedAt: 0,
      probe: null,
      statusFn: null,
      generateFn: null,
      failureStreak: 0,
      slowUntil: 0,
      lastAdaptiveLatencyMs: 0,
      adaptiveEmaMs: 0,
      recoveryEmaMs: 0,
      lastWinner: '',
      lastWinnerAt: 0
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
    state.generateFn = httpsCallable(functions, 'novaGenerateAdaptive', { timeout: ADAPTIVE_CALL_TIMEOUT_MS });
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
      if (ok) state.failureStreak = 0;
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
  if (state.slowUntil > now) return false;
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

async function adaptiveGenerate(app, prompt, profile) {
  const state = functionsFor(app, appState(app));
  const started = performance.now();
  const result = await withTimeout(state.generateFn({
    prompt: String(prompt || ''),
    history: [],
    dataClass: 'public',
    cacheable: profile.cacheable
  }), ADAPTIVE_CALL_TIMEOUT_MS, 'Adaptive generation');
  const data = result?.data || {};
  const text = cleanText(data.text);
  const latencyMs = Number(data.latencyMs || Math.round(performance.now() - started));
  state.lastAdaptiveLatencyMs = latencyMs;
  state.adaptiveEmaMs = ema(state.adaptiveEmaMs, latencyMs);
  state.failureStreak = 0;
  if (latencyMs >= SLOW_ADAPTIVE_MS) state.slowUntil = Date.now() + SLOW_COOLDOWN_MS;
  return {text, data, latencyMs};
}

function markAdaptiveWinner(outcome) {
  const data = outcome?.data || {};
  globalThis.__NOVA_BRAIN_LAST__ = {
    provider: String(data?.route?.provider || 'adaptive'),
    model: String(data?.route?.model || 'unknown'),
    mode: `adaptive-${String(data.reasoningMode || 'unknown')}`,
    taskClass: String(data.taskClass || 'unknown'),
    latencyMs: Number(outcome?.latencyMs || data.latencyMs || 0),
    cached: data.cached === true,
    hedged: data.hedged === true,
    discoveredPool: Number(data.discoveredPool || 0),
    verifiedLive: Number(data.verifiedLive || 0),
    at: new Date().toISOString()
  };
}

function textResult(text) {
  const cleaned = cleanText(text);
  return { response: { text: () => cleaned } };
}

function hedgeDelay(profile) {
  if (profile.fast) return profile.complex ? 300 : FAST_HEDGE_DELAY_MS;
  return profile.complex ? 560 : STANDARD_HEDGE_DELAY_MS;
}

function preferRecoveryFirst(state) {
  if (state.lastWinner !== 'recovery') return false;
  if (Date.now() - state.lastWinnerAt > STICKY_WINNER_TTL_MS) return false;
  if (!state.recoveryEmaMs || !state.adaptiveEmaMs) return true;
  return state.recoveryEmaMs + 120 < state.adaptiveEmaMs;
}

async function hedgedForegroundGenerate(app, baseModel, prompt, profile) {
  const state = appState(app);
  const recoveryFirst = preferRecoveryFirst(state);
  const recoveryDelay = recoveryFirst ? 0 : hedgeDelay(profile);
  const adaptiveDelay = recoveryFirst ? RECOVERY_FIRST_ADAPTIVE_DELAY_MS : 0;
  let winnerChosen = false;
  let kickRecovery;
  const recoveryKick = new Promise(resolve => { kickRecovery = resolve; });

  const adaptivePromise = (async () => {
    if (adaptiveDelay) await delay(adaptiveDelay);
    if (winnerChosen) throw new Error('Adaptive lane skipped after foreground winner.');
    try {
      const outcome = await adaptiveGenerate(app, prompt, profile);
      return {kind: 'adaptive', result: textResult(outcome.text), outcome, latencyMs: outcome.latencyMs};
    } catch (error) {
      state.failureStreak += 1;
      state.slowUntil = Date.now() + FAILURE_COOLDOWN_MS * Math.min(3, state.failureStreak);
      if (state.failureStreak >= 2) {
        state.status = 'unavailable';
        state.checkedAt = Date.now();
      }
      kickRecovery?.();
      throw error;
    }
  })();

  const recoveryPromise = (async () => {
    if (recoveryDelay) await Promise.race([delay(recoveryDelay), recoveryKick]);
    if (winnerChosen) throw new Error('Recovery lane skipped after foreground winner.');
    const started = performance.now();
    const result = await baseModel.generateContent(prompt);
    return {kind: 'recovery', result, latencyMs: Math.round(performance.now() - started)};
  })();

  const started = performance.now();
  const winner = await Promise.any([adaptivePromise, recoveryPromise]);
  winnerChosen = true;
  const elapsedMs = Math.round(performance.now() - started);

  state.lastWinner = winner.kind;
  state.lastWinnerAt = Date.now();
  if (winner.kind === 'adaptive') {
    state.adaptiveEmaMs = ema(state.adaptiveEmaMs, winner.latencyMs);
    markAdaptiveWinner(winner.outcome);
  } else {
    state.recoveryEmaMs = ema(state.recoveryEmaMs, winner.latencyMs);
  }

  globalThis.__NOVA_FOREGROUND_RACE__ = {
    winner: winner.kind,
    elapsedMs,
    adaptiveEmaMs: state.adaptiveEmaMs,
    recoveryEmaMs: state.recoveryEmaMs,
    recoveryFirst,
    hedgeDelayMs: recoveryDelay,
    adaptiveFailureStreak: state.failureStreak,
    adaptiveCooldown: state.slowUntil > Date.now(),
    at: new Date().toISOString()
  };
  return winner.result;
}

export class GoogleAIBackend extends BaseGoogleAIBackend {}

export function getAI(firebaseApp, config = {}) {
  const base = baseGetAI(firebaseApp, config);
  // Probe in the background when NOVA initializes. Foreground requests get only
  // the tiny soft wait if the status is still unknown.
  queueMicrotask(() => { runProbe(firebaseApp).catch(() => {}); });
  return { ...base, firebaseApp, __novaAdaptiveClientGateway: true };
}

export function getGenerativeModel(ai, options = {}) {
  const baseModel = baseGetGenerativeModel(ai, options);
  return {
    async generateContent(prompt) {
      const app = ai?.firebaseApp;
      if (!app || obviouslySensitive(prompt)) return baseModel.generateContent(prompt);

      const profile = promptProfile(prompt);
      if (profile.cacheable) {
        const cached = cacheGet(prompt);
        if (cached) {
          globalThis.__NOVA_FOREGROUND_RACE__ = {
            winner: 'exact-client-cache',
            elapsedMs: 0,
            cached: true,
            at: new Date().toISOString()
          };
          return cached;
        }
      }

      const ready = await adaptiveReadyWithoutForegroundDelay(app);
      if (!ready) {
        const result = await baseModel.generateContent(prompt);
        if (profile.cacheable) cacheSet(prompt, result);
        return result;
      }

      try {
        const result = await hedgedForegroundGenerate(app, baseModel, prompt, profile);
        if (profile.cacheable) cacheSet(prompt, result);
        return result;
      } catch (error) {
        console.warn('[NOVA Adaptive Client] all foreground lanes failed; recovery path will retry.', error);
        const result = await baseModel.generateContent(prompt);
        if (profile.cacheable) cacheSet(prompt, result);
        return result;
      }
    }
  };
}