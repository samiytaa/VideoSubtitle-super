import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const HEALTH_URL = "http://127.0.0.1:3000/healthz";

async function isHealthyServer() {
  try {
    const res = await fetch(HEALTH_URL, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  // If a compatible server is already running on 3000, reuse it.
  if (await isHealthyServer()) {
    console.log("[dev:api] Detected running Web2API on :3000, reusing existing process.");
    // Keep this process alive for concurrently.
    while (true) {
      await delay(60_000);
    }
  }

  const child = spawn(process.execPath, ["integrated/web2api/src/server.js"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "3000" }
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  const shutdown = () => {
    if (!child.killed) child.kill("SIGTERM");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (err) => {
  console.error("[dev:api] Failed to start/reuse API server:", err?.message || err);
  console.error("[dev:api] If port 3000 is occupied by another app, stop it and retry.");
  process.exit(1);
});

