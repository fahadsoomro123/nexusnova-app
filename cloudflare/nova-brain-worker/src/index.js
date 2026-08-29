const TARGET_CATALOG = 200000;
const HF_PAGE_SIZE = 100;
const HF_PAGES_PER_REFRESH = 10;
const PROBE_INTERVAL_MS = 60 * 60 * 1000;
const MAX_PROBES = 4;
const ALLOWED_CAPABILITIES = new Set(['general', 'coding', 'reasoning', 'research', 'multilingual']);
const ALLOWED_PROVIDERS = new Set(['Kilo', 'OVHcloud', 'AI Horde', 'OpenRouter', 'Pollinations']);
const CALLABLE_CLIENT_PROVIDERS = new Set(['Kilo', 'OVHcloud']);
const SEMANTIC_EVALUATORS = new Set(['benchmark', 'deterministic-verifier', 'judge-crosscheck']);
const SEMANTIC_DIMENSIONS = new Set(['correctness', 'completeness', 'hallucination', 'instructionFollowing', 'evidenceQuality']);
const BENCHMARKS = [
  { capability: 'reasoning', prompt: 'Compute 17 multiplied by 19. Reply exactly NOVA_323.', expected: 'NOVA_323' },
  { capability: 'coding', prompt: 'JavaScript: let x=2; for(let i=0;i<3;i++) x*=2; Reply exactly NOVA_16.', expected: 'NOVA_16' },
  { capability: 'general', prompt: 'Follow this instruction: reply exactly NOVA_BLUE. No other text.', expected: 'NOVA_BLUE' },
  { capability: 'multilingual', prompt: 'Urdu word kitab means book in English. Reply exactly NOVA_BOOK.', expected: 'NOVA_BOOK' },
  { capability: 'reasoning', prompt: 'Sequence 2, 6, 12, 20, 30. Reply with the next number exactly as NOVA_42.', expected: 'NOVA_42' }
];

const KILO_BASE = 'https://api.kilo.ai/api/gateway';
const OVH_BASE = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1';
const HORDE_BASE = 'https://aihorde.net/api/v2';
const CLIENT_AGENT = 'NexusNova:5.7-cloudflare-registry';
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
const FIREBASE_AUTH_PROJECT_ID = 'nexusnova-6ade2';
const FIREBASE_AUTH_ISSUER = `https://securetoken.google.com/${FIREBASE_AUTH_PROJECT_ID}`;
const FIREBASE_AUTH_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let firebaseAuthJwksCache = { expiresAt: 0, keys: new Map() };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-firebase-appcheck,authorization',
      ...extra
    }
  });
}

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function lower(value) {
  return text(value, 400).toLowerCase();
}

function now() {
  return Date.now();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

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


async function loadFirebaseAuthJwks(force = false) {
  if (!force && firebaseAuthJwksCache.keys.size && now() < firebaseAuthJwksCache.expiresAt) {
    return firebaseAuthJwksCache.keys;
  }
  const response = await fetch(FIREBASE_AUTH_JWKS_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`firebase-auth-jwks-${response.status}`);
  const data = await response.json();
  const rows = Array.isArray(data?.keys) ? data.keys : [];
  const keys = new Map(rows.filter(key => key?.kid).map(key => [String(key.kid), key]));
  if (!keys.size) throw new Error('firebase-auth-jwks-empty');
  const maxAgeMatch = /(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') || '');
  const maxAgeSeconds = Math.min(21600, Math.max(300, Number(maxAgeMatch?.[1] || 3600)));
  firebaseAuthJwksCache = { keys, expiresAt: now() + maxAgeSeconds * 1000 };
  return keys;
}

async function verifyFirebaseAuthToken(token) {
  try {
    const raw = String(token || '').trim();
    if (!raw || raw.length > 8192) return null;
    const parts = raw.split('.');
    if (parts.length !== 3 || parts.some(part => !part)) return null;
    const header = base64UrlJson(parts[0]);
    const payload = base64UrlJson(parts[1]);
    if (header?.alg !== 'RS256' || !header?.kid) return null;
    let keys = await loadFirebaseAuthJwks(false);
    if (!keys.has(String(header.kid))) keys = await loadFirebaseAuthJwks(true);
    const jwk = keys.get(String(header.kid));
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlBytes(parts[2]);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed)) return null;
    const epochSeconds = Math.floor(now() / 1000);
    if (payload?.iss !== FIREBASE_AUTH_ISSUER || payload?.aud !== FIREBASE_AUTH_PROJECT_ID) return null;
    if (!payload?.sub || String(payload.sub).length > 128) return null;
    if (!Number.isFinite(Number(payload?.exp)) || Number(payload.exp) <= epochSeconds) return null;
    if (Number.isFinite(Number(payload?.iat)) && Number(payload.iat) > epochSeconds + 60) return null;
    return payload;
  } catch {
    return null;
  }
}

