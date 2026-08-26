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
  const getExperiment = (experimentId) => db.prepare("SELECT * FROM experiments WHERE id=? AND workspace_id=?").get(experimentId, workspace());
  const get = (id) => mapRun(db.prepare("SELECT * FROM experiment_runs WHERE id=? AND workspace_id=?").get(id, workspace()));
  const nextRunNumber = (experimentId) => db.prepare("SELECT COALESCE(MAX(run_number),0)+1 AS next FROM experiment_runs WHERE workspace_id=? AND experiment_id=?").get(workspace(), experimentId).next;

  const create = ({ experimentId, contextVersionId, now }) => {
    const wid = workspace();
    if (!getExperiment(experimentId)) return null;
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO experiment_runs(id,workspace_id,experiment_id,context_version_id,run_number,status,created_at,updated_at)
      VALUES(?,?,?,?,?,'PLANNED',?,?)`).run(id, wid, experimentId, contextVersionId, nextRunNumber(experimentId), now, now);
    return get(id);
  };

  const updateStatus = ({ id, status, startedAt, completedAt, outcome, now }) => {
    const existing = db.prepare("SELECT id FROM experiment_runs WHERE id=? AND workspace_id=?").get(id, workspace());
    if (!existing) return null;
    db.prepare(`UPDATE experiment_runs SET status=?,started_at=COALESCE(?,started_at),completed_at=COALESCE(?,completed_at),outcome_json=COALESCE(?,outcome_json),updated_at=? WHERE id=? AND workspace_id=?`).run(
      status, startedAt ?? null, completedAt ?? null, outcome === undefined ? null : JSON.stringify(outcome), now, id, workspace()
    );
    return get(id);
  };

  const list = (filters = {}) => {
    const clauses = ["workspace_id=?"], values = [workspace()];
    if (filters.experimentId) { clauses.push("experiment_id=?"); values.push(filters.experimentId); }
    if (filters.status) { clauses.push("status=?"); values.push(filters.status); }
    if (filters.cursor) { clauses.push("(created_at<? OR(created_at=? AND id<?))"); values.push(filters.cursor.createdAt, filters.cursor.createdAt, filters.cursor.id); }
    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    values.push(limit + 1);
    const rows = db.prepare(`SELECT * FROM experiment_runs WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(mapRun);
    return pageResult(rows, limit, "experiment_runs", (x) => ({ createdAt: x.createdAt, id: x.id }));
  };

  return Object.freeze({ getExperiment, get, create, updateStatus, list });
}
