import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { LoadderDataAdapter } from "./data-adapter.mjs";

const now=()=>new Date().toISOString();
const parse=(v)=>JSON.parse(v);
const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(Math.max(Math.trunc(n),min),max):fallback;};
export class LoadderSqliteDataAdapter extends LoadderDataAdapter {
  constructor(db){ super(); this.db=db; }
  async list({appId,entityId,query}){
    const limit=clamp(query?.limit,1,100,25),offset=clamp(query?.offset,0,1000000,0),q=String(query?.q||"").trim();
    const workspaceId=requireWorkspaceId();
    if(q){
      const like=`%${q}%`;
      return this.db.prepare("SELECT id,data_json,created_at,updated_at FROM business_builder_runtime_records WHERE workspace_id=? AND app_id=? AND entity_id=? AND data_json LIKE ? ORDER BY updated_at DESC LIMIT ? OFFSET ?")
        .all(workspaceId,appId,entityId,like,limit,offset).map(r=>({id:r.id,...parse(r.data_json),createdAt:r.created_at,updatedAt:r.updated_at}));
    }
    return this.db.prepare("SELECT id,data_json,created_at,updated_at FROM business_builder_runtime_records WHERE workspace_id=? AND app_id=? AND entity_id=? ORDER BY updated_at DESC LIMIT ? OFFSET ?")
      .all(workspaceId,appId,entityId,limit,offset).map(r=>({id:r.id,...parse(r.data_json),createdAt:r.created_at,updatedAt:r.updated_at}));
  }
  async count({appId,entityId,query}){
    const workspaceId=requireWorkspaceId(),q=String(query?.q||"").trim();
    const row=q
      ?this.db.prepare("SELECT COUNT(*) total FROM business_builder_runtime_records WHERE workspace_id=? AND app_id=? AND entity_id=? AND data_json LIKE ?").get(workspaceId,appId,entityId,`%${q}%`)
      :this.db.prepare("SELECT COUNT(*) total FROM business_builder_runtime_records WHERE workspace_id=? AND app_id=? AND entity_id=?").get(workspaceId,appId,entityId);
    return Number(row?.total||0);
  }
  async get({appId,entityId,recordId}){
    const r=this.db.prepare("SELECT id,data_json,created_at,updated_at FROM business_builder_runtime_records WHERE workspace_id=? AND app_id=? AND entity_id=? AND id=?").get(requireWorkspaceId(),appId,entityId,recordId);
    return r?{id:r.id,...parse(r.data_json),createdAt:r.created_at,updatedAt:r.updated_at}:null;
  }
  async create({appId,entityId,payload}){
    const id=crypto.randomUUID(),ts=now();
    this.db.prepare("INSERT INTO business_builder_runtime_records (id,workspace_id,app_id,entity_id,data_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(id,requireWorkspaceId(),appId,entityId,JSON.stringify(payload),ts,ts);
    return this.get({appId,entityId,recordId:id});
  }
  async update({appId,entityId,recordId,payload}){
    const current=await this.get({appId,entityId,recordId}); if(!current) return null;
    const {id,createdAt,updatedAt,...data}=current; const merged={...data,...payload};
    this.db.prepare("UPDATE business_builder_runtime_records SET data_json=?,updated_at=? WHERE workspace_id=? AND app_id=? AND entity_id=? AND id=?")
      .run(JSON.stringify(merged),now(),requireWorkspaceId(),appId,entityId,recordId);
    return this.get({appId,entityId,recordId});
  }
  async delete({appId,entityId,recordId}){
    const result=this.db.prepare("DELETE FROM business_builder_runtime_records WHERE workspace_id=? AND app_id=? AND entity_id=? AND id=?").run(requireWorkspaceId(),appId,entityId,recordId);
    return {deleted:result.changes===1,id:recordId};
  }
}
