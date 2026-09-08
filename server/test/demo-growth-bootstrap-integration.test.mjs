import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const API_PORT = 3913;
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;

function waitForHealth(url, deadline = Date.now() + 15000) {
  return new Promise((resolve, reject) => {
    (async function poll() {
      try {
        const response = await fetch(`${url}/api/health`);
        if (response.ok) return resolve();
      } catch {
        // server not up yet
      }
      if (Date.now() > deadline) return reject(new Error(`Server at ${url} did not become healthy in time`));
      setTimeout(poll, 200);
    })();
  });
}

function startServer(extraEnv) {
  const child = spawn(process.execPath, [join(serverRoot, "index.mjs")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_HOST: "127.0.0.1",
      API_PORT: String(API_PORT),
      NODE_ENV: "development",
      CLIENT_ORIGINS: "http://localhost:5173",
      ...extraEnv,
    },
    stdio: "pipe",
  });
  return child;
}

test("real end-to-end: dev OTP disabled fails clearly; dev OTP enabled succeeds and reruns idempotently", async () => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-demo-growth-"));
  const databasePath = join(directory, "test.sqlite");
  after(() => rmSync(directory, { recursive: true, force: true }));

  // --- Phase 1: server up WITHOUT AUTH_EXPOSE_DEV_OTP must refuse the bootstrap ---
  let server = startServer({ DATABASE_PATH: databasePath, AUTH_EXPOSE_DEV_OTP: "false" });
  try {
    await waitForHealth(API_BASE_URL);
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [join(serverRoot, "scripts", "demo-growth-bootstrap.mjs")],
        {
          cwd: repoRoot,
          env: { ...process.env, NODE_ENV: "development", DATABASE_PATH: databasePath, GROWTH_DEMO_API_BASE_URL: API_BASE_URL },
          encoding: "utf8",
          stdio: "pipe",
        }
      )
    , /developmentOtpExposed/, "must refuse and explain why when dev OTP is not exposed");
  } finally {
    server.kill();
  }

  // --- Phase 2: server up WITH AUTH_EXPOSE_DEV_OTP=true, run the real CLI twice ---
  server = startServer({ DATABASE_PATH: databasePath, AUTH_EXPOSE_DEV_OTP: "true" });
  try {
    await waitForHealth(API_BASE_URL);

    const run = () =>
      execFileSync(process.execPath, [join(serverRoot, "scripts", "demo-growth-bootstrap.mjs")], {
        cwd: repoRoot,
        // The script's own `db` handle must point at the SAME database file
        // the server process is using (DATABASE_PATH), since it writes the
        // seeded fixture rows directly, not through the HTTP API.
        env: { ...process.env, NODE_ENV: "development", DATABASE_PATH: databasePath, GROWTH_DEMO_API_BASE_URL: API_BASE_URL },
        encoding: "utf8",
      });

    const firstOutput = run();
    const secondOutput = run();

    const parse = (output) => JSON.parse(output.split("\n").find((line) => line.startsWith("RESULT_JSON: ")).slice("RESULT_JSON: ".length));
    const first = parse(firstOutput);
    const second = parse(secondOutput);

    assert.match(firstOutput, /URL: http:\/\/localhost:5173\/dashboard\/growth-loop\//, "must print the exact Growth Loop URL");
    assert.equal(first.workspaceId, second.workspaceId, "the same bounded demo workspace must be reused");
    assert.equal(first.experimentId, second.experimentId, "the same canonical experiment must be reused across runs");
    assert.equal(first.leadId, second.leadId, "the same demo lead must be reused, not duplicated");
    assert.equal(second.url, `http://localhost:5173/dashboard/growth-loop/${second.experimentId}`);
  } finally {
    server.kill();
  }
});

test("real end-to-end: NODE_ENV=production refuses to run against a live server", async () => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-demo-growth-prod-"));
  const databasePath = join(directory, "test.sqlite");
  after(() => rmSync(directory, { recursive: true, force: true }));

  assert.throws(
    () =>
      execFileSync(process.execPath, [join(serverRoot, "scripts", "demo-growth-bootstrap.mjs")], {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_PATH: databasePath,
          GROWTH_DEMO_API_BASE_URL: API_BASE_URL,
        },
        encoding: "utf8",
        stdio: "pipe",
      }),
    /production/i
  );
});
