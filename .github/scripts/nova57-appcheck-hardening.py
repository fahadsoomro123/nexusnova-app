from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


worker_path = Path("cloudflare/nova-brain-worker/src/index.js")
worker = worker_path.read_text(encoding="utf-8")

worker = replace_once(
    worker,
    "const CLIENT_AGENT = 'NexusNova:5.7-cloudflare-registry';\n",
    """const CLIENT_AGENT = 'NexusNova:5.7-cloudflare-registry';
const APP_CHECK_PROJECT_NUMBER = '49791194817';
const APP_CHECK_JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const APP_CHECK_ISSUER = `https://firebaseappcheck.googleapis.com/${APP_CHECK_PROJECT_NUMBER}`;
const APP_CHECK_AUDIENCE = `projects/${APP_CHECK_PROJECT_NUMBER}`;
const ALLOWED_APP_CHECK_SUBJECTS = new Set([
  '1:49791194817:android:5234c6fb65effb51536640',
  '1:49791194817:web:07f28326e0f15979536640'
]);
const MAX_APP_CHECK_TOKEN_CHARS = 8192;
let appCheckJwksCache = { expiresAt: 0, keys: new Map() };
""",
    "App Check constants",
)

worker = replace_once(
    worker,
    "'access-control-allow-headers': 'content-type',",
    "'access-control-allow-headers': 'content-type,x-firebase-appcheck',",
    "CORS App Check header",
)

sha_anchor = """async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
"""
appcheck_helpers = sha_anchor + """
function base64UrlBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function base64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
}

function appCheckAudienceMatches(aud) {
  return Array.isArray(aud) ? aud.includes(APP_CHECK_AUDIENCE) : aud === APP_CHECK_AUDIENCE;
}

async function loadAppCheckJwks(force = false) {
  if (!force && appCheckJwksCache.keys.size && now() < appCheckJwksCache.expiresAt) {
    return appCheckJwksCache.keys;
  }
  const response = await fetch(APP_CHECK_JWKS_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`app-check-jwks-${response.status}`);
  const data = await response.json();
  const keys = new Map((Array.isArray(data?.keys) ? data.keys : [])
    .filter(key => key?.kid)
    .map(key => [String(key.kid), key]));
  if (!keys.size) throw new Error('app-check-jwks-empty');
  const maxAgeMatch = /(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') || '');
  const maxAgeSeconds = Math.min(21600, Math.max(300, Number(maxAgeMatch?.[1] || 3600)));
  appCheckJwksCache = { keys, expiresAt: now() + maxAgeSeconds * 1000 };
  return keys;
}

async function appCheckJwk(kid) {
  let keys = await loadAppCheckJwks(false);
  if (!keys.has(kid)) keys = await loadAppCheckJwks(true);
  return keys.get(kid) || null;
}

async function verifyAppCheckToken(token) {
  try {
    const raw = String(token || '').trim();
    if (!raw || raw.length > MAX_APP_CHECK_TOKEN_CHARS) return null;
    const parts = raw.split('.');
    if (parts.length !== 3 || parts.some(part => !part)) return null;
    const header = base64UrlJson(parts[0]);
    const payload = base64UrlJson(parts[1]);
    if (header?.alg !== 'RS256' || header?.typ !== 'JWT' || !header?.kid) return null;
    const jwk = await appCheckJwk(String(header.kid));
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlBytes(parts[2]);
    const signatureOk = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
    if (!signatureOk) return null;
    const epochSeconds = Math.floor(now() / 1000);
    if (payload?.iss !== APP_CHECK_ISSUER) return null;
    if (!appCheckAudienceMatches(payload?.aud)) return null;
    if (!Number.isFinite(Number(payload?.exp)) || Number(payload.exp) <= epochSeconds) return null;
    if (Number.isFinite(Number(payload?.nbf)) && Number(payload.nbf) > epochSeconds + 60) return null;
    if (!ALLOWED_APP_CHECK_SUBJECTS.has(String(payload?.sub || ''))) return null;
    return payload;
  } catch {
    return null;
  }
}
"""
worker = replace_once(worker, sha_anchor, appcheck_helpers, "App Check JWT verifier")

route_anchor = """  const routeKey = `${provider}::${modelId}`;

  await env.DB.prepare(`INSERT INTO route_health(
"""
route_hardened = """  const routeKey = `${provider}::${modelId}`;
  const existingRoute = await env.DB.prepare('SELECT route_key FROM route_health WHERE route_key = ?1')
    .bind(routeKey).first();
  if (!existingRoute?.route_key) throw new Error('unknown-route');

  await env.DB.prepare(`INSERT INTO route_health(
"""
worker = replace_once(worker, route_anchor, route_hardened, "Known-route feedback guard")

endpoint_anchor = """  if (request.method === 'POST' && url.pathname === '/v1/outcome') {
    let body = {};
    try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid-json' }, 400); }
    try { return json(await applyOutcome(env, body), 202); }
    catch { return json({ ok: false, error: 'invalid-route' }, 400); }
  }
"""
endpoint_hardened = """  if (request.method === 'POST' && url.pathname === '/v1/outcome') {
    const appCheckToken = request.headers.get('x-firebase-appcheck') || '';
    const appCheckClaims = await verifyAppCheckToken(appCheckToken);
    if (!appCheckClaims) return json({ ok: false, error: 'app-check-required' }, 401);
    let body = {};
    try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid-json' }, 400); }
    try { return json(await applyOutcome(env, body), 202); }
    catch (error) {
      return json({ ok: false, error: String(error?.message || '') === 'unknown-route' ? 'unknown-route' : 'invalid-route' }, 400);
    }
  }
"""
worker = replace_once(worker, endpoint_anchor, endpoint_hardened, "Protected outcome endpoint")
worker_path.write_text(worker, encoding="utf-8")

client_path = Path("fresh-rebuild/src/nova57-atomic-backend-client.js")
client = client_path.read_text(encoding="utf-8")

client = replace_once(
    client,
    """async function post(path, body, timeoutMs) {
  const response = await bounded(fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  }), timeoutMs);
  if (!response.ok) throw new Error(`NOVA registry HTTP ${response.status}.`);
  return response.json();
}
""",
    """async function post(path, body, timeoutMs, extraHeaders = {}) {
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
""",
    "Client App Check token helper",
)

client = replace_once(
    client,
    """  Promise.resolve().then(async () => {
    try {
      await post('/v1/outcome', body, 1500);
    } catch (error) {
      coolDown(error);
      console.warn('[NOVA ARIM] Cloudflare learning feedback unavailable; local memory remains active.', error);
    }
  });
""",
    """  Promise.resolve().then(async () => {
    try {
      const appCheckToken = await freshAppCheckToken();
      if (!appCheckToken) return;
      await post('/v1/outcome', body, 2200, { 'X-Firebase-AppCheck': appCheckToken });
    } catch (error) {
      console.warn('[NOVA ARIM] Cloudflare learning feedback unavailable; local memory remains active.', error);
    }
  });
""",
    "Client protected feedback request",
)
client_path.write_text(client, encoding="utf-8")

print("NOVA App Check hardening patch applied.")
