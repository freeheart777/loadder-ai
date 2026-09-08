import { createHash } from 'node:crypto';
import { requireWorkspaceId } from '../tenant-context.mjs';
import { isWorkspaceOperator } from '../workspace-authorization.mjs';
import { CRM_GROWTH_SOURCE, CRM_GROWTH_EVENT_KEY } from '../growth/crm-evidence-contract.mjs';

export class GrowthLeadError extends Error {
  constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
const fail=(code,status=400)=>{throw new GrowthLeadError(code,status);};
const string=v=>typeof v==='string'&&v.trim()&&v.length<=200?v.trim():fail('GROWTH_LEAD_INVALID');

export function createGrowthLeadEvidenceRepository(db,{convertLeadToCustomer,eventService,eventRepository,evidenceRepository}) {
  const convert=db.transaction((leadId,input,actor)=>{
    const ws=requireWorkspaceId();
    if(!isWorkspaceOperator(db,ws,actor?.userId))fail('GROWTH_LEAD_FORBIDDEN',403);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['candidateId','experimentId','contextVersionId','goalRef','idempotencyKey'].includes(k)))fail('GROWTH_LEAD_INVALID');
    leadId=string(leadId);
    const request={leadId,idempotencyKey:string(input.idempotencyKey),candidateId:null,experimentId:null,contextVersionId:null,goalRef:null};
    if(input.candidateId!=null) {
      for(const k of ['candidateId','experimentId','contextVersionId','goalRef'])request[k]=string(input[k]);
      const treatment=db.prepare(`SELECT c.id FROM growth_content_candidates c
        JOIN growth_content_briefs b ON b.id=c.brief_id AND b.workspace_id=c.workspace_id
        JOIN experiments e ON e.id=b.experiment_id AND e.workspace_id=b.workspace_id
        WHERE c.id=? AND c.workspace_id=? AND c.state='APPROVED' AND b.experiment_id=?
        AND b.goal_context_version_id=? AND b.goal_ref=? AND e.goal_context_version_id=b.goal_context_version_id AND e.goal_ref=b.goal_ref`).get(request.candidateId,ws,request.experimentId,request.contextVersionId,request.goalRef);
      if(!treatment)fail('GROWTH_LEAD_TREATMENT_INVALID');
    } else if(['experimentId','contextVersionId','goalRef'].some(k=>input[k]!=null))fail('GROWTH_LEAD_LINKAGE_INCOMPLETE');
    const lead=db.prepare('SELECT id,customer_id,status FROM leads WHERE id=? AND workspace_id=?').get(leadId,ws);
    if(!lead)fail('GROWTH_LEAD_NOT_FOUND',404);
    const requestHash=createHash('sha256').update(JSON.stringify(request)).digest('hex');
    let event=eventRepository.findIdempotent(CRM_GROWTH_SOURCE,leadId,CRM_GROWTH_EVENT_KEY);
    const duplicate=Boolean(event);
    if(event) {
      if(event.metadata?.growth?.requestHash!==requestHash)fail('GROWTH_LEAD_REPLAY_CONFLICT',409);
      const actual=db.prepare("SELECT l.id FROM leads l JOIN customers c ON c.id=l.customer_id AND c.workspace_id=l.workspace_id WHERE l.id=? AND l.workspace_id=? AND l.status='converted' AND c.id=?").get(leadId,ws,event.customerId);
      if(!actual||event.eventType!=='lead.converted'||event.subjectType!=='lead'||event.subjectId!==leadId||event.properties?.customerId!==event.customerId)fail('GROWTH_LEAD_FACT_INVALID',409);
    } else {
      // Never manufacture a historical transition or treatment attribution.
      if(lead.customer_id)return {state:'UNKNOWN',reason:'NO_RECORDED_TRANSITION',leadId,eventId:null,evidenceId:null};
      const result=convertLeadToCustomer(leadId);
      const actual=db.prepare(`SELECT l.customer_id,l.updated_at FROM leads l JOIN customers c ON c.id=l.customer_id AND c.workspace_id=l.workspace_id WHERE l.id=? AND l.workspace_id=? AND l.status='converted'`).get(leadId,ws);
      if(!result||result.alreadyConverted||!actual||actual.customer_id!==result.customer?.id)fail('GROWTH_LEAD_TRANSITION_FAILED',409);
      event=eventService.recordCrmConversion({leadId,customerId:actual.customer_id,contextVersionId:request.contextVersionId,requestHash,candidateId:request.candidateId,experimentId:request.experimentId,goalRef:request.goalRef,occurredAt:actual.updated_at},actor.userId);
    }
    if(!request.candidateId)return {state:'UNKNOWN',reason:'NO_TREATMENT_LINKAGE',leadId,eventId:event.id,evidenceId:null,duplicate};
    const {link}=evidenceRepository.create({contractVersion:1,contextVersionId:request.contextVersionId,
      goal:{reference:request.goalRef,version:request.contextVersionId},subject:{type:'CONTENT_CANDIDATE',id:request.candidateId},
      relation:'HAS_EVIDENCE',object:{type:'EVENT',id:event.id},evidenceKind:'CRM_CONVERSION',producer:CRM_GROWTH_SOURCE,
      source:'CRM lead-to-customer transition',sourceEventId:event.id,correlationId:leadId,idempotencyKey:`lead:${leadId}:converted`});
    return {state:'RECORDED',factAuthority:'CRM_DOMAIN',leadId,eventId:event.id,evidenceId:link.id,candidateId:request.candidateId,experimentId:request.experimentId,contextVersionId:request.contextVersionId,goalRef:request.goalRef,duplicate,causalClaim:false,revenueClaim:false};
  });
  return Object.freeze({convert:(id,input,actor)=>convert.immediate(id,input,actor)});
}
