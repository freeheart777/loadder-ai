import crypto from "node:crypto";

export function sha256Artifact(artifact){return crypto.createHash("sha256").update(typeof artifact==="string"?artifact:JSON.stringify(artifact)).digest("hex");}

export function createProductionDeployAdapter({deploy,health,rollback}={}){
  if(typeof deploy!=="function"||typeof health!=="function"||typeof rollback!=="function")throw new Error("deploy, health and rollback functions are required");
  return Object.freeze({
    async deploy({artifact,expectedChecksum,context={}}={}){
      if(!artifact)throw new Error("Deployment artifact is required");
      const checksum=sha256Artifact(artifact);
      if(expectedChecksum&&expectedChecksum!==checksum)throw new Error("Deployment artifact checksum mismatch");
      const deployment=await deploy({artifact,checksum,context});
      if(!deployment?.id)throw new Error("Deployment provider must return deployment id");
      return{...deployment,checksum};
    },
    async health(deployment){return health(deployment);},
    async rollback(deployment,reason){return rollback(deployment,reason);}
  });
}
