const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getApps, initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const crypto = require('node:crypto');

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGISTRY_REF = db.collection('novaBrainDiscovery').doc('registry');
const EVENTS_REF = db.collection('novaBrainDiscoveryEvents');
const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const HORDE_BASE = 'https://aihorde.net/api/v2';
const HORDE_ANON_KEY = '0000000000';
const CLIENT_AGENT = 'NexusNova:5.7-sol:brain-discovery';
const SWEEP_TIMEOUT_MS = 95_000;
const FETCH_TIMEOUT_MS = 7_000;
const KILO_PROBE_LIMIT = 6;
const HORDE_PROBE_LIMIT = 1;
const MAX_ROUTES = 180;
const MAX_EVENT_DOCS_PER_SWEEP = 12;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || min));
}

function nowIso() {
  return new Date().toISOString();
}

function routeId(provider, model) {
  return crypto.createHash('sha256').update(`${provider}::${model}`).digest('hex').slice(0, 24);
}

function safeText(value, max = 220) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

async function fetchJson(url, init = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': CLIENT_AGENT,
        ...(init.headers || {})
      }
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {text}; }
    if (!response.ok) {
      const error = new Error(safeText(data?.error?.message || data?.message || data?.error || text || `HTTP ${response.status}`, 400));
      error.status = response.status;
      error.latencyMs = Date.now() - started;
      throw error;
    }
    return {data, latencyMs: Date.now() - started, status: response.status};
  } finally {
    clearTimeout(timer);
  }
}

function modelRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.models)) return payload.models;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function modelId(row) {
  return safeText(row?.id || row?.model || row?.name, 180);
}

function numericZero(value) {
  if (value === 0 || value === '0' || value === '0.0' || value === '0.00') return true;
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

function looksZeroCost(row) {
  const pricing = row?.pricing || row?.price || row?.cost || {};
  const input = pricing?.input ?? pricing?.prompt ?? pricing?.input_cost ?? row?.input_cost ?? row?.input_price;
  const output = pricing?.output ?? pricing?.completion ?? pricing?.output_cost ?? row?.output_cost ?? row?.output_price;
  return input !== undefined && output !== undefined && numericZero(input) && numericZero(output);
}

function capabilitiesFor(model) {
  const id = String(model || '').toLowerCase();
  const caps = new Set(['chat']);
  if (/code|coder|qwen|deepseek|poolside/.test(id)) caps.add('coding');
  if (/reason|r1|o[1-9]|nemotron|qwen|deepseek/.test(id)) caps.add('reasoning');
  if (/multilingual|qwen|glm|gemma|mistral|llama/.test(id)) caps.add('multilingual');
  if (/vision|vl|omni/.test(id)) caps.add('vision');
  return [...caps];
}

function baseCandidate(provider, model, source, extra = {}) {
  return {
    id: routeId(provider, model),
    provider,
    model,
    source,
    trustTier: 'public-data-only',
    capabilities: capabilitiesFor(model),
    discoveredAt: nowIso(),
    ...extra
  };
}

async function discoverKilo() {
  const {data, latencyMs} = await fetchJson(`${KILO_BASE}/models`, {}, 6_000);
  const seen = new Set();
  const candidates = [];

  const add = (model, row = {}) => {
    if (!model || seen.has(model)) return;
    seen.add(model);
    candidates.push(baseCandidate('Kilo', model, 'official-catalog', {
      catalogLatencyMs: latencyMs,
      advertisedFree: model === 'kilo-auto/free' || /:free$/i.test(model) || looksZeroCost(row)
    }));
  };

  add('kilo-auto/free');
  for (const row of modelRows(data)) {
    const id = modelId(row);
    if (!id) continue;
    if (id === 'kilo-auto/free' || /:free$/i.test(id) || looksZeroCost(row)) add(id, row);
  }
  return candidates;
}

async function discoverHorde() {
  const {data, latencyMs} = await fetchJson(`${HORDE_BASE}/status/models?type=text`, {
    headers: {'Client-Agent': CLIENT_AGENT}
  }, 6_000);
  const rows = Array.isArray(data) ? data : [];
  const candidates = [];
  const seen = new Set();
  for (const row of rows) {
    const id = modelId(row);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const workers = Number(row?.count ?? row?.workers ?? row?.worker_count ?? 0) || 0;
    if (workers <= 0) continue;
    const queued = Number(row?.queued ?? row?.queued_jobs ?? row?.queue ?? 0) || 0;
    const performance = Number(row?.performance ?? 0) || 0;
    candidates.push(baseCandidate('AI Horde', id, 'live-worker-catalog', {
      catalogLatencyMs: latencyMs,
      advertisedFree: true,
      workers,
      queued,
      performance
    }));
  }
  candidates.sort((a, b) => (b.workers - a.workers) || (a.queued - b.queued) || (b.performance - a.performance));
  return candidates;
}

function extractChatText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? data?.output_text ?? data?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => typeof part === 'string' ? part : String(part?.text || part?.content || '')).join('').trim();
  }
  return '';
}

