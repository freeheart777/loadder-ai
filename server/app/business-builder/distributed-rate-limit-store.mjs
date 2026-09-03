export function createDistributedRateLimitStore({increment,resetKey,prefix="loadder:bb"}={}){
  if(typeof increment!=="function")throw new Error("increment(key, windowMs) is required");
  return {
    localKeys:false,
    prefix,
    async increment(key){const result=await increment(`${prefix}:${key}`);const totalHits=Number(result?.totalHits??result?.count??0);const resetTime=result?.resetTime instanceof Date?result.resetTime:new Date(Number(result?.resetAt||Date.now()+60_000));return{totalHits,resetTime};},
    async decrement(){},
    async resetKey(key){if(typeof resetKey==="function")await resetKey(`${prefix}:${key}`);}
  };
}
