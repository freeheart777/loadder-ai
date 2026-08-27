import express from "express";
import { HumanGovernanceError } from "../services/human-governance-service.mjs";
import { createExperimentRepository } from "../repositories/experiment-repository.mjs";
import { createExperimentRunRepository } from "../repositories/experiment-run-repository.mjs";
import { createExperimentRunService, ExperimentRunError } from "../services/experiment-run-service.mjs";
import { createExperimentExecutionService, ExperimentExecutionError } from "../experiments/experiment-execution-service.mjs";
import { createOpenAICompatibleProvider } from "../experiments/providers/openai-compatible-provider.mjs";
import { db } from "../../db/workspace-database.mjs";

export function createHumanGovernanceRouter({service, experimentRunService: injectedExperimentRunService}){
  const router=express.Router(),actor=req=>({userId:req.user.id,membershipId:req.membership.id,role:req.membership.role});
  const handle=(error,res)=>error instanceof HumanGovernanceError?res.status(error.status).json({success:false,code:error.code,message:error.message}):res.status(500).json({success:false,code:"HUMAN_GOVERNANCE_FAILED",message:"Human governance operation failed.",developmentDetail:process.env.NODE_ENV==="test"?error.message:undefined});
  const experimentRunService=injectedExperimentRunService||createExperimentRunService({repository:createExperimentRunRepository(db)});
  const handleRun=(error,res)=>error instanceof ExperimentRunError?res.status(error.status).json({success:false,code:error.code,message:error.message}):res.status(500).json({success:false,code:"EXPERIMENT_RUN_FAILED",message:"Experiment run operation failed.",developmentDetail:process.env.NODE_ENV==="test"?error.message:undefined});
  const handleExecution=(error,res)=>error instanceof ExperimentExecutionError?res.status(error.status).json({success:false,code:error.code,message:error.message}):res.status(500).json({success:false,code:"EXPERIMENT_EXECUTION_FAILED",message:"Experiment execution failed.",developmentDetail:process.env.NODE_ENV==="test"?error.message:undefined});
  const createExecutionService=()=>{
    if(!process.env.OPENAI_API_KEY)return null;
    const provider=createOpenAICompatibleProvider({
      apiKey:process.env.OPENAI_API_KEY,
      baseUrl:process.env.OPENAI_BASE_URL||"https://api.openai.com/v1",
      model:process.env.OPENAI_EXPERIMENT_MODEL||process.env.OPENAI_BUSINESS_BRAIN_MODEL||"gpt-5.6-terra",
    });
    return createExperimentExecutionService({
      experimentRepository:createExperimentRepository(db),
      runService:experimentRunService,
      executor:provider,
    });
  };

  router.post("/intelligence/recommendations/:id/reviews",(req,res)=>{try{const result=service.createReview(req.params.id,req.body||{},actor(req),req.headers["idempotency-key"]);return res.status(result.created?201:200).json({success:true,review:result.review,reusedResult:result.reusedResult});}catch(error){return handle(error,res);}});
  router.get("/intelligence/recommendations/:id/reviews",(req,res)=>{try{const page=service.listReviews(req.params.id,req.query);return res.json({success:true,reviews:page.items,nextCursor:page.nextCursor});}catch(error){return handle(error,res);}});
  router.post("/intelligence/recommendations/:id/decisions",(req,res)=>{try{const result=service.createDecision(req.params.id,req.body||{},actor(req),req.headers["idempotency-key"]);return res.status(result.created?201:200).json({success:true,decision:result.decision,reusedResult:result.reusedResult});}catch(error){return handle(error,res);}});
  router.get("/intelligence/recommendations/:id/decisions",(req,res)=>{try{const page=service.listDecisions(req.params.id,req.query);return res.json({success:true,decisions:page.items,nextCursor:page.nextCursor});}catch(error){return handle(error,res);}});

  router.post("/experiments/:experimentId/runs",(req,res)=>{try{const run=experimentRunService.create({experimentId:req.params.experimentId,contextVersionId:req.body?.contextVersionId});return res.status(201).json({success:true,run});}catch(error){return handleRun(error,res);}});
  router.get("/experiments/:experimentId/runs",(req,res)=>{try{const page=experimentRunService.list({experimentId:req.params.experimentId,status:req.query.status,limit:req.query.limit});return res.json({success:true,runs:page.items,nextCursor:page.nextCursor});}catch(error){return handleRun(error,res);}});
  router.post("/experiment-runs/:id/start",(req,res)=>{try{return res.json({success:true,run:experimentRunService.start(req.params.id,{contextVersionId:req.body?.contextVersionId})});}catch(error){return handleRun(error,res);}});
  router.post("/experiment-runs/:id/complete",(req,res)=>{try{return res.json({success:true,run:experimentRunService.complete(req.params.id,{contextVersionId:req.body?.contextVersionId,outcome:req.body?.outcome})});}catch(error){return handleRun(error,res);}});
  router.post("/experiment-runs/:id/fail",(req,res)=>{try{return res.json({success:true,run:experimentRunService.fail(req.params.id,{contextVersionId:req.body?.contextVersionId,outcome:req.body?.outcome})});}catch(error){return handleRun(error,res);}});
  router.post("/experiment-runs/:id/cancel",(req,res)=>{try{return res.json({success:true,run:experimentRunService.cancel(req.params.id,{contextVersionId:req.body?.contextVersionId,outcome:req.body?.outcome})});}catch(error){return handleRun(error,res);}});

  router.post("/experiments/:experimentId/execute",async(req,res)=>{
    try{
      const executionService=createExecutionService();
      if(!executionService)return res.status(501).json({success:false,code:"EXPERIMENT_EXECUTOR_NOT_CONFIGURED",message:"OPENAI_API_KEY is required for automatic experiment execution."});
      const result=await executionService.execute(req.params.experimentId,{input:req.body?.input??req.body?.prompt??{}});
      return res.status(result.run.status==="COMPLETED"?200:502).json({success:result.run.status==="COMPLETED",...result});
    }catch(error){return handleExecution(error,res);}
  });

  return router;
}