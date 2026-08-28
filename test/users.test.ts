import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { getUsers, findUser, _resetUsersCacheForTests } from "../src/lib/users.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  _resetUsersCacheForTests();
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    _resetUsersCacheForTests();
  }
}

test("falls back to single CAMIO_USER/CAMIO_PASSWORD_HASH", () => {
  withEnv(
    { CAMIO_USERS: undefined, CAMIO_USERS_FILE: undefined, CAMIO_USER: "admin", CAMIO_PASSWORD_HASH: "scrypt:aa:bb" },
    () => {
      const users = getUsers();
      assert.equal(users.length, 1);
      assert.equal(users[0].username, "admin");
      assert.equal(findUser("ADMIN")?.hash, "scrypt:aa:bb"); // case-insensitive
      assert.equal(findUser("nobody"), undefined);
    }
  );
});

test("no users configured at all returns an empty list", () => {
  withEnv(
    { CAMIO_USERS: undefined, CAMIO_USERS_FILE: undefined, CAMIO_USER: undefined, CAMIO_PASSWORD_HASH: undefined },
    () => {
      assert.deepEqual(getUsers(), []);
    }
  );
});

test("CAMIO_USERS inline JSON takes priority", () => {
  withEnv(
    {
      CAMIO_USERS: JSON.stringify([
        { username: "alice", hash: "scrypt:11:22" },
        { username: "bob", hash: "scrypt:33:44", role: "viewer" },
      ]),
      CAMIO_USER: "admin",
      CAMIO_PASSWORD_HASH: "scrypt:aa:bb",
    },
    () => {
      const users = getUsers();
      assert.equal(users.length, 2);
      assert.equal(findUser("alice")?.hash, "scrypt:11:22");
      assert.equal(findUser("bob")?.role, "viewer");
      assert.equal(findUser("admin"), undefined); // single-user fallback not used
    }
  );
});

test("CAMIO_USERS_FILE is read from disk", () => {
  const file = ".test-users.json";
  writeFileSync(file, JSON.stringify([{ username: "carol", hash: "scrypt:55:66" }]));
  try {
    withEnv({ CAMIO_USERS: undefined, CAMIO_USERS_FILE: file }, () => {
      assert.equal(findUser("carol")?.hash, "scrypt:55:66");
    });
  } finally {
    unlinkSync(file);
  }
});

test("invalid CAMIO_USERS falls through to empty (not the single-user fallback)", () => {
  withEnv({ CAMIO_USERS: "not json", CAMIO_USER: "admin", CAMIO_PASSWORD_HASH: "scrypt:aa:bb" }, () => {
    assert.deepEqual(getUsers(), []);
  });
});
