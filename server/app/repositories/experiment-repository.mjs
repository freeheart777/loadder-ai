import { requireWorkspaceId } from "../tenant-context.mjs";

const mapExperiment = (row) => row && ({
  id: row.id,
  workspaceId: row.workspace_id,
  decisionId: row.decision_id,
  contextVersionId: row.context_version_id,
  hypothesis: row.hypothesis,
  objective: row.objective,
  successMetric: row.success_metric,
  baselineValue: row.baseline_value,
  treatmentDefinition: row.treatment_definition,
  status: row.status,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createExperimentRepository(db) {
  const workspace = () => requireWorkspaceId();
  const get = (id) => mapExperiment(db.prepare("SELECT * FROM experiments WHERE id=? AND workspace_id=?").get(id, workspace()));
  return Object.freeze({ get });
}
