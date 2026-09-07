import { requireWorkspaceId } from "../tenant-context.mjs";
import { randomUUID } from "node:crypto";
import { ExperimentAuthoringError, normalizeExperimentGoal } from "../growth/experiment-goal-contract.mjs";

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
  goalContractVersion: row.goal_contract_version ?? null,
  goalContextVersionId: row.goal_context_version_id ?? null,
  goalRef: row.goal_ref ?? null,
  goalContract: row.goal_contract_json ? JSON.parse(row.goal_contract_json) : null,
  supersedesExperimentId: row.supersedes_experiment_id ?? null,
});

export function createExperimentRepository(db, { currentContextState, now = () => new Date() } = {}) {
  const workspace = () => requireWorkspaceId();
  const get = (id) => mapExperiment(db.prepare("SELECT * FROM experiments WHERE id=? AND workspace_id=?").get(id, workspace()));
  const fail = (code, status=400) => { throw new ExperimentAuthoringError(code,status); };
  const authorize = actor => {
    if(!actor?.userId || !db.prepare("SELECT id FROM workspace_memberships WHERE workspace_id=? AND user_id=? AND status='active' AND role IN('owner','admin')").get(workspace(),actor.userId)) fail("EXPERIMENT_AUTHOR_FORBIDDEN",403);
  };
  const author=db.transaction((input,actor)=>{
    authorize(actor);
    const n=normalizeExperimentGoal(input), ws=workspace();
    const current=currentContextState?.();
    if(!current || current.isStale || current.contextVersionId!==n.contextVersionId) fail("EXPERIMENT_CONTEXT_STALE",409);
    const ctx=db.prepare("SELECT snapshot_json FROM business_context_versions WHERE id=? AND workspace_id=? AND status='active'").get(n.contextVersionId,ws);
    if(!ctx) fail("EXPERIMENT_CONTEXT_STALE",409);
    const goals=JSON.parse(ctx.snapshot_json)?.strategy?.goals,index=Number(n.goalRef.split('/').at(-1));
    if(!Array.isArray(goals) || typeof goals[index]!=="string" || !goals[index].trim()) fail("EXPERIMENT_GOAL_NOT_FOUND");
    const decision=db.prepare("SELECT id FROM decision_records d WHERE id=? AND workspace_id=? AND context_version_id=? AND decision_type='ADOPT' AND NOT EXISTS(SELECT 1 FROM decision_records s WHERE s.supersedes_decision_id=d.id)").get(n.decisionId,ws,n.contextVersionId);
    if(!decision) fail("EXPERIMENT_DECISION_REQUIRED",409);
    const baseline=n.goalContract.baseline;
    if(baseline.state==="EVIDENCED") {
      const e=db.prepare("SELECT * FROM growth_evidence_links e WHERE id=? AND workspace_id=? AND context_version_id=? AND goal_reference=? AND authority_class<>'UNKNOWN' AND object_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM growth_evidence_links s WHERE s.supersedes_id=e.id)").get(baseline.provenance.evidenceLinkId,ws,n.contextVersionId,n.goalRef);
      if(!e) fail("EXPERIMENT_BASELINE_EVIDENCE_INVALID");
      const kinds={lead_count:["CRM_CONVERSION","REPORTED_CONVERSION"],order_count:["ORDER"],revenue_minor:["VERIFIED_REVENUE"]};
      if(!kinds[n.goalContract.metric].includes(e.evidence_kind)) fail("EXPERIMENT_BASELINE_EVIDENCE_INVALID");
      if(n.goalContract.metric==='revenue_minor' && !db.prepare("SELECT id FROM ecommerce_financial_ledger WHERE id=? AND workspace_id=? AND currency=?").get(e.object_id,ws,n.goalContract.unit)) fail("EXPERIMENT_BASELINE_UNIT_MISMATCH");
    }
    const json=JSON.stringify(n.goalContract);
    const existing=db.prepare("SELECT * FROM experiments WHERE workspace_id=? AND decision_id=?").get(ws,n.decisionId);
    if(existing) {
      if(existing.goal_contract_version!==1 || existing.goal_ref!==n.goalRef || existing.context_version_id!==n.contextVersionId || existing.goal_contract_json!==json || existing.hypothesis!==n.hypothesis || existing.treatment_definition!==n.treatment || existing.supersedes_experiment_id!==n.supersedesExperimentId) fail("EXPERIMENT_DECISION_CONFLICT",409);
      return {experiment:mapExperiment(existing),created:false};
    }
    const at=now().toISOString();
    if(n.supersedesExperimentId) {
      const p=get(n.supersedesExperimentId);
      if(!p || p.goalContractVersion!==1 || p.goalContextVersionId!==n.contextVersionId || p.goalRef!==n.goalRef || p.createdAt>at) fail("EXPERIMENT_PREDECESSOR_INVALID",409);
      if(db.prepare("SELECT id FROM experiments WHERE supersedes_experiment_id=?").get(p.id)) fail("EXPERIMENT_SUCCESSOR_CONFLICT",409);
    }
    const id=randomUUID();
    db.prepare(`INSERT INTO experiments(id,workspace_id,decision_id,context_version_id,hypothesis,objective,success_metric,baseline_value,treatment_definition,status,starts_at,ends_at,created_at,updated_at,goal_contract_version,goal_context_version_id,goal_ref,goal_contract_json,supersedes_experiment_id) VALUES(?,?,?,?,?,?,?,?,?,'DRAFT',?,?,?,?,1,?,?,?,?)`).run(id,ws,n.decisionId,n.contextVersionId,n.hypothesis,goals[index],n.goalContract.metric,baseline.state==='EVIDENCED'?baseline.value:null,n.treatment,n.goalContract.measurementWindow.start,n.goalContract.measurementWindow.end,at,at,n.contextVersionId,n.goalRef,json,n.supersedesExperimentId);
    return {experiment:get(id),created:true};
  });
  return Object.freeze({ get, author:(input,actor)=>author.immediate(input,actor) });
}
