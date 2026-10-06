// NOVA 5.7 Pro — low-latency anonymous-first router.
// Foreground requests never wait for discovery. No provider secret is embedded.
// Stable free Kilo route IDs below are from Kilo's documented free-model list;
// dynamic discovery can add/remove current free routes without an APK update.

const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const OVH_BASE = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1';
const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_ANON_KEY = '0000000000';
const CLIENT_AGENT = 'NexusNova:5.7-pro:router';
const DISCOVERY_TTL_MS = 5 * 60_000;
const MAX_DYNAMIC_ROUTES = 80;
const circuit = new Map();
const stats = new Map();
let liveRoutes = [];
let lastGood = null;
let discoveryAt = 0;
let discoveryPromise = null;
let discoveryTimer = 0;
let foreground = 0;

const KILO_SEEDS = [
  ['kilo-auto/free', 150],
  ['openrouter/free', 146],
  ['stepfun/step-3.7-flash:free', 140],
  ['poolside/laguna-xs-2.1:free', 136],
  ['poolside/laguna-s-2.1:free', 134],
  ['tencent/hy3:free', 132]
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || min));
const keyOf = r => `${r.provider}::${r.model}`;

function route(provider, model, kind = 'openai', priority = 50, extra = {}) {
  return { provider, model, kind, priority, ...extra };
}

function seedRoutes() {
  return KILO_SEEDS.map(([model, priority]) => route('Kilo', model, 'openai', priority, { base: KILO_BASE, seed: true }));
}

function requestProfile(prompt) {
  const s = String(prompt || '').toLowerCase();
  const hard = s.length > 5500 || /\b(reason|reasoning|prove|derive|analy[sz]e|architecture|debug|algorithm|constraint|complex|hard|repository|github|research|live web|tool result)\b/.test(s);
  const quick = s.length < 500 && !hard;
  return hard ? 'hard' : quick ? 'quick' : 'standard';
}

function budgetFor(profile) {
  if (profile === 'quick') return { attempt: 3500, total: 9000, maxAttempts: 3 };
  if (profile === 'hard') return { attempt: 6500, total: 18000, maxAttempts: 4 };
  return { attempt: 4800, total: 13000, maxAttempts: 4 };
}

function systemText(options = {}) {
  const parts = options?.systemInstruction?.parts;
  return Array.isArray(parts) ? parts.map(p => String(p?.text || '')).filter(Boolean).join('\n') : '';
}

function generationConfig(options = {}) {
  const cfg = options?.generationConfig || {};
  return {
    temperature: clamp(cfg.temperature ?? 0.45, 0.1, 1.2),
    maxTokens: clamp(cfg.maxOutputTokens ?? 760, 96, 1200)
  };
}

async function jsonFetch(url, init = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { text: raw }; }
    if (!response.ok) {
      const err = new Error(String(data?.error?.message || data?.message || data?.error || raw || `HTTP ${response.status}`).slice(0, 400));
      err.status = response.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data) {
  const c = data?.choices?.[0];
  const value = c?.message?.content ?? c?.text ?? data?.output_text ?? data?.text;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(x => typeof x === 'string' ? x : String(x?.text || x?.content || '')).join('').trim();
  return '';
}

