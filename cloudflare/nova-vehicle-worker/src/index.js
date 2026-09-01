const PAIR_TTL_MS = 10 * 60 * 1000;
const MAX_VEHICLES = 8;
const MAX_NAME = 40;
const MAX_DEVICE_LABEL = 60;
const HISTORY_INTERVAL_MS = 60 * 1000;
const MIN_TELEMETRY_INTERVAL_MS = 3_000;
const MAX_REPLAY_POINTS = 40;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store'
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function fail(code, message, status = 400) {
  return json({ ok: false, code, message }, status);
}

function cleanText(value, fallback = '', max = 80) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, max);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function randomString(length, alphabet = '0123456789abcdef') {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let output = '';
  for (let index = 0; index < length; index += 1) output += alphabet[bytes[index] % alphabet.length];
  return output;
}

function randomCode(length = 12) {
  return randomString(length, CODE_ALPHABET);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function requestJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 32_768) throw new Error('payload-too-large');
  try { return await request.json(); }
  catch { return {}; }
}

function bearer(request) {
  const value = String(request.headers.get('authorization') || '');
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : '';
}

function csvSet(value) {
  return new Set(String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean));
}

async function verifyFirebaseOwner(request, env) {
  const idToken = bearer(request);
  if (!idToken) return { error: fail('unauthenticated', 'Sign in first.', 401) };
  const apiKey = String(env.FIREBASE_WEB_API_KEY || '').trim();
  if (!apiKey) return { error: fail('server_config', 'Owner authentication is not configured.', 503) };

  let payload;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (!response.ok) return { error: fail('unauthenticated', 'Your sign-in session is invalid or expired.', 401) };
    payload = await response.json();
  } catch {
    return { error: fail('auth_unavailable', 'Authentication check is temporarily unavailable.', 503) };
  }

  const user = Array.isArray(payload?.users) ? payload.users[0] : null;
  const uid = cleanText(user?.localId, '', 128);
  const email = cleanText(user?.email, '', 254).toLowerCase();
  const verified = user?.emailVerified === true;
  if (!uid || !verified) return { error: fail('verification_required', 'A verified account is required.', 403) };

  const uidHashAllow = csvSet(env.PREMIUM_OWNER_UID_SHA256S);
  const emailHashAllow = csvSet(env.PREMIUM_OWNER_EMAIL_SHA256S);
  const uidHash = await sha256(uid);
  const emailHash = email ? await sha256(email) : '';
  const entitled = uidHashAllow.has(uidHash) || (emailHash && emailHashAllow.has(emailHash));
  if (!entitled) return { error: fail('premium_required', 'Nova Vehicle Premium is not enabled for this account.', 403) };
  return { uid, email };
}

function db(env) {
  if (!env.NOVA_VEHICLE_DB) throw new Error('missing-d1-binding');
  return env.NOVA_VEHICLE_DB;
}

function mapVehicle(row, now) {
  const receivedAt = finite(row.received_at, 0);
  const trackerBound = Number(row.tracker_bound) === 1 && !row.revoked_at;
  const hasLive = Number.isFinite(Number(row.live_lat)) && Number.isFinite(Number(row.live_lng));
  return {
    vehicleId: String(row.vehicle_id || ''),
    displayName: String(row.display_name || 'Vehicle'),
    status: trackerBound && receivedAt > 0 && now - receivedAt < 120_000 ? 'online' : trackerBound ? 'offline' : 'unpaired',
    trackerBound,
    trackerOnline: trackerBound && receivedAt > 0 && now - receivedAt < 120_000,
    lastSeenAt: finite(row.last_seen_at, 0),
    live: hasLive ? {
      latitude: finite(row.live_lat, 0),
      longitude: finite(row.live_lng, 0),
      accuracyM: Math.max(0, finite(row.live_accuracy, 0)),
      speedKmh: Math.max(0, finite(row.live_speed, 0)),
      heading: Math.max(0, finite(row.live_heading, 0)),
      batteryPct: clamp(row.live_battery, 0, 100),
      charging: Number(row.live_charging) === 1,
      externalPower: Number(row.live_external_power) === 1,
      observedAt: finite(row.observed_at, 0),
      receivedAt
    } : null
  };
}

function telemetryPoint(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const latitude = finite(raw.latitude, NaN);
  const longitude = finite(raw.longitude, NaN);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {
    latitude,
    longitude,
    accuracyM: clamp(raw.accuracyM, 0, 5000),
    speedKmh: clamp(raw.speedKmh, 0, 350),
    heading: ((finite(raw.heading, 0) % 360) + 360) % 360,
    batteryPct: clamp(raw.batteryPct, 0, 100),
    charging: raw.charging === true ? 1 : 0,
    externalPower: raw.externalPower === true ? 1 : 0,
    observedAt: Math.round(Math.min(now + 60_000, Math.max(now - 24 * 60 * 60 * 1000, finite(raw.observedAt, now))))
  };
}

