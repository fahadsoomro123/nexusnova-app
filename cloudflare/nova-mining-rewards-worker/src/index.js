const DAY = 86_400_000;
const MINING_REWARD = 24;
const NOVA_COOLDOWN = 15_000;
const NOVA_BOOST_MS = 2 * 60 * 60 * 1000;
const NOVA_MAX_BOOST_USES = 6;
const WATCH_PURPOSE = 'task-watch-ad';
const VAULT_PURPOSE = 'nova-vault-10x';
const WATCH_REWARD_NVX = 2.5;
const MAX_VAULT_BOOST_CREDITS = 3;
const GOOGLE_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const EXPECTED_AD_UNIT = '7194148596';

const CORS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store'
});

let oauthCache = { token:'', expiresAt:0, issuer:'' };
let admobKeyCache = { expiresAt:0, keys:new Map() };

class ApiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type':'application/json; charset=utf-8' }
  });
}

function fail(code, message, status = 400) {
  return json({ ok:false, code, message }, status);
}

function bearer(request) {
  const value = String(request.headers.get('authorization') || '');
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : '';
}

function clean(value, max = 160) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) return '';
  return text;
}

function safeNumber(data, field) {
  const value = data?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new ApiError('account_repair_required', `Account data for ${field} needs repair. No value was changed.`, 409);
  }
  return value;
}

function safeInt(data, field, fallback = 0) {
  const raw = data?.[field];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) {
    throw new ApiError('account_repair_required', `Account data for ${field} needs repair. No value was changed.`, 409);
  }
  return raw;
}

function requireCooldown(data, now) {
  const until = safeInt(data, 'novaFeatureCooldownUntil', 0);
  if (now < until) {
    throw new ApiError('cooldown_active', `Nova cooldown active. Try again in ${Math.ceil((until - now) / 1000)} seconds.`, 429);
  }
}

function inventoryOf(data) {
  return {
    booster: safeInt(data, 'novaBoosterInventory', 0),
    rain: safeInt(data, 'novaRainInventory', 0),
    timeWarp: safeInt(data, 'novaTimeWarpInventory', 0),
    pendingVaults: safeInt(data, 'novaVaultPending', 0)
  };
}

function miningElapsed(data, now) {
  const active = data?.miningActive === true;
  const started = safeInt(data, 'miningStartedAt', 0);
  return { active, started, elapsed:active && started > 0 ? Math.max(0, now - started) : 0 };
}

function randomInt(maxExclusive) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) throw new Error('invalid random range');
  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= limit);
  return data[0] % maxExclusive;
}

function drawNormalReward() {
  const roll = randomInt(10_000);
  const type = roll < 6000 ? 'nvx' : roll < 7800 ? 'booster' : roll < 9500 ? 'rain' : 'time-warp';
  return { type, amount:type === 'nvx' ? randomInt(10) + 1 : 1 };
}

function drawBoostedReward() {
  const roll = randomInt(46_000);
  const type = roll < 6000 ? 'nvx' : roll < 24_000 ? 'booster' : roll < 41_000 ? 'rain' : 'time-warp';
  return { type, amount:type === 'nvx' ? randomInt(21) + 5 : 1 };
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(String(value)));
}

