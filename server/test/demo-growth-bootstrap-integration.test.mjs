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

    assert.match(firstOutput, /Dashboard: http:\/\/localhost:5173\/dashboard/, "must print the Dashboard URL");
    assert.match(firstOutput, /Experiment: http:\/\/localhost:5173\/dashboard\/growth-loop\//, "must print the exact Growth Loop URL");
    assert.match(firstOutput, /EXPERIMENT_WINDOW_CLOSED_NO_DECISION, CONTENT_CANDIDATE_STUCK/, "must report the prepared Mission Control signals");
    assert.equal(first.workspaceId, second.workspaceId, "the same bounded demo workspace must be reused");
    assert.equal(first.experimentId, second.experimentId, "the same canonical experiment must be reused across runs");
    assert.equal(first.leadId, second.leadId, "the same demo lead must be reused, not duplicated");
    assert.equal(first.attentionCandidateId, second.attentionCandidateId, "the same reconciliation candidate must be reused, not regenerated");
    assert.equal(second.url, `http://localhost:5173/dashboard/growth-loop/${second.experimentId}`);
    assert.equal(second.dashboardUrl, "http://localhost:5173/dashboard");

    const verified = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: second.mobile, code: second.developmentOtp }),
    });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get("set-cookie")?.split(";")[0];
    const missionResponse = await fetch(`${API_BASE_URL}/api/mission-control`, { headers: { cookie } });
    assert.equal(missionResponse.status, 200);
    const mission = (await missionResponse.json()).missionControl;
    assert.deepEqual(
      mission.items.map((item) => item.signalId),
      ["EXPERIMENT_WINDOW_CLOSED_NO_DECISION", "CONTENT_CANDIDATE_STUCK"],
      "the real Mission Control endpoint must expose the exact seeded attention signals"
    );
    assert.deepEqual(mission.banners, [], "the current seeded context must not be presented as stale");
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
