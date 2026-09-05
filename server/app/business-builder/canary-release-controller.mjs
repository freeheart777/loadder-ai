export async function executeCanaryRelease({adapter,artifact,expectedChecksum,context={},canaryPercent=5,healthAttempts=3}={}){
  if(!adapter)throw new Error("Deploy adapter is required");
  const deployment=await adapter.deploy({artifact,expectedChecksum,context:{...context,canaryPercent}});
  let lastHealth=null,lastError=null;
  for(let attempt=1;attempt<=healthAttempts;attempt++){
    try{
      lastHealth=await adapter.health(deployment);
      lastError=null;
      if(lastHealth?.ok===true)return{ok:true,status:"healthy",deployment,health:lastHealth,canaryPercent};
    }catch(error){
      lastError=error;
      lastHealth={ok:false,errorCode:String(error?.code||"HEALTH_CHECK_ERROR")};
    }
  }
  const reason={code:lastError?"CANARY_HEALTH_ERROR":"CANARY_HEALTH_FAILED",health:lastHealth};
  const rollback=await adapter.rollback(deployment,reason);
  return{ok:false,status:"rolled_back",deployment,health:lastHealth,rollback,canaryPercent};
}
