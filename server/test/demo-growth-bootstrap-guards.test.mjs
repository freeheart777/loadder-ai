import test from "node:test";
import assert from "node:assert/strict";
import { runGrowthDemoBootstrap, GrowthDemoBootstrapError } from "../scripts/demo-growth-bootstrap.mjs";

function fakeFetch(responses) {
  return async (url, init) => {
    const key = `${init?.method || "GET"} ${url}`;
    const entry = responses[key];
    if (!entry) throw new Error(`Unexpected fetch in test: ${key}`);
    return { ok: entry.ok !== false, status: entry.status || 200, json: async () => entry.body };
  };
}

test("fails closed when NODE_ENV=production, without ever calling fetch", async () => {
  let called = false;
  await assert.rejects(
    () =>
      runGrowthDemoBootstrap({
        nodeEnv: "production",
        db: {},
        fetchImpl: async () => {
          called = true;
          throw new Error("must not be called");
        },
      }),
    (error) => error instanceof GrowthDemoBootstrapError && /production/i.test(error.message)
  );
  assert.equal(called, false, "production guard must short-circuit before any network call");
});

test("fails clearly when developmentOtpExposed is not true", async () => {
  const fetchImpl = fakeFetch({
    "GET http://api.test/api/auth/status": { body: { developmentOtpExposed: false } },
  });
  await assert.rejects(
    () => runGrowthDemoBootstrap({ nodeEnv: "development", apiBaseUrl: "http://api.test", fetchImpl, db: {} }),
    (error) => error instanceof GrowthDemoBootstrapError && /developmentOtpExposed/.test(error.message)
  );
});

test("fails clearly when send-otp does not return a development OTP", async () => {
  const fetchImpl = fakeFetch({
    "GET http://api.test/api/auth/status": { body: { developmentOtpExposed: true } },
    "POST http://api.test/api/auth/send-otp": { body: {} },
  });
  await assert.rejects(
    () => runGrowthDemoBootstrap({ nodeEnv: "development", apiBaseUrl: "http://api.test", fetchImpl, db: {} }),
    (error) => error instanceof GrowthDemoBootstrapError && /developmentOtp/.test(error.message)
  );
});

test("requires a database handle", async () => {
  await assert.rejects(
    () => runGrowthDemoBootstrap({ nodeEnv: "development" }),
    (error) => error instanceof GrowthDemoBootstrapError && /database handle/.test(error.message)
  );
});

test("resolves workspaceId/userId/membershipId from the verify-otp response — never hardcoded — and prints the exact URL", async () => {
  const workspaceId = `ws-${Math.random().toString(36).slice(2)}`;
  const userId = `user-${Math.random().toString(36).slice(2)}`;
  const membershipId = `mem-${Math.random().toString(36).slice(2)}`;
  const seedCalls = [];

  const fetchImpl = fakeFetch({
    "GET http://api.test/api/auth/status": { body: { developmentOtpExposed: true } },
    "POST http://api.test/api/auth/send-otp": { body: { developmentOtp: "11111" } },
    "POST http://api.test/api/auth/verify-otp": {
      body: {
        user: { id: userId },
        activeWorkspace: { id: workspaceId },
        memberships: [{ id: membershipId, workspace: { id: workspaceId } }],
      },
    },
  });

  const result = await runGrowthDemoBootstrap({
    nodeEnv: "development",
    apiBaseUrl: "http://api.test",
    frontendBaseUrl: "http://localhost:5173",
    fetchImpl,
    db: {},
    seedFixture: async (args) => {
      seedCalls.push(args);
      return { experimentId: "exp-1", contextId: "ctx-1", candidateId: "cand-1", leadId: "lead-1" };
    },
  });

  assert.equal(seedCalls.length, 1);
  assert.equal(seedCalls[0].workspaceId, workspaceId, "workspaceId must come from the auth response");
  assert.equal(seedCalls[0].userId, userId, "userId must come from the auth response");
  assert.equal(seedCalls[0].membershipId, membershipId, "membershipId must come from the auth response");
  assert.equal(seedCalls[0].mode, "reuse-or-create");
  assert.equal(result.url, "http://localhost:5173/dashboard/growth-loop/exp-1", "must print the exact Growth Loop URL");
  assert.equal(result.developmentOtp, "11111");
});

test("fails clearly when the workspace/user/membership cannot be resolved from the response", async () => {
  const fetchImpl = fakeFetch({
    "GET http://api.test/api/auth/status": { body: { developmentOtpExposed: true } },
    "POST http://api.test/api/auth/send-otp": { body: { developmentOtp: "11111" } },
    "POST http://api.test/api/auth/verify-otp": { body: { user: null, activeWorkspace: null, memberships: [] } },
  });
  await assert.rejects(
    () => runGrowthDemoBootstrap({ nodeEnv: "development", apiBaseUrl: "http://api.test", fetchImpl, db: {} }),
    (error) => error instanceof GrowthDemoBootstrapError && /resolve/.test(error.message)
  );
});
