export const LOADDER_LOW_COST_PRODUCTION_PROFILE=Object.freeze({
  contract:"loadder.production-profile.v1",
  topology:{webApi:{minInstances:1,maxInstances:2},postgresql:{required:true},objectStorage:{required:true},queue:{required:false,enableWhen:"bursty-jobs"},workers:{mode:"ephemeral",alwaysOn:false}},
  forbiddenDefaults:["kubernetes","per-tenant-always-on-container","host-docker-socket","privileged-container","host-network"],
  health:{liveness:"/health",readiness:"/ready",canaryPercent:5,automaticRollback:true},
  backup:{database:{required:true,encrypted:true,offPrimaryHost:true},restoreDrillRequired:true},
  ai:{requiredForRuntime:false,deterministicBuildTokenBudget:0},
});
export function evaluateProductionProfile(config={}){const blockers=[];if(!config.postgresql)blockers.push("postgresql-required");if(!config.objectStorage)blockers.push("object-storage-required");if(config.hostDockerSocket)blockers.push("host-docker-socket-forbidden");if(config.privileged)blockers.push("privileged-runtime-forbidden");if(config.perTenantAlwaysOn)blockers.push("per-tenant-always-on-forbidden");if(!config.backupEncrypted)blockers.push("encrypted-backup-required");if(!config.restoreDrillVerified)blockers.push("restore-drill-required");return{ready:blockers.length===0,blockers,profile:LOADDER_LOW_COST_PRODUCTION_PROFILE.contract};}
