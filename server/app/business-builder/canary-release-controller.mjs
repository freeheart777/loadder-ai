export async function executeCanaryRelease({adapter,artifact,expectedChecksum,context={},canaryPercent=5,healthAttempts=3}={}){
  if(!adapter)throw new Error("Deploy adapter is required");
  const deployment=await adapter.deploy({artifact,expectedChecksum,context:{...context,canaryPercent}});
  let lastHealth=null;
  for(let attempt=1;attempt<=healthAttempts;attempt++){
    lastHealth=await adapter.health(deployment);
    if(lastHealth?.ok===true)return{ok:true,status:"healthy",deployment,health:lastHealth,canaryPercent};
  }
  const rollback=await adapter.rollback(deployment,{code:"CANARY_HEALTH_FAILED",health:lastHealth});
  return{ok:false,status:"rolled_back",deployment,health:lastHealth,rollback,canaryPercent};
}
