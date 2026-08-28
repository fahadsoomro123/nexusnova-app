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
    return {
      label,
      ok: true,
      routeKey: result.__novaAtomicRouteKey || '',
      text: readText(result).slice(0, 160),
      wallMs: Date.now() - started,
      brain: globalThis.__NOVA_BRAIN_LAST__ || null
    };
  } catch (error) {
    return {
      label,
      ok: false,
      routeKey: '',
      error: String(error?.message || error).slice(0, 300),
      wallMs: Date.now() - started
    };
  }
}

const first = await hop(
  'primary',
  'Reply with a short sentence confirming that the first ACRM brain is alive.',
  { capability: 'general', timeoutMs: 4200 }
);

const excludeKeys = first.routeKey ? [first.routeKey] : [];
const second = await hop(
  'verifier',
  'Reply with a short sentence confirming that the second distinct ACRM brain is alive.',
  { capability: 'reasoning', excludeKeys, timeoutMs: 4200 }
);

const result = {
  at: new Date().toISOString(),
  primary: first,
  verifier: second,
  distinct: Boolean(first.routeKey && second.routeKey && first.routeKey !== second.routeKey),
  liveTwoHopPass: Boolean(first.ok && second.ok && first.routeKey && second.routeKey && first.routeKey !== second.routeKey),
  localMemoryRows: mod.atomicBrainMemorySnapshot().length
};

console.log('\n=== NOVA ACRM LIVE TWO-HOP SMOKE ===');
console.log(JSON.stringify(result, null, 2));

// Diagnostic workflow: provider volatility should be visible in logs without
// polluting the repository with a red CI gate. Static ACRM CI remains the gate.
process.exitCode = 0;
