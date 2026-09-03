import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const now=()=>new Date().toISOString();
const parse=(v)=>v?JSON.parse(v):null;
const ALLOWED=new Set(["proposed","drafted","approved","rejected","executing","succeeded","failed","evaluated"]);
const NEXT={proposed:new Set(["drafted","rejected"]),drafted:new Set(["approved","rejected"]),approved:new Set(["executing"]),rejected:new Set([]),executing:new Set(["succeeded","failed"]),succeeded:new Set(["evaluated"]),failed:new Set(["approved","evaluated"]),evaluated:new Set([])};
export class LoadderActionLedgerError extends Error{constructor(message,code="LOADDER_ACTION_LEDGER_FAILED"){super(message);this.code=code;this.name="LoadderActionLedgerError";}}
export class LoadderActionLedger{
  constructor(db){this.db=db;}
  create({projectId,versionId,actionKey,actionType,payload={},idempotencyKey,actorId=null,status="proposed"}){
    if(!idempotencyKey)throw new LoadderActionLedgerError("Idempotency key is required.","LOADDER_IDEMPOTENCY_REQUIRED");if(!ALLOWED.has(status))throw new LoadderActionLedgerError("Invalid action status.");
    const workspaceId=requireWorkspaceId();const existing=this.db.prepare("SELECT * FROM business_builder_action_ledger WHERE workspace_id=? AND idempotency_key=?").get(workspaceId,idempotencyKey);if(existing)return this.map(existing);
    const id=crypto.randomUUID(),ts=now();this.db.prepare("INSERT INTO business_builder_action_ledger (id,workspace_id,project_id,version_id,action_key,action_type,status,idempotency_key,payload_json,result_json,actor_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,workspaceId,projectId,versionId,actionKey,actionType,status,idempotencyKey,JSON.stringify(payload),null,actorId,ts,ts);return this.get(id);
  }
  get(id){const r=this.db.prepare("SELECT * FROM business_builder_action_ledger WHERE workspace_id=? AND id=?").get(requireWorkspaceId(),id);return r?this.map(r):null;}
  list({projectId,status,limit=100}={}){const args=[requireWorkspaceId()];let sql="SELECT * FROM business_builder_action_ledger WHERE workspace_id=?";if(projectId){sql+=" AND project_id=?";args.push(projectId)}if(status){sql+=" AND status=?";args.push(status)}sql+=" ORDER BY updated_at DESC LIMIT ?";args.push(Math.min(Math.max(Number(limit)||100,1),200));return this.db.prepare(sql).all(...args).map(r=>this.map(r));}
  transition(id,status,{actorId=null,result=null}={}){if(!ALLOWED.has(status))throw new LoadderActionLedgerError("Invalid action status.");const current=this.get(id);if(!current)throw new LoadderActionLedgerError("Action not found.","LOADDER_ACTION_NOT_FOUND");if(!NEXT[current.status]?.has(status))throw new LoadderActionLedgerError(`Invalid transition ${current.status} -> ${status}.`,"LOADDER_ACTION_TRANSITION_INVALID");this.db.prepare("UPDATE business_builder_action_ledger SET status=?,result_json=?,actor_id=COALESCE(?,actor_id),updated_at=? WHERE workspace_id=? AND id=?").run(status,result===null?JSON.stringify(current.result):JSON.stringify(result),actorId,now(),requireWorkspaceId(),id);return this.get(id);}
  map(r){return{id:r.id,projectId:r.project_id,versionId:r.version_id,actionKey:r.action_key,actionType:r.action_type,status:r.status,idempotencyKey:r.idempotency_key,payload:parse(r.payload_json),result:parse(r.result_json),actorId:r.actor_id,createdAt:r.created_at,updatedAt:r.updated_at};}
}
export { ALLOWED as ACTION_STATUSES, NEXT as ACTION_TRANSITIONS };
