import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

// Express 5 passes listen errors (EADDRINUSE) to the app.listen callback
// instead of throwing. Both entry points used to ignore it: they printed their
// "running" banner and exited 0, so `npm run dev` kept the frontend talking to
// an OLDER process that still held the port — which served pre-fix code and
// made an already-fixed Website Builder bug look unfixed.
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function occupyPort() {
  const blocker = net.createServer();
  blocker.listen(0, "127.0.0.1");
  await once(blocker, "listening");
  return blocker;
}

async function run(entry, env) {
  const databasePath = path.join(os.tmpdir(), `loadder-startup-${process.pid}-${Date.now()}.sqlite`);
  const child = spawn(process.execPath, [entry], {
    cwd: serverDir,
    env: { ...process.env, NODE_ENV: "test", AUTH_HASH_SECRET: "startup-port-conflict-test", API_HOST: "127.0.0.1", DATABASE_PATH: databasePath, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);
  const [code] = await once(child, "exit");
  clearTimeout(timer);
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });
  return { code, stdout, stderr };
}

test("the API exits non-zero and says why when its port is taken", { timeout: 90_000 }, async () => {
  const blocker = await occupyPort();
  try {
    const { code, stdout, stderr } = await run("index.mjs", { API_PORT: String(blocker.address().port) });
    assert.equal(code, 1, "a backend that cannot listen must not exit 0");
    assert.match(stderr, /Loadder API could not listen on http:\/\/127\.0\.0\.1:\d+: EADDRINUSE/);
    assert.doesNotMatch(stdout, /Loadder API \(canonical backend\)/, "no false 'running' banner");
  } finally {
    blocker.close();
  }
});

test("the public site runtime exits non-zero and says why when its port is taken", { timeout: 90_000 }, async () => {
  const blocker = await occupyPort();
  try {
    const { code, stdout, stderr } = await run("public-site-server.mjs", { PUBLIC_SITE_HOST: "127.0.0.1", PUBLIC_SITE_PORT: String(blocker.address().port) });
    assert.equal(code, 1);
    assert.match(stderr, /Loadder Public Site Runtime could not listen on http:\/\/127\.0\.0\.1:\d+: EADDRINUSE/);
    assert.doesNotMatch(stdout, /listening on/, "no false 'listening' log");
  } finally {
    blocker.close();
  }
});
