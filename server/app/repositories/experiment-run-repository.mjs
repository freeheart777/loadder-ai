import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const parse = (value, fallback = null) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const map = (row) => row && ({
  id: row.id,
  workspaceId: row.workspace_id,
  experimentId: row.experiment_id,
  contextVersionId: row.context_version_id,
  runNumber: row.run_number,
  status: row.status,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  outcome: parse(row.outcome_json, null),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createExperimentRunRepository(db) {
  const workspace = () => requireWorkspaceId();

  const getById = (id) => map(db.prepare(
    "SELECT * FROM experiment_runs WHERE id=? AND workspace_id=?"
  ).get(id, workspace()));

  const getExperiment = (id) => db.prepare(
    "SELECT * FROM experiments WHERE id=? AND workspace_id=?"
  ).get(id, workspace());

  function create(input) {
    const wid = workspace();
    const experiment = getExperiment(input.experimentId);
    if (!experiment) return { error: "EXPERIMENT_NOT_FOUND" };
    if (experiment.context_version_id !== input.contextVersionId) return { error: "CONTEXT_MISMATCH" };

    const id = input.id || crypto.randomUUID();
    const now = input.now;
    const result = db.transaction(() => {
      const next = db.prepare(
        "SELECT COALESCE(MAX(run_number),0)+1 AS run_number FROM experiment_runs WHERE workspace_id=? AND experiment_id=?"
      ).get(wid, input.experimentId).run_number;
      db.prepare(`INSERT INTO experiment_runs(
        id,workspace_id,experiment_id,context_version_id,run_number,status,
        started_at,completed_at,outcome_json,created_at,updated_at
      ) VALUES(?,?,?,?,?,'PLANNED',NULL,NULL,NULL,?,?)`).run(
        id, wid, input.experimentId, input.contextVersionId, next, now, now
      );
      return getById(id);
    })();
    return { run: result, created: true };
  }

  function updateLifecycle(id, status, fields) {
    const wid = workspace();
    const current = getById(id);
    if (!current) return null;
    db.prepare(`UPDATE experiment_runs
      SET status=?, started_at=?, completed_at=?, outcome_json=?, updated_at=?
      WHERE id=? AND workspace_id=?`).run(
      status,
      fields.startedAt ?? current.startedAt,
      fields.completedAt ?? current.completedAt,
      fields.outcome === undefined ? (current.outcome === null ? null : JSON.stringify(current.outcome)) : JSON.stringify(fields.outcome),
      fields.updatedAt,
      id,
      wid
    );
    return getById(id);
  }

  function listPage(filters = {}) {
    const wid = workspace();
    const clauses = ["workspace_id=?"];
    const values = [wid];
    if (filters.experimentId) { clauses.push("experiment_id=?"); values.push(filters.experimentId); }
    if (filters.status) { clauses.push("status=?"); values.push(filters.status); }
    if (filters.contextVersionId) { clauses.push("context_version_id=?"); values.push(filters.contextVersionId); }
    if (filters.cursor) {
      clauses.push("(created_at<? OR(created_at=? AND id<?))");
      values.push(filters.cursor.createdAt, filters.cursor.createdAt, filters.cursor.id);
    }
    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    values.push(limit + 1);
    const rows = db.prepare(`SELECT * FROM experiment_runs WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(map);
    return pageResult(rows, limit, "experiment_runs", (item) => ({ createdAt: item.createdAt, id: item.id }));
  }

  return Object.freeze({ create, getById, getExperiment, updateLifecycle, listPage });
}