function inferCapabilities(modelId, pipeline = '', tags = []) {
  const s = `${lower(modelId)} ${lower(pipeline)} ${lower(Array.isArray(tags) ? tags.join(' ') : '')}`;
  const caps = new Set(['general']);
  if (/code|coder|coding|devstral|starcoder|codestral/.test(s)) caps.add('coding');
  if (/reason|r1|thinking|math|qwq|logic|proof/.test(s)) caps.add('reasoning');
  if (/multilingual|urdu|qwen|gemma|llama|mistral/.test(s)) caps.add('multilingual');
  if (/text-generation|conversational|chat|instruct|assistant/.test(s)) caps.add('chat');
  if (/vision|image-to-text|vl|multimodal/.test(s)) caps.add('vision');
  if (/embed|feature-extraction|rerank/.test(s)) caps.add('retrieval');
  if (/speech|audio|whisper|tts/.test(s)) caps.add('audio');
  if (/diffusion|text-to-image|image-generation|flux|sdxl/.test(s)) caps.add('image');
  return [...caps];
}

function normalizeHF(row) {
  const modelId = text(row?.id || row?.modelId || row?.model || row?.name, 240);
  if (!modelId) return null;
  return {
    source: 'HuggingFace',
    provider: 'HuggingFace',
    modelId,
    pipeline: text(row?.pipeline_tag || '', 80),
    downloads: Math.max(0, Number(row?.downloads || 0) || 0),
    likes: Math.max(0, Number(row?.likes || 0) || 0),
    capabilities: inferCapabilities(modelId, row?.pipeline_tag, row?.tags),
    updatedAt: text(row?.lastModified || row?.last_modified || '', 80)
  };
}

function nextLink(headers) {
  const raw = headers.get('link') || '';
  for (const part of raw.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (match) return match[1];
  }
  return '';
}

async function fetchJson(url, init = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text(data?.error?.message || data?.message || raw, 180)}`);
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

async function getMeta(env, key, fallback = '') {
  const row = await env.DB.prepare('SELECT value FROM meta WHERE key = ?1').bind(key).first();
  return row?.value ?? fallback;
}

async function setMeta(env, key, value) {
  await env.DB.prepare(`INSERT INTO meta(key,value,updated_at) VALUES(?1,?2,?3)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .bind(key, String(value), now()).run();
}

async function saveShard(env, source, shardKey, records) {
  if (!records.length) return 0;
  const body = JSON.stringify(records);
  const fingerprint = (await sha256(body)).slice(0, 32);
  await env.DB.prepare(`INSERT INTO catalog_shards(source,shard_key,records_json,record_count,fingerprint,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6)
    ON CONFLICT(source,shard_key) DO UPDATE SET records_json=excluded.records_json, record_count=excluded.record_count,
      fingerprint=excluded.fingerprint, updated_at=excluded.updated_at`)
    .bind(source, shardKey, body, records.length, fingerprint, now()).run();
  return records.length;
}

async function refreshHuggingFace(env, pages = HF_PAGES_PER_REFRESH) {
  let totalSeen = Number(await getMeta(env, 'hf_total_seen', '0')) || 0;
  if (totalSeen >= TARGET_CATALOG) return { totalSeen, added: 0, complete: true, pages: 0 };

  let cursorUrl = await getMeta(env, 'hf_cursor_url', '');
  if (!cursorUrl) cursorUrl = `https://huggingface.co/api/models?limit=${HF_PAGE_SIZE}&sort=downloads&direction=-1&full=false`;
  let added = 0;
  let pageCount = 0;

  for (let i = 0; i < pages && totalSeen < TARGET_CATALOG && cursorUrl; i += 1) {
    const { response, data } = await fetchJson(cursorUrl, { headers: { accept: 'application/json' } }, 9000);
    const rows = (Array.isArray(data) ? data : []).map(normalizeHF).filter(Boolean);
    if (!rows.length) break;
    const remaining = TARGET_CATALOG - totalSeen;
    const clipped = rows.slice(0, remaining);
    const shardIndex = Math.floor(totalSeen / HF_PAGE_SIZE);
    const shardKey = `hf-${String(shardIndex).padStart(6, '0')}`;
    added += await saveShard(env, 'HuggingFace', shardKey, clipped);
    totalSeen += clipped.length;
    pageCount += 1;
    cursorUrl = nextLink(response.headers);
    await Promise.all([
      setMeta(env, 'hf_total_seen', totalSeen),
      setMeta(env, 'hf_cursor_url', cursorUrl || ''),
      setMeta(env, 'catalog_target', TARGET_CATALOG)
    ]);
    if (clipped.length < rows.length) break;
  }

  return { totalSeen, added, complete: totalSeen >= TARGET_CATALOG, pages: pageCount };
}

