// NOVA 5.7 Sol — adaptive keyless multi-provider router.
// Foreground inference never waits for provider/model discovery. Discovery and
// catalog refresh run separately in the background and yield to user requests.
// No provider API secrets are embedded in the APK/WebView source.

import {
  discoverPuterFreeRoutes,
  getPuterVerifiedSeedRoutes,
  runPuterRoute,
  PUTER_VERIFIED_FREE_SEED_COUNT
} from './nova57-puter-keyless-provider.js';

const MAX_ROUTES = 150;
const MAX_ATTEMPTS_PER_REQUEST = 10;
const TOTAL_TIMEOUT_MS = 32_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 4_200;
const HORDE_ATTEMPT_TIMEOUT_MS = 6_500;
const DISCOVERY_TTL_MS = 5 * 60_000;
const DISCOVERY_RETRY_MS = 60_000;
const BACKGROUND_START_DELAY_MS = 2_500;
const CLIENT_AGENT = 'NexusNova:5.7-sol:adaptive-keyless';

const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const OVH_BASE = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1';
const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_ANON_KEY = '0000000000';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || min));

let cachedRoutes = [];
let cachedAt = 0;
let lastGoodRoute = null;
let discoveryPromise = null;
let discoveryTimer = 0;
let foregroundRequests = 0;
const circuit = new Map();
const routeStats = new Map();

function systemText(options = {}) {
  const parts = options?.systemInstruction?.parts;
  return Array.isArray(parts)
    ? parts.map(part => String(part?.text || '')).filter(Boolean).join('\n')
    : '';
}

function generationConfig(options = {}) {
  const cfg = options?.generationConfig || {};
  return {
    temperature: clamp(cfg.temperature ?? 0.5, 0.1, 1.2),
    maxTokens: clamp(cfg.maxOutputTokens ?? 800, 96, 1200)
  };
}

function route(provider, model, kind = 'openai', priority = 50, extra = {}) {
  return { provider, model, kind, priority, ...extra };
}

function routeTimeout(r) {
  if (Number.isFinite(Number(r?.timeoutMs))) return Number(r.timeoutMs);
  if (r?.kind === 'horde') return HORDE_ATTEMPT_TIMEOUT_MS;
  return DEFAULT_ATTEMPT_TIMEOUT_MS;
}

function withTimeout(promise, ms, label = 'AI route') {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`${label} timed out.`);
        error.code = 'route-timeout';
        reject(error);
      }, ms);
    })
  ]);
}

