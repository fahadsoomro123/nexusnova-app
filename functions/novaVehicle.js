const crypto = require('node:crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

const PAIR_TTL_MS = 10 * 60 * 1000;
const MAX_VEHICLES = 8;
const MAX_NAME = 40;
const MAX_DEVICE_LABEL = 60;
const HISTORY_INTERVAL_MS = 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const protectedCallable = handler => onCall({ enforceAppCheck: true }, handler);

function ownerUid(req) {
  const uid = String(req.auth?.uid || '').trim();
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (req.auth?.token?.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Verify your email first.');
  }
  return uid;
}

function cleanText(value, fallback, max) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, max);
}

function randomCode(length = 12) {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!new RegExp(`^[${CODE_ALPHABET}]{12}$`).test(code)) return '';
  return code;
}

function json(res, status, body) {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
}

function cors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'authorization, content-type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

function asFinite(value, min, max, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

function tokenFromRequest(req) {
  const auth = String(req.get('authorization') || '');
  const match = auth.match(/^Bearer\s+([a-fA-F0-9]{64})$/);
  return match ? match[1].toLowerCase() : '';
}

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

exports.createNovaVehiclePairing = protectedCallable(async req => {
  const uid = ownerUid(req);
  const vehicleName = cleanText(req.data?.vehicleName, 'Vehicle', MAX_NAME);
  const vehicleCollection = db.collection('users').doc(uid).collection('novaVehicles');
  const existing = await vehicleCollection.limit(MAX_VEHICLES + 1).get();
  if (existing.size >= MAX_VEHICLES) {
    throw new HttpsError('resource-exhausted', `Nova Vehicle Premium supports up to ${MAX_VEHICLES} paired vehicles.`);
  }

  const vehicleRef = vehicleCollection.doc();
  const code = randomCode();
  const pairingHash = sha256(`nova-vehicle-pair-v1:${code}`);
  const pairingRef = db.collection('novaVehiclePairings').doc(pairingHash);
  const now = Date.now();
  const expiresAt = now + PAIR_TTL_MS;

  const batch = db.batch();
  batch.set(vehicleRef, {
    ownerUid: uid,
    displayName: vehicleName,
    status: 'awaiting_tracker',
    trackerBound: false,
    trackerOnline: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSeenAt: null
  });
  batch.set(pairingRef, {
    ownerUid: uid,
    vehicleId: vehicleRef.id,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    used: false
  });
  await batch.commit();

  return { vehicleId: vehicleRef.id, vehicleName, pairingCode: code, expiresAt };
});

exports.getNovaVehicleDashboard = protectedCallable(async req => {
  const uid = ownerUid(req);
  const collection = db.collection('users').doc(uid).collection('novaVehicles');
  const snap = await collection.limit(MAX_VEHICLES).get();
  const vehicles = await Promise.all(snap.docs.map(async vehicleDoc => {
    const data = vehicleDoc.data() || {};
    const liveSnap = await vehicleDoc.ref.collection('telemetry').doc('live').get();
    const live = liveSnap.exists ? (liveSnap.data() || {}) : null;
    return {
      vehicleId: vehicleDoc.id,
      displayName: String(data.displayName || 'Vehicle'),
      status: String(data.status || 'offline'),
      trackerBound: data.trackerBound === true,
      trackerOnline: data.trackerOnline === true,
      lastSeenAt: millis(data.lastSeenAt),
      live: live ? {
        latitude: Number(live.latitude) || 0,
        longitude: Number(live.longitude) || 0,
        accuracyM: Number(live.accuracyM) || 0,
        speedKmh: Number(live.speedKmh) || 0,
        heading: Number(live.heading) || 0,
        batteryPct: Number(live.batteryPct) || 0,
        charging: live.charging === true,
        externalPower: live.externalPower === true,
        observedAt: Number(live.observedAt) || 0,
        receivedAt: millis(live.receivedAt)
      } : null
    };
  }));
  vehicles.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
  return { vehicles, serverNow: Date.now() };
});

exports.revokeNovaVehicle = protectedCallable(async req => {
  const uid = ownerUid(req);
  const vehicleId = String(req.data?.vehicleId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(vehicleId)) {
    throw new HttpsError('invalid-argument', 'Invalid vehicle id.');
  }
  const vehicleRef = db.collection('users').doc(uid).collection('novaVehicles').doc(vehicleId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(vehicleRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Vehicle not found.');
    const tokenHash = String(snap.data()?.tokenHash || '');
    if (tokenHash) {
      const tokenRef = db.collection('novaVehicleDeviceTokens').doc(tokenHash);
      tx.set(tokenRef, { revoked: true, revokedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    tx.set(vehicleRef, {
      status: 'revoked',
      trackerBound: false,
      trackerOnline: false,
      tokenHash: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { ok: true, vehicleId };
});

exports.claimNovaVehiclePairing = onRequest(async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const code = normalizeCode(req.body?.pairingCode);
  if (!code) return json(res, 400, { ok: false, error: 'invalid_pairing_code' });
  const pairingHash = sha256(`nova-vehicle-pair-v1:${code}`);
  const pairingRef = db.collection('novaVehiclePairings').doc(pairingHash);
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  const tokenRef = db.collection('novaVehicleDeviceTokens').doc(tokenHash);
  const deviceLabel = cleanText(req.body?.deviceLabel, 'NexusNova Tracker', MAX_DEVICE_LABEL);
  const now = Date.now();
  let payload = null;

  try {
    payload = await db.runTransaction(async tx => {
      const pairingSnap = await tx.get(pairingRef);
      if (!pairingSnap.exists) throw new Error('invalid_or_expired');
      const pairing = pairingSnap.data() || {};
      if (pairing.used === true || Number(pairing.expiresAt) < now) throw new Error('invalid_or_expired');
      const uid = String(pairing.ownerUid || '');
      const vehicleId = String(pairing.vehicleId || '');
      if (!uid || !vehicleId) throw new Error('invalid_or_expired');
      const vehicleRef = db.collection('users').doc(uid).collection('novaVehicles').doc(vehicleId);
      const vehicleSnap = await tx.get(vehicleRef);
      if (!vehicleSnap.exists) throw new Error('invalid_or_expired');
      const vehicle = vehicleSnap.data() || {};

      tx.create(tokenRef, {
        ownerUid: uid,
        vehicleId,
        deviceLabel,
        revoked: false,
        createdAt: FieldValue.serverTimestamp(),
        lastSeenAt: null,
        lastHistoryAt: 0
      });
      tx.set(vehicleRef, {
        status: 'paired',
        trackerBound: true,
        trackerOnline: false,
        tokenHash,
        deviceLabel,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      tx.set(pairingRef, { used: true, usedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { vehicleId, vehicleName: String(vehicle.displayName || 'Vehicle') };
    });
  } catch (error) {
    console.warn('[Nova Vehicle] pairing claim rejected:', error?.message || error);
    return json(res, 400, { ok: false, error: 'invalid_or_expired_pairing_code' });
  }

  return json(res, 200, { ok: true, token, ...payload });
});

exports.pushNovaVehicleTelemetry = onRequest(async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const token = tokenFromRequest(req);
  if (!token) return json(res, 401, { ok: false, error: 'invalid_device_token' });

  const tokenHash = sha256(token);
  const tokenRef = db.collection('novaVehicleDeviceTokens').doc(tokenHash);
  const bindingSnap = await tokenRef.get();
  if (!bindingSnap.exists || bindingSnap.data()?.revoked === true) {
    return json(res, 401, { ok: false, error: 'revoked_or_unknown_device' });
  }
  const binding = bindingSnap.data() || {};
  const uid = String(binding.ownerUid || '');
  const vehicleId = String(binding.vehicleId || '');
  if (!uid || !vehicleId) return json(res, 401, { ok: false, error: 'invalid_device_binding' });

  const latitude = asFinite(req.body?.latitude, -90, 90);
  const longitude = asFinite(req.body?.longitude, -180, 180);
  const accuracyM = asFinite(req.body?.accuracyM, 0, 5000, 0);
  const speedKmh = asFinite(req.body?.speedKmh, 0, 350, 0);
  const heading = asFinite(req.body?.heading, 0, 360, 0);
  const batteryPct = asFinite(req.body?.batteryPct, 0, 100, 0);
  if (latitude === null || longitude === null) {
    return json(res, 400, { ok: false, error: 'invalid_location' });
  }
  const observedAtRaw = Number(req.body?.observedAt);
  const observedAt = Number.isFinite(observedAtRaw) && Math.abs(Date.now() - observedAtRaw) < 24 * 60 * 60 * 1000
    ? Math.round(observedAtRaw)
    : Date.now();
  const charging = req.body?.charging === true;
  const externalPower = req.body?.externalPower === true;
  const now = Date.now();
  const vehicleRef = db.collection('users').doc(uid).collection('novaVehicles').doc(vehicleId);
  const liveRef = vehicleRef.collection('telemetry').doc('live');
  const lastHistoryAt = Number(binding.lastHistoryAt) || 0;
  const shouldHistory = speedKmh >= 2 && now - lastHistoryAt >= HISTORY_INTERVAL_MS;
  const historyRef = shouldHistory ? vehicleRef.collection('history').doc() : null;
  const telemetry = {
    latitude,
    longitude,
    accuracyM,
    speedKmh,
    heading,
    batteryPct,
    charging,
    externalPower,
    observedAt,
    receivedAt: FieldValue.serverTimestamp()
  };

  const batch = db.batch();
  batch.set(liveRef, telemetry, { merge: false });
  batch.set(vehicleRef, {
    status: 'online',
    trackerBound: true,
    trackerOnline: true,
    lastSeenAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(tokenRef, {
    lastSeenAt: FieldValue.serverTimestamp(),
    ...(shouldHistory ? { lastHistoryAt: now } : {})
  }, { merge: true });
  if (historyRef) batch.set(historyRef, telemetry);
  await batch.commit();

  return json(res, 200, { ok: true, vehicleId, serverNow: now });
});
