import express from 'express';

export function createBusinessStateRouter({service}) {
  const router=express.Router();
  router.get('/business-state',(req,res)=>{
    try{return res.json({success:true,state:service.getSnapshot({workspace:req.workspace,actor:{userId:req.user.id}})});}
    catch(error){return res.status(500).json({success:false,code:'BUSINESS_STATE_READ_FAILED',message:'Business state is temporarily unavailable.',developmentDetail:process.env.NODE_ENV==='test'?error.message:undefined});}
  });
  return router;
}
