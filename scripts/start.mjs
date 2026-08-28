/**
 * Production start wrapper for the Camio web app.
 *
 * Loads .env.local, then launches `next start` bound to APP_PORT on all
 * interfaces (0.0.0.0) so a Tailscale viewer can reach it. The app is fully
 * behind login, so binding broadly is safe — auth is the gate, not obscurity.
 *
 *   npm start
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  /* no .env.local — use process env / defaults */
}

const port = process.env.APP_PORT || process.env.PORT || "3000";
const next = path.join(ROOT, "node_modules", ".bin", "next");

const child = spawn(next, ["start", "-H", "0.0.0.0", "-p", String(port)], {
  stdio: "inherit",
  cwd: ROOT,
});

const forward = (sig) => () => child.kill(sig);
process.on("SIGINT", forward("SIGINT"));
process.on("SIGTERM", forward("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 0));
