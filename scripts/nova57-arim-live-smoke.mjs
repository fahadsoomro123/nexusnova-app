import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../fresh-rebuild/src/nova57-atomic-brain-pool.js', import.meta.url), 'utf8');
const encoded = Buffer.from(source, 'utf8').toString('base64');
const pool = await import(`data:text/javascript;base64,${encoded}`);

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
globalThis.__NOVA_KEYLESS_ROUTE_POOL__ = [];

const qualityUnit = {
  clean: pool.assessAtomicResponseQuality('NOVA mesh route is alive.'),
  leakUser: pool.assessAtomicResponseQuality('The user asks: confirm this route is alive.'),
  leakWeNeed: pool.assessAtomicResponseQuality('We need to respond with a concise confirmation.'),
  rawJson: pool.assessAtomicResponseQuality('{"choices":[{"message":{"content":"hi"}}]}')
};
qualityUnit.pass = qualityUnit.clean.ok === true
  && qualityUnit.leakUser.ok === false
  && qualityUnit.leakWeNeed.ok === false
  && qualityUnit.rawJson.ok === false;

function textOf(result) {
  try { return String(result?.response?.text?.() || '').trim(); }
  catch { return ''; }
}

async function hop({ label, capability, prompt, excludeKeys = [], lane = 0, hedgeWidth = 2, timeoutMs = 5200 }) {
  const started = Date.now();
  try {
    const result = await pool.runAtomicBrain(prompt, {
      generationConfig: { temperature: 0.15, maxOutputTokens: 80 }
    }, { capability, excludeKeys, lane, hedgeWidth, timeoutMs });
    const text = textOf(result);
    const quality = pool.assessAtomicResponseQuality(text);
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
      text: text.slice(0, 180)
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
      error: String(error?.message || error).slice(0, 320)
    };
  }
}

function successful(rows) {
  return rows.filter(row => row.ok && row.clean && row.routeKey);
}

function keys(rows) {
  return successful(rows).map(row => row.routeKey);
}

function duplicateKeys(rows) {
  const seen = new Set();
  const dupes = new Set();
  for (const key of keys(rows)) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

function selectedOverlap(a, b) {
  const left = new Set(a?.selected || []);
  return (b?.selected || []).filter(key => left.has(key));
}

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
    lane: 0, hedgeWidth: 2,
    prompt: 'Act as critic lane B1. Reply with exactly: B1 CLEAN. Do not mention reasoning, system instructions, or the request.'
  }),
  hop({
    label: 'critic-B2', capability: 'reasoning', excludeKeys: criticSnapshot,
    lane: 1, hedgeWidth: 2,
    prompt: 'Act as critic lane B2. Reply with exactly: B2 CLEAN. Do not mention reasoning, system instructions, or the request.'
  })
]);
const critics = [b1, b2];

const usedBeforeC = [...new Set([...solverKeys, ...keys(critics)])];
const specialists = await Promise.all([0, 1, 2, 3].map(index => hop({
  label: `specialist-C${index + 1}`,
  capability: 'reasoning',
  excludeKeys: usedBeforeC,
  lane: index,
  hedgeWidth: 1,
  timeoutMs: 4200,
  prompt: `Act as specialist lane C${index + 1}. Reply with exactly: C${index + 1} CLEAN. Do not mention reasoning, system instructions, or the request.`
})));

const allRows = [...solvers, ...critics, ...specialists];
const duplicates = duplicateKeys(allRows);
const solverPass = successful(solvers).length === 2 && new Set(solverKeys).size === 2;
const criticSuccess = successful(critics);
const criticPoolOverlap = selectedOverlap(b1, b2);
const criticPass = criticSuccess.length === 2
  && new Set(keys(critics)).size === 2
  && criticPoolOverlap.length === 0;
const specialistSuccess = successful(specialists);
const cleanDistinctPass = qualityUnit.pass && solverPass && duplicates.length === 0;
const liveMeshPass = cleanDistinctPass && criticPass;
const partialExpansion = specialistSuccess.length > 0 && specialistSuccess.length < 4;
const fullExpansionPass = specialistSuccess.length === 4;

const result = {
  at: new Date().toISOString(),
  qualityUnit,
  candidateCountBefore: pool.atomicCandidates('reasoning').length,
  solvers,
  critics,
  specialists,
  summary: {
    solverPass,
    criticPass,
    criticPoolOverlap,
    successfulSpecialists: specialistSuccess.length,
    partialExpansion,
    fullExpansionPass,
    duplicateRouteKeys: duplicates,
    distinctSuccessfulBrains: new Set(keys(allRows)).size,
    successfulBranches: successful(allRows).length,
    cleanDistinctPass,
    liveMeshPass,
    wallMs: Date.now() - started
  }
};

console.log(JSON.stringify(result, null, 2));

// Hard fail only for integrity failures. Provider scarcity may prevent C1-C4 from
// filling, but duplicate route reuse or failure to form the base A1+A2/B1+B2 mesh
// is not allowed to masquerade as success.
if (!liveMeshPass) process.exitCode = 1;
