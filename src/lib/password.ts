/**
 * Password hashing with scrypt (Node built-in crypto — no native dependency).
 *
 * NODE RUNTIME ONLY. Imported by the login route, never by the Edge middleware,
 * so `node:crypto` never ends up in an Edge bundle.
 *
 * Stored format: `scrypt:<saltHex>:<hashHex>`
 *
 * NOTE: `:` (not `$`) is the separator on purpose — Next.js runs .env values
 * through dotenv-expand, which would interpret `$...` as variable interpolation
 * and corrupt the hash. Hex fields never contain `:`, so this is unambiguous.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length !== KEYLEN) return false;

  const actual = scryptSync(plain, salt, KEYLEN);
  // timingSafeEqual requires equal lengths (guaranteed above).
  return timingSafeEqual(actual, expected);
}
