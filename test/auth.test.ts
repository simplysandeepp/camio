import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionMaxAge } from "../src/lib/auth.ts";

test("sessionMaxAge falls back to 7 days if SESSION_TTL_HOURS is invalid", () => {
  const prev = process.env.SESSION_TTL_HOURS;
  try {
    process.env.SESSION_TTL_HOURS = "invalid-number";
    assert.equal(sessionMaxAge(), 168 * 3600);
    
    process.env.SESSION_TTL_HOURS = "24";
    assert.equal(sessionMaxAge(), 24 * 3600);
  } finally {
    // biome-ignore lint/performance/noDelete: env vars need true deletion
    if (prev === undefined) delete process.env.SESSION_TTL_HOURS;
    else process.env.SESSION_TTL_HOURS = prev;
  }
});
