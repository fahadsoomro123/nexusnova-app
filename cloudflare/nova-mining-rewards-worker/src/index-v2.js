const DAY = 86_400_000;
const MINING_REWARD = 24;
const NOVA_COOLDOWN = 15_000;
const NOVA_BOOST_MS = 2 * 60 * 60 * 1000;
const NOVA_MAX_BOOST_USES = 6;
const NOVA_MAX_BOOSTER_USES = 2;
const NOVA_MAX_RAIN_USES = 4;

const CORS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store'
});

let oauthCache = { token:'', expiresAt:0, issuer:'' };

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
    headers:{ ...CORS, 'Content-Type':'application/json; charset=utf-8' }
  });
}

function fail(code, message, status = 400) {
  return json({ ok:false, code, message }, status);
}

function clean(value, max = 160) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) return '';
  return text;
}

function bearer(request) {
  const value = String(request.headers.get('authorization') || '');
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : '';
}

function requiredNumber(data, field) {
  const value = data?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new ApiError('account_repair_required', `Account data for ${field} needs repair. No value was changed.`, 409);
  }
  return value;
}

function optionalInt(data, field, fallback = 0) {
  const value = data?.[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ApiError('account_repair_required', `Account data for ${field} needs repair. No value was changed.`, 409);
  }
  return value;
}

function optionalNumber(data, field, fallback = 0) {
  const value = data?.[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new ApiError('account_repair_required', `Account data for ${field} needs repair. No value was changed.`, 409);
  }
  return value;
}

function requireCooldown(data, now) {
  const until = optionalInt(data, 'novaFeatureCooldownUntil', 0);
  if (now < until) {
    throw new ApiError('cooldown_active', `Nova cooldown active. Try again in ${Math.ceil((until - now) / 1000)} seconds.`, 429);
  }
}

function inventoryOf(data) {
  return {
    booster:optionalInt(data, 'novaBoosterInventory', 0),
    rain:optionalInt(data, 'novaRainInventory', 0),
    timeWarp:optionalInt(data, 'novaTimeWarpInventory', 0),
    pendingVaults:optionalInt(data, 'novaVaultPending', 0)
  };
}

function miningOf(data, now) {
  const active = data?.miningActive === true;
  const started = optionalInt(data, 'miningStartedAt', 0);
  return {
    active,
    started,
    elapsed:active && started > 0 ? Math.max(0, now - started) : 0
  };
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

// 10X keeps the SAME reward types/ranges as Normal Vault, but shifts the odds
// toward Booster/Rain/Warp. NVX remains possible and stays 1-10 NVX.
function drawBoostedReward() {
  const roll = randomInt(46_000);
  const type = roll < 6000 ? 'nvx' : roll < 24_000 ? 'booster' : roll < 41_000 ? 'rain' : 'time-warp';
  return { type, amount:type === 'nvx' ? randomInt(10) + 1 : 1 };
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
  const base64 = String(pem || '')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) throw new Error('invalid pem');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function serviceAccount(env) {
  let account;
  try { account = JSON.parse(String(env.FIREBASE_SERVICE_ACCOUNT_JSON || '')); }
  catch { throw new ApiError('server_config', 'Cloudflare Firebase service account is invalid.', 503); }
  const clientEmail = clean(account?.client_email, 254);
  const privateKey = String(account?.private_key || '');
  const projectId = clean(env.FIREBASE_PROJECT_ID || account?.project_id, 120);
  if (!clientEmail || !privateKey.includes('BEGIN PRIVATE KEY') || !projectId) {
    throw new ApiError('server_config', 'Cloudflare Firebase service account is not configured.', 503);
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
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
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
  if (!response.ok || !body?.access_token) {
    throw new ApiError('firestore_auth_unavailable', 'Cloudflare could not authenticate secure storage.', 503);
  }
  oauthCache = {
    token:String(body.access_token),
    expiresAt:Date.now() + Math.max(300, Number(body.expires_in) || 3600) * 1000,
    issuer:account.clientEmail
  };
  return { token:oauthCache.token, projectId:account.projectId };
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue === true;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return String(value.stringValue);
  if ('timestampValue' in value) return String(value.timestampValue);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {});
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  return null;
}

function decodeFields(fields) {
  const output = {};
  for (const [key, value] of Object.entries(fields || {})) output[key] = decodeValue(value);
  return output;
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue:null };
  if (typeof value === 'boolean') return { booleanValue:value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('invalid numeric field');
    return Number.isInteger(value) ? { integerValue:String(value) } : { doubleValue:value };
  }
  if (typeof value === 'string') return { stringValue:value };
  if (Array.isArray(value)) return { arrayValue:{ values:value.map(encodeValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, child] of Object.entries(value)) fields[key] = encodeValue(child);
    return { mapValue:{ fields } };
  }
  return { stringValue:String(value) };
}

