import express from "express";
import { ModelEvaluationError } from "../services/model-evaluation-service.mjs";
export function createModelEvaluationRouter({service}){const router=express.Router();
  const handle=(error,res)=>{if(error instanceof ModelEvaluationError)return res.status(error.status).json({success:false,message:error.message,code:error.code});console.error("Model evaluation error:",error);return res.status(500).json({success:false,message:"Unable to process model input or evaluation."});};
  router.get("/model-specifications",(req,res)=>res.json({success:true,specifications:service.listSpecifications()}));
  router.post("/model-inputs/build",(req,res)=>{try{const result=service.buildInput(req.body||{},req.user?.id);return res.status(result.snapshot?201:409).json({success:result.state==="READY",...result});}catch(error){return handle(error,res);}});
  router.get("/model-inputs",(req,res)=>{try{return res.json({success:true,snapshots:service.listInputs(req.query)});}catch(error){return handle(error,res);}});
  router.get("/model-inputs/:id",(req,res)=>{try{return res.json({success:true,snapshot:service.getInput(req.params.id)});}catch(error){return handle(error,res);}});
  router.post("/evaluations/run",(req,res)=>{try{return res.status(201).json({success:true,evaluation:service.runEvaluation(req.body||{})});}catch(error){return handle(error,res);}});
  router.get("/evaluations",(req,res)=>{try{return res.json({success:true,evaluations:service.listEvaluations(req.query)});}catch(error){return handle(error,res);}});
  router.get("/evaluations/:id",(req,res)=>{try{return res.json({success:true,evaluation:service.getEvaluation(req.params.id)});}catch(error){return handle(error,res);}});return router;}
