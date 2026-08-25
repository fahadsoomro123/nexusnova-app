"use strict";

const crypto = require("node:crypto");

const DEFAULT_MAX_AGE_SECONDS = 10 * 60;
const MAX_INIT_DATA_LENGTH = 8192;
const MAX_CLOCK_SKEW_SECONDS = 30;

class TelegramInitDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TelegramInitDataError";
    this.code = code;
  }
}

function invalid(code, message) {
  throw new TelegramInitDataError(code, message);
}

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function cleanPhotoUrl(value) {
  const text = cleanText(value, 2048);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeTelegramUser(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    invalid("invalid-user", "Telegram user data is missing.");
  }

  const id = String(raw.id ?? "").trim();
  if (!/^\d{1,20}$/.test(id)) {
    invalid("invalid-user-id", "Telegram user id is invalid.");
  }

  const firstName = cleanText(raw.first_name, 80);
  if (!firstName) {
    invalid("invalid-user-name", "Telegram first name is missing.");
  }

  return Object.freeze({
    id,
    username: cleanText(raw.username, 64),
    firstName,
    lastName: cleanText(raw.last_name, 80),
    photoUrl: cleanPhotoUrl(raw.photo_url),
    languageCode: cleanText(raw.language_code, 16),
    isPremium: raw.is_premium === true,
    allowsWriteToPm: raw.allows_write_to_pm === true
  });
}

function verifyTelegramInitData(initData, botToken, options = {}) {
  const payload = String(initData ?? "");
  const token = String(botToken ?? "").trim();
  const maxAgeSeconds = Number.isFinite(options.maxAgeSeconds)
    ? Math.max(1, Math.floor(options.maxAgeSeconds))
    : DEFAULT_MAX_AGE_SECONDS;
  const nowMs = Number.isFinite(options.now) ? Number(options.now) : Date.now();

  if (!payload || payload.length > MAX_INIT_DATA_LENGTH) {
    invalid("invalid-init-data", "Telegram init data is missing or too large.");
  }
  if (!token) invalid("missing-bot-token", "Telegram verification is not configured.");

  const params = new URLSearchParams(payload);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) {
    invalid("duplicate-field", "Telegram init data contains duplicate fields.");
  }

  const hash = params.get("hash") || "";
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    invalid("invalid-hash", "Telegram signature is missing or invalid.");
  }
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest();
  const supplied = Buffer.from(hash, "hex");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    invalid("signature-mismatch", "Telegram signature verification failed.");
  }

  const authDateText = params.get("auth_date") || "";
  if (!/^\d{1,12}$/.test(authDateText)) {
    invalid("invalid-auth-date", "Telegram auth date is invalid.");
  }
  const authDate = Number(authDateText);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (authDate > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
    invalid("future-auth-date", "Telegram auth date is in the future.");
  }
  if (nowSeconds - authDate > maxAgeSeconds) {
    invalid("expired", "Telegram init data has expired.");
  }

  let rawUser;
  try {
    rawUser = JSON.parse(params.get("user") || "");
  } catch {
    invalid("invalid-user-json", "Telegram user data is invalid.");
  }

  return Object.freeze({
    authDate,
    queryId: cleanText(params.get("query_id"), 128),
    user: normalizeTelegramUser(rawUser)
  });
}

module.exports = {
  DEFAULT_MAX_AGE_SECONDS,
  TelegramInitDataError,
  normalizeTelegramUser,
  verifyTelegramInitData
};
