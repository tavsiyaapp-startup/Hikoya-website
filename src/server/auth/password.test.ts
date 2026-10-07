import { test, describe } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "./password.ts";

describe("hashPassword / verifyPassword", () => {
  test("a freshly hashed password verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword({ hash, password: "correct horse battery staple" }), true);
  });

  test("the wrong password is rejected", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword({ hash, password: "wrong" }), false);
  });

  test("verifies a $2a$ hash the same as a $2b$ one (Supabase uses $2a$)", async () => {
    // bcryptjs writes $2b$ by default; Supabase's own hashes are $2a$. Both are
    // the same algorithm — only the prefix differs — so build one by hand to
    // confirm verifyPassword doesn't care which prefix it sees.
    const bHash = await hashPassword("пароль с юникодом");
    const aHash = "$2a$" + bHash.slice(4);
    assert.equal(await verifyPassword({ hash: aHash, password: "пароль с юникодом" }), true);
  });

  test("two hashes of the same password differ (random salt)", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    assert.notEqual(h1, h2);
  });

  test("produces a real bcrypt hash bcryptjs itself accepts", async () => {
    const hash = await hashPassword("roundtrip");
    assert.equal(await bcrypt.compare("roundtrip", hash), true);
  });
});
