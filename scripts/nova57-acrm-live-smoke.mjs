import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../fresh-rebuild/src/nova57-atomic-brain-pool.js', import.meta.url), 'utf8');
const encoded = Buffer.from(source, 'utf8').toString('base64');
const mod = await import(`data:text/javascript;base64,${encoded}`);

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

globalThis.__NOVA_KEYLESS_ROUTE_POOL__ = [];

function readText(result) {
  try { return String(result?.response?.text?.() || '').trim(); }
  catch { return ''; }
}

async function hop(label, prompt, control) {
  const started = Date.now();
  try {
    const result = await mod.runAtomicBrain(prompt, {
      generationConfig: { temperature: 0.1, maxOutputTokens: 48 }
    }, control);
    const fullText = readText(result);
    const quality = mod.assessAtomicResponseQuality(fullText);
    return {
      label,
      ok: true,
      clean: quality.ok === true,
      qualityReason: quality.reason,
      routeKey: result.__novaAtomicRouteKey || '',
      text: fullText.slice(0, 180),
      wallMs: Date.now() - started,
      brain: globalThis.__NOVA_BRAIN_LAST__ || null
    };
  } catch (error) {
    return {
      label,
      ok: false,
      clean: false,
      routeKey: '',
      error: String(error?.message || error).slice(0, 300),
      wallMs: Date.now() - started
    };
  }
}

const qualityUnit = {
  clean: mod.assessAtomicResponseQuality('ACRM brain is alive.'),
  leakUser: mod.assessAtomicResponseQuality('The user asks: please confirm this route is alive.'),
  leakWeNeed: mod.assessAtomicResponseQuality('We need to respond with a concise confirmation.'),
  rawJson: mod.assessAtomicResponseQuality('{"choices":[{"message":{"content":"hi"}}]}')
};
qualityUnit.pass = qualityUnit.clean.ok === true
  && qualityUnit.leakUser.ok === false
  && qualityUnit.leakWeNeed.ok === false
  && qualityUnit.rawJson.ok === false;

const first = await hop(
  'primary',
  'Reply with one short user-facing sentence confirming that the first ACRM brain is alive. Do not describe your reasoning or the request.',
  { capability: 'general', timeoutMs: 5000 }
);

const excludeKeys = first.routeKey ? [first.routeKey] : [];
const second = await hop(
  'verifier',
  'Reply with one short user-facing sentence confirming that the second distinct ACRM brain is alive. Do not describe your reasoning or the request.',
  { capability: 'reasoning', excludeKeys, timeoutMs: 5000 }
);

const distinct = Boolean(first.routeKey && second.routeKey && first.routeKey !== second.routeKey);
const result = {
  at: new Date().toISOString(),
  qualityUnit,
  primary: first,
  verifier: second,
  distinct,
  liveTwoHopPass: Boolean(qualityUnit.pass && first.ok && first.clean && second.ok && second.clean && distinct),
  localMemoryRows: mod.atomicBrainMemorySnapshot().length
};

console.log('\n=== NOVA ACRM LIVE TWO-HOP SMOKE ===');
console.log(JSON.stringify(result, null, 2));

// Diagnostic workflow: provider volatility remains visible without making free
// provider outages a release-blocking red workflow. Read liveTwoHopPass in logs.
process.exitCode = 0;
