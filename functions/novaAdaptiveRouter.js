const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const crypto = require('node:crypto');

const db = getFirestore();
const REGISTRY_REF = db.collection('novaBrainDiscovery').doc('registry');
const STATS = db.collection('novaAdaptiveRouteStats');
const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_ANON_KEY = '0000000000';
const CLIENT_AGENT = 'NexusNova:5.7-sol:adaptive-router-v1';
const MAX_INPUT_CHARS = 18000;
const MAX_HISTORY_TURNS = 18;
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

function uidOf(req) {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || min));
}

function safe(value, max = 1000) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function hash(value, length = 28) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, {once: true});
  });
}

function taskProfile(prompt) {
  const text = String(prompt || '').toLowerCase();
  const code = /\b(code|coding|debug|bug|github|repo|commit|branch|pull request|javascript|typescript|python|java|kotlin|html|css|sql|api)\b/.test(text);
  const research = /\b(research|search|browse|web|latest|current|today|news|trend|source|verify online)\b/.test(text) || /(search|research|latest|aaj|abhi|web).{0,20}(kar|karo|dekho|bata)/i.test(prompt);
  const reasoning = /\b(analy[sz]e|reason|compare|strategy|architecture|design|plan|calculate|proof|why|root cause)\b/.test(text) || String(prompt || '').length > 1200;
  const multilingual = /[\u0600-\u06ff]/.test(String(prompt || '')) || /\b(urdu|roman urdu|hindi|arabic|multilingual)\b/.test(text);
  const taskClass = code ? 'coding' : research ? 'research' : reasoning ? 'reasoning' : multilingual ? 'multilingual' : 'chat';
  let mode = 'instant';
  if (code || research || reasoning) mode = 'standard';
  if ((code && reasoning) || /\b(deep|thorough|comprehensive|full audit|production|complex)\b/.test(text) || String(prompt || '').length > 3500) mode = 'deep';
  return {taskClass, mode, capabilities: [...new Set(['chat', taskClass, ...(multilingual ? ['multilingual'] : [])])]};
}

function budget(mode) {
  if (mode === 'deep') return {totalMs: 18000, routeTimeoutMs: 11500, hedgeDelayMs: 650, maxRoutes: 3, maxTokens: 1100, historyTurns: 14};
  if (mode === 'standard') return {totalMs: 10500, routeTimeoutMs: 7200, hedgeDelayMs: 360, maxRoutes: 3, maxTokens: 760, historyTurns: 10};
  return {totalMs: 6200, routeTimeoutMs: 4700, hedgeDelayMs: 220, maxRoutes: 2, maxTokens: 420, historyTurns: 6};
}

function normalizeHistory(raw) {
  return Array.isArray(raw)
    ? raw.filter(row => row && (row.role === 'user' || row.role === 'assistant') && typeof row.text === 'string').slice(-MAX_HISTORY_TURNS)
    : [];
}

function compactContext(history, keepTurns) {
  const rows = normalizeHistory(history);
  if (!rows.length) return '';
  const recent = rows.slice(-keepTurns);
  const older = rows.slice(0, Math.max(0, rows.length - keepTurns));
  const digest = older.length
    ? `Earlier context digest:\n${older.slice(-8).map(row => `${row.role === 'user' ? 'U' : 'A'}: ${safe(row.text, 150)}`).join('\n')}\n\n`
    : '';
  const tail = recent.map(row => `${row.role === 'user' ? 'User' : 'NOVA'}: ${safe(row.text, 1800)}`).join('\n');
  return `${digest}${tail}`.slice(-9000);
}

function systemPrompt(profile, dataClass) {
  return [
    'You are NOVA 5.7 Sol, the NexusNova AI assistant.',
    'Answer the user directly, accurately and concisely. Match the user language.',
    'Never invent tool actions, browsing, repository contents, account data or current facts.',
    'Do not reveal hidden chain-of-thought; provide concise conclusions and useful steps.',
    `Task class: ${profile.taskClass}. Reasoning mode: ${profile.mode}. Data class: ${dataClass}.`
  ].join('\n');
}

