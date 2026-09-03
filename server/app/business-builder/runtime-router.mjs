import express from "express";
import { LoadderDataRuntime } from "./data-adapter.mjs";
import { LoadderSqliteDataAdapter } from "./sqlite-data-adapter.mjs";

export function createBusinessAppRuntimeRouter({ db, projects }) {
  const router = express.Router();
  const runtime = new LoadderDataRuntime({ adapter: new LoadderSqliteDataAdapter(db) });

  async function execute(req,res,action){
    try{
      const project=projects.getProject(req.params.id);
      if(!project?.activeVersionId) return res.status(404).json({success:false,code:"ACTIVE_VERSION_NOT_FOUND"});
      const version=project.versions.find(v=>v.id===project.activeVersionId);
      const result=await runtime.execute({definition:version.definition,action,entityId:req.params.entityId,recordId:req.params.recordId||null,payload:req.body||{},query:req.query||{}});
      return res.json({success:true,result});
    }catch(error){return res.status(400).json({success:false,code:error?.code||"RUNTIME_DATA_FAILED",message:error?.message});}
  }

  router.get("/business-builder/projects/:id/data/:entityId",(req,res)=>execute(req,res,"list"));
  router.get("/business-builder/projects/:id/data/:entityId/:recordId",(req,res)=>execute(req,res,"get"));
  router.post("/business-builder/projects/:id/data/:entityId",(req,res)=>execute(req,res,"create"));
  router.patch("/business-builder/projects/:id/data/:entityId/:recordId",(req,res)=>execute(req,res,"update"));
  router.delete("/business-builder/projects/:id/data/:entityId/:recordId",(req,res)=>execute(req,res,"delete"));
  return router;
}
