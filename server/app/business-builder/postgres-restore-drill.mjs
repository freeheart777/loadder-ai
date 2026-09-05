import crypto from"node:crypto";

const SHA=/^[0-9a-f]{40}$/i;
const CHECKSUM=/^[0-9a-f]{64}$/i;

export function createPostgresRestoreDrill({restoreBackup,verifyTarget,releaseEvidence}={}){
  if(typeof restoreBackup!=="function")throw new Error("restoreBackup is required");
  if(typeof verifyTarget!=="function")throw new Error("verifyTarget is required");
  if(!releaseEvidence||typeof releaseEvidence.record!=="function")throw new Error("releaseEvidence store is required");
  return Object.freeze({
    async run({projectId,versionId,releaseSha,backupId,backupChecksum,target,recordedBy=null}={}){
      const sha=String(releaseSha||"").trim().toLowerCase(),checksum=String(backupChecksum||"").trim().toLowerCase();
      if(!projectId||!versionId)throw new Error("projectId and versionId are required");
      if(!SHA.test(sha))throw new Error("releaseSha must be an exact 40-character commit SHA");
      if(!String(backupId||"").trim())throw new Error("backupId is required");
      if(!CHECKSUM.test(checksum))throw new Error("backupChecksum must be an exact SHA-256 checksum");
      if(!target||target.kind!=="postgres"||target.disposable!==true||target.environment==="production")throw new Error("Restore drill requires a disposable non-production PostgreSQL target");
      const drillId=crypto.randomUUID(),startedAt=new Date().toISOString();
      const restored=await restoreBackup({drillId,backupId:String(backupId),backupChecksum:checksum,target,projectId,versionId,releaseSha:sha});
      if(restored?.ok!==true)throw new Error("PostgreSQL restore drill failed");
      const verified=await verifyTarget({drillId,target,projectId,versionId,releaseSha:sha,restored});
      if(verified?.ok!==true||verified?.schemaValid!==true||verified?.tenantIsolationValid!==true)throw new Error("PostgreSQL restore verification failed");
      const completedAt=new Date().toISOString();
      const evidence=releaseEvidence.record({projectId,versionId,releaseSha:sha,type:"backup_restore",status:"passed",recordedBy,details:{drillId,backupId:String(backupId),backupChecksum:checksum,targetKind:"postgres",targetEnvironment:String(target.environment||"drill"),schemaValid:true,tenantIsolationValid:true,startedAt,completedAt}});
      return{ok:true,drillId,evidence,verification:{schemaValid:true,tenantIsolationValid:true}};
    }
  });
}
