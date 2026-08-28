const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

const db = getFirestore();
const MAX_REGISTRY = 200000;
const HF_PAGE_SIZE = 100;
const HF_PAGES_PER_TICK = 40;
const SOURCE_TIMEOUT_MS = 12000;
const REGISTRY = 'novaBrainRegistry';
const CATALOG_SHARDS = 'novaBrainCatalogShards';
const META = 'novaBrainRegistryMeta';
const LEADERS = 'novaBrainLeaders';

function hashId(source, modelId) {
  return createHash('sha256').update(`${source}:${modelId}`).digest('hex').slice(0, 40);
}

function text(v) { return String(v ?? '').trim(); }
function lower(v) { return text(v).toLowerCase(); }

function inferCapabilities(modelId, meta = {}) {
  const s = `${lower(modelId)} ${lower(meta.pipeline)} ${lower(meta.tags?.join?.(' '))}`;
  const caps = new Set(['general']);
  if (/code|coder|coding|devstral|starcoder|codestral/.test(s)) caps.add('coding');
  if (/reason|r1|thinking|math|qwq|logic|proof/.test(s)) caps.add('reasoning');
  if (/instruct|chat|assistant|conversation/.test(s)) caps.add('chat');
  if (/multilingual|urdu|qwen|gemma|llama|mistral/.test(s)) caps.add('multilingual');
  if (/vision|vl|multimodal/.test(s)) caps.add('vision');
  if (/embed|rerank/.test(s)) caps.add('retrieval');
  if (/whisper|speech|audio|tts/.test(s)) caps.add('audio');
  if (/image|diffusion|flux|sdxl/.test(s)) caps.add('image');
  return [...caps];
}

function taskCapability(prompt) {
  const s = lower(prompt);
  if (/\b(code|coding|bug|debug|javascript|typescript|python|java|kotlin|github|repository|function|class|api)\b/.test(s)) return 'coding';
  if (/\b(reason|reasoning|logic|math|prove|derive|constraint|puzzle|calculate)\b/.test(s)) return 'reasoning';
  if (/\b(research|latest|current|today|news|web|internet|sources?|evidence)\b/.test(s)) return 'research';
  if (/\b(urdu|roman urdu|roman-urdu|translate|translation|multilingual)\b/.test(s)) return 'multilingual';
  return 'general';
}

async function fetchJson(url, init = {}, timeoutMs = SOURCE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NexusNova-5.7-registry',
        ...(init.headers || {})
      }
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!res.ok) throw new Error(`${res.status} ${text(data?.error?.message || data?.message || raw).slice(0, 220)}`);
    return { data, headers: res.headers };
  } finally { clearTimeout(timer); }
}

function nextLink(headers) {
  const link = headers.get('link') || '';
  for (const part of link.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (m) return m[1];
  }
  return null;
}

// Catalog discovery owns metadata only. Health/latency/success counters are owned
// by novaBrainProfiler + novaRecordBrainOutcome and must never be reset here.
function normalizeCatalogRecord(source, modelId, extra = {}) {
  const id = text(modelId);
  if (!id) return null;
  const capabilities = inferCapabilities(id, extra);
  return {
    source,
    modelId: id,
    provider: text(extra.provider || source),
    endpointKind: text(extra.endpointKind || 'catalog'),
    capabilities,
    chatCandidate: !capabilities.includes('image') && !capabilities.includes('audio') && !capabilities.includes('retrieval'),
    zeroPrice: extra.zeroPrice === true,
    authMode: text(extra.authMode || 'unknown')
  };
}

