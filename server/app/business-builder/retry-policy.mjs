const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function withLoadderRetry(operation,{attempts=3,baseDelayMs=50,maxDelayMs=500,shouldRetry=()=>true,onRetry=()=>{}}={}){
  if(typeof operation!=="function")throw new Error("operation function is required");
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await operation({attempt});}
    catch(error){lastError=error;if(attempt>=attempts||!shouldRetry(error,{attempt}))break;const delay=Math.min(maxDelayMs,baseDelayMs*2**(attempt-1));await onRetry(error,{attempt,nextAttempt:attempt+1,delayMs:delay});if(delay>0)await sleep(delay);}
  }
  throw lastError;
}

export const defaultTransientRetry=Object.freeze({
  attempts:3,
  baseDelayMs:75,
  maxDelayMs:500,
  shouldRetry:error=>Boolean(error&&(error.code==="ECONNRESET"||error.code==="ETIMEDOUT"||error.code==="57P01"||error.transient===true))
});