function pemBytes(pem) {
  const base64 = String(pem || '').replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  if (!base64) throw new Error('invalid pem');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function serviceAccount(env) {
  let account;
  try { account = JSON.parse(String(env.FIREBASE_SERVICE_ACCOUNT_JSON || '')); }
  catch { throw new ApiError('server_config', 'Firebase service account is invalid.', 503); }
  const clientEmail = clean(account?.client_email, 254);
  const privateKey = String(account?.private_key || '');
  const projectId = clean(env.FIREBASE_PROJECT_ID || account?.project_id, 120);
  if (!clientEmail || !privateKey.includes('BEGIN PRIVATE KEY') || !projectId) {
    throw new ApiError('server_config', 'Firebase service account is not configured.', 503);
  }
  return { clientEmail, privateKey, projectId };
}

async function googleAccessToken(env) {
  const account = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  if (oauthCache.token && oauthCache.issuer === account.clientEmail && Date.now() < oauthCache.expiresAt - 60_000) {
    return { token:oauthCache.token, projectId:account.projectId };
  }
  const header = textBase64Url(JSON.stringify({ alg:'RS256', typ:'JWT' }));
  const payload = textBase64Url(JSON.stringify({
    iss:account.clientEmail,
    scope:'https://www.googleapis.com/auth/datastore',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now + 3600
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(account.privateKey),
    { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${bytesToBase64Url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) throw new ApiError('firestore_auth_unavailable', 'Secure account storage is temporarily unavailable.', 503);
  oauthCache = {
    token:String(body.access_token),
    expiresAt:Date.now() + Math.max(300, Number(body.expires_in) || 3600) * 1000,
    issuer:account.clientEmail
  };
  return { token:oauthCache.token, projectId:account.projectId };
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue === true;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return String(value.stringValue);
  if ('timestampValue' in value) return String(value.timestampValue);
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue?.fields || {});
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  return null;
}

function decodeFirestoreFields(fields) {
  const output = {};
  for (const [key, value] of Object.entries(fields || {})) output[key] = decodeFirestoreValue(value);
  return output;
}

function encodeFirestoreValue(value) {
  if (value && typeof value === 'object' && value.__timestamp) return { timestampValue:String(value.__timestamp) };
  if (value === null || value === undefined) return { nullValue:null };
  if (typeof value === 'boolean') return { booleanValue:value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('invalid numeric field');
    return Number.isInteger(value) ? { integerValue:String(value) } : { doubleValue:value };
  }
  if (typeof value === 'string') return { stringValue:value };
  if (Array.isArray(value)) return { arrayValue:{ values:value.map(encodeFirestoreValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, child] of Object.entries(value)) fields[key] = encodeFirestoreValue(child);
    return { mapValue:{ fields } };
  }
  return { stringValue:String(value) };
}

function timestampValue(ms = Date.now()) {
  return { __timestamp:new Date(ms).toISOString() };
}

async function firestoreFetch(env, path, init = {}) {
  const auth = await googleAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/databases/(default)/documents${path}`;
  return fetch(url, {
    ...init,
    headers:{
      Authorization:`Bearer ${auth.token}`,
      'Content-Type':'application/json',
      ...(init.headers || {})
    }
  });
}

async function readDoc(env, collection, id) {
  const response = await firestoreFetch(env, `/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method:'GET' });
  if (response.status === 404) return { exists:false, data:null, updateTime:'' };
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError('firestore_unavailable', 'Secure account storage is temporarily unavailable.', 503);
  return { exists:true, data:decodeFirestoreFields(body.fields || {}), updateTime:String(body.updateTime || ''), raw:body };
}

function docName(projectId, collection, id) {
  return `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
}

async function commit(env, writes) {
  const auth = await googleAccessToken(env);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/databases/(default)/documents:commit`, {
    method:'POST',
    headers:{ Authorization:`Bearer ${auth.token}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ writes })
  });
  const body = await response.json().catch(() => ({}));
  return { response, body, projectId:auth.projectId };
}

function updateWrite(projectId, uid, updates, updateTime) {
  const fields = {};
  const fieldPaths = [];
  for (const [field, value] of Object.entries(updates || {})) {
    fields[field] = encodeFirestoreValue(value);
    fieldPaths.push(field);
  }
  if (!fieldPaths.length) return null;
  return {
    update:{ name:docName(projectId, 'users', uid), fields },
    updateMask:{ fieldPaths },
    currentDocument:{ updateTime }
  };
}

function createWrite(projectId, collection, id, fields) {
  const encoded = {};
  for (const [field, value] of Object.entries(fields || {})) encoded[field] = encodeFirestoreValue(value);
  return {
    update:{ name:docName(projectId, collection, id), fields:encoded },
    currentDocument:{ exists:false }
  };
}

function conflictStatus(response, body) {
  const status = String(body?.error?.status || '');
  return response.status === 409 || response.status === 412 || status === 'ABORTED' || status === 'FAILED_PRECONDITION';
}

async function mutateUser(env, uid, mutator, options = {}) {
  const eventCollection = options.eventCollection || '';
  const eventId = options.eventId || '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (eventCollection && eventId) {
      const existing = await readDoc(env, eventCollection, eventId);
      if (existing.exists) return { duplicate:true, prior:existing.data || {} };
    }
    const snap = await readDoc(env, 'users', uid);
    if (!snap.exists) throw new ApiError('user_not_found', 'User profile not found.', 404);
    const outcome = await mutator({ ...snap.data }, attempt);
    const auth = await googleAccessToken(env);
    const writes = [];
    const userWrite = updateWrite(auth.projectId, uid, outcome.updates || {}, snap.updateTime);
    if (userWrite) writes.push(userWrite);
    if (eventCollection && eventId) {
      writes.push(createWrite(auth.projectId, eventCollection, eventId, {
        ...(options.eventFields || {}),
        uid,
        createdAt:timestampValue(),
        result:outcome.result || {}
      }));
    }
    if (!writes.length) return { duplicate:false, result:outcome.result || {} };
    const committed = await commit(env, writes);
    if (committed.response.ok) return { duplicate:false, result:outcome.result || {} };
    if (conflictStatus(committed.response, committed.body)) {
      if (eventCollection && eventId) {
        const existing = await readDoc(env, eventCollection, eventId);
        if (existing.exists) return { duplicate:true, prior:existing.data || {} };
      }
      continue;
    }
    console.error('Firestore commit error', committed.response.status, committed.body?.error?.status || '', committed.body?.error?.message || '');
    throw new ApiError('firestore_write_failed', 'Secure reward update could not be completed. No retryable value was assumed.', 503);
  }
  throw new ApiError('account_busy', 'Account changed during this request. Please retry.', 409);
}

async function verifyFirebaseUser(request, env) {
  const token = bearer(request);
  if (!token) throw new ApiError('unauthenticated', 'Sign in first.', 401);
  const key = clean(env.FIREBASE_WEB_API_KEY, 256);
  if (!key) throw new ApiError('server_config', 'Firebase authentication is not configured.', 503);
  let response;
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ idToken:token })
    });
  } catch {
    throw new ApiError('auth_unavailable', 'Authentication check is temporarily unavailable.', 503);
  }
  if (!response.ok) throw new ApiError('unauthenticated', 'Your sign-in session is invalid or expired.', 401);
  const body = await response.json().catch(() => ({}));
  const user = Array.isArray(body?.users) ? body.users[0] : null;
  const uid = clean(user?.localId, 128);
  if (!uid) throw new ApiError('unauthenticated', 'Your sign-in session is invalid.', 401);
  if (user?.emailVerified !== true) throw new ApiError('verification_required', 'Verify your email first.', 403);
  return { uid, email:clean(user?.email, 254).toLowerCase() };
}

async function requestJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 32_768) throw new ApiError('payload_too_large', 'Request is too large.', 413);
  try { return await request.json(); } catch { return {}; }
}

async function audit(env, eventId, uid, kind, status, payload = {}) {
  try {
    if (!env.NOVA_MINING_REWARDS_DB) return;
    await env.NOVA_MINING_REWARDS_DB.prepare(`INSERT INTO reward_audit
      (event_id, uid, kind, status, payload_json, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json, completed_at=excluded.completed_at`)
      .bind(eventId, uid || '', kind, status, JSON.stringify(payload).slice(0, 8000), Date.now(), status === 'completed' ? Date.now() : null).run();
  } catch (error) {
    console.warn('D1 audit unavailable', error?.message || error);
  }
}

async function dailyReward(env, user) {
  const now = Date.now();
  const outcome = await mutateUser(env, user.uid, data => {
    const last = safeNumber(data, 'lastDailyReward');
    const balance = safeNumber(data, 'balance');
    if (now - last < DAY) throw new ApiError('daily_not_ready', 'Daily reward is not ready yet.', 429);
    const reward = 5;
    const nextBalance = balance + reward;
    return {
      updates:{ balance:nextBalance, lastDailyReward:now, dailyRewardStreak:safeInt(data, 'dailyRewardStreak', 0) + 1 },
      result:{ reward, balance:nextBalance, lastDailyReward:now }
    };
  });
  const result = outcome.result || {};
  await audit(env, `daily:${user.uid}:${Math.floor(now / DAY)}`, user.uid, 'daily-reward', 'completed', result);
  return result;
}

async function openVault(env, user, boosted = false) {
  const now = Date.now();
  const reward = boosted ? drawBoostedReward() : drawNormalReward();
  const outcome = await mutateUser(env, user.uid, data => {
    requireCooldown(data, now);
    const inv = inventoryOf(data);
    if (inv.pendingVaults < 1) throw new ApiError('no_vault', 'No Nova Vault is ready. Complete a natural 24-hour mining session first.', 409);
    const credits = safeInt(data, 'novaVaultBoostCredits', 0);
    if (boosted && credits < 1) throw new ApiError('boost_not_unlocked', '10x chance is not unlocked yet. Complete the rewarded ad first.', 409);
    const cooldownUntil = now + NOVA_COOLDOWN;
    const updates = {
      novaVaultPending:inv.pendingVaults - 1,
      novaFeatureCooldownUntil:cooldownUntil,
      novaLastVaultReward:reward.type,
      novaLastVaultAmount:reward.amount,
      novaLastVaultOpenedAt:now
    };
    if (boosted) {
      updates.novaVaultBoostCredits = credits - 1;
      updates.novaLastVaultMode = '10x';
    }
    let balance = safeNumber(data, 'balance');
    let booster = inv.booster;
    let rain = inv.rain;
    let timeWarp = inv.timeWarp;
    if (reward.type === 'nvx') {
      if (balance > Number.MAX_SAFE_INTEGER - reward.amount) throw new ApiError('balance_limit', 'Balance limit reached. No value was changed.', 409);
      balance += reward.amount;
      updates.balance = balance;
    } else if (reward.type === 'booster') {
      booster += 1; updates.novaBoosterInventory = booster;
    } else if (reward.type === 'rain') {
      rain += 1; updates.novaRainInventory = rain;
    } else {
      timeWarp += 1; updates.novaTimeWarpInventory = timeWarp;
    }
    return {
      updates,
      result:{
        opened:true,
        boosted,
        ...(boosted ? { boostMode:'10x-weighted-pool', novaVaultBoostCredits:credits - 1 } : {}),
        reward,
        balance,
        cooldownUntil,
        novaVaultPending:inv.pendingVaults - 1,
        inventory:{ booster, rain, timeWarp, pendingVaults:inv.pendingVaults - 1 }
      }
    };
  });
  await audit(env, `vault:${user.uid}:${crypto.randomUUID()}`, user.uid, boosted ? 'vault-10x' : 'vault-normal', 'completed', outcome.result);
  return outcome.result;
}

async function useBoost(env, user, body) {
  const now = Date.now();
  const kind = String(body?.kind || '').toLowerCase();
  if (kind !== 'booster' && kind !== 'rain') throw new ApiError('unknown_boost', 'Unknown Nova Boost.', 400);
  const outcome = await mutateUser(env, user.uid, data => {
    requireCooldown(data, now);
    const inv = inventoryOf(data);
    const mining = miningElapsed(data, now);
    if (!mining.active || mining.started <= 0) throw new ApiError('mining_inactive', 'Start mining first.', 409);
    if (mining.elapsed >= DAY) throw new ApiError('session_complete', 'Mining session is already complete.', 409);
    const uses = safeInt(data, 'novaBoostUsesThisSession', 0);
    if (uses >= NOVA_MAX_BOOST_USES) throw new ApiError('boost_limit', 'Maximum Nova Boosts used this session.', 429);
    if (kind === 'booster' && inv.booster < 1) throw new ApiError('no_booster', 'No Nova Booster available.', 409);
    if (kind === 'rain' && inv.rain < 1) throw new ApiError('no_rain', 'No Nova Rain available.', 409);
    const newStart = Math.max(1, mining.started - NOVA_BOOST_MS);
    const updates = {
      miningStartedAt:newStart,
      novaBoostUsesThisSession:uses + 1,
      novaFeatureCooldownUntil:now + NOVA_COOLDOWN,
      novaVaultPending:inv.pendingVaults + 1
    };
    if (kind === 'booster') updates.novaBoosterInventory = inv.booster - 1;
    else updates.novaRainInventory = inv.rain - 1;
    return {
      updates,
      result:{
        kind,
        miningActive:true,
        miningStartedAt:newStart,
        cooldownUntil:now + NOVA_COOLDOWN,
        reducedHours:(uses + 1) * 2,
        novaVaultPending:inv.pendingVaults + 1,
        inventory:{
          booster:kind === 'booster' ? inv.booster - 1 : inv.booster,
          rain:kind === 'rain' ? inv.rain - 1 : inv.rain,
          timeWarp:inv.timeWarp,
          pendingVaults:inv.pendingVaults + 1
        }
      }
    };
  });
  await audit(env, `boost:${user.uid}:${crypto.randomUUID()}`, user.uid, `use-${kind}`, 'completed', outcome.result);
  return outcome.result;
}

async function useTimeWarp(env, user) {
  const now = Date.now();
  const outcome = await mutateUser(env, user.uid, data => {
    requireCooldown(data, now);
    const inv = inventoryOf(data);
    const mining = miningElapsed(data, now);
    if (inv.timeWarp < 1) throw new ApiError('no_time_warp', 'No Time Warp available.', 409);
    if (!mining.active || mining.started <= 0) throw new ApiError('mining_inactive', 'Start mining first.', 409);
    if (mining.elapsed >= DAY) throw new ApiError('session_complete', 'Mining session is already complete.', 409);
    const balance = safeNumber(data, 'balance');
    const total = safeNumber(data, 'totalMined');
    const nextBalance = balance + MINING_REWARD;
    const nextTotal = total + MINING_REWARD;
    const cooldownUntil = now + NOVA_COOLDOWN;
    return {
      updates:{
        balance:nextBalance,
        totalMined:nextTotal,
        miningActive:false,
        miningStartedAt:0,
        miningLastUpdate:now,
        novaTimeWarpInventory:inv.timeWarp - 1,
        novaFeatureCooldownUntil:cooldownUntil
      },
      result:{
        earned:MINING_REWARD,
        balance:nextBalance,
        totalMined:nextTotal,
        miningActive:false,
        miningStartedAt:0,
        cooldownUntil,
        inventory:{ booster:inv.booster, rain:inv.rain, timeWarp:inv.timeWarp - 1, pendingVaults:inv.pendingVaults }
      }
    };
  });
  await audit(env, `warp:${user.uid}:${crypto.randomUUID()}`, user.uid, 'use-time-warp', 'completed', outcome.result);
  return outcome.result;
}

function rawQuery(request) {
  const url = new URL(request.url);
  const full = String(url.search || '').replace(/^\?/, '');
  if (!full) throw new Error('missing query');
  return full;
}

function decodeBase64Url(value) {
  const text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (text.length % 4)) % 4;
  const binary = atob(text + '='.repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function signedCallbackParts(request) {
  const query = rawQuery(request);
  const signatureMarker = '&signature=';
  const signatureIndex = query.indexOf(signatureMarker);
  if (signatureIndex <= 0) throw new Error('missing signature');
  const keyMarker = '&key_id=';
  const keyIndex = query.indexOf(keyMarker, signatureIndex + signatureMarker.length);
  if (keyIndex <= signatureIndex) throw new Error('missing key_id');
  if (query.indexOf('&', keyIndex + keyMarker.length) !== -1) throw new Error('unexpected parameters after key_id');
  const keyId = Number(query.slice(keyIndex + keyMarker.length));
  if (!Number.isSafeInteger(keyId) || keyId < 0) throw new Error('invalid key id');
  return {
    content:query.slice(0, signatureIndex),
    signature:decodeBase64Url(decodeURIComponent(query.slice(signatureIndex + signatureMarker.length, keyIndex))),
    keyId
  };
}

function derToRawEcdsa(signature, size = 32) {
  const sig = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
  if (sig.length === size * 2) return sig;
  let offset = 0;
  if (sig[offset++] !== 0x30) throw new Error('invalid ecdsa signature');
  let seqLen = sig[offset++];
  if (seqLen & 0x80) {
    const count = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < count; i += 1) seqLen = (seqLen << 8) | sig[offset++];
  }
  if (offset + seqLen > sig.length) throw new Error('invalid ecdsa length');
  if (sig[offset++] !== 0x02) throw new Error('invalid ecdsa r');
  const rLen = sig[offset++];
  let r = sig.slice(offset, offset + rLen); offset += rLen;
  if (sig[offset++] !== 0x02) throw new Error('invalid ecdsa s');
  const sLen = sig[offset++];
  let s = sig.slice(offset, offset + sLen);
  while (r.length > size && r[0] === 0) r = r.slice(1);
  while (s.length > size && s[0] === 0) s = s.slice(1);
  if (r.length > size || s.length > size) throw new Error('invalid ecdsa scalar');
  const raw = new Uint8Array(size * 2);
  raw.set(r, size - r.length);
  raw.set(s, size * 2 - s.length);
  return raw;
}

async function admobKeys() {
  if (admobKeyCache.keys.size && Date.now() < admobKeyCache.expiresAt) return admobKeyCache.keys;
  const response = await fetch(GOOGLE_KEYS_URL, { headers:{ accept:'application/json' } });
  if (!response.ok) throw new Error(`Google key server HTTP ${response.status}`);
  const body = await response.json();
  const keys = new Map();
  for (const item of Array.isArray(body?.keys) ? body.keys : []) {
    const keyId = Number(item?.keyId);
    const pem = String(item?.pem || '');
    if (Number.isSafeInteger(keyId) && keyId >= 0 && pem.includes('BEGIN PUBLIC KEY')) keys.set(keyId, pem);
  }
  if (!keys.size) throw new Error('no Google verification keys');
  admobKeyCache = { expiresAt:Date.now() + 12 * 60 * 60 * 1000, keys };
  return keys;
}

async function verifyAdmobSignature(request) {
  const parts = signedCallbackParts(request);
  const keys = await admobKeys();
  const pem = keys.get(parts.keyId);
  if (!pem) throw new Error('unknown Google key id');
  const key = await crypto.subtle.importKey('spki', pemBytes(pem), { name:'ECDSA', namedCurve:'P-256' }, false, ['verify']);
  const raw = derToRawEcdsa(parts.signature);
  const valid = await crypto.subtle.verify({ name:'ECDSA', hash:'SHA-256' }, key, raw, new TextEncoder().encode(parts.content));
  return { valid, keyId:parts.keyId };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function admobSsv(request, env) {
  let verified;
  try { verified = await verifyAdmobSignature(request); }
  catch (error) {
    const transient = /key server|verification keys|fetch|timeout/i.test(String(error?.message || ''));
    console.warn('AdMob verification error', error?.message || error);
    return json({ ok:false, credited:false, reason:transient ? 'verification_temporarily_unavailable' : 'invalid_callback' }, transient ? 503 : 200);
  }
  if (!verified.valid) return json({ ok:false, credited:false, reason:'invalid_signature' });

  const url = new URL(request.url);
  const params = url.searchParams;
  const transactionId = clean(params.get('transaction_id'), 256);
  const uid = clean(params.get('user_id'), 128);
  const purpose = clean(params.get('custom_data'), 80);
  const adUnit = clean(params.get('ad_unit'), 128);
  const timestamp = Number(params.get('timestamp'));
  if (!transactionId || !/^[A-Za-z0-9_-]{8,256}$/.test(transactionId)) return json({ ok:false, credited:false, reason:'invalid_transaction_id' });
  if (!uid || !/^[A-Za-z0-9:_-]{3,128}$/.test(uid)) return json({ ok:false, credited:false, reason:'invalid_user_id' });
  if (purpose !== WATCH_PURPOSE && purpose !== VAULT_PURPOSE) return json({ ok:true, credited:false, reason:'non_value_purpose' });
  if (adUnit !== EXPECTED_AD_UNIT && !adUnit.endsWith(`/${EXPECTED_AD_UNIT}`)) return json({ ok:false, credited:false, reason:'wrong_ad_unit' });
  if (!Number.isFinite(timestamp) || timestamp <= 0) return json({ ok:false, credited:false, reason:'invalid_timestamp' });

  const eventId = await sha256Hex(transactionId);
  const eventFields = {
    provider:'admob-cloudflare', transactionId, purpose, adUnit,
    adNetwork:String(params.get('ad_network') || '').slice(0, 64),
    rewardAmountReported:String(params.get('reward_amount') || '').slice(0, 32),
    rewardItemReported:String(params.get('reward_item') || '').slice(0, 64),
    googleTimestamp:Math.floor(timestamp), keyId:verified.keyId
  };

  const outcome = await mutateUser(env, uid, data => {
    if (purpose === WATCH_PURPOSE) {
      const balance = safeNumber(data, 'balance');
      if (balance > Number.MAX_SAFE_INTEGER - WATCH_REWARD_NVX) throw new ApiError('balance_limit', 'Balance limit reached.', 409);
      const nextBalance = balance + WATCH_REWARD_NVX;
      return {
        updates:{
          balance:nextBalance,
          rewardedAdCount:safeInt(data, 'rewardedAdCount', 0) + 1,
          rewardedAdTotalNvx:safeNumber({ value:data?.rewardedAdTotalNvx ?? 0 }, 'value') + WATCH_REWARD_NVX,
          lastRewardedAdAt:timestampValue()
        },
        result:{ credited:true, purpose, balance:nextBalance, rewardNvx:WATCH_REWARD_NVX }
      };
    }
    const credits = safeInt(data, 'novaVaultBoostCredits', 0);
    const nextCredits = Math.min(MAX_VAULT_BOOST_CREDITS, credits + 1);
    const granted = nextCredits > credits;
    return {
      updates:granted ? {
        novaVaultBoostCredits:nextCredits,
        novaVaultBoostAdCount:safeInt(data, 'novaVaultBoostAdCount', 0) + 1,
        lastNovaVaultBoostAdAt:timestampValue()
      } : {},
      result:{ credited:granted, purpose, boostCredits:nextCredits, capped:!granted }
    };
  }, { eventCollection:'cloudflareRewardTransactions', eventId, eventFields });

  if (outcome.duplicate) {
    await audit(env, `ssv:${eventId}`, uid, purpose, 'duplicate', { transactionId });
    return json({ ok:true, credited:false, duplicate:true });
  }
  await audit(env, `ssv:${eventId}`, uid, purpose, 'completed', outcome.result);
  return json({ ok:true, ...(outcome.result || {}) });
}

async function health(env) {
  let d1 = false;
  try {
    if (env.NOVA_MINING_REWARDS_DB) {
      await env.NOVA_MINING_REWARDS_DB.prepare('SELECT 1 AS ok').first();
      d1 = true;
    }
  } catch {}
  let serviceAccountReady = false;
  try { serviceAccount(env); serviceAccountReady = true; } catch {}
  return json({
    ok:true,
    service:'nova-mining-rewards',
    execution:'cloudflare-worker',
    storage:d1 ? 'cloudflare-d1+firestore-compatible' : 'firestore-compatible',
    auth:'firebase-id-token',
    serviceAccountReady
  });
}

async function handle(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') return health(env);
  if (request.method === 'GET' && url.pathname === '/v1/rewards/admob-ssv') return admobSsv(request, env);
  if (request.method !== 'POST') return fail('method_not_allowed', 'Method not allowed.', 405);

  const user = await verifyFirebaseUser(request, env);
  const body = await requestJson(request);
  let data;
  if (url.pathname === '/v1/tasks/daily/claim') data = await dailyReward(env, user);
  else if (url.pathname === '/v1/vault/open') data = await openVault(env, user, false);
  else if (url.pathname === '/v1/vault/boosted/open') data = await openVault(env, user, true);
  else if (url.pathname === '/v1/boost/use') data = await useBoost(env, user, body);
  else if (url.pathname === '/v1/boost/time-warp') data = await useTimeWarp(env, user);
  else return fail('not_found', 'Route not found.', 404);
  return json({ ok:true, data });
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (error) {
      if (error instanceof ApiError) return fail(error.code, error.message, error.status);
      console.error('Nova mining rewards error', error?.stack || error);
      return fail('internal', 'Secure mining rewards service could not complete the request.', 500);
    }
  }
};