function routeCapability(modelId) {
  const s = lower(modelId);
  if (/code|coder|devstral|starcoder|codestral/.test(s)) return 'coding';
  if (/reason|r1|thinking|math|qwq|logic/.test(s)) return 'reasoning';
  if (/qwen|llama|mistral|gemma/.test(s)) return 'multilingual';
  return 'general';
}

async function seedRoute(env, provider, modelId, priority = 0) {
  const routeKey = `${provider}::${modelId}`;
  const capability = routeCapability(modelId);
  const baseHealth = Math.max(0.25, Math.min(0.7, 0.42 + priority / 500));
  await env.DB.prepare(`INSERT INTO route_health(route_key,provider,model_id,capability,health_score,quality,last_seen_at)
    VALUES(?1,?2,?3,?4,?5,0,?6)
    ON CONFLICT(route_key) DO UPDATE SET provider=excluded.provider, model_id=excluded.model_id,
      capability=CASE WHEN route_health.capability='general' THEN excluded.capability ELSE route_health.capability END,
      last_seen_at=excluded.last_seen_at`)
    .bind(routeKey, provider, modelId, capability, baseHealth, now()).run();
}

function modelRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.models)) return data.models;
  return [];
}

async function refreshProviderCatalogs(env) {
  const summary = { kilo: 0, ovh: 0, horde: 0 };

  try {
    const { data } = await fetchJson(`${KILO_BASE}/models`, {}, 6500);
    const selected = [];
    for (const row of modelRows(data)) {
      const id = text(row?.id || row?.model || row?.name, 240);
      if (!id) continue;
      const price = row?.pricing || row?.price || row?.cost || {};
      const zero = Number(price?.input ?? price?.prompt ?? NaN) === 0 && Number(price?.output ?? price?.completion ?? NaN) === 0;
      if (/:free$/i.test(id) || id === 'openrouter/free' || id === 'kilo-auto/free' || zero) selected.push(id);
    }
    for (const id of selected.slice(0, 80)) await seedRoute(env, 'Kilo', id, 118);
    summary.kilo = selected.length;
  } catch {}

  try {
    const { data } = await fetchJson(`${OVH_BASE}/models`, {}, 6500);
    const selected = modelRows(data)
      .map(row => text(row?.id || row?.model || row?.name, 240))
      .filter(id => id && !/embed|rerank|guard|moderation/i.test(id));
    for (const id of selected.slice(0, 80)) await seedRoute(env, 'OVHcloud', id, 96);
    summary.ovh = selected.length;
  } catch {}

  try {
    const { data } = await fetchJson(`${HORDE_BASE}/status/models?type=text`, { headers: { 'Client-Agent': CLIENT_AGENT } }, 7000);
    const selected = (Array.isArray(data) ? data : [])
      .filter(row => Number(row?.count ?? row?.workers ?? 0) > 0)
      .map(row => text(row?.name || row?.id || row?.model, 240))
      .filter(id => id && !/nsfw|roleplay|erp/i.test(id));
    for (const id of selected.slice(0, 40)) await seedRoute(env, 'AI Horde', id, 70);
    summary.horde = selected.length;
  } catch {}

  await setMeta(env, 'provider_refresh_at', now());
  return summary;
}