async function jsonFetch(url, init = {}, timeoutMs = 6_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { text }; }
    if (!response.ok) {
      const message = String(data?.error?.message || data?.message || data?.error || text || `HTTP ${response.status}`);
      const error = new Error(message.slice(0, 500));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function arrayFromModelPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function modelId(row) {
  return String(row?.id || row?.model || row?.name || '').trim();
}

function numericZero(value) {
  if (value === 0 || value === '0' || value === '0.0' || value === '0.00') return true;
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

function looksZeroCost(row) {
  const p = row?.pricing || row?.price || row?.cost || {};
  const input = p?.input ?? p?.prompt ?? p?.input_cost ?? row?.input_cost ?? row?.input_price;
  const output = p?.output ?? p?.completion ?? p?.output_cost ?? row?.output_cost ?? row?.output_price;
  return input !== undefined && output !== undefined && numericZero(input) && numericZero(output);
}

function builtInSeedRoutes() {
  return [
    route('Kilo', 'kilo-auto/free', 'openai', 120, { base: KILO_BASE, timeoutMs: 4_000, seed: true }),
    ...getPuterVerifiedSeedRoutes()
  ];
}

async function discoverKilo() {
  const routes = [route('Kilo', 'kilo-auto/free', 'openai', 120, { base: KILO_BASE, timeoutMs: 4_000, seed: true })];
  try {
    const data = await jsonFetch(`${KILO_BASE}/models`, {}, 4_500);
    for (const row of arrayFromModelPayload(data)) {
      const id = modelId(row);
      if (!id) continue;
      if (id === 'kilo-auto/free' || /:free$/i.test(id) || looksZeroCost(row)) {
        routes.push(route('Kilo', id, 'openai', 116, { base: KILO_BASE, timeoutMs: 4_000 }));
      }
    }
  } catch (error) {
    console.warn('[NOVA Keyless] Kilo discovery:', error);
  }
  return routes;
}

async function discoverOVH() {
  const routes = [];
  try {
    const data = await jsonFetch(`${OVH_BASE}/models`, {}, 4_500);
    for (const row of arrayFromModelPayload(data)) {
      const id = modelId(row);
      if (!id || /embed|rerank|guard|moderation/i.test(id)) continue;
      routes.push(route('OVHcloud', id, 'openai', 96, { base: OVH_BASE, timeoutMs: 4_200 }));
    }
  } catch (error) {
    console.warn('[NOVA Keyless] OVH discovery:', error);
  }
  return routes;
}

async function discoverHorde() {
  const routes = [];
  try {
    const data = await jsonFetch(`${HORDE_BASE}/status/models?type=text`, {
      headers: { 'Client-Agent': CLIENT_AGENT }
    }, 5_500);
    const rows = Array.isArray(data) ? data : [];
    const seen = new Set();
    for (const row of rows) {
      const id = modelId(row);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const workers = Number(row?.count ?? row?.workers ?? row?.worker_count ?? 0) || 0;
      if (workers <= 0) continue;
      const perf = Number(row?.performance ?? 0) || 0;
      const queued = Number(row?.queued ?? row?.queued_jobs ?? row?.queue ?? 0) || 0;
      const quality =
        (/qwen/i.test(id) ? 30 : 0) +
        (/deepseek/i.test(id) ? 28 : 0) +
        (/gemma/i.test(id) ? 24 : 0) +
        (/llama/i.test(id) ? 22 : 0) +
        (/mistral|mixtral/i.test(id) ? 20 : 0) +
        (/coder|code|instruct/i.test(id) ? 12 : 0) -
        (/roleplay|nsfw|uncensored|erp/i.test(id) ? 34 : 0);
      routes.push(route(
        'AI Horde',
        id,
        'horde',
        60 + quality + workers * 2 + Math.min(perf, 100) * 0.05 - queued * 0.2,
        { timeoutMs: HORDE_ATTEMPT_TIMEOUT_MS }
      ));
    }
  } catch (error) {
    console.warn('[NOVA Keyless] Horde discovery:', error);
  }
  routes.sort((a, b) => b.priority - a.priority);
  return routes;
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const out = [];
  for (const r of routes) {
    const key = `${r.provider}::${r.model}`;
    if (!r.model || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function diversify(routes) {
  const groups = new Map();
  for (const r of routes) {
    if (!groups.has(r.provider)) groups.set(r.provider, []);
    groups.get(r.provider).push(r);
  }
  for (const list of groups.values()) list.sort((a, b) => b.priority - a.priority);
  const providers = [...groups.keys()].sort(
    (a, b) => (groups.get(b)[0]?.priority || 0) - (groups.get(a)[0]?.priority || 0)
  );
  const out = [];
  let added = true;
  while (added && out.length < MAX_ROUTES) {
    added = false;
    for (const provider of providers) {
      const next = groups.get(provider)?.shift();
      if (!next) continue;
      out.push(next);
      added = true;
      if (out.length >= MAX_ROUTES) break;
    }
  }
  return out;
}

function publishPoolState(mode = 'ready') {
  const routes = cachedRoutes.length ? cachedRoutes : builtInSeedRoutes();
  globalThis.__NOVA_KEYLESS_ROUTE_POOL__ = routes.map(r => `${r.provider}:${r.model}`);
  globalThis.__NOVA_KEYLESS_ROUTE_COUNT__ = routes.length;
  globalThis.__NOVA_KEYLESS_VERIFIED_NEW_PUTER_SEEDS__ = PUTER_VERIFIED_FREE_SEED_COUNT;
  globalThis.__NOVA_KEYLESS_PROVIDER_COUNT__ = new Set(routes.map(r => r.provider)).size;
  globalThis.__NOVA_DISCOVERY_STATE__ = {
    mode,
    routes: routes.length,
    providers: globalThis.__NOVA_KEYLESS_PROVIDER_COUNT__,
    cachedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
    foregroundRequests
  };
}

function ensureSeedPool() {
  if (!cachedRoutes.length) cachedRoutes = diversify(dedupeRoutes(builtInSeedRoutes())).slice(0, MAX_ROUTES);
  publishPoolState(cachedAt ? 'ready' : 'seed-ready');
  return cachedRoutes;
}

async function refreshRoutesInBackground(force = false) {
  if (discoveryPromise) return discoveryPromise;
  if (foregroundRequests > 0) {
    scheduleBackgroundDiscovery(2_000);
    return null;
  }
  if (!force && cachedAt && Date.now() - cachedAt < DISCOVERY_TTL_MS) return cachedRoutes;

  publishPoolState('background-refresh');
  discoveryPromise = (async () => {
    const settled = await Promise.allSettled([
      discoverKilo(),
      discoverOVH(),
      discoverHorde(),
      discoverPuterFreeRoutes(force)
    ]);
    const dynamic = settled.flatMap(x => x.status === 'fulfilled' ? x.value : []);
    const merged = diversify(dedupeRoutes([...builtInSeedRoutes(), ...dynamic])).slice(0, MAX_ROUTES);
    if (merged.length) cachedRoutes = merged;
    cachedAt = Date.now();
    publishPoolState('ready');
    console.info('[NOVA Keyless] background route refresh', {
      routes: cachedRoutes.length,
      providers: globalThis.__NOVA_KEYLESS_PROVIDER_COUNT__,
      verifiedNewPuterSeeds: PUTER_VERIFIED_FREE_SEED_COUNT
    });
    return cachedRoutes;
  })().catch(error => {
    console.warn('[NOVA Keyless] background discovery failed:', error);
    publishPoolState('background-error');
    scheduleBackgroundDiscovery(DISCOVERY_RETRY_MS);
    return cachedRoutes;
  }).finally(() => {
    discoveryPromise = null;
  });
  return discoveryPromise;
}

function scheduleBackgroundDiscovery(delayMs = BACKGROUND_START_DELAY_MS) {
  if (discoveryTimer || discoveryPromise) return;
  discoveryTimer = setTimeout(() => {
    discoveryTimer = 0;
    if (foregroundRequests > 0) {
      scheduleBackgroundDiscovery(2_000);
      return;
    }
    refreshRoutesInBackground(false);
  }, Math.max(250, Number(delayMs) || BACKGROUND_START_DELAY_MS));
}

function extractOpenAIText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? data?.output_text ?? data?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => typeof part === 'string' ? part : String(part?.text || part?.content || '')).join('').trim();
  }
  return '';
}

async function runOpenAIRoute(r, prompt, options) {
  const cfg = generationConfig(options);
  const sys = systemText(options);
  const messages = [];
  if (sys) messages.push({ role: 'system', content: sys });
  messages.push({ role: 'user', content: String(prompt || '') });
  const data = await jsonFetch(`${r.base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(r.headers || {})
    },
    body: JSON.stringify({
      model: r.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      stream: false
    })
  }, routeTimeout(r));
  const text = extractOpenAIText(data);
  if (!text) throw new Error(`${r.provider}/${r.model} returned no usable text.`);
  return text;
}

function hordeParams(options = {}) {
  const cfg = generationConfig(options);
  return {
    max_length: Math.min(cfg.maxTokens, 700),
    max_context_length: 4096,
    temperature: cfg.temperature,
    top_p: 0.92,
    top_k: 40,
    rep_pen: 1.05,
    stop_sequence: ['\nUser:', '\nNOVA 5.7 Sol:']
  };
}

async function cancelHorde(id) {
  if (!id) return;
  try {
    await fetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Client-Agent': CLIENT_AGENT }
    });
  } catch {}
}

async function runHorde(r, prompt, options) {
  const sys = systemText(options);
  const finalPrompt = `${sys ? `${sys}\n\n` : ''}${String(prompt || '').trim()}\n\nNOVA 5.7 Sol:`;
  const submit = await jsonFetch(`${HORDE_BASE}/generate/text/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: HORDE_ANON_KEY,
      'Client-Agent': CLIENT_AGENT
    },
    body: JSON.stringify({
      prompt: finalPrompt,
      params: hordeParams(options),
      models: [r.model],
      trusted_workers: false,
      slow_workers: true,
      dry_run: false
    })
  }, 5_000);
  const id = String(submit?.id || '').trim();
  if (!id) throw new Error('AI Horde did not return a generation id.');

  const timeoutMs = routeTimeout(r);
  const started = Date.now();
  try {
    while (Date.now() - started < timeoutMs) {
      await sleep(750);
      const status = await jsonFetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, {
        headers: { 'Client-Agent': CLIENT_AGENT }
      }, 3_500);
      const generations = Array.isArray(status?.generations) ? status.generations : [];
      const text = String(generations[0]?.text || '').trim();
      if (text) return text;
      if (status?.faulted === true) throw new Error('AI Horde worker faulted.');
      if (status?.is_possible === false) throw new Error('AI Horde model unavailable.');
      if (status?.done === true) throw new Error('AI Horde completed without usable text.');
    }
    throw new Error('AI Horde route timed out.');
  } finally {
    if (Date.now() - started >= timeoutMs) cancelHorde(id);
  }
}