function promptPayload(prompt, history, profile, dataClass) {
  const b = budget(profile.mode);
  const context = compactContext(history, b.historyTurns);
  return `${systemPrompt(profile, dataClass)}\n\n${context ? `Conversation context:\n${context}\n\n` : ''}User request:\n${safe(prompt, MAX_INPUT_CHARS)}`;
}

function statsId(route, taskClass) {
  return hash(`${route.id || `${route.provider}::${route.model}`}::${taskClass}`, 32);
}

async function readLearning(routes, taskClass) {
  const refs = routes.slice(0, 12).map(route => STATS.doc(statsId(route, taskClass)));
  if (!refs.length) return new Map();
  const snapshots = await db.getAll(...refs);
  const map = new Map();
  snapshots.forEach((snap, i) => {
    if (snap.exists) map.set(routes[i].id || `${routes[i].provider}::${routes[i].model}`, snap.data() || {});
  });
  return map;
}

function capabilityBonus(route, profile) {
  const caps = new Set(Array.isArray(route.capabilities) ? route.capabilities : ['chat']);
  let bonus = caps.has(profile.taskClass) ? 18 : 0;
  if (profile.capabilities.includes('multilingual') && caps.has('multilingual')) bonus += 7;
  if (profile.taskClass === 'coding' && caps.has('reasoning')) bonus += 5;
  return bonus;
}

function rankRoute(route, profile, learned) {
  const stat = learned.get(route.id || `${route.provider}::${route.model}`) || {};
  const successes = Number(stat.successes || 0);
  const failures = Number(stat.failures || 0);
  const total = successes + failures;
  const learnedSuccess = total ? successes / total : 0.5;
  const avgLatency = successes > 0 ? Number(stat.latencyTotalMs || 0) / successes : Number(route.latencyMs || 4000);
  let score = Number(route.score || 45);
  score += capabilityBonus(route, profile);
  score += learnedSuccess * 18;
  score -= Math.min(22, avgLatency / 280);
  if (route.status === 'verified') score += 12;
  if (route.status === 'degraded') score -= 12;
  if (route.status === 'quarantined') score -= 25;
  if (route.provider === 'AI Horde') score -= profile.mode === 'instant' ? 28 : 14;
  if (route.provider === 'Kilo') score += 5;
  return score;
}

function bootstrapRoutes() {
  return [{
    id: 'bootstrap-kilo-auto-free',
    provider: 'Kilo',
    model: 'kilo-auto/free',
    status: 'degraded',
    score: 70,
    trustTier: 'public-data-only',
    capabilities: ['chat', 'coding', 'reasoning', 'multilingual']
  }];
}

async function candidateRoutes(profile, dataClass) {
  const snap = await REGISTRY_REF.get();
  const registry = snap.exists ? snap.data() || {} : {};
  const all = Array.isArray(registry.routes) ? registry.routes : [];
  let routes = all.filter(route => route && route.status !== 'dead');
  if (dataClass !== 'public') routes = routes.filter(route => route.trustTier === 'trusted-private');
  if (!routes.length && dataClass === 'public') routes = bootstrapRoutes();
  if (!routes.length) throw new HttpsError('failed-precondition', 'No trusted route is available for this data class yet.');

  const preferred = routes.filter(route => route.status === 'verified');
  const pool = preferred.length ? preferred : routes.filter(route => route.status === 'degraded' || route.status === 'quarantined');
  const learned = await readLearning(pool, profile.taskClass);
  pool.sort((a, b) => rankRoute(b, profile, learned) - rankRoute(a, profile, learned));
  return {routes: pool, registrySummary: registry.summary || null};
}