async function probeKilo(candidate) {
  const started = Date.now();
  try {
    const {data} = await fetchJson(`${KILO_BASE}/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: candidate.model,
        messages: [{role: 'user', content: 'Reply with exactly: NOVA_OK'}],
        max_tokens: 12,
        temperature: 0,
        stream: false
      })
    }, 5_500);
    const text = extractChatText(data);
    if (!text) throw new Error('Empty completion');
    return {ok: true, latencyMs: Date.now() - started, evidence: safeText(text, 80)};
  } catch (error) {
    return {
      ok: false,
      latencyMs: Number(error?.latencyMs) || (Date.now() - started),
      statusCode: Number(error?.status) || 0,
      error: safeText(error?.message || error)
    };
  }
}

async function submitHorde(model) {
  const {data} = await fetchJson(`${HORDE_BASE}/generate/text/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: HORDE_ANON_KEY,
      'Client-Agent': CLIENT_AGENT
    },
    body: JSON.stringify({
      prompt: 'Reply with exactly NOVA_OK',
      params: {max_length: 12, max_context_length: 256, temperature: 0.1},
      models: [model],
      trusted_workers: false,
      slow_workers: true,
      dry_run: false
    })
  }, 5_000);
  const id = safeText(data?.id, 120);
  if (!id) throw new Error('No generation id');
  return id;
}