function fingerprintRecords(records) {
  const stable = records
    .filter(Boolean)
    .map(row => ({
      source: row.source,
      modelId: row.modelId,
      provider: row.provider,
      endpointKind: row.endpointKind,
      capabilities: [...(row.capabilities || [])].sort(),
      zeroPrice: row.zeroPrice === true,
      authMode: row.authMode
    }))
    .sort((a, b) => `${a.provider}:${a.modelId}`.localeCompare(`${b.provider}:${b.modelId}`));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

async function upsertActiveCatalog(sourceKey, records) {
  const valid = records.filter(Boolean);
  const fingerprint = fingerprintRecords(valid);
  const stateRef = db.collection(META).doc(`catalog-${sourceKey}`);
  const previous = (await stateRef.get()).data() || {};

  if (previous.fingerprint === fingerprint) {
    await stateRef.set({
      lastCheckedAt: FieldValue.serverTimestamp(),
      seen: valid.length,
      changed: false
    }, { merge: true });
    return { written: 0, seen: valid.length, changed: false };
  }

  const writer = db.bulkWriter();
  for (const row of valid) {
    const ref = db.collection(REGISTRY).doc(hashId(row.source, row.modelId));
    writer.set(ref, {
      ...row,
      lastCatalogSeenAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await writer.close();
  await stateRef.set({
    fingerprint,
    lastCheckedAt: FieldValue.serverTimestamp(),
    lastChangedAt: FieldValue.serverTimestamp(),
    seen: valid.length,
    changed: true
  }, { merge: true });
  return { written: valid.length, seen: valid.length, changed: true };
}

function compactHuggingFaceRecord(row) {
  const modelId = text(row?.id || row?.modelId);
  if (!modelId) return null;
  const pipeline = text(row?.pipeline_tag).slice(0, 80);
  const tags = Array.isArray(row?.tags) ? row.tags.map(tag => text(tag).slice(0, 80)).filter(Boolean).slice(0, 12) : [];
  return {
    modelId,
    pipeline,
    capabilities: inferCapabilities(modelId, { pipeline, tags }),
    downloads: Math.max(0, Number(row?.downloads || 0)),
    likes: Math.max(0, Number(row?.likes || 0))
  };
}

async function writeHuggingFaceShard(shardIndex, rows) {
  const records = rows.map(compactHuggingFaceRecord).filter(Boolean).slice(0, HF_PAGE_SIZE);
  if (!records.length) return 0;
  const checksum = createHash('sha256').update(JSON.stringify(records)).digest('hex');
  const ref = db.collection(CATALOG_SHARDS).doc(`hf-${String(shardIndex).padStart(6, '0')}`);
  const previous = (await ref.get()).data() || {};
  if (previous.checksum === checksum) return 0;
  await ref.set({
    source: 'HuggingFace Hub',
    shardIndex,
    count: records.length,
    checksum,
    records,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: false });
  return 1;
}

async function ingestOpenRouter() {
  try {
    const { data } = await fetchJson('https://openrouter.ai/api/v1/models');
    const rows = Array.isArray(data?.data) ? data.data : [];
    return upsertActiveCatalog('openrouter', rows.map(r => {
      const p = r?.pricing || {};
      const zeroPrice = Number(p.prompt) === 0 && Number(p.completion) === 0;
      return normalizeCatalogRecord('OpenRouter', r?.id, {
        provider: 'OpenRouter',
        endpointKind: 'openai',
        zeroPrice,
        authMode: 'api-key'
      });
    }));
  } catch (e) {
    console.warn('[NOVA Registry] OpenRouter:', e.message);
    return { written: 0, seen: 0, changed: false, error: text(e.message).slice(0, 180) };
  }
}

async function ingestHorde() {
  try {
    const { data } = await fetchJson('https://aihorde.net/api/v2/status/models?type=text', {
      headers: { 'Client-Agent': 'NexusNova:5.7-registry' }
    });
    const rows = Array.isArray(data) ? data : [];
    return upsertActiveCatalog('aihorde', rows
      .filter(r => Number(r?.count || 0) > 0)
      .map(r => normalizeCatalogRecord('AI Horde', r?.name || r?.id, {
        provider: 'AI Horde',
        endpointKind: 'horde',
        zeroPrice: true,
        authMode: 'anonymous'
      })));
  } catch (e) {
    console.warn('[NOVA Registry] Horde:', e.message);
    return { written: 0, seen: 0, changed: false, error: text(e.message).slice(0, 180) };
  }
}

async function ingestPollinations() {
  try {
    const { data } = await fetchJson('https://text.pollinations.ai/models');
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return upsertActiveCatalog('pollinations', rows.map(r => normalizeCatalogRecord(
      'Pollinations',
      r?.name || r?.id || r?.model,
      {
        provider: 'Pollinations',
        endpointKind: 'pollinations',
        authMode: 'public-or-provider-dependent'
      }
    )));
  } catch (e) {
    console.warn('[NOVA Registry] Pollinations:', e.message);
    return { written: 0, seen: 0, changed: false, error: text(e.message).slice(0, 180) };
  }
}

async function ingestHuggingFaceIncremental() {
  const stateRef = db.collection(META).doc('huggingface');
  const state = (await stateRef.get()).data() || {};
  if (state.complete === true && Number(state.totalSeen || 0) >= MAX_REGISTRY) {
    return {
      shardWrites: 0,
      recordsSeenThisRun: 0,
      totalSeen: MAX_REGISTRY,
      pages: 0,
      complete: true
    };
  }

  let url = text(state.nextUrl) || `https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=${HF_PAGE_SIZE}&full=true`;
  let total = Number(state.totalSeen || 0);
  let pages = 0;
  let shardWrites = 0;
  let recordsSeenThisRun = 0;

  while (url && total < MAX_REGISTRY && pages < HF_PAGES_PER_TICK) {
    const { data, headers } = await fetchJson(url, {}, 15000);
    const rows = Array.isArray(data) ? data.slice(0, Math.min(HF_PAGE_SIZE, MAX_REGISTRY - total)) : [];
    if (!rows.length) {
      url = '';
      break;
    }

    const shardIndex = Math.floor(total / HF_PAGE_SIZE);
    shardWrites += await writeHuggingFaceShard(shardIndex, rows);
    total += rows.length;
    recordsSeenThisRun += rows.length;
    pages += 1;
    url = nextLink(headers) || '';
  }

  const complete = !url || total >= MAX_REGISTRY;
  await stateRef.set({
    storageMode: 'sharded-catalog-v2',
    shardSize: HF_PAGE_SIZE,
    nextUrl: complete ? null : url,
    totalSeen: Math.min(total, MAX_REGISTRY),
    pagesProcessed: FieldValue.increment(pages),
    shardWrites: FieldValue.increment(shardWrites),
    lastRunAt: FieldValue.serverTimestamp(),
    complete
  }, { merge: true });

  return {
    shardWrites,
    recordsSeenThisRun,
    totalSeen: Math.min(total, MAX_REGISTRY),
    pages,
    complete
  };
}

async function refreshRegistry() {
  // Hugging Face's 200K universe is compactly sharded. The smaller provider
  // catalogs use fingerprints, so an unchanged refresh costs only a few
  // metadata writes instead of rewriting every model and erasing learned health.
  const [hf, openRouter, horde, pollinations] = await Promise.all([
    ingestHuggingFaceIncremental(),
    ingestOpenRouter(),
    ingestHorde(),
    ingestPollinations()
  ]);
  const status = {
    target: MAX_REGISTRY,
    catalogStorage: 'sharded-catalog-v2',
    activeRouteStorage: REGISTRY,
    hf,
    openRouter,
    horde,
    pollinations,
    refreshedAt: FieldValue.serverTimestamp()
  };
  await db.collection(META).doc('status').set(status, { merge: true });
  return status;
}

exports.novaBrainDiscoveryRefresh = onSchedule({
  schedule: 'every 30 minutes',
  timeoutSeconds: 540,
  memory: '1GiB'
}, refreshRegistry);

exports.novaBrainRegistryStatus = onCall({ enforceAppCheck: true }, async req => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const [status, hf] = await Promise.all([
    db.collection(META).doc('status').get(),
    db.collection(META).doc('huggingface').get()
  ]);
  return {
    target: MAX_REGISTRY,
    storageMode: 'sharded-catalog-v2',
    status: status.data() || {},
    huggingFace: hf.data() || {}
  };
});

exports.novaSelectBrains = onCall({ enforceAppCheck: true }, async req => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const prompt = text(req.data?.prompt).slice(0, 12000);
  if (!prompt) throw new HttpsError('invalid-argument', 'Prompt required.');
  const capability = taskCapability(prompt);
  const leader = await db.collection(LEADERS).doc(capability).get();
  const ranked = Array.isArray(leader.data()?.models) ? leader.data().models : [];
  return {
    capability,
    candidates: ranked.slice(0, 8),
    source: ranked.length ? 'leaderboard' : 'registry-pending-health-profiling'
  };
});

exports.__novaBrainRegistryInternals = {
  MAX_REGISTRY,
  HF_PAGE_SIZE,
  HF_PAGES_PER_TICK,
  CATALOG_SHARDS,
  inferCapabilities,
  taskCapability,
  fingerprintRecords,
  compactHuggingFaceRecord,
  hashId,
  refreshRegistry
};
