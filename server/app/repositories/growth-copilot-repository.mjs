import { randomUUID } from 'node:crypto';
import { requireWorkspaceId } from '../tenant-context.mjs';
import { isWorkspaceOperator } from '../workspace-authorization.mjs';
import { decodeCursor, pageResult, CursorPaginationError } from '../query/cursor-pagination.mjs';
import { CopilotError, copilotId, normalizeCopilotInput, copilotHash } from '../growth/copilot-contract.mjs';
import { CRM_GROWTH_SOURCE } from '../growth/crm-evidence-contract.mjs';

const fail=(code,status=409)=>{throw new CopilotError(code,status);};
const map=row=>row && ({id:row.id, actorId:row.actor_id, status:row.status,
  inputHash:row.input_hash, references:JSON.parse(row.input_refs_json), result:JSON.parse(row.result_json),
  createdAt:row.created_at, completedAt:row.completed_at});

// A synchronous, bounded receipt transaction, not an experiment executor.
export function createGrowthCopilotRepository(db,{currentContextState,now=()=>new Date()}={}) {
  function authorize(actor) {
    const ws=requireWorkspaceId();
    if(!isWorkspaceOperator(db,ws,actor?.userId)) fail('COPILOT_FORBIDDEN',403);
    return ws;
  }
  function validateReferences(refs,ws) {
    const current=currentContextState?.();
    if(!current || current.isStale || current.contextVersionId!==refs.contextVersionId) fail('COPILOT_CONTEXT_STALE');
    const experiment=db.prepare(`SELECT e.id FROM experiments e JOIN business_context_versions c
      ON c.id=e.goal_context_version_id AND c.workspace_id=e.workspace_id
      WHERE e.id=? AND e.workspace_id=? AND e.goal_contract_version=1
      AND e.goal_context_version_id=? AND e.goal_ref=? AND c.status='active'
      AND json_type(c.snapshot_json,?)='text'`).get(refs.experimentId,ws,refs.contextVersionId,refs.goalRef,
        `$.strategy.goals[${refs.goalRef.split('/').at(-1)}]`);
    if(!experiment) fail('COPILOT_REFERENCE_MISMATCH');
    if(refs.candidateId && !db.prepare(`SELECT c.id FROM growth_content_candidates c JOIN growth_content_briefs b
      ON b.id=c.brief_id AND b.workspace_id=c.workspace_id WHERE c.id=? AND c.workspace_id=? AND c.state='APPROVED'
      AND b.experiment_id=? AND b.goal_context_version_id=? AND b.goal_ref=?`).get(refs.candidateId,ws,refs.experimentId,refs.contextVersionId,refs.goalRef)) fail('COPILOT_TREATMENT_INVALID');
  }
  function evidence(refs,ws) {
    // Scan at most 26 recent links through the existing subject index; validate
    // canonical CRM provenance with joins, never a query per returned link.
    const rows=db.prepare(`WITH recent AS (
      SELECT id,object_id,object_type,evidence_kind,context_version_id,goal_reference,recorded_at
      FROM growth_evidence_links WHERE workspace_id=? AND subject_type='CONTENT_CANDIDATE' AND subject_id=?
      ORDER BY recorded_at DESC,id DESC LIMIT 26)
      SELECT r.id, e.id AS event_id,
        CASE WHEN r.object_type='EVENT' AND r.evidence_kind='CRM_CONVERSION'
          AND r.context_version_id=? AND r.goal_reference=? AND e.source_type=? AND e.event_type='lead.converted'
          AND e.context_version_id=? AND e.subject_type='lead'
          AND json_extract(e.metadata_json,'$.growth.candidateId')=?
          AND json_extract(e.metadata_json,'$.growth.experimentId')=?
          AND json_extract(e.metadata_json,'$.growth.goalRef')=?
          AND json_extract(e.properties_json,'$.customerId')=c.id
          AND c.id IS NOT NULL AND l.status='converted'
          AND NOT EXISTS(SELECT 1 FROM growth_evidence_links s WHERE s.supersedes_id=r.id)
        THEN 1 ELSE 0 END AS valid
      FROM recent r LEFT JOIN business_events e ON e.id=r.object_id AND e.workspace_id=?
      LEFT JOIN leads l ON l.id=e.subject_id AND l.workspace_id=e.workspace_id
      LEFT JOIN customers c ON c.id=l.customer_id AND c.id=e.customer_id AND c.workspace_id=l.workspace_id
      ORDER BY r.recorded_at DESC,r.id DESC`).all(ws,refs.candidateId,refs.contextVersionId,refs.goalRef,
        CRM_GROWTH_SOURCE,refs.contextVersionId,refs.candidateId,refs.experimentId,refs.goalRef,ws);
    const links=rows.slice(0,25).filter(r=>r.valid===1).map(r=>({evidenceLinkId:r.id,eventId:r.event_id}));
    return {state:links.length?'OBSERVED':'UNKNOWN',scope:'RECENT_25_LINKS',truncated:rows.length>25,
      references:links, attribution:'UNKNOWN', causalLift:'INCONCLUSIVE'};
  }
  const prepare=db.transaction((input,actor)=>{
    const ws=authorize(actor),{refs,idempotencyKey}=normalizeCopilotInput(input);
    validateReferences(refs,ws);
    const hash=copilotHash({actorId:actor.userId,...refs});
    const previous=db.prepare('SELECT * FROM growth_copilot_runs WHERE workspace_id=? AND idempotency_key=?').get(ws,idempotencyKey);
    if(previous) {
      if(previous.input_hash!==hash) fail('COPILOT_REPLAY_CONFLICT');
      return {receipt:map(previous),duplicate:true};
    }
    const result={executionAuthorized:false,domainMutation:false};
    if(refs.capability==='READ_GROWTH_CONTEXT') result.context={experimentId:refs.experimentId,contextVersionId:refs.contextVersionId,goalRef:refs.goalRef};
    if(refs.capability==='READ_APPROVED_TREATMENT') result.treatment={candidateId:refs.candidateId};
    if(['READ_CRM_OUTCOME_EVIDENCE','PREPARE_NEXT_EXPERIMENT_DRAFT'].includes(refs.capability)) result.evidence=evidence(refs,ws);
    if(refs.capability==='PREPARE_NEXT_EXPERIMENT_DRAFT') result.proposal={kind:'EXPERIMENT_DRAFT_PREPARATION',
      basedOnExperimentId:refs.experimentId,contextVersionId:refs.contextVersionId,goalRef:refs.goalRef,candidateId:refs.candidateId,
      assessment:'INCONCLUSIVE',humanApprovalRequired:true,
      requiredAuthoringFields:['hypothesis','treatment','goalContract','decisionId'],
      adoptionOwner:'EXPERIMENT_AUTHORING',adoptedExperimentId:null};
    const json=JSON.stringify(result);
    if(Buffer.byteLength(json)>16384) fail('COPILOT_RESULT_TOO_LARGE');
    const id=randomUUID(),at=now().toISOString(),status=refs.capability==='PREPARE_NEXT_EXPERIMENT_DRAFT'?'PREPARED':'SUCCEEDED';
    db.prepare(`INSERT INTO growth_copilot_runs(id,workspace_id,actor_id,contract_version,mode,capability,
      experiment_id,context_version_id,goal_ref,candidate_id,idempotency_key,input_hash,input_refs_json,result_json,status,error_code,created_at,completed_at)
      VALUES(?,?,?,1,'COPILOT',?,?,?,?,?,?,?,?,?,?,NULL,?,?)`).run(id,ws,actor.userId,refs.capability,refs.experimentId,
        refs.contextVersionId,refs.goalRef,refs.candidateId,idempotencyKey,hash,JSON.stringify(refs),json,status,at,at);
    return {receipt:map(db.prepare('SELECT * FROM growth_copilot_runs WHERE id=? AND workspace_id=?').get(id,ws)),duplicate:false};
  });
  return Object.freeze({
    prepare:(input,actor)=>prepare.immediate(input,actor),
    readEvidence(input,actor) {
      const ws=authorize(actor);
      const {refs}=normalizeCopilotInput({...input,capability:'READ_CRM_OUTCOME_EVIDENCE',idempotencyKey:'read-only'});
      validateReferences(refs,ws);
      return evidence(refs,ws);
    },
    listEligibleLeads(input,actor) {
      const ws=authorize(actor);
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>![
        'capability','experimentId','contextVersionId','goalRef','candidateId','idempotencyKey','limit','cursor',
      ].includes(k))) fail('COPILOT_INVALID_PAGE',400);
      const limit=input.limit===undefined?25:Number(input.limit);
      if(!Number.isInteger(limit)||limit<1||limit>25) fail('COPILOT_INVALID_PAGE',400);
      let cursor;
      try { cursor=decodeCursor(input.cursor,'growth_eligible_leads',['updatedAt','id']); }
      catch(e) { if(e instanceof CursorPaginationError) fail('COPILOT_INVALID_PAGE',400); throw e; }
      const {refs}=normalizeCopilotInput({experimentId:input.experimentId,contextVersionId:input.contextVersionId,
        goalRef:input.goalRef,candidateId:input.candidateId,capability:'READ_CRM_OUTCOME_EVIDENCE',idempotencyKey:'read-only'});
      validateReferences(refs,ws);
      const clause=cursor?' AND (updated_at<? OR (updated_at=? AND id<?))':'';
      const args=cursor?[ws,cursor.updatedAt,cursor.updatedAt,cursor.id,limit+1]:[ws,limit+1];
      const rows=db.prepare(`SELECT id,name,company,updated_at,
        CASE WHEN phone IS NULL OR length(phone)<7 THEN NULL ELSE substr(phone,1,4)||'•••'||substr(phone,-3) END AS masked_phone,
        status FROM leads WHERE workspace_id=? AND customer_id IS NULL
        AND status IN ('new','hot','qualified','negotiating')${clause}
        ORDER BY updated_at DESC,id DESC LIMIT ?`).all(...args).map(row=>({id:row.id,name:row.name,company:row.company,
          maskedPhone:row.masked_phone,status:row.status,treatmentLinked:false,updatedAt:row.updated_at}));
      return pageResult(rows,limit,'growth_eligible_leads',row=>({updatedAt:row.updatedAt,id:row.id}));
    },
    get(id,actor) {
      const ws=authorize(actor);
      return map(db.prepare('SELECT * FROM growth_copilot_runs WHERE id=? AND workspace_id=?').get(copilotId(id),ws));
    },
    list(query={},actor) {
      const ws=authorize(actor);
      if(Object.keys(query).some(k=>!['limit','cursor'].includes(k))) fail('COPILOT_INVALID_PAGE',400);
      const limit=query.limit===undefined?25:Number(query.limit);
      if(!Number.isInteger(limit)||limit<1||limit>100) fail('COPILOT_INVALID_PAGE',400);
      let cursor;
      try { cursor=decodeCursor(query.cursor,'growth_copilot_runs',['createdAt','id']); }
      catch(e) { if(e instanceof CursorPaginationError) fail('COPILOT_INVALID_PAGE',400); throw e; }
      const clause=cursor?' AND (created_at<? OR (created_at=? AND id<?))':'';
      const args=cursor?[ws,cursor.createdAt,cursor.createdAt,cursor.id,limit+1]:[ws,limit+1];
      const rows=db.prepare(`SELECT id,capability,status,created_at FROM growth_copilot_runs WHERE workspace_id=?${clause} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...args);
      return pageResult(rows,limit,'growth_copilot_runs',r=>({createdAt:r.created_at,id:r.id}));
    },
  });
}
