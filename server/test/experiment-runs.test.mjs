import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createExperimentRunRepository } from "../app/repositories/experiment-run-repository.mjs";
import { createExperimentRunService } from "../app/services/experiment-run-service.mjs";

test("Phase 4H experiment runs lifecycle and tenant isolation", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "loadder-experiment-runs-"));
  const path = join(dir, "runs.sqlite");
  copyFileSync(new URL("../db/loadder.sqlite", import.meta.url), path);
  const db = new Database(path);
  db.pragma("foreign_keys=ON");
  runMigrations(db);

  const AT = "2026-08-26T12:00:00.000Z";
  const setup = (wid) => {
    db.prepare("INSERT INTO workspaces(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)").run(wid, wid, wid, AT, AT);
    db.prepare("INSERT INTO business_profiles(id,workspace_id,name,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(`p-${wid}`, wid, wid, "active", AT, AT);
    db.prepare("INSERT INTO business_dna_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`d-${wid}`, wid, `p-${wid}`, 1, "active", AT, AT);
    db.prepare("INSERT INTO brand_book_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`b-${wid}`, wid, `p-${wid}`, 1, "active", AT, AT);
    db.prepare("INSERT INTO business_context_versions(id,workspace_id,business_profile_id,business_dna_version_id,brand_book_version_id,version_number,status,context_schema_version,snapshot_json,source_manifest_json,created_at,activated_at) VALUES(?,?,?,?,?,1,'active','1.0','{}','{}',?,?)").run(`c-${wid}`, wid, `p-${wid}`, `d-${wid}`, `b-${wid}`, AT, AT);
    db.prepare("INSERT INTO users(id,mobile,name,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(`u-${wid}`, `09${wid.padEnd(9, "0").slice(0, 9)}`, wid, "active", AT, AT);
    db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`m-${wid}`, wid, `u-${wid}`, "owner", "active", AT, AT);
    db.prepare("INSERT INTO decision_records(id,workspace_id,recommendation_id,recommendation_version,context_version_id,decider_user_id,decider_membership_id,decider_role,decision_type,authority_class,execution_authorizing,observed_freshness,supersedes_decision_id,operation_kind,idempotency_key,request_hash,decided_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,'BUSINESS_INTENT',0,?,?,?,?,?,?,?)").run(`dec-${wid}`, wid, `rec-${wid}`, 1, `c-${wid}`, `u-${wid}`, `m-${wid}`, "owner", "ADOPT", "FRESH", null, "decision.create", `key-${wid}`, "hash", AT, AT);
    db.prepare("INSERT INTO experiments(id,workspace_id,decision_id,context_version_id,hypothesis,objective,success_metric,treatment_definition,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(`exp-${wid}`, wid, `dec-${wid}`, `c-${wid}`, "Test treatment", "Improve metric", "conversion_rate", "treatment-v1", "READY", AT, AT);
  };
  setup("ga");
  setup("gb");

  let tick = 0;
  const serviceFor = (wid) => {
    const repository = createExperimentRunRepository(db);
    return runWithWorkspace(wid, () => createExperimentRunService({ repository, now: () => new Date(Date.parse(AT) + tick++ * 1000) }));
  };

  await t.test("requires workspace context", () => {
    const repository = createExperimentRunRepository(db);
    assert.throws(() => repository.getById("anything"), /Workspace context is required/);
  });

  await t.test("creates pinned runs with monotonic per-experiment numbers", () => runWithWorkspace("ga", () => {
    const service = serviceFor("ga");
    const first = service.create({ experimentId: "exp-ga", contextVersionId: "c-ga" });
    const second = service.create({ experimentId: "exp-ga", contextVersionId: "c-ga" });
    assert.equal(first.runNumber, 1);
    assert.equal(second.runNumber, 2);
    assert.equal(first.status, "PLANNED");
    assert.equal(first.contextVersionId, "c-ga");
  }));

  await t.test("enforces the complete lifecycle and terminal immutability", () => runWithWorkspace("ga", () => {
    const service = serviceFor("ga");
    const run = service.create({ experimentId: "exp-ga", contextVersionId: "c-ga" });
    const started = service.start(run.id);
    assert.equal(started.status, "RUNNING");
    assert.ok(started.startedAt);
    const completed = service.complete(run.id, { uplift: 0.12 });
    assert.equal(completed.status, "COMPLETED");
    assert.deepEqual(completed.outcome, { uplift: 0.12 });
    assert.ok(completed.completedAt);
    assert.throws(() => service.start(run.id), (error) => error.code === "INVALID_RUN_TRANSITION");
    assert.throws(() => service.complete(run.id, []), (error) => error.code === "INVALID_RUN_TRANSITION");
  }));

  await t.test("rejects context mismatch and non-runnable experiments", () => runWithWorkspace("ga", () => {
    const service = serviceFor("ga");
    assert.throws(() => service.create({ experimentId: "exp-ga", contextVersionId: "c-gb" }), (error) => error.code === "CONTEXT_MISMATCH");
    db.prepare("UPDATE experiments SET status='DRAFT' WHERE id='exp-ga'").run();
    assert.throws(() => service.create({ experimentId: "exp-ga", contextVersionId: "c-ga" }), (error) => error.code === "EXPERIMENT_NOT_RUNNABLE");
    db.prepare("UPDATE experiments SET status='READY' WHERE id='exp-ga'").run();
  }));

  await t.test("tenant isolation prevents cross-workspace reads and writes", () => {
    const ga = serviceFor("ga");
    const run = runWithWorkspace("ga", () => ga.create({ experimentId: "exp-ga", contextVersionId: "c-ga" }));
    const gb = serviceFor("gb");
    runWithWorkspace("gb", () => {
      assert.equal(gb.get(run.id), null);
      assert.throws(() => gb.start(run.id), (error) => error.code === "RUN_NOT_FOUND");
      assert.throws(() => gb.create({ experimentId: "exp-ga", contextVersionId: "c-ga" }), (error) => error.code === "EXPERIMENT_NOT_FOUND");
    });
  });

  await t.test("migration is idempotent and experiment_runs exists exactly once", () => {
    const before = db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='experiment_runs'").get().c;
    runMigrations(db);
    const after = db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='experiment_runs'").get().c;
    assert.equal(before, 1);
    assert.equal(after, 1);
  });

  db.close();
  rmSync(dir, { recursive: true, force: true });
});