async function runRoute(r, prompt, options) {
  if (r.kind === 'puter') return runPuterRoute(r, prompt, options);
  if (r.kind === 'horde') return runHorde(r, prompt, options);
  return runOpenAIRoute(r, prompt, options);
}

function circuitKey(r) {
  return `${r.provider}::${r.model}`;
}

function blocked(r) {
  return (circuit.get(circuitKey(r)) || 0) > Date.now();
}

function statFor(r) {
  const key = circuitKey(r);
  if (!routeStats.has(key)) routeStats.set(key, { ok: 0, fail: 0, consecutiveFail: 0, ewmaLatency: 0, lastSuccessAt: 0, lastFailureAt: 0 });
  return routeStats.get(key);
}

function markSuccess(r, latencyMs) {
  const s = statFor(r);
  s.ok += 1;
  s.consecutiveFail = 0;
  s.ewmaLatency = s.ewmaLatency ? (s.ewmaLatency * 0.7 + latencyMs * 0.3) : latencyMs;
  s.lastSuccessAt = Date.now();
  circuit.delete(circuitKey(r));
}

function markFailure(r, error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || error || '').toLowerCase();
  let ms = 25_000;
  if (status === 429 || /rate.?limit|quota|too many/.test(message)) ms = 90_000;
  else if (status === 401 || status === 403 || /unauth|forbidden|sign.?in|auth_window/.test(message)) ms = 5 * 60_000;
  else if (/timeout|abort/.test(message)) ms = 45_000;
  circuit.set(circuitKey(r), Date.now() + ms);
  const s = statFor(r);
  s.fail += 1;
  s.consecutiveFail += 1;
  s.lastFailureAt = Date.now();
}

