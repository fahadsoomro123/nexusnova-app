const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

if (!getApps().length) initializeApp();

const MAX_TOKEN_LENGTH = 4096;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_TOKENS_PER_TEST = 20;
const MAX_TOKENS_PER_USER = 20;
const TEST_COOLDOWN_MS = 30 * 1000;

const protectedCallable = (handler) => onCall({ enforceAppCheck: true }, handler);

function uidOf(req) {
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  return req.auth.uid;
}

function verifiedUidOf(req) {
  const uid = uidOf(req);
  if (req.auth.token?.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verify your email before enabling push notifications.");
  }
  return uid;
}

function cleanToken(value) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Invalid push token.");
  }
  const token = value.trim();
  if (!token || token.length > MAX_TOKEN_LENGTH || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new HttpsError("invalid-argument", "Invalid push token.");
  }
  return token;
}

function cleanUserAgent(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_USER_AGENT_LENGTH);
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenRef(db, uid, token) {
  return db.collection("users").doc(uid).collection("pushTokens").doc(tokenHash(token));
}

exports.registerPushToken = protectedCallable(async (req) => {
  const uid = verifiedUidOf(req);
  const token = cleanToken(req.data?.token);
  const userAgent = cleanUserAgent(req.data?.userAgent);
  const db = getFirestore();
  const ref = tokenRef(db, uid, token);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    const existing = await db
      .collection("users")
      .doc(uid)
      .collection("pushTokens")
      .limit(MAX_TOKENS_PER_USER)
      .get();
    if (existing.size >= MAX_TOKENS_PER_USER) {
      throw new HttpsError(
        "resource-exhausted",
        "This account already has the maximum number of push-enabled devices."
      );
    }
  }

  const data = {
    uid,
    token,
    platform: "web",
    userAgent,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!snapshot.exists) data.createdAt = FieldValue.serverTimestamp();

  await ref.set(data, { merge: true });
  return { registered: true, tokenId: ref.id };
});

exports.removePushToken = protectedCallable(async (req) => {
  const uid = verifiedUidOf(req);
  const token = cleanToken(req.data?.token);
  const db = getFirestore();
  await tokenRef(db, uid, token).delete();
  return { removed: true };
});

exports.sendPushTest = protectedCallable(async (req) => {
  const uid = verifiedUidOf(req);
  const db = getFirestore();
  const now = Date.now();
  const throttle = db.collection("pushTestRateLimits").doc(uid);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(throttle);
    const lastSentAt = Number(snapshot.data()?.lastSentAt || 0);
    if (lastSentAt > 0 && now - lastSentAt < TEST_COOLDOWN_MS) {
      throw new HttpsError("resource-exhausted", "Please wait before sending another push test.");
    }
    tx.set(throttle, {
      lastSentAt: now,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("pushTokens")
    .limit(MAX_TOKENS_PER_TEST)
    .get();

  const records = snapshot.docs
    .map((doc) => ({ ref: doc.ref, token: String(doc.data()?.token || "").trim() }))
    .filter((item) => item.token);

  if (!records.length) {
    throw new HttpsError("failed-precondition", "No registered push-enabled device was found for this account.");
  }

  const result = await getMessaging().sendEachForMulticast({
    tokens: records.map((item) => item.token),
    data: {
      nexusnova: "1",
      title: "NexusNova",
      body: "Push notifications are working.",
      url: "./page2.html"
    }
  });

  const invalidCodes = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token"
  ]);
  const stale = [];
  result.responses.forEach((response, index) => {
    if (!response.success && invalidCodes.has(response.error?.code)) {
      stale.push(records[index].ref.delete());
    }
  });
  if (stale.length) await Promise.allSettled(stale);

  return {
    sent: result.successCount,
    failed: result.failureCount,
    pruned: stale.length
  };
});

// Keep the provider callback in a separate module while exporting it through
// the same bundle already re-exported by functions/index.js.
Object.assign(exports, require("./rewardedAds"));