async function runOpenAI(r, prompt, options, timeoutMs) {
  const cfg = generationConfig(options);
  const sys = systemText(options);
  const messages = [];
  if (sys) messages.push({ role: 'system', content: sys });
  messages.push({ role: 'user', content: String(prompt || '') });
  const data = await jsonFetch(`${r.base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(r.headers || {}) },
    body: JSON.stringify({ model: r.model, messages, temperature: cfg.temperature, max_tokens: cfg.maxTokens, stream: false })
  }, timeoutMs);
  const text = extractText(data);
  if (!text) throw new Error(`${r.provider}/${r.model} returned no usable text.`);
  return text;
}

async function cancelHorde(id) {
  if (!id) return;
  try { await fetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Client-Agent': CLIENT_AGENT } }); } catch {}
}

async function runHorde(r, prompt, options, timeoutMs) {
  const cfg = generationConfig(options);
  const sys = systemText(options);
  const finalPrompt = `${sys ? `${sys}\n\n` : ''}${String(prompt || '').trim()}\n\nNOVA 5.7 Sol:`;
  const submit = await jsonFetch(`${HORDE_BASE}/generate/text/async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: HORDE_ANON_KEY, 'Client-Agent': CLIENT_AGENT },
    body: JSON.stringify({
      prompt: finalPrompt,
      params: { max_length: Math.min(cfg.maxTokens, 650), max_context_length: 4096, temperature: cfg.temperature, top_p: 0.92, top_k: 40, rep_pen: 1.05 },
      models: [r.model], trusted_workers: false, slow_workers: true, dry_run: false
    })
  }, Math.min(4500, timeoutMs));
  const id = String(submit?.id || '');
  if (!id) throw new Error('AI Horde returned no generation id.');
  const started = Date.now();
  try {
    while (Date.now() - started < timeoutMs) {
      await sleep(650);
      const state = await jsonFetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, { headers: { 'Client-Agent': CLIENT_AGENT } }, 2800);
      const text = String(state?.generations?.[0]?.text || '').trim();
      if (text) return text;
      if (state?.faulted || state?.is_possible === false || state?.done === true) throw new Error('AI Horde route unavailable.');
    }
    throw new Error('AI Horde timed out.');
  } finally {
    if (Date.now() - started >= timeoutMs) cancelHorde(id);
  }
}

async function runRoute(r, prompt, options, timeoutMs) {
  if (r.kind === 'horde') return runHorde(r, prompt, options, timeoutMs);
  return runOpenAI(r, prompt, options, timeoutMs);
}

function stat(r) {
  const key = keyOf(r);
  if (!stats.has(key)) stats.set(key, { ok: 0, fail: 0, streak: 0, ewma: 0, lastOk: 0 });
  return stats.get(key);
}

function success(r, ms) {
  const s = stat(r);
  s.ok += 1; s.streak = 0; s.ewma = s.ewma ? s.ewma * 0.72 + ms * 0.28 : ms; s.lastOk = Date.now();
  circuit.delete(keyOf(r));
  lastGood = r;
}

function failure(r, error) {
  const s = stat(r); s.fail += 1; s.streak += 1;
  const msg = String(error?.message || error || '').toLowerCase();
  const status = Number(error?.status || 0);
  let wait = 18000;
  if (status === 429 || /rate.?limit|quota/.test(msg)) wait = 70000;
  else if (status === 401 || status === 403 || /auth|forbidden/.test(msg)) wait = 180000;
  else if (/timeout|abort/.test(msg)) wait = 25000;
  circuit.set(keyOf(r), Date.now() + wait);
}

function score(r) {
  const s = stat(r);
  const lastGoodBonus = lastGood && keyOf(lastGood) === keyOf(r) ? 55 : 0;
  const recentBonus = s.lastOk && Date.now() - s.lastOk < 10 * 60_000 ? 12 : 0;
  const latencyPenalty = s.ewma ? Math.min(20, s.ewma / 350) : 0;
  return Number(r.priority || 0) + lastGoodBonus + recentBonus + Math.min(s.ok, 8) * 2 - Math.min(s.streak, 4) * 12 - latencyPenalty;
}

function candidates() {
  const now = Date.now();
  const pool = dedupe([...(liveRoutes.length ? liveRoutes : seedRoutes()), ...seedRoutes()]);
  return pool.filter(r => (circuit.get(keyOf(r)) || 0) <= now).sort((a, b) => score(b) - score(a));
}

