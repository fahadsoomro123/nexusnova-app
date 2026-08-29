// NOVA 5.7 Pro — low-latency hedge + hard-reasoning jury layer.
// Quick/standard requests stay fast. Hard requests collect several stronger free
// candidates and prefer consensus/quality instead of blindly accepting the first
// response. Mechanically verifiable ordering puzzles are solved locally first.
// No provider API key or secret is embedded.

import {
  GoogleAIBackend as BaseGoogleAIBackend,
  getAI as baseGetAI,
  getGenerativeModel as baseGetGenerativeModel
} from './nova57-pro-keyless-router.js';

const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const FAST_MODELS = [
  'poolside/laguna-xs-2.1:free',
  'poolside/laguna-s-2.1:free',
  'stepfun/step-3.7-flash:free',
  'kilo-auto/free',
  'openrouter/free',
  'tencent/hy3:free'
];
const HARD_MODELS = [
  'stepfun/step-3.7-flash:free',
  'openrouter/free',
  'tencent/hy3:free',
  'kilo-auto/free',
  'poolside/laguna-s-2.1:free',
  'poolside/laguna-xs-2.1:free'
];
const circuit = new Map();
const perf = new Map();
let lastGood = '';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function systemText(options = {}) {
  const parts = options?.systemInstruction?.parts;
  return Array.isArray(parts) ? parts.map(part => String(part?.text || '')).filter(Boolean).join('\n') : '';
}

function config(options = {}) {
  const source = options?.generationConfig || {};
  return {
    temperature: Math.max(0.1, Math.min(1.1, Number(source.temperature ?? 0.45))),
    maxTokens: Math.max(96, Math.min(900, Number(source.maxOutputTokens ?? 700)))
  };
}

function profile(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (text.includes('[live nova web tool result]')) return 'grounded';
  if (text.length > 4200 || /\b(reason|reasoning|logic|constraints?|research|github|tool result|architecture|debug|algorithm|analy[sz]e|prove|derive|puzzle|schedule|positions?|permutation|unique order)\b/.test(text) || /must occupy positions|exactly once|immediately after|exactly two positions/i.test(text)) return 'hard';
  return text.length < 650 ? 'quick' : 'standard';
}

function timeoutFor(kind) {
  if (kind === 'quick') return 3200;
  if (kind === 'grounded') return 2200;
  if (kind === 'hard') return 4600;
  return 4200;
}

function hardQuality(model) {
  if (model === 'stepfun/step-3.7-flash:free') return 60;
  if (model === 'openrouter/free') return 52;
  if (model === 'tencent/hy3:free') return 44;
  if (model === 'kilo-auto/free') return 32;
  if (model === 'poolside/laguna-s-2.1:free') return 10;
  return 4;
}

function modelScore(model, mode) {
  const s = perf.get(model) || { ok: 0, fail: 0, ewma: 0, lastOk: 0 };
  const good = model === lastGood ? (mode === 'hard' ? 18 : 100) : 0;
  const fresh = s.lastOk && Date.now() - s.lastOk < 10 * 60_000 ? 18 : 0;
  const latency = s.ewma ? Math.min(35, s.ewma / 180) : 0;
  const order = mode === 'hard' ? HARD_MODELS : FAST_MODELS;
  const orderPenalty = Math.max(0, order.indexOf(model)) * 2;
  const quality = mode === 'hard' ? hardQuality(model) : 0;
  return good + fresh + quality + s.ok * 3 - s.fail * 8 - latency - orderPenalty;
}

function availableModels(mode) {
  const now = Date.now();
  const order = mode === 'hard' ? HARD_MODELS : FAST_MODELS;
  return order
    .filter(model => (circuit.get(model) || 0) <= now)
    .sort((a, b) => modelScore(b, mode) - modelScore(a, mode));
}

