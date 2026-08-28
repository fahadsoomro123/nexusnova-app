// NOVA 5.7 ARIM — Cloudflare D1 registry bridge.
// Only a locally classified capability is sent for planning; raw user prompts are
// not sent to or stored by the registry. Outcome learning contains route stats only.

const BACKEND_URL = 'https://nexusnova-brain-router.fahadsoomro123.workers.dev';
let backendCoolingUntil = 0;

function bounded(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`ARIM registry bridge exceeded ${timeoutMs}ms.`)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function ready() {
  return /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/i.test(BACKEND_URL);
}

function capabilityOf(prompt) {
  const s = String(prompt || '').toLowerCase();
  if (/\b(code|coding|bug|debug|javascript|typescript|python|java|kotlin|swift|sql|github|repository|function|class|api|architecture)\b/.test(s)) return 'coding';
  if (/\b(reason|reasoning|logic|math|prove|derive|constraint|puzzle|schedule|algorithm|calculate|analysis)\b/.test(s)) return 'reasoning';
  if (/\b(research|latest|current|today|news|web|internet|sources?|evidence|verify online)\b/.test(s)) return 'research';
  if (/\b(urdu|roman urdu|roman-urdu|hinglish|multilingual|translate|translation)\b/.test(s)) return 'multilingual';
  return 'general';
}

function coolDown(error) {
  const message = String(error?.message || error || '').toLowerCase();
  backendCoolingUntil = Date.now() + (/429|rate.?limit|quota/.test(message) ? 60_000 : 15_000);
}

async function post(path, body, timeoutMs, extraHeaders = {}) {
  const response = await bounded(fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
    cache: 'no-store'
  }), timeoutMs);
  if (!response.ok) throw new Error(`NOVA registry HTTP ${response.status}.`);
  return response.json();
}

async function freshAppCheckToken() {
  if (typeof document === 'undefined') return '';
  try {
    const firebase = await import('./core/firebase-backend.js');
    if (typeof firebase?.requireFreshAppCheck !== 'function') return '';
    const result = await firebase.requireFreshAppCheck();
    return String(result?.token || '').trim();
  } catch (error) {
    console.warn('[NOVA ARIM] App Check feedback proof unavailable; local route memory continues.', error);
    return '';
  }
}

export async function getAtomicBackendPlan(prompt) {
  if (!ready() || Date.now() < backendCoolingUntil) return null;
  try {
    const capability = capabilityOf(prompt);
    const data = await post('/v1/plan', { capability }, 1350);
    if (!data || !Array.isArray(data.candidates)) return null;
    return data;
  } catch (error) {
    coolDown(error);
    console.warn('[NOVA ARIM] Cloudflare registry plan unavailable; local chain continues.', error);
    return null;
  }
}

export function reportAtomicOutcome(payload = {}) {
  if (!ready() || Date.now() < backendCoolingUntil) return;
  const provider = String(payload.provider || '').trim();
  const modelId = String(payload.modelId || payload.model || '').trim();
  if (!provider || !modelId || provider === 'NOVA Local') return;

  const body = {
    source: String(payload.source || provider).slice(0, 80),
    provider: provider.slice(0, 80),
    modelId: modelId.slice(0, 240),
    capability: String(payload.capability || 'general').slice(0, 30),
    outcome: String(payload.outcome || 'success').slice(0, 30),
    transportOutcome: String(payload.transportOutcome || payload.outcome || 'success').slice(0, 30),
    latencyMs: Math.max(0, Math.min(120000, Number(payload.latencyMs || 0))),
    role: String(payload.role || '').slice(0, 40)
  };
  // Semantic quality is deliberately optional. A successful HTTP/model response
  // proves availability, not correctness. Only an explicit evaluator score may
  // enter semantic learning; unknown quality remains unknown.
  if (Number.isFinite(payload.semanticQuality)) {
    body.semanticQuality = Math.max(0, Math.min(1, Number(payload.semanticQuality)));
    body.evaluator = String(payload.evaluator || '').slice(0, 40);
  }

  Promise.resolve().then(async () => {
    try {
      const appCheckToken = await freshAppCheckToken();
      if (!appCheckToken) return;
      await post('/v1/outcome', body, 2200, { 'X-Firebase-AppCheck': appCheckToken });
    } catch (error) {
      console.warn('[NOVA ARIM] Cloudflare learning feedback unavailable; local memory remains active.', error);
    }
  });
}

export function novaBrainBackendUrl() {
  return ready() ? BACKEND_URL : '';
}
