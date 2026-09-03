import { LoadderPostgresDataAdapter } from "./postgres-data-adapter.mjs";
import { withLoadderRetry, defaultTransientRetry } from "./retry-policy.mjs";

export function createPostgresRuntimeProvider({pool,closeOnDispose=false,retry=defaultTransientRetry}={}){
  if(!pool||typeof pool.query!=="function")throw new Error("PostgreSQL pool must implement query(text, values)");
  const adapter=new LoadderPostgresDataAdapter(pool);
  return Object.freeze({
    kind:"postgres",
    adapter,
    async health(){const started=Date.now();const result=await withLoadderRetry(()=>pool.query("SELECT 1 AS ok"),retry);return{ok:Number(result?.rows?.[0]?.ok||0)===1,latencyMs:Date.now()-started};},
    async recover(){const health=await this.health();if(!health.ok)throw new Error("PostgreSQL recovery health check failed");return{ok:true,...health};},
    async dispose(){if(closeOnDispose&&typeof pool.end==="function")await pool.end();}
  });
}

export async function createPostgresRuntimeFromFactory({connectionString,poolFactory,max=10,idleTimeoutMs=30000,connectionTimeoutMs=5000,retry=defaultTransientRetry}={}){
  if(!connectionString)throw new Error("PostgreSQL connection string is required");
  if(typeof poolFactory!=="function")throw new Error("PostgreSQL poolFactory is required");
  const pool=await poolFactory({connectionString,max,idleTimeoutMillis:idleTimeoutMs,connectionTimeoutMillis:connectionTimeoutMs});
  return createPostgresRuntimeProvider({pool,closeOnDispose:true,retry});
}
