/**
 * Generates Camio login credentials.
 *
 *   npm run auth:setup                            # single-user: prompts for a
 *                                                  # password, prints hash + secret
 *   npm run auth:setup -- 'MyP@ss'                 # or pass the password directly
 *   npm run auth:setup -- --user alice --add-to users.json
 *                                                  # multi-user: append/update an
 *                                                  # entry in a CAMIO_USERS_FILE
 *
 * Prints a scrypt hash (and, for single-user, a fresh SESSION_SECRET) to paste
 * into .env.local, or writes/updates a users JSON file for CAMIO_USERS_FILE.
 */

import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  // `:` separator (not `$`) — see src/lib/password.ts for why (dotenv-expand).
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const stdout = process.stdout;
    // Mask input.
    const onData = () => {
      // Move cursor back and clear typed chars visually.
      rl.line && stdout.write(`\r${question}${"*".repeat(rl.line.length)} `);
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener("data", onData);
      stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--user") args.user = argv[++i];
    else if (a === "--add-to") args.addTo = argv[++i];
    else args._.push(a);
  }
  return args;
}

async function multiUserMode(args) {
  const username = args.user ?? (await askHidden("Username: ")).trim();
  if (!username) {
    console.error("✖ Username is required (--user <name>).");
    process.exit(1);
  }
  let pw = args._[0];
  if (!pw) pw = (await askHidden(`Password for ${username}: `)).trim();
  if (!pw || pw.length < 6) {
    console.error("✖ Password must be at least 6 characters.");
    process.exit(1);
  }

  const hash = hashPassword(pw);
  let users = [];
  if (existsSync(args.addTo)) {
    try {
      users = JSON.parse(readFileSync(args.addTo, "utf8"));
      if (!Array.isArray(users)) throw new Error("not an array");
    } catch (err) {
      console.error(`✖ ${args.addTo} exists but isn't a valid JSON array: ${err.message}`);
      process.exit(1);
    }
  }

  const i = users.findIndex((u) => u.username?.toLowerCase() === username.toLowerCase());
  if (i >= 0) users[i] = { ...users[i], username, hash };
  else users.push({ username, hash });

  writeFileSync(args.addTo, `${JSON.stringify(users, null, 2)}\n`);
  console.log(`\n✔ ${i >= 0 ? "Updated" : "Added"} "${username}" in ${args.addTo} (${users.length} user${users.length === 1 ? "" : "s"} total).`);
  console.log(`  Set CAMIO_USERS_FILE=${args.addTo} in your .env.local to use it.\n`);
}

async function singleUserMode(args) {
  let pw = args._[0];
  if (!pw) pw = (await askHidden("New Camio password: ")).trim();
  if (!pw || pw.length < 6) {
    console.error("✖ Password must be at least 6 characters.");
    process.exit(1);
  }

  const hash = hashPassword(pw);
  const secret = randomBytes(48).toString("base64url");

  console.log("\n# ── Paste these into your .env.local ──────────────────────────");
  console.log(`CAMIO_PASSWORD_HASH=${hash}`);
  console.log(`SESSION_SECRET=${secret}`);
  console.log("# (CAMIO_USER stays whatever username you want, default: admin)");
  console.log("# ──────────────────────────────────────────────────────────────\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.addTo) await multiUserMode(args);
  else await singleUserMode(args);
}

main();