async function applyOutcome(env, body) {
  const provider = text(body?.provider || body?.source, 80);
  const modelId = text(body?.modelId || body?.model, 240);
  if (!ALLOWED_PROVIDERS.has(provider) || !modelId) throw new Error('invalid-route');
  const capability = ALLOWED_CAPABILITIES.has(text(body?.capability, 30)) ? text(body.capability, 30) : 'general';
  const outcome = ['success', 'failure', 'timeout', 'rate-limit', 'auth'].includes(text(body?.outcome, 30)) ? text(body.outcome, 30) : 'failure';
  const latency = Math.max(0, Math.min(120000, Number(body?.latencyMs || 0) || 0));
  const evaluator = text(body?.evaluator, 40);
  const hasSemanticScore = Number.isFinite(body?.semanticQuality) && SEMANTIC_EVALUATORS.has(evaluator);
  const semanticQuality = hasSemanticScore ? Math.max(0, Math.min(1, Number(body.semanticQuality))) : null;
  const success = outcome === 'success' ? 1 : 0;
  const failure = success ? 0 : 1;
  const penalty = outcome === 'rate-limit' ? 0.16 : outcome === 'auth' ? 0.25 : outcome === 'timeout' ? 0.12 : failure ? 0.10 : 0;
  const quarantineMs = outcome === 'auth' ? 30 * 60_000 : outcome === 'rate-limit' ? 5 * 60_000 : outcome === 'timeout' ? 60_000 : 0;
  const routeKey = `${provider}::${modelId}`;
  const existingRoute = await env.DB.prepare('SELECT route_key FROM route_health WHERE route_key = ?1')
    .bind(routeKey).first();
  if (!existingRoute?.route_key) throw new Error('unknown-route');

  await env.DB.prepare(`INSERT INTO route_health(
      route_key,provider,model_id,capability,successes,failures,ewma_latency,quality,health_score,last_outcome,last_seen_at,quarantine_until)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
    ON CONFLICT(route_key) DO UPDATE SET
      capability=excluded.capability,
      successes=route_health.successes + excluded.successes,
      failures=route_health.failures + excluded.failures,
      ewma_latency=CASE WHEN excluded.ewma_latency<=0 THEN route_health.ewma_latency
        WHEN route_health.ewma_latency<=0 THEN excluded.ewma_latency ELSE route_health.ewma_latency*0.72+excluded.ewma_latency*0.28 END,
      health_score=MIN(1.0,MAX(0.02, route_health.health_score*0.82 + excluded.health_score*0.18)),
      last_outcome=excluded.last_outcome,
      last_seen_at=excluded.last_seen_at,
      quarantine_until=MAX(route_health.quarantine_until,excluded.quarantine_until)`)
    .bind(
      routeKey, provider, modelId, capability, success, failure, latency, 0.5,
      Math.max(0.02, Math.min(1, success ? 0.82 - Math.min(latency / 30000, 0.18) : 0.45 - penalty)),
      outcome, now(), now() + quarantineMs
    ).run();

  if (hasSemanticScore) {
    await env.DB.prepare(`INSERT INTO route_semantics(
        route_key,capability,attempts,semantic_ewma,wrong_answers,last_score,last_evaluator,updated_at)
      VALUES(?1,?2,1,?3,?4,?3,?5,?6)
      ON CONFLICT(route_key,capability) DO UPDATE SET
        attempts=route_semantics.attempts+1,
        semantic_ewma=CASE WHEN route_semantics.attempts=0 THEN excluded.semantic_ewma
          ELSE route_semantics.semantic_ewma*0.80+excluded.semantic_ewma*0.20 END,
        wrong_answers=route_semantics.wrong_answers+excluded.wrong_answers,
        last_score=excluded.last_score,
        last_evaluator=excluded.last_evaluator,
        updated_at=excluded.updated_at`)
      .bind(routeKey, capability, semanticQuality, semanticQuality < 0.35 ? 1 : 0, evaluator, now()).run();
    const dimensions = body?.semanticDimensions && typeof body.semanticDimensions === 'object'
      ? body.semanticDimensions
      : {};
    for (const [dimension, rawScore] of Object.entries(dimensions)) {
      if (!SEMANTIC_DIMENSIONS.has(dimension) || !Number.isFinite(rawScore)) continue;
      const score = Math.max(0, Math.min(1, Number(rawScore)));
      await env.DB.prepare(`INSERT INTO route_semantic_dimensions(route_key,capability,dimension,attempts,score_ewma,updated_at)
        VALUES(?1,?2,?3,1,?4,?5)
        ON CONFLICT(route_key,capability,dimension) DO UPDATE SET
          attempts=route_semantic_dimensions.attempts+1,
          score_ewma=CASE WHEN route_semantic_dimensions.attempts=0 THEN excluded.score_ewma
            ELSE route_semantic_dimensions.score_ewma*0.80+excluded.score_ewma*0.20 END,
          updated_at=excluded.updated_at`)
        .bind(routeKey, capability, dimension, score, now()).run();
    }
    const semantic = await env.DB.prepare(`SELECT wrong_answers FROM route_semantics
      WHERE route_key=?1 AND capability=?2`).bind(routeKey, capability).first();
    if (Number(semantic?.wrong_answers || 0) >= 3) {
      await env.DB.prepare(`UPDATE route_health SET quarantine_until=MAX(quarantine_until,?2), last_outcome='semantic-quarantine'
        WHERE route_key=?1`).bind(routeKey, now() + 24 * 60 * 60_000).run();
    }
  }

  return { ok: true, semanticQualityAccepted: hasSemanticScore };
}

