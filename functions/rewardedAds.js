const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/*
  NexusNova ayeT rewarded-video S2S fulfillment.

  Security rules:
  - Publisher API key is a Firebase Secret, never client-side/public.
  - Every callback must pass ayeT's X-Ayetstudios-Security-Hash HMAC-SHA256 check.
  - Only the configured rewarded-video AdSlot is accepted.
  - Only the exact NexusNova +2.5 NVX reward amount is accepted.
  - external_identifier must be a Firebase Auth UID-sized safe identifier.
  - transaction_id is hashed into a Firestore idempotency document so callback
    retries can never credit the same conversion twice.
  - Admin SDK performs one atomic transaction: dedupe record + user balance.
*/

const AYET_PUBLISHER_API_KEY = defineSecret('AYET_PUBLISHER_API_KEY');
const AYET_REWARDED_ADSLOT_ID = defineString('NEXUSNOVA_AYET_ADSLOT_ID', { default: '' });

const REWARD_NVX = 2.5;
const MAX_TRANSACTION_ID = 256;
const MAX_EXTERNAL_ID = 128;
const MAX_QUERY_LENGTH = 8192;

function cleanString(value, maxLength) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) return '';
  return text;
}

function exactReward(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return false;
  const number = Number(text);
  return Number.isFinite(number) && Math.abs(number - REWARD_NVX) < 1e-9;
}

function callbackSearchParams(req) {
  const original = String(req.originalUrl || req.url || '');
  if (!original || original.length > MAX_QUERY_LENGTH) throw new Error('invalid callback url');
  const url = new URL(original, 'https://nexusnova.invalid');
  return url.searchParams;
}

function sortedQueryString(params) {
  return new URLSearchParams(
    [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  ).toString();
}

function validHexHash(value) {
  return /^[a-fA-F0-9]{64}$/.test(String(value || ''));
}

function timingSafeHexEqual(a, b) {
  if (!validHexHash(a) || !validHexHash(b)) return false;
  const left = Buffer.from(String(a).toLowerCase(), 'hex');
  const right = Buffer.from(String(b).toLowerCase(), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyAyetHmac(req, apiKey) {
  const supplied = String(req.get('X-Ayetstudios-Security-Hash') || '').trim();
  if (!validHexHash(supplied) || !apiKey) return false;
  const params = callbackSearchParams(req);
  const canonical = sortedQueryString(params);
  const computed = crypto.createHmac('sha256', apiKey).update(canonical).digest('hex');
  return timingSafeHexEqual(supplied, computed);
}

function transactionDocId(transactionId) {
  return crypto.createHash('sha256').update(transactionId).digest('hex');
}

function response200(res, body) {
  // ayeT retries non-200 callbacks. Returning 200 for rejected/duplicate requests
  // prevents retry storms while the body still records the non-credit outcome.
  return res.status(200).json(body);
}

exports.ayetRewardedVideoCallback = onRequest(
  { secrets: [AYET_PUBLISHER_API_KEY] },
  async (req, res) => {
    if (req.method !== 'GET') {
      return response200(res, { ok: false, credited: false, reason: 'method_not_allowed' });
    }

    try {
      const apiKey = AYET_PUBLISHER_API_KEY.value();
      if (!verifyAyetHmac(req, apiKey)) {
        console.warn('ayeT rewarded callback rejected: invalid security hash');
        return response200(res, { ok: false, credited: false, reason: 'invalid_signature' });
      }

      const params = callbackSearchParams(req);
      const transactionId = cleanString(params.get('transaction_id'), MAX_TRANSACTION_ID);
      const uid = cleanString(params.get('external_identifier'), MAX_EXTERNAL_ID);
      const adslotId = cleanString(params.get('adslot_id'), 32);
      const amount = String(params.get('currency_amount') || '').trim();
      const expectedAdslot = String(AYET_REWARDED_ADSLOT_ID.value() || '').trim();

      if (!transactionId) {
        return response200(res, { ok: false, credited: false, reason: 'missing_transaction_id' });
      }
      if (!uid || !/^[A-Za-z0-9:_-]{3,128}$/.test(uid)) {
        return response200(res, { ok: false, credited: false, reason: 'invalid_external_identifier' });
      }
      if (!expectedAdslot) {
        console.error('ayeT rewarded callback is not configured: NEXUSNOVA_AYET_ADSLOT_ID is empty');
        return response200(res, { ok: false, credited: false, reason: 'adslot_not_configured' });
      }
      if (adslotId !== expectedAdslot) {
        return response200(res, { ok: false, credited: false, reason: 'wrong_adslot' });
      }
      if (!exactReward(amount)) {
        return response200(res, { ok: false, credited: false, reason: 'unexpected_reward_amount' });
      }

      const db = getFirestore();
      const rewardId = transactionDocId(transactionId);
      const rewardRef = db.collection('rewardedAdTransactions').doc(rewardId);
      const userRef = db.collection('users').doc(uid);

      const outcome = await db.runTransaction(async tx => {
        const [rewardSnap, userSnap] = await Promise.all([
          tx.get(rewardRef),
          tx.get(userRef)
        ]);

        if (rewardSnap.exists) {
          return { credited: false, duplicate: true };
        }
        if (!userSnap.exists) {
          return { credited: false, missingUser: true };
        }

        const user = userSnap.data() || {};
        const balance = Number(user.balance);
        if (!Number.isFinite(balance) || balance < 0 || balance > Number.MAX_SAFE_INTEGER - REWARD_NVX) {
          throw new Error('invalid user balance');
        }

        const nextBalance = balance + REWARD_NVX;
        // rewardRef was read as absent above. If another callback writes it
        // concurrently, Firestore retries this transaction and the duplicate
        // branch wins before a second balance credit can occur.
        tx.set(rewardRef, {
          provider: 'ayet',
          transactionId,
          uid,
          adslotId,
          rewardNvx: REWARD_NVX,
          payoutUsd: String(params.get('payout_usd') || '').slice(0, 64),
          placementIdentifier: String(params.get('placement_identifier') || '').slice(0, 128),
          createdAt: FieldValue.serverTimestamp()
        });
        tx.update(userRef, {
          balance: nextBalance,
          rewardedAdCount: FieldValue.increment(1),
          rewardedAdTotalNvx: FieldValue.increment(REWARD_NVX),
          lastRewardedAdAt: FieldValue.serverTimestamp()
        });
        return { credited: true, balance: nextBalance };
      });

      if (outcome.duplicate) {
        return response200(res, { ok: true, credited: false, duplicate: true });
      }
      if (outcome.missingUser) {
        console.warn(`ayeT rewarded callback user not found: ${uid}`);
        return response200(res, { ok: false, credited: false, reason: 'user_not_found' });
      }

      return response200(res, {
        ok: true,
        credited: true,
        rewardNvx: REWARD_NVX,
        balance: outcome.balance
      });
    } catch (error) {
      console.error('ayeT rewarded callback error:', error);
      return response200(res, { ok: false, credited: false, reason: 'server_error' });
    }
  }
);

// Pure helpers are exported only for local/CI regression tests. They do not
// expose secrets and do not mutate Firestore.
exports.__rewardedAdsTest = Object.freeze({
  REWARD_NVX,
  sortedQueryString,
  exactReward,
  timingSafeHexEqual,
  transactionDocId
});