async function firestoreFetch(env, path, init = {}) {
  const auth = await googleAccessToken(env);
  return fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/databases/(default)/documents${path}`,
    {
      ...init,
      headers:{
        Authorization:`Bearer ${auth.token}`,
        'Content-Type':'application/json',
        ...(init.headers || {})
      }
    }
  );
}

async function readUser(env, uid) {
  const response = await firestoreFetch(env, `/users/${encodeURIComponent(uid)}`, { method:'GET' });
  if (response.status === 404) throw new ApiError('user_not_found', 'User profile not found.', 404);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError('firestore_unavailable', 'Secure account storage is temporarily unavailable.', 503);
  return { data:decodeFields(body.fields || {}), updateTime:String(body.updateTime || '') };
}

function docName(projectId, uid) {
  return `projects/${projectId}/databases/(default)/documents/users/${uid}`;
}

async function commitUser(env, uid, updates, updateTime) {
  const auth = await googleAccessToken(env);
  const fields = {};
  const fieldPaths = [];
  for (const [field, value] of Object.entries(updates || {})) {
    fields[field] = encodeValue(value);
    fieldPaths.push(field);
  }
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/databases/(default)/documents:commit`,
    {
      method:'POST',
      headers:{ Authorization:`Bearer ${auth.token}`, 'Content-Type':'application/json' },
      body:JSON.stringify({
        writes:[{
          update:{ name:docName(auth.projectId, uid), fields },
          updateMask:{ fieldPaths },
          currentDocument:{ updateTime }
        }]
      })
    }
  );
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function conflict(response, body) {
  const status = String(body?.error?.status || '');
  return response.status === 409 || response.status === 412 || status === 'ABORTED' || status === 'FAILED_PRECONDITION';
}

async function mutateUser(env, uid, mutator) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snap = await readUser(env, uid);
    const outcome = await mutator({ ...snap.data });
    if (!outcome?.updates || Object.keys(outcome.updates).length === 0) return outcome?.result || {};
    const committed = await commitUser(env, uid, outcome.updates, snap.updateTime);
    if (committed.response.ok) return outcome.result || {};
    if (conflict(committed.response, committed.body)) continue;
    console.error('Cloudflare v2 Firestore commit error', committed.response.status, committed.body?.error?.status || '');
    throw new ApiError('firestore_write_failed', 'Secure reward update could not be completed.', 503);
  }
  throw new ApiError('account_busy', 'Account changed during this request. Please retry.', 409);
}

async function verifyFirebaseUser(request, env) {
  const token = bearer(request);
  if (!token) throw new ApiError('unauthenticated', 'Sign in first.', 401);
  const key = clean(env.FIREBASE_WEB_API_KEY, 256);
  if (!key) throw new ApiError('server_config', 'Firebase authentication key is not configured.', 503);
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
  return { uid };
}

async function requestJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 32_768) throw new ApiError('payload_too_large', 'Request is too large.', 413);
  try { return await request.json(); } catch { return {}; }
}

async function dailyReward(env, user) {
  const now = Date.now();
  return mutateUser(env, user.uid, data => {
    const last = optionalNumber(data, 'lastDailyReward', 0);
    const balance = requiredNumber(data, 'balance');
    if (now - last < DAY) throw new ApiError('daily_not_ready', 'Daily reward is not ready yet.', 429);
    const reward = 5;
    const nextBalance = balance + reward;
    return {
      updates:{
        balance:nextBalance,
        lastDailyReward:now,
        dailyRewardStreak:optionalInt(data, 'dailyRewardStreak', 0) + 1
      },
      result:{ reward, balance:nextBalance, lastDailyReward:now, backend:'cloudflare-v2' }
    };
  });
}