async function probeHorde(candidate) {
  const started = Date.now();
  let id = '';
  try {
    id = await submitHorde(candidate.model);
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const {data} = await fetchJson(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, {
        headers: {'Client-Agent': CLIENT_AGENT}
      }, 3_500);
      const generations = Array.isArray(data?.generations) ? data.generations : [];
      const text = safeText(generations[0]?.text, 80);
      if (text) return {ok: true, latencyMs: Date.now() - started, evidence: text};
      if (data?.faulted === true || data?.is_possible === false || data?.done === true) {
        throw new Error('Horde probe completed without usable text');
      }
    }
    throw new Error('Horde probe timed out');
  } catch (error) {
    return {ok: false, latencyMs: Date.now() - started, error: safeText(error?.message || error)};
  } finally {
    if (id) {
      fetch(`${HORDE_BASE}/generate/text/status/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {'Client-Agent': CLIENT_AGENT}
      }).catch(() => {});
    }
  }
}

function previousMap(snapshot) {
  const data = snapshot.exists ? snapshot.data() || {} : {};
  const routes = Array.isArray(data.routes) ? data.routes : [];
  return new Map(routes.map(row => [String(row.id || ''), row]));
}

function mergeHealth(candidate, probe, previous) {
  const oldSuccesses = Number(previous?.successes || 0);
  const oldFailures = Number(previous?.failures || 0);
  const successes = oldSuccesses + (probe?.ok ? 1 : 0);
  const failures = oldFailures + (probe && !probe.ok ? 1 : 0);
  const observed = successes + failures;
  const successRate = observed ? successes / observed : 0;
  const consecutiveFailures = probe?.ok ? 0 : (probe ? Number(previous?.consecutiveFailures || 0) + 1 : Number(previous?.consecutiveFailures || 0));
  const latencyMs = Number(probe?.latencyMs || previous?.latencyMs || candidate.catalogLatencyMs || 0);
  const rateLimited = Number(probe?.statusCode || 0) === 429;

  let status = 'quarantined';
  if (probe?.ok) status = successes >= 2 || previous?.status === 'verified' ? 'verified' : 'quarantined';
  else if (rateLimited) status = previous?.status === 'verified' ? 'degraded' : 'quarantined';
  else if (consecutiveFailures >= 3) status = 'dead';
  else if (previous?.status === 'verified') status = 'degraded';

  let score = 36;
  score += successRate * 44;
  if (probe?.ok) score += 12;
  if (status === 'verified') score += 8;
  if (rateLimited) score -= 10;
  score -= Math.min(24, latencyMs / 350);
  score -= Math.min(28, consecutiveFailures * 8);
  if (candidate.provider === 'Kilo') score += 4;
  if (candidate.provider === 'AI Horde') score -= 4;
  score = Math.round(clamp(score, 0, 100));

  return {
    ...candidate,
    status,
    score,
    latencyMs,
    successes,
    failures,
    successRate: Number(successRate.toFixed(3)),
    consecutiveFailures,
    lastProbeOk: probe ? Boolean(probe.ok) : null,
    lastProbeAt: probe ? nowIso() : (previous?.lastProbeAt || null),
    lastError: probe && !probe.ok ? safeText(probe.error || `HTTP ${probe.statusCode || 0}`) : '',
    lastSeenAt: nowIso(),
    verifiedAt: probe?.ok ? nowIso() : (previous?.verifiedAt || null)
  };
}

function staleRoutes(prev, currentIds) {
  const out = [];
  for (const old of prev.values()) {
    if (!old?.id || currentIds.has(old.id)) continue;
    const missedSweeps = Number(old.missedSweeps || 0) + 1;
    out.push({
      ...old,
      missedSweeps,
      status: missedSweeps >= 3 ? 'dead' : 'degraded',
      score: Math.max(0, Number(old.score || 0) - 12),
      lastError: 'Route missing from latest provider catalog.'
    });
  }
  return out;
}

function summaryOf(routes, sweepMs) {
  const providers = new Set(routes.map(r => r.provider));
  const count = status => routes.filter(r => r.status === status).length;
  return {
    providers: providers.size,
    routes: routes.length,
    verifiedLive: count('verified'),
    quarantined: count('quarantined'),
    degraded: count('degraded'),
    dead: count('dead'),
    sweepMs,
    updatedAt: nowIso()
  };
}

async function writeEvents(routes) {
  const changed = routes.filter(r => r.lastProbeAt).slice(0, MAX_EVENT_DOCS_PER_SWEEP);
  if (!changed.length) return;
  const batch = db.batch();
  for (const route of changed) {
    const ref = EVENTS_REF.doc();
    batch.set(ref, {
      routeId: route.id,
      provider: route.provider,
      model: route.model,
      status: route.status,
      score: route.score,
      latencyMs: route.latencyMs,
      probeOk: route.lastProbeOk,
      at: FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
}

async function runSweep() {
  const started = Date.now();
  const snapshot = await REGISTRY_REF.get();
  const prev = previousMap(snapshot);
  const discovery = await Promise.allSettled([discoverKilo(), discoverHorde()]);
  const candidates = discovery.flatMap(item => item.status === 'fulfilled' ? item.value : []);

  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate?.id || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    unique.push(candidate);
    if (unique.length >= MAX_ROUTES) break;
  }

  const probeResults = new Map();
  const kiloCandidates = unique.filter(r => r.provider === 'Kilo').slice(0, KILO_PROBE_LIMIT);
  for (const candidate of kiloCandidates) {
    if (Date.now() - started > SWEEP_TIMEOUT_MS) break;
    probeResults.set(candidate.id, await probeKilo(candidate));
  }

  const hordeCandidates = unique.filter(r => r.provider === 'AI Horde').slice(0, HORDE_PROBE_LIMIT);
  for (const candidate of hordeCandidates) {
    if (Date.now() - started > SWEEP_TIMEOUT_MS) break;
    probeResults.set(candidate.id, await probeHorde(candidate));
  }

  const routes = unique.map(candidate => mergeHealth(candidate, probeResults.get(candidate.id), prev.get(candidate.id)));
  routes.push(...staleRoutes(prev, new Set(routes.map(r => r.id))));
  routes.sort((a, b) => (b.score - a.score) || (a.latencyMs - b.latencyMs));
  const capped = routes.slice(0, MAX_ROUTES);
  const summary = summaryOf(capped, Date.now() - started);

  await REGISTRY_REF.set({
    schemaVersion: 1,
    mode: 'private-server-registry',
    privacyRule: 'synthetic-probes-only',
    foregroundIsolation: true,
    summary,
    routes: capped,
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: false});

  await writeEvents(capped).catch(error => console.warn('[NOVA Brain Discovery] event log:', error));
  console.log('[NOVA Brain Discovery] sweep complete', summary);
  return summary;
}

exports.novaBrainDiscoverySweep = onSchedule({
  schedule: 'every 30 minutes',
  timeZone: 'Etc/UTC',
  timeoutSeconds: 120,
  memory: '256MiB',
  maxInstances: 1
}, async () => {
  try {
    await runSweep();
  } catch (error) {
    console.error('[NOVA Brain Discovery] sweep failed:', error);
    throw error;
  }
});

exports.getNovaBrainDiscoveryStatus = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 10,
  memory: '128MiB'
}, async req => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const snapshot = await REGISTRY_REF.get();
  if (!snapshot.exists) {
    return {ok: true, ready: false, summary: {providers: 0, routes: 0, verifiedLive: 0, quarantined: 0, degraded: 0, dead: 0}};
  }
  const data = snapshot.data() || {};
  const routes = Array.isArray(data.routes) ? data.routes : [];
  return {
    ok: true,
    ready: true,
    summary: data.summary || {},
    // Deliberately expose only product-safe operational metadata. Discovery
    // recipes, endpoint details and scoring internals stay server-side.
    topRoutes: routes.filter(r => r.status === 'verified').slice(0, 8).map(r => ({
      provider: r.provider,
      model: r.model,
      capabilities: r.capabilities,
      latencyMs: r.latencyMs,
      status: r.status
    }))
  };
});

exports.__novaBrainDiscoveryInternals = Object.freeze({
  runSweep,
  discoverKilo,
  discoverHorde,
  probeKilo,
  probeHorde
});
