/**
 * Generates Camio login credentials for your `.env.local`.
 *
 *   npm run auth:setup                 # prompts for a password (hidden)
 *   npm run auth:setup -- 'MyP@ss'     # or pass it as an argument
 *
 * Prints a bcrypt-free scrypt hash + a fresh SESSION_SECRET to paste in.
 */

import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

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

async function main() {
  let pw = process.argv[2];
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

main();
