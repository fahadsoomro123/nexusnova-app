const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

const db = getFirestore();
const MAX_REGISTRY = 200000;
const HF_PAGE_SIZE = 100;
const HF_PAGES_PER_TICK = 20;
const SOURCE_TIMEOUT_MS = 12000;
const REGISTRY = 'novaBrainRegistry';
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
  if (/\b(code|coding|bug|debug|javascript|python|java|kotlin|github|repository|function|class|api)\b/.test(s)) return 'coding';
  if (/\b(reason|reasoning|logic|math|prove|derive|constraint|puzzle|calculate)\b/.test(s)) return 'reasoning';
  if (/\b(urdu|roman urdu|roman-urdu)\b/.test(s)) return 'multilingual';
  return 'general';
}

async function fetchJson(url, init = {}, timeoutMs = SOURCE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'NexusNova-5.7-registry', ...(init.headers || {}) } });
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

function normalizeRecord(source, modelId, extra = {}) {
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
    authMode: text(extra.authMode || 'unknown'),
    discoveredAt: FieldValue.serverTimestamp(),
    lastCatalogSeenAt: FieldValue.serverTimestamp(),
    health: extra.health || 'unknown',
    healthScore: Number(extra.healthScore || 0),
    latencyEwmaMs: Number(extra.latencyEwmaMs || 0),
    successes: Number(extra.successes || 0),
    failures: Number(extra.failures || 0)
  };
}

async function upsertRecords(records) {
  const valid = records.filter(Boolean).slice(0, MAX_REGISTRY);
  const writer = db.bulkWriter();
  let written = 0;
  for (const row of valid) {
    const ref = db.collection(REGISTRY).doc(hashId(row.source, row.modelId));
    writer.set(ref, row, { merge: true });
    written += 1;
  }
  await writer.close();
  return written;
}

async function ingestOpenRouter() {
  try {
    const { data } = await fetchJson('https://openrouter.ai/api/v1/models');
    const rows = Array.isArray(data?.data) ? data.data : [];
    return upsertRecords(rows.map(r => {
      const p = r?.pricing || {};
      const zeroPrice = Number(p.prompt) === 0 && Number(p.completion) === 0;
      return normalizeRecord('OpenRouter', r?.id, { provider: 'OpenRouter', endpointKind: 'openai', zeroPrice, authMode: 'api-key' });
    }));
  } catch (e) { console.warn('[NOVA Registry] OpenRouter:', e.message); return 0; }
}

async function ingestHorde() {
  try {
    const { data } = await fetchJson('https://aihorde.net/api/v2/status/models?type=text', { headers: { 'Client-Agent': 'NexusNova:5.7-registry' } });
    const rows = Array.isArray(data) ? data : [];
    return upsertRecords(rows.filter(r => Number(r?.count || 0) > 0).map(r => normalizeRecord('AI Horde', r?.name || r?.id, { provider: 'AI Horde', endpointKind: 'horde', zeroPrice: true, authMode: 'anonymous' })));
  } catch (e) { console.warn('[NOVA Registry] Horde:', e.message); return 0; }
}

async function ingestPollinations() {
  try {
    const { data } = await fetchJson('https://text.pollinations.ai/models');
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return upsertRecords(rows.map(r => normalizeRecord('Pollinations', r?.name || r?.id || r?.model, { provider: 'Pollinations', endpointKind: 'pollinations', authMode: 'public-or-provider-dependent' })));
  } catch (e) { console.warn('[NOVA Registry] Pollinations:', e.message); return 0; }
}

async function ingestHuggingFaceIncremental() {
  const stateRef = db.collection(META).doc('huggingface');
  const state = (await stateRef.get()).data() || {};
  let url = text(state.nextUrl) || `https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=${HF_PAGE_SIZE}&full=true`;
  let total = Number(state.totalSeen || 0);
  let pages = 0;
  let written = 0;
  while (url && total < MAX_REGISTRY && pages < HF_PAGES_PER_TICK) {
    const { data, headers } = await fetchJson(url, {}, 15000);
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) { url = ''; break; }
    written += await upsertRecords(rows.map(r => normalizeRecord('HuggingFace Hub', r?.id || r?.modelId, { provider: 'HuggingFace', endpointKind: 'catalog', pipeline: r?.pipeline_tag, tags: r?.tags, authMode: 'provider-dependent' })));
    total += rows.length;
    pages += 1;
    url = nextLink(headers) || '';
  }
  await stateRef.set({ nextUrl: url || null, totalSeen: Math.min(total, MAX_REGISTRY), pagesProcessed: FieldValue.increment(pages), lastRunAt: FieldValue.serverTimestamp(), complete: !url || total >= MAX_REGISTRY }, { merge: true });
  return { written, totalSeen: Math.min(total, MAX_REGISTRY), pages, complete: !url || total >= MAX_REGISTRY };
}

async function refreshRegistry() {
  const [hf, openRouter, horde, pollinations] = await Promise.all([
    ingestHuggingFaceIncremental(), ingestOpenRouter(), ingestHorde(), ingestPollinations()
  ]);
  const status = { target: MAX_REGISTRY, hf, openRouter, horde, pollinations, refreshedAt: FieldValue.serverTimestamp() };
  await db.collection(META).doc('status').set(status, { merge: true });
  return status;
}

exports.novaBrainDiscoveryRefresh = onSchedule({ schedule: 'every 15 minutes', timeoutSeconds: 540, memory: '1GiB' }, refreshRegistry);

exports.novaBrainRegistryStatus = onCall({ enforceAppCheck: true }, async req => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const [status, hf] = await Promise.all([db.collection(META).doc('status').get(), db.collection(META).doc('huggingface').get()]);
  return { target: MAX_REGISTRY, status: status.data() || {}, huggingFace: hf.data() || {} };
});

exports.novaSelectBrains = onCall({ enforceAppCheck: true }, async req => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const prompt = text(req.data?.prompt).slice(0, 12000);
  if (!prompt) throw new HttpsError('invalid-argument', 'Prompt required.');
  const capability = taskCapability(prompt);
  const leader = await db.collection(LEADERS).doc(capability).get();
  const ranked = Array.isArray(leader.data()?.models) ? leader.data().models : [];
  return { capability, candidates: ranked.slice(0, 8), source: ranked.length ? 'leaderboard' : 'registry-pending-health-profiling' };
});

exports.__novaBrainRegistryInternals = { MAX_REGISTRY, inferCapabilities, taskCapability, hashId };
