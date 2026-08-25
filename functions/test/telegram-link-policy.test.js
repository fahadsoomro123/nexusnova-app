"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { planTelegramLink, TelegramLinkConflictError } = require("../telegram-link-policy");

test("allows a new one-to-one link", () => {
  const plan = planTelegramLink({ requestedUid: "firebase-a", requestedTelegramId: "101" });
  assert.equal(plan.idempotent, false);
  assert.equal(plan.shouldWriteIdentity, true);
  assert.equal(plan.shouldWriteAccountLink, true);
});

test("treats repeating the same link as idempotent", () => {
  const plan = planTelegramLink({
    identityUid: "firebase-a",
    accountTelegramId: "101",
    requestedUid: "firebase-a",
    requestedTelegramId: "101"
  });
  assert.equal(plan.idempotent, true);
});

test("blocks one Telegram id from linking to two Firebase users", () => {
  assert.throws(
    () => planTelegramLink({ identityUid: "firebase-a", requestedUid: "firebase-b", requestedTelegramId: "101" }),
    error => error instanceof TelegramLinkConflictError && error.code === "telegram-already-linked"
  );
});

test("blocks one Firebase user from linking to two Telegram ids", () => {
  assert.throws(
    () => planTelegramLink({ accountTelegramId: "101", requestedUid: "firebase-a", requestedTelegramId: "202" }),
    error => error instanceof TelegramLinkConflictError && error.code === "account-already-linked"
  );
});
