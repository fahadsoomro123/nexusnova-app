const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/*
  NexusNova AdMob rewarded SSV v2.

  One production rewarded unit is shared by opt-in features. Google's signed
  custom_data selects the purpose. A client-side rewarded-earned event can
  never create value here.

  Supported value-bearing purposes:
  - task-watch-ad: +2.5 NVX, preserving the existing behavior.
  - nova-vault-10x: +1 server-side Nova Vault boost credit (max 3 banked).

  The boost credit is only an entitlement. The separate App-Check-protected
  openNovaVaultBoosted callable consumes one entitlement and one pending Vault
  atomically before granting the randomized reward.
*/

const GOOGLE_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const EXPECTED_AD_UNIT = '7194148596';
const WATCH_PURPOSE = 'task-watch-ad';
const VAULT_PURPOSE = 'nova-vault-10x';
const WATCH_REWARD_NVX = 2.5;
const MAX_VAULT_BOOST_CREDITS = 3;
const MAX_URL_LENGTH = 16 * 1024;
const MAX_UID_LENGTH = 128;
const MAX_TRANSACTION_ID = 256;
const KEY_CACHE_MS = 12 * 60 * 60 * 1000;

let keyCache = { expiresAt: 0, keys: new Map() };

function clean(value, maxLength) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) return '';
  return text;
}

function callbackUrl(req) {
  const original = String(req.originalUrl || req.url || '');
  if (!original || original.length > MAX_URL_LENGTH) throw new Error('invalid callback url');
  return new URL(original, 'https://nexusnova.invalid');
}

function rawQuery(req) {
  const original = String(req.originalUrl || req.url || '');
  const q = original.indexOf('?');
  if (q < 0 || q === original.length - 1) throw new Error('missing query');
  return original.slice(q + 1);
}

function decodeBase64Url(value) {
  const text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error('invalid signature encoding');
  const padding = (4 - (text.length % 4)) % 4;
  return Buffer.from(text + '='.repeat(padding), 'base64');
}

function signedCallbackParts(req) {
  const query = rawQuery(req);
  const signatureMarker = '&signature=';
  const signatureIndex = query.indexOf(signatureMarker);
  if (signatureIndex <= 0) throw new Error('missing signature');

  const keyMarker = '&key_id=';
  const keyIndex = query.indexOf(keyMarker, signatureIndex + signatureMarker.length);
  if (keyIndex <= signatureIndex) throw new Error('missing key_id');
  if (query.indexOf('&', keyIndex + keyMarker.length) !== -1) {
    throw new Error('unexpected parameters after key_id');
  }

  const content = query.slice(0, signatureIndex);
  const signatureEncoded = query.slice(signatureIndex + signatureMarker.length, keyIndex);
  const keyIdText = query.slice(keyIndex + keyMarker.length);
  const keyId = Number(keyIdText);
  if (!Number.isSafeInteger(keyId) || keyId < 0) throw new Error('invalid key_id');

  return {
    content,
    signature: decodeBase64Url(decodeURIComponent(signatureEncoded)),
    keyId
  };
}

async function googleKeys() {
  const now = Date.now();
  if (keyCache.keys.size && now < keyCache.expiresAt) return keyCache.keys;

  const response = await fetch(GOOGLE_KEYS_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error(`Google key server HTTP ${response.status}`);
  const body = await response.json();
  const next = new Map();
  for (const item of Array.isArray(body?.keys) ? body.keys : []) {
    const keyId = Number(item?.keyId);
    const pem = String(item?.pem || '');
    if (Number.isSafeInteger(keyId) && keyId >= 0 && pem.includes('BEGIN PUBLIC KEY')) {
      next.set(keyId, pem);
    }
  }
  if (!next.size) throw new Error('no Google verification keys');
  keyCache = { expiresAt: now + KEY_CACHE_MS, keys: next };
  return next;
}

async function verifyGoogleSignature(req) {
  const parts = signedCallbackParts(req);
  const keys = await googleKeys();
  const pem = keys.get(parts.keyId);
  if (!pem) throw new Error('unknown Google key_id');
  const valid = crypto.verify('sha256', Buffer.from(parts.content, 'utf8'), pem, parts.signature);
  return { valid, keyId: parts.keyId };
}

function txDocId(transactionId) {
  return crypto.createHash('sha256').update(transactionId).digest('hex');
}

function response(res, status, body) {
  return res.status(status).json(body);
}

function safeProfileNumber(data, field) {
  const value = Number(data?.[field]);
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Error(`invalid user ${field}`);
  }
  return value;
}

