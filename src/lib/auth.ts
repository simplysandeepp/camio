/**
 * Camio authentication.
 *
 * - Passwords are hashed with scrypt (Node's built-in crypto — no native deps).
 *   Format: `scrypt$<saltHex>$<hashHex>`. Verified with a timing-safe compare.
 * - Sessions are signed JWTs (HS256 via `jose`, which works in both the Node
 *   route handlers and the Edge middleware).
 *
 * Password hashing/verification uses `node:crypto` and therefore only runs in
 * Node runtime (the login route). The middleware only *verifies* the JWT, which
 * is Edge-safe.
 */

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "camio_session";

function sessionTtlSeconds(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? "168"); // 7 days
  return Math.max(1, hours) * 3600;
}

/** Whether the session cookie should be marked Secure (HTTPS only). */
export function cookieSecure(): boolean {
  // Over plain-http Tailscale/LAN, Secure cookies won't be sent. Default off;
  // set SESSION_COOKIE_SECURE=true when serving behind HTTPS / a TLS proxy.
  return (process.env.SESSION_COOKIE_SECURE ?? "false").toLowerCase() === "true";
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Run `npm run auth:setup` to generate credentials."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string; // username
}

export async function createSessionToken(username: string): Promise<string> {
  const ttl = sessionTtlSeconds();
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export function sessionMaxAge(): number {
  return sessionTtlSeconds();
}
