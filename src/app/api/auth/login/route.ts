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

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const rate = checkLoginRate(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rate.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = String(body.username ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const expectedUser = process.env.CAMIO_USER ?? "admin";
  const storedHash = process.env.CAMIO_PASSWORD_HASH;

  if (!storedHash) {
    return NextResponse.json(
      { error: "Server not configured. Run `npm run auth:setup`." },
      { status: 500 }
    );
  }

  const userOk = username === expectedUser;
  const passOk = verifyPassword(password, storedHash);
  if (!userOk || !passOk) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  resetLoginRate(ip);
  const token = await createSessionToken(expectedUser);

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