async function toggleMining(env, user) {
  const now = Date.now();
  return mutateUser(env, user.uid, data => {
    const balance = requiredNumber(data, 'balance');
    const totalMined = requiredNumber(data, 'totalMined');
    const inv = inventoryOf(data);
    const mining = miningOf(data, now);

    if (!mining.active) {
      return {
        updates:{
          miningActive:true,
          miningStartedAt:now,
          miningLastUpdate:now,
          novaBoostUsesThisSession:0,
          novaBoosterUsesThisSession:0,
          novaRainUsesThisSession:0
        },
        result:{ started:true, renewed:false, miningActive:true, miningStartedAt:now, balance, totalMined, novaVaultPending:inv.pendingVaults, backend:'cloudflare-v2' }
      };
    }

    if (mining.elapsed < DAY) {
      return { updates:{}, result:{ started:false, renewed:false, miningActive:true, miningStartedAt:mining.started, balance, totalMined, novaVaultPending:inv.pendingVaults, backend:'cloudflare-v2' } };
    }

    const nextBalance = balance + MINING_REWARD;
    const nextTotal = totalMined + MINING_REWARD;
    const nextVaults = inv.pendingVaults + 1;
    return {
      updates:{
        balance:nextBalance,
        totalMined:nextTotal,
        miningActive:true,
        miningStartedAt:now,
        miningLastUpdate:now,
        novaVaultPending:nextVaults,
        novaBoostUsesThisSession:0,
        novaBoosterUsesThisSession:0,
        novaRainUsesThisSession:0
      },
      result:{ started:true, renewed:true, earned:MINING_REWARD, miningActive:true, miningStartedAt:now, balance:nextBalance, totalMined:nextTotal, novaVaultPending:nextVaults, backend:'cloudflare-v2' }
    };
  });
}

async function openVault(env, user, boosted = false) {
  const now = Date.now();
  const reward = boosted ? drawBoostedReward() : drawNormalReward();
  return mutateUser(env, user.uid, data => {
    requireCooldown(data, now);
    const inv = inventoryOf(data);
    if (inv.pendingVaults < 1) throw new ApiError('no_vault', 'No Nova Vault is ready.', 409);
    const cooldownUntil = now + NOVA_COOLDOWN;
    const updates = {
      novaVaultPending:inv.pendingVaults - 1,
      novaFeatureCooldownUntil:cooldownUntil,
      novaLastVaultReward:reward.type,
      novaLastVaultAmount:reward.amount,
      novaLastVaultOpenedAt:now,
      novaLastVaultMode:boosted ? '10x' : 'normal'
    };
    let balance = requiredNumber(data, 'balance');
    let booster = inv.booster;
    let rain = inv.rain;
    let timeWarp = inv.timeWarp;
    if (reward.type === 'nvx') {
      balance += reward.amount;
      updates.balance = balance;
    } else if (reward.type === 'booster') {
      booster += 1;
      updates.novaBoosterInventory = booster;
    } else if (reward.type === 'rain') {
      rain += 1;
      updates.novaRainInventory = rain;
    } else {
      timeWarp += 1;
      updates.novaTimeWarpInventory = timeWarp;
    }
    return {
      updates,
      result:{
        opened:true,
        boosted,
        reward,
        balance,
        cooldownUntil,
        novaVaultPending:inv.pendingVaults - 1,
        inventory:{ booster, rain, timeWarp, pendingVaults:inv.pendingVaults - 1 },
        backend:'cloudflare-v2'
      }
    };
  });
}