async function plan(env, capability) {
  const cap = ALLOWED_CAPABILITIES.has(capability) ? capability : 'general';
  const rows = await env.DB.prepare(`SELECT h.provider,h.model_id,h.capability,h.health_score,h.ewma_latency,h.successes,h.failures,h.last_outcome,
      COALESCE(s.semantic_ewma,0) AS semantic_score, COALESCE(s.attempts,0) AS semantic_attempts,
      COALESCE(s.wrong_answers,0) AS wrong_answers
    FROM route_health h
    LEFT JOIN route_semantics s ON s.route_key=h.route_key AND s.capability=?2
    WHERE h.provider IN ('Kilo','OVHcloud') AND h.quarantine_until < ?1 AND (h.capability = ?2 OR h.capability = 'general')
    ORDER BY (CASE WHEN h.capability=?2 THEN 0.10 ELSE 0 END)+h.health_score+
      (CASE WHEN COALESCE(s.attempts,0)>0 THEN s.semantic_ewma*MIN(1.0,s.attempts/20.0)*0.70 ELSE 0 END)-
      MIN(0.70,COALESCE(s.wrong_answers,0)*0.12) DESC,
      CASE WHEN ewma_latency>0 THEN ewma_latency ELSE 999999 END ASC
    LIMIT 24`).bind(now(), cap).all();
  return {
    source: 'cloudflare-d1',
    capability: cap,
    targetCatalog: TARGET_CATALOG,
    candidates: (rows?.results || []).map(row => ({
      provider: row.provider,
      source: row.provider,
      modelId: row.model_id,
      capability: row.capability,
      healthScore: Number(row.health_score || 0),
      semanticScore: Number(row.semantic_score || 0),
      semanticAttempts: Number(row.semantic_attempts || 0),
      wrongAnswers: Number(row.wrong_answers || 0),
      latencyMs: Number(row.ewma_latency || 0),
      successes: Number(row.successes || 0),
      failures: Number(row.failures || 0),
      lastOutcome: row.last_outcome || ''
    }))
  };
}

async function probeRoute(provider, modelId) {
  if (provider !== 'Kilo' && provider !== 'OVHcloud') return { outcome: 'skipped', latencyMs: 0 };
  const base = provider === 'Kilo' ? KILO_BASE : OVH_BASE;
  const started = now();
  try {
    const seed = [...String(modelId)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const cycle = Math.floor(now() / PROBE_INTERVAL_MS);
    const benchmark = BENCHMARKS[(seed + cycle) % BENCHMARKS.length];
    const { data } = await fetchJson(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: benchmark.prompt }], max_tokens: 16, temperature: 0.1, stream: false })
    }, 5000);
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
    const answer = String(content || '').trim();
    const exact = answer === benchmark.expected ? 1 : 0;
    return {
      outcome: answer ? 'success' : 'failure',
      latencyMs: now() - started,
      capability: benchmark.capability,
      semanticQuality: exact,
      semanticDimensions: {
        correctness: exact,
        completeness: exact,
        hallucination: exact,
        instructionFollowing: exact
      },
      evaluator: 'benchmark'
    };
  } catch (error) {
    const message = lower(error?.message || error);
    const outcome = /429|rate.?limit|quota/.test(message) ? 'rate-limit' : /401|403|auth|forbidden/.test(message) ? 'auth' : /abort|timeout/.test(message) ? 'timeout' : 'failure';
    return { outcome, latencyMs: now() - started };
  }
}