function dedupe(routes) {
  const seen = new Set();
  return routes.filter(r => {
    const k = keyOf(r);
    if (!r.model || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

function publish(mode = 'ready') {
  const pool = dedupe([...(liveRoutes.length ? liveRoutes : seedRoutes()), ...seedRoutes()]);
  globalThis.__NOVA_KEYLESS_ROUTE_POOL__ = pool.map(r => `${r.provider}:${r.model}`);
  globalThis.__NOVA_KEYLESS_ROUTE_COUNT__ = pool.length;
  globalThis.__NOVA_KEYLESS_PROVIDER_COUNT__ = new Set(pool.map(r => r.provider)).size;
  globalThis.__NOVA_DISCOVERY_STATE__ = { mode, routes: pool.length, providers: globalThis.__NOVA_KEYLESS_PROVIDER_COUNT__, foreground, discoveryAt: discoveryAt || null };
}

function modelRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.models)) return data.models;
  return [];
}

async function discoverKilo() {
  const out = seedRoutes();
  try {
    const data = await jsonFetch(`${KILO_BASE}/models`, {}, 4200);
    for (const row of modelRows(data)) {
      const id = String(row?.id || row?.model || row?.name || '').trim();
      if (!id) continue;
      const price = row?.pricing || row?.price || row?.cost || {};
      const zero = Number(price?.input ?? price?.prompt ?? NaN) === 0 && Number(price?.output ?? price?.completion ?? NaN) === 0;
      if (/:free$/i.test(id) || id === 'openrouter/free' || id === 'kilo-auto/free' || zero) out.push(route('Kilo', id, 'openai', /flash|mini|small|xs/i.test(id) ? 130 : 118, { base: KILO_BASE }));
    }
  } catch (e) { console.warn('[NOVA Pro] Kilo discovery:', e); }
  return out;
}

async function discoverOVH() {
  const out = [];
  try {
    const data = await jsonFetch(`${OVH_BASE}/models`, {}, 4200);
    for (const row of modelRows(data)) {
      const id = String(row?.id || row?.model || row?.name || '').trim();
      if (id && !/embed|rerank|guard|moderation/i.test(id)) out.push(route('OVHcloud', id, 'openai', 94, { base: OVH_BASE }));
    }
  } catch (e) { console.warn('[NOVA Pro] OVH discovery:', e); }
  return out;
}

async function discoverHorde() {
  const out = [];
  try {
    const data = await jsonFetch(`${HORDE_BASE}/status/models?type=text`, { headers: { 'Client-Agent': CLIENT_AGENT } }, 4800);
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.name || row?.id || row?.model || '').trim();
      const workers = Number(row?.count ?? row?.workers ?? 0) || 0;
      if (!id || workers < 1 || /nsfw|roleplay|erp/i.test(id)) continue;
      const quality = /deepseek|qwen/i.test(id) ? 20 : /llama|gemma|mistral/i.test(id) ? 14 : 0;
      out.push(route('AI Horde', id, 'horde', 65 + quality + Math.min(workers, 10)));
    }
  } catch (e) { console.warn('[NOVA Pro] Horde discovery:', e); }
  return out.sort((a, b) => b.priority - a.priority).slice(0, 24);
}

async function discoverBackground(force = false) {
  if (discoveryPromise) return discoveryPromise;
  if (foreground > 0) return null;
  if (!force && discoveryAt && Date.now() - discoveryAt < DISCOVERY_TTL_MS) return liveRoutes;
  publish('background-refresh');
  discoveryPromise = Promise.allSettled([discoverKilo(), discoverOVH(), discoverHorde()]).then(results => {
    const all = results.flatMap(x => x.status === 'fulfilled' ? x.value : []);
    liveRoutes = dedupe([...seedRoutes(), ...all]).sort((a, b) => b.priority - a.priority).slice(0, MAX_DYNAMIC_ROUTES);
    discoveryAt = Date.now();
    publish('ready');
    console.info('[NOVA Pro] background discovery', { routes: liveRoutes.length, providers: new Set(liveRoutes.map(r => r.provider)).size });
    return liveRoutes;
  }).catch(e => {
    console.warn('[NOVA Pro] discovery failed:', e);
    publish('background-error');
    return liveRoutes;
  }).finally(() => { discoveryPromise = null; });
  return discoveryPromise;
}

