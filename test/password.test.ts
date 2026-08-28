import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";

test("hash/verify round-trips", () => {
  const h = hashPassword("s3cret-pass");
  assert.ok(h.startsWith("scrypt:"));
  assert.equal(h.split(":").length, 3);
  assert.ok(verifyPassword("s3cret-pass", h));
});

test("wrong password fails", () => {
  const h = hashPassword("correct");
  assert.equal(verifyPassword("incorrect", h), false);
});

test("malformed stored hashes are rejected, not thrown", () => {
  assert.equal(verifyPassword("x", undefined), false);
  assert.equal(verifyPassword("x", ""), false);
  assert.equal(verifyPassword("x", "bcrypt:aa:bb"), false);
  assert.equal(verifyPassword("x", "scrypt:only-two"), false);
  assert.equal(verifyPassword("x", "scrypt:zz:zz"), false);
});
