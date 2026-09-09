import express from 'express';
import { CopilotError } from '../growth/copilot-contract.mjs';

export function createGrowthCopilotRouter({repository}) {
  const router=express.Router();
  const handler=fn=>(req,res)=>{
    if(!req.user?.id || req.membership?.status!=='active') return res.status(403).json({success:false,code:'COPILOT_FORBIDDEN'});
    try {
      const result=fn(req,{userId:req.user.id});
      if(!result) return res.status(404).json({success:false,code:'COPILOT_NOT_FOUND'});
      return res.json({success:true,result});
    } catch(e) {
      return res.status(e instanceof CopilotError?e.status:500).json({success:false,code:e instanceof CopilotError?e.code:'COPILOT_FAILED'});
    }
  };
  router.post('/growth/copilot/runs',handler((r,a)=>repository.prepare(r.body,a)));
  router.get('/growth/copilot/evidence',handler((r,a)=>repository.readEvidence(r.query,a)));
  router.get('/growth/copilot/leads',handler((r,a)=>repository.listEligibleLeads(r.query,a)));
  router.get('/growth/copilot/runs',handler((r,a)=>repository.list(r.query,a)));
  router.get('/growth/copilot/runs/:id',handler((r,a)=>repository.get(r.params.id,a)));
  return router;
}
