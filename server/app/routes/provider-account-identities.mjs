import express from "express";
import { ProviderAccountIdentityError } from "../services/provider-account-identity-service.mjs";

export function createProviderAccountIdentityRouter({service}) {
 const router=express.Router(),actor=(req)=>({userId:req.user.id,membershipId:req.membership.id,role:req.membership.role}),handle=(error,res)=>error instanceof ProviderAccountIdentityError?res.status(error.status).json({success:false,code:error.code,message:error.message}):res.status(500).json({success:false,code:"PROVIDER_IDENTITY_FAILED",message:"Provider identity operation failed."});
 router.post("/integrations/connections/:connectionId/account-identities/verify",(req,res)=>{try{const result=service.verify(req.params.connectionId,req.body||{},actor(req),req.headers["idempotency-key"],{signal:req.signal});return res.status(result.created?201:200).json({success:true,identity:result.identity,reusedResult:result.reusedResult,accountChanged:result.accountChanged});}catch(error){return handle(error,res);}});
 router.get("/integrations/connections/:connectionId/account-identities",(req,res)=>{try{const page=service.list(req.params.connectionId,req.query);return res.json({success:true,identities:page.items,nextCursor:page.nextCursor});}catch(error){return handle(error,res);}});
 router.get("/provider-account-identities/:identityId",(req,res)=>{try{return res.json({success:true,identity:service.get(req.params.identityId)});}catch(error){return handle(error,res);}});
 return router;
}
