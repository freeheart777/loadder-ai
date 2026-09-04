const FORBIDDEN=new Set(["host-network","docker-socket","privileged"]);
export function createWorkerExecutionPolicy({timeoutMs=30000,maxPayloadBytes=262144,allowedKinds=["build","ai","executor"]}={}){const kinds=new Set(allowedKinds);return Object.freeze({validate(job){if(!job||!kinds.has(job.kind))throw new Error("Unsupported worker job kind");const bytes=Buffer.byteLength(JSON.stringify(job.payload??null));if(bytes>maxPayloadBytes)throw new Error("Worker payload exceeds limit");for(const capability of job.capabilities||[])if(FORBIDDEN.has(capability))throw new Error(`Forbidden worker capability: ${capability}`);return{ok:true,bytes,timeoutMs};}});}
export async function executeIsolatedWorker({job,policy=createWorkerExecutionPolicy(),runner}={}){
  if(typeof runner!=="function")throw new Error("Worker runner is required");
  const validated=policy.validate(job),controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const error=new Error("Worker execution timed out");error.code="WORKER_TIMEOUT";reject(error);},validated.timeoutMs);});
  const execution=Promise.resolve().then(()=>runner({job,signal:controller.signal}));
  try{return{ok:true,result:await Promise.race([execution,timeout])};}finally{clearTimeout(timer);}
}
