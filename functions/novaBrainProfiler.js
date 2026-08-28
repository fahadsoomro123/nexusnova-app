const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

const db = getFirestore();
const REGISTRY = 'novaBrainRegistry';
const LEADERS = 'novaBrainLeaders';
const META = 'novaBrainRegistryMeta';
const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const OVH_BASE = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1';
const DISCOVERY_TIMEOUT_MS = 9000;
const PROBE_TIMEOUT_MS = 7000;
const PROBE_LIMIT = 8;
const LEADER_LIMIT = 48;
const CANDIDATE_SCAN_LIMIT = 180;
const CAPABILITIES = ['general', 'coding', 'reasoning', 'multilingual', 'research'];

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function lower(value) {
  return text(value).toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function hashId(source, modelId) {
  return createHash('sha256').update(`${source}:${modelId}`).digest('hex').slice(0, 40);
}

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
}

function inferCapabilities(modelId) {
  const s = lower(modelId);
  const caps = new Set(['general']);
  if (/code|coder|codestral|devstral|starcoder/.test(s)) caps.add('coding');
  if (/reason|r1|thinking|math|qwq|logic|nemotron|minimax/.test(s)) caps.add('reasoning');
  if (/qwen|mistral|gemma|llama|minimax|multilingual|urdu/.test(s)) caps.add('multilingual');
  if (/search|online|web|ground|sonar/.test(s)) caps.add('research');
  return [...caps];
}

function isTextModel(modelId) {
  return Boolean(modelId) && !/embed|rerank|guard|moderation|whisper|tts|speech|audio|image|vision|vl|flux|sdxl|diffusion/i.test(modelId);
}

function isZeroPrice(row, modelId) {
  if (/:free$|\/free$/i.test(modelId)) return true;
  const pricing = row?.pricing || {};
  return Number(pricing.prompt) === 0 && Number(pricing.completion) === 0;
}

async function fetchJson(url, init = {}, timeoutMs = DISCOVERY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NexusNova-5.7-profiler',
        ...(init.headers || {})
      }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    return { ok: response.ok, status: response.status, data, raw };
  } finally {
    clearTimeout(timer);
  }
}

function rowsFromCatalog(data) {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.models)) return data.models;
  return [];
}

function modelIdOf(row) {
  return text(row?.id || row?.name || row?.model || row?.modelId, 240);
}

async function discoverPublicInferenceRoutes() {
  const sources = [
    { source: 'Kilo', provider: 'Kilo', base: KILO_BASE, authMode: 'public-endpoint-observed' },
    { source: 'OVHcloud', provider: 'OVHcloud', base: OVH_BASE, authMode: 'public-endpoint-observed' }
  ];
  const writer = db.bulkWriter();
  const summary = {};

  for (const source of sources) {
    try {
      const result = await fetchJson(`${source.base}/models`);
      if (!result.ok) {
        summary[source.provider] = { discovered: 0, status: result.status };
        continue;
      }
      const rows = rowsFromCatalog(result.data);
      let discovered = 0;
      for (const row of rows.slice(0, 500)) {
        const modelId = modelIdOf(row);
        if (!isTextModel(modelId)) continue;
        const ref = db.collection(REGISTRY).doc(hashId(source.source, modelId));
        writer.set(ref, {
          source: source.source,
          provider: source.provider,
          modelId,
          endpointKind: 'openai-public',
          endpointBase: source.base,
          capabilities: inferCapabilities(modelId),
          chatCandidate: true,
          probeEligible: true,
          zeroPrice: source.provider === 'Kilo' ? isZeroPrice(row, modelId) : false,
          authMode: source.authMode,
          callableState: 'catalog-visible',
          lastCatalogSeenAt: FieldValue.serverTimestamp()
        }, { merge: true });
        discovered += 1;
      }
      summary[source.provider] = { discovered, status: result.status };
    } catch (error) {
      summary[source.provider] = { discovered: 0, error: text(error?.message || error, 180) };
    }
  }

  await writer.close();
  return summary;
}