function adaptiveScore(r) {
  const s = statFor(r);
  const latencyPenalty = s.ewmaLatency ? Math.min(14, s.ewmaLatency / 500) : 0;
  const recentSuccess = s.lastSuccessAt && Date.now() - s.lastSuccessAt < 10 * 60_000 ? 8 : 0;
  const lastGoodBonus = lastGoodRoute && circuitKey(lastGoodRoute) === circuitKey(r) ? 40 : 0;
  return Number(r.priority || 0)
    + Math.min(s.ok, 6) * 2
    - Math.min(s.fail, 6) * 1.5
    - Math.min(s.consecutiveFail, 4) * 7
    - latencyPenalty
    + recentSuccess
    + lastGoodBonus;
}

function candidateOrder(pool) {
  return pool
    .filter(r => !blocked(r))
    .slice()
    .sort((a, b) => adaptiveScore(b) - adaptiveScore(a));
}

async function runKeylessRouter(prompt, options = {}) {
  foregroundRequests += 1;
  publishPoolState('foreground-priority');
  const shouldRefreshAfter = !cachedAt || Date.now() - cachedAt >= DISCOVERY_TTL_MS;
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const pool = ensureSeedPool();
  const attempts = [];

  try {
    const candidates = candidateOrder(pool);
    for (const r of candidates.slice(0, MAX_ATTEMPTS_PER_REQUEST)) {
      if (Date.now() >= deadline) break;
      const started = Date.now();
      try {
        const remaining = Math.max(1_200, Math.min(routeTimeout(r), deadline - Date.now()));
        const text = await withTimeout(runRoute(r, prompt, options), remaining, `${r.provider}/${r.model}`);
        if (!text) throw new Error('Empty route response.');
        const latencyMs = Date.now() - started;
        markSuccess(r, latencyMs);
        lastGoodRoute = r;
        globalThis.__NOVA_BRAIN_LAST__ = {
          provider: r.provider,
          model: r.model,
          discoveredRoutes: pool.length,
          discoveredProviders: new Set(pool.map(x => x.provider)).size,
          attempts: attempts.length + 1,
          latencyMs,
          adaptive: true,
          at: new Date().toISOString()
        };
        console.info('[NOVA Keyless] success', globalThis.__NOVA_BRAIN_LAST__);
        return text;
      } catch (error) {
        markFailure(r, error);
        attempts.push({ provider: r.provider, model: r.model, error: String(error?.message || error) });
        console.warn('[NOVA Keyless] switching route', r.provider, r.model, error);
      }
    }

    const error = new Error(`Keyless router failed after ${attempts.length} routes from a ${pool.length}-route live pool.`);
    error.attempts = attempts;
    throw error;
  } finally {
    foregroundRequests = Math.max(0, foregroundRequests - 1);
    publishPoolState('ready');
    if (shouldRefreshAfter) scheduleBackgroundDiscovery(750);
  }
}

