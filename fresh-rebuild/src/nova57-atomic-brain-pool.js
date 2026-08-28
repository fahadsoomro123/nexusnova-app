// NOVA 5.7 ACRM/ARIM — explicit fast brain pool.
// Keeps only route health/latency counters in localStorage; never stores prompts.
// The pool can absorb dynamically discovered Kilo/OVH routes published by the
// keyless router, while known-good routes provide a cold-start safety net.
// ARIM lanes partition and provider-interleave ranked candidates so parallel
// branches do not all depend on one model/provider failure domain.

const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const OVH_BASE = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1';
const MEMORY_KEY = 'nova57:atomic-brain-memory:v1';
const MEMORY_LIMIT = 140;
const memory = new Map();
let memoryLoaded = false;
let persistTimer = 0;

const KNOWN_FAST = [
  { provider: 'Kilo', model: 'openrouter/free', base: KILO_BASE, priority: 170 },
  { provider: 'Kilo', model: 'nvidia/nemotron-3-super-120b-a12b:free', base: KILO_BASE, priority: 166 },
  { provider: 'Kilo', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', base: KILO_BASE, priority: 162 },
  { provider: 'Kilo', model: 'minimax/minimax-m3:free', base: KILO_BASE, priority: 156 },
  { provider: 'OVHcloud', model: 'Mistral-Small-3.2-24B-Instruct-2506', base: OVH_BASE, priority: 154 },
  { provider: 'OVHcloud', model: 'Mistral-7B-Instruct-v0.3', base: OVH_BASE, priority: 150 },
  { provider: 'OVHcloud', model: 'Mistral-Nemo-Instruct-2407', base: OVH_BASE, priority: 148 }
];

const keyOf = route => `${route.provider}::${route.model}`;
const clip = (value, max = 500) => String(value || '').slice(0, max);

export function assessAtomicResponseQuality(value) {
  const text = String(value || '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  const head = text.slice(0, 520).replace(/^\s+/, '');
  const internalMeta = [
    /^<think>\b/i,
    /^<analysis>\b/i,
    /^#{1,4}\s*(?:analysis|reasoning|chain of thought)\b/i,
    /^(?:the\s+)?user\s+(?:asks|wants|is asking|requested)\b/i,
    /^we\s+(?:need|should|must)\s+(?:to\s+)?(?:respond|answer|solve|craft|provide|analy[sz]e|figure out|comply)\b/i,
    /^we\s+need\s+(?:an?\s+)?(?:answer|response|solution)\b/i,
    /^i\s+need\s+to\s+(?:respond|answer|solve|craft|provide|analy[sz]e)\b/i,
    /^the\s+task\s+is\b/i,
    /^task\s*:\s*(?:respond|answer|solve|craft|provide|analy[sz]e)\b/i
  ];
  if (internalMeta.some(pattern => pattern.test(head))) return { ok: false, reason: 'internal-meta-leak' };
  if (/^\s*[\[{]\s*"(?:choices|error|model|object|usage|created|id)"\s*:/i.test(head)) {
    return { ok: false, reason: 'raw-transport-json' };
  }
  return { ok: true, reason: 'ok' };
}

function loadMemory() {
  if (memoryLoaded) return;
  memoryLoaded = true;
  try {
    const raw = globalThis?.localStorage?.getItem?.(MEMORY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.routes) ? parsed.routes : [];
    for (const row of rows.slice(0, MEMORY_LIMIT)) {
      const key = String(row?.key || '');
      if (!key) continue;
      memory.set(key, {
        ok: Math.max(0, Number(row.ok || 0)),
        fail: Math.max(0, Number(row.fail || 0)),
        ewma: Math.max(0, Number(row.ewma || 0)),
        lastOk: Math.max(0, Number(row.lastOk || 0)),
        lastFail: Math.max(0, Number(row.lastFail || 0)),
        lastErrorKind: String(row.lastErrorKind || '')
      });
    }
  } catch {}
}

function persistMemorySoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = 0;
    try {
      const rows = [...memory.entries()]
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => Math.max(b.lastOk, b.lastFail) - Math.max(a.lastOk, a.lastFail))
        .slice(0, MEMORY_LIMIT);
      globalThis?.localStorage?.setItem?.(MEMORY_KEY, JSON.stringify({ version: 1, routes: rows }));
    } catch {}
  }, 150);
}

