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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchStatus(timeoutMs) {
  const response = await bounded(fetch(`${BACKEND_URL}/v1/status`, { cache: 'no-store' }), timeoutMs);
  if (!response.ok) throw new Error(`NOVA registry HTTP ${response.status}.`);
  const data = await response.json();
  return data && typeof data === 'object' && data.ok === true ? data : null;
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

async function freshFirebaseAuthToken() {
  if (typeof document === 'undefined') return '';
  try {
    const firebase = await import('./core/firebase-backend.js');
    const user = firebase?.firebaseAuth?.currentUser
      || (typeof firebase?.waitForFirebaseUser === 'function' ? await firebase.waitForFirebaseUser(900) : null);
    if (!user || typeof user.getIdToken !== 'function') return '';
    return String(await user.getIdToken(false) || '').trim();
  } catch (error) {
    console.warn('[NOVA Relay] Firebase Auth proof unavailable.', error);
    return '';
  }
}

export async function getAtomicBackendPlan(prompt) {
  if (!ready() || Date.now() < backendCoolingUntil) return null;
  try {
    const capability = capabilityOf(prompt);
    const data = await post('/v1/plan', { capability }, 2200);
    if (!data || !Array.isArray(data.candidates)) return null;
    return data;
  } catch (error) {
    coolDown(error);
    console.warn('[NOVA ARIM] Cloudflare registry plan unavailable; local chain continues.', error);
    return null;
  }
}

export async function getAtomicCapabilityPlan(capability = 'general') {
  if (!ready() || Date.now() < backendCoolingUntil) return null;
  const allowed = new Set(['general', 'coding', 'reasoning', 'research', 'multilingual']);
  const safeCapability = allowed.has(String(capability)) ? String(capability) : 'general';
  try {
    const data = await post('/v1/plan', { capability: safeCapability }, 3000);
    return data && Array.isArray(data.candidates) ? data : null;
  } catch (error) {
    coolDown(error);
    return null;
  }
}

export async function getAtomicBackendStatus() {
  if (!ready()) return null;

  // Mobile WebViews can take longer than desktop browsers to establish the first
  // Worker connection. Status is authoritative telemetry, so give it a bounded
  // retry instead of turning a transient 1.8s network delay into a blank dashboard.
  try {
    const first = await fetchStatus(4500);
    if (first) return first;
  } catch (error) {
    console.warn('[NOVA ARIM] Registry status first attempt failed; retrying once.', error);
  }

  await wait(250);
  try {
    return await fetchStatus(3000);
  } catch (error) {
    console.warn('[NOVA ARIM] Registry status unavailable after retry.', error);
    return null;
  }
}


export async function generateViaAtomicRelay(prompt, options = {}) {
  if (!ready()) throw new Error('NOVA relay is not configured.');
  const value = String(prompt || '').trim();
  if (!value) throw new Error('NOVA relay prompt is empty.');

  // App Check remains the preferred attestation. Phone-test/debug builds
  // can still prove a real NexusNova session with a Firebase Auth ID token
  // when device attestation is slow or unavailable.
  const [appCheckToken, authToken] = await Promise.all([
    bounded(freshAppCheckToken(), 1400).catch(() => ''),
    bounded(freshFirebaseAuthToken(), 1400).catch(() => '')
  ]);
  if (!appCheckToken && !authToken) throw new Error('NOVA relay authentication is unavailable.');

  const allowed = new Set(['general', 'coding', 'reasoning', 'research', 'multilingual']);
  const capability = allowed.has(String(options.capability || '')) ? String(options.capability) : capabilityOf(value);
  const headers = {};
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const data = await post('/v1/generate', {
    prompt: value.slice(0, 12000),
    capability,
    maxTokens: Math.max(96, Math.min(900, Number(options.maxTokens || 700) || 700)),
    temperature: Math.max(0.1, Math.min(1, Number(options.temperature ?? 0.4) || 0.4))
  }, 5600, headers);
  if (!data?.ok || !String(data?.text || '').trim()) throw new Error(`NOVA relay failed: ${String(data?.error || 'empty-answer')}`);
  return {
    text: String(data.text).trim(),
    provider: String(data.provider || 'NOVA Relay'),
    model: String(data.model || 'worker-route'),
    latencyMs: Math.max(0, Number(data.latencyMs || 0)),
    capability
  };
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
    const dimensions = payload.semanticDimensions && typeof payload.semanticDimensions === 'object'
      ? payload.semanticDimensions
      : {};
    body.semanticDimensions = Object.fromEntries(
      ['correctness', 'completeness', 'hallucination', 'instructionFollowing', 'evidenceQuality']
        .filter(key => Number.isFinite(dimensions[key]))
        .map(key => [key, Math.max(0, Math.min(1, Number(dimensions[key])))])
    );
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
