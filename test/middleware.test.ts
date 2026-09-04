import { test } from "node:test";
import assert from "node:assert/strict";
import { middleware } from "../src/middleware.ts";
import { NextRequest } from "next/server";

test("middleware redirects to login preserving query parameters", async () => {
  const req = new NextRequest("http://localhost:3000/dashboard?cam=garage&quality=high");
  const res = await middleware(req);
  
  // NextResponse redirect returns a 307
  assert.equal(res.status, 307);
  
  const location = res.headers.get("location");
  assert.ok(location);
  
  const url = new URL(location);
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("next"), "/dashboard?cam=garage&quality=high");
});
