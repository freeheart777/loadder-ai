import express from 'express';
import { GrowthAssessmentError } from '../repositories/growth-assessment-repository.mjs';
export function createGrowthAssessmentRouter({repository}) {
  const router=express.Router();
  router.post('/growth/assessments',(req,res)=>{
    if(!req.user?.id||req.membership?.status!=='active')return res.status(403).json({success:false,code:'ASSESSMENT_FORBIDDEN'});
    try{return res.json({success:true,result:repository.calculate(req.body,{userId:req.user.id})});}
    catch(e){return res.status(e instanceof GrowthAssessmentError?e.status:500).json({success:false,code:e instanceof GrowthAssessmentError?e.code:'ASSESSMENT_FAILED'});}
  });
  return router;
}