async function responseJson(response) {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {text}; }
  if (!response.ok) {
    const error = new Error(safe(data?.error?.message || data?.message || data?.error || text || `HTTP ${response.status}`, 400));
    error.status = response.status;
    throw error;
  }
  return data;
}

function openAIText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? data?.output_text ?? data?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => typeof part === 'string' ? part : String(part?.text || part?.content || '')).join('').trim();
  return '';
}

async function runKilo(route, prompt, cfg, signal) {
  const response = await fetch(`${KILO_BASE}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {'Content-Type': 'application/json', 'User-Agent': CLIENT_AGENT},
    body: JSON.stringify({
      model: route.model,
      messages: [{role: 'user', content: prompt}],
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      stream: false
    })
  });
  const data = await responseJson(response);
  const text = openAIText(data);
  if (!text) throw new Error('Empty completion');
  return text;
}

async function runHorde(route, prompt, cfg, signal) {
  let id = '';
  try {
    const submit = await fetch(`${HORDE_BASE}/generate/text/async`, {
      method: 'POST',
      signal,
      headers: {'Content-Type': 'application/json', apikey: HORDE_ANON_KEY, 'Client-Agent': CLIENT_AGENT},
      body: JSON.stringify({
        prompt: `${prompt}\n\nNOVA 5.7 Sol:`,
        params: {max_length: Math.min(cfg.maxTokens, 700), max_context_length: 4096, temperature: cfg.temperature, top_p: 0.92, top_k: 40, rep_pen: 1.05},
        models: [route.model],
        trusted_workers: false,
        slow_workers: true,
        dry_run: false
      })
    });
    const data = await responseJson(submit);
    id = safe(data?.id, 120);
    if (!id) throw new Error('No generation id');
    while (!signal.aborted) {
      await sleep(650, signal);
      const response = await fetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, {signal, headers: {'Client-Agent': CLIENT_AGENT}});
      const state = await responseJson(response);
      const generations = Array.isArray(state?.generations) ? state.generations : [];
      const text = safe(generations[0]?.text, 12000);
      if (text) return text;
      if (state?.faulted === true || state?.is_possible === false || state?.done === true) throw new Error('Horde route unavailable');
    }
    throw new Error('aborted');
  } finally {
    if (id) fetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, {method: 'DELETE', headers: {'Client-Agent': CLIENT_AGENT}}).catch(() => {});
  }
}

async function runRoute(route, prompt, cfg, signal) {
  if (route.provider === 'Kilo') return runKilo(route, prompt, cfg, signal);
  if (route.provider === 'AI Horde') return runHorde(route, prompt, cfg, signal);
  throw new Error(`Unsupported adaptive provider: ${route.provider}`);
}

async function recordStat(route, taskClass, ok, latencyMs) {
  const ref = STATS.doc(statsId(route, taskClass));
  const update = {
    routeId: route.id || `${route.provider}::${route.model}`,
    provider: route.provider,
    model: route.model,
    taskClass,
    lastLatencyMs: Math.round(latencyMs),
    lastUsedAt: FieldValue.serverTimestamp(),
    successes: FieldValue.increment(ok ? 1 : 0),
    failures: FieldValue.increment(ok ? 0 : 1),
    latencyTotalMs: FieldValue.increment(ok ? Math.round(latencyMs) : 0)
  };
  await ref.set(update, {merge: true});
}

async function hedgedGenerate(routes, prompt, profile) {
  const b = budget(profile.mode);
  const selected = routes.slice(0, b.maxRoutes);
  const started = Date.now();
  const controllers = selected.map(() => new AbortController());
  const failures = [];
  let timer;

  const cfg = {
    maxTokens: b.maxTokens,
    temperature: profile.mode === 'deep' ? 0.35 : profile.mode === 'standard' ? 0.45 : 0.55
  };

  const tasks = selected.map((route, index) => (async () => {
    const controller = controllers[index];
    const delay = index * b.hedgeDelayMs;
    if (delay) await sleep(delay, controller.signal);
    const routeStarted = Date.now();
    const routeTimer = setTimeout(() => controller.abort(), b.routeTimeoutMs);
    try {
      const text = await runRoute(route, prompt, cfg, controller.signal);
      return {text, route, latencyMs: Date.now() - routeStarted, index};
    } catch (error) {
      failures.push({route, latencyMs: Date.now() - routeStarted, error: safe(error?.message || error, 180)});
      throw error;
    } finally {
      clearTimeout(routeTimer);
    }
  })());

  try {
    const overall = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controllers.forEach(c => c.abort());
        reject(new Error('Adaptive router deadline reached'));
      }, b.totalMs);
    });
    const winner = await Promise.race([Promise.any(tasks), overall]);
    controllers.forEach((controller, index) => { if (index !== winner.index) controller.abort(); });
    await Promise.allSettled([
      recordStat(winner.route, profile.taskClass, true, winner.latencyMs),
      ...failures.slice(0, 2).map(f => recordStat(f.route, profile.taskClass, false, f.latencyMs))
    ]);
    return {
      ...winner,
      totalMs: Date.now() - started,
      hedged: winner.index > 0 || failures.length > 0,
      attempted: Math.min(selected.length, winner.index + 1 + failures.length),
      failures: failures.map(f => ({provider: f.route.provider, model: f.route.model, error: f.error}))
    };
  } finally {
    clearTimeout(timer);
    controllers.forEach(c => c.abort());
  }
}

function cacheKey(prompt, profile, context) {
  return hash(`${profile.taskClass}|${profile.mode}|${prompt}|${context}`, 40);
}

function getCached(key) {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return row.value;
}

function putCached(key, value) {
  cache.set(key, {at: Date.now(), value});
  if (cache.size > 120) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

exports.novaGenerateAdaptive = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 25,
  memory: '256MiB',
  maxInstances: 20
}, async req => {
  uidOf(req);
  const prompt = safe(req.data?.prompt, MAX_INPUT_CHARS);
  if (!prompt) throw new HttpsError('invalid-argument', 'Prompt is required.');
  const dataClass = req.data?.dataClass === 'private' ? 'private' : 'public';
  const history = normalizeHistory(req.data?.history);
  const profile = taskProfile(prompt);
  const packed = promptPayload(prompt, history, profile, dataClass);

  const canCache = dataClass === 'public' && req.data?.cacheable === true;
  const key = canCache ? cacheKey(prompt, profile, compactContext(history, budget(profile.mode).historyTurns)) : '';
  if (key) {
    const hit = getCached(key);
    if (hit) return {...hit, cached: true};
  }

  const {routes, registrySummary} = await candidateRoutes(profile, dataClass);
  let result;
  try {
    result = await hedgedGenerate(routes, packed, profile);
  } catch (error) {
    console.error('[NOVA Adaptive Router] all routes failed:', safe(error?.message || error, 300));
    throw new HttpsError('unavailable', 'NOVA adaptive routes are temporarily unavailable.');
  }

  const response = {
    ok: true,
    text: result.text,
    cached: false,
    taskClass: profile.taskClass,
    reasoningMode: profile.mode,
    latencyMs: result.totalMs,
    route: {provider: result.route.provider, model: result.route.model},
    hedged: result.hedged,
    discoveredPool: Number(registrySummary?.routes || routes.length),
    verifiedLive: Number(registrySummary?.verifiedLive || 0)
  };
  if (key) putCached(key, response);
  return response;
});

exports.getNovaAdaptiveRouterStatus = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 10,
  memory: '128MiB'
}, async req => {
  uidOf(req);
  const snap = await REGISTRY_REF.get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    ok: true,
    version: 1,
    architecture: 'mixture-of-brains + adaptive reasoning + hedged routing + context compaction + route learning',
    foregroundIsolation: true,
    registry: data.summary || {providers: 0, routes: 0, verifiedLive: 0, quarantined: 0, degraded: 0, dead: 0}
  };
});
