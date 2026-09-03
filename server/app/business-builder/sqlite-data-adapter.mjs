import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { LoadderDataAdapter } from "./data-adapter.mjs";

const now=()=>new Date().toISOString();
const parse=(v)=>JSON.parse(v);
export class LoadderSqliteDataAdapter extends LoadderDataAdapter {
  constructor(db){ super(); this.db=db; }
  async list({appId,entityId,query}){
    const limit=Math.min(Math.max(Number(query?.limit)||50,1),100);
    return this.db.prepare("SELECT id,data_json,created_at,updated_at FROM business_builder_runtime_records WHERE workspace_id=? AND app_id=? AND entity_id=? ORDER BY updated_at DESC LIMIT ?")
      .all(requireWorkspaceId(),appId,entityId,limit).map(r=>({id:r.id,...parse(r.data_json),createdAt:r.created_at,updatedAt:r.updated_at}));
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
