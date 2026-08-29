// Speed gate rerun after bounded/cached JWKS production deploy.
const FIREBASE_API_KEY = 'AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0';
const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const RELAY_URL = 'https://nexusnova-brain-router.fahadsoomro123.workers.dev/v1/generate';
const MAX_RELAY_WALL_MS = 5500;

async function jsonRequest(url, init = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`;
      throw new Error(`${response.status} ${String(detail).slice(0, 300)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function createAnonymousSession() {
  return jsonRequest(`${FIREBASE_AUTH_URL}:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  }, 15000);
}

async function createPasswordSession() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return jsonRequest(`${FIREBASE_AUTH_URL}:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `nova-relay-smoke-${stamp}@example.invalid`,
      password: `Nn!${stamp}x7`,
      returnSecureToken: true
    })
  }, 15000);
}

async function createEphemeralSession() {
  try {
    return { session: await createAnonymousSession(), auth: 'ephemeral-firebase-anonymous-session' };
  } catch (anonymousError) {
    const message = String(anonymousError?.message || anonymousError);
    if (!/ADMIN_ONLY_OPERATION|OPERATION_NOT_ALLOWED/.test(message)) throw anonymousError;
    return { session: await createPasswordSession(), auth: 'ephemeral-firebase-password-session' };
  }
}

async function deleteSession(idToken) {
  if (!idToken) return;
  await jsonRequest(`${FIREBASE_AUTH_URL}:delete?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken })
  }, 15000);
}

async function relay(idToken, capability, marker) {
  const started = Date.now();
  const data = await jsonRequest(RELAY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      prompt: `Reply with exactly ${marker}. No other text.`,
      capability,
      maxTokens: 64,
      temperature: 0.1
    })
  }, 20000);
  const wallMs = Date.now() - started;
  const answer = String(data?.text || '').trim();
  if (data?.ok !== true || !answer.includes(marker)) {
    throw new Error(`${capability} relay returned an invalid answer: ${answer.slice(0, 180) || 'empty'}`);
  }
  if (wallMs > MAX_RELAY_WALL_MS) {
    throw new Error(`${capability} relay was functionally correct but too slow: ${wallMs}ms > ${MAX_RELAY_WALL_MS}ms`);
  }
  return {
    capability,
    ok: true,
    provider: String(data.provider || ''),
    model: String(data.model || ''),
    providerLatencyMs: Number(data.latencyMs || 0),
    wallMs,
    maxAllowedWallMs: MAX_RELAY_WALL_MS,
    marker
  };
}

let idToken = '';
let authMode = '';
let primaryError = null;
try {
  const created = await createEphemeralSession();
  const session = created.session;
  authMode = created.auth;
  idToken = String(session?.idToken || '').trim();
  if (!idToken) throw new Error('Firebase ephemeral sign-in returned no ID token.');

  const general = await relay(idToken, 'general', 'NOVA_PHONE_GENERAL_OK');
  const coding = await relay(idToken, 'coding', 'NOVA_PHONE_CODE_OK');
  console.log(JSON.stringify({
    ok: true,
    auth: authMode,
    general,
    coding,
    testedAt: new Date().toISOString()
  }, null, 2));
} catch (error) {
  primaryError = error;
} finally {
  try {
    await deleteSession(idToken);
  } catch (cleanupError) {
    if (!primaryError) primaryError = new Error(`Relay passed but temporary Firebase test user cleanup failed: ${cleanupError?.message || cleanupError}`);
    else console.error(`Temporary Firebase test user cleanup also failed: ${cleanupError?.message || cleanupError}`);
  }
}

if (primaryError) throw primaryError;