#!/usr/bin/env node
// Dev entrypoint for the Docker dev container (wired in via
// docker-compose.override.yml `command`). Keeps the generated Prisma client in
// sync with `prisma/schema.prisma` WITHOUT a manual restart:
//
//   1. runs `prisma generate` once on boot,
//   2. spawns `next dev` (the actual dev server) as its own process group,
//   3. polls the schema's mtime; when it changes, regenerates the client and
//      restarts `next dev` so the new client loads into a fresh process.
//
// Polling (not fs.watch / inotify) because Docker Desktop + WSL2 bind-mounts
// don't reliably deliver host file-change events to inotify inside the
// container. Polling one file every 1.5s is negligible. Zero dependencies.
//
// The DB migration is NOT auto-applied — run `npx prisma migrate dev` on the
// host as usual; this script only regenerates the client + reloads the server.

import { spawn } from "node:child_process";
import { statSync } from "node:fs";

const SCHEMA = "prisma/schema.prisma";
const POLL_MS = 1500;
const PORT_RELEASE_WAIT_MS = 1800;

let child = null;
let bouncing = false;
let lastMtime = 0;

function generate() {
  return new Promise((resolve) => {
    const p = spawn("npx", ["prisma", "generate"], { stdio: "inherit" });
    p.on("exit", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
}

function startDev() {
  // detached: true → child leads its own process group, so killing -child.pid
  // takes down `npm` AND the `next` process it spawns together.
  child = spawn("npm", ["run", "dev", "--", "-H", "0.0.0.0"], {
    stdio: "inherit",
    detached: true,
  });
  child.on("exit", (code) => {
    // Dev server exited on its own (not because we're bouncing) → follow it.
    if (!bouncing) process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    console.error("[dev-watch] failed to start next dev:", err);
    process.exit(1);
  });
}

function killGroup() {
  if (child && child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* group already gone */
    }
  }
}

async function bounce(reason) {
  if (bouncing) return;
  bouncing = true;
  console.log(`\n[dev-watch] ${reason} — regenerating Prisma client…`);
  const ok = await generate();
  if (!ok) {
    // Schema is likely mid-edit (invalid). Keep the current server running on
    // the old client; we'll retry on the next successful save.
    console.error(
      "[dev-watch] prisma generate failed (schema invalid?) — keeping the current server; will retry on next change.\n",
    );
    bouncing = false;
    return;
  }
  console.log("[dev-watch] restarting next dev…\n");
  killGroup();
  child = null;
  await new Promise((r) => setTimeout(r, PORT_RELEASE_WAIT_MS));
  startDev();
  bouncing = false;
}

function schemaMtime() {
  try {
    return statSync(SCHEMA).mtimeMs;
  } catch {
    return 0;
  }
}

async function main() {
  console.log("[dev-watch] generating Prisma client…");
  await generate();
  lastMtime = schemaMtime();
  startDev();
  setInterval(() => {
    const m = schemaMtime();
    if (m && m !== lastMtime) {
      lastMtime = m;
      void bounce("schema.prisma changed");
    }
  }, POLL_MS);
}

// Forward shutdown signals to the dev-server group, then exit.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    killGroup();
    setTimeout(() => process.exit(0), 200);
  });
}

main();