function markSuccess(model, ms) {
  const s = perf.get(model) || { ok: 0, fail: 0, ewma: 0, lastOk: 0 };
  s.ok += 1;
  s.ewma = s.ewma ? s.ewma * 0.7 + ms * 0.3 : ms;
  s.lastOk = Date.now();
  perf.set(model, s);
  circuit.delete(model);
  lastGood = model;
}

function markFailure(model, error) {
  const s = perf.get(model) || { ok: 0, fail: 0, ewma: 0, lastOk: 0 };
  s.fail += 1;
  perf.set(model, s);
  const text = String(error?.message || error || '').toLowerCase();
  const status = Number(error?.status || 0);
  let wait = 20_000;
  if (status === 429 || /rate.?limit|quota/.test(text)) wait = 75_000;
  else if (status === 401 || status === 403 || /auth|forbidden/.test(text)) wait = 180_000;
  else if (/abort|timeout/.test(text)) wait = 30_000;
  circuit.set(model, Date.now() + wait);
}

async function callKilo(model, prompt, options, timeoutMs, delayMs = 0) {
  if (delayMs) await sleep(delayMs);
  const cfg = config(options);
  const messages = [];
  const system = systemText(options);
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: String(prompt || '') });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${KILO_BASE}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: cfg.temperature, max_tokens: cfg.maxTokens, stream: false })
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { text: raw }; }
    if (!response.ok) {
      const error = new Error(String(data?.error?.message || data?.message || data?.error || raw || `HTTP ${response.status}`).slice(0, 400));
      error.status = response.status;
      throw error;
    }
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.text;
    const text = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content.map(part => typeof part === 'string' ? part : String(part?.text || part?.content || '')).join('').trim()
        : '';
    if (!text) throw new Error(`${model} returned no usable text.`);
    const latencyMs = Date.now() - started;
    markSuccess(model, latencyMs);
    return { text, model, latencyMs };
  } catch (error) {
    markFailure(model, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizedAnswer(text) {
  return String(text || '')
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/i, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function shortConstrainedOutput(prompt, answer) {
  const request = String(prompt || '').toLowerCase();
  return answer.length <= 96 && /\b(return|answer|output)\s+(?:only|just)\b|no\s+(?:spaces?|explanation|words?)/i.test(request);
}

function deterministicOrderingSolution(prompt) {
  const source = String(prompt || '');
  const occupy = source.match(/(?:tasks?|items?|letters?)\s+([A-Z](?:[\s,]+[A-Z]){2,})\s+must\s+occupy\s+positions?\s+1\s+(?:through|to|-)\s+(\d+)\s+exactly\s+once/i);
  if (!occupy) return null;

  const symbols = [...new Set((occupy[1].match(/\b[A-Z]\b/g) || []).map(x => x.toUpperCase()))];
  const count = Number(occupy[2]);
  if (count < 3 || count > 8 || symbols.length !== count) return null;

  const allowed = new Set(symbols);
  const rules = [];
  const addPairRule = (regex, fn) => {
    for (const match of source.matchAll(regex)) {
      const a = String(match[1] || '').toUpperCase();
      const b = String(match[2] || '').toUpperCase();
      if (allowed.has(a) && allowed.has(b)) rules.push(index => fn(index.get(a), index.get(b)));
    }
  };

  addPairRule(/\b([A-Z])\s+is\s+immediately\s+after\s+([A-Z])\b/gi, (a, b) => a === b + 1);
  addPairRule(/\b([A-Z])\s+is\s+immediately\s+before\s+([A-Z])\b/gi, (a, b) => a + 1 === b);
  addPairRule(/\b([A-Z])\s+is\s+before\s+([A-Z])\b/gi, (a, b) => a < b);
  addPairRule(/\b([A-Z])\s+is\s+after\s+([A-Z])\b/gi, (a, b) => a > b);
  addPairRule(/\b([A-Z])\s+is\s+adjacent\s+to\s+([A-Z])\b/gi, (a, b) => Math.abs(a - b) === 1);

  const distance = value => {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
    const key = String(value || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(words, key) ? words[key] : Number(key);
  };

  for (const match of source.matchAll(/\b([A-Z])\s+is\s+exactly\s+(\d+|one|two|three|four|five|six|seven|eight)\s+positions?\s+after\s+([A-Z])\b/gi)) {
    const a = String(match[1] || '').toUpperCase();
    const gap = distance(match[2]);
    const b = String(match[3] || '').toUpperCase();
    if (allowed.has(a) && allowed.has(b) && Number.isFinite(gap)) rules.push(index => index.get(a) === index.get(b) + gap);
  }
  for (const match of source.matchAll(/\b([A-Z])\s+is\s+exactly\s+(\d+|one|two|three|four|five|six|seven|eight)\s+positions?\s+before\s+([A-Z])\b/gi)) {
    const a = String(match[1] || '').toUpperCase();
    const gap = distance(match[2]);
    const b = String(match[3] || '').toUpperCase();
    if (allowed.has(a) && allowed.has(b) && Number.isFinite(gap)) rules.push(index => index.get(a) + gap === index.get(b));
  }
  for (const match of source.matchAll(/\b([A-Z])\s+is\s+neither\s+first\s+nor\s+last\b/gi)) {
    const a = String(match[1] || '').toUpperCase();
    if (allowed.has(a)) rules.push(index => index.get(a) !== 0 && index.get(a) !== count - 1);
  }
  for (const match of source.matchAll(/\b([A-Z])\s+is\s+not\s+first\b/gi)) {
    const a = String(match[1] || '').toUpperCase();
    if (allowed.has(a)) rules.push(index => index.get(a) !== 0);
  }
  for (const match of source.matchAll(/\b([A-Z])\s+is\s+not\s+last\b/gi)) {
    const a = String(match[1] || '').toUpperCase();
    if (allowed.has(a)) rules.push(index => index.get(a) !== count - 1);
  }
  if (rules.length < 2) return null;

  const solutions = [];
  const used = new Set();
  const order = [];
  const visit = () => {
    if (solutions.length > 1) return;
    if (order.length === count) {
      const index = new Map(order.map((value, i) => [value, i]));
      if (rules.every(rule => rule(index))) solutions.push(order.join(''));
      return;
    }
    for (const symbol of symbols) {
      if (used.has(symbol)) continue;
      used.add(symbol);
      order.push(symbol);
      visit();
      order.pop();
      used.delete(symbol);
      if (solutions.length > 1) return;
    }
  };
  visit();
  return solutions.length === 1 ? solutions[0] : null;
}

async function hardJury(prompt, options = {}) {
  const timeoutMs = timeoutFor('hard');
  const models = availableModels('hard').slice(0, 4);
  if (!models.length) throw new Error('No hard-reasoning routes are healthy.');

  const source = options?.generationConfig || {};
  const hardOptions = {
    ...options,
    generationConfig: {
      ...source,
      temperature: Math.min(0.22, Number(source.temperature ?? 0.22)),
      maxOutputTokens: Math.max(220, Math.min(900, Number(source.maxOutputTokens ?? 700)))
    }
  };

  const started = Date.now();
  const settled = await Promise.allSettled(
    models.map((model, index) => callKilo(model, prompt, hardOptions, timeoutMs, index * 70))
  );
  const good = settled
    .filter(item => item.status === 'fulfilled')
    .map(item => item.value);
  if (!good.length) throw new Error(`Hard jury failed across ${models.length} route(s).`);

  const groups = new Map();
  for (const item of good) {
    const key = normalizedAnswer(item.text);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const consensus = [...groups.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return hardQuality(b[0].model) - hardQuality(a[0].model);
  })[0];

  let winner;
  const consensusText = normalizedAnswer(consensus?.[0]?.text || '');
  if (consensus && consensus.length >= 2 && shortConstrainedOutput(prompt, consensusText)) {
    winner = consensus.slice().sort((a, b) => hardQuality(b.model) - hardQuality(a.model))[0];
  } else {
    winner = good.slice().sort((a, b) => {
      const qualityDelta = hardQuality(b.model) - hardQuality(a.model);
      return qualityDelta || a.latencyMs - b.latencyMs;
    })[0];
  }

  globalThis.__NOVA_BRAIN_LAST__ = {
    provider: 'Kilo',
    model: winner.model,
    attempts: models.length,
    successfulCandidates: good.length,
    latencyMs: winner.latencyMs,
    wallMs: Date.now() - started,
    profile: 'hard',
    hedged: models.length > 1,
    jury: true,
    consensus: Boolean(consensus && consensus.length >= 2),
    selected: models,
    at: new Date().toISOString()
  };
  return winner.text;
}

async function fastHedge(prompt, options = {}) {
  const mode = profile(prompt);
  const timeoutMs = timeoutFor(mode);
  const models = availableModels(mode);
  if (!models.length) throw new Error('No fast anonymous routes are healthy.');

  const width = lastGood ? 1 : Math.min(2, models.length);
  const selected = models.slice(0, width);
  const started = Date.now();
  const promises = selected.map((model, index) => callKilo(model, prompt, options, timeoutMs, index * 160));
  try {
    const winner = await Promise.any(promises);
    globalThis.__NOVA_BRAIN_LAST__ = {
      provider: 'Kilo',
      model: winner.model,
      attempts: selected.length,
      latencyMs: winner.latencyMs,
      wallMs: Date.now() - started,
      profile: mode,
      hedged: selected.length > 1,
      jury: false,
      selected,
      at: new Date().toISOString()
    };
    return winner.text;
  } catch (aggregate) {
    const error = new Error(`Fast hedge failed across ${selected.length} route(s).`);
    error.cause = aggregate;
    throw error;
  }
}

async function boundedFallback(baseModel, prompt, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      baseModel.generateContent(prompt),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Broad adaptive fallback exceeded ${timeoutMs}ms foreground deadline.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class GoogleAIBackend extends BaseGoogleAIBackend {}

export function getAI(firebaseApp, config = {}) {
  const base = baseGetAI(firebaseApp, config);
  return { ...base, __novaHedgeRouter: true, __novaHardJury: true, __novaDeterministicConstraints: true };
}

export function getGenerativeModel(ai, options = {}) {
  const baseModel = baseGetGenerativeModel(ai, options);
  return {
    async generateContent(prompt) {
      const mode = profile(prompt);
      if (mode === 'hard') {
        const started = Date.now();
        const exact = deterministicOrderingSolution(prompt);
        if (exact) {
          const latencyMs = Date.now() - started;
          globalThis.__NOVA_BRAIN_LAST__ = {
            provider: 'NOVA Local',
            model: 'deterministic-constraint-solver',
            attempts: 1,
            successfulCandidates: 1,
            latencyMs,
            wallMs: latencyMs,
            profile: 'hard',
            hedged: false,
            jury: false,
            deterministic: true,
            verified: true,
            at: new Date().toISOString()
          };
          return { response: { text: () => exact } };
        }
      }

      try {
        const text = mode === 'hard'
          ? await hardJury(prompt, options)
          : await fastHedge(prompt, options);
        return { response: { text: () => text } };
      } catch (fastError) {
        if (mode === 'grounded') {
          console.warn('[NOVA Hedge] grounded answer route unavailable; returning control to evidence-safe orchestrator fallback.', fastError);
          throw fastError;
        }
        if (mode === 'hard') {
          console.warn('[NOVA Hedge] hard foreground routes unavailable; trying deadline-capped broad adaptive router.', fastError);
          return boundedFallback(baseModel, prompt, 2600);
        }
        const fallbackMs = mode === 'quick' ? 2200 : 3200;
        console.warn(`[NOVA Hedge] ${mode} foreground routes unavailable; using deadline-capped broad adaptive router.`, fastError);
        return boundedFallback(baseModel, prompt, fallbackMs);
      }
    }
  };
}
