import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { verifyTelegramLogin } from "./telegram-verify.ts";

const TOKEN = "123456:TEST-token";
const NOW = 1_800_000_000;

function sign(fields: Record<string, string | number>, token = TOKEN) {
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  return { ...fields, hash: createHmac("sha256", secret).update(check).digest("hex") };
}

describe("verifyTelegramLogin", () => {
  test("accepts data signed with the bot token", () => {
    const data = sign({ id: 42, first_name: "Ali", username: "ali_k", auth_date: NOW - 60 });
    const result = verifyTelegramLogin(data, TOKEN, NOW);
    assert.equal(result?.id, 42);
    assert.equal(result?.username, "ali_k");
  });

  test("rejects a changed field", () => {
    const data = { ...sign({ id: 42, first_name: "Ali", auth_date: NOW }), id: 43 };
    assert.equal(verifyTelegramLogin(data, TOKEN, NOW), null);
  });

  test("rejects data signed with another bot's token", () => {
    const data = sign({ id: 42, auth_date: NOW }, "999:other");
    assert.equal(verifyTelegramLogin(data, TOKEN, NOW), null);
  });

  test("rejects a confirmation older than a day", () => {
    const data = sign({ id: 42, auth_date: NOW - 25 * 60 * 60 });
    assert.equal(verifyTelegramLogin(data, TOKEN, NOW), null);
  });

  test("rejects a missing or malformed hash and an empty token", () => {
    assert.equal(verifyTelegramLogin({ id: 42, auth_date: NOW }, TOKEN, NOW), null);
    assert.equal(verifyTelegramLogin({ id: 42, auth_date: NOW, hash: "zz" }, TOKEN, NOW), null);
    assert.equal(verifyTelegramLogin(sign({ id: 42, auth_date: NOW }), "", NOW), null);
  });

  test("an extra unknown field doesn't change what is checked", () => {
    const data = { ...sign({ id: 42, auth_date: NOW }), injected: "x" };
    assert.equal(verifyTelegramLogin(data, TOKEN, NOW)?.id, 42);
  });
});