async function useBoost(env, user, body) {
  const now = Date.now();
  const kind = String(body?.kind || '').toLowerCase();
  if (kind !== 'booster' && kind !== 'rain') throw new ApiError('unknown_boost', 'Unknown Nova Boost.', 400);
  return mutateUser(env, user.uid, data => {
    requireCooldown(data, now);
    const inv = inventoryOf(data);
    const mining = miningOf(data, now);
    if (!mining.active || mining.started <= 0) throw new ApiError('mining_inactive', 'Start mining first.', 409);
    if (mining.elapsed >= DAY) throw new ApiError('session_complete', 'Mining session is already complete.', 409);

    const uses = optionalInt(data, 'novaBoostUsesThisSession', 0);
    const boosterUses = optionalInt(data, 'novaBoosterUsesThisSession', 0);
    const rainUses = optionalInt(data, 'novaRainUsesThisSession', 0);
    if (uses >= NOVA_MAX_BOOST_USES) throw new ApiError('boost_limit', 'Maximum 6 boost charges can be used per mining session.', 429);
    if (kind === 'booster' && boosterUses >= NOVA_MAX_BOOSTER_USES) throw new ApiError('booster_limit', 'Maximum 2 Nova Boosters can be used per mining session.', 429);
    if (kind === 'rain' && rainUses >= NOVA_MAX_RAIN_USES) throw new ApiError('rain_limit', 'Maximum 4 Nova Rain uses can be used per mining session.', 429);
    if (kind === 'booster' && inv.booster < 1) throw new ApiError('no_booster', 'No Nova Booster available.', 409);
    if (kind === 'rain' && inv.rain < 1) throw new ApiError('no_rain', 'No Nova Rain available.', 409);

    const newStart = Math.max(1, mining.started - NOVA_BOOST_MS);
    const updates = {
      miningStartedAt:newStart,
      miningLastUpdate:now,
      novaBoostUsesThisSession:uses + 1,
      novaFeatureCooldownUntil:now + NOVA_COOLDOWN
    };
    if (kind === 'booster') {
      updates.novaBoosterInventory = inv.booster - 1;
      updates.novaBoosterUsesThisSession = boosterUses + 1;
    } else {
      updates.novaRainInventory = inv.rain - 1;
      updates.novaRainUsesThisSession = rainUses + 1;
    }
    return {
      updates,
      result:{
        kind,
        miningActive:true,
        miningStartedAt:newStart,
        cooldownUntil:now + NOVA_COOLDOWN,
        reducedHours:(uses + 1) * 2,
        novaVaultPending:inv.pendingVaults,
        inventory:{
          booster:kind === 'booster' ? inv.booster - 1 : inv.booster,
          rain:kind === 'rain' ? inv.rain - 1 : inv.rain,
          timeWarp:inv.timeWarp,
          pendingVaults:inv.pendingVaults
        },
        backend:'cloudflare-v2'
      }
    };
  });
}

async function useTimeWarp(env, user) {
  const now = Date.now();
  return mutateUser(env, user.uid, data => {
    requireCooldown(data, now);
    const inv = inventoryOf(data);
    const mining = miningOf(data, now);
    if (inv.timeWarp < 1) throw new ApiError('no_time_warp', 'No Time Warp available.', 409);
    if (!mining.active || mining.started <= 0) throw new ApiError('mining_inactive', 'Start mining first.', 409);
    if (mining.elapsed >= DAY) throw new ApiError('session_complete', 'Mining session is already complete.', 409);

    const balance = requiredNumber(data, 'balance');
    const totalMined = requiredNumber(data, 'totalMined');
    const nextBalance = balance + MINING_REWARD;
    const nextTotal = totalMined + MINING_REWARD;
    const cooldownUntil = now + NOVA_COOLDOWN;
    return {
      updates:{
        balance:nextBalance,
        totalMined:nextTotal,
        miningActive:true,
        miningStartedAt:now,
        miningLastUpdate:now,
        novaTimeWarpInventory:inv.timeWarp - 1,
        novaFeatureCooldownUntil:cooldownUntil,
        novaBoostUsesThisSession:0,
        novaBoosterUsesThisSession:0,
        novaRainUsesThisSession:0
      },
      result:{
        earned:MINING_REWARD,
        balance:nextBalance,
        totalMined:nextTotal,
        miningActive:true,
        miningStartedAt:now,
        cooldownUntil,
        novaVaultPending:inv.pendingVaults,
        inventory:{ booster:inv.booster, rain:inv.rain, timeWarp:inv.timeWarp - 1, pendingVaults:inv.pendingVaults },
        backend:'cloudflare-v2'
      }
    };
  });
}

async function health(env) {
  let serviceAccountReady = false;
  try { serviceAccount(env); serviceAccountReady = true; } catch {}
  return json({
    ok:true,
    service:'nova-mining-rewards',
    version:'v2',
    execution:'cloudflare-worker',
    functionsDependency:false,
    auth:'firebase-id-token',
    storage:'firestore-rest-via-cloudflare',
    serviceAccountReady
  });
}

async function handle(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') return health(env);
  if (request.method === 'GET' && url.pathname === '/v1/rewards/admob-ssv') {
    return json({ ok:true, credited:false, directNvx:false, miningValue:false, reason:'ads_do_not_grant_mining_or_token_value' });
  }
  if (request.method !== 'POST') return fail('method_not_allowed', 'Method not allowed.', 405);

  const user = await verifyFirebaseUser(request, env);
  const body = await requestJson(request);
  let data;
  if (url.pathname === '/v1/tasks/daily/claim') data = await dailyReward(env, user);
  else if (url.pathname === '/v1/mining/toggle') data = await toggleMining(env, user);
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
      console.error('Nova mining rewards v2 error', error?.stack || error);
      return fail('internal', 'Cloudflare mining rewards service could not complete the request.', 500);
    }
  }
};
