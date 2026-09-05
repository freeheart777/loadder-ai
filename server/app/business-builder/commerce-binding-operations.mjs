import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const now=()=>new Date().toISOString();
const cleanReason=(value)=>{const reason=String(value||"").trim();return reason?reason.slice(0,500):null;};

export class CommerceBindingOperations{
  constructor(db){this.db=db;}

  targets({limit=100}={}){
    const workspaceId=requireWorkspaceId(),bounded=Math.min(Math.max(Number(limit)||100,1),200);
    return this.db.prepare(`SELECT id,name,status,active_version_id,updated_at FROM business_builder_projects WHERE workspace_id=? AND status<>'archived' ORDER BY CASE WHEN active_version_id IS NOT NULL THEN 0 ELSE 1 END,updated_at DESC LIMIT ?`).all(workspaceId,bounded).map(row=>({id:row.id,name:row.name,status:row.status,activeVersionId:row.active_version_id||null,eligible:Boolean(row.active_version_id)}));
  }

  getStore(siteProjectId){
    return this.db.prepare("SELECT id,name,slug,status,site_type FROM site_projects WHERE id=? AND workspace_id=?").get(siteProjectId,requireWorkspaceId())||null;
  }

  getBinding(siteProjectId){
    return this.db.prepare("SELECT * FROM business_builder_commerce_bindings WHERE workspace_id=? AND site_project_id=?").get(requireWorkspaceId(),siteProjectId)||null;
  }

  setBinding(siteProjectId,{projectId,actorId=null,reason=null,confirmRebind=false}={}){
    const workspaceId=requireWorkspaceId(),store=this.getStore(siteProjectId);
    if(!store||store.site_type!=="STORE")return{ok:false,code:"COMMERCE_STORE_NOT_FOUND"};
    const project=this.db.prepare("SELECT id,name,status,active_version_id FROM business_builder_projects WHERE id=? AND workspace_id=?").get(projectId,workspaceId)||null;
    if(!project)return{ok:false,code:"COMMERCE_BINDING_TARGET_NOT_FOUND"};
    if(project.status==="archived")return{ok:false,code:"COMMERCE_BINDING_TARGET_ARCHIVED"};
    if(!project.active_version_id)return{ok:false,code:"COMMERCE_BINDING_TARGET_NOT_RUNNABLE"};

    const existing=this.getBinding(siteProjectId),targetChanged=Boolean(existing&&existing.business_builder_project_id!==project.id),normalizedReason=cleanReason(reason);
    if(targetChanged&&!confirmRebind)return{ok:false,code:"COMMERCE_BINDING_REBIND_CONFIRMATION_REQUIRED",binding:existing};
    if(targetChanged&&actorId&&!normalizedReason)return{ok:false,code:"COMMERCE_BINDING_REBIND_REASON_REQUIRED",binding:existing};
    if(existing?.status==="active"&&!targetChanged)return{ok:true,changed:false,code:"COMMERCE_BINDING_ALREADY_ACTIVE",binding:existing};

    const at=now(),action=!existing?"commerce_binding.create":targetChanged?"commerce_binding.rebind":"commerce_binding.enable";
    const run=this.db.transaction(()=>{
      let bindingId=existing?.id||crypto.randomUUID();
      if(existing){
        const result=this.db.prepare("UPDATE business_builder_commerce_bindings SET business_builder_project_id=?,status='active',updated_at=? WHERE id=? AND workspace_id=? AND site_project_id=?").run(project.id,at,existing.id,workspaceId,siteProjectId);
        if(result.changes!==1)throw new Error("commerce binding update lost race");
      }else{
        this.db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(bindingId,workspaceId,siteProjectId,project.id,"active",actorId,at,at);
      }
      const updated=this.getBinding(siteProjectId);
      if(actorId){
        this.db.prepare("INSERT INTO audit_logs(id,workspace_id,user_id,action,resource_type,resource_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)").run(crypto.randomUUID(),workspaceId,actorId,action,"business_builder_commerce_binding",updated.id,JSON.stringify({siteProjectId,storeName:store.name,fromProjectId:existing?.business_builder_project_id||null,toProjectId:project.id,fromStatus:existing?.status||null,toStatus:"active",reason:normalizedReason}),at);
      }
      return updated;
    });
    return{ok:true,changed:true,action,binding:run(),target:{id:project.id,name:project.name,status:project.status,activeVersionId:project.active_version_id}};
  }
}
