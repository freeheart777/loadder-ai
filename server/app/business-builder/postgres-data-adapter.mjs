import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { LoadderDataAdapter } from "./data-adapter.mjs";

const now=()=>new Date().toISOString();
const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(Math.max(Math.trunc(n),min),max):fallback;};
const rowToRecord=(r)=>r?({id:r.id,...(typeof r.data_json==="string"?JSON.parse(r.data_json):r.data_json),createdAt:r.created_at,updatedAt:r.updated_at}):null;

export class LoadderPostgresDataAdapter extends LoadderDataAdapter {
  constructor(client){super();if(!client||typeof client.query!=="function")throw new Error("PostgreSQL client must implement query(text, values)");this.client=client;}
  async list({appId,entityId,query}){const workspaceId=requireWorkspaceId(),limit=clamp(query?.limit,1,100,25),offset=clamp(query?.offset,0,1000000,0),q=String(query?.q||"").trim();const values=[workspaceId,appId,entityId];let where="workspace_id=$1 AND app_id=$2 AND entity_id=$3";if(q){values.push(`%${q}%`);where+=" AND data_json::text ILIKE $4";}values.push(limit,offset);const li=values.length-1,oi=values.length;const r=await this.client.query(`SELECT id,data_json,created_at,updated_at FROM business_builder_runtime_records WHERE ${where} ORDER BY updated_at DESC LIMIT $${li} OFFSET $${oi}`,values);return (r.rows||[]).map(rowToRecord);}
  async count({appId,entityId,query}){const workspaceId=requireWorkspaceId(),q=String(query?.q||"").trim(),values=[workspaceId,appId,entityId];let where="workspace_id=$1 AND app_id=$2 AND entity_id=$3";if(q){values.push(`%${q}%`);where+=" AND data_json::text ILIKE $4";}const r=await this.client.query(`SELECT COUNT(*)::bigint AS total FROM business_builder_runtime_records WHERE ${where}`,values);return Number(r.rows?.[0]?.total||0);}
  async get({appId,entityId,recordId}){const r=await this.client.query("SELECT id,data_json,created_at,updated_at FROM business_builder_runtime_records WHERE workspace_id=$1 AND app_id=$2 AND entity_id=$3 AND id=$4",[requireWorkspaceId(),appId,entityId,recordId]);return rowToRecord(r.rows?.[0]);}
  async create({appId,entityId,payload}){const id=crypto.randomUUID(),ts=now();const r=await this.client.query("INSERT INTO business_builder_runtime_records (id,workspace_id,app_id,entity_id,data_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$6) RETURNING id,data_json,created_at,updated_at",[id,requireWorkspaceId(),appId,entityId,JSON.stringify(payload),ts]);return rowToRecord(r.rows?.[0]);}
  async update({appId,entityId,recordId,payload}){const current=await this.get({appId,entityId,recordId});if(!current)return null;const{id,createdAt,updatedAt,...data}=current,merged={...data,...payload};const r=await this.client.query("UPDATE business_builder_runtime_records SET data_json=$1::jsonb,updated_at=$2 WHERE workspace_id=$3 AND app_id=$4 AND entity_id=$5 AND id=$6 RETURNING id,data_json,created_at,updated_at",[JSON.stringify(merged),now(),requireWorkspaceId(),appId,entityId,recordId]);return rowToRecord(r.rows?.[0]);}
  async delete({appId,entityId,recordId}){const r=await this.client.query("DELETE FROM business_builder_runtime_records WHERE workspace_id=$1 AND app_id=$2 AND entity_id=$3 AND id=$4",[requireWorkspaceId(),appId,entityId,recordId]);return{deleted:Number(r.rowCount||0)===1,id:recordId};}
}