function qualityOk(value) {
  const output = text(value, 1200);
  if (!output) return false;
  if (/^<think>|^<analysis>|^(?:the\s+)?user\s+(?:asks|wants|is asking)|^we\s+(?:need|should|must)\s+(?:to\s+)?(?:respond|answer)/i.test(output)) return false;
  if (/^\s*[\[{]\s*"(?:choices|error|model|usage|id)"\s*:/i.test(output)) return false;
  return /NOVA_OK/i.test(output);
}

function outputText(data, raw) {
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.text;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => typeof part === 'string' ? part : text(part?.text || part?.content, 500)).join('').trim();
  return typeof raw === 'string' && raw.length < 1200 ? raw.trim() : '';
}

function failureState(status, errorText) {
  const s = lower(errorText);
  if (status === 401 || status === 403 || /auth|forbidden|credential/.test(s)) return { outcome: 'auth', callableState: 'auth-required', quarantineMs: 6 * 60 * 60_000 };
  if (status === 429 || /rate.?limit|quota/.test(s)) return { outcome: 'rate-limit', callableState: 'rate-limited', quarantineMs: 20 * 60_000 };
  if (/timeout|abort/.test(s)) return { outcome: 'timeout', callableState: 'timeout', quarantineMs: 5 * 60_000 };
  return { outcome: 'failure', callableState: 'unavailable', quarantineMs: 10 * 60_000 };
}

async function probeRoute(row) {
  const provider = text(row?.provider || row?.source, 80);
  const source = text(row?.source || provider, 80);
  const modelId = text(row?.modelId, 240);
  const base = text(row?.endpointBase, 400) || (provider === 'Kilo' ? KILO_BASE : provider === 'OVHcloud' ? OVH_BASE : '');
  if (!modelId || !base || !['Kilo', 'OVHcloud'].includes(provider)) return null;

  const started = Date.now();
  try {
    const result = await fetchJson(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Reply exactly with NOVA_OK and nothing else.' }],
        temperature: 0.1,
        max_tokens: 16,
        stream: false
      })
    }, PROBE_TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    const output = outputText(result.data, result.raw);
    if (result.ok && qualityOk(output)) {
      return { source, provider, modelId, latencyMs, outcome: 'success', callableState: 'callable', quality: 1, quarantineMs: 0 };
    }
    const detail = text(result.data?.error?.message || result.data?.message || result.raw, 300);
    if (result.ok) return { source, provider, modelId, latencyMs, outcome: 'quality-failure', callableState: 'degraded', quality: 0, quarantineMs: 10 * 60_000 };
    return { source, provider, modelId, latencyMs, quality: 0, ...failureState(result.status, detail) };
  } catch (error) {
    const latencyMs = Date.now() - started;
    return { source, provider, modelId, latencyMs, quality: 0, ...failureState(0, error?.message || error) };
  }
}

async function applyProbe(result) {
  if (!result) return null;
  const ref = db.collection(REGISTRY).doc(hashId(result.source, result.modelId));
  let learned = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const previous = snap.data() || {};
    const successes = Math.max(0, Number(previous.successes || 0)) + (result.outcome === 'success' ? 1 : 0);
    const failures = Math.max(0, Number(previous.failures || 0)) + (result.outcome === 'success' ? 0 : 1);
    const oldLatency = Math.max(0, Number(previous.latencyEwmaMs || 0));
    const latencyEwmaMs = result.latencyMs > 0 ? (oldLatency ? oldLatency * 0.78 + result.latencyMs * 0.22 : result.latencyMs) : oldLatency;
    const attempts = successes + failures;
    const successRate = attempts ? successes / attempts : 0;
    const latencyBonus = latencyEwmaMs ? Math.max(-18, 20 - latencyEwmaMs / 180) : 0;
    const failurePenalty = result.outcome === 'auth' ? 45 : result.outcome === 'rate-limit' ? 18 : result.outcome === 'timeout' ? 16 : result.outcome === 'quality-failure' ? 24 : result.outcome === 'success' ? 0 : 20;
    const healthScore = clamp(successRate * 72 + result.quality * 22 + latencyBonus - failurePenalty, -100, 100);
    const health = result.outcome === 'success' && healthScore >= 55 ? 'healthy' : result.outcome === 'success' ? 'degraded' : healthScore < 25 ? 'unavailable' : 'degraded';
    learned = {
      source: result.source,
      provider: result.provider,
      modelId: result.modelId,
      endpointKind: text(previous.endpointKind, 40) || 'openai-public',
      endpointBase: text(previous.endpointBase, 400),
      capabilities: Array.isArray(previous.capabilities) && previous.capabilities.length ? previous.capabilities : inferCapabilities(result.modelId),
      chatCandidate: true,
      probeEligible: true,
      callableState: result.callableState,
      health,
      healthScore,
      latencyEwmaMs,
      successes,
      failures,
      lastProbeOutcome: result.outcome,
      lastProbeAt: FieldValue.serverTimestamp(),
      quarantineUntil: result.quarantineMs ? Timestamp.fromMillis(Date.now() + result.quarantineMs) : null
    };
    tx.set(ref, learned, { merge: true });
  });
  return learned;
}

function capabilityScore(row, capability) {
  const caps = Array.isArray(row?.capabilities) ? row.capabilities : [];
  const fit = caps.includes(capability) ? 34 : capability === 'research' && caps.includes('general') ? 8 : caps.includes('general') ? 6 : -12;
  const successes = Math.max(0, Number(row?.successes || 0));
  const failures = Math.max(0, Number(row?.failures || 0));
  const attempts = successes + failures;
  const successRate = attempts ? successes / attempts : 0.5;
  const latency = Math.max(0, Number(row?.latencyEwmaMs || 0));
  const callable = row?.callableState === 'callable' ? 28 : row?.health === 'healthy' ? 14 : 0;
  const healthScore = clamp(row?.healthScore, -100, 100);
  const latencyPenalty = latency ? Math.min(35, latency / 150) : 0;
  return healthScore + fit + callable + successRate * 34 - latencyPenalty;
}

