"use strict";

const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyTelegramInitData, TelegramInitDataError } = require("../telegram-init-data");

const TOKEN = "123456:TEST_BOT_TOKEN";
const NOW_SECONDS = 1_800_000_000;

function signedInitData(overrides = {}) {
  const user = overrides.user ?? {
    id: 123456789,
    first_name: "Fahad",
    last_name: "Hussain",
    username: "fahad_test",
    photo_url: "https://t.me/i/userpic/320/example.jpg"
  };
  const values = {
    auth_date: String(overrides.authDate ?? NOW_SECONDS),
    query_id: overrides.queryId ?? "AAE-test-query",
    user: typeof user === "string" ? user : JSON.stringify(user)
  };
  const check = Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const hash = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...values, hash }).toString();
}

test("accepts a valid, fresh Telegram Mini App payload", () => {
  const verified = verifyTelegramInitData(signedInitData(), TOKEN, { now: NOW_SECONDS * 1000 });
  assert.equal(verified.user.id, "123456789");
  assert.equal(verified.user.username, "fahad_test");
  assert.equal(verified.user.firstName, "Fahad");
  assert.equal(verified.user.photoUrl, "https://t.me/i/userpic/320/example.jpg");
});

test("rejects a payload changed after signing", () => {
  const tampered = signedInitData().replace("fahad_test", "attacker");
  assert.throws(
    () => verifyTelegramInitData(tampered, TOKEN, { now: NOW_SECONDS * 1000 }),
    error => error instanceof TelegramInitDataError && error.code === "signature-mismatch"
  );
});

test("rejects stale payloads", () => {
  const stale = signedInitData({ authDate: NOW_SECONDS - 601 });
  assert.throws(
    () => verifyTelegramInitData(stale, TOKEN, { now: NOW_SECONDS * 1000, maxAgeSeconds: 600 }),
    error => error instanceof TelegramInitDataError && error.code === "expired"
  );
});

test("rejects missing or malformed Telegram users", () => {
  const malformed = signedInitData({ user: "not-json" });
  assert.throws(
    () => verifyTelegramInitData(malformed, TOKEN, { now: NOW_SECONDS * 1000 }),
    error => error instanceof TelegramInitDataError && error.code === "invalid-user-json"
  );
});
