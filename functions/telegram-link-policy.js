"use strict";

class TelegramLinkConflictError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TelegramLinkConflictError";
    this.code = code;
  }
}

function planTelegramLink({ identityUid = "", accountTelegramId = "", requestedUid, requestedTelegramId }) {
  const uid = String(requestedUid ?? "").trim();
  const telegramId = String(requestedTelegramId ?? "").trim();
  const mappedUid = String(identityUid ?? "").trim();
  const mappedTelegramId = String(accountTelegramId ?? "").trim();

  if (!uid || !telegramId) throw new TypeError("A Firebase uid and Telegram id are required.");
  if (mappedUid && mappedUid !== uid) {
    throw new TelegramLinkConflictError(
      "telegram-already-linked",
      "This Telegram account is already linked to another NexusNova account."
    );
  }
  if (mappedTelegramId && mappedTelegramId !== telegramId) {
    throw new TelegramLinkConflictError(
      "account-already-linked",
      "This NexusNova account is already linked to another Telegram account."
    );
  }

  return Object.freeze({
    idempotent: mappedUid === uid && mappedTelegramId === telegramId,
    shouldWriteIdentity: mappedUid !== uid,
    shouldWriteAccountLink: mappedTelegramId !== telegramId
  });
}

module.exports = { TelegramLinkConflictError, planTelegramLink };
