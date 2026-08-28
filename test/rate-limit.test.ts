import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLoginRate, resetLoginRate, type RateResult } from "../src/lib/rate-limit.ts";

test("allows up to the cap then blocks", () => {
  const key = "u:capuser";
  resetLoginRate(key);
  let last: RateResult | undefined;
  for (let i = 0; i < 10; i++) last = checkLoginRate(key);
  assert.equal(last?.allowed, true);
  const blocked = checkLoginRate(key);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec > 0);
});

test("reset clears the counter", () => {
  const key = "u:resetuser";
  for (let i = 0; i < 10; i++) checkLoginRate(key);
  assert.equal(checkLoginRate(key).allowed, false);
  resetLoginRate(key);
  assert.equal(checkLoginRate(key).allowed, true);
});

test("distinct keys have independent budgets", () => {
  resetLoginRate("u:a");
  resetLoginRate("u:b");
  for (let i = 0; i < 10; i++) checkLoginRate("u:a");
  assert.equal(checkLoginRate("u:a").allowed, false);
  assert.equal(checkLoginRate("u:b").allowed, true);
});
