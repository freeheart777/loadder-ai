import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const map = (row) => row && ({
  id:row.id, decisionId:row.decision_id, recommendationId:row.recommendation_id,
  actionType:row.action_type, actionVersion:row.action_version, schemaVersion:row.schema_version,
  subjectType:row.subject_type, subjectId:row.subject_id, subjectKey:row.subject_key,
  targetType:row.target_type, targetKey:row.target_key, contextVersionId:row.context_version_id,
  pointInTimeCutoff:row.point_in_time_cutoff, riskClass:row.risk_class,
  executionEligible:Boolean(row.execution_eligible), executable:Boolean(row.executable),
  requiresAuthorization:Boolean(row.requires_authorization), producer:row.producer,
  producerVersion:row.producer_version, createdByUserId:row.created_by_user_id,
  createdByMembershipId:row.created_by_membership_id, createdByRole:row.created_by_role,
  inputManifestHash:row.input_manifest_hash, proposalHash:row.proposal_hash, createdAt:row.created_at,
});

export function createActionProposalRepository(db) {
  const workspace=()=>requireWorkspaceId();
  const byIdempotency=(userId,key)=>db.prepare("SELECT * FROM action_proposals WHERE workspace_id=? AND created_by_user_id=? AND idempotency_key=?").get(workspace(),userId,key);
  const byProducer=(producer,version,key)=>db.prepare("SELECT * FROM action_proposals WHERE workspace_id=? AND producer=? AND producer_version=? AND producer_key=?").get(workspace(),producer,version,key);
  function create(input) {
    return db.transaction(()=>{
      const prior=byIdempotency(input.actor.userId,input.idempotencyKey);
      if(prior)return{proposal:map(prior),requestHash:prior.request_hash,created:false};
      const existing=byProducer(input.producer,input.producerVersion,input.producerKey);
      if(existing)return{proposal:map(existing),requestHash:existing.request_hash,created:false};
      const id=crypto.randomUUID();
      try {
        db.prepare(`INSERT INTO action_proposals(
          id,workspace_id,decision_id,recommendation_id,action_type,action_version,schema_version,
          subject_type,subject_id,subject_key,target_type,target_key,context_version_id,point_in_time_cutoff,
          risk_class,execution_eligible,executable,requires_authorization,producer,producer_version,producer_key,
          created_by_user_id,created_by_membership_id,created_by_role,operation_kind,idempotency_key,request_hash,
          input_manifest_hash,proposal_hash,created_at
        )VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,1,?,?,?,?,?,?,'action_proposal.create',?,?,?,?,?)`).run(
          id,workspace(),input.decision.id,input.recommendation.id,input.contract.actionType,
          input.contract.actionVersion,input.contract.schemaVersion,input.recommendation.subjectType,
          input.recommendation.subjectId,input.recommendation.subjectKey,input.targetType,input.targetKey,
          input.recommendation.contextVersionId,input.recommendation.pointInTimeCutoff,input.contract.riskClass,
          input.contract.producer,input.contract.producerVersion,input.producerKey,input.actor.userId,
          input.actor.membershipId,input.actor.role,input.idempotencyKey,input.requestHash,input.inputManifestHash,
          input.proposalHash,input.createdAt
        );
      } catch(error) {
        const winner=byIdempotency(input.actor.userId,input.idempotencyKey)||
          byProducer(input.contract.producer,input.contract.producerVersion,input.producerKey);
        if(winner)return{proposal:map(winner),requestHash:winner.request_hash,created:false};
        throw error;
      }
      return{proposal:map(db.prepare("SELECT * FROM action_proposals WHERE id=? AND workspace_id=?").get(id,workspace())),requestHash:input.requestHash,created:true};
    })();
  }
  function listPage(filters) {
    const values=[workspace()];let where="workspace_id=?";
    if(filters.cursor){where+=" AND (created_at<? OR(created_at=? AND id<?))";values.push(filters.cursor.createdAt,filters.cursor.createdAt,filters.cursor.id);}
    values.push(filters.limit+1);
    const rows=db.prepare(`SELECT * FROM action_proposals WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(map);
    return pageResult(rows,filters.limit,"action_proposals",(item)=>({createdAt:item.createdAt,id:item.id}));
  }
  const getById=(id)=>map(db.prepare("SELECT * FROM action_proposals WHERE id=? AND workspace_id=?").get(id,workspace()));
  return Object.freeze({create,listPage,getById});
}