function stat(route) {
  loadMemory();
  const key = keyOf(route);
  if (!memory.has(key)) memory.set(key, { ok: 0, fail: 0, ewma: 0, lastOk: 0, lastFail: 0, lastErrorKind: '' });
  return memory.get(key);
}

function errorKind(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '');
  const msg = String(error?.message || error || '').toLowerCase();
  if (code === 'NOVA_QUALITY_REJECT' || /quality reject|internal-meta-leak|raw-transport-json/.test(msg)) return 'quality';
  if (status === 429 || /rate.?limit|quota/.test(msg)) return 'rate-limit';
  if (status === 401 || status === 403 || /auth|forbidden/.test(msg)) return 'auth';
  if (/timeout|abort/.test(msg)) return 'timeout';
  if (/no usable text|empty/.test(msg)) return 'empty';
  return 'failed';
}

function backendOutcome(kind) {
  if (kind === 'quality' || kind === 'failed') return 'failure';
  return kind;
}

function reportBackendFailures(failures, capability) {
  if (!Array.isArray(failures) || !failures.length) return;
  import('./nova57-atomic-backend-client.js').then(bridge => {
    if (typeof bridge?.reportAtomicOutcome !== 'function') return;
    for (const failure of failures.slice(0, 2)) {
      if (!failure?.provider || !failure?.model) continue;
      bridge.reportAtomicOutcome({
        source: failure.provider,
        provider: failure.provider,
        modelId: failure.model,
        capability,
        outcome: failure.outcome,
        latencyMs: failure.latencyMs,
        quality: 0
      });
    }
  }).catch(() => {});
}

function markSuccess(route, latencyMs) {
  const s = stat(route);
  s.ok += 1;
  s.ewma = s.ewma ? s.ewma * 0.72 + latencyMs * 0.28 : latencyMs;
  s.lastOk = Date.now();
  s.lastErrorKind = '';
  persistMemorySoon();
}

function markFailure(route, error) {
  const s = stat(route);
  s.fail += 1;
  s.lastFail = Date.now();
  s.lastErrorKind = errorKind(error);
  persistMemorySoon();
}

function quarantineMs(kind) {
  if (kind === 'auth') return 30 * 60_000;
  if (kind === 'quality') return 3 * 60_000;
  if (kind === 'rate-limit') return 90_000;
  if (kind === 'timeout') return 40_000;
  if (kind === 'empty') return 75_000;
  return 25_000;
}

function isQuarantined(route) {
  const s = stat(route);
  if (!s.lastFail || !s.lastErrorKind) return false;
  if (s.lastOk > s.lastFail) return false;
  return Date.now() - s.lastFail < quarantineMs(s.lastErrorKind);
}

function dynamicRoutes() {
  const raw = Array.isArray(globalThis.__NOVA_KEYLESS_ROUTE_POOL__) ? globalThis.__NOVA_KEYLESS_ROUTE_POOL__ : [];
  const out = [];
  for (const value of raw) {
    const valueText = String(value || '');
    const split = valueText.indexOf(':');
    if (split <= 0) continue;
    const provider = valueText.slice(0, split);
    const model = valueText.slice(split + 1);
    if (!model || /embed|rerank|guard|moderation|stable.?diffusion|whisper|tts|speech|audio|lyria|image|flux|sdxl/i.test(model)) continue;
    if (provider === 'Kilo') out.push({ provider, model, base: KILO_BASE, priority: 118 });
    else if (provider === 'OVHcloud') out.push({ provider, model, base: OVH_BASE, priority: 108 });
  }
  return out;
}

