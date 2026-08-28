// NOVA 5.7 Sol — 10-brain practical free-router sample.
// This module intentionally mirrors the tiny Firebase AI surface used by
// nova-sol57-fresh.js so the phone UI and renderer do not need to change.
// Primary pool: up to 10 currently-active AI Horde text models (anonymous,
// community-powered). Last-resort fallback: the existing Firebase AI module.

const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_ANON_KEY = '0000000000';
const CLIENT_AGENT = 'NexusNova:5.7-sol:10brain-sample';
const POOL_SIZE = 10;
const MODEL_TIMEOUT_MS = 9_000;
const TOTAL_TIMEOUT_MS = 48_000;
const POLL_MS = 1_250;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || min));

function modelName(row) {
  return String(row?.name || row?.model || '').trim();
}

function modelScore(row) {
  const name = modelName(row).toLowerCase();
  const quality =
    (/qwen/.test(name) ? 120 : 0) +
    (/deepseek/.test(name) ? 115 : 0) +
    (/gemma/.test(name) ? 105 : 0) +
    (/llama/.test(name) ? 100 : 0) +
    (/mistral|mixtral/.test(name) ? 95 : 0) +
    (/coder|code|instruct/.test(name) ? 45 : 0) -
    (/roleplay|rp-|nsfw|uncensored|erp/.test(name) ? 70 : 0);
  const workers = Number(row?.count ?? row?.workers ?? row?.worker_count ?? 0) || 0;
  const performance = Number(row?.performance ?? 0) || 0;
  const queued = Number(row?.queued ?? row?.queued_jobs ?? row?.queue ?? 0) || 0;
  const eta = Number(row?.eta ?? 0) || 0;
  return quality + workers * 18 + Math.min(performance, 200) * 0.1 - queued * 2 - Math.min(eta, 300) * 0.2;
}

async function jsonFetch(url, init = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!response.ok) {
      const error = new Error(String(data?.message || data?.error || `HTTP ${response.status}`));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function activeBrainPool() {
  const rows = await jsonFetch(`${HORDE_BASE}/status/models?type=text`, {
    headers: { 'Client-Agent': CLIENT_AGENT }
  }, 7_000);
  const list = Array.isArray(rows) ? rows : [];
  const unique = new Map();
  for (const row of list) {
    const name = modelName(row);
    if (!name || unique.has(name)) continue;
    unique.set(name, row);
  }
  return [...unique.values()]
    .sort((a, b) => modelScore(b) - modelScore(a))
    .slice(0, POOL_SIZE)
    .map(row => ({ name: modelName(row), score: modelScore(row) }));
}

function hordeParams(options = {}) {
  const cfg = options?.generationConfig || {};
  return {
    max_length: clamp(cfg.maxOutputTokens ?? 700, 64, 700),
    max_context_length: 4096,
    temperature: clamp(cfg.temperature ?? 0.5, 0.1, 1.2),
    top_p: 0.92,
    top_k: 40,
    rep_pen: 1.05,
    stop_sequence: ['\nUser:', '\nNOVA 5.7 Sol:']
  };
}

function systemText(options = {}) {
  const parts = options?.systemInstruction?.parts;
  return Array.isArray(parts)
    ? parts.map(part => String(part?.text || '')).filter(Boolean).join('\n')
    : '';
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

async function runHordeBrain(model, prompt, options, deadline) {
  const sys = systemText(options);
  const finalPrompt = `${sys ? `${sys}\n\n` : ''}${String(prompt || '').trim()}\n\nNOVA 5.7 Sol:`;
  const submit = await jsonFetch(`${HORDE_BASE}/generate/text/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': HORDE_ANON_KEY,
      'Client-Agent': CLIENT_AGENT
    },
    body: JSON.stringify({
      prompt: finalPrompt,
      params: hordeParams(options),
      models: [model.name],
      trusted_workers: false,
      slow_workers: true,
      dry_run: false
    })
  }, 8_000);

  const id = String(submit?.id || '').trim();
  if (!id) throw new Error('AI Horde did not return a generation id.');
  const started = Date.now();
  try {
    while (Date.now() - started < MODEL_TIMEOUT_MS && Date.now() < deadline) {
      await sleep(POLL_MS);
      const status = await jsonFetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, {
        headers: { 'Client-Agent': CLIENT_AGENT }
      }, 5_000);
      const generations = Array.isArray(status?.generations) ? status.generations : [];
      const text = String(generations[0]?.text || '').trim();
      if (text) return text;
      if (status?.faulted === true) throw new Error('AI Horde worker faulted.');
      if (status?.is_possible === false) throw new Error('AI Horde model is not currently possible.');
      if (status?.done === true) throw new Error('AI Horde completed without usable text.');
    }
    throw new Error('AI Horde brain timed out; switching brain.');
  } finally {
    if (Date.now() - started >= MODEL_TIMEOUT_MS || Date.now() >= deadline) {
      cancelHorde(id);
    }
  }
}

async function runTenBrainRouter(prompt, options = {}) {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const pool = await activeBrainPool();
  if (!pool.length) throw new Error('No AI Horde text brains are active right now.');

  const attempts = [];
  globalThis.__NOVA_10_BRAIN_POOL__ = pool.map(x => x.name);

  for (const brain of pool) {
    if (Date.now() >= deadline) break;
    try {
      const text = await runHordeBrain(brain, prompt, options, deadline);
      if (!text) throw new Error('Empty brain response.');
      globalThis.__NOVA_BRAIN_LAST__ = {
        provider: 'AI Horde',
        model: brain.name,
        poolSize: pool.length,
        attempts: attempts.length + 1,
        at: new Date().toISOString()
      };
      console.info('[NOVA 10-Brain] success', globalThis.__NOVA_BRAIN_LAST__);
      return text;
    } catch (error) {
      attempts.push({ model: brain.name, error: String(error?.message || error) });
      console.warn('[NOVA 10-Brain] switching', brain.name, error);
    }
  }

  const error = new Error(`All ${pool.length} active free brains failed or timed out.`);
  error.attempts = attempts;
  throw error;
}

let originalFirebaseAI = null;
async function originalProvider() {
  if (!originalFirebaseAI) {
    // The query string bypasses the exact import-map key used for this shim.
    originalFirebaseAI = import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js?nova-original=1');
  }
  return originalFirebaseAI;
}

export class GoogleAIBackend {
  constructor(...args) { this.args = args; }
}

export function getAI(firebaseApp, config = {}) {
  return { firebaseApp, config, __novaRouter: true };
}

export function getGenerativeModel(ai, options = {}) {
  return {
    async generateContent(prompt) {
      try {
        const text = await runTenBrainRouter(prompt, options);
        return { response: { text: () => text } };
      } catch (routerError) {
        console.warn('[NOVA 10-Brain] free pool unavailable; trying existing Firebase AI.', routerError);
        try {
          const mod = await originalProvider();
          const originalAI = mod.getAI(ai?.firebaseApp, ai?.config || { backend: new mod.GoogleAIBackend() });
          const originalModel = mod.getGenerativeModel(originalAI, options);
          return await originalModel.generateContent(prompt);
        } catch (firebaseError) {
          const error = new Error(`10-brain router failed: ${routerError?.message || routerError}; Firebase fallback failed: ${firebaseError?.message || firebaseError}`);
          error.cause = firebaseError;
          throw error;
        }
      }
    }
  };
}

export async function getNova10BrainStatus() {
  const pool = await activeBrainPool();
  return { provider: 'AI Horde', activeBrains: pool.length, brains: pool.map(x => x.name) };
}
