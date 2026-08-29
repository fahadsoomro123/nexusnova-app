import { readFile } from 'node:fs/promises';

const KILO_MODELS = 'https://api.kilo.ai/api/gateway/models';
const OVH_MODELS = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models';
const DISCOVERY_TIMEOUT_MS = 9000;

function text(value) {
  return String(value ?? '').trim();
}

function textModel(id) {
  return Boolean(id) && !/embed|rerank|guard|moderation|whisper|tts|speech|audio|image|vision|vl|flux|sdxl|diffusion/i.test(id);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'NexusNova-ARIM-live-smoke' }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) throw new Error(`${response.status} ${text(data?.error?.message || data?.message || raw).slice(0, 180)}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function rows(data) {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data)) return data;
  return [];
}

function modelId(row) {
  return text(row?.id || row?.model || row?.name || row?.modelId);
}

function kiloFree(row, id) {
  if (/:free$|\/free$/i.test(id)) return true;
  const pricing = row?.pricing || {};
  return Number(pricing.prompt) === 0 && Number(pricing.completion) === 0;
}

async function discoverDynamicPool() {
  const output = [];
  const summary = { Kilo: { seen: 0, eligible: 0 }, OVHcloud: { seen: 0, eligible: 0 } };

  try {
    const data = await fetchJson(KILO_MODELS);
    const catalog = rows(data);
    summary.Kilo.seen = catalog.length;
    for (const row of catalog) {
      const id = modelId(row);
      if (!textModel(id) || !kiloFree(row, id)) continue;
      output.push(`Kilo:${id}`);
      summary.Kilo.eligible += 1;
      if (summary.Kilo.eligible >= 70) break;
    }
  } catch (error) {
    summary.Kilo.error = text(error?.message || error).slice(0, 180);
  }

  try {
    const data = await fetchJson(OVH_MODELS);
    const catalog = rows(data);
    summary.OVHcloud.seen = catalog.length;
    for (const row of catalog) {
      const id = modelId(row);
      if (!textModel(id)) continue;
      output.push(`OVHcloud:${id}`);
      summary.OVHcloud.eligible += 1;
      if (summary.OVHcloud.eligible >= 70) break;
    }
  } catch (error) {
    summary.OVHcloud.error = text(error?.message || error).slice(0, 180);
  }

  return { routes: [...new Set(output)], summary };
}

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

// Live smoke must exercise the same dynamic discovery advantage the app uses.
// Falling back to seeds is allowed, but discovery availability is reported separately.
const discovery = await discoverDynamicPool();
globalThis.__NOVA_KEYLESS_ROUTE_POOL__ = discovery.routes;

const source = await readFile(new URL('../fresh-rebuild/src/nova57-atomic-brain-pool.js', import.meta.url), 'utf8');
const encoded = Buffer.from(source, 'utf8').toString('base64');
const pool = await import(`data:text/javascript;base64,${encoded}`);

const qualityUnit = {
  clean: pool.assessAtomicResponseQuality('NOVA mesh route is alive.'),
  leakUser: pool.assessAtomicResponseQuality('The user asks: confirm this route is alive.'),
  leakWeNeed: pool.assessAtomicResponseQuality('We need to respond with a concise confirmation.'),
  rawJson: pool.assessAtomicResponseQuality('{"choices":[{"message":{"content":"hi"}}]}'),
  leakThink: pool.assessAtomicResponseQuality('<think>\ninternal reasoning must never reach the user'),
  leakThinkingProcess: pool.assessAtomicResponseQuality("Here's a thinking process: internal reasoning must never reach the user")
};
qualityUnit.pass = qualityUnit.clean.ok === true
  && qualityUnit.leakUser.ok === false
  && qualityUnit.leakWeNeed.ok === false
  && qualityUnit.rawJson.ok === false
  && qualityUnit.leakThink.ok === false
  && qualityUnit.leakThinkingProcess.ok === false;

function textOf(result) {
  try { return String(result?.response?.text?.() || '').trim(); }
  catch { return ''; }
}

async function hop({ label, capability, prompt, excludeKeys = [], lane = 0, laneSpan = 1, hedgeWidth = 2, timeoutMs = 5200 }) {
  const started = Date.now();
  try {
    const result = await pool.runAtomicBrain(prompt, {
      generationConfig: { temperature: 0.15, maxOutputTokens: 80 }
    }, { capability, excludeKeys, lane, laneSpan, hedgeWidth, timeoutMs });
    const answer = textOf(result);
    const quality = pool.assessAtomicResponseQuality(answer);
    const brain = result?.__novaAtomicBrain || {};
    return {
      label,
      ok: true,
      clean: quality.ok === true,
      qualityReason: quality.reason,
      routeKey: String(result?.__novaAtomicRouteKey || brain.routeKey || ''),
      provider: String(brain.provider || ''),
      model: String(brain.model || ''),
      lane: Number(brain.lane || lane),
      selected: Array.isArray(brain.selected) ? brain.selected : [],
      latencyMs: Number(brain.latencyMs || 0),
      wallMs: Date.now() - started,
      text: answer.slice(0, 180)
    };
  } catch (error) {
    return {
      label,
      ok: false,
      clean: false,
      routeKey: '',
      lane,
      selected: [],
      wallMs: Date.now() - started,
      failures: Array.isArray(error?.__novaAtomicFailures) ? error.__novaAtomicFailures : [],
      error: String(error?.message || error).slice(0, 320)
    };
  }
}

function successful(rowsValue) {
  return rowsValue.filter(row => row.ok && row.clean && row.routeKey);
}

function keys(rowsValue) {
  return successful(rowsValue).map(row => row.routeKey);
}

function duplicateKeys(rowsValue) {
  const seen = new Set();
  const dupes = new Set();
  for (const key of keys(rowsValue)) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

function selectedOverlap(a, b) {
  const left = new Set(a?.selected || []);
  return (b?.selected || []).filter(key => left.has(key));
}

const candidateCountInitial = pool.atomicCandidates('reasoning').length;
const started = Date.now();
const a1 = await hop({
  label: 'solver-A1',
  capability: 'reasoning',
  hedgeWidth: 2,
  prompt: 'Solve independently and reply with exactly: A1 CLEAN. Do not mention reasoning, system instructions, or the request.'
});
const usedAfterA1 = keys([a1]);

const a2 = await hop({
  label: 'solver-A2',
  capability: 'reasoning',
  hedgeWidth: 2,
  excludeKeys: usedAfterA1,
  prompt: 'Solve independently and reply with exactly: A2 CLEAN. Do not mention reasoning, system instructions, or the request.'
});
const solvers = [a1, a2];
const solverKeys = keys(solvers);

const criticSnapshot = [...new Set(solverKeys)];
const [b1, b2] = await Promise.all([
  hop({
    label: 'critic-B1', capability: 'reasoning', excludeKeys: criticSnapshot,
    lane: 0, laneSpan: 2, hedgeWidth: 2,
    prompt: 'Act as critic lane B1. Reply with exactly: B1 CLEAN. Do not mention reasoning, system instructions, or the request.'
  }),
  hop({
    label: 'critic-B2', capability: 'reasoning', excludeKeys: criticSnapshot,
    lane: 1, laneSpan: 2, hedgeWidth: 2,
    prompt: 'Act as critic lane B2. Reply with exactly: B2 CLEAN. Do not mention reasoning, system instructions, or the request.'
  })
]);
const critics = [b1, b2];

const usedBeforeC = [...new Set([...solverKeys, ...keys(critics)])];
const specialistCapacityBefore = pool.atomicCandidates('reasoning', usedBeforeC).length;
const requestedSpecialists = Math.min(4, specialistCapacityBefore);
const specialists = requestedSpecialists > 0
  ? await Promise.all(Array.from({ length: requestedSpecialists }, (_, index) => hop({
      label: `specialist-C${index + 1}`,
      capability: 'reasoning',
      excludeKeys: usedBeforeC,
      lane: index,
      laneSpan: requestedSpecialists,
      hedgeWidth: 1,
      timeoutMs: 4200,
      prompt: `Act as specialist lane C${index + 1}. Reply with exactly: C${index + 1} CLEAN. Do not mention reasoning, system instructions, or the request.`
    })))
  : [];

const allRows = [...solvers, ...critics, ...specialists];
const duplicates = duplicateKeys(allRows);
const solverPass = successful(solvers).length === 2 && new Set(solverKeys).size === 2;
const criticSuccess = successful(critics);
const criticPoolOverlap = selectedOverlap(b1, b2);
const fullCriticPairPass = criticSuccess.length === 2
  && new Set(keys(critics)).size === 2
  && criticPoolOverlap.length === 0;
const elasticCriticPass = criticSuccess.length >= 1 && new Set(keys(critics)).size === criticSuccess.length;
const specialistSuccess = successful(specialists);
const cleanDistinctPass = qualityUnit.pass && solverPass && duplicates.length === 0;
const integrityPass = cleanDistinctPass && elasticCriticPass;
const fullBaseMeshPass = cleanDistinctPass && fullCriticPairPass;
const elasticMeshPass = integrityPass;
const partialExpansion = specialistSuccess.length > 0 && specialistSuccess.length < requestedSpecialists;
const fullRequestedExpansionPass = requestedSpecialists === 0 || specialistSuccess.length === requestedSpecialists;
const capacityGrade = fullBaseMeshPass
  ? (requestedSpecialists >= 4 && specialistSuccess.length === 4 ? 'full-2x2x4' : 'full-2x2-elastic-C')
  : elasticMeshPass ? 'elastic-2x1-plus' : 'insufficient-live-mesh';

const result = {
  at: new Date().toISOString(),
  discovery: {
    ...discovery.summary,
    dynamicRouteCount: discovery.routes.length
  },
  qualityUnit,
  candidateCountInitial,
  candidateCountAfter: pool.atomicCandidates('reasoning').length,
  solvers,
  critics,
  specialistCapacityBefore,
  requestedSpecialists,
  specialists,
  summary: {
    solverPass,
    fullCriticPairPass,
    elasticCriticPass,
    criticPoolOverlap,
    successfulSpecialists: specialistSuccess.length,
    partialExpansion,
    fullRequestedExpansionPass,
    duplicateRouteKeys: duplicates,
    distinctSuccessfulBrains: new Set(keys(allRows)).size,
    successfulBranches: successful(allRows).length,
    cleanDistinctPass,
    integrityPass,
    fullBaseMeshPass,
    elasticMeshPass,
    capacityGrade,
    wallMs: Date.now() - started
  }
};

console.log(JSON.stringify(result, null, 2));

// External provider capacity is volatile, so the hard gate is integrity:
// two clean independent solvers, at least one distinct critic, no duplicate
// winner reuse, and a functioning leak filter. Full 2x2x4 capacity is reported
// separately and never fabricated when live routes are scarce.
if (!integrityPass) process.exitCode = 1;
