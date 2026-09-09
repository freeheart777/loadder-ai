import express from 'express';
import { GrowthContentError } from '../growth/content-contract.mjs';
export function createGrowthContentRouter({repository,service}) {
  const router=express.Router();
  router.use((req,res,next)=>req.user?.id&&req.membership?.status==='active'?next():res.status(403).json({success:false,code:'CONTENT_ACCESS_DENIED'}));
  const route=fn=>async(req,res)=>{try{const result=await fn(req,{userId:req.user.id});if(!result)return res.status(404).json({success:false,code:'CONTENT_NOT_FOUND'});res.json({success:true,result,publishingAuthorized:false});}catch(e){res.status(e instanceof GrowthContentError?e.status:500).json({success:false,code:e instanceof GrowthContentError?e.code:'CONTENT_OPERATION_FAILED'});}};
  router.post('/growth/content/briefs',route((r,a)=>repository.createBrief(r.body,a)));
  router.get('/growth/content/briefs/:id',route((r,a)=>repository.getBrief(r.params.id,a)));
  router.get('/growth/experiments/:id/briefs',route((r,a)=>repository.listBriefs(r.params.id,r.query,a)));
  router.get('/growth/experiments/:id/candidates',route((r,a)=>repository.listExperimentCandidates(r.params.id,r.query,a)));
  router.post('/growth/content/briefs/:id/candidates',route((r,a)=>service.generate(r.params.id,r.body,a)));
  router.get('/growth/content/briefs/:id/candidates',route((r,a)=>repository.listCandidates(r.params.id,r.query,a)));
  router.get('/growth/content/candidates/:id',route((r,a)=>repository.getCandidate(r.params.id,a)));
  router.post('/growth/content/candidates/:id/decision',route((r,a)=>repository.decide(r.params.id,r.body,a)));
  return router;
}
