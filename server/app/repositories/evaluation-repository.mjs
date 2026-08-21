import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
function json(v,f){try{return JSON.parse(v);}catch{return f;}}
function map(row){return row?{id:row.id,specificationId:row.specification_id,specificationVersion:row.specification_version,
  inputSnapshotId:row.input_snapshot_id,contextVersionId:row.context_version_id,evaluatorId:row.evaluator_id,
  evaluatorVersion:row.evaluator_version,evaluationSchemaVersion:row.evaluation_schema_version,status:row.status,
  output:json(row.output_json,{}),metrics:json(row.metrics_json,{}),provenance:json(row.provenance_json,{}),
  evaluatedAt:row.evaluated_at,createdAt:row.created_at}:null;}
export function createEvaluationRepository(db){
  const getById=(id)=>map(db.prepare("SELECT * FROM evaluations WHERE id=? AND workspace_id=?").get(id,requireWorkspaceId()));
  const getByKey=(e,v,k)=>map(db.prepare("SELECT * FROM evaluations WHERE workspace_id=? AND evaluator_id=? AND evaluator_version=? AND producer_key=?").get(requireWorkspaceId(),e,v,k));
  function create(input){const existing=getByKey(input.evaluatorId,input.evaluatorVersion,input.producerKey);if(existing)return existing;const id=crypto.randomUUID();
    try{db.prepare(`INSERT INTO evaluations (id,workspace_id,specification_id,specification_version,input_snapshot_id,
      context_version_id,evaluator_id,evaluator_version,evaluation_schema_version,status,output_json,metrics_json,
      provenance_json,producer_key,evaluated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,requireWorkspaceId(),input.specificationId,input.specificationVersion,input.inputSnapshotId,input.contextVersionId,
      input.evaluatorId,input.evaluatorVersion,input.evaluationSchemaVersion,"completed",JSON.stringify(input.output),
      JSON.stringify(input.metrics),JSON.stringify(input.provenance),input.producerKey,input.evaluatedAt,input.createdAt);return getById(id);
    }catch(error){const concurrent=getByKey(input.evaluatorId,input.evaluatorVersion,input.producerKey);if(concurrent&&String(error.code||"").startsWith("SQLITE_CONSTRAINT"))return concurrent;throw error;}}
  function list({specificationId,inputSnapshotId,limit}){const clauses=["workspace_id=?"],values=[requireWorkspaceId()];for(const [c,v] of [["specification_id",specificationId],["input_snapshot_id",inputSnapshotId]])if(v){clauses.push(`${c}=?`);values.push(v);}values.push(limit);return db.prepare(`SELECT * FROM evaluations WHERE ${clauses.join(" AND ")} ORDER BY evaluated_at DESC LIMIT ?`).all(...values).map(map);}
  return{create,getById,list};
}
