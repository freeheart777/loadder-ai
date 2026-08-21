import express from "express";
import { HumanGovernanceError } from "../services/human-governance-service.mjs";

export function createHumanGovernanceRouter({service}){
  const router=express.Router(),actor=req=>({userId:req.user.id,membershipId:req.membership.id,role:req.membership.role});
  const handle=(error,res)=>error instanceof HumanGovernanceError?res.status(error.status).json({success:false,code:error.code,message:error.message}):res.status(500).json({success:false,code:"HUMAN_GOVERNANCE_FAILED",message:"Human governance operation failed.",developmentDetail:process.env.NODE_ENV==="test"?error.message:undefined});
  router.post("/intelligence/recommendations/:id/reviews",(req,res)=>{try{const result=service.createReview(req.params.id,req.body||{},actor(req),req.headers["idempotency-key"]);return res.status(result.created?201:200).json({success:true,review:result.review,reusedResult:result.reusedResult});}catch(error){return handle(error,res);}});
  router.get("/intelligence/recommendations/:id/reviews",(req,res)=>{try{const page=service.listReviews(req.params.id,req.query);return res.json({success:true,reviews:page.items,nextCursor:page.nextCursor});}catch(error){return handle(error,res);}});
  router.post("/intelligence/recommendations/:id/decisions",(req,res)=>{try{const result=service.createDecision(req.params.id,req.body||{},actor(req),req.headers["idempotency-key"]);return res.status(result.created?201:200).json({success:true,decision:result.decision,reusedResult:result.reusedResult});}catch(error){return handle(error,res);}});
  router.get("/intelligence/recommendations/:id/decisions",(req,res)=>{try{const page=service.listDecisions(req.params.id,req.query);return res.json({success:true,decisions:page.items,nextCursor:page.nextCursor});}catch(error){return handle(error,res);}});
  return router;
}