function dedupe(routes) {
  const seen = new Set();
  return routes.filter(route => {
    const key = keyOf(route);
    if (!route.model || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fitBonus(route, capability) {
  const id = route.model.toLowerCase();
  if (capability === 'coding') {
    if (/coder|code|codestral|devstral|qwen/.test(id)) return 38;
    if (/mistral|nemotron|minimax/.test(id)) return 20;
  }
  if (capability === 'reasoning') {
    if (/reason|r1|thinking|nemotron|minimax|qwen/.test(id)) return 38;
    if (/mistral|openrouter\/free/.test(id)) return 18;
  }
  if (capability === 'multilingual') {
    if (/qwen|mistral|gemma|minimax|llama/.test(id)) return 30;
  }
  if (capability === 'research') {
    if (/nemotron|mistral|minimax|openrouter\/free/.test(id)) return 22;
  }
  return /instruct|chat|nemotron|mistral|minimax|openrouter\/free/.test(id) ? 12 : 0;
}

function providerSetFromKeys(keys) {
  const providers = new Set();
  for (const key of keys || []) {
    const split = String(key || '').indexOf('::');
    if (split > 0) providers.add(String(key).slice(0, split));
  }
  return providers;
}

function routeScore(route, capability, preferredIndex, excludedProviders) {
  const s = stat(route);
  const attempts = s.ok + s.fail;
  const successRate = attempts ? s.ok / attempts : 0.5;
  const freshness = s.lastOk && Date.now() - s.lastOk < 15 * 60_000 ? 20 : 0;
  const latencyPenalty = s.ewma ? Math.min(42, s.ewma / 120) : 0;
  const failurePenalty = Math.min(35, s.fail * 4);
  const qualityPenalty = s.lastErrorKind === 'quality' && s.lastFail > s.lastOk ? 70 : 0;
  const preferredAt = preferredIndex.get(keyOf(route));
  const backendBonus = Number.isInteger(preferredAt) ? Math.max(36, 90 - preferredAt * 8) : 0;
  const providerDiversity = excludedProviders.size === 1 && !excludedProviders.has(route.provider) ? 52 : 0;
  return route.priority + fitBonus(route, capability) + backendBonus + providerDiversity + freshness + successRate * 24 - latencyPenalty - failurePenalty - qualityPenalty;
}

function interleaveProviders(routes) {
  const providerOrder = [];
  const groups = new Map();
  for (const route of routes) {
    if (!groups.has(route.provider)) {
      groups.set(route.provider, []);
      providerOrder.push(route.provider);
    }
    groups.get(route.provider).push(route);
  }
  if (providerOrder.length < 2) return routes;
  const output = [];
  let added = true;
  while (added) {
    added = false;
    for (const provider of providerOrder) {
      const group = groups.get(provider);
      if (!group?.length) continue;
      output.push(group.shift());
      added = true;
    }
  }
  return output;
}

export function atomicCandidates(capability = 'general', excludeKeys = [], preferredKeys = []) {
  loadMemory();
  const excluded = new Set(excludeKeys || []);
  const excludedProviders = providerSetFromKeys(excludeKeys);
  const preferredIndex = new Map((preferredKeys || []).map((key, index) => [String(key), index]));
  const ranked = dedupe([...KNOWN_FAST, ...dynamicRoutes()])
    .filter(route => !excluded.has(keyOf(route)) && !isQuarantined(route))
    .sort((a, b) => routeScore(b, capability, preferredIndex, excludedProviders) - routeScore(a, capability, preferredIndex, excludedProviders));
  return interleaveProviders(ranked);
}

function generationConfig(options = {}) {
  const cfg = options?.generationConfig || {};
  return {
    temperature: Math.max(0.1, Math.min(1.1, Number(cfg.temperature ?? 0.35))),
    maxTokens: Math.max(96, Math.min(950, Number(cfg.maxOutputTokens ?? 720)))
  };
}

function systemText(options = {}) {
  const parts = options?.systemInstruction?.parts;
  return Array.isArray(parts) ? parts.map(part => String(part?.text || '')).filter(Boolean).join('\n') : '';
}

async function callRoute(route, prompt, options, timeoutMs, delayMs = 0) {
  if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
  const cfg = generationConfig(options);
  const messages = [];
  const system = systemText(options);
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: String(prompt || '') });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${route.base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: route.model, messages, temperature: cfg.temperature, max_tokens: cfg.maxTokens, stream: false })
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { text: raw }; }
    if (!response.ok) {
      const error = new Error(clip(data?.error?.message || data?.message || data?.error || raw || `HTTP ${response.status}`, 400));
      error.status = response.status;
      throw error;
    }
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.text;
    const answerText = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content.map(part => typeof part === 'string' ? part : String(part?.text || part?.content || '')).join('').trim()
        : '';
    if (!answerText) throw new Error(`${route.provider}/${route.model} returned no usable text.`);
    const quality = assessAtomicResponseQuality(answerText);
    if (!quality.ok) {
      const error = new Error(`${route.provider}/${route.model} quality reject: ${quality.reason}.`);
      error.code = 'NOVA_QUALITY_REJECT';
      error.qualityReason = quality.reason;
      throw error;
    }
    const latencyMs = Date.now() - started;
    markSuccess(route, latencyMs);
    return { text: answerText, route, latencyMs };
  } catch (error) {
    const kind = errorKind(error);
    markFailure(route, error);
    error.__novaAtomicFailure = {
      provider: route.provider,
      model: route.model,
      routeKey: keyOf(route),
      latencyMs: Date.now() - started,
      outcome: backendOutcome(kind),
      quality: 0
    };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function laneSlice(candidates, lane, hedgeWidth) {
  const width = Math.max(1, Math.min(2, Number(hedgeWidth) || 1));
  if (!candidates.length) return [];
  const safeLane = Math.max(0, Math.min(15, Number(lane) || 0));
  const start = safeLane * width;
  if (start >= candidates.length) return [];
  return candidates.slice(start, start + width);
}

export async function runAtomicBrain(prompt, options = {}, control = {}) {
  const capability = String(control.capability || 'general');
  const excludeKeys = Array.isArray(control.excludeKeys) ? control.excludeKeys : [];
  const preferredKeys = Array.isArray(control.preferredKeys) ? control.preferredKeys : [];
  const timeoutMs = Math.max(900, Math.min(5200, Number(control.timeoutMs || 3600)));
  const lane = Math.max(0, Number(control.lane || 0));
  const hedgeWidth = Math.max(1, Math.min(2, Number(control.hedgeWidth || 2)));
  const candidates = atomicCandidates(capability, excludeKeys, preferredKeys);
  if (!candidates.length) throw new Error(`No healthy ACRM/ARIM ${capability} candidates.`);

  const selected = laneSlice(candidates, lane, hedgeWidth);
  if (!selected.length) throw new Error(`No distinct ACRM/ARIM ${capability} candidate remains for lane ${lane}.`);
  const started = Date.now();
  const attempts = selected.map((route, index) => callRoute(route, prompt, options, timeoutMs, index * 110));
  try {
    const winner = await Promise.any(attempts);
    const brain = {
      provider: winner.route.provider,
      model: winner.route.model,
      routeKey: keyOf(winner.route),
      attempts: selected.length,
      latencyMs: winner.latencyMs,
      wallMs: Date.now() - started,
      profile: capability,
      adaptive: true,
      atomic: true,
      mesh: true,
      lane,
      selected: selected.map(keyOf),
      preferred: preferredKeys.slice(0, 12),
      at: new Date().toISOString()
    };
    globalThis.__NOVA_BRAIN_LAST__ = brain;
    return {
      response: { text: () => winner.text },
      __novaAtomicRouteKey: brain.routeKey,
      __novaAtomicBrain: brain
    };
  } catch (aggregate) {
    const error = new Error(`ACRM/ARIM ${capability} lane ${lane} failed across ${selected.length} route(s).`);
    error.cause = aggregate;
    error.__novaAtomicFailures = Array.isArray(aggregate?.errors)
      ? aggregate.errors.map(item => item?.__novaAtomicFailure).filter(Boolean)
      : [];
    reportBackendFailures(error.__novaAtomicFailures, capability);
    throw error;
  }
}

export function atomicBrainMemorySnapshot() {
  loadMemory();
  return [...memory.entries()].map(([key, value]) => ({ key, ...value }));
}
