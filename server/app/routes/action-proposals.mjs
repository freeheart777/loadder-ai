import express from "express";
import { ActionProposalError } from "../services/action-proposal-service.mjs";

export function createActionProposalRouter({service}){
  const router=express.Router();
  const actor=(request)=>({userId:request.user.id,membershipId:request.membership.id,role:request.membership.role});
  const handle=(error,response)=>error instanceof ActionProposalError
    ?response.status(error.status).json({success:false,code:error.code,message:error.message})
    :response.status(500).json({success:false,code:"ACTION_PROPOSAL_FAILED",message:"Action proposal operation failed.",developmentDetail:process.env.NODE_ENV==="test"?error.message:undefined});
  router.post("/intelligence/decisions/:id/action-proposals",(request,response)=>{
    try{const result=service.create(request.params.id,request.body||{},actor(request),request.headers["idempotency-key"]);return response.status(result.created?201:200).json({success:true,proposal:result.proposal,reusedResult:result.reusedResult});}
    catch(error){return handle(error,response);}
  });
  router.get("/execution/action-proposals",(request,response)=>{
    try{const page=service.list(request.query);return response.json({success:true,proposals:page.items,nextCursor:page.nextCursor});}
    catch(error){return handle(error,response);}
  });
  router.get("/execution/action-proposals/:id",(request,response)=>{
    try{return response.json({success:true,proposal:service.get(request.params.id)});}
    catch(error){return handle(error,response);}
  });
  return router;
}