function leaderCandidate(row, capability) {
  return {
    source: text(row?.source, 80),
    provider: text(row?.provider || row?.source, 80),
    modelId: text(row?.modelId, 240),
    endpointKind: text(row?.endpointKind, 40),
    capabilities: Array.isArray(row?.capabilities) ? row.capabilities.slice(0, 12) : [],
    callableState: text(row?.callableState, 40),
    health: text(row?.health, 30),
    healthScore: Number(row?.healthScore || 0),
    latencyEwmaMs: Number(row?.latencyEwmaMs || 0),
    successes: Number(row?.successes || 0),
    failures: Number(row?.failures || 0),
    score: capabilityScore(row, capability),
    lastVerifiedAt: Date.now()
  };
}

async function rebuildLeaderboards() {
  const snap = await db.collection(REGISTRY).where('probeEligible', '==', true).limit(CANDIDATE_SCAN_LIMIT).get();
  const probedRows = snap.docs
    .map(doc => doc.data() || {})
    .filter(row => row.modelId && row.provider && row.endpointKind !== 'catalog');
  const existing = await Promise.all(CAPABILITIES.map(capability => db.collection(LEADERS).doc(capability).get()));
  const writer = db.bulkWriter();
  const sizes = {};
  for (let i = 0; i < CAPABILITIES.length; i += 1) {
    const capability = CAPABILITIES[i];
    const current = Array.isArray(existing[i].data()?.models) ? existing[i].data().models : [];
    const merged = new Map();
    for (const row of [...current, ...probedRows]) {
      const provider = text(row?.provider || row?.source, 80);
      const modelId = text(row?.modelId, 240);
      if (!provider || !modelId) continue;
      merged.set(`${provider}::${modelId}`, row);
    }
    const ranked = [...merged.values()]
      .filter(row => row.callableState === 'callable' || row.health === 'healthy' || Number(row.successes || 0) > 0)
      .map(row => leaderCandidate(row, capability))
      .sort((a, b) => b.score - a.score)
      .slice(0, LEADER_LIMIT);
    sizes[capability] = ranked.length;
    writer.set(db.collection(LEADERS).doc(capability), {
      capability,
      models: ranked,
      updatedAt: FieldValue.serverTimestamp(),
      source: 'novaBrainProfiler'
    }, { merge: true });
  }
  await writer.close();
  return sizes;
}

async function chooseProbeRows() {
  const snap = await db.collection(REGISTRY).where('probeEligible', '==', true).limit(80).get();
  const now = Date.now();
  return snap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(row => {
      const until = row?.quarantineUntil?.toMillis?.() || 0;
      return !until || until <= now;
    })
    .sort((a, b) => {
      const aa = a?.lastProbeAt?.toMillis?.() || 0;
      const bb = b?.lastProbeAt?.toMillis?.() || 0;
      return aa - bb;
    })
    .slice(0, PROBE_LIMIT);
}

async function profileCycle() {
  const discovery = await discoverPublicInferenceRoutes();
  const candidates = await chooseProbeRows();
  const probed = [];
  for (let i = 0; i < candidates.length; i += 2) {
    const batch = candidates.slice(i, i + 2);
    const results = await Promise.all(batch.map(probeRoute));
    for (const result of results) {
      if (!result) continue;
      probed.push(result);
      await applyProbe(result);
    }
  }
  const leaderboards = await rebuildLeaderboards();
  const summary = {
    discovery,
    probed: probed.map(row => ({ provider: row.provider, modelId: row.modelId, outcome: row.outcome, latencyMs: row.latencyMs })),
    leaderboards,
    probeLimit: PROBE_LIMIT,
    completedAt: FieldValue.serverTimestamp()
  };
  await db.collection(META).doc('profiler').set(summary, { merge: true });
  return summary;
}

exports.novaBrainProfilerRefresh = onSchedule({
  schedule: 'every 2 hours',
  timeoutSeconds: 180,
  memory: '512MiB'
}, profileCycle);

exports.novaBrainProfilerStatus = onCall({ enforceAppCheck: true }, async req => {
  requireUser(req);
  const snap = await db.collection(META).doc('profiler').get();
  return {
    ok: true,
    strategy: 'cost-safe-bounded-profiling',
    probeLimit: PROBE_LIMIT,
    capabilities: CAPABILITIES,
    status: snap.data() || {}
  };
});

exports.__novaBrainProfilerInternals = {
  PROBE_LIMIT,
  CAPABILITIES,
  inferCapabilities,
  isTextModel,
  qualityOk,
  capabilityScore,
  hashId,
  profileCycle
};
