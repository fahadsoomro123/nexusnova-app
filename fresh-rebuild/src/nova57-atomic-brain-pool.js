// NOVA 5.7 ACRM — explicit fast brain pool.
// Keeps only route health/latency counters in localStorage; never stores prompts.
// The pool can absorb dynamically discovered Kilo/OVH routes published by the
// keyless router, while known-good routes provide a cold-start safety net.

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
  const msg = String(error?.message || error || '').toLowerCase();
  if (status === 429 || /rate.?limit|quota/.test(msg)) return 'rate-limit';
  if (status === 401 || status === 403 || /auth|forbidden/.test(msg)) return 'auth';
  if (/timeout|abort/.test(msg)) return 'timeout';
  if (/no usable text|empty/.test(msg)) return 'empty';
  return 'failed';
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
  const raw = Array.isArray(globalThis.__NOVA_KEYLESS_ROUTE_POOL__)
    ? globalThis.__NOVA_KEYLESS_ROUTE_POOL__
    : [];
  const out = [];
  for (const value of raw) {
    const text = String(value || '');
    const split = text.indexOf(':');
    if (split <= 0) continue;
    const provider = text.slice(0, split);
    const model = text.slice(split + 1);
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

function routeScore(route, capability) {
  const s = stat(route);
  const attempts = s.ok + s.fail;
  const successRate = attempts ? s.ok / attempts : 0.5;
  const freshness = s.lastOk && Date.now() - s.lastOk < 15 * 60_000 ? 20 : 0;
  const latencyPenalty = s.ewma ? Math.min(42, s.ewma / 120) : 0;
  const failurePenalty = Math.min(35, s.fail * 4);
  return route.priority + fitBonus(route, capability) + freshness + successRate * 24 - latencyPenalty - failurePenalty;
}

export function atomicCandidates(capability = 'general', excludeKeys = []) {
  loadMemory();
  const excluded = new Set(excludeKeys || []);
  return dedupe([...KNOWN_FAST, ...dynamicRoutes()])
    .filter(route => !excluded.has(keyOf(route)) && !isQuarantined(route))
    .sort((a, b) => routeScore(b, capability) - routeScore(a, capability));
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
      body: JSON.stringify({
        model: route.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        stream: false
      })
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
    const text = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content.map(part => typeof part === 'string' ? part : String(part?.text || part?.content || '')).join('').trim()
        : '';
    if (!text) throw new Error(`${route.provider}/${route.model} returned no usable text.`);
    const latencyMs = Date.now() - started;
    markSuccess(route, latencyMs);
    return { text, route, latencyMs };
  } catch (error) {
    markFailure(route, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function runAtomicBrain(prompt, options = {}, control = {}) {
  const capability = String(control.capability || 'general');
  const excludeKeys = Array.isArray(control.excludeKeys) ? control.excludeKeys : [];
  const timeoutMs = Math.max(900, Math.min(5200, Number(control.timeoutMs || 3600)));
  const candidates = atomicCandidates(capability, excludeKeys);
  if (!candidates.length) throw new Error(`No healthy ACRM ${capability} candidates.`);

  // Two-route staggered hedge: a dead first route does not consume the whole
  // foreground deadline before the next brain gets a chance.
  const selected = candidates.slice(0, Math.min(2, candidates.length));
  const started = Date.now();
  const attempts = selected.map((route, index) => callRoute(route, prompt, options, timeoutMs, index * 110));
  try {
    const winner = await Promise.any(attempts);
    globalThis.__NOVA_BRAIN_LAST__ = {
      provider: winner.route.provider,
      model: winner.route.model,
      attempts: selected.length,
      latencyMs: winner.latencyMs,
      wallMs: Date.now() - started,
      profile: capability,
      adaptive: true,
      atomic: true,
      selected: selected.map(keyOf),
      at: new Date().toISOString()
    };
    return {
      response: { text: () => winner.text },
      __novaAtomicRouteKey: keyOf(winner.route)
    };
  } catch (aggregate) {
    const error = new Error(`ACRM ${capability} hedge failed across ${selected.length} route(s).`);
    error.cause = aggregate;
    throw error;
  }
}

export function atomicBrainMemorySnapshot() {
  loadMemory();
  return [...memory.entries()].map(([key, value]) => ({ key, ...value }));
}
