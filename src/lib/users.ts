/**
 * Camio user store.
 *
 * Resolves the configured login accounts from (in priority order):
 *   1. `CAMIO_USERS`      — inline JSON array [{ username, hash, role? }]
 *   2. `CAMIO_USERS_FILE` — path to a JSON file with the same shape
 *   3. Single-user fallback — `CAMIO_USER` + `CAMIO_PASSWORD_HASH`
 *
 * The fallback means every existing single-user `.env.local` keeps working
 * unchanged; multi-user is purely additive.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export interface CamioUser {
  username: string;
  hash: string;
  role?: string;
}

function singleUserFallback(): CamioUser[] {
  const username = process.env.CAMIO_USER ?? "admin";
  const hash = process.env.CAMIO_PASSWORD_HASH;
  if (!hash) return [];
  return [{ username, hash }];
}

function parseUsers(raw: string, source: string): CamioUser[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`[camio] ${source} is not valid JSON; ignoring it.`);
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error(`[camio] ${source} must be a JSON array; ignoring it.`);
    return [];
  }
  return parsed
    .map((u: Record<string, unknown>) => ({
      username: String(u.username ?? ""),
      hash: String(u.hash ?? ""),
      role: u.role ? String(u.role) : undefined,
    }))
    .filter((u) => u.username && u.hash);
}

let cached: CamioUser[] | null = null;

/** Resolve the configured user list (cached after the first read). */
export function getUsers(): CamioUser[] {
  if (cached) return cached;

  const inline = process.env.CAMIO_USERS;
  if (inline) {
    cached = parseUsers(inline, "CAMIO_USERS");
    return cached;
  }

  const filePath = process.env.CAMIO_USERS_FILE;
  if (filePath) {
    try {
      const raw = readFileSync(path.resolve(process.cwd(), filePath), "utf8");
      cached = parseUsers(raw, "CAMIO_USERS_FILE");
      return cached;
    } catch (err) {
      console.error(
        `[camio] could not read CAMIO_USERS_FILE (${filePath}):`,
        (err as Error).message
      );
    }
  }

  cached = singleUserFallback();
  return cached;
}

/** Case-insensitive username lookup. */
export function findUser(username: string): CamioUser | undefined {
  const needle = username.toLowerCase();
  return getUsers().find((u) => u.username.toLowerCase() === needle);
}

/** Test-only: clear the cache so tests can re-resolve after changing env. */
export function _resetUsersCacheForTests(): void {
  cached = null;
}