function historyInsert(store, vehicleId, point, receivedAt) {
  return store.prepare(`INSERT OR IGNORE INTO telemetry_history
    (vehicle_id, observed_at, received_at, latitude, longitude, accuracy_m, speed_kmh, heading, battery_pct, external_power)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(vehicleId, point.observedAt, receivedAt, point.latitude, point.longitude, point.accuracyM, point.speedKmh, point.heading, point.batteryPct, point.externalPower);
}

async function createPairing(request, env, owner) {
  const body = await requestJson(request);
  const store = db(env);
  const now = Date.now();
  const count = await store.prepare('SELECT COUNT(*) AS count FROM vehicles WHERE owner_uid = ? AND revoked_at IS NULL')
    .bind(owner.uid).first();
  if (finite(count?.count, 0) >= MAX_VEHICLES) return fail('vehicle_limit', 'Vehicle limit reached.', 409);

  const vehicleId = `nv-${randomString(24)}`;
  const pairingCode = randomCode(12);
  const codeHash = await sha256(pairingCode);
  const displayName = cleanText(body?.vehicleName, 'Vehicle', MAX_NAME);
  const expiresAt = now + PAIR_TTL_MS;

  await store.batch([
    store.prepare(`INSERT INTO vehicles
      (vehicle_id, owner_uid, owner_email, display_name, tracker_bound, created_at)
      VALUES (?, ?, ?, ?, 0, ?)`)
      .bind(vehicleId, owner.uid, owner.email || '', displayName, now),
    store.prepare(`INSERT INTO pairings
      (code_hash, owner_uid, vehicle_id, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, NULL, ?)`)
      .bind(codeHash, owner.uid, vehicleId, expiresAt, now)
  ]);

  return json({ ok: true, vehicleId, vehicleName: displayName, pairingCode, expiresAt });
}

async function ownerDashboard(env, owner) {
  const now = Date.now();
  const result = await db(env).prepare(`SELECT * FROM vehicles
    WHERE owner_uid = ? AND revoked_at IS NULL
    ORDER BY created_at DESC LIMIT ?`)
    .bind(owner.uid, MAX_VEHICLES).all();
  return json({ ok: true, entitled: true, vehicles: (result.results || []).map(row => mapVehicle(row, now)), serverNow: now });
}

async function ownerHistory(url, env, owner) {
  const vehicleId = cleanText(url.searchParams.get('vehicleId'), '', 100);
  const limit = Math.max(10, Math.min(500, Math.round(finite(url.searchParams.get('limit'), 180))));
  if (!vehicleId) return fail('missing_vehicle', 'Vehicle id is missing.');
  const result = await db(env).prepare(`SELECT h.observed_at, h.received_at, h.latitude, h.longitude,
      h.accuracy_m, h.speed_kmh, h.heading, h.battery_pct, h.external_power
    FROM telemetry_history h JOIN vehicles v ON v.vehicle_id = h.vehicle_id
    WHERE h.vehicle_id = ? AND v.owner_uid = ? AND v.revoked_at IS NULL
    ORDER BY h.observed_at DESC LIMIT ?`)
    .bind(vehicleId, owner.uid, limit).all();
  return json({ ok: true, vehicleId, points: result.results || [] });
}

async function revokeVehicle(request, env, owner) {
  const body = await requestJson(request);
  const vehicleId = cleanText(body?.vehicleId, '', 100);
  if (!vehicleId) return fail('missing_vehicle', 'Vehicle id is missing.');
  const store = db(env);
  const now = Date.now();
  const result = await store.prepare(`UPDATE vehicles
    SET revoked_at = ?, tracker_bound = 0, device_token_hash = NULL, device_label = NULL
    WHERE vehicle_id = ? AND owner_uid = ? AND revoked_at IS NULL`)
    .bind(now, vehicleId, owner.uid).run();
  if (!result.meta?.changes) return fail('not_found', 'Vehicle was not found.', 404);
  await store.prepare('DELETE FROM pairings WHERE vehicle_id = ?').bind(vehicleId).run();
  return json({ ok: true });
}

async function claimPairing(request, env) {
  const body = await requestJson(request);
  const code = cleanText(body?.pairingCode, '', 24).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 12) return fail('invalid_pairing', 'Pairing code is invalid.', 400);
  const codeHash = await sha256(code);
  const store = db(env);
  const now = Date.now();
  const row = await store.prepare(`SELECT p.vehicle_id, p.expires_at, p.used_at, v.display_name, v.revoked_at
    FROM pairings p JOIN vehicles v ON v.vehicle_id = p.vehicle_id
    WHERE p.code_hash = ?`).bind(codeHash).first();
  if (!row || row.used_at || row.revoked_at || finite(row.expires_at, 0) <= now) {
    return fail('invalid_pairing', 'Pairing code is invalid, expired, or already used.', 410);
  }

  const won = await store.prepare(`UPDATE pairings SET used_at = ?
    WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`)
    .bind(now, codeHash, now).run();
  if (!won.meta?.changes) return fail('invalid_pairing', 'Pairing code was already used.', 409);

  const token = randomToken();
  const tokenHash = await sha256(token);
  const deviceLabel = cleanText(body?.deviceLabel, 'NexusNova Tracker', MAX_DEVICE_LABEL);
  await store.prepare(`UPDATE vehicles SET
    device_token_hash = ?, device_label = ?, tracker_bound = 1, revoked_at = NULL
    WHERE vehicle_id = ?`)
    .bind(tokenHash, deviceLabel, row.vehicle_id).run();

  return json({ ok: true, token, vehicleId: row.vehicle_id, vehicleName: row.display_name || 'Vehicle' });
}

async function pushTelemetry(request, env) {
  const token = bearer(request);
  if (!/^[a-f0-9]{64}$/i.test(token)) return fail('unauthorized_tracker', 'Tracker token is invalid.', 401);
  const tokenHash = await sha256(token.toLowerCase());
  const store = db(env);
  const vehicle = await store.prepare(`SELECT vehicle_id, last_seen_at, last_history_at
    FROM vehicles WHERE device_token_hash = ? AND revoked_at IS NULL AND tracker_bound = 1`)
    .bind(tokenHash).first();
  if (!vehicle) return fail('unauthorized_tracker', 'Tracker access is invalid or revoked.', 401);

  const now = Date.now();
  const lastSeen = finite(vehicle.last_seen_at, 0);
  if (lastSeen > 0 && now - lastSeen < MIN_TELEMETRY_INTERVAL_MS) return fail('too_fast', 'Telemetry rate is too high.', 429);

  const body = await requestJson(request);
  const current = telemetryPoint(body, now);
  if (!current) return fail('invalid_location', 'Location coordinates are invalid.');

  const replaySeen = new Set();
  const replay = (Array.isArray(body?.history) ? body.history : [])
    .slice(-MAX_REPLAY_POINTS)
    .map(point => telemetryPoint(point, now))
    .filter(point => {
      if (!point || point.observedAt >= current.observedAt || replaySeen.has(point.observedAt)) return false;
      replaySeen.add(point.observedAt);
      return true;
    });

  const statements = [
    store.prepare(`UPDATE vehicles SET
      last_seen_at = ?, live_lat = ?, live_lng = ?, live_accuracy = ?, live_speed = ?, live_heading = ?,
      live_battery = ?, live_charging = ?, live_external_power = ?, observed_at = ?, received_at = ?
      WHERE vehicle_id = ?`)
      .bind(now, current.latitude, current.longitude, current.accuracyM, current.speedKmh, current.heading,
        current.batteryPct, current.charging, current.externalPower, current.observedAt, now, vehicle.vehicle_id),
    ...replay.map(point => historyInsert(store, vehicle.vehicle_id, point, now))
  ];

  const lastHistoryAt = finite(vehicle.last_history_at, 0);
  if (now - lastHistoryAt >= HISTORY_INTERVAL_MS) {
    statements.push(historyInsert(store, vehicle.vehicle_id, current, now));
    statements.push(store.prepare('UPDATE vehicles SET last_history_at = ? WHERE vehicle_id = ?').bind(now, vehicle.vehicle_id));
  }
  await store.batch(statements);

  return json({ ok: true, serverNow: now, replayed: replay.length });
}

async function cleanup(env) {
  const store = db(env);
  const now = Date.now();
  const historyCutoff = now - 30 * 24 * 60 * 60 * 1000;
  await store.batch([
    store.prepare('DELETE FROM pairings WHERE expires_at < ? OR used_at IS NOT NULL').bind(now - 60 * 60 * 1000),
    store.prepare('DELETE FROM telemetry_history WHERE received_at < ?').bind(historyCutoff)
  ]);
  return json({ ok: true });
}

async function route(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/health' && request.method === 'GET') return json({ ok: true, service: 'nova-vehicle-premium', storage: 'cloudflare-d1' });
  if (path === '/v1/tracker/claim' && request.method === 'POST') return claimPairing(request, env);
  if (path === '/v1/tracker/telemetry' && request.method === 'POST') return pushTelemetry(request, env);

  if (path.startsWith('/v1/owner/')) {
    const owner = await verifyFirebaseOwner(request, env);
    if (owner.error) return owner.error;
    if (path === '/v1/owner/pairing' && request.method === 'POST') return createPairing(request, env, owner);
    if (path === '/v1/owner/dashboard' && request.method === 'GET') return ownerDashboard(env, owner);
    if (path === '/v1/owner/history' && request.method === 'GET') return ownerHistory(url, env, owner);
    if (path === '/v1/owner/revoke' && request.method === 'POST') return revokeVehicle(request, env, owner);
  }

  if (path === '/internal/cleanup' && request.method === 'POST') {
    const secret = String(request.headers.get('x-nova-cleanup-secret') || '');
    if (!env.CLEANUP_SECRET || secret !== String(env.CLEANUP_SECRET)) return fail('forbidden', 'Forbidden.', 403);
    return cleanup(env);
  }
  return fail('not_found', 'Route not found.', 404);
}

export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (error) {
      console.error('Nova Vehicle Worker error', error);
      return fail('internal', 'Nova Vehicle Premium is temporarily unavailable.', 500);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cleanup(env));
  }
};
