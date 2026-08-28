import express from "express";
import { IntegrationError } from "../services/integration-service.mjs";
import { db } from "../../db/workspace-database.mjs";
import { createSiteProjectRepository } from "../repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../services/site-project-service.mjs";
import { createSupabaseStorageService, SiteStorageError } from "../storage/supabase-storage-service.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";

const siteRepository = createSiteProjectRepository(db);
const siteContext = {
  getCurrent() {
    const workspaceId = requireWorkspaceId();
    const row = db.prepare("SELECT id,status,snapshot_json FROM business_context_versions WHERE workspace_id=? AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1").get(workspaceId);
    return row ? { activeContext: { id: row.id, status: row.status, snapshot: JSON.parse(row.snapshot_json || "{}") }, isStale: false } : { activeContext: null, isStale: false };
  },
};
const siteService = createSiteProjectService({ repository: siteRepository, businessContextService: siteContext });
const siteStorage = createSupabaseStorageService();

export function createIntegrationRouter({ service }) {
  const r = express.Router();
  const h = (e, s) => e instanceof IntegrationError || e instanceof SiteStorageError || e?.code?.startsWith?.("SITE_") || e?.code?.startsWith?.("BUSINESS_CONTEXT_") ? s.status(e.status || 400).json({ success: false, code: e.code, message: e.message }) : s.status(500).json({ success: false, message: "Integration operation failed." });
  r.get("/connector-definitions", (q,s)=>{try{return s.json({success:true,connectors:service.definitions(q.query.region)});}catch(e){return h(e,s);}});
  r.post("/connections", (q,s)=>{try{return s.status(201).json({success:true,connection:service.createConnection(q.body||{},q.user.id)});}catch(e){return h(e,s);}});
  r.get("/connections", (q,s)=>s.json({success:true,connections:service.connections()}));
  r.get("/connections/:id", (q,s)=>{try{return s.json({success:true,connection:service.connection(q.params.id)});}catch(e){return h(e,s);}});
  r.post("/imports", (q,s)=>{try{return s.status(201).json({success:true,...service.import(q.body||{},q.user.id)});}catch(e){return h(e,s);}});
  r.get("/imports", (q,s)=>s.json({success:true,batches:service.batches()}));
  r.get("/imports/:id", (q,s)=>{try{return s.json({success:true,...service.batch(q.params.id)});}catch(e){return h(e,s);}});

  r.get("/site-projects", (q,s)=>{try{return s.json({success:true,projects:siteService.list()});}catch(e){return h(e,s);}});
  r.post("/site-projects", (q,s)=>{try{return s.status(201).json({success:true,project:siteService.create(q.body||{})});}catch(e){return h(e,s);}});
  r.get("/site-projects/:id", (q,s)=>{try{return s.json({success:true,project:siteService.get(q.params.id),assets:siteService.assets(q.params.id)});}catch(e){return h(e,s);}});
  r.patch("/site-projects/:id", (q,s)=>{try{return s.json({success:true,project:siteService.update(q.params.id,q.body||{})});}catch(e){return h(e,s);}});
  r.post("/site-projects/:id/publish", (q,s)=>{try{return s.json({success:true,project:siteService.publish(q.params.id)});}catch(e){return h(e,s);}});
  r.delete("/site-projects/:id", (q,s)=>{try{siteService.remove(q.params.id);return s.json({success:true});}catch(e){return h(e,s);}});
  r.post("/site-projects/:id/assets", (q,s)=>{try{return s.status(201).json({success:true,asset:siteService.addAsset(q.params.id,q.body||{})});}catch(e){return h(e,s);}});
  r.delete("/site-projects/:id/assets/:assetId", (q,s)=>{try{siteService.removeAsset(q.params.id,q.params.assetId);return s.json({success:true});}catch(e){return h(e,s);}});

  r.post("/site-projects/:id/assets/upload-url", async (q,s)=>{try{
    const project=siteService.get(q.params.id); const body=q.body||{};
    const upload=await siteStorage.createUploadUrl({workspaceId:requireWorkspaceId(),siteProjectId:project.id,filename:body.filename,contentType:body.contentType,expiresIn:body.expiresIn});
    return s.status(201).json({success:true,upload});
  }catch(e){return h(e,s);}});

  r.post("/site-projects/:id/assets/download-url", async (q,s)=>{try{
    const project=siteService.get(q.params.id); const path=String(q.body?.path||"").trim();
    const prefix=`${requireWorkspaceId()}/${project.id}/`;
    if(!path.startsWith(prefix)) throw new SiteStorageError("Asset path is outside this site project.",403,"SITE_STORAGE_PATH_FORBIDDEN");
    return s.json({success:true,download:await siteStorage.createDownloadUrl({path,expiresIn:q.body?.expiresIn})});
  }catch(e){return h(e,s);}});

  return r;
}
