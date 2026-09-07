import express from 'express';
import { GrowthLeadError } from '../repositories/growth-lead-evidence-repository.mjs';
export function createGrowthLeadEvidenceRouter({repository}) {
  const router=express.Router();
  router.post('/growth/leads/:id/convert',(req,res)=>{
    if(!req.user?.id||req.membership?.status!=='active')return res.status(403).json({success:false,code:'GROWTH_LEAD_FORBIDDEN'});
    try{return res.json({success:true,result:repository.convert(req.params.id,req.body,{userId:req.user.id})});}
    catch(e){return res.status(e instanceof GrowthLeadError?e.status:500).json({success:false,code:e instanceof GrowthLeadError?e.code:'GROWTH_LEAD_BRIDGE_FAILED'});}
  });
  return router;
}
