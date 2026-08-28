import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  SESSION_COOKIE,
  cookieSecure,
  sessionMaxAge,
} from "@/lib/auth";
import { checkLoginRate, resetLoginRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only trust proxy-supplied client IPs when explicitly running behind a
// trusted reverse proxy — otherwise X-Forwarded-For is attacker-controlled.
function trustedClientIp(req: NextRequest): string | null {
  if (process.env.TRUSTED_PROXY !== "true") return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest) {
  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = String(body.username ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Rate-limit key = account (not spoofable). Add the IP only when trusted, so
  // distinct real clients get their own budget without opening a bypass.
  const ip = trustedClientIp(req);
  const rateKey = `u:${username.toLowerCase()}` + (ip ? `|ip:${ip}` : "");

  const rate = checkLoginRate(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rate.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const expectedUser = process.env.CAMIO_USER ?? "admin";
  const storedHash = process.env.CAMIO_PASSWORD_HASH;
  const sessionSecret = process.env.SESSION_SECRET;

  // Server misconfiguration: log the specifics, return a generic message so we
  // don't disclose config state to unauthenticated callers.
  if (!storedHash || !sessionSecret || sessionSecret.length < 16) {
    console.error(
      "[camio] auth not configured:",
      !storedHash ? "CAMIO_PASSWORD_HASH missing" : "SESSION_SECRET missing/short",
      "— run `npm run auth:setup`"
    );
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }

  const userOk = username === expectedUser;
  const passOk = verifyPassword(password, storedHash);
  if (!userOk || !passOk) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  let token: string;
  try {
    token = await createSessionToken(expectedUser);
  } catch (err) {
    console.error("[camio] failed to create session token:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }

  resetLoginRate(rateKey);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: sessionMaxAge(),
  });
  return res;
}
