import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const mapRun = (row) => row && ({
  id: row.id,
  workspaceId: row.workspace_id,
  experimentId: row.experiment_id,
  contextVersionId: row.context_version_id,
  runNumber: row.run_number,
  status: row.status,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createExperimentRunRepository(db) {
  const workspace = () => requireWorkspaceId();
  const get = (id) => mapRun(db.prepare("SELECT * FROM experiment_runs WHERE id=? AND workspace_id=?").get(id, workspace()));
  const getExperiment = (id) => db.prepare("SELECT * FROM experiments WHERE id=? AND workspace_id=?").get(id, workspace());

  function create({ experimentId, contextVersionId, now }) {
    return db.transaction(() => {
      const workspaceId = workspace();
      const experiment = getExperiment(experimentId);
      if (!experiment) return null;
      const runNumber = (db.prepare("SELECT COALESCE(MAX(run_number),0)+1 n FROM experiment_runs WHERE workspace_id=? AND experiment_id=?").get(workspaceId, experimentId)).n;
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO experiment_runs(id,workspace_id,experiment_id,context_version_id,run_number,status,created_at,updated_at) VALUES(?,?,?,?,?,'PLANNED',?,?)").run(id, workspaceId, experimentId, contextVersionId, runNumber, now, now);
      return get(id);
    })();
  }

  function list({ experimentId, status, limit, cursor }) {
    const clauses = ["workspace_id=?", "experiment_id=?"];
    const values = [workspace(), experimentId];
    if (status) { clauses.push("status=?"); values.push(status); }
    if (cursor) { clauses.push("(created_at<? OR(created_at=? AND id<?))"); values.push(cursor.createdAt, cursor.createdAt, cursor.id); }
    values.push(limit + 1);
    return pageResult(
      db.prepare(`SELECT * FROM experiment_runs WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(mapRun),
      limit,
      "experiment_runs",
      (x) => ({ createdAt: x.createdAt, id: x.id }),
    );
  }

  function transition(id, { from, to, contextVersionId, now, outcome }) {
    const workspaceId = workspace();
    const payload = outcome === undefined ? null : JSON.stringify(outcome);
    const result = db.prepare(`UPDATE experiment_runs SET status=?, started_at=CASE WHEN ?='RUNNING' THEN COALESCE(started_at,?) ELSE started_at END, completed_at=CASE WHEN ? IN('COMPLETED','FAILED','CANCELLED') THEN COALESCE(completed_at,?) ELSE completed_at END, outcome_json=CASE WHEN ? IN('COMPLETED','FAILED','CANCELLED') THEN ? ELSE outcome_json END, updated_at=? WHERE id=? AND workspace_id=? AND context_version_id=? AND status=?`).run(to, to, now, to, now, to, payload, now, id, workspaceId, contextVersionId, from);
    if (result.changes !== 1) return null;
    return get(id);
  }

  return Object.freeze({ create, list, get, transition, getExperiment });
}