async function maybeProbe(env) {
  const last = Number(await getMeta(env, 'last_probe_at', '0')) || 0;
  if (now() - last < PROBE_INTERVAL_MS) return { skipped: true, probed: 0 };
  // Acquire a lightweight D1 lease before network calls so concurrent plans cannot duplicate probes.
  await setMeta(env, 'last_probe_at', now());
  const rows = await env.DB.prepare(`SELECT provider,model_id,capability FROM route_health
    WHERE provider IN ('Kilo','OVHcloud') AND quarantine_until < ?1
    ORDER BY last_seen_at DESC, health_score DESC LIMIT ?2`).bind(now(), MAX_PROBES).all();
  let count = 0;
  for (const row of rows?.results || []) {
    const result = await probeRoute(row.provider, row.model_id);
    if (result.outcome !== 'skipped') {
      await applyOutcome(env, {
        provider: row.provider,
        modelId: row.model_id,
        capability: result.capability || row.capability,
        outcome: result.outcome,
        latencyMs: result.latencyMs,
        semanticQuality: result.semanticQuality,
        semanticDimensions: result.semanticDimensions,
        evaluator: result.evaluator
      });
      count += 1;
    }
  }
  await setMeta(env, 'last_probe_at', now());
  return { skipped: false, probed: count };
}

async function refresh(env) {
  const [hf, providers] = await Promise.all([
    refreshHuggingFace(env),
    refreshProviderCatalogs(env)
  ]);
  const probes = await maybeProbe(env);
  await setMeta(env, 'last_refresh_at', now());
  return { hf, providers, probes };
}

async function status(env) {
  const hfTotal = Number(await getMeta(env, 'hf_total_seen', '0')) || 0;
  const shardRow = await env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(record_count),0) AS records FROM catalog_shards').first();
  const routeRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM route_health').first();
  const healthyRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM route_health WHERE quarantine_until < ?1 AND health_score >= 0.45').bind(now()).first();
  const semanticRow = await env.DB.prepare(`SELECT COUNT(DISTINCT route_key) AS routes, COALESCE(SUM(attempts),0) AS attempts,
    COALESCE(SUM(wrong_answers),0) AS wrong FROM route_semantics`).first();
  const dimensionRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM route_semantic_dimensions').first();
  return {
    ok: true,
    service: 'NOVA 5.7 Sol Brain Registry',
    storage: 'Cloudflare D1 sharded catalog',
    targetCatalog: TARGET_CATALOG,
    hfTotalSeen: hfTotal,
    catalogRecords: Number(shardRow?.records || 0),
    shardCount: Number(shardRow?.count || 0),
    activeRoutes: Number(routeRow?.count || 0),
    healthyRoutes: Number(healthyRow?.count || 0),
    semanticallyEvaluatedRoutes: Number(semanticRow?.routes || 0),
    semanticBenchmarkAttempts: Number(semanticRow?.attempts || 0),
    semanticWrongAnswers: Number(semanticRow?.wrong || 0),
    semanticDimensionRows: Number(dimensionRow?.count || 0),
    complete: hfTotal >= TARGET_CATALOG,
    lastRefreshAt: Number(await getMeta(env, 'last_refresh_at', '0')) || 0,
    providerRefreshAt: Number(await getMeta(env, 'provider_refresh_at', '0')) || 0,
    lastProbeAt: Number(await getMeta(env, 'last_probe_at', '0')) || 0
  };
}


