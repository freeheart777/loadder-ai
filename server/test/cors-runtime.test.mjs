import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const allowedOrigin = "http://localhost:5173";

async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(2_000) });
}

test("canonical server CORS delegate always completes and preserves route policy", async () => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-cors-runtime-"));
  const databasePath = join(directory, "runtime.sqlite");
  copyFileSync(new URL("../db/loadder.sqlite", import.meta.url), databasePath);
  const port = 3298;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      API_HOST: "127.0.0.1",
      API_PORT: String(port),
      DATABASE_PATH: databasePath,
      NODE_ENV: "test",
      CLIENT_ORIGINS: allowedOrigin,
      LOADDER_SEED_DEMO_DATA: "false",
      AUTH_EXPOSE_DEV_OTP: "true",
      AUTH_HASH_SECRET: "cors-runtime-test-secret",
    },
    stdio: "ignore",
  });

  try {
    let health;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        health = await request(`${baseUrl}/api/health`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    assert.ok(health, "canonical server did not complete an Origin-less request");
    assert.equal(health.status, 200);

    const auth = await request(`${baseUrl}/api/auth/status`, { headers: { Origin: allowedOrigin } });
    assert.equal(auth.status, 200);
    assert.equal(auth.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(auth.headers.get("access-control-allow-credentials"), "true");

    const disallowed = await request(`${baseUrl}/api/health`, { headers: { Origin: "https://foreign.example" } });
    assert.ok(disallowed.status >= 400, "disallowed Origin must fail explicitly");
    assert.equal(disallowed.headers.get("access-control-allow-origin"), null);

    const publicForm = await request(`${baseUrl}/api/public/forms/not-a-form`, { headers: { Origin: "https://publisher.example" } });
    assert.equal(publicForm.status, 404);
    assert.equal(publicForm.headers.get("access-control-allow-origin"), "https://publisher.example");
    assert.equal(publicForm.headers.get("access-control-allow-credentials"), null);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