function safeProfileInt(data, field, fallback = 0) {
  const raw = data?.[field];
  if (raw === undefined || raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid user ${field}`);
  return value;
}

exports.admobRewardedSsv = onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    return response(res, 405, { ok: false, credited: false, reason: 'method_not_allowed' });
  }

  let verified;
  try {
    verified = await verifyGoogleSignature(req);
  } catch (error) {
    const transient = /key server|verification keys|fetch|timeout/i.test(String(error?.message || ''));
    console.warn('AdMob SSV v2 verification error:', error?.message || error);
    return response(res, transient ? 503 : 200, {
      ok: false,
      credited: false,
      reason: transient ? 'verification_temporarily_unavailable' : 'invalid_callback'
    });
  }

  if (!verified.valid) {
    return response(res, 200, { ok: false, credited: false, reason: 'invalid_signature' });
  }

  try {
    const url = callbackUrl(req);
    const params = url.searchParams;
    const transactionId = clean(params.get('transaction_id'), MAX_TRANSACTION_ID);
    const uid = clean(params.get('user_id'), MAX_UID_LENGTH);
    const purpose = clean(params.get('custom_data'), 80);
    const adUnit = clean(params.get('ad_unit'), 128);
    const timestamp = Number(params.get('timestamp'));

    if (!transactionId || !/^[A-Za-z0-9_-]{8,256}$/.test(transactionId)) {
      return response(res, 200, { ok: false, credited: false, reason: 'invalid_transaction_id' });
    }
    if (!uid || !/^[A-Za-z0-9:_-]{3,128}$/.test(uid)) {
      return response(res, 200, { ok: false, credited: false, reason: 'invalid_user_id' });
    }
    if (purpose !== WATCH_PURPOSE && purpose !== VAULT_PURPOSE) {
      return response(res, 200, { ok: true, credited: false, reason: 'non_value_purpose' });
    }
    if (adUnit !== EXPECTED_AD_UNIT && !adUnit.endsWith(`/${EXPECTED_AD_UNIT}`)) {
      return response(res, 200, { ok: false, credited: false, reason: 'wrong_ad_unit' });
    }
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return response(res, 200, { ok: false, credited: false, reason: 'invalid_timestamp' });
    }

    const db = getFirestore();
    const rewardRef = db.collection('admobRewardTransactions').doc(txDocId(transactionId));
    const userRef = db.collection('users').doc(uid);

    const outcome = await db.runTransaction(async tx => {
      const [rewardSnap, userSnap] = await Promise.all([tx.get(rewardRef), tx.get(userRef)]);
      if (rewardSnap.exists) return { duplicate: true, credited: false };
      if (!userSnap.exists) return { missingUser: true, credited: false };

      const data = userSnap.data() || {};
      const commonRecord = {
        provider: 'admob',
        transactionId,
        uid,
        purpose,
        adUnit,
        adNetwork: String(params.get('ad_network') || '').slice(0, 64),
        rewardAmountReported: String(params.get('reward_amount') || '').slice(0, 32),
        rewardItemReported: String(params.get('reward_item') || '').slice(0, 64),
        googleTimestamp: timestamp,
        keyId: verified.keyId,
        createdAt: FieldValue.serverTimestamp()
      };

      if (purpose === WATCH_PURPOSE) {
        const balance = safeProfileNumber(data, 'balance');
        if (balance > Number.MAX_SAFE_INTEGER - WATCH_REWARD_NVX) throw new Error('invalid user balance');
        const nextBalance = balance + WATCH_REWARD_NVX;
        tx.set(rewardRef, {
          ...commonRecord,
          fulfillment: 'watch-ad-nvx',
          rewardNvx: WATCH_REWARD_NVX
        });
        tx.update(userRef, {
          balance: nextBalance,
          rewardedAdCount: FieldValue.increment(1),
          rewardedAdTotalNvx: FieldValue.increment(WATCH_REWARD_NVX),
          lastRewardedAdAt: FieldValue.serverTimestamp()
        });
        return { credited: true, purpose, balance: nextBalance, rewardNvx: WATCH_REWARD_NVX };
      }

      const credits = safeProfileInt(data, 'novaVaultBoostCredits', 0);
      const nextCredits = Math.min(MAX_VAULT_BOOST_CREDITS, credits + 1);
      const granted = nextCredits > credits;
      tx.set(rewardRef, {
        ...commonRecord,
        fulfillment: 'nova-vault-10x-credit',
        boostCreditGranted: granted,
        boostCreditsAfter: nextCredits
      });
      if (granted) {
        tx.update(userRef, {
          novaVaultBoostCredits: nextCredits,
          novaVaultBoostAdCount: FieldValue.increment(1),
          lastNovaVaultBoostAdAt: FieldValue.serverTimestamp()
        });
      }
      return { credited: granted, purpose, boostCredits: nextCredits, capped: !granted };
    });

    if (outcome.duplicate) return response(res, 200, { ok: true, credited: false, duplicate: true });
    if (outcome.missingUser) return response(res, 200, { ok: false, credited: false, reason: 'user_not_found' });
    if (purpose === WATCH_PURPOSE) {
      return response(res, 200, {
        ok: true,
        credited: outcome.credited,
        rewardNvx: outcome.rewardNvx,
        balance: outcome.balance
      });
    }
    return response(res, 200, {
      ok: true,
      credited: outcome.credited,
      purpose: VAULT_PURPOSE,
      boostCredits: outcome.boostCredits,
      capped: Boolean(outcome.capped)
    });
  } catch (error) {
    console.error('AdMob rewarded SSV v2 fulfillment error:', error);
    return response(res, 500, { ok: false, credited: false, reason: 'server_error' });
  }
});

exports.__admobSsvV2Test = Object.freeze({
  EXPECTED_AD_UNIT,
  WATCH_PURPOSE,
  VAULT_PURPOSE,
  WATCH_REWARD_NVX,
  MAX_VAULT_BOOST_CREDITS,
  decodeBase64Url,
  txDocId
});