async function generateRelay(request, env) {
  const appCheckToken = request.headers.get('x-firebase-appcheck') || '';
  const authHeader = request.headers.get('authorization') || '';
  const authToken = /^Bearer\s+/i.test(authHeader) ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  const [appCheckClaims, authClaims] = await Promise.all([
    verifyAppCheckToken(appCheckToken),
    verifyFirebaseAuthToken(authToken)
  ]);
  if (!appCheckClaims && !authClaims) return json({ ok: false, error: 'verified-client-required' }, 401);

  let body = {};
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid-json' }, 400); }

  const prompt = text(body?.prompt, 12000);
  if (!prompt) return json({ ok: false, error: 'prompt-required' }, 400);
  const requestedCapability = text(body?.capability, 30);
  const capability = ALLOWED_CAPABILITIES.has(requestedCapability) ? requestedCapability : 'general';
  const maxTokens = Math.max(256, Math.min(2800, Number(body?.maxTokens || 1200) || 1200));
  const temperature = Math.max(0.1, Math.min(1.0, Number(body?.temperature ?? 0.4) || 0.4));

  // Transport-only relay: prompt text is never written to D1/meta/route telemetry.
  const currentPlan = await plan(env, capability);
  const provenFast = capability === 'coding'
    ? [
        { provider: 'OVHcloud', modelId: 'Qwen3-Coder-30B-A3B-Instruct' },
        { provider: 'OVHcloud', modelId: 'Mistral-Small-3.2-24B-Instruct-2506' },
        { provider: 'Kilo', modelId: 'kilo-auto/free' }
      ]
    : [
        { provider: 'OVHcloud', modelId: 'Mistral-Small-3.2-24B-Instruct-2506' },
        { provider: 'OVHcloud', modelId: 'Mistral-7B-Instruct-v0.3' },
        { provider: 'OVHcloud', modelId: 'Mistral-Nemo-Instruct-2407' },
        { provider: 'Kilo', modelId: 'kilo-auto/free' }
      ];
  const seen = new Set();
  // Known sub-second routes lead; learned D1 routes remain adaptive fallback.
  const candidates = [...provenFast, ...(Array.isArray(currentPlan?.candidates) ? currentPlan.candidates : [])]
    .filter(row => {
      const provider = text(row?.provider || row?.source, 80);
      const modelId = text(row?.modelId || row?.model, 240);
      const key = `${provider}::${modelId}`;
      if (!modelId || !CALLABLE_CLIENT_PROVIDERS.has(provider) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);

  if (!candidates.length) return json({ ok: false, error: 'no-callable-route' }, 503);

  async function callCandidate(row) {
    const provider = text(row?.provider || row?.source, 80);
    const modelId = text(row?.modelId || row?.model, 240);
    const base = provider === 'Kilo' ? KILO_BASE : OVH_BASE;
    const started = now();
    const { data } = await fetchJson(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: 'You are NOVA, the NexusNova AI assistant. Answer the user directly and naturally in the same language/style they used. Never expose hidden reasoning, scratch work, translation notes, prompt interpretation, chain-of-thought, or meta commentary such as “the user is asking”. If they ask for code, provide correct runnable code and concise edge-case notes.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
        stream: false
      })
    }, 10000);
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.text ?? '';
    const answer = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content.map(part => typeof part === 'string' ? part : text(part?.text || part?.content, 3000)).join('').trim()
        : '';
    if (!answer) throw new Error('empty-provider-answer');
    return { provider, modelId, text: answer.slice(0, 12000), latencyMs: now() - started };
  }

  try {
    const winner = await Promise.any(candidates.map((row, index) => new Promise(resolve => setTimeout(resolve, index * 70)).then(() => callCandidate(row))));
    return json({ ok: true, capability, provider: winner.provider, model: winner.modelId, text: winner.text, latencyMs: winner.latencyMs });
  } catch {
    return json({ ok: false, error: 'all-relay-routes-failed', capability }, 503);
  }
}

async function handle(request, env, ctx) {
  if (request.method === 'OPTIONS') return json({ ok: true });
  const url = new URL(request.url);

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/v1/status')) {
    return json(await status(env));
  }

  if (request.method === 'POST' && url.pathname === '/v1/plan') {
    let body = {};
    try { body = await request.json(); } catch {}
    const capability = ALLOWED_CAPABILITIES.has(text(body?.capability, 30)) ? text(body.capability, 30) : 'general';
    // Real planning traffic may start a bounded, prompt-free semantic probe cycle.
    ctx.waitUntil(maybeProbe(env).catch(error => console.error('[NOVA semantic probe]', error)));
    return json(await plan(env, capability));
  }

  if (request.method === 'POST' && url.pathname === '/v1/generate') {
    return generateRelay(request, env);
  }

  if (request.method === 'POST' && url.pathname === '/v1/outcome') {
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

  if (request.method === 'POST' && url.pathname === '/v1/refresh') {
    const supplied = request.headers.get('x-nova-refresh-key') || '';
    if (!env.REFRESH_KEY || supplied !== env.REFRESH_KEY) return json({ ok: false, error: 'forbidden' }, 403);
    const result = await refresh(env);
    return json({ ok: true, ...result });
  }

  return json({ ok: false, error: 'not-found' }, 404);
}

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx).catch(error => json({ ok: false, error: text(error?.message || error, 240) }, 500));
  },
  scheduled(event, env, ctx) {
    ctx.waitUntil(refresh(env).catch(error => console.error('[NOVA registry refresh]', error)));
  }
};
