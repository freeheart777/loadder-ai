export class DecisionRecordReadError extends Error{constructor(message,status=400,code='DECISION_RECORD_INVALID'){super(message);this.status=status;this.code=code;}}
const id=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>200)throw new DecisionRecordReadError('decisionId is invalid.');return value.trim();};
const json=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
const ref=(type,value)=>value?{type,id:value}:null;

export function createDecisionRecordReadService({repository}) {
  function getRecord(decisionId) {
    const data=repository.get(id(decisionId));
    if(!data)throw new DecisionRecordReadError('Decision not found.',404,'DECISION_NOT_FOUND');
    const {row,findings,evidence,findingsTruncated,evidenceTruncated}=data;
    const recommendationProvenance=json(row.recommendation_provenance,{});
    const beliefs=findings.map(f=>({
      findingId:f.id,findingType:f.semantic_type,state:f.state,confidence:f.confidence,
      confidenceReason:f.confidence_reason,pointInTimeCutoff:f.point_in_time_cutoff,
      producer:f.producer,producerVersion:f.producer_version,
    }));
    const evidenceItems=evidence.map(e=>({
      evidenceLinkId:e.id,evidenceKind:e.evidence_kind,authorityClass:e.authority_class,
      subject:ref(e.subject_type,e.subject_id),relation:e.relation,object:ref(e.object_type,e.object_id),
      sourceEventId:e.source_event_id,occurredAt:e.occurred_at||null,recordedAt:e.recorded_at,
      correlationId:e.correlation_id,causationId:e.causation_id,supersedesEvidenceLinkId:e.supersedes_id,
      producer:e.producer,source:e.source,
    }));
    const experimentId=recommendationProvenance.experimentId||null;
    const goalRef=recommendationProvenance.goalRef||null;
    const candidateId=recommendationProvenance.candidateId||null;
    const missing=[];
    if(!findings.length)missing.push('BELIEFS');
    if(!evidenceItems.length)missing.push('EVIDENCE');
    if(!experimentId)missing.push('EXPERIMENT_LINEAGE');
    if(!goalRef)missing.push('GOAL_LINEAGE');
    if(!candidateId)missing.push('TREATMENT_LINEAGE');
    if(findingsTruncated||evidenceTruncated)missing.push('BOUNDED_RESULT_TRUNCATED');
    const explainabilityStatus=!beliefs.length&&!evidenceItems.length?'UNKNOWN':missing.length?'PARTIAL':'COMPLETE';
    return {
      contractVersion:1,
      decision:{id:row.id,type:row.decision_type,actor:{id:row.decider_user_id,role:row.decider_role},decidedAt:row.decided_at,
        authorityClass:row.authority_class,executionAuthorizing:Boolean(row.execution_authorizing),observedFreshness:row.observed_freshness,
        supersedesDecisionId:row.supersedes_decision_id,supersededByDecisionId:row.superseded_by_decision_id},
      recommendation:{id:row.recommendation_id,type:row.recommendation_type,version:row.recommendation_version,
        subject:{type:row.subject_type,id:row.subject_id,key:row.subject_key},requiredApproval:recommendationProvenance.requiredApproval||null,
        policyVersion:recommendationProvenance.policyVersion||row.recommendation_producer_version,
        producer:row.recommendation_producer,confidence:row.recommendation_confidence,confidenceReason:row.recommendation_confidence_reason},
      context:{workspaceId:row.workspace_id,contextVersionId:row.context_version_id,experimentId,goalRef},
      beliefs,evidence:evidenceItems,treatment:{candidateId},
      execution:{authorized:false,sourceCopilotRunId:null},
      explainability:{status:explainabilityStatus,missing:[...new Set(missing)]},
      bounds:{findingsTruncated,evidenceTruncated},
    };
  }
  return Object.freeze({getRecord});
}
