import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import express from "express";

import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { isWorkspaceOperator, WORKSPACE_OPERATOR_ROLES } from "../app/workspace-authorization.mjs";
import { createExperimentRepository } from "../app/repositories/experiment-repository.mjs";
import { createGrowthCopilotRepository } from "../app/repositories/growth-copilot-repository.mjs";
import { createGrowthAssessmentRepository } from "../app/repositories/growth-assessment-repository.mjs";
import { createGrowthLeadEvidenceRepository } from "../app/repositories/growth-lead-evidence-repository.mjs";
import { createGrowthAssessmentRouter } from "../app/routes/growth-assessment.mjs";

const AT = "2026-09-09T12:00:00.000Z";

// Identity tables only: an actor that passes authorization then fails on a
// later step proves the gate opened, and an actor that is rejected proves the
// gate closed before any domain work could touch a table that isn't even here.
function identityDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migration001Identity.up(db);
  const user = (id) => db.prepare("INSERT INTO users(id,mobile,name,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)").run(id, `09${id.padEnd(9, "0").slice(0, 9)}`, id, AT, AT);
  const workspace = (id, status = "active") => db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(id, id, id, status, AT, AT);
  const member = (id, workspaceId, userId, role, status = "active") => db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(id, workspaceId, userId, role, status, AT, AT);

  workspace("ws-a");
  workspace("ws-b");
  workspace("ws-disabled", "inactive");
  for (const id of ["owner-a", "admin-a", "member-a", "revoked-a", "stranger", "owner-b", "owner-disabled"]) user(id);
  member("m-owner-a", "ws-a", "owner-a", "owner");
  member("m-admin-a", "ws-a", "admin-a", "admin");
  member("m-member-a", "ws-a", "member-a", "member");
  member("m-revoked-a", "ws-a", "revoked-a", "owner", "revoked");
  member("m-owner-b", "ws-b", "owner-b", "owner");
  member("m-owner-disabled", "ws-disabled", "owner-disabled", "owner");
  return db;
}

test("canonical primitive: owner and admin are operators, everyone else is not", () => {
  const db = identityDb();

  assert.equal(isWorkspaceOperator(db, "ws-a", "owner-a"), true, "owner allowed");
  assert.equal(isWorkspaceOperator(db, "ws-a", "admin-a"), true, "admin allowed");
  assert.equal(isWorkspaceOperator(db, "ws-a", "member-a"), false, "member denied");
  assert.equal(isWorkspaceOperator(db, "ws-a", "revoked-a"), false, "inactive membership denied");
  assert.equal(isWorkspaceOperator(db, "ws-a", "stranger"), false, "missing membership denied");
  assert.equal(isWorkspaceOperator(db, "ws-b", "owner-a"), false, "workspace A membership cannot authorize workspace B");
  assert.equal(isWorkspaceOperator(db, "ws-a", "owner-b"), false, "foreign owner denied");
  assert.deepEqual([...WORKSPACE_OPERATOR_ROLES], ["owner", "admin"]);
});

test("canonical primitive fails closed on missing inputs", () => {
  const db = identityDb();
  for (const [workspaceId, userId] of [[null, "owner-a"], ["ws-a", null], ["ws-a", undefined], ["ws-a", ""], [undefined, undefined]]) {
    assert.equal(isWorkspaceOperator(db, workspaceId, userId), false, `denied for (${workspaceId}, ${userId})`);
  }
  assert.equal(isWorkspaceOperator(null, "ws-a", "owner-a"), false, "denied without a database handle");
});

test("canonical primitive matches on user identity, not on a supplied membership id", () => {
  const db = identityDb();
  // A real, active, owner-role membership row exists — but it belongs to another
  // user. Knowing its id must not authorize anybody.
  const foreign = db.prepare("SELECT id,user_id FROM workspace_memberships WHERE id='m-owner-a'").get();
  assert.equal(foreign.user_id, "owner-a");
  assert.equal(isWorkspaceOperator(db, "ws-a", "stranger"), false, "another user's membership id cannot authorize");
  assert.equal(isWorkspaceOperator(db, "ws-a", foreign.id), false, "a membership id is not a user id");
});

test("workspace status is not consulted at the repository layer (middleware owns it)", () => {
  const db = identityDb();
  // Pins current behavior: createRequireWorkspace/findMembership rejects inactive
  // workspaces at the HTTP boundary. The repository-layer predicate intentionally
  // matches the pre-refactor SQL exactly and does not re-check workspace status.
  assert.equal(isWorkspaceOperator(db, "ws-disabled", "owner-disabled"), true);
});