function scheduleDiscovery(delay = 1000) {
  if (discoveryTimer || discoveryPromise) return;
  discoveryTimer = setTimeout(() => {
    discoveryTimer = 0;
    if (foreground > 0) return scheduleDiscovery(1500);
    discoverBackground(false);
  }, delay);
}

async function runRouter(prompt, options = {}) {
  foreground += 1;
  publish('foreground-priority');
  const profile = requestProfile(prompt);
  const budget = budgetFor(profile);
  const deadline = Date.now() + budget.total;
  const attempts = [];
  try {
    const list = candidates().slice(0, budget.maxAttempts);
    for (const r of list) {
      if (Date.now() >= deadline) break;
      const t0 = Date.now();
      try {
        const remaining = Math.max(900, Math.min(budget.attempt, deadline - Date.now()));
        const text = await runRoute(r, prompt, options, remaining);
        const latencyMs = Date.now() - t0;
        success(r, latencyMs);
        globalThis.__NOVA_BRAIN_LAST__ = { provider: r.provider, model: r.model, attempts: attempts.length + 1, latencyMs, profile, adaptive: true, at: new Date().toISOString() };
        return text;
      } catch (e) {
        failure(r, e);
        attempts.push({ provider: r.provider, model: r.model, error: String(e?.message || e).slice(0, 220) });
      }
    }
    const e = new Error(`NOVA pro router exhausted ${attempts.length} route(s) within ${budget.total}ms.`);
    e.attempts = attempts;
    throw e;
  } finally {
    foreground = Math.max(0, foreground - 1);
    publish('ready');
    scheduleDiscovery(500);
  }
}

let firebaseModule = null;
async function firebaseFallback() {
  if (!firebaseModule) firebaseModule = import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js?nova-pro-original=1');
  return firebaseModule;
}

function firebaseCompatibleOptions(options = {}, modelOverride = '') {
  const source = options?.generationConfig || {};
  const generationConfig = { ...source };
  delete generationConfig.temperature;
  delete generationConfig.topP;
  delete generationConfig.topK;
  const result = { ...options, generationConfig };
  if (modelOverride) result.model = modelOverride;
  return result;
}

export class GoogleAIBackend { constructor(...args) { this.args = args; } }
export function getAI(firebaseApp) { publish('seed-ready'); scheduleDiscovery(); return { firebaseApp, __novaProRouter: true }; }
export function getGenerativeModel(ai, options = {}) {
  return {
    async generateContent(prompt) {
      try {
        const text = await runRouter(prompt, options);
        return { response: { text: () => text } };
      } catch (routerError) {
        console.warn('[NOVA Pro] keyless routes failed; trying Firebase AI fallback.', routerError);
        try {
          const mod = await firebaseFallback();
          const originalAI = mod.getAI(ai?.firebaseApp, { backend: new mod.GoogleAIBackend() });
          const primaryOptions = firebaseCompatibleOptions(options);
          try {
            return await mod.getGenerativeModel(originalAI, primaryOptions).generateContent(prompt);
          } catch (primaryFirebaseError) {
            const requestedModel = String(primaryOptions?.model || '');
            if (requestedModel === 'gemini-3.5-flash') throw primaryFirebaseError;
            const stableOptions = firebaseCompatibleOptions(options, 'gemini-3.5-flash');
            console.warn('[NOVA Pro] primary Firebase model failed; trying stable Gemini 3.5 Flash fallback.', primaryFirebaseError);
            return await mod.getGenerativeModel(originalAI, stableOptions).generateContent(prompt);
          }
        } catch (firebaseError) {
          const e = new Error(`NOVA routes failed: ${routerError?.message || routerError}; Firebase fallback failed: ${firebaseError?.message || firebaseError}`);
          e.cause = firebaseError;
          throw e;
        }
      }
    }
  };
}

publish('seed-ready');
scheduleDiscovery();