let originalFirebaseAI = null;
async function originalProvider() {
  if (!originalFirebaseAI) {
    originalFirebaseAI = import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js?nova-original=1');
  }
  return originalFirebaseAI;
}

export class GoogleAIBackend {
  constructor(...args) { this.args = args; }
}

export function getAI(firebaseApp) {
  ensureSeedPool();
  scheduleBackgroundDiscovery();
  return {
    firebaseApp,
    __novaKeylessRouter: true,
    __novaKeylessHardened: true,
    __novaBackgroundDiscovery: true,
    __novaAdaptiveRouting: true
  };
}

export function getGenerativeModel(ai, options = {}) {
  return {
    async generateContent(prompt) {
      try {
        const text = await runKeylessRouter(prompt, options);
        return { response: { text: () => text } };
      } catch (routerError) {
        console.warn('[NOVA Keyless] keyless pool unavailable; trying real Firebase AI fallback.', routerError);
        try {
          const mod = await originalProvider();
          const originalAI = mod.getAI(ai?.firebaseApp, { backend: new mod.GoogleAIBackend() });
          const originalModel = mod.getGenerativeModel(originalAI, options);
          return await originalModel.generateContent(prompt);
        } catch (firebaseError) {
          const error = new Error(`Keyless router failed: ${routerError?.message || routerError}; Firebase fallback failed: ${firebaseError?.message || firebaseError}`);
          error.cause = firebaseError;
          throw error;
        }
      }
    }
  };
}

ensureSeedPool();
scheduleBackgroundDiscovery();
