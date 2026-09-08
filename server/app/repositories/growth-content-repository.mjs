import { randomUUID } from 'node:crypto';
import { requireWorkspaceId } from '../tenant-context.mjs';
import { briefInput, fields, text, hash, fail, pageInput } from '../growth/content-contract.mjs';

export function createGrowthContentRepository(db,{contextGateway,now=()=>new Date()}={}) {
  const ws=()=>requireWorkspaceId(),at=()=>now().toISOString();
  const authorize=(actor,write=false)=>{
    const m=db.prepare("SELECT role FROM workspace_memberships WHERE workspace_id=? AND user_id=? AND status='active'").get(ws(),actor?.userId??'');
    if(!m || (write && !['owner','admin'].includes(m.role))) fail('CONTENT_ACCESS_DENIED',403);
  };
  const brief=id=>db.prepare('SELECT * FROM growth_content_briefs WHERE workspace_id=? AND id=?').get(ws(),id);
  const candidate=id=>db.prepare('SELECT * FROM growth_content_candidates WHERE workspace_id=? AND id=?').get(ws(),id);
  const current=(id,actor)=>{
    const c=contextGateway.consume({consumer:'content_studio',operation:'growth_content',userId:actor.userId});
    if(c.state!=='READY'||c.contextVersionId!==id) fail('CONTENT_CONTEXT_STALE',409);
    return c;
  };
  const createBrief=db.transaction((input,actor)=>{
    authorize(actor,true); const n=briefInput(input),h=hash(n);
    const old=db.prepare('SELECT * FROM growth_content_briefs WHERE workspace_id=? AND idempotency_key=?').get(ws(),n.idempotencyKey);
    if(old) { if(old.payload_hash!==h) fail('CONTENT_IDEMPOTENCY_CONFLICT',409); return {brief:old,duplicate:true}; }
    const c=current(n.contextVersionId,actor);
    const e=db.prepare('SELECT * FROM experiments WHERE workspace_id=? AND id=?').get(ws(),n.experimentId);
    if(!e||e.goal_contract_version!==1||e.goal_context_version_id!==n.contextVersionId||e.goal_ref!==n.goalRef) fail('CONTENT_EXPERIMENT_MISMATCH');
    if(!/^\/strategy\/goals\/(0|[1-9]\d*)$/.test(n.goalRef)||typeof c.context.strategy?.goals?.[Number(n.goalRef.split('/').at(-1))]!=='string') fail('CONTENT_GOAL_INVALID');
    if(n.offer && c.context.offerings?.[n.offer.index]==null) fail('CONTENT_OFFER_INVALID');
    if(!c.sourceVersionReferences?.brandBook?.id) fail('CONTENT_BRAND_PROVENANCE_REQUIRED');
    let version=1;
    if(n.predecessorId) { const p=brief(n.predecessorId); if(!p||p.experiment_id!==n.experimentId||p.goal_context_version_id!==n.contextVersionId||p.goal_ref!==n.goalRef) fail('CONTENT_PREDECESSOR_INVALID'); version=p.version+1; if(db.prepare('SELECT id FROM growth_content_briefs WHERE predecessor_id=?').get(p.id)) fail('CONTENT_SUCCESSOR_CONFLICT',409); }
    const id=randomUUID();
    db.prepare('INSERT INTO growth_content_briefs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,ws(),n.experimentId,n.contextVersionId,n.goalRef,version,n.predecessorId,JSON.stringify(n),JSON.stringify(c.sourceVersionReferences),actor.userId,at(),h,n.idempotencyKey);
    return {brief:brief(id),duplicate:false};
  });
  const reserve=db.transaction((id,input,actor)=>{
    authorize(actor,true); fields(input,['idempotencyKey','predecessorId','body']);
    const key=text(input.idempotencyKey),predecessorId=input.predecessorId==null?null:text(input.predecessorId);
    const body=input.body==null?null:text(input.body,12000);
    if(body && !predecessorId) fail('CONTENT_REVISION_REQUIRED');
    const b=brief(id); if(!b) fail('CONTENT_BRIEF_NOT_FOUND',404);
    const request={briefId:id,predecessorId,body};
    const old=db.prepare('SELECT * FROM growth_content_candidates WHERE workspace_id=? AND idempotency_key=?').get(ws(),key);
    if(old) {
      if(JSON.stringify(JSON.parse(old.input_json).request)!==JSON.stringify(request)) fail('CONTENT_IDEMPOTENCY_CONFLICT',409);
      if(old.state==='PENDING' && Date.parse(at())-Date.parse(old.created_at)>40000) {
        db.prepare("UPDATE growth_content_candidates SET state='RECONCILIATION_REQUIRED',validation_code='PROVIDER_OUTCOME_UNKNOWN',updated_at=? WHERE id=? AND workspace_id=?").run(at(),old.id,ws());
      }
      return {candidate:candidate(old.id),duplicate:true};
    }
    const c=current(b.goal_context_version_id,actor);
    if(predecessorId) {const p=candidate(predecessorId);if(!p||p.brief_id!==id||!['VALIDATED','APPROVED','REJECTED'].includes(p.state))fail('CONTENT_PREDECESSOR_INVALID');if(db.prepare('SELECT id FROM growth_content_candidates WHERE predecessor_id=?').get(predecessorId))fail('CONTENT_SUCCESSOR_CONFLICT',409);}
    if(db.prepare('SELECT count(*) AS n FROM growth_content_candidates WHERE workspace_id=? AND brief_id=?').get(ws(),id).n>=10)fail('CONTENT_CANDIDATE_LIMIT',409);
    if(db.prepare("SELECT id FROM growth_content_candidates WHERE workspace_id=? AND brief_id=? AND state IN('PENDING','RECONCILIATION_REQUIRED') LIMIT 1").get(ws(),id))fail('CONTENT_RECONCILIATION_REQUIRED',409);
    const n=JSON.parse(b.contract_json);
    // Explicit bounded projection, never serialize the entire tenant/context history.
    const bounded=v=>typeof v==='string'?v.slice(0,1000):null;
    const projection={businessName:bounded(c.context.identity?.businessName),tone:bounded(c.context.brand?.tone),voice:bounded(c.context.brand?.voice),principles:(c.context.brand?.messagingPrinciples??[]).slice(0,5).map(bounded)};
    const parameters={type:'content',topic:JSON.stringify({audience:n.audience,message:n.message,constraints:n.constraints,offer:n.offer?c.context.offerings[n.offer.index]:null,brand:projection}),goal:n.message,contentType:n.contentType,maxTokens:1000,temperature:0.7};
    if(parameters.topic.length>8000)fail('CONTENT_INPUT_TOO_LARGE');
    const normalized={request,parameters,briefHash:b.payload_hash,provenance:JSON.parse(b.provenance_json)};
    const cid=randomUUID(),time=at();
    db.prepare("INSERT INTO growth_content_candidates(id,workspace_id,brief_id,predecessor_id,input_hash,input_json,idempotency_key,created_by,created_at,updated_at,state) VALUES(?,?,?,?,?,?,?,?,?,?,'PENDING')").run(cid,ws(),id,predecessorId,hash(normalized),JSON.stringify(normalized),key,actor.userId,time,time);
    return {candidate:candidate(cid),duplicate:false,parameters,body};
  });
  const finish=db.transaction((id,result)=>{
    const c=candidate(id);if(!c||c.state!=='PENDING')fail('CONTENT_TRANSITION_CONFLICT',409);
    db.prepare('UPDATE growth_content_candidates SET state=?,body=?,provider=?,model=?,usage_json=?,validation_code=?,updated_at=? WHERE id=? AND workspace_id=?').run(result.state,result.body??null,result.provider??null,result.model??null,result.usage?JSON.stringify(result.usage):null,result.code,at(),id,ws());
    return candidate(id);
  });
  const decide=db.transaction((id,input,actor)=>{
    authorize(actor,true);fields(input,['decision']);if(!['APPROVED','REJECTED'].includes(input.decision))fail('CONTENT_DECISION_INVALID');
    const c=candidate(id);if(!c)fail('CONTENT_CANDIDATE_NOT_FOUND',404);
    if(c.state===input.decision && c.decided_by===actor.userId)return c;
    if(c.state!=='VALIDATED')fail('CONTENT_TRANSITION_CONFLICT',409);
    const time=at();db.prepare('UPDATE growth_content_candidates SET state=?,decided_by=?,decided_at=?,updated_at=? WHERE id=? AND workspace_id=?').run(input.decision,actor.userId,time,time,id,ws());return candidate(id);
  });
  return Object.freeze({
    createBrief:(n,a)=>createBrief.immediate(n,a),reserve:(id,n,a)=>reserve.immediate(id,n,a),finish:(id,r)=>finish.immediate(id,r),decide:(id,n,a)=>decide.immediate(id,n,a),
    getBrief(id,a){authorize(a);return brief(id);},getCandidate(id,a){authorize(a);return candidate(id);},
    listBriefs(experimentId,p,a){authorize(a);const {page,pageSize}=pageInput(p);return db.prepare('SELECT * FROM growth_content_briefs WHERE workspace_id=? AND experiment_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').all(ws(),experimentId,pageSize,(page-1)*pageSize);},
    listCandidates(briefId,p,a){authorize(a);const {page,pageSize}=pageInput(p);return db.prepare('SELECT * FROM growth_content_candidates WHERE workspace_id=? AND brief_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').all(ws(),briefId,pageSize,(page-1)*pageSize);},
    listOperationalState(a,limit=25){authorize(a);const rows=db.prepare(`WITH ranked AS (
      SELECT id,state,ROW_NUMBER() OVER(PARTITION BY state ORDER BY created_at DESC,id DESC) AS position
      FROM growth_content_candidates WHERE workspace_id=? AND state IN('PENDING','RECONCILIATION_REQUIRED'))
      SELECT id,state,position FROM ranked WHERE position<=? ORDER BY state,position`).all(ws(),limit+1);
      const select=state=>{const matches=rows.filter(row=>row.state===state);return{ids:matches.slice(0,limit).map(row=>row.id),truncated:matches.length>limit};};
      return{pending:select('PENDING'),reconciliationRequired:select('RECONCILIATION_REQUIRED')};},
  });
}
