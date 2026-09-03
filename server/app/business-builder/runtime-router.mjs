import express from "express";
import { LoadderDataRuntime } from "./data-adapter.mjs";
import { LoadderSqliteDataAdapter } from "./sqlite-data-adapter.mjs";
import { LoadderWorkflowRuntime } from "./workflow-runtime.mjs";

export function createBusinessAppRuntimeRouter({ db, projects }) {
  const router = express.Router();
  const dataRuntime = new LoadderDataRuntime({ adapter: new LoadderSqliteDataAdapter(db) });
  const workflowRuntime = new LoadderWorkflowRuntime();

  function activeVersion(projectId){
    const project=projects.getProject(projectId);
    if(!project?.activeVersionId)return null;
    return project.versions.find(v=>v.id===project.activeVersionId)||null;
  }

  async function execute(req,res,action){
    try{
      const version=activeVersion(req.params.id);
      if(!version) return res.status(404).json({success:false,code:"ACTIVE_VERSION_NOT_FOUND"});
      const result=await dataRuntime.execute({definition:version.definition,action,entityId:req.params.entityId,recordId:req.params.recordId||null,payload:req.body||{},query:req.query||{}});
      if(action==="list")return res.json({success:true,records:result,result});
      if(action==="create")return res.status(201).json({success:true,record:result,result});
      return res.json({success:true,record:action==="delete"?undefined:result,result});
    }catch(error){return res.status(400).json({success:false,code:error?.code||"RUNTIME_DATA_FAILED",message:error?.message});}
  }

  router.get("/business-builder/projects/:id/data/:entityId",(req,res)=>execute(req,res,"list"));
  router.get("/business-builder/projects/:id/data/:entityId/:recordId",(req,res)=>execute(req,res,"get"));
  router.post("/business-builder/projects/:id/data/:entityId",(req,res)=>execute(req,res,"create"));
  router.patch("/business-builder/projects/:id/data/:entityId/:recordId",(req,res)=>execute(req,res,"update"));
  router.delete("/business-builder/projects/:id/data/:entityId/:recordId",(req,res)=>execute(req,res,"delete"));

  router.post("/business-builder/projects/:id/workflows/:workflowId/run",async(req,res)=>{
    try{
      const version=activeVersion(req.params.id);
      if(!version)return res.status(404).json({success:false,code:"ACTIVE_VERSION_NOT_FOUND"});
      const result=await workflowRuntime.execute({definition:version.definition,workflowId:req.params.workflowId,input:req.body||{},context:{projectId:req.params.id,userId:req.user?.id||null}});
      return res.status(201).json({success:true,result});
    }catch(error){return res.status(400).json({success:false,code:error?.code||"WORKFLOW_RUN_FAILED",message:error?.message});}
  });
  return router;
}
