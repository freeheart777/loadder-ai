import express from "express";
import { ExperimentAuthoringError } from "../growth/experiment-goal-contract.mjs";

export function createExperimentAuthoringRouter({ repository }) {
  const router=express.Router();
  router.use((req,res,next)=>req.user?.id && req.membership?.status==='active' ? next() : res.status(403).json({success:false,code:"EXPERIMENT_ACCESS_DENIED"}));
  const handle=(e,res)=>res.status(e instanceof ExperimentAuthoringError?e.status:500).json({success:false,code:e instanceof ExperimentAuthoringError?e.code:"EXPERIMENT_AUTHORING_FAILED"});
  router.post('/experiments',(req,res)=>{try{const result=repository.author(req.body,{userId:req.user.id});res.status(result.created?201:200).json({success:true,...result});}catch(e){handle(e,res);}});
  router.get('/experiments/:id',(req,res)=>{try{const experiment=repository.get(req.params.id);if(!experiment)return res.status(404).json({success:false,code:"EXPERIMENT_NOT_FOUND"});return res.json({success:true,experiment});}catch(e){handle(e,res);}});
  return router;
}
