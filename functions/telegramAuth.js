"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { verifyTelegramInitData, TelegramInitDataError } = require("./telegram-init-data");
const { planTelegramLink, TelegramLinkConflictError } = require("./telegram-link-policy");

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const MAX_RECENT_AUTH_SECONDS = 15 * 60;

const app = getApps()[0] || initializeApp();
const adminAuth = getAuth(app);
const db = getFirestore(app);

function verifyRequest(req) {
  try {
    return verifyTelegramInitData(req.data?.initData, TELEGRAM_BOT_TOKEN.value());
  } catch (error) {
    if (error instanceof TelegramInitDataError) {
      if (error.code === "missing-bot-token") {
        throw new HttpsError("failed-precondition", "Telegram account linking is not configured yet.");
      }
      throw new HttpsError("permission-denied", "Telegram session could not be verified.");
    }
    throw error;
  }
}

function requireRecentFirebaseUser(req) {
  const uid = String(req.auth?.uid || "");
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to NexusNova first.");
  const authTime = Number(req.auth?.token?.auth_time || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authTime || nowSeconds - authTime > MAX_RECENT_AUTH_SECONDS) {
    throw new HttpsError("failed-precondition", "Sign in again before linking Telegram.");
  }
  return uid;
}

function publicTelegramUser(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    languageCode: user.languageCode,
    isPremium: user.isPremium,
    allowsWriteToPm: user.allowsWriteToPm
  };
}

function identityRef(telegramId) {
  return db.collection("telegramIdentities").doc(String(telegramId));
}

function accountLinkRef(uid) {
  return db.collection("telegramUserLinks").doc(String(uid));
}

exports.telegramSession = onCall({ secrets: [TELEGRAM_BOT_TOKEN] }, async req => {
  const verified = verifyRequest(req);
  const telegram = publicTelegramUser(verified.user);
  const mapping = await identityRef(telegram.id).get();

  if (!mapping.exists) return { linked: false, user: telegram };
  const uid = String(mapping.data()?.uid || "");
  if (!uid) throw new HttpsError("failed-precondition", "Telegram account mapping needs repair.");
  const userProfileRef = db.collection("users").doc(uid);
  const [reverseMapping, userProfile] = await Promise.all([
    accountLinkRef(uid).get(),
    userProfileRef.get()
  ]);
  const reverseTelegramId = String(reverseMapping.data()?.telegramId || "");
  if (reverseTelegramId && reverseTelegramId !== telegram.id) {
    throw new HttpsError("failed-precondition", "Telegram account mapping needs repair.");
  }
  if (!userProfile.exists) {
    throw new HttpsError("failed-precondition", "Linked NexusNova profile no longer exists.");
  }

  try {
    await adminAuth.getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "Linked NexusNova account no longer exists.");
    }
    throw error;
  }

  const stamp = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(identityRef(telegram.id), { ...telegram, uid, authDate: verified.authDate, updatedAt: stamp }, { merge: true });
  batch.set(accountLinkRef(uid), { uid, telegramId: telegram.id, updatedAt: stamp }, { merge: true });
  batch.set(userProfileRef, { telegram: { ...telegram, linked: true, updatedAt: stamp } }, { merge: true });
  await batch.commit();

  const customToken = await adminAuth.createCustomToken(uid, {
    telegram: true,
    telegram_id: telegram.id
  });
  return { linked: true, customToken, user: telegram };
});

exports.linkTelegramAccount = onCall({ secrets: [TELEGRAM_BOT_TOKEN] }, async req => {
  const uid = requireRecentFirebaseUser(req);
  const verified = verifyRequest(req);
  const telegram = publicTelegramUser(verified.user);

  try {
    const result = await db.runTransaction(async tx => {
      const telegramRef = identityRef(telegram.id);
      const linkRef = accountLinkRef(uid);
      const profileRef = db.collection("users").doc(uid);
      const [identitySnapshot, linkSnapshot, profileSnapshot] = await Promise.all([
        tx.get(telegramRef),
        tx.get(linkRef),
        tx.get(profileRef)
      ]);

      if (!profileSnapshot.exists) {
        throw new HttpsError("not-found", "NexusNova profile not found.");
      }

      const policy = planTelegramLink({
        identityUid: identitySnapshot.data()?.uid,
        accountTelegramId: linkSnapshot.data()?.telegramId,
        requestedUid: uid,
        requestedTelegramId: telegram.id
      });
      const stamp = FieldValue.serverTimestamp();
      const linkedAt = identitySnapshot.data()?.linkedAt || stamp;

      tx.set(telegramRef, {
        ...telegram,
        uid,
        authDate: verified.authDate,
        linkedAt,
        updatedAt: stamp
      }, { merge: true });
      tx.set(linkRef, { uid, telegramId: telegram.id, linkedAt, updatedAt: stamp }, { merge: true });
      tx.set(profileRef, { telegram: { ...telegram, linked: true, linkedAt, updatedAt: stamp } }, { merge: true });
      return policy;
    });

    return { linked: true, idempotent: result.idempotent, user: telegram };
  } catch (error) {
    if (error instanceof TelegramLinkConflictError) {
      throw new HttpsError("already-exists", error.message);
    }
    throw error;
  }
});