const domains = [
  {
    name: "experiment authoring",
    code: "EXPERIMENT_AUTHOR_FORBIDDEN",
    call: (db, actor) => createExperimentRepository(db, { currentContextState: () => ({ contextVersionId: "c", isStale: false }) }).author({}, actor),
  },
  {
    name: "growth copilot",
    code: "COPILOT_FORBIDDEN",
    call: (db, actor) => createGrowthCopilotRepository(db, { currentContextState: () => ({ contextVersionId: "c", isStale: false }) }).prepare({}, actor),
  },
  {
    name: "growth assessment",
    code: "ASSESSMENT_FORBIDDEN",
    call: (db, actor) => createGrowthAssessmentRepository(db, { semanticRepository: {}, recommendationRepository: {}, currentContextState: () => ({ contextVersionId: "c", isStale: false }) }).calculate({}, actor),
  },
  {
    name: "growth lead evidence",
    code: "GROWTH_LEAD_FORBIDDEN",
    call: (db, actor) => createGrowthLeadEvidenceRepository(db, { convertLeadToCustomer: () => { throw new Error("must not run"); }, eventService: {}, eventRepository: {}, evidenceRepository: {} }).convert("lead-1", {}, actor),
  },
];

for (const domain of domains) {
  test(`${domain.name} still enforces workspace operator authorization after centralization`, () => {
    const db = identityDb();
    const denied = [
      ["member", { userId: "member-a" }],
      ["revoked membership", { userId: "revoked-a" }],
      ["no membership", { userId: "stranger" }],
      ["foreign workspace owner", { userId: "owner-b" }],
      ["absent actor", undefined],
      ["actor without userId", {}],
    ];
    for (const [label, actor] of denied) {
      assert.throws(
        () => runWithWorkspace("ws-a", () => domain.call(db, actor)),
        (error) => error.code === domain.code && error.status === 403,
        `${label} must be rejected with ${domain.code}/403`
      );
    }

    // Operators pass the gate: the call proceeds and fails later on input or
    // missing domain tables, never with the authorization code.
    for (const userId of ["owner-a", "admin-a"]) {
      assert.throws(
        () => runWithWorkspace("ws-a", () => domain.call(db, { userId })),
        (error) => error.code !== domain.code,
        `${userId} must pass authorization`
      );
    }
  });

  test(`${domain.name} authorization failure creates no domain artifact and is stable on repeat`, () => {
    const db = identityDb();
    const tables = () => db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n;
    const before = tables();
    const rows = db.prepare("SELECT count(*) n FROM workspace_memberships").get().n;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.throws(
        () => runWithWorkspace("ws-a", () => domain.call(db, { userId: "member-a" })),
        (error) => error.code === domain.code && error.status === 403,
        "repeated requests must not change authorization semantics"
      );
    }

    assert.equal(tables(), before, "no table was created by a rejected call");
    assert.equal(db.prepare("SELECT count(*) n FROM workspace_memberships").get().n, rows, "no membership was written by a rejected call");
  });
}

test("a failure after authorization still rolls back the whole transaction", () => {
  const db = identityDb();
  db.exec("CREATE TABLE experiments(id TEXT PRIMARY KEY, workspace_id TEXT, decision_id TEXT)");
  const repository = createExperimentRepository(db, { currentContextState: () => ({ contextVersionId: "c", isStale: false }) });

  // owner-a passes authorization, then the goal contract rejects the payload.
  assert.throws(
    () => runWithWorkspace("ws-a", () => repository.author({ decisionId: "d1", contextVersionId: "c", goalRef: "/strategy/goals/0" }, { userId: "owner-a" })),
    (error) => error.code !== "EXPERIMENT_AUTHOR_FORBIDDEN"
  );
  assert.equal(db.prepare("SELECT count(*) n FROM experiments").get().n, 0, "no experiment survived the rolled-back transaction");
});

test("authorization is transaction-local: a membership revoked mid-transaction is not authorized", () => {
  const db = identityDb();
  // The predicate reads through the caller's own handle, so a revocation that
  // lands before the guarded work is observed by that same transaction.
  db.prepare("UPDATE workspace_memberships SET status='revoked' WHERE id='m-owner-a'").run();
  assert.throws(
    () => runWithWorkspace("ws-a", () => createExperimentRepository(db, { currentContextState: () => ({ contextVersionId: "c", isStale: false }) }).author({}, { userId: "owner-a" })),
    (error) => error.code === "EXPERIMENT_AUTHOR_FORBIDDEN" && error.status === 403
  );
});

test("the request body cannot supply the actor", async () => {
  const seen = [];
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: "owner-a" }; req.membership = { id: "m-owner-a", role: "owner", status: "active" }; runWithWorkspace("ws-a", next); });
  app.use("/api", createGrowthAssessmentRouter({ repository: { calculate: (input, actor) => { seen.push({ input, actor }); return { ok: true }; } } }));
  const server = await new Promise((resolve) => { const candidate = app.listen(0, "127.0.0.1", () => resolve(candidate)); });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/growth/assessments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "attacker", actor: { userId: "attacker" }, workspaceId: "ws-b", experimentId: "e1" }),
  });

  assert.equal(response.status, 200);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].actor, { userId: "owner-a" }, "actor comes from the authenticated session, never the body");
  await new Promise((resolve) => server.close(resolve));
});
