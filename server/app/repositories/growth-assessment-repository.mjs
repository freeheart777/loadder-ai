import { createHash } from 'node:crypto';
import { requireWorkspaceId } from '../tenant-context.mjs';
import { CRM_GROWTH_SOURCE } from '../growth/crm-evidence-contract.mjs';
import { GROWTH_ASSESSMENT_POLICY as policy, assessGrowthReadiness } from '../growth/assessment-policy.mjs';
import { recommendationContractRegistry } from '../recommendations/recommendation-contract-registry.mjs';

export class GrowthAssessmentError extends Error {
  constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
const reject=(code,status=409)=>{throw new GrowthAssessmentError(code,status);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id=v=>typeof v==='string'&&v.trim()&&v.length<=200?v.trim():reject('ASSESSMENT_INPUT_INVALID',400);

export function createGrowthAssessmentRepository(db,{semanticRepository,recommendationRepository,currentContextState,now=()=>new Date()}) {
  const calculate=db.transaction((input,actor)=>{
    const ws=requireWorkspaceId();
    if(!actor?.userId || !db.prepare("SELECT id FROM workspace_memberships WHERE workspace_id=? AND user_id=? AND status='active' AND role IN('owner','admin')").get(ws,actor.userId))reject('ASSESSMENT_FORBIDDEN',403);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['experimentId','contextVersionId','candidateId'].includes(k)))reject('ASSESSMENT_INPUT_INVALID',400);
    const experimentId=id(input.experimentId),contextVersionId=id(input.contextVersionId),candidateId=id(input.candidateId);
    const current=currentContextState();
    if(!current||current.isStale||current.contextVersionId!==contextVersionId)reject('ASSESSMENT_CONTEXT_STALE');
    const experiment=db.prepare(`SELECT e.goal_ref,e.goal_contract_json FROM experiments e
      JOIN business_context_versions c ON c.id=e.goal_context_version_id AND c.workspace_id=e.workspace_id
      WHERE e.id=? AND e.workspace_id=? AND e.goal_contract_version=1 AND e.goal_context_version_id=? AND c.status='active'`).get(experimentId,ws,contextVersionId);
    if(!experiment)reject('ASSESSMENT_REFERENCE_INVALID');
    if(!db.prepare(`SELECT c.id FROM growth_content_candidates c JOIN growth_content_briefs b ON b.id=c.brief_id AND b.workspace_id=c.workspace_id
      WHERE c.id=? AND c.workspace_id=? AND c.state='APPROVED' AND b.experiment_id=? AND b.goal_context_version_id=? AND b.goal_ref=?`).get(candidateId,ws,experimentId,contextVersionId,experiment.goal_ref))reject('ASSESSMENT_TREATMENT_INVALID');
    const goal=JSON.parse(experiment.goal_contract_json),at=now().toISOString();
    const rows=db.prepare(`WITH recent AS (SELECT * FROM growth_evidence_links WHERE workspace_id=? AND subject_type='CONTENT_CANDIDATE' AND subject_id=? ORDER BY recorded_at DESC,id DESC LIMIT ?)
      SELECT r.id,r.payload_hash,r.recorded_at,e.occurred_at,l.id AS lead_id,
      CASE WHEN r.context_version_id=? AND r.goal_reference=? AND r.evidence_kind='CRM_CONVERSION' AND r.authority_class='REPORTED'
        AND r.object_type='EVENT' AND e.source_type=? AND e.event_type='lead.converted' AND e.subject_type='lead'
        AND e.context_version_id=? AND l.status='converted' AND c.id IS NOT NULL
        AND json_extract(e.properties_json,'$.customerId')=c.id
        AND json_extract(e.metadata_json,'$.growth.candidateId')=?
        AND json_extract(e.metadata_json,'$.growth.experimentId')=?
        AND json_extract(e.metadata_json,'$.growth.goalRef')=?
        AND NOT EXISTS(SELECT 1 FROM growth_evidence_links s WHERE s.supersedes_id=r.id)
      THEN 1 ELSE 0 END AS valid
      FROM recent r LEFT JOIN business_events e ON r.object_type='EVENT' AND e.id=r.object_id AND e.workspace_id=?
      LEFT JOIN leads l ON l.id=e.subject_id AND l.workspace_id=e.workspace_id
      LEFT JOIN customers c ON c.id=e.customer_id AND c.id=l.customer_id AND c.workspace_id=l.workspace_id
      ORDER BY r.recorded_at DESC,r.id DESC`).all(ws,candidateId,policy.maxEvidenceLinks+1,contextVersionId,experiment.goal_ref,CRM_GROWTH_SOURCE,contextVersionId,candidateId,experimentId,experiment.goal_ref,ws);
    const truncated=rows.length>policy.maxEvidenceLinks,selected=rows.slice(0,policy.maxEvidenceLinks);
    const valid=selected.filter(r=>r.valid===1&&r.occurred_at>=goal.measurementWindow.start&&r.occurred_at<=goal.measurementWindow.end&&r.occurred_at<=at&&r.recorded_at<=at);
    const baseline=goal.baseline;
    const baselineValid=baseline.state==='EVIDENCED' && Boolean(db.prepare(`SELECT g.id FROM growth_evidence_links g
      JOIN business_events e ON e.id=g.object_id AND e.workspace_id=g.workspace_id
      JOIN leads l ON l.id=e.subject_id AND l.workspace_id=e.workspace_id
      JOIN customers c ON c.id=l.customer_id AND c.id=e.customer_id AND c.workspace_id=l.workspace_id
      WHERE g.id=? AND g.workspace_id=? AND g.context_version_id=? AND g.goal_reference=?
      AND g.evidence_kind='CRM_CONVERSION' AND g.authority_class='REPORTED' AND g.object_type='EVENT'
      AND e.source_type=? AND e.event_type='lead.converted' AND e.subject_type='lead' AND l.status='converted'
      AND json_extract(e.properties_json,'$.customerId')=c.id
      AND NOT EXISTS(SELECT 1 FROM growth_evidence_links s WHERE s.supersedes_id=g.id)`).get(baseline.provenance.evidenceLinkId,ws,contextVersionId,experiment.goal_ref,CRM_GROWTH_SOURCE));
    const value=assessGrowthReadiness({goal,windowComplete:at>=goal.measurementWindow.end,truncated,validCount:new Set(valid.map(r=>r.lead_id)).size,
      invalidCount:selected.length-valid.length,baselineValid,hasEvidence:selected.length>0});
    const evidenceReferences=selected.map(r=>({kind:'growth_evidence_link',id:r.id}));
    // Content-addressed replay: unchanged evidence, contract and window phase converge.
    // New evidence or policy creates a new immutable assessment, never rewrites history.
    const producerKey=hash({policy:policy.version,experimentId,contextVersionId,candidateId,goal,rows:selected.map(r=>[r.id,r.payload_hash,r.valid,r.occurred_at]),value,truncated});
    const created=semanticRepository.create({semanticType:'growth_experiment_review_readiness',semanticVersion:1,schemaVersion:1,
      subjectType:'experiment',subjectId:experimentId,subjectKey:candidateId,state:value.state,value,
      evidenceReferences,evidenceManifestHash:hash(evidenceReferences),contextVersionId,contextState:'READY',
      pointInTimeCutoff:at,producer:'growth_assessment',producerVersion:policy.version,producerKey,
      confidence:null,confidenceReason:'Review readiness only; effectiveness and causal confidence unknown.',
      provenance:{policyVersion:policy.version,goalRef:experiment.goal_ref,experimentId,candidateId,baselineState:baseline.state,
        baselineEvidenceLinkId:baseline.state==='EVIDENCED'?baseline.provenance.evidenceLinkId:null,truncated,scope:policy.completeness,causalClaim:false},
      calculatedAt:at,createdAt:at});
    const finding=created.finding;
    const manifest=[{id:finding.id,semanticType:finding.semanticType,semanticVersion:finding.semanticVersion,schemaVersion:finding.schemaVersion,
      producer:finding.producer,producerVersion:finding.producerVersion,state:finding.state,contextVersionId:finding.contextVersionId,pointInTimeCutoff:finding.pointInTimeCutoff}];
    const contract=recommendationContractRegistry.get('EXPERIMENT_OUTCOME_REVIEW');
    const recommendation=recommendationRepository.create({...contract,subjectType:'experiment',subjectId:experimentId,subjectKey:candidateId,
      considerationCode:value.state==='ACTIONABLE'?'INSPECT_FUNNEL_BOTTLENECK':'GATHER_MORE_EVIDENCE',rationaleCode:value.state,
      reviewPriority:'LOW',semanticFindingReferences:manifest,semanticManifestHash:hash(manifest),contextVersionId,
      pointInTimeCutoff:finding.pointInTimeCutoff,producerKey:hash({assessmentId:finding.id,policyVersion:policy.version}),confidence:null,
      confidenceReason:'Expected benefit is a hypothesis, not a guarantee.',
      provenance:{assessmentId:finding.id,goalRef:experiment.goal_ref,experimentId,candidateId,evidenceManifest:finding.evidenceReferences,
        observedCondition:finding.value,proposedAction:value.state==='ACTIONABLE'?'INSPECT_FUNNEL_BOTTLENECK':'GATHER_MORE_EVIDENCE',
        expectedBenefitHypothesis:'Human review may identify missing evidence or a useful next experiment.',uncertainty:'No effectiveness, attribution or causal conclusion.',
        cost:{state:'UNKNOWN'},risk:'LOW_REVIEW_ONLY',requiredApproval:'HUMAN_REVIEW',freshness:{asOf:finding.pointInTimeCutoff,rule:policy.freshness},
        policyVersion:policy.version,advisoryOnly:true,executable:false,causalClaim:false},calculatedAt:finding.calculatedAt,createdAt:finding.createdAt}).recommendation;
    return {assessment:finding,recommendation,executionAuthorized:false};
  });
  return {calculate:(input,actor)=>calculate.immediate(input,actor)};
}
