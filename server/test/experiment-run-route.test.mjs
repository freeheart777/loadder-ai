import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

import { createHumanGovernanceRouter } from "../app/routes/human-governance.mjs";

async function withServer(runService, fn) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "user-1" };
    req.membership = { id: "membership-1", role: "owner" };
    next();
  });
  app.use("/api", createHumanGovernanceRouter({
    service: {
      createReview() { throw new Error("unused"); },
      listReviews() { throw new Error("unused"); },
      createDecision() { throw new Error("unused"); },
      listDecisions() { throw new Error("unused"); },
    },
    experimentRunService: runService,
  }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("experiment run routes expose lifecycle operations", async () => {
  const calls = [];
  const run = { id: "run-1", status: "PLANNED", experimentId: "exp-1", contextVersionId: "ctx-1" };
  const runService = {
    create(input) { calls.push(["create", input]); return run; },
    list(filters) { calls.push(["list", filters]); return { items: [run], nextCursor: null }; },
    start(id, options) { calls.push(["start", id, options]); return { ...run, status: "RUNNING" }; },
    complete(id, options) { calls.push(["complete", id, options]); return { ...run, status: "COMPLETED" }; },
    fail(id, options) { calls.push(["fail", id, options]); return { ...run, status: "FAILED" }; },
    cancel(id, options) { calls.push(["cancel", id, options]); return { ...run, status: "CANCELLED" }; },
  };

  await withServer(runService, async (base) => {
    const create = await fetch(`${base}/api/experiments/exp-1/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contextVersionId: "ctx-1" }) });
    assert.equal(create.status, 201);
    assert.deepEqual((await create.json()).run, run);

    const list = await fetch(`${base}/api/experiments/exp-1/runs?status=RUNNING&limit=10`);
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).runs, [run]);

    for (const [path, expectedStatus, expectedCall, body] of [
      ["start", "RUNNING", "start", {}],
      ["complete", "COMPLETED", "complete", { outcome: { metric: 1 } }],
      ["fail", "FAILED", "fail", { outcome: { reason: "timeout" } }],
      ["cancel", "CANCELLED", "cancel", {}],
    ]) {
      const response = await fetch(`${base}/api/experiment-runs/run-1/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contextVersionId: "ctx-1", ...body }) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).run.status, expectedStatus);
      assert.equal(calls.at(-1)[0], expectedCall);
    }
  });

  assert.deepEqual(calls[0], ["create", { experimentId: "exp-1", contextVersionId: "ctx-1" }]);
  assert.deepEqual(calls[1], ["list", { experimentId: "exp-1", status: "RUNNING", limit: "10" }]);
});
